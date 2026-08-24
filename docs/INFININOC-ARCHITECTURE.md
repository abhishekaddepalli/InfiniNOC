# InfiniNOC Architecture Audit & Analysis

**Project Name**: InfiniNOC (Based on Uptime Kuma v2.5.0)  
**Base Version**: `2.5.0`  
**Audit Date**: August 16, 2026  
**Status**: Comprehensive Codebase Audit Completed (No Core Application Behavior Modified)

---

## 1. System Overview & Current Architecture

Uptime Kuma is a self-hosted monitoring tool built with a single-tier or multi-container architecture. It combines an **Express.js** web application server, a **Socket.IO** real-time WebSocket server, a **RedBean-node / Knex** database abstraction layer, and a **Vue.js 3** Single Page Application (SPA) frontend.

```
                  ┌──────────────────────────────────────────────┐
                  │                 Vue 3 SPA                    │
                  │   (Router 4, Pinia/Vue Root, Bootstrap 5)    │
                  └──────────────────────┬───────────────────────┘
                                         │
                                   WebSocket / HTTP
                                         │
                  ┌──────────────────────▼───────────────────────┐
                  │            Express + Socket.IO               │
                  │  (server/server.js & uptime-kuma-server.js)  │
                  └──────┬───────────────────────┬───────────────┘
                         │                       │
           ┌─────────────▼────────────┐  ┌───────▼────────────────┐
           │ Monitor Engine & Types   │  │ Notification Engine    │
           │ (server/monitor-types/)  │  │ (notification-prov.s)  │
           └─────────────┬────────────┘  └────────────────────────┘
                         │
           ┌─────────────▼────────────┐
           │ Database (RedBean/Knex)  │
           │ SQLite / MySQL / PG / MS │
           └──────────────────────────┘
```

### Core Architecture Characteristics
- **Backend**: Node.js >= 20.4.0, Express 4.22.1, Socket.IO 4.8.3.
- **Frontend**: Vue 3.5.28, Vue Router 4.2.5, Vite 5.4.21, Bootstrap 5.1.3, FontAwesome 5.
- **Data Persistence**: RedBean-node (ORM) + Knex (Query builder & migrations).
- **Communication Protocol**: Primary real-time communication via WebSocket (`socket.io`). REST endpoints are reserved for badges, push monitors, status page public APIs, and Prometheus metrics.

---

## 2. Directory Structure & Key Files Map

### Key Directories
- [`server/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server): Node.js backend logic, express app, socket handlers, models.
- [`server/model/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/model): Database models (Monitor, User, StatusPage, Maintenance, etc.).
- [`server/monitor-types/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/monitor-types): Pluggable monitor type definitions (HTTP, Ping, DNS, MQTT, gRPC, etc.).
- [`server/notification-providers/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/notification-providers): 100+ alert channel providers.
- [`server/socket-handlers/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/socket-handlers): Modularized WebSocket event handlers.
- [`server/routers/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/routers): Express HTTP routers for REST API and Status Pages.
- [`src/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src): Vue 3 frontend application.
- [`src/components/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/components): Reusable UI widgets and modal dialogs.
- [`src/pages/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages): Application views (Dashboard, Details, EditMonitor, StatusPage).
- [`src/layouts/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/layouts): Main layout wrappers including header, navigation, and sidebar container.
- [`db/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/db): Database schemas and Knex migrations.
- [`docker/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/docker): Multi-stage Dockerfiles and compose setups.

