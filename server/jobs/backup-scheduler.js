const BackupEngine = require("../backup");
const { Settings } = require("../settings");
const { log } = require("../../src/util");
const dayjs = require("dayjs");

let lastRunTimestamp = null;

/**
 * Server-side Automated Backup Scheduler Job
 * Runs every minute to check if scheduled automated backup is due.
 * @returns {Promise<void>}
 */
async function backupSchedulerJob() {
    try {
        const autoEnabled = await Settings.get("backup_auto_enabled");
        if (!autoEnabled) {
            return;
        }

        const autoTime = (await Settings.get("backup_auto_time")) || "02:00";
        const autoFrequency = (await Settings.get("backup_auto_frequency")) || "daily";

        const now = dayjs();
        const currentHHmm = now.format("HH:mm");
        const todayStr = now.format("YYYY-MM-DD");

        // Match target HH:mm time
        if (currentHHmm !== autoTime) {
            return;
        }

        // Prevent running multiple times in the same minute
        const runKey = `${todayStr}-${currentHHmm}`;
        if (lastRunTimestamp === runKey) {
            return;
        }

        // Check frequency constraints
        if (autoFrequency === "weekly" && now.day() !== 0) {
            // Weekly runs on Sunday (0)
            return;
        }

        log.info("backup-job", `Executing scheduled automated backup (${runKey})...`);
        lastRunTimestamp = runKey;

        // 1. Create Automatic Backup
        const backupResult = await BackupEngine.createBackup({
            userId: 1,
            type: "auto",
        });

        log.info("backup-job", `Scheduled backup created successfully: ${backupResult.fileName}`);

        // 2. Run Automatic Retention Cleanup if enabled
        const autoCleanup = await Settings.get("backup_auto_cleanup");
        if (autoCleanup !== false) {
            const cleanupResult = await BackupEngine.runRetentionCleanup();
            log.info(
                "backup-job",
                `Retention cleanup finished: Deleted ${cleanupResult.deletedCount} backups, freed ${cleanupResult.freedMB} MB, retained ${cleanupResult.retainedCount} backups.`
            );
        }
    } catch (error) {
        log.error("backup-job", `Scheduled backup execution failed: ${error.message}`);
    }
}

module.exports = {
    backupSchedulerJob,
};
