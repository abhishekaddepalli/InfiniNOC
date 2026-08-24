# InfiniNOC — Core Integration, Uptime Kuma Restoration & SaaS Control Plane Audit

**Author**: Infiniforge Technologies Engineering Team  
**Date**: August 18, 2026  
**Document Status**: Phase 1 Comprehensive Architecture Audit  

---

## Executive Summary

This document presents the **Phase 1 Audit** of the InfiniNOC customized Uptime Kuma platform. The objective of this audit is to diagnose existing regressions in monitor routing, unify incident data management, evaluate current team and multi-tenant capabilities, inspect billing/subscription models, and define a clear, non-destructive migration roadmap for a multi-tenant SaaS architecture.

---

## 1. Monitor Detail Regression Root Cause Analysis

### Current Architecture & Routing Behavior
In standard Uptime Kuma, clicking a monitor in `MonitorList.vue` navigates to `/dashboard/:id`.
- The main view container in `Dashboard.vue` renders a `<router-view :key="$route.fullPath" />`.
- `router.js` specifies that `/dashboard/:id` renders `EmptyLayout -> Details.vue`.
- `Details.vue` is the authoritative monitor detail component. It renders:
  - Monitor metadata (Title, ID, Type, Target, URL, Port, Tags)
  - Live heartbeat status and ping latency graphs (`PingChart.vue` using Chart.js)
  - 24-hour, 30-day, and 1-year uptime percentage meters (`UptimeCalculator`)
  - TLS/SSL Certificate details and expiration countdowns
  - Interactive controls: **Edit**, **Pause / Resume**, **Delete**, **Clone**, and **Clear History**
  - Event log table containing state transitions (`DOWN -> UP`, `UP -> DOWN`, `PENDING`, `MAINTENANCE`)
  - WebSocket subscription listeners (`io.on("heartbeat", ...)` and `io.on("importantHeartbeat", ...)`)

### Cause of the Regression
During the InfiniNOC NOC Dashboard redesign, `src/pages/DashboardHome.vue` was introduced as a full-screen telemetry dashboard.
1. `src/router.js` nested `/dashboard/:id` as a child route inside `DashboardHome`.
2. `DashboardHome.vue` contained `<div v-if="$route.name === 'DashboardHome'" class="noc-dashboard">`.
3. When a user clicked a monitor (`/dashboard/2`), `$route.name` changed from `'DashboardHome'` to `undefined` (matching `Details.vue`).
4. `v-if` evaluated to `false`, hiding the NOC Dashboard container.
5. `DashboardHome.vue` lacked a `<router-view>` tag to render the child route `Details.vue`.
6. **Result**: The right-hand content area rendered 100% blank when any monitor link was clicked.

### Restoration Requirements (Phase 2 Target)
- Maintain `Details.vue` as the single source of truth for monitor details.
- Update `DashboardHome.vue` with `<router-view v-else :key="$route.fullPath" />` so `/dashboard/:id` immediately loads `Details.vue`.
- Wrap `Details.vue` with InfiniNOC high-contrast theme styling without altering any Chart.js data streams or socket bindings.
- Enforce organization scoping: Ensure monitor lookup verifies `monitor.organization_id === user.active_organization_id`. If unauthorized or non-existent, return a generic 404 state to prevent cross-tenant monitor enumeration.

---

## 2. Incident Data Mismatch Root Cause Analysis

### Cause of the Discrepancy (`ACTIVE INCIDENTS = 2` vs `No Incidents Found`)
An audit of `NocSidebar.vue`, `DashboardHome.vue`, and `ManageIncidents.vue` revealed two conflicting data pathways:
1. **Sidebar Badge (`NocSidebar.vue`)**:
   - `NocSidebar.vue` previously bound its `incidentCount` badge to `this.$root.stats.down` (the count of currently DOWN monitors in memory).
   - If 2 monitors were down (e.g. `test` and `DNS`), the sidebar displayed a red `2` badge.
