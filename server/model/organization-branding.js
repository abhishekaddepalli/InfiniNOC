const { R } = require("redbean-node");

class OrganizationBranding {
    /**
     * Validate hex color string format e.g. #f59e0b or #0284c7
     * @param {string} color Hex color string
     * @returns {boolean} Valid boolean
     */
    static isValidHexColor(color) {
        if (!color || typeof color !== "string") {
            return false;
        }
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
    }

    /**
     * Sanitize string payload to prevent XSS or unsafe code injection
     * @param {string} str Raw string
     * @returns {string} Sanitized string
     */
    static sanitizeString(str) {
        if (!str || typeof str !== "string") {
            return "";
        }
        return str.replace(/<[^>]*>/g, "").trim();
    }

    /**
     * Get organization branding record or return default
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Branding record
     */
    static async getBranding(organizationId) {
        const orgId = organizationId || 1;
        let branding = await R.getRow("SELECT * FROM organization_branding WHERE organization_id = ?", [orgId]);

        if (!branding) {
            const org = await R.getRow("SELECT * FROM organization WHERE id = ?", [orgId]);
            const compName = org ? org.name : "InfiniNOC Platform";
            const isoNow = new Date().toISOString();

            await R.exec(
                `INSERT INTO organization_branding (
                    organization_id, company_name, primary_color, secondary_color, login_title, login_subtitle, status_page_title, status_page_footer, created_at, updated_at
                ) VALUES (?, ?, '#f59e0b', '#0284c7', 'InfiniNOC Operations Center', 'Secure High-Availability Portal', 'System Operational Status', 'Powered by InfiniNOC Monitoring Engine', ?, ?)`,
                [orgId, compName, isoNow, isoNow]
            );
            branding = await R.getRow("SELECT * FROM organization_branding WHERE organization_id = ?", [orgId]);
        }

        return branding;
    }

    /**
     * Save organization branding with strict color validation and sanitization
     * @param {object} data Branding payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated branding record
     */
    static async saveBranding(data, organizationId) {
        const orgId = organizationId || 1;
        if (!data) {
            throw new Error("Branding payload required.");
        }

        const primaryColor = data.primaryColor || "#f59e0b";
        const secondaryColor = data.secondaryColor || "#0284c7";

        if (!OrganizationBranding.isValidHexColor(primaryColor)) {
            throw new Error("Invalid primary color hex code.");
        }
        if (!OrganizationBranding.isValidHexColor(secondaryColor)) {
            throw new Error("Invalid secondary color hex code.");
        }

        const companyName = OrganizationBranding.sanitizeString(data.companyName || "InfiniNOC Platform");
        const loginTitle = OrganizationBranding.sanitizeString(data.loginTitle || "InfiniNOC Operations Center");
        const loginSubtitle = OrganizationBranding.sanitizeString(data.loginSubtitle || "Secure Portal");
        const emailHeader = OrganizationBranding.sanitizeString(data.emailHeaderText || "InfiniNOC Telemetry");
        const emailFooter = OrganizationBranding.sanitizeString(data.emailFooterText || "Confidential NOC");
        const statusTitle = OrganizationBranding.sanitizeString(data.statusPageTitle || "System Status");
        const statusFooter = OrganizationBranding.sanitizeString(data.statusPageFooter || "Powered by InfiniNOC Monitoring Engine");

        // Retain mandatory attribution text
        const mandatoryStatusFooter = statusFooter.includes("InfiniNOC") ? statusFooter : `${statusFooter} — Powered by InfiniNOC`;

        const customDomain = OrganizationBranding.sanitizeString(data.customDomain || "");
        const customStatusDomain = OrganizationBranding.sanitizeString(data.customStatusDomain || "");

        const existing = await OrganizationBranding.getBranding(orgId);
        const isoNow = new Date().toISOString();

        await R.exec(
            `UPDATE organization_branding SET
                company_name = ?,
                logo_url = ?,
                favicon_url = ?,
                primary_color = ?,
                secondary_color = ?,
                login_title = ?,
                login_subtitle = ?,
                email_header_text = ?,
                email_footer_text = ?,
                status_page_title = ?,
                status_page_footer = ?,
                custom_domain = ?,
                custom_status_domain = ?,
                updated_at = ?
             WHERE id = ? AND organization_id = ?`,
            [
                companyName,
                data.logoUrl || null,
                data.faviconUrl || null,
                primaryColor,
                secondaryColor,
                loginTitle,
                loginSubtitle,
                emailHeader,
                emailFooter,
                statusTitle,
                mandatoryStatusFooter,
                customDomain || null,
                customStatusDomain || null,
                isoNow,
                existing.id,
                orgId,
            ]
        );

        return OrganizationBranding.getBranding(orgId);
    }

    /**
     * Get safe CSS theme tokens map for client styling custom properties
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} CSS variables map
     */
    static async getThemeTokens(organizationId) {
        const branding = await OrganizationBranding.getBranding(organizationId);
        return {
            "--noc-brand-primary": branding.primary_color || "#f59e0b",
            "--noc-brand-secondary": branding.secondary_color || "#0284c7",
            "--noc-company-name": `"${branding.company_name}"`,
        };
    }

    /**
     * Resolve organization branding by custom domain hostname
     * @param {string} hostname Request hostname
     * @returns {Promise<object|null>} Resolved branding or null
     */
    static async resolveBrandingByDomain(hostname) {
        if (!hostname) {
            return null;
        }
        const host = hostname.toLowerCase().trim();
        const branding = await R.getRow(
            "SELECT * FROM organization_branding WHERE LOWER(custom_domain) = ? OR LOWER(custom_status_domain) = ?",
            [host, host]
        );
        return branding || null;
    }
}

module.exports = OrganizationBranding;
