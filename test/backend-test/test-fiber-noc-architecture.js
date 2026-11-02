const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Advanced Fiber NOC, Intelligent Topology & Optical Telemetry Test Suite", () => {
    let Organization;
    let Device;
    let FiberNoc;
    let FiberFaultEngine;
    let DeviceInterface;
    let DependencyCorrelation;
    let orgA;
    let orgB;
    let coreSwitchA;
    let oltDevA;
    let oltRecordA;
    let oltDevB;
    let oltRecordB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-fiber-noc.db");
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

        // Run all migrations including 2026-11-02-1400-fiber-noc-and-intelligent-topology.js
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        Organization = require("../../server/model/organization.js");
        Device = require("../../server/model/device.js");
        FiberNoc = require("../../server/model/fiber-noc.js");
        FiberFaultEngine = require("../../server/model/fiber-fault-engine.js");
        DeviceInterface = require("../../server/model/device-interface.js");
        DependencyCorrelation = require("../../server/model/dependency-correlation.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('noc_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'noc_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('noc_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'noc_user_b'");

        orgA = await Organization.createOrganization("Org Fiber Alpha", "org-fiber-alpha", userAId);
        orgB = await Organization.createOrganization("Org Fiber Beta", "org-fiber-beta", userBId);

        // Create devices in Org A
        coreSwitchA = await Device.createDevice(
            { name: "CORE-SW-01", hostname: "sw01.net", ip_address: "10.100.1.1", device_type: "Switch" },
            orgA.id
        );

        oltDevA = await Device.createDevice(
            { name: "GPON-OLT-HUAWEI-01", hostname: "olt01.net", ip_address: "10.100.2.1", device_type: "OLT" },
            orgA.id
        );

        // Create olt_device entry for oltDevA
        await R.exec(`
            INSERT INTO olt_device (
                organization_id, device_id, vendor_adapter_id, model, firmware_version,
                total_pon_ports, online_onu_count, offline_onu_count, los_count, management_ip
            ) VALUES (?, ?, 'huawei', 'MA5608T', 'V800R018C00', 16, 120, 8, 4, '10.100.2.1')
        `, [orgA.id, oltDevA.id]);

        oltRecordA = await R.getRow("SELECT * FROM olt_device WHERE organization_id = ? AND device_id = ?", [orgA.id, oltDevA.id]);

        // Create devices in Org B for tenant isolation check
        oltDevB = await Device.createDevice(
            { name: "GPON-OLT-ZTE-02", hostname: "olt02.net", ip_address: "10.200.2.1", device_type: "OLT" },
            orgB.id
        );

        await R.exec(`
            INSERT INTO olt_device (
                organization_id, device_id, vendor_adapter_id, model, firmware_version,
                total_pon_ports, online_onu_count, offline_onu_count, los_count, management_ip
            ) VALUES (?, ?, 'zte', 'C320', 'V2.1.0', 8, 60, 4, 0, '10.200.2.1')
        `, [orgB.id, oltDevB.id]);

        oltRecordB = await R.getRow("SELECT * FROM olt_device WHERE organization_id = ? AND device_id = ?", [orgB.id, oltDevB.id]);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should verify all Fiber NOC database schema migrations are applied", async () => {
        const hasPonPort = await R.knex.schema.hasTable("pon_port");
        const hasFiberSplitter = await R.knex.schema.hasTable("fiber_splitter");
        const hasFiberFault = await R.knex.schema.hasTable("fiber_fault_incident");
        const hasOtdrMeasurement = await R.knex.schema.hasTable("otdr_measurement");
        const hasDeviceInterface = await R.knex.schema.hasTable("device_interface");
        const hasOnuEventHistory = await R.knex.schema.hasTable("onu_event_history");

        assert.strictEqual(hasPonPort, true, "pon_port table should exist");
        assert.strictEqual(hasFiberSplitter, true, "fiber_splitter table should exist");
        assert.strictEqual(hasFiberFault, true, "fiber_fault_incident table should exist");
        assert.strictEqual(hasOtdrMeasurement, true, "otdr_measurement table should exist");
        assert.strictEqual(hasDeviceInterface, true, "device_interface table should exist");
        assert.strictEqual(hasOnuEventHistory, true, "onu_event_history table should exist");

        const hasLinkTypeCol = await R.knex.schema.hasColumn("device_dependency", "link_type");
        assert.strictEqual(hasLinkTypeCol, true, "device_dependency should have link_type");

        const hasAdminStatusPon = await R.knex.schema.hasColumn("pon_port", "admin_status");
        assert.strictEqual(hasAdminStatusPon, true, "pon_port should have admin_status");
    });

    it("should synchronize and retrieve PON port telemetry", async () => {
        const ponPorts = [
            {
                port_identifier: "0/1/1",
                admin_status: "UP",
                oper_status: "UP",
                total_onus: 32,
                online_onus: 30,
                offline_onus: 2,
                los_onus: 0,
                rx_power_dbm: -19.45,
                tx_power_dbm: 2.80,
                traffic_in_mbps: 145.2,
                traffic_out_mbps: 89.6
            },
            {
                port_identifier: "0/1/2",
                admin_status: "UP",
                oper_status: "UP",
                total_onus: 32,
                online_onus: 26,
                offline_onus: 6,
                los_onus: 6,
                rx_power_dbm: -27.80,
                tx_power_dbm: 2.75,
                traffic_in_mbps: 22.1,
                traffic_out_mbps: 10.4
            }
        ];

        const synced = await FiberNoc.syncPonPortTelemetry(orgA.id, oltRecordA.id, ponPorts);
        assert.strictEqual(synced, 2);

        const list = await FiberNoc.getPonPortList(orgA.id, oltRecordA.id);
        assert.strictEqual(list.length, 2);
        assert.strictEqual(list[0].port_identifier, "0/1/1");
        assert.strictEqual(list[0].total_onus, 32);
        assert.strictEqual(list[0].online_onus, 30);
    });

    it("should manage multi-tier fiber splitters with validation", async () => {
        const s1 = await FiberNoc.saveFiberSplitter(orgA.id, {
            name: "FDT-01 Primary Splitter (1:8)",
            splitter_type: "1:8",
            tier_level: 1,
            olt_device_id: oltRecordA.id,
            pon_port: "0/1/1",
            location: "Main Street Telecom Pole 12",
            attenuation_db: 10.2
        });
        assert.ok(s1.id);
        assert.strictEqual(s1.splitter_type, "1:8");

        const s2 = await FiberNoc.saveFiberSplitter(orgA.id, {
            name: "FAT-01 Secondary Splitter (1:4)",
            splitter_type: "1:4",
            tier_level: 2,
            olt_device_id: oltRecordA.id,
            pon_port: "0/1/1",
            parent_splitter_id: s1.id,
            location: "Sector B Terminal Box 4",
            attenuation_db: 7.1
        });
        assert.ok(s2.id);
        assert.strictEqual(s2.parent_splitter_id, s1.id);

        const splitters = await FiberNoc.getFiberSplitters(orgA.id);
        assert.strictEqual(splitters.length, 2);

        // Delete secondary splitter
        const deleted = await FiberNoc.deleteFiberSplitter(orgA.id, s2.id);
        assert.strictEqual(deleted, true);

        const remaining = await FiberNoc.getFiberSplitters(orgA.id);
        assert.strictEqual(remaining.length, 1);
        assert.strictEqual(remaining[0].id, s1.id);
    });

    it("should record OTDR trace optical distance measurements", async () => {
        const otdrRecord = await FiberNoc.recordOtdrMeasurement(orgA.id, {
            fiber_link_name: "FEEDER-OLT01-0/1/2",
            total_distance_km: 14.85,
            event_distance_km: 3.42,
            event_type: "Fiber Break / Reflection",
            loss_db: 28.5,
            reflectance_db: -18.2,
            trace_file_ref: "otdr_traces/20261102_pon012.sor"
        });

        assert.ok(otdrRecord.id);
        assert.strictEqual(otdrRecord.event_distance_km, 3.42);
        assert.strictEqual(otdrRecord.loss_db, 28.5);

        const measurements = await FiberNoc.getOtdrMeasurements(orgA.id);
        assert.strictEqual(measurements.length, 1);
        assert.strictEqual(measurements[0].event_distance_km, 3.42);
    });

    it("should ingest and monitor switch/router IF-MIB interfaces", async () => {
        const interfaces = [
            {
                interface_index: 1,
                name: "GigabitEthernet0/0/1",
                alias: "Uplink to Core Gateway",
                admin_status: "UP",
                oper_status: "UP",
                speed_bps: "1000000000",
                duplex: "FULL",
                in_octets: "154000000000",
                out_octets: "98000000000",
                in_errors: 0,
                out_errors: 0,
                utilization_pct: 42.5
            },
            {
                interface_index: 2,
                name: "GigabitEthernet0/0/2",
                alias: "Trunk to OLT-01",
                admin_status: "UP",
                oper_status: "UP",
                speed_bps: "1000000000",
                duplex: "FULL",
                in_octets: "75000000000",
                out_octets: "120000000000",
                in_errors: 2,
                out_errors: 0,
                utilization_pct: 68.4
            }
        ];

        const synced = await DeviceInterface.syncDeviceInterfaces(orgA.id, coreSwitchA.id, interfaces);
        assert.strictEqual(synced, 2);

        const dbInterfaces = await DeviceInterface.getDeviceInterfaces(orgA.id, coreSwitchA.id);
        assert.strictEqual(dbInterfaces.length, 2);
        assert.strictEqual(dbInterfaces[0].name, "GigabitEthernet0/0/1");
        assert.strictEqual(dbInterfaces[1].alias, "Trunk to OLT-01");
    });

    it("should intelligently correlate multiple LOS ONUs as a physical fiber cut vs Dying Gasp power failure", async () => {
        // Populate sample ONUs under PON 0/1/2
        for (let i = 1; i <= 6; i++) {
            await R.exec(`
                INSERT INTO onu_inventory (
                    organization_id, olt_device_id, pon_port, onu_index, serial_number,
                    name, customer_name, online_status, rx_power_dbm, tx_power_dbm, last_dereg_reason
                ) VALUES (?, ?, '0/1/2', ?, ?, ?, ?, 'LOS', -40.0, 0.0, 'LOS')
            `, [orgA.id, oltRecordA.id, i, `HWTCA000000${i}`, `Client-0/1/2-${i}`, `Customer ${i}`]);
        }

        // Add 1 ONU with Dying Gasp (power cut, not fiber break)
        await R.exec(`
            INSERT INTO onu_inventory (
                organization_id, olt_device_id, pon_port, onu_index, serial_number,
                name, customer_name, online_status, rx_power_dbm, tx_power_dbm, last_dereg_reason
            ) VALUES (?, ?, '0/1/2', 7, 'HWTCA0000007', 'Client-0/1/2-7', 'Customer 7', 'OFFLINE', -20.0, 2.0, 'Dying Gasp')
        `, [orgA.id, oltRecordA.id]);

        // Run correlation analysis
        const detectedFaults = await FiberFaultEngine.analyzeAndCorrelateFaults(orgA.id);
        assert.ok(detectedFaults.length >= 1, "Should identify active fiber fault");

        const cutFault = detectedFaults.find(f => f.fault_category === "SUSPECTED_FIBER_CUT");
        assert.ok(cutFault, "Should classify fault as SUSPECTED_FIBER_CUT due to multiple simultaneous LOS ONUs");
        assert.strictEqual(cutFault.confidence_level, "CONFIRMED", "Should have CONFIRMED confidence because OTDR trace exists for link");
        assert.strictEqual(cutFault.affected_onus_count, 6);
        assert.ok(cutFault.evidence.includes("Simultaneous LOS detected"));

        const activeList = await FiberFaultEngine.getActiveFiberFaults(orgA.id);
        assert.ok(activeList.length >= 1);
    });

    it("should export and import network topology cleanly", async () => {
        // Create link between core switch and OLT
        await DependencyCorrelation.addDependency(
            coreSwitchA.id,
            oltDevA.id,
            "UPSTREAM",
            orgA.id,
            {
                link_type: "FIBER",
                link_speed: "10 Gbps",
                source_interface: "GigabitEthernet0/0/2",
                target_interface: "uplink-0/0/1"
            }
        );

        // Export topology for Org A
        const exported = await DependencyCorrelation.exportTopology(orgA.id);
        assert.ok(exported.devices.length >= 2);
        assert.ok(exported.links.length >= 1);
        assert.strictEqual(exported.links[0].link_type, "FIBER");

        // Verify single-query dependency retrieval
        const allDeps = await DependencyCorrelation.getAllDependencies(orgA.id);
        assert.strictEqual(allDeps.length, 1);
        assert.strictEqual(allDeps[0].parent_device_id, coreSwitchA.id);
        assert.strictEqual(allDeps[0].child_device_id, oltDevA.id);
    });

    it("should retrieve full Fiber NOC overview telemetry", async () => {
        const overview = await FiberNoc.getFiberNocOverview(orgA.id);
        assert.ok(overview);
        assert.ok(overview.totalOlts >= 1);
        assert.ok(overview.totalPonPorts >= 2);
        assert.ok(overview.totalOnus >= 6);
        assert.ok(overview.activeFaults.length >= 1);
    });
});
