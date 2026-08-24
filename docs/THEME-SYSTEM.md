# InfiniNOC — Theme Architecture & System Guidelines

This document details the centralized theme and appearance system in InfiniNOC, designed for maximum legibility, seamless visual switching, and complete multi-theme isolation.

---

## 1. Overview & Architecture

InfiniNOC uses a centralized **Semantic Design Token Architecture** built upon CSS Custom Properties (CSS Variables). Theme selection is managed through `src/mixins/theme.js`, which dynamically applies `light` or `dark` class bindings and `data-theme` attributes on `document.body` and `document.documentElement`.

### Core Modes Supported

| Mode | Trigger Mechanism | Description |
| :--- | :--- | :--- |
| **LIGHT** | `localStorage.theme = "light"` | Forced clean, enterprise Light theme with white cards and soft shadows. |
| **DARK** | `localStorage.theme = "dark"` | Forced NOC/SOC Dark theme with deep navy surfaces (`#0b1220`) and slate accents. |
| **AUTO** | `localStorage.theme = "auto"` | Follows system OS & browser preference via `window.matchMedia("(prefers-color-scheme: dark)")`. |

---

## 2. Semantic Design Tokens

All UI components reference semantic design tokens defined in `src/assets/vars.scss` and `src/assets/app.scss` rather than hardcoding static hex values.

```css
/* Light Theme (:root / body.light) */
:root {
    --background: #f8fafc;
    --foreground: #0f172a;

    --card: #ffffff;
    --card-foreground: #0f172a;

    --popover: #ffffff;
    --popover-foreground: #0f172a;

    --primary: #1e3a8a;          /* Deep Navy */
    --primary-foreground: #ffffff;

    --secondary: #f1f5f9;
    --secondary-foreground: #1e293b;

    --muted: #f8fafc;
    --muted-foreground: #64748b;

    --accent: #ff9933;           /* Indian Saffron */
    --accent-foreground: #0f172a;

    --border: #e2e8f0;
    --input: #ffffff;
    --ring: #2563eb;

    --sidebar: #ffffff;
    --sidebar-foreground: #0f172a;
    --sidebar-border: #e2e8f0;

    --success: #16a34a;          /* Green operational */
    --warning: #d97706;          /* Saffron warning */
    --danger: #dc2626;           /* Critical red */
    --info: #2563eb;             /* Telemetry blue */

    --input-bg: #ffffff;
    --input-border: #cbd5e1;
    --input-text: #0f172a;
}

/* Dark Theme (body.dark / [data-theme="dark"]) */
body.dark,
[data-theme="dark"] {
    --background: #0b1220;
    --foreground: #f8fafc;

    --card: #151e30;
    --card-foreground: #f8fafc;

    --popover: #151e30;
    --popover-foreground: #f8fafc;

    --primary: #ff9933;          /* Saffron highlight */
    --primary-foreground: #0b1220;

    --secondary: #1e293b;
    --secondary-foreground: #cbd5e1;

    --muted: #1e293b;
    --muted-foreground: #94a3b8;

    --accent: #38bdf8;
    --accent-foreground: #0b1220;

    --border: #2a374e;
    --input: #1b263b;
    --ring: #38bdf8;

    --sidebar: #0f172a;
    --sidebar-foreground: #f8fafc;
    --sidebar-border: #1e293b;

    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #38bdf8;

    --input-bg: #111827;
    --input-border: #374151;
    --input-text: #f9fafb;
}
```

---

## 3. Dynamic Auto Mode Listener (`prefers-color-scheme`)

Auto mode attaches a non-blocking media query listener in `src/mixins/theme.js`:

```javascript
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
this.system = mediaQuery.matches ? "dark" : "light";

mediaQuery.addEventListener("change", (e) => {
    this.system = e.matches ? "dark" : "light";
});
```

When OS color preference shifts between Light and Dark modes while **Auto** is selected, the interface immediately adapts without requiring a page reload or context reset.

---

## 4. Theme-Aware Chart Adapter (`PingChart.vue`)

Chart.js components dynamically update grid lines, text labels, tooltips, and legends based on `this.$root.isDark`:

- **Grid lines**: `rgba(0,0,0,0.08)` in Light mode; `rgba(255,255,255,0.08)` in Dark mode.
- **Axis & Label text**: `#475569` in Light mode; `#94a3b8` in Dark mode.
- **Tooltip popovers**: White `#ffffff` background with dark text in Light mode; Elevated `#1e293b` background in Dark mode.

---

## 5. Guidelines for Future Component Development

When creating new Vue components or pages for InfiniNOC:
1. **Never hardcode dark background colors** (`#0f172a`, `#1e293b`, `#000000`) in `<style scoped>` or inline `style="..."`.
2. **Use design token classes** (`.shadow-box`, `.noc-card`, `.noc-section-box`, `.noc-input`) or CSS custom properties (`var(--background)`, `var(--card)`, `var(--foreground)`, `var(--border)`).
3. **Use semantic status colors** (`--success`, `--warning`, `--danger`, `--info`) for operational state badges.
4. **Ensure WCAG contrast**: Always pair text tokens (`var(--foreground)`) with container tokens (`var(--card)` or `var(--background)`).
