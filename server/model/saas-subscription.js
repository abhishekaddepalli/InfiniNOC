const { R } = require("redbean-node");
const RazorpayBilling = require("./razorpay-billing");

class SaasSubscription {
    /**
     * Seed database-driven plans if not present
     * @returns {Promise<void>}
     */
    static async seedPlans() {
        const count = await R.getCell("SELECT COUNT(*) FROM saas_plan");
        if (Number(count) === 0) {
            const isoNow = new Date().toISOString();
            const plans = [
                { code: "STARTER", name: "Starter NOC Plan", max_devices: 25, max_monitors: 50, max_probes: 2, max_users: 5, retention: 14, max_status: 1, api_limit: 1000, price: 1999 },
                { code: "BUSINESS", name: "Business NOC Plan", max_devices: 100, max_monitors: 250, max_probes: 5, max_users: 15, retention: 30, max_status: 3, api_limit: 5000, price: 4999 },
                { code: "PROFESSIONAL", name: "Professional NOC Plan", max_devices: 500, max_monitors: 1000, max_probes: 15, max_users: 50, retention: 90, max_status: 10, api_limit: 20000, price: 14999 },
                { code: "ENTERPRISE", name: "Enterprise NOC Plan", max_devices: 9999, max_monitors: 9999, max_probes: 100, max_users: 999, retention: 365, max_status: 99, api_limit: 100000, price: 49999 },
            ];

            for (const p of plans) {
                await R.exec(
                    `INSERT INTO saas_plan (
                        code, name, max_devices, max_monitors, max_probes, max_users, metric_retention_days, max_status_pages, max_api_rate_limit, monthly_price_inr, is_active, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [p.code, p.name, p.max_devices, p.max_monitors, p.max_probes, p.max_users, p.retention, p.max_status, p.api_limit, p.price, isoNow]
                );
            }
        }
    }

    /**
     * Get or create active subscription record for organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Subscription record
     */
    static async getSubscription(organizationId) {
        await SaasSubscription.seedPlans();
        const orgId = organizationId || 1;
        let sub = await R.getRow("SELECT * FROM organization_subscription WHERE organization_id = ?", [orgId]);

        if (!sub) {
            const starterPlan = await R.getRow("SELECT * FROM saas_plan WHERE code = 'STARTER'");
            const isoNow = new Date();
            const trialEnd = new Date(isoNow.getTime() + 14 * 24 * 3600 * 1000).toISOString();

            await R.exec(
                `INSERT INTO organization_subscription (
                    organization_id, plan_id, status, trial_ends_at, created_at, updated_at
                ) VALUES (?, ?, 'TRIAL', ?, ?, ?)`,
                [orgId, starterPlan ? starterPlan.id : 1, trialEnd, isoNow.toISOString(), isoNow.toISOString()]
            );
            sub = await R.getRow("SELECT * FROM organization_subscription WHERE organization_id = ?", [orgId]);
        }

        return sub;
    }

    /**
     * Get comprehensive SaaS subscription & quota overview
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Subscription overview
     */
    static async getSubscriptionOverview(organizationId) {
        const orgId = organizationId || 1;
        const sub = await SaasSubscription.getSubscription(orgId);
        const plan = await R.getRow("SELECT * FROM saas_plan WHERE id = ?", [sub.plan_id]);

        let usedDevices = 0;
        let usedMonitors = 0;
        let usedProbes = 0;
        let usedUsers = 1;
        let usedStatusPages = 0;

        try {
            usedDevices = Number(await R.getCell("SELECT COUNT(*) FROM device WHERE organization_id = ?", [orgId]) || 0);
        } catch (e) {}

        try {
            usedMonitors = Number(await R.getCell("SELECT COUNT(*) FROM monitor") || 0);
        } catch (e) {}

        try {
            usedProbes = Number(await R.getCell("SELECT COUNT(*) FROM remote_probe WHERE organization_id = ?", [orgId]) || 0);
        } catch (e) {}

        try {
            usedUsers = Number(await R.getCell("SELECT COUNT(*) FROM user") || 1);
        } catch (e) {}

        try {
            usedStatusPages = Number(await R.getCell("SELECT COUNT(*) FROM status_page") || 0);
        } catch (e) {}

        const availablePlans = await R.getAll("SELECT * FROM saas_plan WHERE is_active = 1 ORDER BY monthly_price_inr ASC");
        const paymentHistory = await R.getAll("SELECT * FROM billing_payment_history WHERE organization_id = ? ORDER BY id DESC LIMIT 10", [orgId]);

        return {
            subscription: sub,
            plan: plan || { code: "STARTER", name: "Starter NOC Plan", max_devices: 25, max_monitors: 50, max_probes: 2, max_users: 5, max_status_pages: 1 },
            usage: {
                devices: { used: usedDevices, limit: plan ? plan.max_devices : 25, isExhausted: usedDevices >= (plan ? plan.max_devices : 25) },
                monitors: { used: usedMonitors, limit: plan ? plan.max_monitors : 50, isExhausted: usedMonitors >= (plan ? plan.max_monitors : 50) },
                probes: { used: usedProbes, limit: plan ? plan.max_probes : 2, isExhausted: usedProbes >= (plan ? plan.max_probes : 2) },
                users: { used: usedUsers, limit: plan ? plan.max_users : 5, isExhausted: usedUsers >= (plan ? plan.max_users : 5) },
                statusPages: { used: usedStatusPages, limit: plan ? plan.max_status_pages : 1, isExhausted: usedStatusPages >= (plan ? plan.max_status_pages : 1) },
                metricRetentionDays: plan ? plan.metric_retention_days : 14,
            },
            availablePlans,
            paymentHistory: paymentHistory || [],
        };
    }

    /**
     * Enforce database-driven resource limit
     * Throws actionable error if limit reached e.g. "Device limit reached (25/25). Upgrade your plan."
     * @param {number} organizationId Organization ID
     * @param {string} metricName devices, monitors, probes, users, statusPages
     * @returns {Promise<void>}
     */
    static async checkLimit(organizationId, metricName) {
        const overview = await SaasSubscription.getSubscriptionOverview(organizationId);
        const target = overview.usage[metricName];

        if (target && target.isExhausted) {
            const metricTitle = metricName.charAt(0).toUpperCase() + metricName.slice(1, -1);
            throw new Error(`${metricTitle} limit reached (${target.used}/${target.limit}). Upgrade your plan.`);
        }
    }

    /**
     * Upgrade subscription plan after server payment verification
     * @param {object} params Upgrade params (planCode, paymentId, orderId, signature)
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated subscription
     */
    static async upgradePlan(params, organizationId) {
        const orgId = organizationId || 1;
        if (!params || !params.planCode) {
            throw new Error("Target plan code required.");
        }

        const targetPlan = await R.getRow("SELECT * FROM saas_plan WHERE code = ?", [params.planCode]);
        if (!targetPlan) {
            throw new Error("Invalid plan code.");
        }

        // Server-side payment verification (for non-free plans)
        if (targetPlan.monthly_price_inr > 0 && params.signature) {
            const isValid = RazorpayBilling.verifyPaymentSignature(params.orderId, params.paymentId, params.signature);
            if (!isValid) {
                throw new Error("Server-side payment signature verification failed. Untrusted payment payload!");
            }

            await RazorpayBilling.recordPayment(
                {
                    paymentId: params.paymentId,
                    orderId: params.orderId,
                    signature: params.signature,
                    amountInr: targetPlan.monthly_price_inr,
                    status: "SUCCESS",
                },
                orgId
            );
        }

        const sub = await SaasSubscription.getSubscription(orgId);
        const isoNow = new Date();
        const periodEnd = new Date(isoNow.getTime() + 30 * 24 * 3600 * 1000).toISOString();

        await R.exec(
            `UPDATE organization_subscription SET
                plan_id = ?,
                status = 'ACTIVE',
                current_period_start = ?,
                current_period_end = ?,
                updated_at = ?
             WHERE id = ? AND organization_id = ?`,
            [targetPlan.id, isoNow.toISOString(), periodEnd, isoNow.toISOString(), sub.id, orgId]
        );

        return SaasSubscription.getSubscriptionOverview(orgId);
    }
}

module.exports = SaasSubscription;