2. **Incidents Page (`ManageIncidents.vue`)**:
   - `/incidents` queried the database table `incident` via `Incident.getIncidents(orgId)`.
   - Since no rows existed in the `incident` database table, `/incidents` rendered `No Incidents Found`.
3. **Result**: The dashboard reported `2 Active Incidents` (counting down monitors), while `/incidents` showed `0 Incidents` (reading database rows).

### Incident Status Lifecycle & Unification
To establish a single source of truth, incidents will use a standardized status lifecycle:

```
[OPEN] ---> [ACKNOWLEDGED] ---> [IN_PROGRESS] ---> [MONITORING] ---> [RESOLVED] ---> [CLOSED]
|________________________ ACTIVE STATES _______________________| |____ INACTIVE STATES ____|
```

- **Active States**: `OPEN`, `ACKNOWLEDGED`, `IN_PROGRESS`, `MONITORING`
- **Inactive States**: `RESOLVED`, `CLOSED`
- **Shared Helper (`src/util.js` & `server/model/incident.js`)**:
  ```javascript
  function isIncidentActive(status) {
      return ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "MONITORING"].includes(status?.toUpperCase());
  }
  ```

### Automatic Incident Creation Flow
When a monitor flips status from `UP` to `DOWN`:
1. `server/model/monitor.js` detects `isImportant = true` and `bean.status === DOWN`.
2. Checks if an active incident linked to `monitor_id` already exists in `incident` + `incident_entity_link`.
3. If no active incident exists, `Incident.createIncident()` automatically inserts a **P1 Outage Incident** into `incident` and `incident_timeline`.
4. Emits `updateIncidentStats` socket event.
5. Both `DashboardHome.vue` and `ManageIncidents.vue` fetch from `Incident.getIncidentDashboardStats()`, ensuring 100% data consistency across all views.

---

## 3. Current Team & RBAC System Audit

### Database Schema (`organization_user`)
The Knex migration `2026-08-17-0000-organizations.js` creates the `organization_user` table:
- `id`: Primary key
- `organization_id`: Foreign key to `organization.id`
- `user_id`: Foreign key to `user.id`
- `role`: Role string (`owner`, `admin`, `engineer`, `viewer`)
- `created_at`, `updated_at`

### Missing Capabilities
1. **Frontend**: `/team` route points to `ComingSoon.vue`. No UI exists for listing team members, inviting users, or changing roles.
2. **Roles**: Current schema lacks `NOC_MANAGER` and `TECHNICIAN` roles.
3. **Invitations**: No `organization_invitation` table exists to handle tokenized email invitations.
4. **Server-Side Authorization Middleware**: Socket handlers and Express REST routes currently lack explicit permission checks (e.g. `checkPermission(user, orgId, 'monitor.create')`).

### Target RBAC Matrix (Phase 4 Target)
The system will implement 6 granular roles:

| Permission | OWNER | ADMIN | NOC_MANAGER | ENGINEER | TECHNICIAN | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `monitor.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `monitor.create / edit` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `monitor.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `device.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `incident.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `team.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `team.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `billing.view / manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `org.delete` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 4. Current Billing & Subscription Audit

### Existing Architecture
- **Table `saas_plan`**: Stores basic plan definitions (`STARTER`, `BUSINESS`, `PROFESSIONAL`, `ENTERPRISE`) with quota columns (`max_devices`, `max_monitors`, `max_probes`, `max_users`, `metric_retention_days`, `max_status_pages`, `monthly_price_inr`).
- **Table `organization_subscription`**: Stores an organization's active plan ID, status (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`, `EXPIRED`), Razorpay IDs, and period dates.
- **Table `billing_payment_history`**: Stores payment transactions (`razorpay_payment_id`, `amount_inr`, `status`).

