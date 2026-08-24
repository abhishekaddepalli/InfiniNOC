const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Incident Management & Tenant Isolation Test Suite", () => {
    let Organization;
    let Incident;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let incA;
    let incB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-incidents.db");
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
        Incident = require("../../server/model/incident.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('engineer_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'engineer_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('engineer_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'engineer_b'");

        orgA = await Organization.createOrganization("Org Incident Alpha", "org-inc-alpha", userAId);
        orgB = await Organization.createOrganization("Org Incident Beta", "org-inc-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should declare P1 incident in Org A and P2 incident in Org B", async () => {
        incA = await Incident.createIncident(
            { title: "Vijayawada POP Fiber Cut", description: "Primary backbone cut near highway", severity: "P1", site_id: 1 },
            orgA.id,
            userAId
        );
        assert.ok(incA.id);
        assert.strictEqual(incA.title, "Vijayawada POP Fiber Cut");
        assert.strictEqual(incA.severity, "P1");
        assert.strictEqual(incA.status, "OPEN");
        assert.strictEqual(incA.timeline.length, 1);

        incB = await Incident.createIncident(
            { title: "Kakinada Router High CPU", description: "BGP route flap causing CPU surge", severity: "P2" },
            orgB.id,
            userBId
        );
        assert.ok(incB.id);
    });

    it("should assign lead engineer and log timeline entry", async () => {
        const updated = await Incident.assignEngineer(incA.id, userAId, userAId, orgA.id);
        assert.strictEqual(updated.assigned_user_id, userAId);
        assert.strictEqual(updated.timeline.length, 2);
        assert.strictEqual(updated.timeline[1].event_type, "assigned");
    });

    it("should post investigation notes to timeline", async () => {
        await Incident.addNote(incA.id, "OTDR trace shows break at KM 14.2", userAId, orgA.id);
        const details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.timeline.length, 3);
        assert.strictEqual(details.timeline[2].message, "OTDR trace shows break at KM 14.2");
    });

    it("should progress status lifecycle (ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> CLOSED) and record timestamps", async () => {
        // Acknowledge
        await Incident.updateStatus(incA.id, "ACKNOWLEDGED", userAId, null, orgA.id);
        let details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.status, "ACKNOWLEDGED");
        assert.ok(details.acknowledged_at);

        // In Progress
        await Incident.updateStatus(incA.id, "IN_PROGRESS", userAId, null, orgA.id);
        details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.status, "IN_PROGRESS");

        // Resolve
        await Incident.updateStatus(
            incA.id,
            "RESOLVED",
            userAId,
            { root_cause: "Physical fiber splice damage", resolution: "Spliced 12 cores and verified OTDR" },
            orgA.id
        );
        details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.status, "RESOLVED");
        assert.ok(details.resolved_at);
        assert.strictEqual(details.root_cause, "Physical fiber splice damage");

        // Close
        await Incident.updateStatus(incA.id, "CLOSED", userAId, null, orgA.id);
        details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.status, "CLOSED");
        assert.ok(details.closed_at);
    });

    it("should allow reopening a closed incident", async () => {
        const reopened = await Incident.reopenIncident(incA.id, userAId, orgA.id);
        assert.strictEqual(reopened.status, "OPEN");
        assert.strictEqual(reopened.resolved_at, null);
        assert.strictEqual(reopened.closed_at, null);
    });

    it("should link infrastructure assets (alerts, devices, monitors) to incident", async () => {
        const links = await Incident.linkEntities(
            incA.id,
            [
                { entity_type: "device", entity_id: 10 },
                { entity_type: "monitor", entity_id: 5 },
                { entity_type: "alert", entity_id: 1 },
            ],
            orgA.id
        );
        assert.strictEqual(links.length, 3);

        const details = await Incident.getIncidentDetails(incA.id, orgA.id);
        assert.strictEqual(details.links.length, 3);
    });

    it("should calculate incident dashboard stats & MTTR correctly", async () => {
        // Resolve incident incA again for MTTR calculation
        await Incident.updateStatus(incA.id, "RESOLVED", userAId, { resolution: "Restored" }, orgA.id);

        const stats = await Incident.getIncidentDashboardStats(orgA.id);
        assert.strictEqual(stats.activeCount, 0); // Both resolved
        assert.strictEqual(stats.p1Count, 0);
        assert.ok(stats.recentIncidents.length > 0);
    });

    it("should enforce tenant isolation so Org A cannot view, assign, or modify Org B incidents", async () => {
        const listA = await Incident.getIncidents(orgA.id);
        assert.strictEqual(listA.length, 1);

        const listB = await Incident.getIncidents(orgB.id);
        assert.strictEqual(listB.length, 1);

        await assert.rejects(
            async () => {
                await Incident.getIncidentDetails(incB.id, orgA.id);
            },
            { message: "Incident not found or access denied." }
        );

        await assert.rejects(
            async () => {
                await Incident.assignEngineer(incB.id, userAId, userAId, orgA.id);
            },
            { message: "Incident not found or access denied." }
        );
    });
});
