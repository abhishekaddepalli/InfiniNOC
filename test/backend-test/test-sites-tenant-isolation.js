const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Sites Tenant Isolation Security Test Suite", () => {
    let Organization;
    let Site;
    let orgA;
    let orgB;
    let userAId;
    let userBId;
    let siteA;
    let siteB;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-sites.db");
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
        Site = require("../../server/model/site.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('site_user_a', 'pass_a', 1)");
        userAId = await R.getCell("SELECT id FROM user WHERE username = 'site_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('site_user_b', 'pass_b', 1)");
        userBId = await R.getCell("SELECT id FROM user WHERE username = 'site_user_b'");

        orgA = await Organization.createOrganization("Org Site Alpha", "org-site-alpha", userAId);
        orgB = await Organization.createOrganization("Org Site Beta", "org-site-beta", userBId);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should create site A in Org A and site B in Org B", async () => {
        siteA = await Site.createSite(
            { name: "Vijayawada POP", code: "VJA-POP-01", description: "VJA Data Center", status: "Operational" },
            orgA.id
        );
        assert.ok(siteA.id);
        assert.strictEqual(siteA.name, "Vijayawada POP");
        assert.strictEqual(siteA.code, "VJA-POP-01");
        assert.strictEqual(siteA.organization_id, orgA.id);

        siteB = await Site.createSite(
            { name: "Kakinada POP", code: "KKD-POP-01", description: "KKD Edge POP", status: "Operational" },
            orgB.id
        );
        assert.ok(siteB.id);
        assert.strictEqual(siteB.name, "Kakinada POP");
        assert.strictEqual(siteB.organization_id, orgB.id);
    });

    it("should isolate getSiteList so Org A cannot view Org B sites", async () => {
        const sitesForOrgA = await Site.getSiteList(orgA.id);
        assert.strictEqual(sitesForOrgA.length, 1);
        assert.strictEqual(sitesForOrgA[0].name, "Vijayawada POP");

        const sitesForOrgB = await Site.getSiteList(orgB.id);
        assert.strictEqual(sitesForOrgB.length, 1);
        assert.strictEqual(sitesForOrgB[0].name, "Kakinada POP");
    });

    it("should prevent Org A from retrieving site B directly", async () => {
        await assert.rejects(
            async () => {
                await Site.getSite(siteB.id, orgA.id);
            },
            { message: "Site not found or access denied." }
        );
    });

    it("should prevent Org A from modifying site B", async () => {
        await assert.rejects(
            async () => {
                await Site.updateSite(siteB.id, { name: "Hacked Site Name" }, orgA.id);
            },
            { message: "Site not found or access denied." }
        );
    });

    it("should prevent Org A from deleting site B", async () => {
        await assert.rejects(
            async () => {
                await Site.deleteSite(siteB.id, orgA.id);
            },
            { message: "Site not found or access denied." }
        );
    });

    it("should add devices and monitors to site A and compute site health telemetry correctly", async () => {
        // Add 2 devices to site A: 1 online, 1 offline
        await Site.addDevice(siteA.id, { device_name: "Core Router 01", device_type: "Router", ip_address: "10.0.0.1", status: "online" }, orgA.id);
        await Site.addDevice(siteA.id, { device_name: "Access Switch 02", device_type: "Switch", ip_address: "10.0.0.2", status: "offline" }, orgA.id);

        const updatedSiteA = await Site.getSite(siteA.id, orgA.id);
        assert.strictEqual(updatedSiteA.devices.length, 2);
        assert.strictEqual(updatedSiteA.health.totalDevices, 2);
        assert.strictEqual(updatedSiteA.health.onlineDevices, 1);
        assert.strictEqual(updatedSiteA.health.offlineDevices, 1);
        assert.strictEqual(updatedSiteA.health.activeIncidents, 1);
        assert.strictEqual(updatedSiteA.health.uptime, 50);
    });
});
