# InfiniNOC — Theme & UI Developer Guidelines

## 1. Core Principles
1. **Single Source of Truth**: All components must consume global theme tokens on `$root` (`$root.userTheme`, `$root.theme`).
2. **No Hardcoded Fills**: Never hardcode `#ffffff`, `bg-white`, `bg-dark`, `#000000`, or `#6c757d` into reusable cards, tables, modals, or page containers.
3. **Semantic CSS Tokens**: Always use CSS variables:
   - Page background: `var(--background)`
   - Cards / Containers: `var(--card)`
   - Text Primary: `var(--foreground)` or `var(--card-foreground)`
   - Text Secondary / Muted: `var(--muted-foreground)`
   - Borders: `var(--border)`
   - Primary Action: `var(--primary)`
   - Accent: `var(--accent)` (`#ff9933`)

---

## 2. Light Theme Rules
- **Background**: Soft neutral light (`#f8fafc`).
- **Cards**: Crisp white (`#ffffff`) with 1px subtle border (`#e2e8f0`).
- **Headings & Body**: Deep navy (`#0f172a`, `#1e293b`).
- **Muted Text**: Slate (`#64748b`).

---

## 3. Dark Theme Rules
- **Background**: Deep navy (`#0b1220`).
- **Cards**: Elevated dark navy (`#151e30`, `#1e293b`). NEVER white!
- **Headings & Body**: Near-white (`#f8fafc`).
- **Muted Text**: Light slate (`#94a3b8`).
- **Borders**: Subtle blue/slate (`#1e293b`, `#334155`).

---

## 4. Forbidden Patterns
❌ `style="background: white;"` or `class="bg-white"` inside cards/modals.
❌ `class="bg-secondary"` on full-width panels (causes solid `#6c757d` gray boxes).
❌ `style="color: white;"` on elements without explicit background containers.
❌ Hardcoded dark colors in light mode or hardcoded light colors in dark mode.
