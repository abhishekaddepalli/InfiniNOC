# InfiniNOC Settings Operations & Complete Backup/Restore Audit

**Date**: August 20, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Audit Document**: `docs/SETTINGS-OPERATIONS-AUDIT.md`  

---

## 1. Executive Summary
This audit inspects the current InfiniNOC Settings navigation, visual structure, About page, Update Center, and Backup & Restore subsystem. The objective is to identify existing functionality versus UI mockups, establish data integrity boundaries for a full platform Restore engine, and prepare a unified SaaS design system alignment.

---

## 2. Settings Sidebar & Information Architecture Audit
- **Current Navigation State**:
  - `src/pages/Settings.vue` currently exposes 15 items in a single list without clear category grouping:
    `General`, `Appearance`, `Notifications`, `Reverse Proxy`, `Tags`, `Monitor History`, `Docker Hosts`, `Remote Browsers`, `Security`, `API Keys`, `Proxies`, `Backup & Restore`, `Updates`, `About`, `Third-Party & Licensing Notices`.
  - **Issues Identified**:
    1. Lack of section headers (e.g. `GENERAL`, `MONITORING`, `SECURITY`, `PLATFORM`).
    2. `Third-Party & Licensing Notices` is exposed as a customer-facing settings sub-menu item.
    3. Mobile view uses cramped list items without proper category grouping or icons.
- **Target Navigation State**:
  - Group into distinct section headers:
    - **GENERAL**: General, Appearance, Notifications
    - **MONITORING**: Reverse Proxy, Tags, Monitor History, Docker Hosts, Remote Browsers
    - **SECURITY**: Security, API Keys, Proxies
    - **PLATFORM**: Backup & Restore, Updates, About
  - Remove `Third-Party & Licensing Notices` from normal Settings navigation while preserving the internal LICENSE files in the source distribution as required by open-source licensing.

---

## 3. About Page (`/settings/about`) Audit
- **Current State**:
  - Uses `About.vue` with a simple card, displaying version numbers, copyright info, and a link to Third-Party & Licensing Notices.
  - Legacy customer-facing text reference (`Powered by Uptime Kuma core`) exists in translation keys (`src/lang/en.json`) and must be removed from customer-facing views.
- **Gaps to Address**:
  - Replace current layout with a modern SaaS Product Identity card (`InfiniNOC Icon`, `v1.0.0`, `● Production Release`, `Infiniforge Technologies`, `Know Your Network. Before Your Customers Do.`).
  - Add compact System Information grid reading real runtime values: Application Version (`1.0.0`), Build Environment (`Production`), Database (`SQLite / Knex Schema`), Node.js Runtime (`v24.16.0`), Deployment (`Docker / Coolify`).
  - Add real-time Update Status Card reading update metadata.
  - Remove customer-facing `Powered by Uptime Kuma core` text and remove `Third-Party & Licensing Notices` navigation button.

---

## 4. Updates Page (`/settings/updates`) Audit
- **Current State**:
  - `src/components/settings/UpdateCenter.vue` exists with release check, release notes card, pre-update safety check modal, and version history.
  - `server/update-engine.js` queries `infiniforge/infininoc` GitHub releases.
- **Gaps to Address**:
  - UI refinement to match dashboard cards (soft borders, clean typography, badge badges, responsive cards for mobile).
  - Version history timeline redesign with responsive stacked cards on mobile screens.
  - Safe Rollback mechanism: Application software rollback vs Database schema compatibility check. If target version has incompatible database schema changes, disable rollback and instruct user to restore a compatible backup snapshot.

---

## 5. Backup & Restore Architecture Audit

### 5.1 Existing Backup Implementation (`server/backup.js`)
- **Implemented Functions**:
  - `BackupEngine.createBackup(options)`: Creates `.infinibackup` archive in `./data/backups/` containing `manifest.json`, `kuma.db`, `./data/upload`, optional AES-256-GCM encryption, and SHA-256 checksum.
  - `BackupEngine.getBackupList()`: Returns list of `.infinibackup` archives with file sizes and creation timestamps.
  - `BackupEngine.verifyBackup(fileName, password)`: Unpacks archive to temporary folder, verifies SHA-256 checksum, validates `manifest.json`, and cleans up.
  - `BackupEngine.deleteBackup(fileName)`: Removes file from disk.

