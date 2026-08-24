# InfiniNOC Backup & Restore Documentation

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Document**: `docs/BACKUP-RESTORE.md`  

---

## Overview
InfiniNOC features a native, server-side backup and restore engine designed for enterprise ISP/NOC operations.

---

## Archive Specification
- **Format**: `.infinibackup` (Gzip-compressed tarball with SHA-256 integrity checksums).
- **Optional Encryption**: AES-256-GCM authenticated encryption using PBKDF2 key derivation (100,000 iterations).
- **Directory Location**: `./data/backups/`.

---

## Contents Manifest (`manifest.json`)
```json
{
  "product": "InfiniNOC",
  "backupVersion": "1",
  "applicationVersion": "1.0.0",
  "databaseVersion": "knex-migrated",
  "createdAt": "2026-08-19T13:00:00.000Z",
  "createdBy": 1,
  "type": "manual",
  "checksum": "sha256-hash-value",
  "encrypted": false
}
```

---

## RBAC Security
Access to create, verify, restore, or delete backups is strictly enforced server-side and requires `SUPER_ADMIN` platform permissions.
