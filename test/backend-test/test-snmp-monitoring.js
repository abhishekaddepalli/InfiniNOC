const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Real SNMP Monitoring Architecture Test Suite", () => {
    let Organization;
    let Device;
    let SnmpMonitoring;
    let metricsStore;
    let SnmpProbeEngine;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let deviceA;
    let deviceB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-snmp.db");
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
        SnmpMonitoring = require("../../server/model/snmp-monitoring.js");
        metricsStore = require("../../server/model/metrics-store.js");
        SnmpProbeEngine = require("../../probe/snmp-engine.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('snmp_user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'snmp_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('snmp_user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'snmp_user_b'");

        orgA = await Organization.createOrganization("Org SNMP Alpha", "org-snmp-alpha", userAId);
        orgB = await Organization.createOrganization("Org SNMP Beta", "org-snmp-beta", userBId);

        deviceA = await Device.createDevice(
            { name: "Vijayawada Edge Router", device_type: "Router", ip_address: "127.0.0.1", vendor: "Cisco" },
            orgA.id
        );

        deviceB = await Device.createDevice(
            { name: "Kakinada OLT Master", device_type: "OLT", ip_address: "10.255.255.254", vendor: "Huawei" },
            orgB.id
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should configure SNMP settings for Device A in Org A with AES encrypted credential reference", async () => {
        // Add encrypted credential to Device A
        const credDevice = await Device.addCredential(
            deviceA.id,
            { name: "Org A SNMP Community", type: "snmp_v2c", secretPayload: { community: "super_secret_comm_a" } },
            orgA.id
        );
        const credId = credDevice.credentials[0].id;

        const config = await SnmpMonitoring.saveSnmpConfig(
            deviceA.id,
            { snmp_version: "v2c", credential_id: credId, port: 161, timeout: 3000, poll_interval: 15 },
            orgA.id
        );

        assert.strictEqual(config.device_id, deviceA.id);
        assert.strictEqual(config.snmp_version, "v2c");
        assert.strictEqual(config.credential_id, credId);
        assert.strictEqual(config.hasCredential, true);
    });

    it("should enforce credential security and NEVER reveal raw community strings in API responses", async () => {
        const config = await SnmpMonitoring.getSnmpConfig(deviceA.id, orgA.id);
        assert.strictEqual(config.community, undefined);
        assert.strictEqual(config.secret, undefined);
        assert.strictEqual(config.password, undefined);
    });

    it("should simulate probe polling against local host and return metric structure", async () => {
        const pollResult = await SnmpProbeEngine.pollDevice(
            { ip_address: "127.0.0.1" },
            { port: 161, timeout: 1000 },
            {}
        );
        assert.ok(pollResult.status);
        assert.ok(pollResult.timestamp);
    });

    it("should handle unreachable devices and poll timeouts gracefully", async () => {
        const timeoutResult = await SnmpProbeEngine.pollDevice(
            { ip_address: "192.0.2.1" }, // Non-routable TEST-NET-1 IP
            { port: 161, timeout: 50 },
            {}
        );
        assert.strictEqual(timeoutResult.status, "offline");
        assert.ok(timeoutResult.error.includes("Timed Out"));
    });

    it("should ingest high-frequency metric samples into MetricsStore without polluting primary DB", async () => {
        const samplePayload = {
            uptime: 124500,
            cpu: 35.8,
            memory: 62.1,
            temperature: 41.5,
            timestamp: new Date().toISOString(),
            interfaces: [
                { index: 1, name: "eth0", status: "up", inBps: 10500000, outBps: 2400000, errors: 0, packets: 85400 },
            ],
        };

        const ingestResult = await SnmpMonitoring.ingestMetrics(deviceA.id, samplePayload, orgA.id);
        assert.ok(ingestResult.ok);

        const metrics = await SnmpMonitoring.getDeviceMetrics(deviceA.id, orgA.id);
        assert.strictEqual(metrics.uptime, 124500);
        assert.strictEqual(metrics.cpu[0].value, 35.8);
        assert.strictEqual(metrics.memory[0].value, 62.1);
        assert.strictEqual(metrics.interfaces.eth0.status, "up");
    });

    it("should enforce tenant isolation so Org A cannot query or ingest SNMP data for Org B devices", async () => {
        await assert.rejects(
            async () => {
                await SnmpMonitoring.getSnmpConfig(deviceB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );

        await assert.rejects(
            async () => {
                await SnmpMonitoring.getDeviceMetrics(deviceB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );

        await assert.rejects(
            async () => {
                await SnmpMonitoring.saveSnmpConfig(deviceB.id, { port: 161 }, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });
});
