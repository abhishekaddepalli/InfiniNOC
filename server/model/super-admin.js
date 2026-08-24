const { R } = require("redbean-node");
const EntitlementService = require("./entitlement-service");
const os = require("os");

class SuperAdmin {
    /**
     * Assert if a user is a platform Super Admin
     * @param {number} userId User ID
     * @returns {Promise<boolean>} True if Super Admin
     */
    static async isSuperAdmin(userId) {
        if (!userId) {
            return false;
        }
        const user = await R.getRow("SELECT is_super_admin FROM user WHERE id = ?", [ userId ]);
        return Boolean(user && user.is_super_admin);
    }

    /**
     * Assert user super admin privilege or throw Error
     * @param {number} userId User ID
     * @returns {Promise<void>}
     */
    static async assertSuperAdmin(userId) {
        const check = await SuperAdmin.isSuperAdmin(userId);
        if (!check) {
            throw new Error("Access Denied: Super Admin privileges required for this platform control plane operation.");
        }
    }

    /**
     * Get global platform telemetry & SaaS financial overview
     * @returns {Promise<object>} Global stats object with real database counts
     */
    static async getGlobalOverview() {
        await EntitlementService.initTables();
        const totalOrganizations = await R.getCell("SELECT COUNT(*) FROM organization") || 0;
        const activeOrganizations = await R.getCell("SELECT COUNT(*) FROM organization WHERE COALESCE(status, 'active') = 'active'") || 0;
        const suspendedOrganizations = await R.getCell("SELECT COUNT(*) FROM organization WHERE status = 'suspended'") || 0;

        const totalUsers = await R.getCell("SELECT COUNT(*) FROM user") || 0;
        const activeUsers = await R.getCell("SELECT COUNT(*) FROM user WHERE active = 1") || 0;

        const totalMonitors = await R.getCell("SELECT COUNT(*) FROM monitor") || 0;
        const healthyMonitors = await R.getCell("SELECT COUNT(*) FROM monitor WHERE active = 1") || 0;
        const totalDevices = await R.getCell("SELECT COUNT(*) FROM device") || 0;

        const activeSubscriptions = await R.getCell("SELECT COUNT(*) FROM saas_subscription WHERE status = 'active'") || 0;
        const trialSubscriptions = await R.getCell("SELECT COUNT(*) FROM saas_subscription WHERE status = 'trial'") || 0;
        const totalRevenue = await R.getCell("SELECT COALESCE(SUM(amount), 0) FROM saas_subscription WHERE status = 'active'") || 0;

        return {
            totalOrganizations,
            activeOrganizations,
            suspendedOrganizations,
            totalUsers,
            activeUsers,
            totalMonitors,
            healthyMonitors,
            totalDevices,
            activeSubscriptions,
            trialSubscriptions,
            mrr: totalRevenue,
            arr: totalRevenue * 12,
        };
    }

    /**
     * Get all organizations with tenant telemetry
     * @returns {Promise<Array>} List of organizations
     */
    static async getAllOrganizations() {
        const orgs = await R.getAll(
            `SELECT o.id, o.name, o.slug, COALESCE(o.status, 'active') as status,
                    COALESCE(o.plan, 'starter') as plan,
                    COALESCE(o.max_monitors, 10) as max_monitors,
                    COALESCE(o.max_devices, 10) as max_devices,
                    COALESCE(o.max_members, 5) as max_members,
                    o.created_at,
                    (SELECT COUNT(*) FROM organization_user ou WHERE ou.organization_id = o.id) as member_count,
                    (SELECT COUNT(*) FROM monitor m WHERE m.organization_id = o.id) as monitor_count,
                    (SELECT COUNT(*) FROM device d WHERE d.organization_id = o.id) as device_count,
                    (SELECT email FROM user u JOIN organization_user ou ON u.id = ou.user_id WHERE ou.organization_id = o.id AND ou.role = 'owner' LIMIT 1) as owner_email
             FROM organization o
             ORDER BY o.id ASC`
        );
        return orgs;
    }

    /**
     * Get detailed telemetry & subscription for a single organization
     * @param {number} orgId Organization ID
     * @returns {Promise<object>} Full org details
     */
    static async getOrganizationDetails(orgId) {
        await EntitlementService.initTables();
        const org = await R.getRow("SELECT * FROM organization WHERE id = ?", [ orgId ]);
        if (!org) {
            throw new Error("Organization not found.");
        }

        const members = await R.getAll(
            `SELECT ou.role, ou.status, u.username, u.email, u.id as user_id
             FROM organization_user ou
             JOIN user u ON ou.user_id = u.id
             WHERE ou.organization_id = ?`,
            [ orgId ]
        );

        const subscription = await R.getRow("SELECT * FROM saas_subscription WHERE organization_id = ?", [ orgId ]) || {
            plan_id: 1,
            status: "active",
            billing_cycle: "monthly",
            amount: 0,
            gateway: "manual",
        };

        const overrides = await R.getAll("SELECT * FROM organization_feature_override WHERE organization_id = ?", [ orgId ]);

        const usage = {
            monitors: await EntitlementService.getUsage(orgId, "monitors"),
            maxMonitors: await EntitlementService.getLimit(orgId, "maxMonitors"),
            devices: await EntitlementService.getUsage(orgId, "devices"),
            maxDevices: await EntitlementService.getLimit(orgId, "maxDevices"),
            members: await EntitlementService.getUsage(orgId, "members"),
            maxMembers: await EntitlementService.getLimit(orgId, "maxMembers"),
        };

        return {
            organization: org,
            members,
            subscription,
            overrides,
            usage,
        };
    }

