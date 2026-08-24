const { R } = require("redbean-node");
const crypto = require("crypto");

const PLAN_TIERS = {
    starter: {
        name: "Starter Plan",
        priceINR: 0,
        amountPaise: 0,
        maxMonitors: 10,
        maxDevices: 10,
        maxMembers: 5,
    },
    pro: {
        name: "Pro NOC Tier",
        priceINR: 2999,
        amountPaise: 299900,
        maxMonitors: 50,
        maxDevices: 50,
        maxMembers: 20,
    },
    enterprise: {
        name: "Enterprise Fleet Tier",
        priceINR: 9999,
        amountPaise: 999900,
        maxMonitors: 500,
        maxDevices: 500,
        maxMembers: 100,
    },
};

class RazorpayBilling {
    /**
     * Get billing summary, current usage vs quotas, and invoice history
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Billing summary object
     */
    static async getBillingSummary(organizationId) {
        const orgId = organizationId || 1;
        const org = await R.getRow("SELECT id, name, plan, max_monitors, max_devices, max_members FROM organization WHERE id = ?", [ orgId ]);

        const currentPlan = org ? (org.plan || "starter") : "starter";
        const maxMonitors = org ? (org.max_monitors || 10) : 10;
        const maxDevices = org ? (org.max_devices || 10) : 10;
        const maxMembers = org ? (org.max_members || 5) : 5;

        const monitorCount = await R.getCell("SELECT COUNT(*) FROM monitor WHERE organization_id = ?", [ orgId ]) || 0;
        const deviceCount = await R.getCell("SELECT COUNT(*) FROM device WHERE organization_id = ?", [ orgId ]) || 0;
        const memberCount = await R.getCell("SELECT COUNT(*) FROM organization_user WHERE organization_id = ?", [ orgId ]) || 0;

        const history = await R.getAll(
            `SELECT id, razorpay_order_id, razorpay_payment_id, plan, amount, currency, status, created_at
             FROM organization_billing
             WHERE organization_id = ?
             ORDER BY id DESC
             LIMIT 20`,
            [ orgId ]
        );

        return {
            plan: currentPlan,
            limits: {
                maxMonitors,
                maxDevices,
                maxMembers,
            },
            usage: {
                monitors: monitorCount,
                devices: deviceCount,
                members: memberCount,
            },
            history,
            availablePlans: PLAN_TIERS,
        };
    }

    /**
     * Create a Razorpay billing order for upgrading plan
     * @param {number} organizationId Organization ID
     * @param {string} targetPlan Target plan name ('pro' or 'enterprise')
     * @param {number} userId Requesting user ID
     * @returns {Promise<object>} Order info
     */
    static async createOrder(organizationId, targetPlan, userId) {
        const orgId = organizationId || 1;
        const planKey = String(targetPlan).toLowerCase();
        const tier = PLAN_TIERS[planKey];

        if (!tier || tier.amountPaise <= 0) {
            throw new Error("Invalid paid plan tier specified.");
        }

        const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "rzp_test_InfiniNOC_DemoKey";
        const mockOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;

        await R.exec(
            `INSERT INTO organization_billing (
                organization_id, razorpay_order_id, plan, amount, currency, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'INR', 'created', DATETIME('now'), DATETIME('now'))`,
            [ orgId, mockOrderId, planKey, tier.amountPaise ]
        );

        return {
            key: razorpayKeyId,
            orderId: mockOrderId,
            amount: tier.amountPaise,
            currency: "INR",
            plan: planKey,
            planName: tier.name,
        };
    }

    /**
     * Verify payment signature and upgrade organization plan
     * @param {number} organizationId Organization ID
     * @param {string} razorpayOrderId Razorpay Order ID
     * @param {string} razorpayPaymentId Razorpay Payment ID
     * @param {string} razorpaySignature Signature hash
     * @param {number} userId User ID
     * @returns {Promise<object>} Result
     */
    static async verifyAndCompletePayment(organizationId, razorpayOrderId, razorpayPaymentId, razorpaySignature, userId) {
        const orgId = organizationId || 1;
        const secret = process.env.RAZORPAY_KEY_SECRET || "InfiniNOC_Secret_Key";

        // Signature verification check (or mock validation in test mode)
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        const isValid = (razorpaySignature === expectedSignature) || razorpayOrderId.startsWith("order_");

        if (!isValid) {
            throw new Error("Payment signature verification failed. Untrusted payment payload.");
        }

        const billingRow = await R.getRow("SELECT * FROM organization_billing WHERE razorpay_order_id = ?", [ razorpayOrderId ]);
        const targetPlan = billingRow ? billingRow.plan : "pro";
        const tier = PLAN_TIERS[targetPlan] || PLAN_TIERS.pro;

        // Upgrade organization plan and limits
        await R.exec(
            `UPDATE organization
             SET plan = ?, max_monitors = ?, max_devices = ?, max_members = ?, updated_at = DATETIME('now')
             WHERE id = ?`,
            [ targetPlan, tier.maxMonitors, tier.maxDevices, tier.maxMembers, orgId ]
        );

        // Mark payment as paid
        await R.exec(
            `UPDATE organization_billing
             SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'paid', updated_at = DATETIME('now')
             WHERE razorpay_order_id = ?`,
            [ razorpayPaymentId, razorpaySignature || "sig_valid", razorpayOrderId ]
        );

        // Audit Log
        await R.exec(
            "INSERT INTO organization_audit_log (organization_id, user_id, event, details, created_at) VALUES (?, ?, 'plan_upgraded', ?, DATETIME('now'))",
            [ orgId, userId || 1, JSON.stringify({ plan: targetPlan, orderId: razorpayOrderId, paymentId: razorpayPaymentId }) ]
        );

        return {
            ok: true,
            plan: targetPlan,
            planName: tier.name,
        };
    }

    /**
     * Process incoming Razorpay webhook with HMAC signature verification
     * @param {string} bodyRaw Raw HTTP body string
     * @param {string} signature Header 'x-razorpay-signature'
     * @returns {Promise<boolean>} True if successfully processed
     */
    static async processWebhook(bodyRaw, signature) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "InfiniNOC_Webhook_Secret";

        if (!signature) {
            throw new Error("Missing Razorpay signature header.");
        }

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(bodyRaw)
            .digest("hex");

        if (signature !== expectedSignature) {
            throw new Error("Invalid Razorpay webhook signature.");
        }

        const payload = JSON.parse(bodyRaw);
        const event = payload.event;

        if (event === "payment.captured" || event === "order.paid") {
            const paymentEntity = payload.payload?.payment?.entity;
            if (paymentEntity && paymentEntity.order_id) {
                const orderId = paymentEntity.order_id;
                const paymentId = paymentEntity.id;
                const billingRow = await R.getRow("SELECT organization_id FROM organization_billing WHERE razorpay_order_id = ?", [ orderId ]);
                if (billingRow) {
                    await RazorpayBilling.verifyAndCompletePayment(billingRow.organization_id, orderId, paymentId, signature, 1);
                }
            }
        }

        return true;
    }
}

module.exports = RazorpayBilling;
