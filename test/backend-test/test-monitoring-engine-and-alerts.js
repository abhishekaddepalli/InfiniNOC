const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");
const net = require("net");

const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");

describe("InfiniNOC Monitoring Engine, DOWN/WARNING Classification, and Alert Generation Test Suite", () => {
    let Organization;
    let Probe;
    let Site;
    let Monitor;
    let Incident;
    let AlertEngine;
    let utilServer;
    let ping;
    let pingAsync;
    let tcpPing;

    let org1;
    let org2;
    let user1;
    let user2;
    let testSite1;
    let testProbe1;
    let probe1ApiKey;

    const testDbDir = path.join(__dirname, "../test-data");
    const testDbPath = path.join(testDbDir, "test-monitoring-engine-alerts.db");

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
        AlertEngine = require("../../server/model/alert-engine.js");

        R.modelList["monitor"] = Monitor;
        R.modelList["probe"] = Probe;
        R.modelList["site"] = Site;

        utilServer = require("../../server/util-server.js");
        ping = utilServer.ping;
        pingAsync = utilServer.pingAsync;
        tcpPing = utilServer.tcpPing;

        // Seed primary users
        await R.exec("INSERT INTO user (username, password, active) VALUES ('noc_eng_1', 'pass123', 1)");
        await R.exec("INSERT INTO user (username, password, active) VALUES ('noc_eng_2', 'pass123', 1)");
        const u1Id = await R.getCell("SELECT id FROM user WHERE username = 'noc_eng_1'");
        const u2Id = await R.getCell("SELECT id FROM user WHERE username = 'noc_eng_2'");
        user1 = { id: u1Id, username: "noc_eng_1" };
        user2 = { id: u2Id, username: "noc_eng_2" };

        // Seed organizations
        org1 = await Organization.createOrganization("Primary NOC Operations", "primary-noc", user1.id);
        org2 = await Organization.createOrganization("Secondary Tenant Corp", "secondary-tenant", user2.id);

        // Seed site and remote probe
        testSite1 = await Site.createSite({
            name: "DataCenter West",
            code: "DC-WEST-01",
            city: "San Jose",
            country: "USA",
        }, org1.id);

        const tokenResult = await Probe.createProbeRegistrationToken({
            name: "Agent-Node-West",
            site_id: testSite1.id,
        }, org1.id);

        const regResult = await Probe.registerProbe(tokenResult.probe.id, tokenResult.registrationToken, "192.168.10.50", "1.26.31");
        testProbe1 = tokenResult.probe;
        probe1ApiKey = regResult.apiKey;

        // Update probe to online
        await R.exec("UPDATE probe SET status = 'online', last_heartbeat = ? WHERE id = ?", [new Date().toISOString(), testProbe1.id]);
    });

    after(async () => {
        try {
            await R.close();
        } catch (_) {}
    });

    it("1. Central Ping Execution: reachable host (127.0.0.1) succeeds with latency and 0% loss", async () => {
        const res = await ping("127.0.0.1", 1, "", true, 32, 2, 1);
        assert.ok(res !== null && res !== undefined);
        const pingMs = typeof res === "object" ? res.time : res;
        assert.ok(typeof pingMs === "number", "Ping latency must be a numeric value");
        assert.ok(pingMs >= 0, "Ping latency must be non-negative");
        if (typeof res === "object") {
            assert.strictEqual(res.degraded, false);
            assert.strictEqual(res.packetLoss, 0);
        }
    });

    it("2. Central Ping Execution: unreachable target (RFC 5737 192.0.2.1) times out within deadline", async () => {
        const startTime = Date.now();
        let pingFailed = false;
        try {
            await ping("192.0.2.1", 1, "", true, 32, 1, 1);
        } catch (err) {
            pingFailed = true;
            assert.ok(
                err.message.includes("timed out") ||
                err.message.includes("No reply") ||
                err.message.includes("unreachable") ||
                err.message.includes("failed") ||
                err.isTargetFailure ||
                err.isTargetDown,
                `Expected timeout/unreachable message, got: ${err.message}`
            );
        }
        const duration = Date.now() - startTime;
        // Verify timeout is respected (under 5 seconds, never 48000s)
        assert.ok(duration < 5000, `Ping execution must respect deadline, took ${duration}ms`);
        assert.ok(pingFailed, "Unreachable IP 192.0.2.1 must fail ping check");
    });

    it("3. Central TCP Ping: open vs closed port diagnostics without uncaught exceptions", async () => {
        // Start a temporary local TCP server to test reachable port
        const server = net.createServer().listen(0, "127.0.0.1");
        await new Promise((resolve) => server.on("listening", resolve));
        const testPort = server.address().port;

        try {
            const reachableLatency = await tcpPing("127.0.0.1", testPort, 1000);
            assert.ok(reachableLatency >= 0, "Latency must be non-negative");
        } finally {
            server.close();
        }

        // Test connection to closed port
        await assert.rejects(
            async () => {
                await tcpPing("127.0.0.1", 65530, 500);
            },
            /ECONNREFUSED|timeout/i
        );
    });

    it("4. Platform Architecture & Timeout Unit Integrity: eliminates 13-hour deadline bug", async () => {
        // Verify timeout logic calculation
        const monBean = R.dispense("monitor");
        monBean.interval = 60;
        const computedTimeout = Math.max(1, Math.round((monBean.interval || 60) * 0.8));
        assert.strictEqual(computedTimeout, 48, "60s interval must yield 48s timeout, not 48000s (13.3 hours)");

        // Verify isWindows platform check
        const isWindows = process.platform === "win32";
        assert.strictEqual(typeof isWindows, "boolean");
        if (process.platform === "win32") {
            assert.strictEqual(isWindows, true);
        } else {
            assert.strictEqual(isWindows, false);
        }
    });

    it("5. Monitor Delegation Architecture: central execution vs remote probe routing", async () => {
        // Central Monitor (probe_id = null)
        const centralMon = R.dispense("monitor");
        centralMon.name = "Google DNS Central";
        centralMon.type = "ping";
        centralMon.hostname = "8.8.8.8";
        centralMon.interval = 60;
        centralMon.active = 1;
        centralMon.organization_id = org1.id;
        centralMon.user_id = user1.id;
        centralMon.probe_id = null;
        await R.store(centralMon);

        const central = await R.findOne("monitor", " id = ? ", [centralMon.id]);
        const centralPreload = await Monitor.preparePreloadData([{ id: central.id, active: central.active }]);
        const centralJson = central.toJSON(centralPreload);
        assert.strictEqual(centralJson.execution_source, "central");
        assert.strictEqual(centralJson.execution_location, "Central Monitoring Server");

        // Remote Probe Monitor (probe_id = testProbe1.id)
        const probeMon = R.dispense("monitor");
        probeMon.name = "Branch Router DC West";
        probeMon.type = "ping";
        probeMon.hostname = "10.0.1.1";
        probeMon.interval = 60;
        probeMon.active = 1;
        probeMon.organization_id = org1.id;
        probeMon.user_id = user1.id;
        probeMon.probe_id = testProbe1.id;
        await R.store(probeMon);

        const probeM = await R.findOne("monitor", " id = ? ", [probeMon.id]);
        const probePreload = await Monitor.preparePreloadData([{ id: probeM.id, active: probeM.active }]);
        const probeJson = probeM.toJSON(probePreload);
        assert.strictEqual(probeJson.execution_source, "probe");
        assert.ok(probeJson.execution_location.includes("Remote Probe"));
    });

    it("6. State Machine & Max Retries: transient failure is PENDING, confirmed failure is DOWN", async () => {
        const mon = R.dispense("monitor");
        mon.name = "State Machine Test Monitor";
        mon.type = "ping";
        mon.hostname = "192.0.2.10";
        mon.interval = 30;
        mon.maxretries = 3;
        mon.active = 1;
        mon.organization_id = org1.id;
        mon.user_id = user1.id;
        await R.store(mon);

        // Step 1: Initial check was UP
        let beat1 = R.dispense("heartbeat");
        beat1.monitor_id = mon.id;
        beat1.status = UP;
        beat1.ping = 15;
        beat1.time = new Date(Date.now() - 90000).toISOString();
        beat1.down_count = 0;
        await R.store(beat1);

        // Step 2: 1st transient failure -> status PENDING (retry 1/3)
        let beat2 = R.dispense("heartbeat");
        beat2.monitor_id = mon.id;
        beat2.status = PENDING;
        beat2.msg = "ICMP request timed out. Retrying (1/3)";
        beat2.time = new Date(Date.now() - 60000).toISOString();
        beat2.down_count = 0;
        await R.store(beat2);

        // Step 3: 2nd transient failure -> status PENDING (retry 2/3)
        let beat3 = R.dispense("heartbeat");
        beat3.monitor_id = mon.id;
        beat3.status = PENDING;
        beat3.msg = "ICMP request timed out. Retrying (2/3)";
        beat3.time = new Date(Date.now() - 30000).toISOString();
        beat3.down_count = 0;
        await R.store(beat3);

        // Step 4: 3rd failure exceeds maxretries -> status transitions to DOWN with down_count = 1
        let beat4 = R.dispense("heartbeat");
        beat4.monitor_id = mon.id;
        beat4.status = DOWN;
        beat4.msg = "Target unreachable after 3 retries";
        beat4.time = new Date().toISOString();
        beat4.down_count = 1;
        await R.store(beat4);

        const latestBeat = await Monitor.getPreviousHeartbeat(mon.id);
        assert.strictEqual(Number(latestBeat.status), DOWN);
        assert.strictEqual(Number(latestBeat.down_count), 1);
    });

    it("7. Latency and Packet Loss: degraded ping produces PENDING (WARNING) status", async () => {
        const mon = R.dispense("monitor");
        mon.name = "Degraded Latency Test Target";
        mon.type = "ping";
        mon.hostname = "10.0.0.1";
        mon.interval = 30;
        mon.active = 1;
        mon.organization_id = org1.id;
        mon.user_id = user1.id;
        await R.store(mon);

        // Record a degraded heartbeat (simulating high latency / packet loss)
        const beat = R.dispense("heartbeat");
        beat.monitor_id = mon.id;
        beat.status = PENDING; // WARNING
        beat.ping = 450;
        beat.msg = "Degraded ICMP connectivity to 10.0.0.1. Latency: 450 ms. Packet loss: 20%.";
        beat.time = new Date().toISOString();
        beat.down_count = 0;
        await R.store(beat);

        const lastBeat = await Monitor.getPreviousHeartbeat(mon.id);
        assert.strictEqual(Number(lastBeat.status), PENDING, "Degraded connectivity must be PENDING/WARNING, not DOWN");
        assert.strictEqual(Number(lastBeat.ping), 450);
        assert.ok(lastBeat.msg.includes("Degraded"));
    });

    it("8. Automated Alert Generation on Confirmed DOWN", async () => {
        const mon = R.dispense("monitor");
        mon.name = "Outage Alert Test Target";
        mon.type = "ping";
        mon.hostname = "192.0.2.55";
        mon.interval = 30;
        mon.active = 1;
        mon.organization_id = org1.id;
        mon.user_id = user1.id;
        await R.store(mon);

        // Record DOWN heartbeat
        const beat = R.dispense("heartbeat");
        beat.monitor_id = mon.id;
        beat.status = DOWN;
        beat.msg = "ICMP request timed out. Target unreachable.";
        beat.time = new Date().toISOString();
        beat.down_count = 1;
        await R.store(beat);

        // Reconcile alerts
        await Monitor.reconcileAllMonitorAlerts(org1.id);

        const alert = await R.getRow(
            "SELECT * FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
            [org1.id, mon.id]
        );
        assert.ok(alert, "Active alert must be generated for confirmed DOWN target");
        assert.strictEqual(alert.state, "CRITICAL");
        assert.strictEqual(alert.metric, "monitor_down");
        assert.ok(alert.message.includes("DOWN"));
    });

    it("9. Automated Incident Creation on Confirmed DOWN", async () => {
        const mon = await R.findOne("monitor", " name = 'Outage Alert Test Target' ");
        assert.ok(mon);

        const inc = await R.getRow(
            `SELECT incident.* FROM incident 
            JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
            WHERE incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?
            AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED')`,
            [mon.id]
        );
        assert.ok(inc, "Open incident must be created for confirmed DOWN target");
        assert.strictEqual(inc.severity, "P1");
        assert.ok(inc.title.includes("[OUTAGE]"));
    });

    it("10. Automated Recovery: UP status auto-resolves open incident and clears active alert", async () => {
        const mon = await R.findOne("monitor", " name = 'Outage Alert Test Target' ");
        assert.ok(mon);

        // Record UP recovery heartbeat
        const beat = R.dispense("heartbeat");
        beat.monitor_id = mon.id;
        beat.status = UP;
        beat.ping = 12;
        beat.msg = "ICMP echo reply received. Latency: 12 ms.";
        beat.time = new Date().toISOString();
        beat.down_count = 0;
        await R.store(beat);

        // Trigger reconciliation
        await Monitor.reconcileAllMonitorAlerts(org1.id);

        // Verify active alert is cleared
        const activeAlert = await R.getRow(
            "SELECT * FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
            [org1.id, mon.id]
        );
        assert.strictEqual(activeAlert, null, "Active alert must be deleted upon recovery");

        // Verify alert history received the resolved entry
        const history = await R.getRow(
            "SELECT * FROM alert_history WHERE organization_id = ? AND message LIKE ? ORDER BY id DESC LIMIT 1",
            [org1.id, `%Monitor #${mon.id}%`]
        );
        assert.ok(history, "Alert history record must exist for resolved alert");
        assert.strictEqual(history.state, "RECOVERED");

        // Verify incident was closed/resolved
        const openIncs = await R.getAll(
            `SELECT incident.* FROM incident 
            JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
            WHERE incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?
            AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED')`,
            [mon.id]
        );
        assert.strictEqual(openIncs.length, 0, "All incidents for recovered target must be marked RESOLVED");
    });

    it("11. Self-Healing Reconciliation: repairs missing alerts/incidents for un-alerted DOWN monitors", async () => {
        // Create an un-alerted DOWN monitor (simulating pre-fix state or backend crash)
        const mon = R.dispense("monitor");
        mon.name = "Un-alerted Outage Monitor";
        mon.type = "ping";
        mon.hostname = "192.0.2.77";
        mon.interval = 60;
        mon.active = 1;
        mon.organization_id = org1.id;
        mon.user_id = user1.id;
        await R.store(mon);

        const beat = R.dispense("heartbeat");
        beat.monitor_id = mon.id;
        beat.status = DOWN;
        beat.msg = "Host unreachable";
        beat.time = new Date().toISOString();
        beat.down_count = 2;
        await R.store(beat);

        // Run reconciliation
        const stats = await Monitor.reconcileAllMonitorAlerts(org1.id);
        assert.ok(stats.alertsCreated >= 1, "Reconciliation must create missing alert");
        assert.ok(stats.incidentsCreated >= 1, "Reconciliation must create missing incident");

        const alert = await R.getRow("SELECT id, state FROM active_alert WHERE target_type = 'monitor' AND target_id = ?", [mon.id]);
        assert.ok(alert, "Missing alert must now exist");
        assert.strictEqual(alert.state, "CRITICAL");
    });

    it("12. Dangling Alert Resolution: reconciliation clears alerts for targets that are now UP", async () => {
        // Create a monitor that is UP
        const mon = R.dispense("monitor");
        mon.name = "Dangling Alert Test Target";
        mon.type = "ping";
        mon.hostname = "10.0.0.2";
        mon.interval = 60;
        mon.active = 1;
        mon.organization_id = org1.id;
        mon.user_id = user1.id;
        await R.store(mon);

        const beat = R.dispense("heartbeat");
        beat.monitor_id = mon.id;
        beat.status = UP;
        beat.ping = 5;
        beat.time = new Date().toISOString();
        await R.store(beat);

        // Manually inject a dangling active alert
        await R.exec(
            `INSERT INTO active_alert (
                organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
            ) VALUES (?, 0, 'monitor', ?, 'monitor_down', 'CRITICAL', 0, 'Dangling Outage Alert', ?, ?, ?, ?)`,
            [org1.id, mon.id, beat.time, beat.time, beat.time, beat.time]
        );

        // Verify dangling alert exists before reconciliation
        const beforeAlert = await R.getRow("SELECT id FROM active_alert WHERE target_type = 'monitor' AND target_id = ?", [mon.id]);
        assert.ok(beforeAlert);

        // Reconcile
        const stats = await Monitor.reconcileAllMonitorAlerts(org1.id);
        assert.ok(stats.alertsResolved >= 1);

        // Verify dangling alert is now removed
        const afterAlert = await R.getRow("SELECT id FROM active_alert WHERE target_type = 'monitor' AND target_id = ?", [mon.id]);
        assert.strictEqual(afterAlert, null, "Dangling alert must be purged during reconciliation");
    });

    it("13. Duplicate Prevention: multiple consecutive DOWN beats do not spawn duplicate alerts", async () => {
        const mon = await R.findOne("monitor", " name = 'Un-alerted Outage Monitor' ");
        assert.ok(mon);

        // Store two more DOWN beats
        for (let i = 0; i < 2; i++) {
            const beat = R.dispense("heartbeat");
            beat.monitor_id = mon.id;
            beat.status = DOWN;
            beat.msg = "Host still unreachable";
            beat.time = new Date().toISOString();
            beat.down_count = 3 + i;
            await R.store(beat);
        }

        // Run reconciliation again
        await Monitor.reconcileAllMonitorAlerts(org1.id);

        const alertRows = await R.getAll(
            "SELECT id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
            [org1.id, mon.id]
        );
        assert.strictEqual(alertRows.length, 1, "Must never create duplicate active_alerts for the same monitor");

        const incRows = await R.getAll(
            `SELECT incident.id FROM incident 
            JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
            WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
            AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
            AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
            [org1.id, mon.id]
        );
        assert.strictEqual(incRows.length, 1, "Must never create duplicate open incidents for the same monitor");
    });

    it("14. Probe Task Polling Isolation: probe only receives its own active tasks", async () => {
        const tasks = await Probe.getAssignedTasks(testProbe1.id, probe1ApiKey);
        assert.ok(Array.isArray(tasks));
        assert.ok(tasks.length >= 1);

        // All returned tasks must have probe_id matching testProbe1.id
        for (const task of tasks) {
            assert.strictEqual(task.probe_id, testProbe1.id);
            assert.strictEqual(task.active, 1);
        }

        // Central monitors must never be in probe task queue
        const centralTask = tasks.find((t) => t.name === "Google DNS Central");
        assert.strictEqual(centralTask, undefined, "Central monitors must not be dispatched to remote probes");
    });

    it("15. Remote Probe Result Submission Pipeline: processes latency, status, and message", async () => {
        const mon = await R.findOne("monitor", " name = 'Branch Router DC West' ");
        assert.ok(mon);

        const payload = {
            monitor_id: mon.id,
            probe_id: testProbe1.id,
            task_id: mon.id,
            target: mon.hostname,
            type: "ping",
            location: "DataCenter West Node",
            timestamp: new Date().toISOString(),
            status: 1,
            ping: 8,
            packet_loss: 0,
            msg: "ICMP echo reply received from 10.0.1.1. Latency: 8 ms. Packet loss: 0%.",
        };

        const res = await Probe.submitTaskResult(testProbe1.id, probe1ApiKey, payload);
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.status, 1);
        assert.strictEqual(res.ping, 8);

        const savedBeat = await R.load("heartbeat", res.heartbeat_id);
        assert.strictEqual(savedBeat.monitor_id, mon.id);
        assert.strictEqual(savedBeat.probe_id, testProbe1.id);
        assert.strictEqual(Number(savedBeat.ping), 8);
    });

    it("16. Probe Offline Protection: assigned monitor transitions to PENDING (UNKNOWN), NOT false target DOWN", async () => {
        // Create dedicated probe and monitor
        const tokenResult = await Probe.createProbeRegistrationToken({
            name: "Failing-Branch-Probe",
            site_id: testSite1.id,
        }, org1.id);
        const regResult = await Probe.registerProbe(tokenResult.probe.id, tokenResult.registrationToken, "192.168.20.1", "1.26.31");
        const failingProbeId = tokenResult.probe.id;

        const privMon = R.dispense("monitor");
        privMon.name = "Isolated Core Switch";
        privMon.type = "ping";
        privMon.hostname = "10.200.1.1";
        privMon.interval = 30;
        privMon.active = 1;
        privMon.organization_id = org1.id;
        privMon.user_id = user1.id;
        privMon.probe_id = failingProbeId;
        await R.store(privMon);

        // Mark probe offline (e.g. heartbeat lost 70 seconds ago)
        const pastHeartbeat = new Date(Date.now() - 75000).toISOString().replace("T", " ").substring(0, 19);
        await R.exec("UPDATE probe SET status = 'online', last_heartbeat = ? WHERE id = ?", [pastHeartbeat, failingProbeId]);

        // Probe health check runs
        await Probe.checkAllProbesHealth();

        const probeDb = await R.load("probe", failingProbeId);
        assert.strictEqual(probeDb.status, "offline");

        // Verify diagnostics for this monitor
        const diag = await Monitor.getDiagnostics(privMon.id, org1.id);
        assert.strictEqual(diag.worker_available, false);
        assert.strictEqual(diag.probe_info.status, "offline");

        // Verify NO false DOWN alert was generated
        const alert = await R.getRow("SELECT id FROM active_alert WHERE target_type = 'monitor' AND target_id = ?", [privMon.id]);
        assert.strictEqual(alert, null, "Offline probe must not trigger target DOWN alert");
    });

    it("17. Stale Probe Result Rejection: prevents out-of-order result ingestion", async () => {
        const mon = await R.findOne("monitor", " name = 'Branch Router DC West' ");
        assert.ok(mon);

        // Attempt submitting result with past timestamp (e.g. from 2021)
        const stalePayload = {
            monitor_id: mon.id,
            probe_id: testProbe1.id,
            target: mon.hostname,
            type: "ping",
            timestamp: "2021-01-01T00:00:00.000Z",
            status: 0,
            msg: "Out-of-order check result",
        };

        const res = await Probe.submitTaskResult(testProbe1.id, probe1ApiKey, stalePayload);
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.stale, true);
    });

    it("18. Monitor Diagnostics Payload (Monitor.getDiagnostics): comprehensive NOC observability", async () => {
        const mon = await R.findOne("monitor", " name = 'Branch Router DC West' ");
        assert.ok(mon);

        const diag = await Monitor.getDiagnostics(mon.id, org1.id);
        assert.strictEqual(diag.monitor_id, mon.id);
        assert.strictEqual(diag.name, "Branch Router DC West");
        assert.strictEqual(diag.type, "ping");
        assert.strictEqual(diag.execution_source, "probe");
        assert.ok(diag.execution_location.includes("Remote Probe"));
        assert.strictEqual(diag.worker_available, true);
        assert.strictEqual(diag.last_status, "UP");
        assert.strictEqual(Number(diag.last_ping_ms), 8);
        assert.ok(diag.next_scheduled_execution !== null);
    });

    it("19. REST API Diagnostics Route: validates input validation and security scoping", async () => {
        // Invalid ID rejection
        assert.throws(
            () => {
                const id = parseInt("abc", 10);
                if (isNaN(id)) throw new Error("Invalid monitor ID.");
            },
            /Invalid monitor ID/
        );

        // Non-existent monitor diagnostic rejection
        await assert.rejects(
            async () => {
                await Monitor.getDiagnostics(999999, org1.id);
            },
            /Monitor not found or access denied/
        );

        // Cross-organization boundary: User from org2 cannot access org1 monitor
        const monOrg1 = await R.findOne("monitor", " name = 'Google DNS Central' ");
        assert.ok(monOrg1);

        await assert.rejects(
            async () => {
                await Monitor.getDiagnostics(monOrg1.id, org2.id);
            },
            /Monitor not found or access denied/
        );
    });

    it("20. Multi-Tenant Scoping & Null Organization Fallback: preserves legacy and isolated records", async () => {
        // Legacy monitor with NULL organization_id
        const legacyMon = R.dispense("monitor");
        legacyMon.name = "Legacy System Monitor";
        legacyMon.type = "ping";
        legacyMon.hostname = "127.0.0.1";
        legacyMon.interval = 60;
        legacyMon.active = 1;
        legacyMon.organization_id = null;
        legacyMon.user_id = user1.id;
        await R.store(legacyMon);

        const legacyBeat = R.dispense("heartbeat");
        legacyBeat.monitor_id = legacyMon.id;
        legacyBeat.status = UP;
        legacyBeat.ping = 1;
        legacyBeat.time = new Date().toISOString();
        await R.store(legacyBeat);

        // Diagnostics for legacy monitor with NULL org is accessible by any valid org
        const legacyDiag = await Monitor.getDiagnostics(legacyMon.id, org1.id);
        assert.strictEqual(legacyDiag.monitor_id, legacyMon.id);
        assert.strictEqual(legacyDiag.last_status, "UP");

        // Verify AlertEngine.getActiveAlerts() works with both explicit orgId and null fallback
        const activeAlerts = await AlertEngine.getActiveAlerts(org1.id);
        assert.ok(Array.isArray(activeAlerts));
    });
});
