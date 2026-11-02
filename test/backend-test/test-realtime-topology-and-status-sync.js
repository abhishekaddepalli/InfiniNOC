const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");
const { toSqlDatetime } = require("../../server/util-server");

describe("InfiniNOC Real-Time Topology, Status Synchronization & Fiber Cut Engine", () => {
    let Organization;
    let Device;
    let DependencyCorrelation;
    let Probe;
    let FiberFaultEngine;
    let FiberInfrastructure;

    let orgId;
    let devCoreId, devAggId, devOltId, devEdgeId;
    let monCoreId, monAggId, monOltId, monEdgeId;
    let probeId;
    let testDbPath;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        testDbPath = path.join(testDbDir, "test-realtime-topology.db");
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

        // Run all migrations up to latest
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        Organization = require("../../server/model/organization.js");
        Device = require("../../server/model/device.js");
        Probe = require("../../server/model/probe.js");
        DependencyCorrelation = require("../../server/model/dependency-correlation.js");
        FiberFaultEngine = require("../../server/model/fiber-fault-engine.js");
        FiberInfrastructure = require("../../server/model/fiber-infrastructure.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('noc_operator', 'pass123', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'noc_operator'");

        const org = await Organization.createOrganization("InfiniNOC Production Metro", "infininoc-metro", userAId);
        orgId = org.id;
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
        if (testDbPath && fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch {}
        }
    });

    it("should create 4 test monitors (3 healthy UP, 1 failed DOWN) and auto-bridge them to devices", async () => {
        const isoNow = toSqlDatetime();

        // Create 4 monitors
        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, active, user_id, organization_id) VALUES (?, 'ping', ?, 0, 1, 1, ?)",
            ["Core-Router-WAN", "192.168.1.1", orgId]
        );
        monCoreId = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, active, user_id, organization_id) VALUES (?, 'ping', ?, 0, 1, 1, ?)",
            ["Agg-Switch-DC", "192.168.1.2", orgId]
        );
        monAggId = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, active, user_id, organization_id) VALUES (?, 'ping', ?, 0, 1, 1, ?)",
            ["GPON-OLT-Central", "192.168.1.10", orgId]
        );
        monOltId = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, active, user_id, organization_id) VALUES (?, 'ping', ?, 0, 1, 1, ?)",
            ["Edge-Tower-BTS", "192.168.1.50", orgId]
        );
        monEdgeId = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        // Insert heartbeats: 3 UP (status=1), 1 DOWN (status=0)
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 1, 2.5, ?, 'OK')", [monCoreId, isoNow]);
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 1, 3.1, ?, 'OK')", [monAggId, isoNow]);
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 1, 4.8, ?, 'OK')", [monOltId, isoNow]);
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 0, 0, ?, 'Timeout / Host Down')", [monEdgeId, isoNow]);

        // Device.getDeviceList should auto-bridge these 4 monitors into first-class devices
        const deviceList = await Device.getDeviceList(orgId);
        assert.strictEqual(deviceList.length, 4, "Should have 4 devices auto-bridged");

        // Verify status resolution on the 4 devices
        const coreDev = deviceList.find((d) => d.name === "Core-Router-WAN");
        const aggDev = deviceList.find((d) => d.name === "Agg-Switch-DC");
        const oltDev = deviceList.find((d) => d.name === "GPON-OLT-Central");
        const edgeDev = deviceList.find((d) => d.name === "Edge-Tower-BTS");

        assert.ok(coreDev, "Core device exists");
        assert.ok(aggDev, "Agg device exists");
        assert.ok(oltDev, "OLT device exists");
        assert.ok(edgeDev, "Edge device exists");

        devCoreId = coreDev.id;
        devAggId = aggDev.id;
        devOltId = oltDev.id;
        devEdgeId = edgeDev.id;

        // Verify Authoritative Status
        assert.strictEqual(coreDev.status, "UP", "Core device status must be normalized UP");
        assert.strictEqual(aggDev.status, "UP", "Agg device status must be normalized UP");
        assert.strictEqual(oltDev.status, "UP", "OLT device status must be normalized UP");
        assert.strictEqual(edgeDev.status, "DOWN", "Edge device status must be normalized DOWN");

        // Verify real ping values are attached
        assert.strictEqual(coreDev.ping, "3ms", "Core ping should be rounded 3ms");
        assert.strictEqual(aggDev.ping, "3ms", "Agg ping should be rounded 3ms");
        assert.strictEqual(oltDev.ping, "5ms", "OLT ping should be rounded 5ms");

        // Verify monitors list is attached to device
        assert.ok(Array.isArray(coreDev.monitors), "Monitors array attached");
        assert.strictEqual(coreDev.monitors.length, 1, "Linked 1 monitor");
        assert.strictEqual(coreDev.monitor_id, monCoreId, "Primary monitor ID attached");
    });

    it("should calculate exact mathematical counts: Online: 3, Down: 1, Total: 4", async () => {
        const deviceList = await Device.getDeviceList(orgId);

        const onlineCount = deviceList.filter((d) => d.status === "UP" || d.status === "ONLINE").length;
        const downCount = deviceList.filter((d) => d.status === "DOWN" || d.status === "OFFLINE").length;
        const warningCount = deviceList.filter((d) => d.status === "WARNING" || d.status === "PENDING").length;
        const maintCount = deviceList.filter((d) => d.status === "MAINTENANCE" || d.status === "PAUSED").length;
        const unknownCount = deviceList.filter((d) => !["UP", "ONLINE", "DOWN", "OFFLINE", "WARNING", "PENDING", "MAINTENANCE", "PAUSED"].includes(d.status)).length;
        const total = deviceList.length;

        // Critical acceptance criteria verification:
        assert.strictEqual(onlineCount, 3, "Online count MUST be exactly 3");
        assert.strictEqual(downCount, 1, "Down count MUST be exactly 1");
        assert.strictEqual(warningCount, 0, "Warning count is 0");
        assert.strictEqual(maintCount, 0, "Maintenance count is 0");
        assert.strictEqual(unknownCount, 0, "Unknown count is 0");
        assert.strictEqual(total, 4, "Total count is 4");

        // Identity check: Total = Online + Down + Warning + Maintenance + Unknown
        assert.strictEqual(total, onlineCount + downCount + warningCount + maintCount + unknownCount, "Total must equal sum of all partition counts");
    });

    it("should support multi-monitor device health aggregation policy", async () => {
        const isoNow = toSqlDatetime();

        // Attach a second monitor to devCoreId (e.g. an HTTP API service monitor)
        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, url, active, user_id, organization_id) VALUES (?, 'http', ?, 443, ?, 1, 1, ?)",
            ["Core-BGP-API", "192.168.1.1", "https://192.168.1.1/api", orgId]
        );
        const monCore2Id = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        await R.exec("INSERT INTO device_monitor (device_id, monitor_id, created_at) VALUES (?, ?, ?)", [devCoreId, monCore2Id, isoNow]);

        // Scenario 1: Both monitors are UP -> Device status is UP
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 1, 5.0, ?, 'HTTP 200')", [monCore2Id, isoNow]);
        let devs = await Device.getDeviceList(orgId);
        let core = devs.find((d) => d.id === devCoreId);
        assert.strictEqual(core.status, "UP", "Both monitors UP -> Device is UP");
        assert.strictEqual(core.monitors.length, 2, "Device has 2 monitors attached");

        // Scenario 2: One monitor goes DOWN -> Multi-monitor aggregation marks Device DOWN!
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 0, 0, ?, 'HTTP 503 Service Unavailable')", [monCore2Id, isoNow]);
        devs = await Device.getDeviceList(orgId);
        core = devs.find((d) => d.id === devCoreId);
        assert.strictEqual(core.status, "DOWN", "One monitor DOWN -> Device health aggregation policy marks Device DOWN");

        // Scenario 3: Mon2 is PENDING / Degraded while Mon1 is UP -> Device status is WARNING
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 2, 85.0, ?, 'High Latency / Pending retry')", [monCore2Id, isoNow]);
        devs = await Device.getDeviceList(orgId);
        core = devs.find((d) => d.id === devCoreId);
        assert.strictEqual(core.status, "WARNING", "One monitor PENDING -> Device is WARNING");

        // Restore Mon2 to UP
        await R.exec("INSERT INTO heartbeat (monitor_id, status, ping, time, msg) VALUES (?, 1, 3.2, ?, 'Recovered HTTP 200')", [monCore2Id, isoNow]);
        devs = await Device.getDeviceList(orgId);
        core = devs.find((d) => d.id === devCoreId);
        assert.strictEqual(core.status, "UP", "Mon2 recovered -> Device is UP");
    });

    it("should enforce: probe failure is not target failure (offline probe marks target UNKNOWN, not DOWN)", async () => {
        const isoNow = toSqlDatetime();

        // Register a test remote probe
        const tokenRes = await Probe.createProbeRegistrationToken({ name: "Remote-Site-Probe" }, orgId);
        const regRes = await Probe.registerProbe(tokenRes.probe.id, tokenRes.registrationToken, "10.200.0.5", "1.26.31");
        probeId = regRes.probeId;

        // Assign a dedicated monitor to this probe
        await R.exec(
            "INSERT INTO monitor (name, type, hostname, port, probe_id, active, user_id, organization_id) VALUES (?, 'ping', ?, 0, ?, 1, 1, ?)",
            ["Isolated-Remote-Host", "10.200.1.99", probeId, orgId]
        );
        const remoteMonId = await R.getCell("SELECT MAX(id) FROM monitor WHERE organization_id = ?", [orgId]);

        // Device auto-bridge
        await R.exec(
            "INSERT INTO device (organization_id, name, hostname, ip_address, device_type, status, tags, created_at, updated_at) VALUES (?, 'Isolated-Remote-Host', '10.200.1.99', '10.200.1.99', 'Server', 'online', '[]', ?, ?)",
            [orgId, isoNow, isoNow]
        );
        const remoteDevId = await R.getCell("SELECT MAX(id) FROM device WHERE organization_id = ?", [orgId]);
        await R.exec("INSERT INTO device_monitor (device_id, monitor_id, created_at) VALUES (?, ?, ?)", [remoteDevId, remoteMonId, isoNow]);

        // Probe submits successful heartbeat
        await Probe.recordHeartbeat(probeId, regRes.apiKey, { cpu_usage: 12, memory_usage: 34, latency_ms: 15 });
        await Probe.submitTaskResult(probeId, regRes.apiKey, { monitor_id: remoteMonId, status: 1, ping: 15, msg: "Remote ping OK" });

        let devs = await Device.getDeviceList(orgId);
        let remDev = devs.find((d) => d.id === remoteDevId);
        assert.strictEqual(remDev.status, "UP", "Target is UP while probe is online");

        // Now probe goes offline (e.g. power lost at remote probe site)
        await R.exec("UPDATE probe SET status = 'offline' WHERE id = ?", [probeId]);

        devs = await Device.getDeviceList(orgId);
        remDev = devs.find((d) => d.id === remoteDevId);

        // Core Requirement: Probe failure is NOT target failure!
        assert.strictEqual(remDev.status, "UNKNOWN", "When probe is offline, target becomes UNKNOWN (monitoring-unavailable), NOT falsely marked DOWN!");
    });

    it("should verify intelligent fiber cut detection distinguishes real physical cut from power loss and degradation", async () => {
        // Setup OLT, PON port, and ONUs for testing
        await R.exec(`
            INSERT INTO olt_device (organization_id, device_id, vendor_adapter_id, model, total_pon_ports, online_onu_count, offline_onu_count, los_count)
            VALUES (?, ?, 'huawei', 'MA5800-X7', 8, 0, 0, 0)
        `, [orgId, devOltId]);
        const oltId = await R.getCell("SELECT MAX(id) FROM olt_device WHERE organization_id = ?", [orgId]);

        await R.exec(`
            INSERT INTO pon_port (organization_id, olt_device_id, port_identifier, oper_status, admin_status)
            VALUES (?, ?, '0/1/1', 'UP', 'UP')
        `, [orgId, oltId]);

        // Scenario A: 4 ONUs all report LOS simultaneously while OLT is healthy -> PROBABLE / CONFIRMED Fiber Cut!
        for (let i = 1; i <= 4; i++) {
            await R.exec(`
                INSERT INTO onu_inventory (organization_id, olt_device_id, pon_port, serial_number, online_status, rx_power_dbm)
                VALUES (?, ?, '0/1/1', ?, 'LOS', -35.0)
            `, [orgId, oltId, `HWTC-TEST-00${i}`]);
        }

        let faults = await FiberFaultEngine.analyzeAndCorrelateFaults(orgId);
        assert.ok(faults.length >= 1, "Fiber fault engine detected fault");
        const cutFault = faults.find((f) => f.fault_category === "SUSPECTED_FIBER_CUT");
        assert.ok(cutFault, "Multi-ONU LOS correlated as SUSPECTED_FIBER_CUT");
        assert.strictEqual(cutFault.affected_onus_count, 4, "Correctly counted 4 affected ONUs");

        // Scenario B: ONUs recover from LOS, but 1 ONU sends Dying Gasp -> Customer Premise Power Loss (NOT fiber cut!)
        await R.exec("DELETE FROM onu_inventory WHERE organization_id = ?", [orgId]);
        await R.exec(`
            INSERT INTO onu_inventory (organization_id, olt_device_id, pon_port, serial_number, online_status, last_dereg_reason, rx_power_dbm)
            VALUES (?, ?, '0/1/1', 'HWTC-DYING-GASP', 'OFFLINE', 'Dying Gasp - AC Power Interrupted', null)
        `, [orgId, oltId]);

        faults = await FiberFaultEngine.analyzeAndCorrelateFaults(orgId);
        const powerFault = faults.find((f) => f.fault_category === "ONU_POWER_FAILURE");
        assert.ok(powerFault, "Dying gasp correctly classified as ONU_POWER_FAILURE, NOT fiber cut!");
        assert.strictEqual(powerFault.severity, "MINOR", "Power failure is classified as MINOR severity");

        // Scenario C: High optical attenuation (< -27 dBm) while online -> High Attenuation Warning
        await R.exec("DELETE FROM onu_inventory WHERE organization_id = ?", [orgId]);
        await R.exec(`
            INSERT INTO onu_inventory (organization_id, olt_device_id, pon_port, serial_number, online_status, rx_power_dbm)
            VALUES (?, ?, '0/1/1', 'HWTC-DEG-01', 'ONLINE', -28.5)
        `, [orgId, oltId]);
        await R.exec(`
            INSERT INTO onu_inventory (organization_id, olt_device_id, pon_port, serial_number, online_status, rx_power_dbm)
            VALUES (?, ?, '0/1/1', 'HWTC-DEG-02', 'ONLINE', -29.2)
        `, [orgId, oltId]);

        faults = await FiberFaultEngine.analyzeAndCorrelateFaults(orgId);
        const attFault = faults.find((f) => f.fault_category === "HIGH_ATTENUATION");
        assert.ok(attFault, "Marginal optical power correctly classified as HIGH_ATTENUATION");
        assert.strictEqual(attFault.severity, "WARNING", "Attenuation is classified as WARNING");
    });

    it("should establish parent-child dependency links and calculate down links and affected downstream nodes", async () => {
        // Build hierarchy: Core Router -> Agg Switch -> GPON OLT -> Edge BTS
        await DependencyCorrelation.addDependency(devCoreId, devAggId, "UPSTREAM", orgId);
        await DependencyCorrelation.addDependency(devAggId, devOltId, "UPSTREAM", orgId);
        await DependencyCorrelation.addDependency(devOltId, devEdgeId, "UPSTREAM", orgId);

        const links = await DependencyCorrelation.getAllDependencies(orgId);
        assert.strictEqual(links.length, 3, "Created 3 dependency links");

        // Edge BTS is DOWN -> Link from OLT to Edge is DOWN
        const deviceList = await Device.getDeviceList(orgId);
        const downLinksCount = links.filter((l) => {
            const p = deviceList.find((d) => d.id === l.parent_device_id);
            const c = deviceList.find((d) => d.id === l.child_device_id);
            return (p && p.status === "DOWN") || (c && c.status === "DOWN") || l.status === "down";
        }).length;

        assert.strictEqual(downLinksCount, 1, "Downlink count is exactly 1 (OLT -> Edge BTS)");
    });
});
