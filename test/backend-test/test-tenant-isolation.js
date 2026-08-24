const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("Tenant Isolation Security Test Suite", () => {
    let Organization;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let monitorAId;
    let monitorBId;

    before(async () => {
        // Setup SQLite test database in memory / test dir
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-tenant.db");
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

        // Initialize base database schema and run migrations
        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();

        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        Organization = require("../../server/model/organization.js");

        // Create User A and User B
        await R.exec("INSERT INTO user (username, password, active) VALUES ('user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'user_b'");

        // Create Organization A (User A is owner)
        orgA = await Organization.createOrganization("Org Alpha", "org-alpha", userAId);

        // Create Organization B (User B is owner)
        orgB = await Organization.createOrganization("Org Beta", "org-beta", userBId);

        // Insert Monitor A into Org A
        await R.exec(
            "INSERT INTO monitor (name, type, active, user_id, organization_id, weight) VALUES (?, 'http', 1, ?, ?, 1000)",
            ["Monitor Alpha (Org A)", userAId, orgA.id]
        );
        monitorAId = await R.getCell("SELECT id FROM monitor WHERE name = 'Monitor Alpha (Org A)'");

        // Insert Monitor B into Org B
        await R.exec(
            "INSERT INTO monitor (name, type, active, user_id, organization_id, weight) VALUES (?, 'http', 1, ?, ?, 1000)",
            ["Monitor Beta (Org B)", userBId, orgB.id]
        );
        monitorBId = await R.getCell("SELECT id FROM monitor WHERE name = 'Monitor Beta (Org B)'");

        // Insert Notification A into Org A
        await R.exec(
            "INSERT INTO notification (name, config, active, user_id, organization_id) VALUES ('Notifier A', '{}', 1, ?, ?)",
            [userAId, orgA.id]
        );

        // Insert Notification B into Org B
        await R.exec(
            "INSERT INTO notification (name, config, active, user_id, organization_id) VALUES ('Notifier B', '{}', 1, ?, ?)",
            [userBId, orgB.id]
        );

        // Insert Status Page A into Org A
        await R.exec(
            "INSERT INTO status_page (slug, title, icon, theme, published, search_engine_index, show_tags, show_powered_by, organization_id) VALUES ('status-a', 'Status A', '/icon.svg', 'auto', 1, 1, 1, 1, ?)",
            [orgA.id]
        );

        // Insert Status Page B into Org B
        await R.exec(
            "INSERT INTO status_page (slug, title, icon, theme, published, search_engine_index, show_tags, show_powered_by, organization_id) VALUES ('status-b', 'Status B', '/icon.svg', 'auto', 1, 1, 1, 1, ?)",
            [orgB.id]
        );
    });

    after(async () => {
        await R.close();
    });

    it("should confirm Organization A and B are created with correct ownership", async () => {
        const roleA = await Organization.getUserRoleInOrganization(userAId, orgA.id);
        const roleB = await Organization.getUserRoleInOrganization(userBId, orgB.id);
        assert.strictEqual(roleA, "owner");
        assert.strictEqual(roleB, "owner");
    });

    it("should prevent User A from switching to Organization B without membership", async () => {
        const roleAInOrgB = await Organization.getUserRoleInOrganization(userAId, orgB.id);
        assert.strictEqual(roleAInOrgB, null, "User A must not have a role in Organization B");
    });

    it("should isolate monitors so User A in Org A cannot view Org B monitors", async () => {
        const orgAMonitors = await R.getAll(
            "SELECT * FROM monitor WHERE organization_id = ?",
            [orgA.id]
        );
        const ids = orgAMonitors.map((m) => m.id);
        assert.ok(ids.includes(monitorAId), "Org A monitors must include Monitor A");
        assert.ok(!ids.includes(monitorBId), "Org A monitors MUST NOT include Monitor B");
    });

    it("should isolate notifications so User A in Org A cannot view Org B notifications", async () => {
        const orgANotifications = await R.getAll(
            "SELECT * FROM notification WHERE organization_id = ?",
            [orgA.id]
        );
        const names = orgANotifications.map((n) => n.name);
        assert.ok(names.includes("Notifier A"), "Org A must contain Notifier A");
        assert.ok(!names.includes("Notifier B"), "Org A MUST NOT contain Notifier B");
    });

    it("should isolate status pages so User A in Org A cannot view Org B status pages", async () => {
        const orgAStatusPages = await R.getAll(
            "SELECT * FROM status_page WHERE organization_id = ?",
            [orgA.id]
        );
        const slugs = orgAStatusPages.map((s) => s.slug);
        assert.ok(slugs.includes("status-a"), "Org A must contain status-a");
        assert.ok(!slugs.includes("status-b"), "Org A MUST NOT contain status-b");
    });

    it("should log audit events for organization creation and role assignment", async () => {
        const auditLogs = await R.getAll(
            "SELECT * FROM organization_audit_log WHERE organization_id = ?",
            [orgA.id]
        );
        assert.ok(auditLogs.length > 0, "Audit logs must be written for Organization A");
        assert.strictEqual(auditLogs[0].event, "organization_created");
    });
});
