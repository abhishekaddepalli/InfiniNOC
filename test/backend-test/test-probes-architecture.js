const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Remote Probe Architecture Test Suite", () => {
    let Organization;
    let Probe;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let probeAInfo;
    let probeBInfo;
    let probeAApiKey;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-probes.db");
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
        Probe = require("../../server/model/probe.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('probe_user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'probe_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('probe_user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'probe_user_b'");

        orgA = await Organization.createOrganization("Org Probe Alpha", "org-probe-alpha", userAId);
        orgB = await Organization.createOrganization("Org Probe Beta", "org-probe-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should generate a one-time registration token for Probe A in Org A", async () => {
        probeAInfo = await Probe.createProbeRegistrationToken(
            { name: "Vijayawada Remote Probe", description: "VJA Customer ISP Probe" },
            orgA.id
        );
        assert.ok(probeAInfo.probe.id);
        assert.ok(probeAInfo.registrationToken);
        assert.strictEqual(probeAInfo.probe.name, "Vijayawada Remote Probe");
        assert.strictEqual(probeAInfo.probe.status, "pending");
    });

    it("should successfully register Probe A and exchange token for persistent API key", async () => {
        const regResult = await Probe.registerProbe(
            probeAInfo.probe.id,
            probeAInfo.registrationToken,
            "103.14.24.10",
            "1.0.0"
        );
        assert.ok(regResult.apiKey);
        assert.strictEqual(regResult.probeId, probeAInfo.probe.id);
        probeAApiKey = regResult.apiKey;

        const updatedProbe = await Probe.getProbe(probeAInfo.probe.id, orgA.id);
        assert.strictEqual(updatedProbe.status, "online");
        assert.strictEqual(updatedProbe.ip_address, "103.14.24.10");
        assert.strictEqual(Number(updatedProbe.registration_token_used), 1);
    });

    it("should reject re-using the same one-time registration token (single-use enforcement)", async () => {
        await assert.rejects(
            async () => {
                await Probe.registerProbe(
                    probeAInfo.probe.id,
                    probeAInfo.registrationToken,
                    "103.14.24.10",
                    "1.0.0"
                );
            },
            { message: "Registration token has already been used." }
        );
    });

    it("should record real probe heartbeat telemetry and calculate roundtrip status", async () => {
        const hbResult = await Probe.recordHeartbeat(probeAInfo.probe.id, probeAApiKey, {
            latency_ms: 18,
            ip_address: "103.14.24.10",
            version: "1.0.0",
        });
        assert.ok(hbResult.ok);

        const updatedProbe = await Probe.getProbe(probeAInfo.probe.id, orgA.id);
        assert.strictEqual(updatedProbe.status, "online");
        assert.strictEqual(updatedProbe.latency_ms, 18);
        assert.ok(updatedProbe.last_heartbeat);
    });

    it("should revoke Probe A and reject subsequent heartbeats", async () => {
        await Probe.revokeProbe(probeAInfo.probe.id, orgA.id);

        const revokedProbe = await Probe.getProbe(probeAInfo.probe.id, orgA.id);
        assert.strictEqual(revokedProbe.status, "revoked");

        await assert.rejects(
            async () => {
                await Probe.recordHeartbeat(probeAInfo.probe.id, probeAApiKey, { latency_ms: 22 });
            },
            { message: "Probe has been revoked." }
        );
    });

    it("should rotate credentials for Probe A and issue new registration token", async () => {
        const rotatedInfo = await Probe.rotateCredentials(probeAInfo.probe.id, orgA.id);
        assert.ok(rotatedInfo.registrationToken);
        assert.strictEqual(rotatedInfo.probe.status, "pending");

        // Re-register probe with new token
        const newReg = await Probe.registerProbe(probeAInfo.probe.id, rotatedInfo.registrationToken, "103.14.24.11", "1.0.1");
        assert.ok(newReg.apiKey);
        probeAApiKey = newReg.apiKey;

        // Verify new API key accepts heartbeats
        const hbResult = await Probe.recordHeartbeat(probeAInfo.probe.id, probeAApiKey, { latency_ms: 12 });
        assert.ok(hbResult.ok);
    });

    it("should enforce tenant isolation so Org B cannot access, revoke, or delete Probe A", async () => {
        probeBInfo = await Probe.createProbeRegistrationToken(
            { name: "Kakinada Remote Probe", description: "KKD Customer ISP Probe" },
            orgB.id
        );
        assert.ok(probeBInfo.probe.id);

        const probesA = await Probe.getProbeList(orgA.id);
        assert.strictEqual(probesA.length, 1);
        assert.strictEqual(probesA[0].name, "Vijayawada Remote Probe");

        const probesB = await Probe.getProbeList(orgB.id);
        assert.strictEqual(probesB.length, 1);
        assert.strictEqual(probesB[0].name, "Kakinada Remote Probe");

        await assert.rejects(
            async () => {
                await Probe.revokeProbe(probeAInfo.probe.id, orgB.id);
            },
            { message: "Probe not found or access denied." }
        );

        await assert.rejects(
            async () => {
                await Probe.deleteProbe(probeAInfo.probe.id, orgB.id);
            },
            { message: "Probe not found or access denied." }
        );
    });
});
