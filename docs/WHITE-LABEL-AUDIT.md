# InfiniNOC Source-Level White-Label Audit & Baseline Architecture

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC  
**Baseline Version**: InfiniNOC 1.0.0 (Derived from Uptime Kuma 2.5.0 core)  

---

## 1. Current Repository State
- **Workspace Directory**: `c:\Users\THALA\Desktop\InfNocmonitor\uptime-kuma-master`
- **Git Database Status**: Local extracted codebase directory (No `.git` directory initialized).
- **Package Metadata**: `name: "uptime-kuma"`, `version: "2.5.0"`, `license: "MIT"`.
- **Frontend Build Status**: Built assets present in `dist/` compiled via Vite 5.
- **Backend Node Server**: Express + Socket.IO server running cleanly on port `3001`.

---

## 2. Git Remotes
- `git remote -v`: None (Local source tree).
- **Action Recommendation**: Initialize git baseline (`git init`), set initial branch `main`, add initial baseline commit, and connect to target company repository `infiniforge/infininoc`.

---

## 3. Current Branch
- **Active Branch**: `main` (To be initialized).

---

## 4. Current Version & Naming
- **Upstream Version**: `2.5.0`
- **InfiniNOC Version**: `1.0.0`
- **Version Source of Truth**: `VERSION` file & `config/product.json`.

---

## 5. Current Docker Architecture
- **Upstream Dockerfile**: `docker/dockerfile` relies on external upstream Docker Hub base image `louislam/uptime-kuma:base2`.
- **Target Docker Architecture**: Build an independent production Dockerfile using standard Node 20 / Debian base images, eliminating all runtime dependencies on `louislam/uptime-kuma` images.

---

## 6. Audit of Customer-Facing Branding Locations

| Location | Current String / Asset | InfiniNOC Replacement | Classification |
|---|---|---|---|
| `index.html` | `<title>Uptime Kuma</title>` | `<title>InfiniNOC</title>` | Customer-Facing (Replace) |
| `package.json` | `"name": "uptime-kuma"` | `"name": "infininoc"` | Package Metadata (Update) |
| `public/manifest.json` | `"name": "Uptime Kuma"` | `"name": "InfiniNOC"` | Customer-Facing (Replace) |
| `src/components/NocSidebar.vue` | Header text & logo | InfiniNOC 2.0 Saffron logo | Customer-Facing (Replace) |
| `src/layouts/Layout.vue` | Header title & favicon | InfiniNOC favicon & title | Customer-Facing (Replace) |
| `src/pages/Entry.vue` | Redirect logic | Commercial Marketing Landing Page | Customer-Facing (Replace) |
| `src/pages/NocMarketingLandingPage.vue` | Hero banner text | InfiniNOC product identity | Customer-Facing (Replace) |
| `src/components/settings/About.vue` | Upstream credits & repo link | InfiniNOC version & Third-Party Notices link | Customer-Facing (Replace) |
| `server/uptime-kuma-server.js` | `User-Agent: UptimeKuma/2.5.0` | `User-Agent: InfiniNOC/1.0.0` | Header String (Replace) |
| `LICENSE` | MIT Copyright 2021 Louis Lam | Preserve original MIT notice + add Infiniforge notice | Legal Notice (Preserve) |

---

## 7. Required Legal & Third-Party Notices
- **Original License**: MIT License (Copyright (c) 2021 Louis Lam).
- **Compliance Requirement**: The original copyright notice MUST be preserved in the `LICENSE` file.
- **Third-Party Attribution**: Create `docs/THIRD-PARTY-NOTICES.md` documenting:
  - Original Uptime Kuma core engine components.
  - MIT License notice.
  - Modifications made by Infiniforge Technologies.
  - Position statement: *"InfiniNOC is a modified and independently maintained commercial monitoring platform derived from open-source Uptime Kuma core."*

---

## 8. Application Icons & Assets Audit
- `public/icon.svg` — Primary vector icon.
- `public/favicon.ico` — Multi-resolution browser favicon.
- `public/apple-touch-icon.png` — iOS touch icon (180x180).
- `public/apple-touch-icon-precomposed.png` — Precomposed touch icon.
- `public/icon-192x192.png` — PWA manifest icon.
- `public/icon-512x512.png` — PWA high-res manifest icon.
- `public/icon.png` — Fallback PNG icon.

---

## 9. Current Build & CI/CD System
- **Build Engine**: Vite 5 (`config/vite.config.js`).
- **Backend Engine**: Express 4 (`server/server.js`) + Socket.IO + RedBean-Node ORM.
- **Validation**: ESLint + Stylelint + Node test runner (`test-core-integration.js`).

---

## 10. Recommended Safe White-Label Strategy
1. **Centralize Product Configuration**: Use `config/product.json` and `VERSION` file as the sole source-of-truth for product name, company, tagline, version, and branding assets.
2. **Preserve Legal Attribution**: Keep `LICENSE` intact and document origins in `docs/THIRD-PARTY-NOTICES.md`.
3. **Independent Docker Pipeline**: Write a self-contained production `Dockerfile` and `docker-compose.yml` that builds directly from local source without pulling `louislam/uptime-kuma`.
4. **Complete Documentation Suite**: Create `docs/INSTALLATION.md`, `docs/DEPLOYMENT.md`, `docs/UPGRADES.md`, `docs/ARCHITECTURE.md`, `docs/WHITE-LABEL.md`, `docs/UPSTREAM-MAINTENANCE.md`.
5. **Regression Verification**: Test login, dashboard, monitor details, ping charts, heartbeat history, WebSocket connection, and database persistence after white-labeling.

---

## 11. Complete File Modification List

- `LICENSE` [MODIFY]
- `package.json` [MODIFY]
- `VERSION` [NEW]
- `config/product.json` [MODIFY]
- `config/product.js` [MODIFY]
- `index.html` [MODIFY]
- `public/manifest.json` [MODIFY]
- `src/components/settings/About.vue` [MODIFY]
- `server/uptime-kuma-server.js` [MODIFY]
- `Dockerfile` [NEW]
- `docker-compose.yml` [NEW]
- `.github/workflows/ci.yml` [NEW]
- `docs/THIRD-PARTY-NOTICES.md` [NEW]
- `docs/WHITE-LABEL.md` [NEW]
- `docs/UPSTREAM-MAINTENANCE.md` [NEW]
- `docs/INSTALLATION.md` [NEW]
- `docs/DEPLOYMENT.md` [NEW]
- `docs/UPGRADES.md` [NEW]
- `docs/ARCHITECTURE.md` [NEW]