    /**
     * Super Admin creates a new Organization with a dedicated Admin account
     * @param {number} superAdminUserId Super Admin User ID
     * @param {object} data { name, slug, plan, adminUsername, adminPassword, adminEmail }
     * @returns {Promise<object>} Created org info
     */
    static async createOrganizationWithAdmin(superAdminUserId, data) {
        const Organization = require("./organization.js");
        const passwordHash = require("../password-hash");

        await SuperAdmin.assertSuperAdmin(superAdminUserId);
        const { name, slug, plan, adminUsername, adminPassword, adminEmail } = data;

        if (!name || !slug || !adminUsername || !adminPassword) {
            throw new Error("Organization Name, Slug, Admin Username, and Admin Password are required.");
        }

        const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const existingOrg = await R.getRow("SELECT id FROM organization WHERE slug = ?", [ cleanSlug ]);
        if (existingOrg) {
            throw new Error(`An organization with slug '${cleanSlug}' already exists.`);
        }

        let adminUser = await R.getRow("SELECT id FROM user WHERE LOWER(username) = ?", [ String(adminUsername).toLowerCase() ]);
        let adminUserId;

        if (!adminUser) {
            const hashedPassword = await passwordHash.generate(adminPassword);

            // Ensure email column exists on user table in SQLite
            try {
                await R.exec("ALTER TABLE user ADD COLUMN email TEXT");
            } catch (e) {
                // Column already exists
            }

            const userBean = R.dispense("user");
            userBean.username = adminUsername;
            try {
                userBean.email = adminEmail || `${adminUsername}@company.com`;
            } catch (e) {}
            userBean.password = hashedPassword;
            userBean.active = 1;
            userBean.is_super_admin = 0;
            await R.store(userBean);
            adminUserId = userBean.id;
        } else {
            adminUserId = adminUser.id;
        }

        const org = await Organization.createOrganization(name, cleanSlug, adminUserId);

        if (plan && plan !== "starter") {
            await SuperAdmin.updateOrganizationPlan(org.id, plan);
        }

        // Initialize subscription record
        await R.exec(
            `INSERT INTO saas_subscription (organization_id, plan_id, status, billing_cycle, amount, gateway, created_at)
             VALUES (?, 1, 'active', 'monthly', 0, 'manual', DATETIME('now'))`,
            [ org.id ]
        );

        await Organization.logAudit(org.id, superAdminUserId, "organization_created_by_super_admin", {
            orgName: name,
            adminUsername,
            plan: plan || "starter",
        });

        return {
            organization: org,
            adminUserId,
            adminUsername,
        };
    }

    /**
     * Generate secure impersonation session for Super Admin
     * @param {number} superAdminUserId Super Admin User ID
     * @param {number} orgId Target Organization ID
     * @param {string} reason Impersonation reason
     * @param {string} ip Client IP Address
     * @returns {Promise<object>} Impersonation session token
     */
    static async impersonateOrganization(superAdminUserId, orgId, reason = "Administrative Troubleshooting", ip = "127.0.0.1") {
        await SuperAdmin.assertSuperAdmin(superAdminUserId);
        const Organization = require("./organization.js");

        const org = await R.getRow("SELECT id, name FROM organization WHERE id = ?", [ orgId ]);
        if (!org) {
            throw new Error("Target organization not found.");
        }

        await R.exec(
            `INSERT INTO super_admin_impersonation_log (admin_user_id, organization_id, reason, ip_address, started_at)
             VALUES (?, ?, ?, ?, DATETIME('now'))`,
            [ superAdminUserId, orgId, reason, ip ]
        );

        await Organization.logAudit(orgId, superAdminUserId, "superadmin_impersonation_started", { reason, ip });

        return {
            impersonating: true,
            orgId: org.id,
            orgName: org.name,
            reason,
        };
    }

