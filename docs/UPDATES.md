# InfiniNOC Update Management Documentation

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Document**: `docs/UPDATES.md`  

---

## Overview
InfiniNOC features an independent platform Update Center querying official Infiniforge release endpoints without relying on upstream Uptime Kuma services.

---

## Release Sources & Channels
- **Source Endpoint**: `https://api.github.com/repos/infiniforge/infininoc/releases/latest`
- **Container Registry**: `ghcr.io/infiniforge/infininoc`
- **Supported Channels**: `Stable` (default) & `Beta`.

---

## Pre-Update Safety Verification
Before executing container upgrades, `UpdateEngine.runUpdateSafetyCheck()` evaluates:
1. Safety backup availability
2. Disk space sufficiency (`./data`)
3. Version upgrade path compatibility
4. Database schema migration safety
5. Docker registry target image readiness

---

## Pre-Update Safety Backup
All updates offer automatic pre-update snapshot generation (`infininoc-backup-pre-update-*.infinibackup`) prior to deploying new container versions.
