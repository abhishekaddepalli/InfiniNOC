# InfiniNOC 2.0 — Commercial SaaS Design System Specification

**Company**: Infiniforge Technologies  
**Tagline**: *"Know Your Network. Before Your Customers Do."*  
**Product**: InfiniNOC — Commercial Network Operations Center & Infrastructure Monitoring Platform  

---

## 1. Executive Summary & Design Principles

InfiniNOC 2.0 is designed as a modern, high-performance, enterprise-ready commercial SaaS monitoring platform for ISPs, WISPs, MSPs, and IT Operations teams. 

### Core Design Principles:
1. **Utility & High Density without Clutter**: Critical network status, outages, and SLAs must be instantly scannable without visual distraction.
2. **Restrained, Meaningful Color**: Saffron/orange is reserved strictly for primary call-to-actions, highlight focus, and warnings. Deep Navy (`#0b1220` / `#0f172a`) and Sapphire Blue (`#1e3a8a` / `#2563eb`) form the structural brand base.
3. **Subtle Elevation & Light Cards**: Avoid heavy borders and dark box traps. Use soft 1px borders (`#e2e8f0` light, `#1e293b` dark), generous whitespace, and lightweight card containers.
4. **Fluid Responsiveness**: Seamless experience across screen widths from 320px mobile viewports to 1440px+ ultra-wide NOC wall displays.

---

## 2. Color System & Semantic Tokens

The color architecture is built around CSS custom properties (`var(--token)`) scoped to `:root` (Light Theme) and `body.dark` / `[data-theme="dark"]` (Dark Theme).

```
+-----------------------------------------------------------------------+
|  ROLE           | LIGHT THEME TOKEN      | DARK THEME TOKEN           |
+-----------------+------------------------+----------------------------+
| Background      | #f8fafc (Slate 50)     | #0b1220 (Deep Navy)        |
| Surface/Card    | #ffffff (Pure White)   | #151e30 (Elevated Navy)    |
| Muted Surface   | #f1f5f9 (Slate 100)    | #0f172a (Navy Dark)        |
| Text Primary    | #0f172a (Slate 900)    | #f8fafc (Slate 50)         |
| Text Secondary  | #475569 (Slate 600)    | #94a3b8 (Slate 400)        |
| Text Muted      | #64748b (Slate 500)    | #64748b (Slate 500)        |
| Border Subtle   | #e2e8f0 (Slate 200)    | #1e293b (Navy Slate)       |
| Border Strong   | #cbd5e1 (Slate 300)    | #334155 (Slate 700)        |
| Primary Brand   | #1e3a8a (Navy Blue)    | #38bdf8 (Sky Blue Accent)  |
| Saffron Accent  | #ff9933 (NOC Saffron)  | #ff9933 (NOC Saffron)      |
| Success         | #16a34a (Green 600)    | #22c55e (Green 500)       |
| Warning         | #d97706 (Amber 600)    | #f59e0b (Amber 500)       |
| Critical / Red  | #dc2626 (Red 600)      | #ef4444 (Red 500)         |
| Info / Blue     | #2563eb (Blue 600)     | #38bdf8 (Sky 400)          |
+-----------------------------------------------------------------------+
```

---

## 3. Typography Hierarchy

InfiniNOC uses **Inter** (`'Inter', system-ui, -apple-system, sans-serif`) as its primary UI typeface for maximum legibility on high-DPI displays.

### Font Scale:
- **Page Title**: 28px - 32px (Desktop) | 22px - 26px (Mobile) | Bold (700) | Tracking `-0.02em`
- **Section Title**: 18px - 22px (Desktop) | 16px - 18px (Mobile) | SemiBold (600) | Tracking `-0.01em`
- **Card Title**: 14px - 16px | SemiBold (600) | Normal
- **Body Text**: 14px | Regular (400) / Medium (500) | Line-height `1.5`
- **Secondary Text**: 13px | Regular (400) | Muted slate
- **Metadata / Badges**: 11px - 12px | Bold (700) | Uppercase | Tracking `0.05em`

---

## 4. Spacing, Elevation & Geometry

- **Base Spacing Unit**: 8px grid (8px, 16px, 24px, 32px, 48px).
- **Border Radius**:
  - Small Elements (Badges, Chips): `6px`
  - Control Inputs & Buttons: `8px` - `10px`
  - Cards & Section Boxes: `12px` - `14px`
  - Floating Modals & Dropdowns: `14px` - `16px`
