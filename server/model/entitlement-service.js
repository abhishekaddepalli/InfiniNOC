const { R } = require("redbean-node");

/**
 * SaaS Feature Entitlement & Usage Limit Service
 */
class EntitlementService {
    /**
     * Initialize SaaS plans, entitlements, and overrides tables
     */
    static async initTables() {
        try {
            // Safely migrate SQLite schema for missing columns
            try {
                await R.exec("ALTER TABLE user ADD COLUMN email TEXT;");
            } catch (e) {
                // Column already exists or table structure handles it
            }

            await R.exec(`
                CREATE TABLE IF NOT EXISTS saas_plan (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE NOT NULL,
                    description TEXT,
                    price_monthly REAL DEFAULT 0,
                    price_yearly REAL DEFAULT 0,
                    currency TEXT DEFAULT 'INR',
                    trial_days INTEGER DEFAULT 14,
                    status TEXT DEFAULT 'active',
                    is_public INTEGER DEFAULT 1,
                    features_json TEXT,
                    limits_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS saas_subscription (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organization_id INTEGER UNIQUE NOT NULL,
                    plan_id INTEGER NOT NULL,
                    status TEXT DEFAULT 'active',
                    billing_cycle TEXT DEFAULT 'monthly',
                    amount REAL DEFAULT 0,
                    current_period_start DATETIME,
                    current_period_end DATETIME,
                    trial_ends_at DATETIME,
                    gateway TEXT DEFAULT 'razorpay',
                    subscription_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS saas_invoice (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organization_id INTEGER NOT NULL,
                    invoice_number TEXT UNIQUE NOT NULL,
                    gstin TEXT,
                    hsn_sac TEXT DEFAULT '998313',
                    subtotal REAL DEFAULT 0,
                    cgst REAL DEFAULT 0,
                    sgst REAL DEFAULT 0,
                    igst REAL DEFAULT 0,
                    total REAL DEFAULT 0,
                    currency TEXT DEFAULT 'INR',
                    status TEXT DEFAULT 'draft',
                    paid_at DATETIME,
                    pdf_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS saas_coupon (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    discount_type TEXT DEFAULT 'percentage',
                    value REAL DEFAULT 0,
                    max_uses INTEGER DEFAULT 100,
                    current_uses INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS organization_feature_override (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organization_id INTEGER NOT NULL,
                    feature_key TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    limit_value INTEGER DEFAULT -1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(organization_id, feature_key)
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS payment_gateway_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gateway_name TEXT UNIQUE NOT NULL,
                    is_enabled INTEGER DEFAULT 0,
                    is_test_mode INTEGER DEFAULT 1,
                    key_id TEXT,
                    secret_key_encrypted TEXT,
                    webhook_secret_encrypted TEXT,
                    currency TEXT DEFAULT 'INR',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await R.exec(`
                CREATE TABLE IF NOT EXISTS super_admin_impersonation_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_user_id INTEGER NOT NULL,
                    organization_id INTEGER NOT NULL,
                    reason TEXT,
                    ip_address TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ended_at DATETIME
                );
            `);

            await this.seedDefaultPlans();
            await this.seedPaymentGateways();
        } catch (e) {
            console.error("Failed to initialize SaaS Entitlement tables:", e);
        }
    }

    /**
     * Seed default SaaS plans with Indian Rupee (₹) pricing
     */
    static async seedDefaultPlans() {
        const plans = [
            {
                name: "Starter Tier",
                slug: "starter",
                description: "Essential NOC monitoring & diagnostics for small IT teams",
                price_monthly: 0,
                price_yearly: 0,
                trial_days: 14,
                features_json: JSON.stringify({
                    monitoring: true,
                    snmp_monitor: true,
                    devices: true,
                    probes: true,
                    tools: true,
                    team: true,
                    api: false,
                    white_label: false,
                }),
                limits_json: JSON.stringify({
                    maxMonitors: 10,
                    maxDevices: 10,
                    maxMembers: 5,
                    maxStatusPages: 2,
                    maxNotificationChannels: 3,
                }),
            },
            {
                name: "Professional NOC",
                slug: "pro",
                description: "Advanced network intelligence, GPON OLT optical & SNMP telemetry",
                price_monthly: 2499,
                price_yearly: 24990,
                trial_days: 14,
                features_json: JSON.stringify({
                    monitoring: true,
                    snmp_monitor: true,
                    devices: true,
                    probes: true,
                    tools: true,
                    team: true,
                    api: true,
                    white_label: false,
                }),
                limits_json: JSON.stringify({
                    maxMonitors: 50,
                    maxDevices: 50,
                    maxMembers: 20,
                    maxStatusPages: 10,
                    maxNotificationChannels: 15,
                }),
            },
            {
                name: "Enterprise Multi-Tenant",
                slug: "enterprise",
                description: "Unlimited scale, Indian GST invoicing, custom white-label & 24/7 SLA",
                price_monthly: 9999,
                price_yearly: 99990,
                trial_days: 30,
                features_json: JSON.stringify({
                    monitoring: true,
                    snmp_monitor: true,
                    devices: true,
                    probes: true,
                    tools: true,
                    team: true,
                    api: true,
                    white_label: true,
                }),
                limits_json: JSON.stringify({
                    maxMonitors: -1,
                    maxDevices: -1,
                    maxMembers: -1,
                    maxStatusPages: -1,
                    maxNotificationChannels: -1,
                }),
            },
        ];

        for (const p of plans) {
            const existing = await R.getRow("SELECT id FROM saas_plan WHERE slug = ?", [ p.slug ]);
            if (!existing) {
                await R.exec(
                    `INSERT INTO saas_plan (name, slug, description, price_monthly, price_yearly, currency, trial_days, status, is_public, features_json, limits_json, created_at)
                     VALUES (?, ?, ?, ?, ?, 'INR', ?, 'active', 1, ?, ?, DATETIME('now'))`,
                    [ p.name, p.slug, p.description, p.price_monthly, p.price_yearly, p.trial_days, p.features_json, p.limits_json ]
                );
            }
        }
    }

    /**
     * Seed Indian payment gateways (Razorpay & Cashfree)
     */
    static async seedPaymentGateways() {
        const count = await R.getCell("SELECT COUNT(*) FROM payment_gateway_config") || 0;
        if (count > 0) {
            return;
        }

        const gateways = [
            { name: "Razorpay", enabled: 1, testMode: 1, currency: "INR" },
            { name: "Cashfree", enabled: 0, testMode: 1, currency: "INR" },
            { name: "Stripe", enabled: 0, testMode: 1, currency: "INR" },
        ];

        for (const g of gateways) {
            await R.exec(
                `INSERT INTO payment_gateway_config (gateway_name, is_enabled, is_test_mode, currency, updated_at)
                 VALUES (?, ?, ?, ?, DATETIME('now'))`,
                [ g.name, g.enabled, g.testMode, g.currency ]
            );
        }
    }

    /**
     * Compute GST tax breakdown for Indian invoicing (18% Total GST)
     * @param {number} subtotal Subtotal in INR (₹)
     * @param {boolean} isInterState If customer is outside home state (IGST vs CGST+SGST)
     * @returns {object} Tax breakdown
     */
    static calculateGstTax(subtotal, isInterState = false) {
        const rate = 0.18; // 18% GST
        const totalTax = subtotal * rate;

        if (isInterState) {
            return {
                subtotal,
                cgst: 0,
                sgst: 0,
                igst: totalTax,
                totalTax,
                grandTotal: subtotal + totalTax,
            };
        }

        const halfTax = totalTax / 2; // 9% CGST + 9% SGST
        return {
            subtotal,
            cgst: halfTax,
            sgst: halfTax,
            igst: 0,
            totalTax,
            grandTotal: subtotal + totalTax,
        };
    }

    /**
     * Get real resource usage count for an organization
     * @param {number} organizationId Organization ID
     * @param {string} resource Resource name ('monitors', 'devices', 'members', 'statusPages')
     * @returns {Promise<number>} Current count
     */
    static async getUsage(organizationId, resource) {
        const orgId = organizationId || 1;
        switch (resource) {
            case "monitors":
            case "maxMonitors":
                return (await R.getCell("SELECT COUNT(*) FROM monitor WHERE organization_id = ?", [ orgId ])) || 0;
            case "devices":
            case "maxDevices":
                return (await R.getCell("SELECT COUNT(*) FROM device WHERE organization_id = ?", [ orgId ])) || 0;
            case "members":
            case "maxMembers":
                return (await R.getCell("SELECT COUNT(*) FROM organization_user WHERE organization_id = ?", [ orgId ])) || 0;
            case "statusPages":
            case "maxStatusPages":
                return (await R.getCell("SELECT COUNT(*) FROM status_page WHERE organization_id = ?", [ orgId ])) || 0;
            default:
                return 0;
        }
    }

    /**
     * Get numerical resource limit for an organization (checks overrides -> plan -> default)
     * @param {number} organizationId Organization ID
     * @param {string} resource Resource name
     * @returns {Promise<number>} Numeric limit (-1 = unlimited, 0 = disabled)
     */
    static async getLimit(organizationId, resource) {
        await this.initTables();
        const orgId = organizationId || 1;

        // 1. Check custom organization feature override
        const override = await R.getRow(
            "SELECT limit_value, enabled FROM organization_feature_override WHERE organization_id = ? AND feature_key = ?",
            [ orgId, resource ]
        );
        if (override) {
            return override.enabled === 0 ? 0 : override.limit_value;
        }

        // 2. Check organization plan limits
        const org = await R.getRow("SELECT plan, max_monitors, max_devices, max_members FROM organization WHERE id = ?", [ orgId ]);
        if (!org) {
            return 10;
        }

        if (resource === "maxMonitors" || resource === "monitors") {
            return org.max_monitors || 10;
        }
        if (resource === "maxDevices" || resource === "devices") {
            return org.max_devices || 10;
        }
        if (resource === "maxMembers" || resource === "members") {
            return org.max_members || 5;
        }

        const planSlug = org.plan || "starter";
        const plan = await R.getRow("SELECT limits_json FROM saas_plan WHERE slug = ?", [ planSlug ]);
        if (plan && plan.limits_json) {
            try {
                const parsed = JSON.parse(plan.limits_json);
                if (parsed && parsed[resource] !== undefined) {
                    return parsed[resource];
                }
            } catch (e) {}
        }

        return 10;
    }

    /**
     * Assert an organization is within resource limits before operation
     * @param {number} organizationId Organization ID
     * @param {string} resource Resource name
     * @throws {Error} If limit reached
     */
    static async assertWithinLimit(organizationId, resource) {
        const usage = await this.getUsage(organizationId, resource);
        const limit = await this.getLimit(organizationId, resource);

        if (limit !== -1 && usage >= limit) {
            throw new Error(`SaaS Quota Limit Reached: Current usage (${usage}/${limit}) has reached your plan limit for ${resource}. Please upgrade your subscription on the Billing page.`);
        }
    }
}

module.exports = EntitlementService;
