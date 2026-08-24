const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Core Integration Suite — Restoration, RBAC, Super Admin, Billing & Quotas", () => {
    let Organization;
    let RBAC;
    let SuperAdmin;
    let RazorpayBilling;
    let Incident;
    let orgA;
    let userAId;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-core-integration.db");
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
        const rbacModule = require("../../server/middleware/rbac.js");
        RBAC = rbacModule.RBAC;
        SuperAdmin = require("../../server/model/super-admin.js");
        RazorpayBilling = require("../../server/model/razorpay-billing.js");
        Incident = require("../../server/model/incident.js");

        await R.exec("INSERT INTO user (username, password, active, is_super_admin) VALUES ('super_user', 'pass_super', 1, 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'super_user'");

        orgA = await Organization.createOrganization("Core Test Org", "core-test-org", userAId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("1. Incident Source of Truth — Active Incident Statistics", async () => {
        const stats = await Incident.getIncidentDashboardStats(orgA.id);
        assert.ok(stats !== undefined, "Incident stats object returned");
        assert.strictEqual(typeof stats.activeCount, "number");
        assert.strictEqual(typeof stats.p1Count, "number");
    });

    it("2. RBAC System — Owner Permission Matrix Assertions", async () => {
        const role = await RBAC.assertPermission(userAId, orgA.id, "monitor.create");
        assert.strictEqual(role, "owner");

        const teamRole = await RBAC.assertPermission(userAId, orgA.id, "team.manage");
        assert.strictEqual(teamRole, "owner");
    });

    it("3. Super Admin Governance — Tenant List & Quota Overrides", async () => {
        await SuperAdmin.assertSuperAdmin(userAId);
        const tenants = await SuperAdmin.getAllOrganizations();
        assert.ok(Array.isArray(tenants), "Super Admin retrieves tenant list");
        assert.ok(tenants.length >= 1, "At least 1 tenant exists");

        await SuperAdmin.updateOrganizationPlan(orgA.id, "pro", {
            maxMonitors: 50,
            maxDevices: 100,
            maxMembers: 25,
        });

        const summary = await RazorpayBilling.getBillingSummary(orgA.id);
        assert.strictEqual(summary.plan, "pro");
        assert.strictEqual(summary.limits.maxMonitors, 50);
    });

    it("4. SaaS Billing & Signature Verification — Razorpay Integration", async () => {
        const summary = await RazorpayBilling.getBillingSummary(orgA.id);
        assert.strictEqual(summary.plan, "pro");
        assert.strictEqual(summary.limits.maxMonitors, 50);

        const order = await RazorpayBilling.createOrder(orgA.id, "enterprise", userAId);
        assert.ok(order.orderId.startsWith("order_"));
        assert.strictEqual(order.amount, 999900);
    });

    it("5. Strict SaaS Quota Enforcement — Team Member Invite Limit", async () => {
        // Update org limit to 1 for quota test
        await R.exec("UPDATE organization SET max_members = 1 WHERE id = ?", [ orgA.id ]);

        await assert.rejects(
            async () => {
                await Organization.inviteMember(orgA.id, "quota_overflow@example.com", "engineer", userAId);
            },
            (err) => {
                assert.match(err.message, /SaaS Quota Limit Reached/);
                return true;
            }
        );
    });

    it("6. Multi-Tenant Governance — Audit Log Stream", async () => {
        await Organization.logAudit(orgA.id, userAId, "e2e_test_event", { scope: "integration_test" });
        const logs = await Organization.getOrganizationAuditLogs(orgA.id, 10);
        assert.ok(logs.length > 0, "Audit log stream returns entries");
        assert.strictEqual(logs[0].event, "e2e_test_event");
    });
});
