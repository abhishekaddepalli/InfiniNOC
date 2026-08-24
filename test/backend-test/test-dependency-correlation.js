const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Network Dependency & Alert Correlation Test Suite", () => {
    let Organization;
    let Device;
    let Incident;
    let DependencyCorrelation;
    let orgA;
    let orgB;
    let coreRouterA;
    let aggSwitchA;
    let oltA;
    let routerB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-dependencies.db");
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
        Device = require("../../server/model/device.js");
        Incident = require("../../server/model/incident.js");
        DependencyCorrelation = require("../../server/model/dependency-correlation.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('topo_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'topo_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('topo_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'topo_user_b'");

        orgA = await Organization.createOrganization("Org Topology Alpha", "org-topo-alpha", userAId);
        orgB = await Organization.createOrganization("Org Topology Beta", "org-topo-beta", userBId);

        // Create network devices in Org A: Core Router -> Aggregation Switch -> OLT
        coreRouterA = await Device.createDevice(
            { name: "CORE-ROUTER-01", hostname: "core01.net", ip_address: "10.0.0.1", device_type: "Router", site_id: 1 },
            orgA.id
        );
        aggSwitchA = await Device.createDevice(
            { name: "AGG-SWITCH-01", hostname: "agg01.net", ip_address: "10.0.0.2", device_type: "Switch", site_id: 1 },
            orgA.id
        );
        oltA = await Device.createDevice(
            { name: "OLT-01", hostname: "olt01.net", ip_address: "10.0.0.3", device_type: "OLT", site_id: 1 },
            orgA.id
        );

        // Create network device in Org B
        routerB = await Device.createDevice(
            { name: "CORE-ROUTER-B", hostname: "coreB.net", ip_address: "10.200.0.1", device_type: "Router" },
            orgB.id
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should establish parent-child dependency links in Org A (Core Router -> Agg Switch -> OLT)", async () => {
        const link1 = await DependencyCorrelation.addDependency(coreRouterA.id, aggSwitchA.id, "UPSTREAM", orgA.id);
        assert.ok(link1.id);

        const link2 = await DependencyCorrelation.addDependency(aggSwitchA.id, oltA.id, "UPSTREAM", orgA.id);
        assert.ok(link2.id);

        const deps = await DependencyCorrelation.getDeviceDependencies(aggSwitchA.id, orgA.id);
        assert.strictEqual(deps.parents.length, 1);
        assert.strictEqual(deps.children.length, 1);
        assert.strictEqual(deps.parents[0].parent_name, "CORE-ROUTER-01");
        assert.strictEqual(deps.children[0].child_name, "OLT-01");
    });

    it("should handle root failure: Core Router failure creates P1 Incident with impact metrics", async () => {
        const res = await DependencyCorrelation.processDeviceFailure(coreRouterA.id, orgA.id);
        assert.strictEqual(res.createdRootIncident, true);
        assert.strictEqual(res.incident.severity, "P1");
        assert.strictEqual(res.incident.root_device_id, coreRouterA.id);
        assert.strictEqual(res.impact.affectedDevices, 3); // Core Router + Agg Switch + OLT
    });

    it("should handle downstream failure: Agg Switch & OLT failures correlate under Core Router incident without creating alert storm", async () => {
        // Agg Switch fails
        const resAgg = await DependencyCorrelation.processDeviceFailure(aggSwitchA.id, orgA.id);
        assert.strictEqual(resAgg.correlated, true);
        assert.strictEqual(resAgg.suppressedNewIncident, true);
        assert.strictEqual(resAgg.rootIncident.id, 1); // Associated with Core Router incident

        // OLT fails
        const resOlt = await DependencyCorrelation.processDeviceFailure(oltA.id, orgA.id);
        assert.strictEqual(resOlt.correlated, true);
        assert.strictEqual(resOlt.suppressedNewIncident, true);
        assert.strictEqual(resOlt.rootIncident.id, 1);

        // Verify total active incidents count in Org A remains 1
        const incidents = await Incident.getIncidents(orgA.id, { status: "OPEN" });
        assert.strictEqual(incidents.length, 1);

        // Verify linked assets on root incident include all correlated downstream devices
        const details = await Incident.getIncidentDetails(incidents[0].id, orgA.id);
        assert.strictEqual(details.links.length, 3); // Core Router, Agg Switch, OLT
    });

    it("should handle multiple independent roots by creating separate P1 incidents", async () => {
        const resB = await DependencyCorrelation.processDeviceFailure(routerB.id, orgB.id);
        assert.strictEqual(resB.createdRootIncident, true);

        const listA = await Incident.getIncidents(orgA.id);
        const listB = await Incident.getIncidents(orgB.id);

        assert.strictEqual(listA.length, 1);
        assert.strictEqual(listB.length, 1);
    });

    it("should handle root device recovery and auto-resolve root incident", async () => {
        const recRes = await DependencyCorrelation.processDeviceRecovery(coreRouterA.id, orgA.id);
        assert.strictEqual(recRes.resolvedRootIncident, true);
        assert.strictEqual(recRes.incident.status, "RESOLVED");

        const activeList = await Incident.getIncidents(orgA.id, { status: "OPEN" });
        assert.strictEqual(activeList.length, 0);
    });

    it("should support dependency deletion and stop correlation between unlinked devices", async () => {
        const deps = await DependencyCorrelation.getDeviceDependencies(aggSwitchA.id, orgA.id);
        const linkId = deps.parents[0].id;

        await DependencyCorrelation.deleteDependency(linkId, orgA.id);

        const updatedDeps = await DependencyCorrelation.getDeviceDependencies(aggSwitchA.id, orgA.id);
        assert.strictEqual(updatedDeps.parents.length, 0);
    });

    it("should enforce tenant isolation so Org A cannot query or alter Org B dependencies", async () => {
        await assert.rejects(
            async () => {
                await DependencyCorrelation.addDependency(coreRouterA.id, routerB.id, "UPSTREAM", orgA.id);
            },
            { message: "Parent or child device not found in organization." }
        );
    });
});
