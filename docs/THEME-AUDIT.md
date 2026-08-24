# InfiniNOC — Theme Architecture & Audit Report

## 1. Current Theme Architecture Overview
- **State Source**: `src/mixins/theme.js` managed globally on `$root` (Vue instance).
- **Supported Modes**: `light`, `dark`, `system` / `auto`.
- **Persistence**: `localStorage.theme` (`"light"` | `"dark"` | `"auto"`).
- **System Preference Detection**: Managed via `window.matchMedia("(prefers-color-scheme: dark)")` listener updating `this.system`.
- **DOM Application**: `theme.js` applies `.light` or `.dark` class to `document.body` and sets `data-theme="light|dark"` on `document.documentElement` (`<html>`).

---

## 2. Identified Theme Vulnerabilities & Dark Mode Visibility Failures
1. **Header Theme Toggle Misconfiguration**:
   - The desktop/mobile header contained a single toggle button that failed to display an icon or render option state for `system` / `auto` mode, displaying as an empty box on certain viewports.
   - Missing dedicated theme switcher dropdown with active checkmarks (`☀ Light`, `☾ Dark`, `▣ System`).
2. **Hardcoded Fallbacks in SCSS (`Layout.vue`, `app.scss`)**:
   - Scoped styles in `Layout.vue` and `vars.scss` hardcoded `#1e293b` and `#334155` fallbacks into headers, sidebars, and cards regardless of theme.
   - Bootstrap `.bg-secondary` applied solid `#6c757d` gray boxes instead of semantic surface colors (`var(--card)` / `var(--secondary)`).
3. **Card & Form Control Inconsistencies**:
   - Reusable cards and modals hardcoded `background-color: white` or `bg-secondary` in Light mode without proper dark theme surface variables.
   - Inputs, selects, and textareas in dark mode lacked contrast for placeholder and value text.

---

## 3. Centralized Semantic Design Tokens

### Light Theme Tokens (:root)
- `--background`: `#f8fafc` (Very light neutral)
- `--foreground`: `#0f172a` (Dark navy text)
- `--surface`: `#ffffff` (White card surface)
- `--surface-elevated`: `#ffffff`
- `--card`: `#ffffff`
- `--card-foreground`: `#0f172a`
- `--border`: `#e2e8f0` (Subtle light border)
- `--primary`: `#1e3a8a` (InfiniNOC Blue)
- `--accent`: `#ff9933` (Saffron/Orange)
- `--sidebar`: `#ffffff`
- `--sidebar-border`: `#e2e8f0`

### Dark Theme Tokens (body.dark, [data-theme="dark"])
- `--background`: `#0b1220` (Deep navy page background)
- `--foreground`: `#f8fafc` (Near-white text)
- `--surface`: `#151e30` (Elevated dark navy surface)
- `--surface-elevated`: `#1e293b`
- `--card`: `#151e30`
- `--card-foreground`: `#f8fafc`
- `--border`: `#1e293b` (Subtle blue/slate border)
- `--primary`: `#38bdf8` (Sky blue highlight)
- `--accent`: `#ff9933` (Saffron accent)
- `--sidebar`: `#0f172a`
- `--sidebar-border`: `#1e293b`

---

## 4. Header Theme Toggle Specification
- **Button**: 38x38 rounded button with dynamic icon:
  - Light mode: `☀` (Sun icon) + tooltip "Light mode"
  - Dark mode: `☾` (Moon icon) + tooltip "Dark mode"
  - System mode: `desktop` (Monitor icon) + tooltip "System theme"
- **Dropdown Menu**:
  - `☀ Light`
  - `☾ Dark`
  - `▣ System` (with active checkmark indicator)
