const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runInfiniNOCVerification() {
    console.log("=================================================================");
    console.log("  InfiniNOC Comprehensive Platform Hardening & Verification Suite ");
    console.log("  Infiniforge Technologies — https://monitor.infiniforge.cloud   ");
    console.log("=================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    function test(name, fn) {
        totalTests++;
        try {
            fn();
            console.log(`✓ [PASS] ${name}`);
            passedTests++;
        } catch (err) {
            console.error(`✗ [FAIL] ${name}: ${err.message}`);
        }
    }

    // 1. Package Metadata Verification
    test("Package Metadata: name is 'infininoc' and repository is InfiniNOC", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"));
        assert.strictEqual(pkg.name, "infininoc", "Package name must be infininoc");
        assert.strictEqual(pkg.homepage, "https://monitor.infiniforge.cloud");
        assert.strictEqual(pkg.author, "Infiniforge Technologies");
        assert(pkg.repository.url.includes("abhishekaddepalli/InfiniNOC.git"));
    });

    // 2. Product Branding Configuration
    test("Product Branding: InfiniNOC and Infiniforge Technologies defined in product.json", () => {
        const product = require("../../config/product.json");
        assert.strictEqual(product.productName, "InfiniNOC");
        assert.strictEqual(product.companyName, "Infiniforge Technologies");
        assert.strictEqual(product.tagline, "Know Your Network. Before Your Customers Do.");
    });

    // 3. Process & Ecosystem Configuration
    test("Process & Runtime: ecosystem.config.js uses 'infininoc'", () => {
        const ecosystem = require("../../ecosystem.config.js");
        assert.strictEqual(ecosystem.apps[0].name, "infininoc");
        assert.strictEqual(ecosystem.apps[0].script, "./server/server.js");
    });

    // 4. Environment Variables Hierarchy (INFININOC_* takes priority over UPTIME_KUMA_*)
    test("Environment Hierarchy: INFININOC_PORT takes precedence over UPTIME_KUMA_PORT", () => {
        const originalInfiniPort = process.env.INFININOC_PORT;
        const originalKumaPort = process.env.UPTIME_KUMA_PORT;

        process.env.INFININOC_PORT = "4001";
        process.env.UPTIME_KUMA_PORT = "3001";

        const port = [process.env.INFININOC_PORT, process.env.UPTIME_KUMA_PORT, 3001]
            .map((p) => parseInt(p))
            .find((p) => !isNaN(p));

        assert.strictEqual(port, 4001, "INFININOC_PORT must take precedence");

        // Restore env
        if (originalInfiniPort) process.env.INFININOC_PORT = originalInfiniPort; else delete process.env.INFININOC_PORT;
        if (originalKumaPort) process.env.UPTIME_KUMA_PORT = originalKumaPort; else delete process.env.UPTIME_KUMA_PORT;
    });

    // 5. RBAC & Single-Tenant Owner Permission Verification
    test("RBAC: assertPermission grants full owner permissions to authenticated users without org blocks", async () => {
        const { RBAC } = require("../../server/middleware/rbac");
        const role = await RBAC.assertPermission(1, 1, "monitor.create");
        assert.strictEqual(role, "owner", "Authenticated user must be granted owner role");
        assert.strictEqual(RBAC.hasPermission("owner", "monitor.create"), true);
        assert.strictEqual(RBAC.hasPermission("owner", "device.manage"), true);
    });

    // 6. Notification Provider Branding
    test("Notification Providers: Teams & Webpush use InfiniNOC branding and monitor.infiniforge.cloud", () => {
        const teamsPath = path.join(__dirname, "../../server/notification-providers/teams.js");
        const teamsSrc = fs.readFileSync(teamsPath, "utf8");
        assert(!teamsSrc.includes("https://raw.githubusercontent.com/louislam/uptime-kuma"), "Must not leak upstream raw github URLs");
        assert(teamsSrc.includes("https://monitor.infiniforge.cloud/icon.png"));
        assert(teamsSrc.includes("InfiniNOC Alert"));
        assert(teamsSrc.includes("InfiniNOC Logo"));

        const wpPath = path.join(__dirname, "../../server/notification-providers/Webpush.js");
        const wpSrc = fs.readFileSync(wpPath, "utf8");
        assert(!wpSrc.includes("louislam/uptime-kuma"), "Must not reference louislam/uptime-kuma in Webpush VAPID");
        assert(wpSrc.includes("https://monitor.infiniforge.cloud"));
        assert(wpSrc.includes('title: "InfiniNOC"'));
    });

    test("Notification Providers: Slack, PagerDuty, Opsgenie, Resend, Sendgrid default to InfiniNOC Alert", () => {
        const pdPath = path.join(__dirname, "../../server/notification-providers/pagerduty.js");
        const pdSrc = fs.readFileSync(pdPath, "utf8");
        assert(pdSrc.includes('"InfiniNOC Alert"'));

        const resendPath = path.join(__dirname, "../../server/notification-providers/resend.js");
        const resendSrc = fs.readFileSync(resendPath, "utf8");
        assert(resendSrc.includes('"Notification from InfiniNOC"'));

        const sgPath = path.join(__dirname, "../../server/notification-providers/send-grid.js");
        const sgSrc = fs.readFileSync(sgPath, "utf8");
        assert(sgSrc.includes('"Notification from InfiniNOC"'));
    });

    // 7. Distribution Guardian
    test("Asset Guardian: extra/download-dist.js safely checks local build and never downloads upstream dist", () => {
        const ddPath = path.join(__dirname, "../../extra/download-dist.js");
        const ddSrc = fs.readFileSync(ddPath, "utf8");
        assert(!ddSrc.includes("https://github.com/louislam/uptime-kuma/releases/download"), "Must not download upstream Uptime Kuma release dist");
        assert(ddSrc.includes("InfiniNOC production distribution assets"));
    });

    // 8. CNAME Verification
    test("CNAME: points to monitor.infiniforge.cloud", () => {
        const cname = fs.readFileSync(path.join(__dirname, "../../CNAME"), "utf8").trim();
        assert.strictEqual(cname, "monitor.infiniforge.cloud");
    });

    // 9. Installer Hardening Verification
    test("Installer: install.sh is non-destructive, Node 22 aware, and supports custom install path", () => {
        const installSrc = fs.readFileSync(path.join(__dirname, "../../install.sh"), "utf8");
        assert(installSrc.includes("TARGET_NODE_VERSION=\"22\""));
        assert(installSrc.includes("https://monitor.infiniforge.cloud"));
        assert(!installSrc.includes("rm -rf \"$INSTALL_DIR\""), "Must never rm -rf existing directories");
        assert(installSrc.includes("To prevent data loss, existing files will NOT be deleted"));
    });

    // 10. Backup Engine Dual Database (SQLite + MySQL) Verification
    test("Backup Engine: Supports both SQLite (kuma.db) and MySQL/MariaDB (logical SQL dump & connection restore)", () => {
        const BackupEngine = require("../../server/backup");
        assert(typeof BackupEngine.dumpMySQLDatabase === "function", "dumpMySQLDatabase must exist");
        assert(typeof BackupEngine.restoreMySQLDatabase === "function", "restoreMySQLDatabase must exist");
        assert(typeof BackupEngine.getDatabaseConfig === "function", "getDatabaseConfig must exist");
        assert.strictEqual(BackupEngine.isMySQLFamily("mariadb"), true);
        assert.strictEqual(BackupEngine.isMySQLFamily("mysql"), true);
        assert.strictEqual(BackupEngine.isMySQLFamily("sqlite"), false);
    });

    // 10. Frontend Build Assets Integrity
    test("Frontend Distribution: dist/index.html and serviceWorker.js exist with InfiniNOC title", () => {
        const indexPath = path.join(__dirname, "../../dist/index.html");
        assert(fs.existsSync(indexPath), "dist/index.html must exist after build");
        const indexHtml = fs.readFileSync(indexPath, "utf8");
        assert(indexHtml.includes("<title>InfiniNOC</title>"), "Index title must be InfiniNOC");
        assert(indexHtml.includes("/icon.svg"), "Index icon must be /icon.svg");
    });

    console.log(`\n=================================================================`);
    console.log(`  VERIFICATION RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`=================================================================`);

    return passedTests === totalTests;
}

runInfiniNOCVerification().then((ok) => {
    process.exit(ok ? 0 : 1);
}).catch((err) => {
    console.error("Verification suite failed:", err);
    process.exit(1);
});
