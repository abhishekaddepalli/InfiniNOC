# InfiniNOC — Complete UI/UX Visibility, Layout & Responsive Audit

Date: August 18, 2026  
Auditor: Antigravity Code Agent  
Scope: Frontend UI/UX, Visibility, Theme Contrast, Responsive Layout, Navigation Shell, Component Collisions, and Mobile Usability across InfiniNOC.

---

## 1. Executive Summary & Core Audit Findings

A thorough visual and code-level audit of the InfiniNOC frontend revealed several visibility, contrast, layout collision, and mobile responsive defects across Light and Dark themes.

### Critical Audit Findings

1. **Text Visibility & Contrast Issues**:
   - `DashboardHome.vue`: Total Monitors summary card value used static `text-light`, rendering numbers pure white on white card backgrounds in Light mode.
   - `DashboardHome.vue`: Table `.table-dark-noc` forced static dark backgrounds (`#1e293b`) with saffron headers unconditionally, ignoring Light theme.
   - Muted secondary metadata (`.text-muted`, `.text-secondary`, `color: #94a3b8`) had insufficient contrast ratios on light slate surfaces (`#f8fafc`).
   - Badges in tables and lists (`.badge.bg-secondary`, `.badge.bg-warning`) used low-contrast text combinations (`white` on `yellow` or `white` on `light gray`).

2. **Design Tokens Gaps**:
   - `vars.scss` defined basic `:root` variables, but lacked full semantic tokens required by the enterprise spec: `surface`, `surface-elevated`, `surface-muted`, `border-subtle`, `border-strong`, `success-muted`, `warning-muted`, `danger-muted`, `info-muted`, `disabled`, `disabled-foreground`, `sidebar-active`, `sidebar-hover`.

3. **Layout & Component Collisions**:
   - `DashboardHome.vue`: Summary cards forced fixed grid col classes (`col-6 col-sm-6 col-md-3 col-xl-3`) that caused text overlap and truncation on 320px–375px mobile screens.
   - Long resource names (e.g. `CORE-MIKROTIK-ROUTER-VIJAYAWADA-POP-01`) broke out of container bounds without proper flex `min-width: 0` and word-wrap rules.
   - Mobile Header (`Layout.vue`) lacked hamburger menu drawer triggers, leaving mobile users unable to access full NOC sidebar navigation.

4. **Dropdowns, Popovers & Modals**:
   - Profile dropdown (`.dropdown-profile-pic`) and Organization Switcher dropdowns lacked dynamic `z-index` layering and explicit background design tokens, causing clipping under sticky headers or card overlays.
   - Modals lacked responsive max-height constraints (`max-height: 85vh; overflow-y: auto`), causing action buttons to clip off-screen on small viewports.

5. **Tables & Charts**:
   - Tables across `SlaReports.vue`, `BillingDashboard.vue`, and `ManageDevices.vue` forced static background colors without responsive horizontal scroll wrappers (`.table-responsive`).
   - `PingChart.vue` canvas height lacked fluid aspect ratio bounds on mobile devices (320px–414px).

---

## 2. Component-by-Component Audit Matrix

| Category | Component / Page | Observed Issue | Impact | Planned Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Design Tokens** | `src/assets/vars.scss` | Incomplete semantic token coverage | Component inconsistency | Add full required token suite (`surface-elevated`, `border-subtle`, etc.) |
| **Visibility** | `DashboardHome.vue` | `text-light` on white card in Light Mode | Unreadable monitor count | Replace with `var(--card-foreground)` |
| **Visibility** | `DashboardHome.vue` | `.table-dark-noc` hardcoded dark bg | Table unreadable in Light Mode | Use `var(--card)` and `var(--border)` |
| **Shell / Nav** | `Layout.vue` | Header text `text-dark` on mobile header | Unreadable in Dark Mode | Use `var(--foreground)` and `var(--card)` |
| **Shell / Nav** | `NocSidebar.vue` | Static hover background `#27354a` | Submenu contrast loss in Light | Use `var(--sidebar-hover)` and `var(--sidebar-active)` |
| **Mobile Drawer** | `Layout.vue` / `NocSidebar.vue` | No drawer trigger on mobile viewports | Inaccessible sidebar links on mobile | Add mobile drawer state with slide-in overlay & close trigger |
| **Cards** | `DashboardHome.vue` | Fixed 4-col layout on narrow screens | Card content colliding on 320px | Use fluid `col-12 col-sm-6 col-lg-3` grid layout |
| **Tables** | Enterprise Pages | No scroll wrapper on data tables | Table overflow breaks screen width | Wrap all tables in `.table-responsive` with clean scrollbar |
| **Modals** | Enterprise Modals | No max-height overflow constraint | Modal buttons cut off on mobile | Apply `max-height: 85vh; overflow-y: auto;` to modal-body |
| **Badges** | `MonitorListItem.vue` & Pages | Low contrast text on warning/pending badges | Accessibility fail (WCAG) | Standardize status badge classes with explicit text tokens |
| **Charts** | `PingChart.vue` | Legend and tooltip font contrast | Legend text invisible in Light | Use dynamic `var(--foreground)` and `var(--muted-foreground)` |

---

## 3. Z-Index System Standard

To prevent dropdowns, popovers, sticky bars, and modals from colliding:

| Layer | Z-Index Value | Description |
| :--- | :--- | :--- |
| **Base Content** | `0` | Standard page content and cards |
| **Sticky Content** | `10` | Sticky headers and sticky table bars |
| **Header Shell** | `100` | Desktop top navigation bar |
| **Sidebar Drawer Overlay** | `1000` | Mobile navigation drawer overlay |
| **Dropdown & Popover** | `1050` | User menu, organization switcher, filter popovers |
| **Modal / Dialog** | `1100` | Confirmation dialogs, creation forms |
| **Toast Notifications** | `1200` | Floating alert toasts |
