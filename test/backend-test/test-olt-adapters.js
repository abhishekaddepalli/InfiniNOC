const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC OLT Vendor Adapter Architecture Test Suite", () => {
    let Organization;
    let Device;
    let OltAdapterRegistry;
    let OltMonitoring;
    let orgA;
    let orgB;
    let oltDevA;
    let oltDevB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-olt.db");
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
        OltAdapterRegistry = require("../../server/model/olt-adapter-registry.js");
        OltMonitoring = require("../../server/model/olt-monitoring.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('olt_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'olt_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('olt_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'olt_user_b'");

        orgA = await Organization.createOrganization("Org OLT Alpha", "org-olt-alpha", userAId);
        orgB = await Organization.createOrganization("Org OLT Beta", "org-olt-beta", userBId);

        oltDevA = await Device.createDevice(
            { name: "MA5608T-GPON-01", hostname: "ma5608.net", ip_address: "10.50.0.1", device_type: "OLT", snmp_version: "2c" },
            orgA.id
        );

        oltDevB = await Device.createDevice(
            { name: "ZTE-C320-GPON-02", hostname: "zte320.net", ip_address: "10.60.0.1", device_type: "OLT", snmp_version: "2c" },
            orgB.id
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should register all 7 OLT vendor adapters in OltAdapterRegistry", async () => {
        const adapters = OltAdapterRegistry.listAdapters();
        assert.strictEqual(adapters.length, 7);

        const vendorIds = adapters.map((a) => a.id);
        assert.ok(vendorIds.includes("huawei"));
        assert.ok(vendorIds.includes("zte"));
        assert.ok(vendorIds.includes("dasan"));
        assert.ok(vendorIds.includes("syrotech"));
        assert.ok(vendorIds.includes("optilink"));
        assert.ok(vendorIds.includes("vsol"));
        assert.ok(vendorIds.includes("cdata"));
    });

    it("should auto-detect vendor adapter based on SNMP sysObjectID and sysDescr", async () => {
        const huaweiMatch = OltAdapterRegistry.detectAdapter("1.3.6.1.4.1.2011.2.6", "Huawei SmartAX MA5600T");
        assert.strictEqual(huaweiMatch.id, "huawei");

        const zteMatch = OltAdapterRegistry.detectAdapter("1.3.6.1.4.1.3902.1.1", "ZTE ZXA10 C300");
        assert.strictEqual(zteMatch.id, "zte");

        const dasanMatch = OltAdapterRegistry.detectAdapter("1.3.6.1.4.1.6296.1", "DASAN V5824G");
        assert.strictEqual(dasanMatch.id, "dasan");
    });

    it("should parse realistic Huawei SmartAX GPON SNMP varbind data with 0.01 dBm optical power conversion", async () => {
        const adapter = OltAdapterRegistry.getAdapter("huawei");

        // Authentic Huawei SmartAX Varbinds
        const huaweiVarbinds = [
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.3", value: 16 }, // Board CPU 16%
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.4", value: 42 }, // Board RAM 42%
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.7", value: 45 }, // Board Temp 45°C
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9", value: 1 }, // ONU Online
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9", value: 1 }, // ONU Online
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9", value: 2 }, // ONU Offline / LOS
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4", value: -2150 }, // -21.50 dBm
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4", value: -1980 }, // -19.80 dBm
        ];

        const metrics = adapter.parseOltMetrics(huaweiVarbinds);

        assert.strictEqual(metrics.vendor, "Huawei");
        assert.strictEqual(metrics.cpu, 16);
        assert.strictEqual(metrics.memory, 42);
        assert.strictEqual(metrics.temperature, 45);
        assert.strictEqual(metrics.summary.onlineOnus, 2);
        assert.strictEqual(metrics.summary.offlineOnus, 1);
        assert.strictEqual(metrics.onus[0].rxPowerDbm, -21.5);
        assert.strictEqual(metrics.onus[1].rxPowerDbm, -19.8);
    });

    it("should ingest OLT telemetry and upsert ONU optical inventory into database", async () => {
        const telemetryData = [
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.3", value: 18 },
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.4", value: 39 },
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.21.1.7", value: 43 },
            { oid: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9", value: 1 },
        ];

        const result = await OltMonitoring.ingestOltTelemetry(oltDevA.id, telemetryData, orgA.id);
        assert.strictEqual(result.vendor, "Huawei");

        const dashboard = await OltMonitoring.getOltDashboardData(oltDevA.id, orgA.id);
        assert.strictEqual(dashboard.device.name, "MA5608T-GPON-01");
        assert.strictEqual(dashboard.adapter.vendor, "Huawei");
        assert.ok(dashboard.onus.length > 0);
    });

    it("should enforce tenant isolation so Org A cannot query Org B OLT dashboard or telemetry", async () => {
        await assert.rejects(
            async () => {
                await OltMonitoring.getOltDashboardData(oltDevB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });
});
