# InfiniNOC Platform Operations Audit (Backup, Restore, PWA, Updates & Rollback)

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Audit Document**: `docs/PLATFORM-OPERATIONS-AUDIT.md`  

---

## 1. Current Backup Architecture
- **Upstream State**: No native full-platform backup or restore mechanism existed in upstream code beyond basic database compaction (`Database.shrink()`) and manual file copying of `kuma.db`.
- **Target InfiniNOC Architecture**: Server-side backup module (`server/backup.js`) generating `.infinibackup` archives containing:
  - `manifest.json` (metadata, app version, db schema version, created_at, checksum).
  - SQLite database dump or SQL dump (`kuma.db`).
  - User uploads directory (`./data/upload`).
  - Organization state, RBAC roles, incidents, SNMP profiles, and SLA reports.
  - Cryptographic integrity protection via SHA-256 checksums and optional AES-256-GCM encryption.

---

## 2. Current Persistence Architecture
- **Root Data Directory**: `./data` (environment variable `DATA_DIR` configurable).
- **SQLite Database Path**: `./data/kuma.db`.
- **User Uploads**: `./data/upload/`.
- **Screenshots**: `./data/screenshots/`.
- **Docker TLS Certificates**: `./data/docker-tls/`.

---

## 3. Current Docker Architecture
- **Production Dockerfile**: Root `Dockerfile` multi-stage build starting from `node:20-slim`.
- **Compose Service**: `docker-compose.yml` deploying `infiniforge/infininoc:1.0.0` on port `3001` with volume `./data:/app/data`.
- **Health Check**: `curl -f http://localhost:3001/api/entry-page || exit 1`.

---

## 4. Current Version Architecture
- **Version Source-of-Truth**: `VERSION` file (`1.0.0`) and `config/product.json` (`"version": "1.0.0"`).
- **Package Metadata**: `package.json` specifies `"version": "2.5.0"` (to be synced to `1.0.0`).

---

## 5. Current GitHub / Release Architecture
- **CI/CD Workflow**: `.github/workflows/ci.yml` builds and pushes Docker images to GitHub Container Registry (`ghcr.io/infiniforge/infininoc`).
- **Release Metadata**: Controlled release format `release.json` published via GitHub Releases under `infiniforge/infininoc`.

---

## 6. Current PWA Status
- **Manifest**: `public/manifest.json` configured with InfiniNOC brand metadata (`theme_color: "#ff9933"`).
- **Service Worker**: `public/serviceWorker.js` manages webpush notifications.
- **Gaps to Address**: Need PWA installation trigger prompt, offline network banner in `App.vue`, and static asset cache versioning without caching dynamic WebSocket monitoring telemetry.

---

## 7. Current Update Mechanism
- **Upstream State**: `server/check-version.js` queries legacy upstream URL `https://uptime.kuma.pet/version`.
- **Target InfiniNOC Engine**: `server/update-engine.js` querying InfiniNOC GitHub Releases endpoint (`https://api.github.com/repos/infiniforge/infininoc/releases/latest`), providing pre-update compatibility checks, safety backups, maintenance mode, and rollback targets.

---

## 8. Current Database Migration Mechanism
- **Knex & SimpleMigrationServer**: Managed in `server/database.js` and `server/utils/simple-migration-server.js` executing patch SQL scripts.

---

## 9. Current Coolify Deployment Architecture
- Containerized deployment running standard Docker container behind reverse proxy with persistent `/app/data` volume and WebSocket passthrough.

---

## 10. Safe Implementation Strategy
1. **RBAC & Super Admin Enforcement**: Restrict platform backup, restore, update, and rollback operations strictly to `SUPER_ADMIN` users.
2. **Safety Backup First**: Automatically trigger a pre-restore and pre-update safety backup prior to executing any destructive operations.
3. **Downgrade Schema Guard**: Block unsafe database downgrades if reverse migrations are unavailable; require compatible backup restoration first.
4. **Network-First PWA Caching**: Ensure PWA service worker caches static CSS/JS assets only and never caches dynamic telemetry or authentication data.

---

## 11. Identified Risks & Mitigations
- **Risk 1: Corrupted Backup Restoration**: Prevented by verifying SHA-256 checksums before applying any backup.
- **Risk 2: Stale Cache in PWA**: Prevented by versioning cache keys (`infininoc-static-v1.0.0`) and evicting old caches upon service worker activation.
- **Risk 3: Unintentional Data Overwrite**: Prevented by requiring explicit modal confirmation with type-in verification.

---

## 12. Files to be Created / Modified

### New Backend Modules:
- `server/backup.js` [NEW]
- `server/update-engine.js` [NEW]
- `server/socket-handlers/backup-socket-handler.js` [NEW]
- `server/socket-handlers/update-socket-handler.js` [NEW]

### New Frontend Views & Components:
- `src/components/settings/BackupRestore.vue` [NEW]
- `src/components/settings/UpdateCenter.vue` [NEW]

### Existing Files to Modify:
- `server/server.js` [MODIFY]
- `server/check-version.js` [MODIFY]
- `src/pages/Settings.vue` [MODIFY]
- `src/components/settings/About.vue` [MODIFY]
- `src/router.js` [MODIFY]
- `public/serviceWorker.js` [MODIFY]
- `src/App.vue` [MODIFY]
- `package.json` [MODIFY]

### Platform Operations Documentation:
- `docs/BACKUP-RESTORE.md` [NEW]
- `docs/PWA.md` [NEW]
- `docs/UPDATES.md` [NEW]
- `docs/ROLLBACK.md` [NEW]