### 5.2 Existing Restore Implementation (CRITICAL GAP)
- **Current State**:
  - Currently, `BackupEngine` in `server/backup.js` has **NO `restoreBackup()` method**.
  - `src/components/settings/BackupRestore.vue` has a UI restore modal, but it only simulates restoration using frontend timeouts (`setTimeout`).
- **Required Production Restore Engine**:
  - Server-side `BackupEngine.restoreBackup(fileName, password, options)`:
    1. Unpack archive to a temp directory.
    2. Verify SHA-256 checksum and validate `manifest.json`.
    3. Verify version compatibility with current database schema.
    4. Automatically generate a pre-restore safety backup (`infininoc-backup-pre-restore-*.infinibackup`).
    5. Close existing SQLite database connection pool (`Database.close()`).
    6. Safely replace `kuma.db` and `./data/upload/` directory.
    7. Re-initialize database connection (`Database.init()`).
    8. Execute post-restore integrity validations (check monitors count, users count, settings, notifications, status pages).
    9. Log audit log entry.
  - Drag-and-drop `.infinibackup` file upload backend handler (Socket.IO chunk upload or HTTP API multipart upload).

---

## 6. Database & Persistent Data Structure Audit

### 6.1 Persistent Directories (`DATA_DIR` = `./data`)
1. **`./data/kuma.db`**: SQLite database containing all platform state.
2. **`./data/upload/`**: User uploaded logos, status page assets, and favicon files.
3. **`./data/backups/`**: Platform backup archives (`.infinibackup`).

### 6.2 Database Schema Tables to Restore
- `monitor`: Monitor configurations, types, intervals, retry rules, notification assignments.
- `heartbeat`: Monitor status history, response times, ping metrics.
- `notification`: Notification channels, webhook parameters, credentials.
- `monitor_notification`: Monitor to notification channel mappings.
- `tag`: Platform tags and color codes.
- `monitor_tag`: Tag associations with monitors.
- `status_page`: Status page titles, slugs, domain bindings, custom CSS.
- `status_page_cname`: CNAME domain mappings.
- `incident`: Maintenance incidents, status updates, impact severity.
- `setting`: Platform settings, appearance preferences, security rules.
- `user`: User accounts, password hashes, 2FA secrets, Super Admin flags.
- `organization`: SaaS organizations, custom branding, billing plans.
- `api_key`: API tokens and permissions.
- `proxy`: HTTP/HTTPS proxy configurations.

---

## 7. Security, Authorization & Secret Handling
- **Server-Side Authorization**: All backup, restore, update, and rollback socket calls are protected by `SuperAdmin.assertSuperAdmin(socket.userID)`. Non-super-admin users are strictly denied.
- **Secrets Protection**: Database credentials, 2FA secrets, API keys, and notification tokens must NEVER be exposed in preview UI or frontend socket payloads.
- **Audit Logging**: All operations (`createBackup`, `restoreBackup`, `deleteBackup`, `verifyBackup`, `checkForUpdates`) log actor ID, timestamp, file checksums, and execution outcome to `log.info()`.

---

## 8. Theme System & Responsive Layout Audit
- **Theme Support**: Centralized CSS variables (`--bg-card`, `--text-foreground`, `--border-secondary`) used across Light, Dark, and Auto/System modes.
- **Mobile Responsive Design**: Replace tables with card lists on mobile viewports (<768px). Support viewports down to 320px without horizontal overflow.

---

## 9. Implementation Roadmap & Next Phases
- **Phase 2**: Settings Design System & Sidebar Navigation (grouped sections, remove Third-Party Notices from nav).
- **Phase 3**: About Page Redesign (compact hero, real system specs, update status, remove legacy text).
- **Phase 4**: Updates Page Redesign (Update Center UI, release notes, pre-update safety checks, rollback rules).
- **Phase 5**: Complete Backup & Restore Backend Engine (server-side `restoreBackup`, file upload handler, integrity checks).
- **Phase 6**: Backup & Restore UI & Multi-Step Restore Wizard (Drag-and-drop upload, verify, review contents, safety backup, restore execution).
- **Phase 7**: PWA, Theme & Mobile Layout QA.
- **Phase 8**: Full Regression Testing & Build Verification.