    /**
     * Update an organization's SaaS plan and resource limits
     * @param {number} orgId Organization ID
     * @param {string} plan Plan name ('starter', 'pro', 'enterprise')
     * @param {object} customLimits Optional custom limits
     * @returns {Promise<void>}
     */
    static async updateOrganizationPlan(orgId, plan, customLimits = {}) {
        const validPlan = String(plan).toLowerCase();
        let maxMonitors = customLimits.maxMonitors || 10;
        let maxDevices = customLimits.maxDevices || 10;
        let maxMembers = customLimits.maxMembers || 5;

        if (validPlan === "pro") {
            maxMonitors = customLimits.maxMonitors || 50;
            maxDevices = customLimits.maxDevices || 50;
            maxMembers = customLimits.maxMembers || 20;
        } else if (validPlan === "enterprise") {
            maxMonitors = customLimits.maxMonitors || 500;
            maxDevices = customLimits.maxDevices || 500;
            maxMembers = customLimits.maxMembers || 100;
        }

        await R.exec(
            `UPDATE organization
             SET plan = ?, max_monitors = ?, max_devices = ?, max_members = ?, updated_at = DATETIME('now')
             WHERE id = ?`,
            [ validPlan, maxMonitors, maxDevices, maxMembers, orgId ]
        );
    }

    /**
     * Get all SaaS plans
     * @returns {Promise<Array>} List of plan objects
     */
    static async getPlans() {
        await EntitlementService.initTables();
        return await R.getAll("SELECT * FROM saas_plan ORDER BY id ASC");
    }

    /**
     * Save / Update a SaaS plan
     * @param {object} data Plan details
     * @returns {Promise<void>}
     */
    static async savePlan(data) {
        await EntitlementService.initTables();
        const { id, name, slug, description, priceMonthly, priceYearly, trialDays, status, featuresJson, limitsJson } = data;

        if (id) {
            await R.exec(
                `UPDATE saas_plan
                 SET name = ?, description = ?, price_monthly = ?, price_yearly = ?, trial_days = ?, status = ?, features_json = ?, limits_json = ?
                 WHERE id = ?`,
                [ name, description, priceMonthly || 0, priceYearly || 0, trialDays || 14, status, JSON.stringify(featuresJson || {}), JSON.stringify(limitsJson || {}), id ]
            );
        } else {
            await R.exec(
                `INSERT INTO saas_plan (name, slug, description, price_monthly, price_yearly, trial_days, status, is_public, features_json, limits_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, DATETIME('now'))`,
                [ name, slug, description, priceMonthly || 0, priceYearly || 0, trialDays || 14, status || 'active', JSON.stringify(featuresJson || {}), JSON.stringify(limitsJson || {}) ]
            );
        }
    }

