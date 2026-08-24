const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC MikroTik RouterOS SNMP Monitoring Test Suite", () => {
    let Organization;
    let Device;
    let SnmpProfileRegistry;
    let MetricsStore;
    let VendorCapabilityRegistry;
    let orgA;
    let orgB;
    let mikrotikDevA;
    let mikrotikDevB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-mikrotik.db");
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
        SnmpProfileRegistry = require("../../server/model/snmp-profile-registry.js");
        MetricsStore = require("../../server/model/metrics-store.js");
        VendorCapabilityRegistry = require("../../server/model/vendor-capability-registry.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('mt_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'mt_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('mt_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'mt_user_b'");

        orgA = await Organization.createOrganization("Org MikroTik Alpha", "org-mt-alpha", userAId);
        orgB = await Organization.createOrganization("Org MikroTik Beta", "org-mt-beta", userBId);

        mikrotikDevA = await Device.createDevice(
            { name: "CCR2004-16G-2S+", hostname: "ccr2004.net", ip_address: "10.10.0.1", device_type: "Router", snmp_version: "2c" },
            orgA.id
        );

        mikrotikDevB = await Device.createDevice(
            { name: "RB5009UG+S+IN", hostname: "rb5009.net", ip_address: "10.20.0.1", device_type: "Router", snmp_version: "2c" },
            orgB.id
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should verify MikroTik profile registration in SnmpProfileRegistry", async () => {
        const profile = SnmpProfileRegistry.getProfile("mikrotik");
        assert.ok(profile);
        assert.strictEqual(profile.vendor, "MikroTik");
        assert.strictEqual(profile.oids.cpuLoad, "1.3.6.1.4.1.14988.1.1.1.3.1.1");
        assert.strictEqual(profile.oids.hwTemperature, "1.3.6.1.4.1.14988.1.1.1.3.10.0");
        assert.strictEqual(profile.oids.pppoeActiveUsers, "1.3.6.1.4.1.14988.1.1.1.6.0");
    });

    it("should parse realistic MikroTik RouterOS SNMP varbind response data correctly", async () => {
        const profile = SnmpProfileRegistry.getProfile("mikrotik");

        // Realistic SNMP Varbind responses from a MikroTik CCR2004 Router
        const realisticVarbinds = [
            { oid: "1.3.6.1.2.1.1.3.0", value: 1234567 }, // sysUpTime
            { oid: "1.3.6.1.4.1.14988.1.1.1.3.1.1", value: 18 }, // mtxrCpuLoad = 18%
            { oid: "1.3.6.1.4.1.14988.1.1.1.3.10.0", value: 44 }, // mtxrHwTemperature = 44°C
            { oid: "1.3.6.1.4.1.14988.1.1.1.6.0", value: 342 }, // mtxrPppoeActiveUserCount = 342
            { oid: "1.3.6.1.2.1.25.2.3.1.5.1", value: 4194304 }, // hrStorageSize
            { oid: "1.3.6.1.2.1.25.2.3.1.6.1", value: 1468006 }, // hrStorageUsed (~35% RAM)
        ];

        const metrics = profile.parseMetrics(realisticVarbinds);

        assert.strictEqual(metrics.vendor, "MikroTik");
        assert.strictEqual(metrics.cpu, 18);
        assert.strictEqual(metrics.temperature, 44);
        assert.strictEqual(metrics.pppoeSessions, 342);
        assert.strictEqual(metrics.uptime, 1234567);
        assert.strictEqual(metrics.mikrotikSpecific.pppoeActiveUsers, 342);
    });

    it("should ingest high-frequency telemetry samples into MetricsStore for MikroTik Device A", async () => {
        const sampleData = {
            cpu: 22,
            memory: 39,
            temperature: 45,
            uptime: 1235000,
            pppoeSessions: 350,
            interfaces: [
                { name: "sfp-sfpplus1", status: "UP", inOctets: 150000000, outOctets: 85000000 },
            ],
        };

        const success = await MetricsStore.ingestMetricSample(mikrotikDevA.id, sampleData, orgA.id);
        assert.strictEqual(success, true);

        const latest = await MetricsStore.getLatestDeviceMetrics(mikrotikDevA.id, orgA.id);
        assert.strictEqual(latest.cpu[0].value, 22);
        assert.strictEqual(latest.memory[0].value, 39);
        assert.strictEqual(latest.temperature[0].value, 45);
    });

    it("should return correct vendor capability matrix for MikroTik with SNMP active & RouterOS API planned", async () => {
        const caps = VendorCapabilityRegistry.getVendorCapabilities("MikroTik");
        assert.strictEqual(caps.vendor, "MikroTik");

        const snmpDriver = caps.supportedTransports.find((t) => t.transport === "SNMP_V2C");
        assert.strictEqual(snmpDriver.status, "ACTIVE");

        const apiDriver = caps.supportedTransports.find((t) => t.transport === "ROUTEROS_API");
        assert.strictEqual(apiDriver.status, "PLANNED");

        assert.strictEqual(caps.metrics.pppoe_sessions.oid, "1.3.6.1.4.1.14988.1.1.1.6.0");
    });

    it("should enforce tenant isolation so Org A cannot query Org B MikroTik telemetry", async () => {
        await assert.rejects(
            async () => {
                await MetricsStore.getLatestDeviceMetrics(mikrotikDevB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });
});