### Limitations & Gaps
1. **Frontend**: `BillingDashboard.vue` displays static plan cards and basic usage bars without interactive upgrade/downgrade or Razorpay checkout modals.
2. **Server-Side Quota Enforcement**: No central `EntitlementService` exists to block creation of device #26 when on a Starter plan (25 device limit).
3. **Razorpay Security**: `server/model/razorpay-billing.js` contains order creation stubs, but lacks HMAC SHA-256 webhook signature verification and secret key encryption at rest.

---

## 5. Current Organization & Authentication Model

### Organization Tenancy
- Every entity table (`monitor`, `status_page`, `notification`, `maintenance`, `docker_host`, `proxy`, `api_key`, `device`, `site`, `remote_probe`, `alert_rule`, `incident`) includes an `organization_id` column.
- Knex migration assigned legacy unassigned records to `Default Organization` (`id = 1`).

### Authentication & Session Context
- Users authenticate via JWT token.
- **Current Limitation**: Users do not have a dedicated platform-level role (`SUPER_ADMIN`). Currently, users in `Default Organization` with role `owner` are treated as platform admins.
- **Target Separation**:
  - **Platform Layer**: User table has a `platform_role` column (`SUPER_ADMIN` vs `USER`).
  - **Tenant Layer**: `organization_user` table manages tenant roles (`OWNER`, `ADMIN`, `NOC_MANAGER`, `ENGINEER`, `TECHNICIAN`, `VIEWER`).

---

## 6. Current Database Structure

The SQLite database (`db/kuma.db`) managed by Knex migrations contains the following entity tables:

```
+-------------------+-----------------------------+-------------------------------+
| Category          | Tables                      | Multi-Tenancy Column          |
+-------------------+-----------------------------+-------------------------------+
| Core Auth & Org   | user                        | platform_role (to add)        |
|                   | organization                | id (primary tenant key)       |
|                   | organization_user           | organization_id, user_id      |
|                   | organization_audit_log      | organization_id               |
|                   | organization_invitation     | organization_id (to create)   |
+-------------------+-----------------------------+-------------------------------+
| Monitoring Core   | monitor                     | organization_id               |
|                   | heartbeat                   | (linked via monitor_id)       |
|                   | status_page                 | organization_id               |
|                   | notification                | organization_id               |
|                   | maintenance                 | organization_id               |
|                   | docker_host                 | organization_id               |
|                   | proxy                       | organization_id               |
|                   | api_key                     | organization_id               |
+-------------------+-----------------------------+-------------------------------+
| NOC Telemetry     | device                      | organization_id               |
|                   | site                        | organization_id               |
|                   | remote_probe                | organization_id               |
|                   | snmp_profile                | organization_id               |
|                   | alert_rule                  | organization_id               |
|                   | active_alert                | organization_id               |
|                   | incident                    | organization_id               |
|                   | incident_timeline           | organization_id               |
|                   | incident_entity_link        | organization_id               |
+-------------------+-----------------------------+-------------------------------+
| SaaS & Billing    | saas_plan                   | (global platform definition)  |
|                   | organization_subscription   | organization_id               |
|                   | billing_payment_history     | organization_id               |
|                   | billing_invoice             | organization_id (to create)   |
|                   | platform_setting            | (global encrypted key-value)  |
+-------------------+-----------------------------+-------------------------------+
```

---

## 7. Recommended Migration Strategy (Phases 2 – 12)

All database modifications will be executed via versioned Knex migration files in `db/knex_migrations/`. Existing SQLite data, monitor definitions, heartbeats, and status pages will be preserved 100%.

