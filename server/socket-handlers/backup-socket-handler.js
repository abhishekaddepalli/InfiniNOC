const { checkLogin } = require("../util-server");
const SuperAdmin = require("../model/super-admin");
const BackupEngine = require("../backup");
const { Settings } = require("../settings");

/**
 * Socket handlers for Backup & Restore System
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.backupSocketHandler = (socket) => {
    // List all platform backups
    socket.on("getBackupList", async (callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const list = await BackupEngine.getBackupList();
            if (typeof callback === "function") {
                callback({ ok: true, list });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Get Backup Storage Statistics
    socket.on("getBackupStorageStats", async (callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const limitMB = (await Settings.get("backup_storage_limit_mb")) || 1024;
            const stats = await BackupEngine.getStorageStats(limitMB);
            if (typeof callback === "function") {
                callback({ ok: true, stats });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Toggle Backup Lock Protection
    socket.on("toggleBackupLock", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (!data || !data.fileName) {
                throw new Error("Backup filename is required.");
            }
            const locked = Boolean(data.locked);
            await BackupEngine.setBackupLock(data.fileName, locked);
            if (typeof callback === "function") {
                callback({ ok: true, locked });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Preview retention cleanup
    socket.on("previewBackupCleanup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const preview = await BackupEngine.previewRetentionCleanup(data || {});
            if (typeof callback === "function") {
                callback({ ok: true, preview });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Run retention cleanup now
    socket.on("runBackupCleanup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const result = await BackupEngine.runRetentionCleanup(data || {});
            if (typeof callback === "function") {
                callback({ ok: true, result });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Get Backup Settings
    socket.on("getBackupSettings", async (callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const settings = {
                autoEnabled: (await Settings.get("backup_auto_enabled")) ?? true,
                autoFrequency: (await Settings.get("backup_auto_frequency")) || "daily",
                autoTime: (await Settings.get("backup_auto_time")) || "02:00",
                retentionCount: (await Settings.get("backup_retention_count")) || 30,
                retentionAgeDays: (await Settings.get("backup_retention_age_days")) || 90,
                minKeep: (await Settings.get("backup_min_keep")) || 3,
                autoCleanup: (await Settings.get("backup_auto_cleanup")) ?? true,
                storageLimitMB: (await Settings.get("backup_storage_limit_mb")) || 1024,
                storageWarningPercent: (await Settings.get("backup_storage_warning_percent")) || 80,
                storageCriticalPercent: (await Settings.get("backup_storage_critical_percent")) || 90,
            };
            if (typeof callback === "function") {
                callback({ ok: true, settings });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Save Backup Settings
    socket.on("saveBackupSettings", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (data) {
                if (data.autoEnabled !== undefined) {
                    await Settings.set("backup_auto_enabled", Boolean(data.autoEnabled));
                }
                if (data.autoFrequency) {
                    await Settings.set("backup_auto_frequency", data.autoFrequency);
                }
                if (data.autoTime) {
                    await Settings.set("backup_auto_time", data.autoTime);
                }
                if (data.retentionCount !== undefined) {
                    await Settings.set("backup_retention_count", Number(data.retentionCount));
                }
                if (data.retentionAgeDays !== undefined) {
                    await Settings.set("backup_retention_age_days", Number(data.retentionAgeDays));
                }
                if (data.minKeep !== undefined) {
                    await Settings.set("backup_min_keep", Number(data.minKeep));
                }
                if (data.autoCleanup !== undefined) {
                    await Settings.set("backup_auto_cleanup", Boolean(data.autoCleanup));
                }
                if (data.storageLimitMB !== undefined) {
                    await Settings.set("backup_storage_limit_mb", Number(data.storageLimitMB));
                }
                if (data.storageWarningPercent !== undefined) {
                    await Settings.set("backup_storage_warning_percent", Number(data.storageWarningPercent));
                }
                if (data.storageCriticalPercent !== undefined) {
                    await Settings.set("backup_storage_critical_percent", Number(data.storageCriticalPercent));
                }
            }
            if (typeof callback === "function") {
                callback({ ok: true });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Create a new platform backup
    socket.on("createBackup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            const options = {
                userId: socket.userID,
                type: (data && data.type) || "manual",
                password: (data && data.password) || "",
            };
            const result = await BackupEngine.createBackup(options);
            if (typeof callback === "function") {
                callback({ ok: true, result });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Upload a backup file archive
    socket.on("uploadBackup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (!data || !data.base64 || !data.fileName) {
                throw new Error("Backup file content and original filename are required.");
            }
            const result = await BackupEngine.uploadBackup(data.base64, data.fileName);
            if (typeof callback === "function") {
                callback({ ok: true, result });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Verify a backup file
    socket.on("verifyBackup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (!data || !data.fileName) {
                throw new Error("Backup filename is required.");
            }
            const verification = await BackupEngine.verifyBackup(data.fileName, data.password || "");
            if (typeof callback === "function") {
                callback({ ok: true, verification });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Restore platform state from a backup archive
    socket.on("restoreBackup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (!data || !data.fileName) {
                throw new Error("Backup filename is required for restore.");
            }
            const result = await BackupEngine.restoreBackup(data.fileName, data.password || "", {
                userId: socket.userID,
            });
            if (typeof callback === "function") {
                callback({ ok: true, result });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Delete a backup file
    socket.on("deleteBackup", async (data, callback) => {
        try {
            checkLogin(socket);
            await SuperAdmin.assertSuperAdmin(socket.userID);
            if (!data || !data.fileName) {
                throw new Error("Backup filename is required.");
            }
            const success = await BackupEngine.deleteBackup(data.fileName);
            if (typeof callback === "function") {
                callback({ ok: true, success });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });
};