- **Borders**: 1px subtle border using `var(--border)`. Avoid heavy, thick borders.
- **Elevation / Shadows**:
  - Light Mode: `0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 25px rgba(0, 0, 0, 0.03)`
  - Dark Mode: `0 4px 20px rgba(0, 0, 0, 0.4)`

---

## 5. Application Shell Architecture & Layout

### Desktop Layout (>= 1024px):
```
+-----------------------------------------------------------------------------------+
|  [Sidebar 250px]  |  [Header: Breadcrumb | Search | OrgSwitcher | Theme | Profile] |
|                   +---------------------------------------------------------------+
|  - Logo           |                                                               |
|  - Overview       |  MAIN CONTENT VIEW                                            |
|  - Monitoring     |  - Fluid width container                                      |
|  - Network        |  - Scrollable main region                                     |
|  - Operations     |                                                               |
|  - Reports        |                                                               |
|  - Communication  |                                                               |
|  - Organization   |                                                               |
+-----------------------------------------------------------------------------------+
```

### Mobile Layout (< 1024px):
```
+-----------------------------------------------------------------------------------+
|  [≡ Menu] InfiniNOC                                       [🔔 Alerts] [👤 User]   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  MOBILE MAIN CONTENT VIEW (Single Column Cards)                                   |
|  - 320px to 414px optimization                                                    |
|  - 44px min touch target buttons                                                  |
|  - No horizontal page scroll overflow                                             |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [🏠 Home]    [📡 Monitors]    [⚡ Alerts]    [🚨 Incidents]    [⚙️ Settings]    |
+-----------------------------------------------------------------------------------+
```

---

## 6. Component Specification

1. **Header Component**:
   - Organization Switcher dropdown with clear role badge (`OWNER`, `ADMIN`, `ENGINEER`).
   - Quick Global Search input (`/` shortcut).
   - Theme toggle (Light / Dark / Auto).
   - Notifications drawer trigger with unread badge count.

2. **Sidebar Component**:
   - Fixed width 240px - 260px.
   - Grouped navigation submenus (`Overview`, `Monitoring`, `Network`, `Operations`, `Reports`, `Communication`, `Organization`).
   - Active route styling: subtle brand tint (`var(--secondary)`), saffron/accent indicator line, bold text.

3. **NOC Health & Dashboard Components**:
   - **KPI Metric Cards**: Compact telemetry metrics (Total Monitors, Up, Down, Warning, Availability %).
   - **Network Health Ring Visualizer**: Clean SVG/Canvas health ring indicating operational percentage.
   - **Monitor Status Breakdown**: Quick filter pills (All, Up, Down, Paused, Pending).
   - **Active Incidents & Timeline Feed**: High-contrast severity tags (`🔴 P1 Critical`, `🟠 P2 Major`).
   - **Latency Performance Chart**: Interactive, theme-aware response time & packet loss chart.

4. **Monitor Detail View**:
   - Preserves 100% of Uptime Kuma core monitor functionality (heartbeat status, latency graphs, check history, notifications, pause/edit controls).
   - Wrapped in crisp, modern SaaS layout.

5. **SaaS Billing & Team Management**:
   - Resource quota progress bars (Monitors, Devices, Probes, Users).
   - Modern tier plan comparison cards with Razorpay payment checkout integration.

---

## 7. Responsive Breakpoints

- `xs`: `320px` (Compact mobile phones)
- `sm`: `375px` - `414px` (Standard smartphones)
- `md`: `768px` (Tablets / Mobile drawer threshold)
- `lg`: `1024px` (Laptops / Desktop sidebar threshold)
- `xl`: `1280px` (Desktop workstations)
- `xxl`: `1440px+` (NOC Wall Displays)

---

## 8. Accessibility & Quality Rules

- **Contrast**: Text contrast ratio >= `4.5:1` for standard text and >= `3.0:1` for large headers.
- **Interactive Targets**: Minimum `44px x 44px` touch target size on mobile devices.
- **Focus Indicators**: Visible focus ring (`var(--ring)`) on interactive keyboard navigation.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` by disabling smooth layout animations.
