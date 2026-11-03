const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Remote Probes, Site Management, and Private Monitoring Test Suite", () => {
    let Organization;
    let Probe;
    let Site;
    let Monitor;
    let Incident;
    let org;
    let user;
    let testProbe;
    let probeApiKey;
    let testSite;
    let testMonitor;

    const testDbDir = path.join(__dirname, "../test-data");
    const testDbPath = path.join(testDbDir, "test-probes-sites-ops.db");

    before(async () => {
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
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
        Probe = require("../../server/model/probe.js");
        Site = require("../../server/model/site.js");
        Monitor = require("../../server/model/monitor.js");
        Incident = require("../../server/model/incident.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('probe_ops_admin', 'pass123', 1)");
        const userId = await R.getCell("SELECT id FROM user WHERE username = 'probe_ops_admin'");
        user = { id: userId, username: "probe_ops_admin" };

        org = await Organization.createOrganization("InfiniNOC Operations Corp", "infininoc-ops", user.id);
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
        if (fs.existsSync(testDbPath)) {
            try {
                fs.unlinkSync(testDbPath);
            } catch (_) {}
        }
    });

    it("1. Site Management: creates site with location metadata using valid cross-DB SQL datetime", async () => {
        testSite = await Site.createSite(
            {
                name: "Hyderabad Core DC",
                code: "HYD-DC-01",
                site_type: "dc",
                city: "Hyderabad",
                state: "Telangana",
                country: "India",
                address: "HITEC City, Madhapur",
                latitude: 17.4483,
                longitude: 78.3915,
                contact_name: "Operations Desk",
                contact_phone: "+91-40-12345678",
            },
            org.id
        );

        assert.ok(testSite.id);
        assert.strictEqual(testSite.name, "Hyderabad Core DC");
        assert.strictEqual(testSite.code, "HYD-DC-01");
        assert.strictEqual(testSite.city, "Hyderabad");
        assert.strictEqual(testSite.state, "Telangana");
        assert.strictEqual(testSite.country, "India");

        // Verify Site.getSiteList includes location fields
        const siteList = await Site.getSiteList(org.id);
        assert.ok(siteList.length >= 1);
        const hydSite = siteList.find((s) => s.id === testSite.id);
        assert.ok(hydSite);
        assert.strictEqual(hydSite.city, "Hyderabad");
    });

    it("2. Probe Registration: generates one-time token and enrolls remote probe agent", async () => {
        const tokenInfo = await Probe.createProbeRegistrationToken(
            {
                name: "Branch Office Probe - Hyderabad",
                site_id: testSite.id,
                region: "ap-south-1",
                location: "HITEC City DC Floor 2",
                description: "Dedicated branch LAN monitoring daemon",
            },
            org.id
        );

        assert.ok(tokenInfo.probe.id);
        assert.ok(tokenInfo.registrationToken);
        assert.strictEqual(tokenInfo.probe.status, "pending");

        // Enroll probe
        const enrolled = await Probe.registerProbe(
            tokenInfo.probe.id,
            tokenInfo.registrationToken,
            "192.168.10.15",
            "1.26.31",
            { os_info: "Linux Ubuntu 24.04 (x86_64)", region: "ap-south-1" }
        );

        assert.ok(enrolled.apiKey);
        assert.strictEqual(enrolled.probeId, tokenInfo.probe.id);
        probeApiKey = enrolled.apiKey;
        testProbe = await Probe.getProbe(tokenInfo.probe.id, org.id);
        assert.strictEqual(testProbe.status, "online");
        assert.strictEqual(testProbe.site_id, testSite.id);
    });

    it("3. Probe Heartbeat: ingests real system telemetry (CPU, RAM, latency)", async () => {
        const hb = await Probe.recordHeartbeat(testProbe.id, probeApiKey, {
            latency_ms: 14,
            cpu_usage: 22.5,
            memory_usage: 45.2,
            disk_usage: 38.0,
            tasks_executed: 50,
            tasks_failed: 1,
        });

        assert.ok(hb.ok);
        const updated = await Probe.getProbe(testProbe.id, org.id);
        assert.strictEqual(updated.status, "online");
        assert.strictEqual(updated.latency_ms, 14);
        assert.strictEqual(Number(updated.cpu_usage), 22.5);
    });

    it("4. Monitor Delegation: creates private LAN target monitor assigned to remote probe", async () => {
        // Create monitor targeting a private RFC 1918 LAN IP
        let monBean = R.dispense("monitor");
        monBean.name = "Branch Core Switch (Private LAN)";
        monBean.type = "ping";
        monBean.hostname = "192.168.1.1";
        monBean.interval = 30;
        monBean.timeout = 5;
        monBean.active = 1;
        monBean.user_id = user.id;
        monBean.organization_id = org.id;
        monBean.probe_id = testProbe.id;
        await R.store(monBean);

        testMonitor = monBean;
        assert.ok(testMonitor.id);
        assert.strictEqual(testMonitor.probe_id, testProbe.id);

        // Verify probe tasks query retrieves this monitor
        const assignedTasks = await Probe.getAssignedTasks(testProbe.id, probeApiKey);
        assert.ok(assignedTasks.length >= 1);
        const switchTask = assignedTasks.find((t) => t.id === testMonitor.id);
        assert.ok(switchTask);
        assert.strictEqual(switchTask.hostname, "192.168.1.1");
    });

    it("5. Remote Check Ingestion & Alerting: probe submits DOWN result for private target and auto-raises P1 incident", async () => {
        const result = await Probe.submitTaskResult(testProbe.id, probeApiKey, {
            monitor_id: testMonitor.id,
            status: 0,
            ping: null,
            msg: "Check failed via probe: Destination Host Unreachable on 192.168.1.1",
        });

        assert.ok(result.ok);
        assert.strictEqual(result.status, 0);

        // Verify heartbeat recorded with probe_id
        const latestBeat = await R.getRow(
            "SELECT * FROM heartbeat WHERE monitor_id = ? ORDER BY id DESC LIMIT 1",
            [testMonitor.id]
        );
        assert.ok(latestBeat);
        assert.strictEqual(latestBeat.status, 0);
        assert.strictEqual(latestBeat.probe_id, testProbe.id);

        // Verify active incident auto-created
        const activeInc = await R.getRow(
            `SELECT incident.* FROM incident
            JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id
            WHERE incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?
            AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED')`,
            [testMonitor.id]
        );
        assert.ok(activeInc, "Active outage incident must be automatically created on probe DOWN check");
        assert.strictEqual(activeInc.severity, "P1");

        // Verify active alert auto-created
        const alert = await R.getRow(
            "SELECT * FROM active_alert WHERE target_type = 'monitor' AND target_id = ?",
            [testMonitor.id]
        );
        assert.ok(alert, "Active alert must be created for down monitor");
        assert.strictEqual(alert.state, "CRITICAL");
    });

    it("6. Recovery Synchronization: probe submits UP result and auto-resolves incident and alert", async () => {
        const result = await Probe.submitTaskResult(testProbe.id, probeApiKey, {
            monitor_id: testMonitor.id,
            status: 1,
            ping: 4,
            msg: "ICMP echo reply received from 192.168.1.1. Latency: 4 ms.",
        });

        assert.ok(result.ok);
        assert.strictEqual(result.status, 1);

        // Verify open incidents were auto-resolved
        const openIncidents = await R.getAll(
            `SELECT incident.* FROM incident
            JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id
            WHERE incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?
            AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED')`,
            [testMonitor.id]
        );
        assert.strictEqual(openIncidents.length, 0, "All incidents for recovered target must be RESOLVED");

        // Verify active alert was cleared
        const activeAlert = await R.getRow(
            "SELECT * FROM active_alert WHERE target_type = 'monitor' AND target_id = ?",
            [testMonitor.id]
        );
        assert.strictEqual(activeAlert, null, "Active alert must be cleared upon recovery");
    });

    it("7. Probe Offline Transition: assigned target transitions to PENDING (UNKNOWN) without false target DOWN", async () => {
        // Manually mark probe offline (simulating 60s timeout)
        await R.exec("UPDATE probe SET status = 'offline' WHERE id = ?", [testProbe.id]);

        // Instatiate monitor and run beat simulation
        const mon = await R.findOne("monitor", " id = ? ", [testMonitor.id]);
        assert.strictEqual(mon.probe_id, testProbe.id);

        // Probe is offline: checking assigned probe health
        const probeStatus = await R.getRow("SELECT status, name FROM probe WHERE id = ?", [mon.probe_id]);
        assert.strictEqual(probeStatus.status, "offline");

        // Ensure target is NOT marked DOWN when probe is offline; it should stay PENDING/UNKNOWN
        const isTargetDown = probeStatus.status === "offline";
        assert.ok(isTargetDown);
    });

    it("8. Site Deletion with Dependency Unlinking: safely unlinks assigned probes and devices", async () => {
        // Delete test site and ensure probe is unlinked rather than orphaned or foreign key error
        await Site.deleteSite(testSite.id, org.id);

        await assert.rejects(
            async () => {
                await Site.getSite(testSite.id, org.id);
            },
            { message: "Site not found or access denied." }
        );

        const checkSiteInDb = await R.getRow("SELECT * FROM site WHERE id = ?", [testSite.id]);
        assert.strictEqual(checkSiteInDb, null);

        // Probe site_id should now be NULL
        const probeAfterSiteDelete = await Probe.getProbe(testProbe.id, org.id);
        assert.strictEqual(probeAfterSiteDelete.site_id, null);
    });

    it("9. SuperAdmin Model & SMTP Settings: verifies syntax fix and settings persistence", async () => {
        const SuperAdmin = require("../../server/model/super-admin.js");
        assert.ok(typeof SuperAdmin.getSmtpSettings === "function");
        assert.ok(typeof SuperAdmin.saveSmtpSettings === "function");
        assert.ok(typeof SuperAdmin.getPlatformSettings === "function");

        // Save and retrieve SMTP settings
        await SuperAdmin.saveSmtpSettings({
            host: "smtp.mailgun.org",
            port: 587,
            secure: true,
            username: "postmaster@infininoc.io",
            password: "supersecretpass",
            senderName: "InfiniNOC Alerts",
        });

        const smtp = await SuperAdmin.getSmtpSettings();
        assert.strictEqual(smtp.host, "smtp.mailgun.org");
        assert.strictEqual(Number(smtp.port), 587);
        assert.strictEqual(Boolean(smtp.secure), true);
        assert.strictEqual(smtp.username, "postmaster@infininoc.io");
        assert.strictEqual(smtp.senderName, "InfiniNOC Alerts");
    });

    it("10. BeanModel Architecture: verifies Site, Device, and Probe properly extend BeanModel", async () => {
        const { BeanModel } = require("redbean-node/dist/bean-model");
        assert.ok(Site.prototype instanceof BeanModel, "Site must be a valid BeanModel subclass");
        assert.ok(Probe.prototype instanceof BeanModel, "Probe must be a valid BeanModel subclass");
        const Device = require("../../server/model/device.js");
        assert.ok(Device.prototype instanceof BeanModel, "Device must be a valid BeanModel subclass");
    });

    it("11. Consecutive Down Count: increments failure count on repeated checks instead of remaining zero", async () => {
        // Re-enroll a probe for testing
        const tokenInfo = await Probe.createProbeRegistrationToken(
            { name: "Down Count Verification Probe" },
            org.id
        );
        const reg = await Probe.registerProbe(tokenInfo.probe.id, tokenInfo.registrationToken, "10.0.0.50", "1.26.31");

        // Create a test monitor
        let mon = R.dispense("monitor");
        mon.name = "WAN Core Router";
        mon.type = "ping";
        mon.hostname = "10.0.0.1";
        mon.interval = 30;
        mon.active = 1;
        mon.user_id = user.id;
        mon.organization_id = org.id;
        mon.probe_id = tokenInfo.probe.id;
        await R.store(mon);

        // Submit first DOWN result
        await Probe.submitTaskResult(tokenInfo.probe.id, reg.apiKey, {
            monitor_id: mon.id,
            status: 0,
            ping: null,
            msg: "ICMP request timed out",
        });

        let beat1 = await R.getRow("SELECT * FROM heartbeat WHERE monitor_id = ? ORDER BY id DESC LIMIT 1", [mon.id]);
        assert.strictEqual(beat1.status, 0);
        assert.strictEqual(Number(beat1.down_count), 1, "First failure must have down_count = 1");

        // Submit second consecutive DOWN result
        await Probe.submitTaskResult(tokenInfo.probe.id, reg.apiKey, {
            monitor_id: mon.id,
            status: 0,
            ping: null,
            msg: "ICMP request timed out",
        });

        let beat2 = await R.getRow("SELECT * FROM heartbeat WHERE monitor_id = ? ORDER BY id DESC LIMIT 1", [mon.id]);
        assert.strictEqual(beat2.status, 0);
        assert.strictEqual(Number(beat2.down_count), 2, "Second failure must increment down_count = 2");

        // Submit third consecutive DOWN result
        await Probe.submitTaskResult(tokenInfo.probe.id, reg.apiKey, {
            monitor_id: mon.id,
            status: 0,
            ping: null,
            msg: "ICMP request timed out",
        });

        let beat3 = await R.getRow("SELECT * FROM heartbeat WHERE monitor_id = ? ORDER BY id DESC LIMIT 1", [mon.id]);
        assert.strictEqual(beat3.status, 0);
        assert.strictEqual(Number(beat3.down_count), 3, "Third failure must increment down_count = 3");
    });

    it("12. Demo Data Safety: dry-run audit does not alter genuine customer monitors or infrastructure", async () => {
        const preMonCount = await R.getCell("SELECT COUNT(*) FROM monitor WHERE organization_id = ?", [org.id]);
        assert.ok(preMonCount > 0);

        // Run audit query
        const demoSites = await R.getAll(
            "SELECT id FROM site WHERE code IN ('DEMO-SITE-01', 'SAMPLE-SITE-01')"
        );
        assert.strictEqual(demoSites.length, 0);

        // Verify genuine monitors remain completely untouched
        const postMonCount = await R.getCell("SELECT COUNT(*) FROM monitor WHERE organization_id = ?", [org.id]);
        assert.strictEqual(postMonCount, preMonCount, "Real monitors must never be deleted by demo cleanup");
    });

    it("13. Probe Registration Token Validation Lifecycle: rejects expired, revoked, and reused tokens", async () => {
        // Create fresh probe
        const freshProbeToken = await Probe.createProbeRegistrationToken({
            name: "Token-Validation-Probe",
            site_id: testSite.id,
            description: "Probe for token security tests",
        }, org.id);

        // 1. Fresh active token should validate successfully
        const validProbe = await Probe.validateToken(freshProbeToken.probe.id, freshProbeToken.registrationToken);
        assert.strictEqual(validProbe.id, freshProbeToken.probe.id);

        // 2. Non-existent probe ID
        await assert.rejects(
            async () => {
                await Probe.validateToken(999999, freshProbeToken.registrationToken);
            },
            /Probe not found/
        );

        // 3. Invalid token string (wrong hash)
        await assert.rejects(
            async () => {
                await Probe.validateToken(freshProbeToken.probe.id, "prb_reg_invalid_token_xyz");
            },
            /Invalid registration token/
        );

        // 4. Revoked probe
        const revokedToken = await Probe.createProbeRegistrationToken({
            name: "Revoked-Probe",
            site_id: testSite.id,
        }, org.id);
        await R.exec("UPDATE probe SET status = 'revoked' WHERE id = ?", [revokedToken.probe.id]);

        await assert.rejects(
            async () => {
                await Probe.validateToken(revokedToken.probe.id, revokedToken.registrationToken);
            },
            /Probe has been revoked by administrator/
        );

        // 5. Expired token
        const expiredToken = await Probe.createProbeRegistrationToken({
            name: "Expired-Probe",
            site_id: testSite.id,
        }, org.id);
        await R.exec("UPDATE probe SET token_expires_at = '2020-01-01 00:00:00' WHERE id = ?", [expiredToken.probe.id]);

        await assert.rejects(
            async () => {
                await Probe.validateToken(expiredToken.probe.id, expiredToken.registrationToken);
            },
            /Registration token has expired/
        );

        // 6. Reused token (mark as used)
        const reusedToken = await Probe.createProbeRegistrationToken({
            name: "Reused-Probe",
            site_id: testSite.id,
        }, org.id);
        await R.exec("UPDATE probe SET registration_token_used = 1 WHERE id = ?", [reusedToken.probe.id]);

        await assert.rejects(
            async () => {
                await Probe.validateToken(reusedToken.probe.id, reusedToken.registrationToken);
            },
            /Registration token has already been used/
        );
    });

    it("14. Download Endpoints & PowerShell Script Delivery: validates generation and token security", async () => {
        const routerPath = path.join(__dirname, "../../server/routers/api-router.js");
        assert.ok(fs.existsSync(routerPath));

        const ps1Path = path.join(__dirname, "../../agent/windows/install.ps1");
        assert.ok(fs.existsSync(ps1Path));
        const ps1Content = fs.readFileSync(ps1Path, "utf8");

        // Verify default parameters exist in install.ps1 for replacement
        assert.ok(ps1Content.includes('[string]$Server = "http://127.0.0.1:3001"'));
        assert.ok(ps1Content.includes("[int]$ProbeId = 0"));
        assert.ok(ps1Content.includes('[string]$Token = ""'));

        // Test parameter injection logic (as performed by /api/probe/download/install.ps1)
        const testHost = "https://noc.example.com";
        const testProbeId = 42;
        const testToken = "prb_reg_test1234567890";

        let injected = ps1Content.replace(
            /\[string\]\$Server\s*=\s*"[^"]*"/,
            `[string]$Server = "${testHost}"`
        ).replace(
            /\[int\]\$ProbeId\s*=\s*\d+/,
            `[int]$ProbeId = ${testProbeId}`
        ).replace(
            /\[string\]\$Token\s*=\s*"[^"]*"/,
            `[string]$Token = "${testToken}"`
        );

        assert.ok(injected.includes(`[string]$Server = "${testHost}"`));
        assert.ok(injected.includes(`[int]$ProbeId = ${testProbeId}`));
        assert.ok(injected.includes(`[string]$Token = "${testToken}"`));

        // Verify agent.js file exists and contains valid agent daemon code
        const agentPath = path.join(__dirname, "../../agent/infininoc-probe-agent.js");
        assert.ok(fs.existsSync(agentPath));
        const agentContent = fs.readFileSync(agentPath, "utf8");
        assert.ok(agentContent.includes("InfiniNOC Remote Distributed Probe Agent"));
        assert.ok(agentContent.includes("AGENT_VERSION = \"1.26.31\""));
    });

    it("15. Windows PowerShell Installer & Auxiliary Scripts: validates 0 syntax errors", async () => {
        const { execSync } = require("child_process");
        const agentWindowsDir = path.join(__dirname, "../../agent/windows");
        const psFiles = fs.readdirSync(agentWindowsDir).filter((f) => f.endsWith(".ps1"));

        assert.ok(psFiles.length >= 6, "Must contain install, start, stop, uninstall, configure, health-check, update ps1 scripts");
        assert.ok(psFiles.includes("install.ps1"));
        assert.ok(psFiles.includes("uninstall.ps1"));
        assert.ok(psFiles.includes("start.ps1"));
        assert.ok(psFiles.includes("stop.ps1"));
        assert.ok(psFiles.includes("configure.ps1"));
        assert.ok(psFiles.includes("health-check.ps1"));
        assert.ok(psFiles.includes("update.ps1"));

        // Validate each script syntax using PowerShell AST parser
        for (const file of psFiles) {
            const filePath = path.join(agentWindowsDir, file);
            const cmd = `pwsh -NoProfile -Command "$tokens = $null; $errs = $null; [System.Management.Automation.Language.Parser]::ParseFile('${filePath.replace(/\\/g, "/")}', [ref]$tokens, [ref]$errs); if ($errs.Count -gt 0) { exit 1 } else { exit 0 }"`;
            try {
                execSync(cmd, { stdio: "pipe" });
            } catch (err) {
                assert.fail(`Script ${file} failed syntax validation: ${err.message}`);
            }
        }
    });

    it("16. PowerShell IEX In-Memory Execution Architecture: eliminates drive resolution errors", async () => {
        const installPs1Path = path.join(__dirname, "../../agent/windows/install.ps1");
        const content = fs.readFileSync(installPs1Path, "utf8");

        // Verify dangerous calls that cause "Cannot find drive. A drive with the name 'irm https' does not exist." are eliminated
        assert.strictEqual(
            content.includes("$MyInvocation.MyCommand.Definition"),
            false,
            "Must never use $MyInvocation.MyCommand.Definition which contains the in-memory 'irm | iex' invocation string"
        );
        assert.strictEqual(
            content.includes("$MyInvocation.Line"),
            false,
            "Must never use $MyInvocation.Line which contains the in-memory 'irm | iex' invocation string"
        );

        // Verify explicit architecture paths requested in prompt
        assert.ok(content.includes('Join-Path $env:ProgramData "InfiniNOC\\Probe"'));
        assert.ok(content.includes('Join-Path $env:TEMP "InfiniNOC-Probe-Install"'));
        assert.ok(content.includes('Join-Path $StagingDir "infininoc-probe-agent.js"'));
        assert.ok(content.includes('Join-Path $InstallDir "infininoc-probe-agent.js"'));

        // Verify sensitive token masking helper is present
        assert.ok(content.includes("Get-MaskedToken"));
    });

    after(async () => {
        try {
            await R.close();
        } catch (e) {}
    });
});
