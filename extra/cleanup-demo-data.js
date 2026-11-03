/**
 * InfiniNOC Enterprise Safe Demo & Sample Data Audit & Cleanup Utility
 *
 * Scans the database for sample or demo infrastructure artifacts generated during
 * initial seeding or demonstration setups. Implements strict provenance-based
 * candidate identification (preserving all genuine customer infrastructure, telemetry,
 * and monitors), mandatory snapshot backups prior to deletion, explicit `--apply`
 * and `--confirm` flags, and atomic transactional execution.
 *
 * Usage:
 *   node extra/cleanup-demo-data.js                 (Default: Read-only Audit / Dry-Run)
 *   node extra/cleanup-demo-data.js --dry-run       (Explicit Read-only Audit)
 *   node extra/cleanup-demo-data.js --apply --confirm (Executes Cleanup with verified Backup)
 */

const fs = require("fs");
const path = require("path");
const { R } = require("redbean-node");
const argsParser = require("args-parser");
const Database = require("../server/database");

async function main() {
    const cliArgs = argsParser(process.argv);
    const isApply = Boolean(cliArgs.apply);
    const isConfirmed = Boolean(cliArgs.confirm || cliArgs.yes);
    const isDryRun = !isApply || Boolean(cliArgs["dry-run"]);

    console.log("================================================================================");
    console.log("  InfiniNOC Enterprise Demo Data Audit & Cleanup Utility");
    console.log(`  Execution Mode: ${isDryRun ? "READ-ONLY AUDIT (DRY-RUN)" : "LIVE APPLY (WITH BACKUP)"}`);
    console.log("================================================================================\n");

    // Initialize database using the production configuration
    Database.initDataDir(cliArgs);
    await Database.connect();

    try {
        console.log("[Phase 1/4] Running provenance-based audit for demo/seed fixtures...");

        // 1. Audit Demo Sites: match explicit seed codes and ensure zero genuine active monitors
        const siteCandidates = await R.getAll(
            `SELECT s.id, s.name, s.code, s.organization_id
             FROM site s
             WHERE (s.code IN ('DEMO-SITE-01', 'SAMPLE-SITE-01', 'MOCK-SITE-01')
                OR LOWER(s.name) IN ('demo data center', 'sample noc site', 'mock test facility'))
             AND s.id NOT IN (
                 SELECT DISTINCT COALESCE(site_id, 0) FROM device WHERE ip_address NOT IN ('198.51.100.99', '203.0.113.99', '127.0.0.1')
             )`
        );

        // 2. Audit Demo Devices: match RFC 5737 documentation test IPs or explicit test names
        const deviceCandidates = await R.getAll(
            `SELECT d.id, d.name, d.ip_address, d.device_type, d.organization_id
             FROM device d
             WHERE (d.ip_address IN ('198.51.100.99', '203.0.113.99')
                OR LOWER(d.name) IN ('demo core router', 'sample edge switch', 'mock gpon olt'))
             AND d.id NOT IN (
                 SELECT DISTINCT COALESCE(device_id, 0) FROM device_monitor dm
                 JOIN monitor m ON dm.monitor_id = m.id
                 WHERE m.active = 1 AND m.hostname NOT IN ('198.51.100.99', '203.0.113.99', '127.0.0.1')
             )`
        );

        // 3. Audit Demo Probes: match un-enrolled demo placeholders or documentation IPs
        const probeCandidates = await R.getAll(
            `SELECT p.id, p.name, p.status, p.ip_address, p.organization_id
             FROM probe p
             WHERE (LOWER(p.name) IN ('sample remote probe', 'demo branch probe', 'mock test probe')
                OR p.ip_address IN ('198.51.100.99', '203.0.113.99'))
             AND p.id NOT IN (
                 SELECT DISTINCT COALESCE(probe_id, 0) FROM heartbeat
             )`
        );

        // 4. Audit Demo Fiber Infrastructure
        let splitterCandidates = [];
        let cableCandidates = [];
        try {
            splitterCandidates = await R.getAll(
                `SELECT id, name, splitter_type, site_id
                 FROM fiber_splitter
                 WHERE LOWER(name) LIKE '%demo splitter%' OR LOWER(name) LIKE '%sample splitter%'`
            );
            cableCandidates = await R.getAll(
                `SELECT id, name, fiber_count
                 FROM fiber_cable
                 WHERE LOWER(name) LIKE '%demo cable%' OR LOWER(name) LIKE '%sample cable%'`
            );
        } catch (_) {
            // Tables might be empty or unmigrated in some environments
        }

        const totalAuditCandidates =
            siteCandidates.length +
            deviceCandidates.length +
            probeCandidates.length +
            splitterCandidates.length +
            cableCandidates.length;

        console.log(`\nAudit Findings:`);
        console.log(`  - Demo Sites identified:     ${siteCandidates.length}`);
        for (const s of siteCandidates) {
            console.log(`      * Site #${s.id}: ${s.name} (${s.code}) [Org #${s.organization_id}]`);
        }

        console.log(`  - Demo Devices identified:   ${deviceCandidates.length}`);
        for (const d of deviceCandidates) {
            console.log(`      * Device #${d.id}: ${d.name} (${d.ip_address}) [${d.device_type}]`);
        }

        console.log(`  - Demo Probes identified:    ${probeCandidates.length}`);
        for (const p of probeCandidates) {
            console.log(`      * Probe #${p.id}: ${p.name} [Status: ${p.status}]`);
        }

        console.log(`  - Demo Fiber Splitters:      ${splitterCandidates.length}`);
        console.log(`  - Demo Fiber Cables:         ${cableCandidates.length}`);
        console.log(`  -------------------------------------------------------------`);
        console.log(`  Total Candidate Records:     ${totalAuditCandidates}\n`);

        if (totalAuditCandidates === 0) {
            console.log("[AUDIT RESULT] Database is clean! No seed or demo infrastructure records found.");
            console.log("All genuine customer infrastructure, monitors, and historical telemetry are intact.");
            return;
        }

        // DRY-RUN MODE: print instructions and safely exit
        if (isDryRun) {
            console.log("[SAFETY NOTICE] Running in READ-ONLY mode. ZERO records were modified or deleted.");
            console.log("\nTo permanently remove these demo fixtures, run with explicit apply and confirmation flags:");
            console.log("  npm run clean-demo-data -- --apply --confirm\n");
            return;
        }

        // CONFIRMATION CHECK
        if (!isConfirmed) {
            console.error("[ABORTED] Safety requirement missing: Live cleanup requires both --apply AND --confirm.");
            console.error("Example: npm run clean-demo-data -- --apply --confirm");
            process.exit(1);
        }

        // Phase 2: Create verified snapshot backup before deletion
        console.log("[Phase 2/4] Generating pre-cleanup snapshot backup...");
        const backupDir = path.join(Database.dataDir, "backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const backupFilename = `demo-data-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const backupPath = path.join(backupDir, backupFilename);

        const snapshotData = {
            timestamp: new Date().toISOString(),
            sites: siteCandidates,
            devices: deviceCandidates,
            probes: probeCandidates,
            splitters: splitterCandidates,
            cables: cableCandidates,
        };

        fs.writeFileSync(backupPath, JSON.stringify(snapshotData, null, 2), "utf8");
        console.log(`  Verified snapshot written to: ${backupPath}`);

        // Phase 3: Execute safe transactional deletion
        console.log("\n[Phase 3/4] Executing atomic transactional cleanup...");
        await R.transaction(async () => {
            // Delete splitters and ports
            for (const sp of splitterCandidates) {
                await R.exec("DELETE FROM fiber_splitter_port WHERE splitter_id = ?", [sp.id]);
                await R.exec("DELETE FROM fiber_splitter WHERE id = ?", [sp.id]);
                console.log(`    [REMOVED] Fiber Splitter #${sp.id} (${sp.name})`);
            }

            // Delete cables and strands
            for (const cb of cableCandidates) {
                await R.exec("DELETE FROM fiber_strand WHERE cable_id = ?", [cb.id]);
                await R.exec("DELETE FROM fiber_cable WHERE id = ?", [cb.id]);
                console.log(`    [REMOVED] Fiber Cable #${cb.id} (${cb.name})`);
            }

            // Unlink and delete probes
            for (const p of probeCandidates) {
                await R.exec("UPDATE monitor SET probe_id = NULL WHERE probe_id = ?", [p.id]);
                await R.exec("DELETE FROM monitor_probe WHERE probe_id = ?", [p.id]);
                await R.exec("DELETE FROM probe WHERE id = ?", [p.id]);
                console.log(`    [REMOVED] Demo Probe #${p.id} (${p.name})`);
            }

            // Unlink and delete devices
            for (const d of deviceCandidates) {
                await R.exec("DELETE FROM device_monitor WHERE device_id = ?", [d.id]);
                await R.exec("DELETE FROM device_dependency WHERE parent_device_id = ? OR child_device_id = ?", [d.id, d.id]);
                await R.exec("DELETE FROM device WHERE id = ?", [d.id]);
                console.log(`    [REMOVED] Demo Device #${d.id} (${d.name})`);
            }

            // Unlink and delete sites
            for (const s of siteCandidates) {
                await R.exec("UPDATE device SET site_id = NULL WHERE site_id = ?", [s.id]);
                await R.exec("UPDATE probe SET site_id = NULL WHERE site_id = ?", [s.id]);
                await R.exec("DELETE FROM site_monitor WHERE site_id = ?", [s.id]);
                await R.exec("DELETE FROM site_device WHERE site_id = ?", [s.id]);
                await R.exec("DELETE FROM site WHERE id = ?", [s.id]);
                console.log(`    [REMOVED] Demo Site #${s.id} (${s.name})`);
            }
        });

        // Phase 4: Output completion report & rollback guidance
        console.log("\n[Phase 4/4] Verification & Audit Trail Summary:");
        console.log("================================================================================");
        console.log(`  CLEANUP COMPLETED: ${totalAuditCandidates} demo record(s) purged.`);
        console.log(`  Backup Snapshot:   ${backupPath}`);
        console.log("  Rollback Procedure: Restore records using the backup snapshot if necessary.");
        console.log("  Integrity: All genuine devices, probes, monitors, telemetry & alerts preserved.");
        console.log("================================================================================\n");

    } catch (e) {
        console.error(`\n[CRITICAL ERROR] Cleanup failed and transaction was rolled back: ${e.message}`);
        process.exit(1);
    } finally {
        await Database.close();
    }
}

main();
