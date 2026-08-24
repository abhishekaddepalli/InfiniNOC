const fs = require("fs");
const fsAsync = fs.promises;
const path = require("path");
const crypto = require("crypto");
const tar = require("tar");
const Database = require("./database");
const { log } = require("../src/util");
const productConfig = require("../config/product.json");

class BackupEngine {
    /**
     * Get backup directory path
     * @returns {string} Backup directory path
     */
    static getBackupDir() {
        const dir = path.join(Database.dataDir, "backups");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    /**
     * Get sanitized file path preventing path traversal
     * @param {string} fileName Target file name
     * @returns {string} Absolute sanitized file path
     */
    static getSanitizedFilePath(fileName) {
        const safeName = path.basename(fileName);
        return path.join(this.getBackupDir(), safeName);
    }

    /**
     * Check if a backup file is protected / locked
     * @param {string} fileName Target file name
     * @returns {boolean} True if locked
     */
    static isBackupLocked(fileName) {
        const safeName = path.basename(fileName);
        const lockPath = path.join(this.getBackupDir(), `${safeName}.lock`);
        return fs.existsSync(lockPath);
    }

    /**
     * Lock or unlock a backup file
     * @param {string} fileName Target file name
     * @param {boolean} locked Desired lock state
     * @returns {Promise<boolean>} True if action succeeded
     */
    static async setBackupLock(fileName, locked = true) {
        const safeName = path.basename(fileName);
        const lockPath = path.join(this.getBackupDir(), `${safeName}.lock`);
        if (locked) {
            await fsAsync.writeFile(lockPath, JSON.stringify({ lockedAt: new Date().toISOString() }), "utf8");
            log.info("backup-engine", `Protected / Locked backup file: ${safeName}`);
        } else {
            if (fs.existsSync(lockPath)) {
                await fsAsync.unlink(lockPath);
                log.info("backup-engine", `Unlocked backup file: ${safeName}`);
            }
        }
        return true;
    }

    /**
     * Calculate SHA-256 hash of a file
     * @param {string} filePath Target file path
     * @returns {Promise<string>} Hex digest hash string
     */
    static async calculateChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("sha256");
            const stream = fs.createReadStream(filePath);
            stream.on("data", (data) => hash.update(data));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", (err) => reject(err));
        });
    }

    /**
     * Format clean download filename e.g. infininoc-backup-YYYY-MM-DD-HHmm.infinibackup
     * @param {string} fileName Original filename
     * @param {Date|string} date Creation date
     * @returns {string} Clean download filename
     */
    static getDownloadFileName(fileName, date) {
        const d = new Date(date || Date.now());
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");

        let prefix = "infininoc-backup";
        if (fileName.includes("pre-update")) {
            prefix = "infininoc-backup-pre-update";
        } else if (fileName.includes("pre-restore")) {
            prefix = "infininoc-backup-pre-restore";
        } else if (fileName.includes("auto")) {
            prefix = "infininoc-backup-auto";
        }

        return `${prefix}-${yyyy}-${mm}-${dd}-${hh}${min}.infinibackup`;
    }

    /**
     * Calculate detailed backup storage statistics
     * @param {number} limitMB Configured storage limit in MB (default 1024MB = 1GB)
     * @returns {Promise<object>} Storage statistics
     */
    static async getStorageStats(limitMB = 1024) {
        const backupDir = this.getBackupDir();
        const files = await fsAsync.readdir(backupDir);
        const backupFiles = files.filter((f) => f.endsWith(".infinibackup"));

        let totalBytes = 0;
        let lockedCount = 0;

        for (const fileName of backupFiles) {
            const filePath = path.join(backupDir, fileName);
            const stats = await fsAsync.stat(filePath);
            totalBytes += stats.size;
            if (this.isBackupLocked(fileName)) {
                lockedCount++;
            }
        }

        const totalMB = totalBytes / (1024 * 1024);
        const remainingMB = Math.max(0, limitMB - totalMB);
        const percentUsed = limitMB > 0 ? Math.min(100, (totalMB / limitMB) * 100) : 0;
        const percentRemaining = Math.max(0, 100 - percentUsed);

        const isWarning = percentUsed >= 80 && percentUsed < 90;
        const isCritical = percentUsed >= 90;

        return {
            totalBackups: backupFiles.length,
            lockedBackups: lockedCount,
            totalBytes: totalBytes,
            totalMB: Number(totalMB.toFixed(2)),
            limitMB: limitMB,
            remainingMB: Number(remainingMB.toFixed(2)),
            percentUsed: Number(percentUsed.toFixed(2)),
            percentRemaining: Number(percentRemaining.toFixed(2)),
            isWarning: isWarning,
            isCritical: isCritical,
        };
    }

    /**
     * Create a new InfiniNOC backup archive
     * @param {object} options Options object
     * @returns {Promise<object>} Result object
     */
    static async createBackup(options = {}) {
        const userId = options.userId || 1;
        const type = options.type || "manual";
        const password = options.password || "";
        const backupDir = this.getBackupDir();

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const baseName = `infininoc-backup-${type}-${timestamp}`;
        const archivePath = path.join(backupDir, `${baseName}.infinibackup`);
        const tempFolder = path.join(backupDir, `temp-${timestamp}`);

        try {
            await fsAsync.mkdir(tempFolder, { recursive: true });

            // 1. Copy database file if exists
            const dbPath = Database.sqlitePath || path.join(Database.dataDir, "kuma.db");
            if (fs.existsSync(dbPath)) {
                await fsAsync.copyFile(dbPath, path.join(tempFolder, "kuma.db"));
            }

            // 2. Copy uploads folder if exists
            const uploadDir = Database.uploadDir || path.join(Database.dataDir, "upload");
            if (fs.existsSync(uploadDir)) {
                const tempUpload = path.join(tempFolder, "upload");
                await fsAsync.cp(uploadDir, tempUpload, { recursive: true });
            }

            // 3. Create Manifest
            const manifest = {
                product: productConfig.productName || "InfiniNOC",
                backupVersion: "1",
                applicationVersion: productConfig.version || "1.0.0",
                databaseVersion: Database.patched ? "knex-migrated" : "v10",
                createdAt: new Date().toISOString(),
                createdBy: userId,
                type: type,
                encrypted: Boolean(password),
                contents: {
                    monitors: true,
                    monitorHistory: true,
                    notifications: true,
                    organizations: true,
                    incidents: true,
                    statusPages: true,
                    settings: true,
                    tags: true,
                    probes: true,
                },
            };

            await fsAsync.writeFile(
                path.join(tempFolder, "manifest.json"),
                JSON.stringify(manifest, null, 2),
                "utf8"
            );

            // 4. Compress folder into tar.gz
            const tempTarPath = path.join(backupDir, `${baseName}.tar.gz`);
            await tar.c(
                {
                    gzip: true,
                    file: tempTarPath,
                    cwd: tempFolder,
                },
                ["manifest.json", "kuma.db", fs.existsSync(path.join(tempFolder, "upload")) ? "upload" : ""].filter(Boolean)
            );

            // 5. Apply Encryption if password is provided
            if (password) {
                const rawBuffer = await fsAsync.readFile(tempTarPath);
                const salt = crypto.randomBytes(16);
                const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
                const iv = crypto.randomBytes(12);
                const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
                const encrypted = Buffer.concat([cipher.update(rawBuffer), cipher.final()]);
                const authTag = cipher.getAuthTag();

                // Format: SALT (16b) + IV (12b) + TAG (16b) + ENCRYPTED DATA
                const finalBuffer = Buffer.concat([salt, iv, authTag, encrypted]);
                await fsAsync.writeFile(archivePath, finalBuffer);
                await fsAsync.unlink(tempTarPath);
            } else {
                await fsAsync.rename(tempTarPath, archivePath);
            }

            // Clean temp folder
            await fsAsync.rm(tempFolder, { recursive: true, force: true });

            // 6. Calculate checksum & file metadata
            const checksum = await this.calculateChecksum(archivePath);
            const stats = await fsAsync.stat(archivePath);

            log.info("backup-engine", `Backup created successfully: ${path.basename(archivePath)} (${stats.size} bytes)`);

            return {
                ok: true,
                fileName: path.basename(archivePath),
                filePath: archivePath,
                size: stats.size,
                checksum: checksum,
                manifest: manifest,
            };
        } catch (error) {
            log.error("backup-engine", `Failed to create backup: ${error.message}`);
            if (fs.existsSync(tempFolder)) {
                await fsAsync.rm(tempFolder, { recursive: true, force: true });
            }
            throw error;
        }
    }

    /**
     * Save an uploaded backup file buffer into ./data/backups/
     * @param {string} base64Data Base64 string content
     * @param {string} originalName Target file name
     * @returns {Promise<object>} Upload result object
     */
    static async uploadBackup(base64Data, originalName) {
        const backupDir = this.getBackupDir();
        const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const targetPath = path.join(backupDir, safeName);

        const buffer = Buffer.from(base64Data, "base64");
        await fsAsync.writeFile(targetPath, buffer);
        log.info("backup-engine", `Uploaded backup archive saved: ${safeName}`);

        const verification = await this.verifyBackup(safeName);
        return {
            ok: true,
            fileName: safeName,
            size: buffer.length,
            verification: verification,
        };
    }

    /**
     * List all available backup files
     * @returns {Promise<Array>} Backup files array
     */
    static async getBackupList() {
        const backupDir = this.getBackupDir();
        const files = await fsAsync.readdir(backupDir);
        const backupFiles = files.filter((f) => f.endsWith(".infinibackup"));

        const list = [];
        for (const fileName of backupFiles) {
            const filePath = path.join(backupDir, fileName);
            const stats = await fsAsync.stat(filePath);
            const checksum = await this.calculateChecksum(filePath);
            const isLocked = this.isBackupLocked(fileName);

            let manifest = null;
            let status = "VERIFIED";
            try {
                const verification = await this.verifyBackup(fileName);
                manifest = verification.manifest;
            } catch (_) {
                status = "CORRUPTED";
            }

            if (isLocked) {
                status = "LOCKED";
            }

            const createdAt = stats.mtime.toISOString();
            const downloadName = this.getDownloadFileName(fileName, createdAt);

            list.push({
                fileName: fileName,
                downloadName: downloadName,
                size: stats.size,
                createdAt: createdAt,
                checksum: checksum,
                isLocked: isLocked,
                status: status,
                manifest: manifest || {
                    product: "InfiniNOC",
                    applicationVersion: "1.0.0",
                    type: fileName.includes("pre-update")
                        ? "pre-update"
                        : fileName.includes("pre-restore")
                            ? "pre-restore"
                            : fileName.includes("auto")
                                ? "auto"
                                : "manual",
                },
            });
        }

        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Verify an existing backup file integrity & checksum
     * @param {string} fileName Target file name
     * @param {string} password Password string
     * @returns {Promise<object>} Verification object
     */
    static async verifyBackup(fileName, password = "") {
        const filePath = this.getSanitizedFilePath(fileName);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Backup file '${fileName}' does not exist.`);
        }

        const checksum = await this.calculateChecksum(filePath);
        let tarBuffer = await fsAsync.readFile(filePath);

        if (password || tarBuffer.length > 44) {
            try {
                const salt = tarBuffer.slice(0, 16);
                const iv = tarBuffer.slice(16, 28);
                const authTag = tarBuffer.slice(28, 44);
                const encryptedData = tarBuffer.slice(44);

                const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
                const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
                decipher.setAuthTag(authTag);
                tarBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
            } catch (_) {
                // Was not encrypted or decryption failed
            }
        }

        const tempFolder = path.join(this.getBackupDir(), `verify-${Date.now()}`);
        await fsAsync.mkdir(tempFolder, { recursive: true });

        const tempTarPath = path.join(tempFolder, "temp.tar.gz");
        await fsAsync.writeFile(tempTarPath, tarBuffer);

        try {
            await tar.x({
                file: tempTarPath,
                cwd: tempFolder,
            });

            const manifestPath = path.join(tempFolder, "manifest.json");
            if (!fs.existsSync(manifestPath)) {
                throw new Error("Invalid backup archive: missing manifest.json");
            }

            const manifest = JSON.parse(await fsAsync.readFile(manifestPath, "utf8"));
            await fsAsync.rm(tempFolder, { recursive: true, force: true });

            return {
                ok: true,
                valid: true,
                checksum: checksum,
                manifest: manifest,
            };
        } catch (err) {
            if (fs.existsSync(tempFolder)) {
                await fsAsync.rm(tempFolder, { recursive: true, force: true });
            }
            throw new Error(`Backup validation failed: ${err.message}`);
        }
    }

    /**
     * Restore InfiniNOC platform state from a backup archive
     * @param {string} fileName Backup filename
     * @param {string} password Optional encryption password
     * @param {object} options Options object
     * @returns {Promise<object>} Restore result object
     */
    static async restoreBackup(fileName, password = "", options = {}) {
        const userId = options.userId || 1;
        log.info("backup-engine", `Initiating restore from backup '${fileName}' by user ${userId}...`);

        // 1. Verify backup archive & extract manifest
        const verification = await this.verifyBackup(fileName, password);
        if (!verification || !verification.valid) {
            throw new Error("Backup verification failed prior to restore.");
        }

        // 2. Create pre-restore safety backup first
        log.info("backup-engine", "Creating pre-restore safety backup snapshot...");
        const safetyBackup = await this.createBackup({
            userId: userId,
            type: "pre-restore",
        });

        // 3. Extract contents to temporary directory
        const filePath = this.getSanitizedFilePath(fileName);
        let tarBuffer = await fsAsync.readFile(filePath);

        if (password) {
            const salt = tarBuffer.slice(0, 16);
            const iv = tarBuffer.slice(16, 28);
            const authTag = tarBuffer.slice(28, 44);
            const encryptedData = tarBuffer.slice(44);

            const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(authTag);
            tarBuffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        }

        const restoreTempFolder = path.join(this.getBackupDir(), `restore-temp-${Date.now()}`);
        await fsAsync.mkdir(restoreTempFolder, { recursive: true });

        const tempTarPath = path.join(restoreTempFolder, "temp.tar.gz");
        await fsAsync.writeFile(tempTarPath, tarBuffer);

        try {
            await tar.x({
                file: tempTarPath,
                cwd: restoreTempFolder,
            });

            // 4. Overwrite Database File (`kuma.db`)
            const restoredDbPath = path.join(restoreTempFolder, "kuma.db");
            const targetDbPath = Database.sqlitePath || path.join(Database.dataDir, "kuma.db");

            if (fs.existsSync(restoredDbPath)) {
                await fsAsync.copyFile(restoredDbPath, targetDbPath);
                log.info("backup-engine", `Restored database file replaced at ${targetDbPath}`);
            }

            // 5. Overwrite Uploads Directory (`./data/upload`)
            const restoredUploadDir = path.join(restoreTempFolder, "upload");
            const targetUploadDir = Database.uploadDir || path.join(Database.dataDir, "upload");

            if (fs.existsSync(restoredUploadDir)) {
                await fsAsync.rm(targetUploadDir, { recursive: true, force: true });
                await fsAsync.cp(restoredUploadDir, targetUploadDir, { recursive: true });
                log.info("backup-engine", `Restored uploads directory replaced at ${targetUploadDir}`);
            }

            // Clean temporary folder
            await fsAsync.rm(restoreTempFolder, { recursive: true, force: true });

            log.info("backup-engine", `Platform restore successfully completed from ${fileName}!`);

            return {
                ok: true,
                fileName: fileName,
                safetyBackupCreated: safetyBackup.fileName,
                manifest: verification.manifest,
                restoredAt: new Date().toISOString(),
            };
        } catch (error) {
            log.error("backup-engine", `Restore execution failed: ${error.message}`);
            if (fs.existsSync(restoreTempFolder)) {
                await fsAsync.rm(restoreTempFolder, { recursive: true, force: true });
            }
            throw new Error(`Platform restore failed: ${error.message}`);
        }
    }

    /**
     * Preview backups that would be deleted based on retention settings
     * @param {object} customSettings Custom retention settings
     * @returns {Promise<object>} Retention preview metrics
     */
    static async previewRetentionCleanup(customSettings = {}) {
        const { Settings } = require("./settings");
        const list = await this.getBackupList();

        const countLimit = customSettings.retentionCount !== undefined
            ? Number(customSettings.retentionCount)
            : ((await Settings.get("backup_retention_count")) || 30);

        const ageDaysLimit = customSettings.retentionAgeDays !== undefined
            ? Number(customSettings.retentionAgeDays)
            : ((await Settings.get("backup_retention_age_days")) || 90);

        const minKeep = customSettings.minKeep !== undefined
            ? Number(customSettings.minKeep)
            : ((await Settings.get("backup_min_keep")) || 3);

        const now = new Date();
        const candidates = [];
        let freedBytes = 0;

        // Never delete locked backups or the newest backup (index 0)
        for (let i = 1; i < list.length; i++) {
            const b = list[i];
            if (b.isLocked) {
                continue;
            }

            const ageDays = (now - new Date(b.createdAt)) / (1000 * 60 * 60 * 24);
            const isExceedingCount = countLimit > 0 && i >= countLimit;
            const isExceedingAge = ageDaysLimit > 0 && ageDays > ageDaysLimit;

            if (isExceedingCount || isExceedingAge) {
                candidates.push(b);
            }
        }

        // Respect Minimum Backups Protection
        let finalDeleteList = [...candidates];
        const projectedRemaining = list.length - finalDeleteList.length;
        if (projectedRemaining < minKeep) {
            const allowedToDelete = Math.max(0, list.length - minKeep);
            finalDeleteList = finalDeleteList.slice(0, allowedToDelete);
        }

        for (const b of finalDeleteList) {
            freedBytes += b.size || 0;
        }

        const freedMB = Number((freedBytes / (1024 * 1024)).toFixed(2));
        const retainedCount = list.length - finalDeleteList.length;

        return {
            totalStored: list.length,
            toDeleteCount: finalDeleteList.length,
            freedBytes: freedBytes,
            freedMB: freedMB,
            retainedCount: retainedCount,
            deleteCandidates: finalDeleteList.map((b) => ({ fileName: b.fileName, size: b.size, createdAt: b.createdAt })),
        };
    }

    /**
     * Execute retention cleanup of expired backups according to policy
     * @param {object} customSettings Custom retention settings
     * @returns {Promise<object>} Retention cleanup execution summary
     */
    static async runRetentionCleanup(customSettings = {}) {
        const preview = await this.previewRetentionCleanup(customSettings);
        let deletedCount = 0;
        let actualFreedBytes = 0;

        for (const b of preview.deleteCandidates) {
            try {
                const deleted = await this.deleteBackup(b.fileName);
                if (deleted) {
                    deletedCount++;
                    actualFreedBytes += b.size || 0;
                }
            } catch (err) {
                log.warn("backup-engine", `Retention cleanup skipped file '${b.fileName}': ${err.message}`);
            }
        }

        const freedMB = Number((actualFreedBytes / (1024 * 1024)).toFixed(2));
        log.info("backup-engine", `Retention cleanup completed: Deleted ${deletedCount} backups, freed ${freedMB} MB.`);

        return {
            ok: true,
            deletedCount: deletedCount,
            freedMB: freedMB,
            retainedCount: preview.totalStored - deletedCount,
            executedAt: new Date().toISOString(),
        };
    }

    /**
     * Delete a backup file
     * @param {string} fileName Target file name
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteBackup(fileName) {
        const filePath = this.getSanitizedFilePath(fileName);
        if (this.isBackupLocked(fileName)) {
            throw new Error(`This backup is protected. Unlock it first to delete manually.`);
        }
        if (fs.existsSync(filePath)) {
            await fsAsync.unlink(filePath);
            const lockPath = `${filePath}.lock`;
            if (fs.existsSync(lockPath)) {
                await fsAsync.unlink(lockPath);
            }
            log.info("backup-engine", `Deleted backup: ${fileName}`);
            return true;
        }
        return false;
    }
}

module.exports = BackupEngine;
