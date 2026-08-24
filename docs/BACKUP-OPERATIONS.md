# InfiniNOC — Backup & Recovery Operations Guide

## 1. Creating Platform Backups
1. Navigate to **Settings → Platform → Backup & Restore**.
2. Click **Create Platform Backup**.
3. Select Backup Type (*Manual Full Backup* or *Pre-Update Snapshot*).
4. Optionally enter an AES-256-GCM encryption key.
5. Click **Generate Platform Snapshot**.

---

## 2. Downloading Backup Archives
1. Locate the target backup row in **Platform Backup History**.
2. Click **Download**.
3. The server streams the verified `.infinibackup` archive with standardized filename format (`infininoc-backup-YYYY-MM-DD-HHmm.infinibackup`).

---

## 3. Restoring Platform State
1. In **Platform Backup History**, click **Restore** on the desired snapshot (or drag & drop a `.infinibackup` file into the upload zone).
2. The 6-Step Multi-Step Restore Wizard will guide you through:
   - Archive Inspection
   - SHA-256 Checksum Verification
   - Content Review
   - Schema Compatibility Check
   - Pre-Restore Safety Backup Generation
   - Final Confirmation & Platform State Replacement

---

## 4. Lock Protection (`🔒 Protected`)
- Click **Lock** on any critical backup to prevent automatic deletion by the retention cleanup engine.
- Locked backups cannot be deleted manually until explicitly unlocked.

---

## 5. Automated Scheduling & Retention Policies
- **Enable Automatic Backups**: Toggle ON/OFF.
- **Frequency & Time**: Set Daily, Weekly, 12h, or 6h schedule at desired system time (e.g. `02:00`).
- **Retention Rules**: Configure retention count (e.g. keep last 30) and age limit (e.g. 90 days).
- **Run Cleanup Now / Preview**: Click **Run Cleanup Now** to preview files that exceed retention rules before executing.

---

## 6. Troubleshooting
- **Insufficient Storage Warning**: Appears if backup storage exceeds 80% (Warning) or 90% (Critical). Adjust storage limit or delete old unlocked backups.
- **Verification Failure**: Ensures corrupted files are never restored. Run `Verify` to inspect SHA-256 integrity.
