const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Enterprise Alert Engine Test Suite", () => {
    let Organization;
    let AlertEngine;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let ruleA1;
    let ruleA2;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-alerts.db");
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knex = require("knex")({
            client: Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        R.setup(knex);
        R.freeze(false);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();

        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        Organization = require("../../server/model/organization.js");
        AlertEngine = require("../../server/model/alert-engine.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('alert_user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'alert_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('alert_user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'alert_user_b'");

        orgA = await Organization.createOrganization("Org Alert Alpha", "org-alert-alpha", userAId);
        orgB = await Organization.createOrganization("Org Alert Beta", "org-alert-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should create alert rules scoped to Org A", async () => {
        ruleA1 = await AlertEngine.createRule(
            { name: "CPU High Warning", target_type: "device", target_id: 10, metric: "cpu", operator: ">", threshold: 80, severity: "WARNING", cooldown_seconds: 1800 },
            orgA.id
        );
        assert.ok(ruleA1.id);
        assert.strictEqual(ruleA1.name, "CPU High Warning");
        assert.strictEqual(ruleA1.severity, "WARNING");

        ruleA2 = await AlertEngine.createRule(
            { name: "CPU Critical", target_type: "device", target_id: 10, metric: "cpu", operator: ">", threshold: 95, severity: "CRITICAL", cooldown_seconds: 1800 },
            orgA.id
        );
        assert.ok(ruleA2.id);
    });

    it("should trigger WARNING alert when threshold is breached (>80)", async () => {
        const res = await AlertEngine.evaluateRule(ruleA1, 85, { id: 10, in_maintenance: false });
        assert.ok(res.created);
        assert.strictEqual(res.alert.state, "WARNING");
        assert.strictEqual(Number(res.alert.trigger_value), 85);

        const activeList = await AlertEngine.getActiveAlerts(orgA.id);
        assert.strictEqual(activeList.length, 1);
        assert.strictEqual(activeList[0].metric, "cpu");
    });

    it("should suppress duplicate notification when metric breaches threshold again within cooldown window", async () => {
        const res = await AlertEngine.evaluateRule(ruleA1, 88, { id: 10, in_maintenance: false });
        assert.strictEqual(res.suppressed, true);
        assert.strictEqual(res.reason, "cooldown");

        // Active alerts count should remain 1 (no duplicate active alert row)
        const activeList = await AlertEngine.getActiveAlerts(orgA.id);
        assert.strictEqual(activeList.length, 1);
    });

    it("should transition to RECOVERED when metric drops back below threshold", async () => {
        const res = await AlertEngine.evaluateRule(ruleA1, 45, { id: 10, in_maintenance: false });
        assert.strictEqual(res.recovered, true);

        // Active alert should be deleted
        const activeList = await AlertEngine.getActiveAlerts(orgA.id);
        assert.strictEqual(activeList.length, 0);

        // Alert history should record RECOVERED state transition
        const history = await AlertEngine.getAlertHistory(orgA.id);
        assert.ok(history.some((h) => h.state === "RECOVERED"));
    });

    it("should suppress alert generation when target entity is in maintenance", async () => {
        const res = await AlertEngine.evaluateRule(ruleA1, 99, { id: 10, in_maintenance: true });
        assert.strictEqual(res.suppressed, true);
        assert.strictEqual(res.reason, "maintenance");

        const activeList = await AlertEngine.getActiveAlerts(orgA.id);
        assert.strictEqual(activeList.length, 0);
    });

    it("should allow acknowledging and silencing active alerts", async () => {
        // Trigger alert again
        const res = await AlertEngine.evaluateRule(ruleA2, 98, { id: 10, in_maintenance: false });
        assert.ok(res.created);

        // Acknowledge alert
        const acked = await AlertEngine.acknowledgeAlert(res.alert.id, userAId, orgA.id);
        assert.strictEqual(Number(acked.acknowledged), 1);

        // Silence alert for 60 minutes
        const silenced = await AlertEngine.silenceAlert(res.alert.id, 60, orgA.id);
        assert.ok(silenced.silenced_until);

        // Subsequent evaluation should be suppressed due to silencing
        const evalRes = await AlertEngine.evaluateRule(ruleA2, 99, { id: 10, in_maintenance: false });
        assert.strictEqual(evalRes.suppressed, true);
        assert.strictEqual(evalRes.reason, "silenced");
    });

    it("should enforce tenant isolation so Org A cannot query, acknowledge, or delete Org B alert rules", async () => {
        const ruleB = await AlertEngine.createRule(
            { name: "Org B Probe Offline", target_type: "probe", target_id: 2, metric: "probe_offline", operator: "==", threshold: 1, severity: "CRITICAL" },
            orgB.id
        );
        assert.ok(ruleB.id);

        const rulesA = await AlertEngine.getRules(orgA.id);
        assert.strictEqual(rulesA.length, 2);

        const rulesB = await AlertEngine.getRules(orgB.id);
        assert.strictEqual(rulesB.length, 1);

        await assert.rejects(
            async () => {
                await AlertEngine.deleteRule(ruleB.id, orgA.id);
            },
            { message: "Alert rule not found or access denied." }
        );
    });
});
