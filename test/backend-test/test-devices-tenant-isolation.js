const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Devices & Encrypted Credentials Tenant Isolation Test Suite", () => {
    let Organization;
    let Device;
    let decryptSecret;
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
        const testDbPath = path.join(testDbDir, "test-devices.db");
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
        const cryptoModule = require("../../server/model/credential-crypto.js");
        decryptSecret = cryptoModule.decryptSecret;

        await R.exec("INSERT INTO user (username, password, active) VALUES ('dev_user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'dev_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('dev_user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'dev_user_b'");

        orgA = await Organization.createOrganization("Org Device Alpha", "org-dev-alpha", userAId);
        orgB = await Organization.createOrganization("Org Device Beta", "org-dev-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should create device A in Org A and device B in Org B", async () => {
        deviceA = await Device.createDevice(
            { name: "Vijayawada Core Router", device_type: "Router", hostname: "cr01.vja.net", ip_address: "10.0.1.1", vendor: "Cisco", model: "ASR1001-X" },
            orgA.id
        );
        assert.ok(deviceA.id);
        assert.strictEqual(deviceA.name, "Vijayawada Core Router");
        assert.strictEqual(deviceA.organization_id, orgA.id);

        deviceB = await Device.createDevice(
            { name: "Kakinada MikroTik Switch", device_type: "MikroTik", hostname: "sw01.kkd.net", ip_address: "10.0.2.1", vendor: "MikroTik", model: "CRS326" },
            orgB.id
        );
        assert.ok(deviceB.id);
        assert.strictEqual(deviceB.name, "Kakinada MikroTik Switch");
        assert.strictEqual(deviceB.organization_id, orgB.id);
    });

    it("should encrypt credentials with AES-256-GCM without storing plaintext in DB", async () => {
        const payload = {
            deviceId: deviceA.id,
            credential: {
                name: "SNMP v2 Read Community",
                type: "snmp_v2c",
                secretPayload: { community: "super-secret-community-2026" },
            },
        };

        const updatedDevice = await Device.addCredential(payload.deviceId, payload.credential, orgA.id);
        assert.strictEqual(updatedDevice.credentials.length, 1);

        // Directly query DB table to verify AES-256-GCM cipher string
        const credRow = await R.getRow("SELECT * FROM device_credential WHERE device_id = ?", [deviceA.id]);
        assert.ok(credRow.encrypted_data);
        assert.ok(credRow.iv);
        assert.ok(credRow.auth_tag);
        assert.doesNotMatch(credRow.encrypted_data, /super-secret-community-2026/);

        // Decrypt with secret master key to confirm round-trip integrity
        const decrypted = decryptSecret(credRow.encrypted_data, credRow.iv, credRow.auth_tag);
        assert.strictEqual(decrypted.community, "super-secret-community-2026");
    });

    it("should isolate getDeviceList so Org A cannot view Org B devices", async () => {
        const listA = await Device.getDeviceList(orgA.id);
        assert.strictEqual(listA.length, 1);
        assert.strictEqual(listA[0].name, "Vijayawada Core Router");

        const listB = await Device.getDeviceList(orgB.id);
        assert.strictEqual(listB.length, 1);
        assert.strictEqual(listB[0].name, "Kakinada MikroTik Switch");
    });

    it("should prevent Org A from retrieving device B directly", async () => {
        await assert.rejects(
            async () => {
                await Device.getDevice(deviceB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });

    it("should prevent Org A from modifying device B", async () => {
        await assert.rejects(
            async () => {
                await Device.updateDevice(deviceB.id, { name: "Hacked Router Name" }, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });

    it("should prevent Org A from deleting device B", async () => {
        await assert.rejects(
            async () => {
                await Device.deleteDevice(deviceB.id, orgA.id);
            },
            { message: "Device not found or access denied." }
        );
    });
});
