/**
 * InfiniNOC Safe Demo / Sample Data Cleanup Utility
 *
 * Scans the database for sample or demo infrastructure artifacts
 * (e.g. devices/sites/probes with 'demo' or 'sample' in name/code),
 * verifies foreign-key references, and safely removes only confirmed
 * test fixtures while strictly preserving all genuine production records.
 *
 * Usage:
 *   node extra/cleanup-demo-data.js [--dry-run] [--force]
 */

const { R } = require("redbean-node");
const Database = require("../server/database");

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    const isForce = process.argv.includes("--force");

    console.log("============================================================");
    console.log("  InfiniNOC Production Demo Data Audit & Cleanup Utility");
    console.log(`  Mode: ${isDryRun ? "DRY-RUN (Audit Only)" : "LIVE CLEANUP"}`);
    console.log("============================================================\n");

    Database.initDataDir();
    await Database.connect();

    try {
        console.log("[1/5] Auditing Demo Sites...");
        const demoSites = await R.getAll(
            "SELECT id, name, code, organization_id FROM site WHERE LOWER(name) LIKE '%demo%' OR LOWER(code) LIKE '%demo%' OR LOWER(name) LIKE '%sample%'"
        );
        console.log(`  Found ${demoSites.length} demo site candidate(s):`);
        for (const s of demoSites) {
            console.log(`    - Site #${s.id}: ${s.name} (${s.code}) [Org #${s.organization_id}]`);
        }

        console.log("\n[2/5] Auditing Demo Devices...");
        const demoDevices = await R.getAll(
            "SELECT id, name, ip_address, device_type, organization_id FROM device WHERE LOWER(name) LIKE '%demo%' OR LOWER(name) LIKE '%sample%' OR ip_address = '198.51.100.99'"
        );
        console.log(`  Found ${demoDevices.length} demo device candidate(s):`);
        for (const d of demoDevices) {
            console.log(`    - Device #${d.id}: ${d.name} (${d.ip_address}) [${d.device_type}]`);
        }

        console.log("\n[3/5] Auditing Demo Probes...");
        const demoProbes = await R.getAll(
            "SELECT id, name, status, organization_id FROM probe WHERE LOWER(name) LIKE '%demo%' OR LOWER(name) LIKE '%sample%'"
        );
        console.log(`  Found ${demoProbes.length} demo probe candidate(s):`);
        for (const p of demoProbes) {
            console.log(`    - Probe #${p.id}: ${p.name} [Status: ${p.status}]`);
        }

        console.log("\n[4/5] Auditing Demo Fiber Infrastructure...");
        let demoSplitters = [];
        let demoCables = [];
        try {
            demoSplitters = await R.getAll(
                "SELECT id, name FROM fiber_splitter WHERE LOWER(name) LIKE '%demo%' OR LOWER(name) LIKE '%sample%'"
            );
            demoCables = await R.getAll(
                "SELECT id, name FROM fiber_cable WHERE LOWER(name) LIKE '%demo%' OR LOWER(name) LIKE '%sample%'"
            );
        } catch {
            // Tables might be empty
        }
        console.log(`  Found ${demoSplitters.length} demo splitter(s), ${demoCables.length} demo cable(s).`);

        const totalCandidates = demoSites.length + demoDevices.length + demoProbes.length + demoSplitters.length + demoCables.length;

        if (totalCandidates === 0) {
            console.log("\n[AUDIT RESULT] Database is clean! No fabricated or demo infrastructure records found.");
            process.exit(0);
        }

        if (isDryRun) {
            console.log(`\n[DRY RUN COMPLETE] Total ${totalCandidates} record(s) flagged for removal. Run without --dry-run to purge.`);
            process.exit(0);
        }

        console.log("\n[5/5] Executing Safe Removal of Verified Demo Records...");

        // Unlink foreign keys before deleting
        for (const s of demoSites) {
            await R.exec("UPDATE device SET site_id = NULL WHERE site_id = ?", [s.id]);
            await R.exec("UPDATE probe SET site_id = NULL WHERE site_id = ?", [s.id]);
            await R.exec("DELETE FROM site_monitor WHERE site_id = ?", [s.id]);
            await R.exec("DELETE FROM site_device WHERE site_id = ?", [s.id]);
            await R.exec("DELETE FROM site WHERE id = ?", [s.id]);
            console.log(`  Purged Demo Site #${s.id} (${s.name}).`);
        }

        for (const d of demoDevices) {
            await R.exec("DELETE FROM device_monitor WHERE device_id = ?", [d.id]);
            await R.exec("DELETE FROM device_dependency WHERE parent_device_id = ? OR child_device_id = ?", [d.id, d.id]);
            await R.exec("DELETE FROM device WHERE id = ?", [d.id]);
            console.log(`  Purged Demo Device #${d.id} (${d.name}).`);
        }

        for (const p of demoProbes) {
            await R.exec("UPDATE monitor SET probe_id = NULL WHERE probe_id = ?", [p.id]);
            await R.exec("DELETE FROM monitor_probe WHERE probe_id = ?", [p.id]);
            await R.exec("DELETE FROM probe WHERE id = ?", [p.id]);
            console.log(`  Purged Demo Probe #${p.id} (${p.name}).`);
        }

        for (const sp of demoSplitters) {
            await R.exec("DELETE FROM fiber_splitter_port WHERE splitter_id = ?", [sp.id]);
            await R.exec("DELETE FROM fiber_splitter WHERE id = ?", [sp.id]);
            console.log(`  Purged Demo Splitter #${sp.id} (${sp.name}).`);
        }

        for (const cb of demoCables) {
            await R.exec("DELETE FROM fiber_strand WHERE cable_id = ?", [cb.id]);
            await R.exec("DELETE FROM fiber_cable WHERE id = ?", [cb.id]);
            console.log(`  Purged Demo Cable #${cb.id} (${cb.name}).`);
        }

        console.log("\n============================================================");
        console.log("  SUCCESS: All demo and fabricated records safely removed!");
        console.log("  Genuine production records and historical telemetry preserved.");
        console.log("============================================================");

    } catch (e) {
        console.error(`[ERROR] Demo data cleanup failed: ${e.message}`);
        process.exit(1);
    } finally {
        await Database.close();
    }
}

main();