    /**
     * Get system health & platform diagnostic telemetry
     * @returns {Promise<object>} Real platform telemetry
     */
    static async getSystemHealth() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUsagePercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);

        return {
            status: "HEALTHY",
            nodeVersion: process.version,
            platform: process.platform,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsagePercent,
            totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
            freeMemoryMB: Math.round(freeMemory / 1024 / 1024),
            databaseStatus: "CONNECTED",
            databaseType: "SQLite",
            cpuCores: os.cpus().length,
        };
    }

    /**
     * Get system-wide audit logs
     * @param {number} limit Maximum log entries
     * @returns {Promise<Array>} List of audit log entries
     */
    static async getSystemAuditLogs(limit = 100) {
        const logs = await R.getAll(
            `SELECT al.id, al.organization_id, al.user_id, al.event, al.details, al.created_at,
                    o.name as org_name, u.username
             FROM organization_audit_log al
             LEFT JOIN organization o ON al.organization_id = o.id
             LEFT JOIN user u ON al.user_id = u.id
             ORDER BY al.id DESC
             LIMIT ?`,
            [ limit ]
        );
        return logs;
    }

    /**
     * Get all SaaS coupons / promotional codes
     * @returns {Promise<Array>} List of coupon objects
     */
    static async getCoupons() {
        await EntitlementService.initTables();
        return await R.getAll("SELECT * FROM saas_coupon ORDER BY id DESC");
    }

    /**
     * Save / Create a promotional coupon
     * @param {object} data Coupon payload { code, discountType, value, maxUses }
     * @returns {Promise<void>}
     */
    static async saveCoupon(data) {
        await EntitlementService.initTables();
        const { code, discountType, value, maxUses } = data;
        const cleanCode = String(code).toUpperCase().trim();

        const existing = await R.getRow("SELECT id FROM saas_coupon WHERE code = ?", [ cleanCode ]);
        if (existing) {
            await R.exec(
                "UPDATE saas_coupon SET discount_type = ?, value = ?, max_uses = ? WHERE id = ?",
                [ discountType || "percentage", value || 10, maxUses || 100, existing.id ]
            );
        } else {
            await R.exec(
                `INSERT INTO saas_coupon (code, discount_type, value, max_uses, current_uses, is_active, created_at)
                 VALUES (?, ?, ?, ?, 0, 1, DATETIME('now'))`,
                [ cleanCode, discountType || "percentage", value || 10, maxUses || 100 ]
            );
        }
    }

    /**
     * Get payment gateway configurations (Razorpay, Cashfree, Stripe)
     * @returns {Promise<Array>} Gateway list
     */
    static async getPaymentGateways() {
        await EntitlementService.initTables();
        return await R.getAll("SELECT * FROM payment_gateway_config ORDER BY id ASC");
    }

    /**
     * Save payment gateway configuration
     * @param {object} data Gateway config
     * @returns {Promise<void>}
     */
    static async savePaymentGateway(data) {
        await EntitlementService.initTables();
        const { gatewayName, isEnabled, isTestMode, keyId, secretKey } = data;
        await R.exec(
            `UPDATE payment_gateway_config
             SET is_enabled = ?, is_test_mode = ?, key_id = ?, secret_key_encrypted = ?, updated_at = DATETIME('now')
             WHERE gateway_name = ?`,
            [ isEnabled ? 1 : 0, isTestMode ? 1 : 0, keyId || "", secretKey || "", gatewayName ]
        );
    }

    /**
     * Get system invoices with Indian GST details
     * @returns {Promise<Array>} List of invoices
     */
    static async getInvoices() {
        await EntitlementService.initTables();
        return await R.getAll(
            `SELECT i.*, o.name as org_name
             FROM saas_invoice i
             LEFT JOIN organization o ON i.organization_id = o.id
             ORDER BY i.id DESC`
        );
    }

    /**
     * Set a custom feature override for a specific organization
     * @param {number} orgId Organization ID
     * @param {string} featureKey Feature key
     * @param {number} enabled 1 or 0
     * @param {number} limitValue Limit value (-1 = unlimited)
     * @returns {Promise<void>}
     */
    static async setOrganizationFeatureOverride(orgId, featureKey, enabled, limitValue) {
        await EntitlementService.initTables();
        await R.exec(
            `INSERT INTO organization_feature_override (organization_id, feature_key, enabled, limit_value, created_at)
             VALUES (?, ?, ?, ?, DATETIME('now'))
             ON CONFLICT(organization_id, feature_key) DO UPDATE SET
             enabled = excluded.enabled, limit_value = excluded.limit_value`,
            [ orgId, featureKey, enabled ? 1 : 0, limitValue !== undefined ? limitValue : -1 ]
        );
    }

    /**
     * Get platform SMTP & Email dispatch configuration
     * @returns {Promise<object>} SMTP configuration
     */
    static async getSmtpSettings() {
        const Setting = require("./setting");
        return {
            host: await Setting.get("smtp_host") || "smtp.infiniforge.com",
            port: await Setting.get("smtp_port") || 587,
            secure: await Setting.get("smtp_secure") || false,
            username: await Setting.get("smtp_username") || "notifications@infiniforge.com",
            senderName: await Setting.get("smtp_sender_name") || "InfiniNOC Alerts",
        };
    }

    /**
     * Save platform SMTP & Email settings
     * @param {object} data SMTP settings payload
     * @returns {Promise<void>}
     */
    static async saveSmtpSettings(data) {
        const Setting = require("./setting");
        const { host, port, secure, username, password, senderName } = data;
        await Setting.set("smtp_host", host);
        await Setting.set("smtp_port", port);
        await Setting.set("smtp_secure", secure);
        await Setting.set("smtp_username", username);
        if (password) {
            await Setting.set("smtp_password", password);
        }
        await Setting.set("smtp_sender_name", senderName);
    }

    /**
     * Get global SaaS platform settings
     * @returns {Promise<object>} Platform settings
     */
    static async getPlatformSettings() {
        const Setting = require("./setting");
        return {
            maintenanceMode: Boolean(await Setting.get("saas_maintenance_mode")),
            allowSelfSignup: (await Setting.get("saas_allow_signup")) !== "0",
            defaultTrialDays: parseInt(await Setting.get("saas_trial_days") || "14"),
            maintenanceMessage: await Setting.get("saas_maintenance_msg") || "Scheduled NOC maintenance in progress.",
        };
    }

    /**
     * Save global SaaS platform settings
     * @param {object} data Platform settings payload
     * @returns {Promise<void>}
     */
    static async savePlatformSettings(data) {
        const Setting = require("./setting");
        const { maintenanceMode, allowSelfSignup, defaultTrialDays, maintenanceMessage } = data;
        await Setting.set("saas_maintenance_mode", maintenanceMode ? "1" : "0");
        await Setting.set("saas_allow_signup", allowSelfSignup ? "1" : "0");
        await Setting.set("saas_trial_days", String(defaultTrialDays || 14));
        await Setting.set("saas_maintenance_msg", maintenanceMessage || "");
    }
}

module.exports = SuperAdmin;
