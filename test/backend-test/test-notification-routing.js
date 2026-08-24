const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Notification Routing Engine & Provider Abstraction Test Suite", () => {
    let Organization;
    let NotificationRouter;
    let orgA;
    let orgB;
    let channelEmailA;
    let channelTelegramA;
    let channelWhatsAppA;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-notifications.db");
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
        NotificationRouter = require("../../server/model/notification-router.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('notif_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'notif_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('notif_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'notif_user_b'");

        orgA = await Organization.createOrganization("Org Notif Alpha", "org-notif-alpha", userAId);
        orgB = await Organization.createOrganization("Org Notif Beta", "org-notif-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should create Email, Telegram, and WhatsApp Cloud API channels with AES-256-GCM encrypted secrets", async () => {
        channelEmailA = await NotificationRouter.saveChannel(
            {
                name: "NOC Email Channel",
                channelType: "EMAIL",
                config: { host: "smtp.mailgun.org", to: "noc-alerts@orga.com", pass: "SuperSecretSMTPPass123!" },
            },
            orgA.id
        );

        channelTelegramA = await NotificationRouter.saveChannel(
            {
                name: "NOC Telegram Bot",
                channelType: "TELEGRAM",
                config: { botToken: "123456789:SecretTelegramBotTokenABC", chatId: "-1001928374" },
            },
            orgA.id
        );

        channelWhatsAppA = await NotificationRouter.saveChannel(
            {
                name: "NOC WhatsApp Cloud API",
                channelType: "WHATSAPP",
                config: { accessToken: "EAAG...MetaSecretAccessTokenKey", phoneNumberId: "1092837465", recipientPhoneNumber: "+15550192834" },
            },
            orgA.id
        );

        assert.ok(channelEmailA.id);
        assert.ok(channelTelegramA.id);
        assert.ok(channelWhatsAppA.id);

        // Verify database raw column NEVER stores plaintext secrets
        const rawDbRecord = await R.getRow("SELECT encrypted_config FROM notification_channel WHERE id = ?", [channelWhatsAppA.id]);
        assert.strictEqual(rawDbRecord.encrypted_config.includes("EAAG...MetaSecretAccessTokenKey"), false);
        assert.ok(rawDbRecord.encrypted_config.includes("encrypted_data"));
        assert.ok(rawDbRecord.encrypted_config.includes("iv"));
    });

    it("should set up P1, P2, P3, and P4 severity routing rules", async () => {
        await NotificationRouter.saveRoutingRule(
            { name: "P1 Urgent Multi-Channel", eventType: "ALERT", minSeverity: "P1", channelId: channelWhatsAppA.id, cooldownMinutes: 15 },
            orgA.id
        );

        await NotificationRouter.saveRoutingRule(
            { name: "P2 High Telegram", eventType: "ALERT", minSeverity: "P2", channelId: channelTelegramA.id, cooldownMinutes: 10 },
            orgA.id
        );

        await NotificationRouter.saveRoutingRule(
            { name: "P3 Normal Email", eventType: "ALERT", minSeverity: "P3", channelId: channelEmailA.id, cooldownMinutes: 30 },
            orgA.id
        );

        const rules = await NotificationRouter.getRoutingRules(orgA.id);
        assert.strictEqual(rules.length, 3);
    });

    it("should route P1 alerts to WhatsApp, Telegram, and Email", async () => {
        const results = await NotificationRouter.dispatchNotification(
            { eventType: "ALERT", severity: "P1", entityId: "router-01", subject: "Core Router Down", message: "Core Router unreachable" },
            orgA.id
        );

        assert.ok(results.length >= 3);
        const successCount = results.filter((r) => r.status === "SUCCESS").length;
        assert.strictEqual(successCount, 3);
    });

    it("should route P4 alerts to Dashboard only without triggering outbound channels", async () => {
        const results = await NotificationRouter.dispatchNotification(
            { eventType: "ALERT", severity: "P4", entityId: "dev-temp-01", subject: "Minor Temp Fluctuation", message: "Temp elevated" },
            orgA.id
        );

        assert.strictEqual(results[0].status, "SUPPRESSED_DASHBOARD_ONLY");
    });

    it("should enforce cooldown window duplicate suppression for consecutive alerts", async () => {
        const secondDispatch = await NotificationRouter.dispatchNotification(
            { eventType: "ALERT", severity: "P1", entityId: "router-01", subject: "Core Router Down", message: "Core Router unreachable" },
            orgA.id
        );

        const suppressedCount = secondDispatch.filter((r) => r.status === "SUPPRESSED_COOLDOWN").length;
        assert.ok(suppressedCount > 0);
    });

    it("should log delivery audit entries without leaking any provider secrets", async () => {
        const logs = await NotificationRouter.getDeliveryLogs(orgA.id);
        assert.ok(logs.length > 0);

        for (const log of logs) {
            assert.strictEqual(String(log.error_message || "").includes("SuperSecretSMTPPass123!"), false);
            assert.strictEqual(String(log.error_message || "").includes("SecretTelegramBotTokenABC"), false);
        }
    });

    it("should enforce tenant isolation so Org A cannot query, test, or delete Org B channels", async () => {
        const channelB = await NotificationRouter.saveChannel(
            { name: "Org B Email", channelType: "EMAIL", config: { host: "smtp.beta.com" } },
            orgB.id
        );

        const channelsOrgA = await NotificationRouter.getChannels(orgA.id);
        const found = channelsOrgA.find((c) => c.id === channelB.id);
        assert.strictEqual(found, undefined);

        await assert.rejects(
            async () => {
                await NotificationRouter.testChannel(channelB.id, orgA.id);
            },
            { message: "Notification channel not found." }
        );
    });
});