### Crucial Files
- [`package.json`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/package.json): Version tracking (`2.5.0`), scripts, and dependencies.
- [`server/server.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/server.js): Entry point for Node.js backend. Initializes DB, Express, Socket.IO, and background jobs.
- [`server/uptime-kuma-server.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/uptime-kuma-server.js): Singleton container for app state, HTTP server, and active monitors.
- [`server/database.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/database.js): Database connection manager, data path setup, and migration trigger.
- [`db/knex_init_db.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/db/knex_init_db.js): Base table definitions for new database instances.
- [`src/router.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/router.js): Vue Router route tree.
- [`src/layouts/Layout.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/layouts/Layout.vue): Top navigation bar, header branding, and application layout.
- [`src/pages/Dashboard.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/Dashboard.vue): Dashboard split-view container (MonitorList + detail view).
- [`src/pages/DashboardHome.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/DashboardHome.vue): Quick stats cards and recent events table.
- [`config/vite.config.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/config/vite.config.js): Frontend Vite bundler configuration.

---

## 3. Detailed Architectural Audits

### 3.1 Database Architecture & Migrations
- **Supported Engines**: SQLite3 (`data/kuma.db`), MariaDB/MySQL (`mysql2`), PostgreSQL (`pg`), MSSQL (`mssql`).
- **ORM & Querying**: Hybrid approach using `redbean-node` for Object-Relational Mapping (`R.findOne`, `R.store`, `R.dispense`) and `knex` for complex queries, schema building, and migrations.
- **Migration Mechanism**: Executed via [`SimpleMigrationServer`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/utils/simple-migration-server.js) during `Database.connect()`. Migrations live in [`db/knex_migrations/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/db/knex_migrations) as date-stamped files (e.g. `2025-10-15-0001-add-monitor-response-config.js`).
- **Core Entities**:
  - `user`: System users, hashed passwords, 2FA secrets.
  - `monitor`: Monitor configurations, target URLs/IPs, intervals, retry limits, headers.
  - `heartbeat`: Ping responses, execution duration, status codes, timestamps (`important` flag marks status changes).
  - `notification`: Alert channel configurations.
  - `status_page` & `status_page_cname`: Public status page settings and custom domain bindings.
  - `incident` & `maintenance`: Incident announcements and scheduled maintenance slots.
  - `api_key`: Secret keys (`uk_...`) for external API authentication.

### 3.2 Authentication & Session Management
- **Password Security**: Hashes stored using `bcryptjs` (auto-upgraded from legacy hashes on login).
- **Session Tokens**: Stateless JWT tokens generated by [`User.createJWT()`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/model/user.js) with a unique server secret (`jwtSecret`). Client stores token in localStorage and transmits via WebSocket `loginByToken` event.
- **Two-Factor Authentication (2FA)**: Standard TOTP using `notp` and `thirty-two` secret encoding.
- **REST / API Auth**:
  - `basicAuth` middleware (`server/auth.js`) for HTTP endpoints.
  - `apiAuth` middleware checking `api_key` table records using token prefix lookup.

### 3.3 Monitor Lifecycle & Architecture
1. **Instantiation**: Loaded into memory by [`UptimeKumaServer.getInstance()`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/uptime-kuma-server.js).
2. **Scheduling**: Each monitor calculates its check interval (seconds) and sets a timer using `unlimited-timeout`.
3. **Execution (`beat()`)**:
   - Checks active status and maintenance window overrides.
   - Delegates check to specific handler in `server/monitor-types/` (e.g. `http.js`, `ping.js`, `dns.js`).
   - Measures response duration, ping time, and validates status codes or keyword assertions.
4. **Recording Heartbeat**:
   - Saves a record to `heartbeat` table in DB.
   - Evaluates if status changed (`isImportantBeat`).
5. **Broadcasting & Alerting**:
   - Emits real-time socket events (`heartbeat`, `avgPing`, `uptime`) to connected clients (`io.to(userID)`).
   - Triggers [`Notification.send()`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/notification.js) if status transitions (e.g. `UP -> DOWN` or `DOWN -> UP`).

### 3.4 Notification System Architecture
- **Base Class**: `NotificationProvider` in [`server/notification-providers/notification-provider.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/notification-providers/notification-provider.js).
- **Execution Flow**: `Notification.send(notificationBean, msg, monitorJSON, heartbeatJSON)` dynamically loads provider class, parses JSON config, builds payload, and makes HTTP/socket requests to target service.
- **Rate Limiting & History**: Records alerts in `notification_sent_history` to prevent spamming on repeated errors.

### 3.5 Status Page Architecture
- **Routing**: Handled by [`server/routers/status-page-router.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/routers/status-page-router.js) and frontend [`src/pages/StatusPage.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/StatusPage.vue).
- **Custom Domains**: Domain mapping resolution in `StatusPage.domainMappingList` maps incoming request Host header to specific status page slug.
- **Public Data Protection**: Monitors served to public status pages are sanitized using `Monitor.toPublicJSON()` to strip credentials, basic auth headers, and private tokens.

### 3.6 WebSocket & Real-Time Telemetry
- **Engine**: Socket.IO 4.8.3 with CORS verification.
- **Modular Handlers**: Handlers attached in [`server/server.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/server.js) under [`server/socket-handlers/`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/server/socket-handlers).
- **Rooms**: Logged-in connections are grouped into rooms by `userID` (`socket.join(userID)`). Broadcasts are targeted via `io.to(userID).emit(...)`.

