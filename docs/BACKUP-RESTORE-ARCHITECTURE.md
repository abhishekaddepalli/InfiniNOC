# InfiniNOC — Enterprise Backup & Recovery Architecture (V2)

## 1. Overview
The InfiniNOC Enterprise Backup & Recovery system provides end-to-end platform state preservation, automated background scheduling, smart retention policies, lock protection, and authenticated disaster recovery.

---

## 2. Backup Lifecycle Architecture

```
[Trigger (Manual / Cron / Pre-Update / Pre-Restore)]
                        │
                        ▼
            [Storage Pre-Check & Quota]
                        │
                        ▼
           [Create Temp Workspace & Copy]
         (kuma.db + ./data/upload/ + manifest.json)
                        │
                        ▼
           [Tar Gzip Archive & Encryption]
                        │
                        ▼
          [SHA-256 Checksum Calculation]
                        │
                        ▼
      [Verify & Register into ./data/backups/]
                        │
                        ▼
    [Execute Safety-First Retention Cleanup]
```

---

## 3. Restore Lifecycle Architecture

```
[Initiate Restore from History / Upload]
                        │
                        ▼
    [SHA-256 Checksum & Manifest Validation]
                        │
                        ▼
   [Automatic Pre-Restore Safety Snapshot]
  (infininoc-backup-pre-restore-*.infinibackup)
                        │
                        ▼
    [Extract & Atomic Overwrite kuma.db & uploads]
                        │
                        ▼
    [Database Schema Migration & Validation]
```

---

## 4. Retention & Cleanup Engine
- **Retention Policies**:
  - **Count-based**: Keep last N backups (e.g. 30).
  - **Age-based**: Remove backups older than N days (e.g. 90 days).
  - **Minimum Backup Protection**: Always preserve at least 3 recovery points.
  - **Lock Protection (`🔒 Protected`)**: Locked backups are never deleted automatically by retention cleanup.
- **Safety Order**: Cleanup runs **ONLY AFTER** a new backup is successfully created, written, SHA-256 verified, and registered. If backup creation fails, no files are deleted.

---

## 5. Security & Authorization
- **SuperAdmin Authorization**: Platform Backup & Restore APIs are restricted to authenticated SuperAdmin users (`SuperAdmin.assertSuperAdmin`).
- **Authenticated Download**: `GET /api/platform/backups/:fileName/download?token=...` streams file content with `Content-Disposition: attachment; filename="infininoc-backup-YYYY-MM-DD-HHmm.infinibackup"`.
- **Path Traversal Protection**: All paths are sanitized using `path.basename`. Backup directory `./data/backups/` is not exposed via static web serving.

---

## 6. Storage Provider Abstraction & Future S3 Support
- Local storage provider is isolated behind `BackupEngine.getBackupDir()`.
- Interface is prepared for future S3/R2/B2 object storage stream adapters.
