const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Organization White Labeling & Branding Tenant Isolation Test Suite", () => {
    let Organization;
    let OrganizationBranding;
    let orgA;
    let orgB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-branding.db");
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
        OrganizationBranding = require("../../server/model/organization-branding.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('brand_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'brand_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('brand_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'brand_user_b'");

        orgA = await Organization.createOrganization("Org Brand Alpha", "org-brand-alpha", userAId);
        orgB = await Organization.createOrganization("Org Brand Beta", "org-brand-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should validate hex color formats and reject malicious CSS or script injection payloads", () => {
        assert.strictEqual(OrganizationBranding.isValidHexColor("#f59e0b"), true);
        assert.strictEqual(OrganizationBranding.isValidHexColor("#0284c7"), true);
        assert.strictEqual(OrganizationBranding.isValidHexColor("#fff"), true);

        assert.strictEqual(OrganizationBranding.isValidHexColor("<script>alert(1)</script>"), false);
        assert.strictEqual(OrganizationBranding.isValidHexColor("javascript:alert(1)"), false);
        assert.strictEqual(OrganizationBranding.isValidHexColor("expression(alert(1))"), false);
        assert.strictEqual(OrganizationBranding.isValidHexColor("red; background: url(x)"), false);
    });

    it("should save and retrieve custom branding settings for Org A", async () => {
        const payloadA = {
            companyName: "Alpha Telecom Networks",
            logoUrl: "https://alpha.com/logo.png",
            primaryColor: "#10b981",
            secondaryColor: "#6366f1",
            loginTitle: "Alpha NOC Operations Center",
            customDomain: "noc.alpha.com",
            customStatusDomain: "status.alpha.com",
        };

        const updatedA = await OrganizationBranding.saveBranding(payloadA, orgA.id);
        assert.strictEqual(updatedA.company_name, "Alpha Telecom Networks");
        assert.strictEqual(updatedA.primary_color, "#10b981");
        assert.strictEqual(updatedA.custom_domain, "noc.alpha.com");
        assert.ok(updatedA.status_page_footer.includes("InfiniNOC"));
    });

    it("should generate safe CSS theme tokens map for client styling", async () => {
        const tokens = await OrganizationBranding.getThemeTokens(orgA.id);
        assert.strictEqual(tokens["--noc-brand-primary"], "#10b981");
        assert.strictEqual(tokens["--noc-brand-secondary"], "#6366f1");
        assert.strictEqual(tokens["--noc-company-name"], '"Alpha Telecom Networks"');
    });

    it("should resolve organization branding by custom domain hostname stubs", async () => {
        const resolved = await OrganizationBranding.resolveBrandingByDomain("status.alpha.com");
        assert.ok(resolved);
        assert.strictEqual(resolved.organization_id, orgA.id);
        assert.strictEqual(resolved.company_name, "Alpha Telecom Networks");

        const nonExistent = await OrganizationBranding.resolveBrandingByDomain("unknown.com");
        assert.strictEqual(nonExistent, null);
    });

    it("should enforce tenant isolation so Org A cannot query or alter Org B branding settings", async () => {
        const payloadB = {
            companyName: "Beta Fiber NOC",
            primaryColor: "#ef4444",
            secondaryColor: "#3b82f6",
        };

        await OrganizationBranding.saveBranding(payloadB, orgB.id);

        const brandingA = await OrganizationBranding.getBranding(orgA.id);
        const brandingB = await OrganizationBranding.getBranding(orgB.id);

        assert.notStrictEqual(brandingA.company_name, brandingB.company_name);
        assert.strictEqual(brandingA.company_name, "Alpha Telecom Networks");
        assert.strictEqual(brandingB.company_name, "Beta Fiber NOC");
    });
});
