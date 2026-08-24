# InfiniNOC Safe Rollback & Downgrade Specification

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Document**: `docs/ROLLBACK.md`  

---

## 1. Overview
In a containerized NOC monitoring platform, software version rollbacks and database schema downgrades are distinct operations. This document outlines InfiniNOC's safe rollback architecture and safety rules.

---

## 2. Core Safety Rules
1. **Pre-Update Safety Backup Mandatory**: Every container update MUST generate a pre-update platform snapshot (`infininoc-backup-pre-update-*.infinibackup`) before applying new image tags.
2. **No Automatic Database Downgrades**: If a newer version executed database schema migrations that are non-reversible, software downgrades to an older version are strictly BLOCKED unless a compatible backup is restored.
3. **Immutable Docker Tags**: Deployments use explicit versioned tags (e.g. `ghcr.io/infiniforge/infininoc:1.0.0`) and digest hashes rather than mutating `latest`.

---

## 3. Rollback Procedure
If a newly deployed container fails post-update health checks (HTTP endpoint, database connectivity, or Socket.IO telemetry):
1. **Container Reversion**: Coolify/Docker environment switches container tag back to previous version (e.g., `infiniforge/infininoc:1.0.0`).
2. **Database Verification**: System verifies schema compatibility with previous version.
3. **Backup Restoration**: If schema was altered, user is prompted to restore the pre-update safety backup via `/settings/backup-restore`.
