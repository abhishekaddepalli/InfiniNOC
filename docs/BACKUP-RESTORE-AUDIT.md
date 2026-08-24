# InfiniNOC — Backup & Restore Audit Report (Phase 1)

## 1. Executive Summary
This document provides a thorough technical audit of the current InfiniNOC Backup & Restore system (`server/backup.js`, `server/socket-handlers/backup-socket-handler.js`, and `src/components/settings/BackupRestore.vue`).

---

## 2. Technical Findings Matrix

| Dimension | Current Implementation | Status / Gap Analysis |
| :--- | :--- | :--- |
| **Backup Storage Location** | Hardcoded `./data/backups/` (`path.join(Database.dataDir, "backups")`). | Local filesystem only. No storage abstraction, disk limit checking, or external storage (S3). |
| **Backup Archive Format** | `.infinibackup` (Gzip Tar archive containing `manifest.json`, `kuma.db`, `upload/` directory, optionally AES-256-GCM encrypted). | Format is valid and versioned (`backupVersion: "1"`), but lacks lock attributes and granular metadata. |
| **Current Backup Contents** | Full SQLite database file (`kuma.db`) containing all tables (`monitor`, `monitor_group`, `notification`, `user`, `status_page`, `incident`, `organization`, `saas_subscription`, etc.) and `./data/upload/` branding assets. | Complete platform database + persistent uploaded media assets. |
| **Current Restore Contents** | Overwrites `kuma.db` and `./data/upload/` directory. Automatically generates a pre-restore safety backup (`infininoc-backup-pre-restore-*.infinibackup`). | Full platform restoration working cleanly with safety snapshot safeguard. |
| **Retention Implementation** | UI dropdown for retention limit (7, 30, 90), but **no automated retention worker/cleanup engine** in the backend. Old files accumulate indefinitely. | **Missing Backend Retention Engine & Cleanup Job**. |
| **Scheduler Implementation** | UI controls for Daily/Weekly schedule, but **no server-side background cron/timer** executing automatic backups. | **Missing Backend Backup Scheduler**. |
| **Checksum Verification** | SHA-256 calculated via `crypto.createHash("sha256")` and saved in response payload. `verifyBackup` validates SHA-256 and `manifest.json`. | Checksum logic is solid. |
| **Authorization & Security** | Socket handlers enforce `checkLogin(socket)` and `SuperAdmin.assertSuperAdmin(socket.userID)`. Non-SuperAdmin users cannot trigger backup/restore. | Socket security is enforced for SuperAdmin. **Missing authenticated HTTP download API endpoint** (`/api/platform/backups/:id/download`). |
| **Database Tracking** | Backup metadata is dynamically read from disk files (`stat` & `manifest.json`). No dedicated `backup_history` or `backup_setting` table in SQLite. | Filesystem-driven. Needs settings persistence for scheduler, retention, storage limits, and lock state. |

---

## 3. Detailed Breakdown of Missing Capabilities (To Be Implemented)

1. **Authenticated Backend Download API**:
   - Currently, backup files reside in `./data/backups/` and cannot be downloaded by the browser.
   - Required: `GET /api/platform/backups/:fileName/download` endpoint with SuperAdmin session/JWT authorization, path-traversal protection, and streaming `Content-Disposition`.
2. **Backend Backup Scheduler & Retention Engine**:
   - Server-side cron/job runner for scheduled automated backups (Daily/Weekly at specified time).
   - Smart retention policy engine: Retention by count (keep last N), retention by age (older than N days), minimum backup protection (never reduce below 3), automatic cleanup after successful backup, cleanup preview.
3. **Backup Protection / Locking**:
   - Ability to lock important backups (`🔒 Protected`) so retention engine never deletes them.
4. **Storage & Capacity Management**:
   - Real-time disk storage calculation (`Storage Used`, `Storage Limit`, `Storage Remaining`, `% Used progress bar`).
   - Storage warning thresholds (80% warning, 90% critical) and insufficient storage pre-check before backup creation.
5. **UI & Metadata Enhancements**:
   - History table with `Download`, `Lock/Unlock`, `Details` modal, filters (All, Manual, Auto, Pre-Update, Pre-Restore, Locked), and responsive mobile cards.
   - Real-time stage progress indicators during backup creation and restoration.
6. **Update & Restore Integration**:
   - Seamless integration with Update Center for automatic pre-update backups.
