# InfiniNOC v1.0.0

## Product
InfiniNOC by **Infiniforge Technologies**  
*"Know Your Network. Before Your Customers Do."*

## Tag
`v1.0.0`

## Baseline commit
`85158169d599eb2a98fddfe107146000c343a652` (with release metadata commits tagged as `v1.0.0`)

## Runtime
- **Operating System**: Ubuntu 24.04.x LTS (x86_64)
- **Node.js**: v22.23.2
- **npm**: 10.x

## Database
- **Physical Server**: MySQL 8.0.46 (Community Server)
- **Database Name**: `kuma`
- **Application Database Dialect Setting**: `"type": "mariadb"` in `data/db-config.json` (MySQL-family connection driver)
- **Connection**: `127.0.0.1:3306` via `mysql2`

## Production
- **Public Domain**: https://monitor.infiniforge.cloud
- **Production Path**: `/www/apps/infininoc`

## Application port
- **Application Port**: `3001` (bound locally to `127.0.0.1:3001` / `0.0.0.0:3001`)

## Process manager
- **PM2**: Managed process `infininoc` configured via [`ecosystem.config.js`](../ecosystem.config.js)
- **Command**: `pm2 start ecosystem.config.js`

## Reverse proxy
- **Nginx**: Reverse proxy forwarding HTTPS traffic to port `3001`
- **WebSocket Support**: `Upgrade` and `Connection "Upgrade"` headers enabled for `/socket.io/`
- **SSL**: Let's Encrypt TLS certificate with automatic renewal

---

## Stable features

1. **Multi-Protocol Monitoring Engine**:
   - HTTP(s) / Keyword / Status Code / Custom Headers / JSON Query monitoring.
   - TCP Ping, ICMP Ping, DNS (A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR).
   - WebSocket, gRPC, MQTT, and Push heartbeat endpoints.
   - Docker Container monitoring and Chromium-based Real Browser monitoring.
   - Database monitoring for MySQL, MariaDB, PostgreSQL, Microsoft SQL Server, MongoDB, and Redis.
   - Network protocols: NTP and RADIUS.
   - Telecom & Carrier Telemetry: GPON OLT optical power/ONU monitoring, MikroTik RouterOS CPU/bandwidth/interface telemetry, and SNMP (v1, v2c, v3) metrics.

2. **Alerting & Notification Ecosystem**:
   - Over 90 notification providers including Microsoft Teams, Slack, Discord, Webpush, PagerDuty, Opsgenie, Telegram, SMTP Email, Resend, and SendGrid.
   - Default notification templates and branding customized for InfiniNOC.
   - Dialect-portable Sub-team Alert policies and escalation channels.

3. **Status Pages & Incident Management**:
   - Public and private status pages with custom incident updates, maintenance scheduling, and SSL certificate countdowns.
   - Service Level Agreement (SLA) calculations and availability percentage tracking.

4. **Access Control & Multi-Tenancy Architecture**:
   - Local authentication with secure password hashing, Two-Factor Authentication (2FA), and API Key generation.
   - Role-Based Access Control (RBAC) with Owner, Admin, Member, and Viewer permissions.
   - Organization and Sub-team structures with dialect-portable schema creation.

5. **Diagnostic Tools**:
   - Interactive Real-Time SNMP Tester with OID walk and latency metrics.
   - DNSBL Blacklist Checker for IP reputation and mailserver status.
   - Port checker tool, IP reputation lookup, and SSL cipher audit tools.

6. **User Interface & Experience**:
   - Dark Navy & Slate theme system with Saffron/Amber brand accents.
   - Instant Light / Dark mode switcher across admin and public layouts.
   - Mobile responsive drawer navigation for smartphones and tablets.
   - Progressive Web App (PWA) manifest and Service Worker caching.

---

## Security

1. **Archive & Tar Security Hardening**:
   - Safe archive extraction filtering strictly rejects directory traversal patterns (`../`, `..\\`), absolute paths, and Windows drive letter notation.
   - Unconditional rejection of symlinks and hardlinks in backup archives to prevent arbitrary filesystem overwrite or disclosure attacks.
2. **Asset Guardian & Supply Chain Safety**:
   - [`extra/download-dist.js`](../extra/download-dist.js) hardened to verify local Vite builds and prevent downloading any external upstream pre-built binaries or archives.
3. **Installer Hardening**:
   - [`install.sh`](../install.sh) enforces non-destructive operation (never executes `rm -rf` on existing installations), targets Node.js 22 LTS, and validates existing environment configurations.
4. **Environment Isolation**:
   - Environment variables prioritize `INFININOC_*` namespace over legacy variables (`INFININOC_PORT`, `INFININOC_HOST`, `INFININOC_DATA_DIR`).
5. **Attribution & Upstream URL Sanitization**:
   - Notification webhooks, push assets, and user-facing links sanitized to reference `https://monitor.infiniforge.cloud` and `https://infiniforge.com`.

---

## Backup

1. **Dual Database Architecture Support**:
   - **SQLite**: Automatic archival and restoration of `data/kuma.db` with atomic snapshot creation.
   - **MySQL / MariaDB**: Performs logical SQL dumps (`kuma-mysql-dump.sql`) of the active InfiniNOC database using streaming connection queries. Restores logical dumps directly through the active database connection rather than replacing local files.
2. **Manifest Metadata**:
   - Backup archives (`.infinibackup`) include a JSON manifest containing `version: "1.0.0"`, `databaseType` (`mysql`, `mariadb`, or `sqlite`), creation timestamp, and file listings.
3. **Asset Protection**:
   - Archives user-uploaded assets in `data/upload`.
4. **Pre-Restore Safety Snapshot**:
   - Automatic pre-restore snapshot generation prior to applying any database or asset restore, allowing rollback in case of restore interruptions.

---

## Compatibility

1. **Database Compatibility**:
   - Fully compatible with **MySQL 8.0.x** and **MariaDB 10.x** using standard ANSI SQL, `INT AUTO_INCREMENT PRIMARY KEY`, and `CURRENT_TIMESTAMP`.
   - Backward-compatible with **SQLite 3** (`INTEGER PRIMARY KEY AUTOINCREMENT`).
2. **Node.js**:
   - Verified on Node.js v22.23.2 and npm 10.x. Compatible with Node.js >= 20.4.0.
3. **Reverse Proxy & TLS**:
   - Fully compatible with Nginx, Apache, Caddy, Cloudflare, and Traefik reverse proxies terminating SSL.

---

## Known limitations

1. **Logical SQL Restore Streaming**:
   - MySQL/MariaDB database restoration executes SQL statements through the database connection stream; environments with extremely large historical heartbeat dumps should ensure MySQL `max_allowed_packet` is sized to >= 64M.
2. **Cluster Multi-Instance**:
   - InfiniNOC v1.0.0 is designed for single-instance PM2 production deployment (`exec_mode: "fork"`). Multi-master horizontal clustering is planned for future major releases.
3. **Database Driver Configuration**:
   - Physical MySQL 8.x servers utilize the `"type": "mariadb"` driver configuration in `data/db-config.json` per the underlying Knex/RedBean abstraction; this must not be manually edited to preserve connection compatibility.
