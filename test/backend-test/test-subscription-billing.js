const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

describe("InfiniNOC SaaS Subscriptions & Razorpay Server-Verified Billing Test Suite", () => {
    let Organization;
    let SaasSubscription;
    let RazorpayBilling;
    let orgA;
    let orgB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-billing.db");
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
        SaasSubscription = require("../../server/model/saas-subscription.js");
        RazorpayBilling = require("../../server/model/razorpay-billing.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('bill_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'bill_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('bill_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'bill_user_b'");

        orgA = await Organization.createOrganization("Org Bill Alpha", "org-bill-alpha", userAId);
        orgB = await Organization.createOrganization("Org Bill Beta", "org-bill-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should seed database-driven plans (Starter, Business, Professional, Enterprise)", async () => {
        await SaasSubscription.seedPlans();
        const plans = await R.getAll("SELECT * FROM saas_plan");

        assert.strictEqual(plans.length, 4);
        const starter = plans.find((p) => p.code === "STARTER");
        assert.ok(starter);
        assert.strictEqual(starter.max_devices, 25);
        assert.strictEqual(starter.max_monitors, 50);
        assert.strictEqual(starter.max_probes, 2);
    });

    it("should initialize Org A in TRIAL subscription status", async () => {
        const overview = await SaasSubscription.getSubscriptionOverview(orgA.id);
        assert.strictEqual(overview.subscription.status, "TRIAL");
        assert.strictEqual(overview.plan.code, "STARTER");
        assert.strictEqual(overview.usage.devices.limit, 25);
    });

    it("should enforce server-side usage limit and throw error when device quota is exhausted", async () => {
        const isoNow = new Date().toISOString();
        for (let i = 0; i < 25; i++) {
            await R.exec(
                "INSERT INTO device (organization_id, name, ip_address, device_type, created_at, updated_at) VALUES (?, ?, '10.0.0.1', 'router', ?, ?)",
                [orgA.id, `Test Router ${i}`, isoNow, isoNow]
            );
        }

        const overview = await SaasSubscription.getSubscriptionOverview(orgA.id);
        assert.strictEqual(overview.usage.devices.used, 25);
        assert.strictEqual(overview.usage.devices.isExhausted, true);

        await assert.rejects(
            async () => {
                await SaasSubscription.checkLimit(orgA.id, "devices");
            },
            { message: "Device limit reached (25/25). Upgrade your plan." }
        );
    });

    it("should verify Razorpay HMAC-SHA256 payment signature server-side and reject fake signatures", () => {
        const config = RazorpayBilling.getRazorpayConfig();
        const orderId = "order_test_12345";
        const paymentId = "pay_test_67890";
        const validSignature = crypto
            .createHmac("sha256", config.keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");

        assert.strictEqual(RazorpayBilling.verifyPaymentSignature(orderId, paymentId, validSignature), true);
        assert.strictEqual(RazorpayBilling.verifyPaymentSignature(orderId, paymentId, "fake_tampered_signature"), false);
    });

    it("should upgrade Org A plan to BUSINESS upon server-verified payment", async () => {
        const config = RazorpayBilling.getRazorpayConfig();
        const orderId = "order_upgrade_999";
        const paymentId = "pay_upgrade_888";
        const signature = crypto
            .createHmac("sha256", config.keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");

        const updated = await SaasSubscription.upgradePlan(
            {
                planCode: "BUSINESS",
                orderId,
                paymentId,
                signature,
            },
            orgA.id
        );

        assert.strictEqual(updated.subscription.status, "ACTIVE");
        assert.strictEqual(updated.plan.code, "BUSINESS");
        assert.strictEqual(updated.usage.devices.limit, 100);
        assert.strictEqual(updated.usage.devices.isExhausted, false);
    });

    it("should enforce tenant isolation so Org A cannot query or hijack Org B billing subscription", async () => {
        const overviewA = await SaasSubscription.getSubscriptionOverview(orgA.id);
        const overviewB = await SaasSubscription.getSubscriptionOverview(orgB.id);

        assert.strictEqual(overviewA.plan.code, "BUSINESS");
        assert.strictEqual(overviewB.plan.code, "STARTER");
        assert.notStrictEqual(overviewA.subscription.id, overviewB.subscription.id);
    });
});