### 3.7 Build & Docker Architecture
- **Build Tooling**: Vite 5 with `@vitejs/plugin-vue`, SCSS PostCSS parser, RTL CSS support, Gzip and Brotli output compression.
- **Docker Workflow**:
  - `docker/debian-base.dockerfile`: Pre-built Debian base with Node.js runtime and dependencies.
  - `docker/builder-go.dockerfile`: Builds binary healthcheck utility.
  - `docker/dockerfile`: Multi-stage production container running `npm ci --omit=dev` and `node server/server.js`.

---

## 4. Branding, Navigation & UI Locations

| Feature / UI Element | Primary File Location | Description |
| :--- | :--- | :--- |
| **App Title & Header Branding** | [`src/layouts/Layout.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/layouts/Layout.vue#L22) | Renders brand logo (`/icon.svg`) and brand title text. |
| **Favicon & Icons** | [`public/icon.svg`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/public/icon.svg), [`public/favicon.ico`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/public/favicon.ico) | System branding visual assets. |
| **Top Navigation & Profile Menu** | [`src/layouts/Layout.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/layouts/Layout.vue#L35-L117) | Navigation pills (`Status Pages`, `Dashboard`) and user profile menu (`Maintenance`, `Settings`, `Logout`). |
| **Sidebar Monitor List** | [`src/components/MonitorList.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/components/MonitorList.vue) | Sidebar tree with group collapsible headers, search filter, and status indicators. |
| **Dashboard Layout** | [`src/pages/Dashboard.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/Dashboard.vue) | Two-column grid holding `MonitorList` on the left and `<router-view>` on the right. |
| **Quick Stats Overview** | [`src/pages/DashboardHome.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/DashboardHome.vue) | Summary cards (Up, Down, Maintenance, Unknown, Pause) and recent important heartbeats table. |
| **Monitor Detail View** | [`src/pages/Details.vue`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/pages/Details.vue) | Detailed response time charts, uptime percentage bars, and event logs. |
| **Frontend Router** | [`src/router.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/src/router.js) | Defines routes for `/dashboard`, `/status`, `/settings`, `/maintenance`. |

---

## 5. Safest Extension Points for InfiniNOC

To extend Uptime Kuma into **InfiniNOC** without breaking upstream compatibility or incurring maintenance debt, leverage these decoupled extension interfaces:

1. **Custom NOC Views / Dashboard Pages**:
   - Add dedicated Vue views in `src/pages/noc/` (e.g. `InfiniNocWallboard.vue`, `NocTopology.vue`).
   - Declare new child routes in `src/router.js` under `Layout.vue`.
   - Add navigation entry points in `src/layouts/Layout.vue`.

2. **New Custom Monitor Types**:
   - Create a module in `server/monitor-types/<type>.js` extending `MonitorType`.
   - Register it in `server/monitor-types/monitor-type.js`.

3. **Custom Socket Handlers**:
   - Create `server/socket-handlers/infininoc-socket-handler.js`.
   - Mount handler in `server/server.js` inside `io.on("connection", ...)`.

4. **Custom Database Fields & Tables**:
   - Add new timestamped Knex migration scripts in `db/knex_migrations/`.
   - Do not edit `db/knex_init_db.js` directly (per core development rules).

5. **NOC Alert Channels**:
   - Add custom incident response notification providers under `server/notification-providers/<provider>.js`.

---

## 6. Risks of Modifying Core Uptime Kuma

- **Breaking Upstream Merge Compatibility**: Modifying core methods in `server/server.js` or `server/model/monitor.js` risks git merge conflicts when pulling future Uptime Kuma updates.
- **RedBean Model Invalidation**: Direct SQL table schema alterations outside of Knex migrations cause runtime ORM field mapping failures.
- **WebSocket Protocol Mismatches**: Unsynchronized socket event payload changes break UI reactivity across client versions.
- **AI Slop & Project Guidelines Violation**: Submitting unverified PRs or AI-generated core rewrites violates repository developer policies (`AGENTS.md`).

---

## 7. Recommended Strategy for InfiniNOC Integration

1. **Phase 1: Non-Destructive Extension**: Keep core files untouched. Implement InfiniNOC feature sets via additive modular files (e.g., custom socket handlers, dedicated NOC Vue components).
2. **Phase 2: UI Branding & Navigation Layering**: Customize header navigation in `src/layouts/Layout.vue` to expose InfiniNOC wallboard mode and telemetry options alongside standard Uptime Kuma pages.
3. **Phase 3: Database Schema Migration**: Introduce clean Knex migrations in `db/knex_migrations/` for any InfiniNOC-specific state management.
4. **Phase 4: Automated Verification**: Continually validate typescript definitions, lint rules, and backend test suites (`npm run tsc`, `npm run lint`, `npm test`).
