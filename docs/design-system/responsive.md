# SHEHSWAR ONE360 — Responsive Layout & Breakpoint System

## 1. Responsive Philosophy

SHEHSWAR ONE360 delivers an optimal operational experience across the entire hardware spectrum:
- **Control Room Terminals & Multi-Monitor Desktops** (1920px, 1440px)
- **Standard Laptop Displays** (1280px, 1024px)
- **Field & Plant Floor Tablets** (768px, 820px, Landscape & Portrait)
- **Mobile Handheld Browsers** (390px, 360px)

---

## 2. Breakpoint Standard

| Breakpoint | Minimum Width | Device Archetype | Primary UX Adaptation |
| :--- | :--- | :--- | :--- |
| `xs` | `0px` | Small touch smartphones (360px - 390px) | Single column vertical stack, card table view, drawer navigation |
| `sm` | `640px` | Large smartphones / phablets | 2-column form grids, condensed header |
| `md` | `768px` | Portrait tablets / iPads | Collapsed icon-rail sidebar (72px), scrollable tables |
| `lg` | `1024px` | Landscape tablets / small laptops | Expanded 280px sidebar, full multi-column tables |
| `xl` | `1280px` | High-res desktop workstations | Full dashboard grid (3-column widgets, split tables) |
| `2xl` | `1536px+` | Ultra-wide plant command center displays | Max canvas width constrained to 1600px with center gutter |

---

## 3. Component-Specific Responsive Rules

### Sidebar
- **Desktop (1024px+)**: Full expanded sidebar (280px width) with nested menu trees and section categories.
- **Tablet (768px - 1023px)**: Icon-rail mode (72px width) maximizing central workspace while keeping primary icons accessible.
- **Mobile (<768px)**: Off-canvas slide-out drawer triggered by the header hamburger button with backdrop overlay.

### Tables (`DataTable.tsx`)
- **Desktop**: Full tabular view with sticky headers, checkbox selection, and multi-column sorting.
- **Tablet**: Horizontal scrolling with priority column clipping (e.g., ID, Entity, Yield, Status stay prominent).
- **Mobile (<640px)**: Automatic or manual toggle into **Responsive Card View**, converting each tabular row into a touch-friendly stacked card with labeled key-value pairs.

### Forms (`FormPageTemplate.tsx`)
- **Desktop**: 3-column or 2-column responsive input grids.
- **Mobile**: Stacked single-column layout with 44px minimum touch targets and sticky bottom action bar.

### Dashboards (`DashboardTemplate.tsx`)
- **Desktop**: 4-column KPI cards grid, 2-column analytics charts, 3-column auxiliary widgets.
- **Tablet**: 2-column KPI cards, stacked full-width charts.
- **Mobile**: Single vertical stack.
