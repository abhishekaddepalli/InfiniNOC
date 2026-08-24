const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Enterprise SLA & Availability Reporting Test Suite", () => {
    let Organization;
    let SlaReporting;
    let orgA;
    let orgB;
    let reportA;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-sla.db");
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
        SlaReporting = require("../../server/model/sla-reporting.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('sla_user_a', 'pass_a', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'sla_user_a'");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('sla_user_b', 'pass_b', 1)");
        const userBId = await R.getCell("SELECT id FROM user WHERE username = 'sla_user_b'");

        orgA = await Organization.createOrganization("Org SLA Alpha", "org-sla-alpha", userAId);
        orgB = await Organization.createOrganization("Org SLA Beta", "org-sla-beta", userBId);

        // Populate authentic heartbeat telemetry
        const isoNow = new Date().toISOString();
        await R.exec("INSERT INTO monitor (name, type, url, active) VALUES ('HTTP Core', 'http', 'https://core.net', 1)");
        const monId = await R.getCell("SELECT last_insert_rowid()");

        for (let i = 0; i < 90; i++) {
            await R.exec("INSERT INTO heartbeat (monitor_id, status, msg, time, ping) VALUES (?, 1, 'OK', ?, 12.5)", [monId, isoNow]);
        }
        for (let i = 0; i < 10; i++) {
            await R.exec("INSERT INTO heartbeat (monitor_id, status, msg, time, ping) VALUES (?, 0, 'Down', ?, 0.0)", [monId, isoNow]);
        }

        // Populate authentic incidents
        const createdTime = new Date(Date.now() - 3600 * 1000).toISOString();
        const resolvedTime = new Date().toISOString();
        await R.exec(
            `INSERT INTO incident (
                organization_id, title, description, content, severity, status, created_at, resolved_at
            ) VALUES (?, 'Core BGP Outage', 'P1 BGP route flap', 'P1 BGP route flap', 'P1', 'RESOLVED', ?, ?)`,
            [orgA.id, createdTime, resolvedTime]
        );

        await R.exec(
            `INSERT INTO incident (
                organization_id, title, description, content, severity, status, created_at, resolved_at
            ) VALUES (?, 'Agg Switch Warning', 'P2 Link error', 'P2 Link error', 'P2', 'RESOLVED', ?, ?)`,
            [orgA.id, createdTime, resolvedTime]
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    it("should calculate real Availability %, Downtime, MTTR, and Incident counts from database records", async () => {
        reportA = await SlaReporting.generateSlaReport({ name: "Monthly SLA Audit", timeRange: "30d" }, orgA.id);

        assert.ok(reportA.report.id);
        assert.strictEqual(reportA.report.status, "COMPLETED");

        const summary = reportA.summary;
        assert.ok(summary.availabilityPct > 0 && summary.availabilityPct <= 100);
        assert.strictEqual(summary.incidentCount, 2);
        assert.strictEqual(summary.p1Count, 1);
        assert.strictEqual(summary.p2Count, 1);
        assert.ok(summary.formattedDowntime.includes("m"));
        assert.ok(summary.formattedMttr.includes("m"));
    });

    it("should support 24h, 7d, 30d, and custom time range window calculations", async () => {
        const window24h = SlaReporting.calculateRangeWindow("24h");
        const window7d = SlaReporting.calculateRangeWindow("7d");
        const window30d = SlaReporting.calculateRangeWindow("30d");
        const windowCustom = SlaReporting.calculateRangeWindow("custom", "2026-08-01", "2026-08-15");

        assert.strictEqual(window24h.rangeLabel, "Last 24 Hours");
        assert.strictEqual(window7d.rangeLabel, "Last 7 Days");
        assert.strictEqual(window30d.rangeLabel, "Last 30 Days");
        assert.ok(windowCustom.rangeLabel.includes("2026"));
    });

    it("should export RFC 4180 compliant CSV strings containing executive summary and entity breakdown", async () => {
        const csv = await SlaReporting.exportCsv(reportA.report.id, orgA.id);
        assert.ok(csv.includes("InfiniNOC Enterprise SLA & Availability Report"));
        assert.ok(csv.includes("Network Availability (%)"));
        assert.ok(csv.includes("Total Downtime"));
        assert.ok(csv.includes("MTTR (Mean Time To Resolve)"));
        assert.ok(csv.includes("P1 Incidents"));
    });

    it("should generate styled HTML printable PDF template report", async () => {
        const html = await SlaReporting.exportPdfHtml(reportA.report.id, orgA.id);
        assert.ok(html.includes("<!DOCTYPE html>"));
        assert.ok(html.includes("InfiniNOC Enterprise SLA & Availability Report"));
        assert.ok(html.includes("Network Availability"));
        assert.ok(html.includes("Mean Time To Resolve"));
    });

    it("should transition report status from GENERATING to COMPLETED asynchronously", async () => {
        const reports = await SlaReporting.getReportsList(orgA.id);
        assert.ok(reports.length > 0);
        assert.strictEqual(reports[0].status, "COMPLETED");
    });

    it("should enforce tenant isolation so Org A cannot query, details, or export Org B SLA reports", async () => {
        const reportB = await SlaReporting.generateSlaReport({ name: "Org B Report", timeRange: "7d" }, orgB.id);

        const listOrgA = await SlaReporting.getReportsList(orgA.id);
        const found = listOrgA.find((r) => r.id === reportB.report.id);
        assert.strictEqual(found, undefined);

        await assert.rejects(
            async () => {
                await SlaReporting.getReportDetails(reportB.report.id, orgA.id);
            },
            { message: "SLA Report not found." }
        );
    });
});