```
Phase 2: Restore Monitor Details (/dashboard/:id -> Details.vue)
  └── Update DashboardHome.vue with <router-view v-else>
  └── Enforce organization scoping in Details.vue backend queries

Phase 3: Unified Incident Engine
  └── Standardize status enum: OPEN, ACKNOWLEDGED, IN_PROGRESS, MONITORING, RESOLVED, CLOSED
  └── Connect monitor DOWN beats directly to Incident.createIncident()

Phase 4: Team Management & Server-Side RBAC
  └── Add Knex migration for organization_invitation table
  └── Implement /team UI, invitation token generation, and server-side RBAC middleware

Phase 5: Super Admin Control Plane (/admin)
  └── Add platform_role ('SUPER_ADMIN') to user table
  └── Build /admin control plane with tenant list, MRR metrics, and subscription overrides

Phase 6: Plan Models & Feature Entitlements
  └── Create EntitlementService (can(feature), limit(resource), remaining(resource))
  └── Seed full feature matrix across STARTER, BUSINESS, PROFESSIONAL, ENTERPRISE

Phase 7: SaaS Subscriptions & Lifecycle State Machine
  └── Implement trial expiration timers and subscription state transitions

Phase 8: Razorpay Integration & Webhook Security
  └── Create platform_setting table for encrypted Razorpay API keys
  └── Implement HMAC SHA-256 webhook signature verification endpoint

Phase 9: Billing Dashboard Redesign
  └── Rebuild BillingDashboard.vue into modular cards (Current Plan, Usage, Invoices, Payments)

Phase 10: Server-Side Quota Enforcement
  └── Intercept creation endpoints (monitors, devices, probes, users) with quota checks

Phase 11: Multi-Tenant & Platform Audit Logging
  └── Intercept privileged actions and record to organization_audit_log

Phase 12: Automated Testing & Verification
  └── Execute unit tests, lint checks, and browser verification
```

---

## 8. Files Matrix (To Modify / To Create)

### Files to Modify
- `src/router.js` (Add `/admin` super admin routes, `/team` route, fix `/dashboard/:id`)
- `src/pages/DashboardHome.vue` (Add fallback `<router-view>` for monitor details)
- `src/pages/Details.vue` (Add organization authorization check and NOC visual wrap)
- `src/pages/ManageIncidents.vue` (Connect to unified active incident status filter)
- `src/pages/BillingDashboard.vue` (Redesign into modular sections with Razorpay integration)
- `src/components/NocSidebar.vue` (Bind incident badge to real DB active incident count)
- `server/server.js` (Register Super Admin, Team, Entitlement, and Webhook socket/HTTP endpoints)
- `server/model/monitor.js` (Integrate auto-incident creation/resolution on status flip)
- `server/model/incident.js` (Unify `isIncidentActive` status logic and stats queries)
- `server/model/organization.js` (Add Team invitation, member management, and RBAC helpers)
- `server/model/saas-subscription.js` (Add feature entitlement check functions)
- `server/model/razorpay-billing.js` (Add HMAC signature verification and order creation)
- `src/util.js` (Add shared `isIncidentActive` helper function)

### Files to Create
- `docs/CORE-INTEGRATION-AUDIT.md` (This document)
- `db/knex_migrations/2026-08-18-1300-team-invitations.js` (Invitation & RBAC migration)
- `db/knex_migrations/2026-08-18-1400-super-admin-billing.js` (Super admin & invoice migration)
- `server/middleware/rbac.js` (Server-side role-based authorization middleware)
- `server/model/entitlement.js` (Central SaaS feature entitlement and quota service)
- `src/pages/TeamManagement.vue` (Full Team management and user invitation UI)
- `src/pages/SuperAdminDashboard.vue` (Super Admin platform control plane at `/admin`)
- `src/pages/SuperAdminOrganizations.vue` (Platform tenant management UI)
- `src/pages/SuperAdminPlans.vue` (Platform plan definition & pricing manager)

---

## Conclusion & Next Steps

Phase 1 audit is complete. The exact root causes for the monitor detail view regression and incident count mismatch have been identified, and a non-destructive architecture has been specified for Team RBAC, Super Admin, and SaaS billing.

**Proceeding to Phase 2 upon user approval.**
