const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Incident Consistency & Data Resolution Test Suite", () => {
    let Organization;
    let Incident;
    let testOrgId;
    let userId;
    let monitorId;
    let probeId;
    let incA;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-incident-consistency.db");
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

        await R.exec("INSERT INTO user (username, password, active) VALUES ('admin_user', 'secret', 1)");
        userId = await R.getCell("SELECT id FROM user WHERE username = 'admin_user'");

        const org = await Organization.createOrganization("InfiniNOC Core Network", "core-net", userId);
        testOrgId = org.id;

        // Insert test probe
        await R.exec(`
            INSERT INTO probe (name, status, ip_address, organization_id)
            VALUES ('Edge Collector 01', 'online', '10.10.10.50', ${testOrgId})
        `);
        probeId = await R.getCell("SELECT id FROM probe WHERE name = 'Edge Collector 01'");

        // Insert test monitor with probe_id assigned
        await R.exec(`
            INSERT INTO monitor (name, type, hostname, port, user_id, probe_id)
            VALUES ('Core Gateway Ping', 'ping', '192.168.1.1', 0, ${userId}, ${probeId})
        `);
        monitorId = await R.getCell("SELECT id FROM monitor WHERE name = 'Core Gateway Ping'");
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should create incident with explicit failure_reason and default orgId", async () => {
        incA = await Incident.createIncident(
            {
                title: "Service Outage: Core Gateway Ping",
                description: "ICMP packet loss reached 100% (Host unreachable)",
                severity: "P1",
                failure_reason: "100% packet loss to 192.168.1.1 detected from Edge Collector 01",
            },
            testOrgId,
            userId
        );

        assert.ok(incA.id, "Incident ID should exist");
        assert.strictEqual(incA.title, "Service Outage: Core Gateway Ping");
        assert.strictEqual(incA.failure_reason, "100% packet loss to 192.168.1.1 detected from Edge Collector 01");
        assert.strictEqual(incA.status, "OPEN");

        // Link monitor entity
        await Incident.linkEntities(incA.id, [{ entity_type: "monitor", entity_id: monitorId }], testOrgId);
    });

    it("should retrieve incidents matching scoped org and fallback properly", async () => {
        // Insert second incident
        await R.exec(`
            INSERT INTO incident (title, content, description, severity, status, organization_id, created_at, failure_reason)
            VALUES ('Switch Power Failure', 'Core switch dual PSU outage', 'Core switch dual PSU outage', 'P1', 'OPEN', ${testOrgId}, datetime('now'), 'PSU A and PSU B down')
        `);

        // Fetch with testOrgId
        const incidents = await Incident.getIncidents(testOrgId, { status: "OPEN" });
        assert.ok(incidents.length >= 2, `Should return both created incidents, found ${incidents.length}`);

        const found = incidents.find((i) => i.title === "Switch Power Failure");
        assert.ok(found, "Second incident should be returned");
        assert.strictEqual(found.failure_reason, "PSU A and PSU B down");
    });

    it("should match active incidents across OPEN, ACKNOWLEDGED, and IN_PROGRESS when status filter is OPEN or ACTIVE", async () => {
        // Create an incident in ACKNOWLEDGED status
        const ackInc = await Incident.createIncident(
            {
                title: "High Latency on Uplink",
                description: "Latency exceeded 150ms",
                severity: "P2",
                failure_reason: "Fiber degradation on primary wavelength",
            },
            testOrgId,
            userId
        );
        await Incident.updateStatus(ackInc.id, "ACKNOWLEDGED", userId, null, testOrgId);

        // Create an incident in IN_PROGRESS status
        const progInc = await Incident.createIncident(
            {
                title: "BGP Route Flapping",
                description: "Session reset count > 5",
                severity: "P2",
                failure_reason: "Peer ASN 64512 withdraw burst",
            },
            testOrgId,
            userId
        );
        await Incident.updateStatus(progInc.id, "IN_PROGRESS", userId, null, testOrgId);

        // Fetch with OPEN filter
        const openResults = await Incident.getIncidents(testOrgId, { status: "OPEN" });
        const hasAck = openResults.some((i) => i.id === ackInc.id);
        const hasProg = openResults.some((i) => i.id === progInc.id);

        assert.ok(hasAck, "ACKNOWLEDGED incidents should be included in OPEN filter");
        assert.ok(hasProg, "IN_PROGRESS incidents should be included in OPEN filter");
    });

    it("should enrich incident list with linked monitor and probe details", async () => {
        const incidents = await Incident.getIncidents(testOrgId, {});
        const linked = incidents.find((i) => i.title === "Service Outage: Core Gateway Ping");

        assert.ok(linked, "Linked incident should exist");
        assert.strictEqual(linked.monitor_name, "Core Gateway Ping");
        assert.strictEqual(linked.monitor_type, "ping");
        assert.strictEqual(linked.probe_name, "Edge Collector 01");
    });

    it("should resolve incident and calculate recovery duration / MTTR", async () => {
        const list = await Incident.getIncidents(testOrgId, { status: "OPEN" });
        const target = list[0];

        const updated = await Incident.updateStatus(
            target.id,
            "RESOLVED",
            userId,
            { resolution: "ICMP response restored, latency stabilized at 1.2ms." },
            testOrgId
        );

        assert.strictEqual(updated.status, "RESOLVED");
        assert.ok(updated.resolved_at, "resolved_at timestamp must be populated");

        // Verify stats
        const stats = await Incident.getIncidentDashboardStats(testOrgId);
        assert.ok(stats.recentIncidents.some((i) => i.status === "RESOLVED"), "Should have resolved incident in stats");
        assert.ok(typeof stats.mttrMinutes === "number", "MTTR should be computed");
    });
});
