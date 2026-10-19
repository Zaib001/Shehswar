# SHEHSWAR ONE360 — Accessibility (a11y) & Usability Standards

## 1. Compliance Standard

SHEHSWAR ONE360 adheres strictly to **WCAG 2.1 Level AA** compliance across all enterprise screens:
- Industrial manufacturing software must be usable in diverse physical operating environments: high-glare plant control rooms, outdoor mobile inspection, low-contrast warehouse monitors, and keyboard-only desktop environments.

---

## 2. Accessible Design Rules

### 1. Contrast Ratios
- **Body Text (`--text-primary`) to Canvas (`--bg-canvas`)**: Exceeds **7:1** in both Dark (`#f8fafc` on `#090d16`) and Light (`#0f172a` on `#f8fafc`) modes (AAA grade).
- **Secondary Text (`--text-secondary`)**: Exceeds **4.5:1** against underlying card surfaces.
- **Interactive UI Components & Borders**: Exceed **3:1** against adjacent backgrounds.

### 2. Full Keyboard Navigation
- **Focus Rings**: All interactive controls (buttons, inputs, select triggers, table rows) feature high-visibility outline focus rings (`0 0 0 2px var(--color-primary-glow)`).
- **Tab Sequence**: Natural logical tab order matches visual layout (top-to-bottom, left-to-right).
- **Keyboard Shortcuts**:
  - `Ctrl + K` / `Cmd + K`: Spotlight command palette opens from anywhere.
  - `Escape`: Closes active Modals, Drawers, Command Menu, and dropdowns.
  - `Arrow Up / Arrow Down`: Navigates items in custom Select and CommandMenu.
  - `Enter / Space`: Selects active option or activates buttons.

### 3. ARIA Roles & Screen Reader Semantics
- **Modals & Drawers**: Rendered with `role="dialog"`, `aria-modal="true"`, and automatic focus trapping.
- **Live Notifications**: Toast notifications are mounted within a dedicated `<div aria-live="polite">` container to notify screen-reader users without interrupting task flow.
- **Form Controls**: Explicit `<label htmlFor="...">` associations for every input, select, and textarea.
- **Progress Indicators**: Standard `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- **Status Badges**: Include text alternatives and are never distinguished by color alone (always paired with clear textual labels and semantic icons).
