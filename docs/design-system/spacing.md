# SHEHSWAR ONE360 — Spacing & Layout Grid System

## 1. 4px Baseline Grid

SHEHSWAR ONE360 is built upon a strict **4px mathematical baseline grid**. All paddings, margins, component heights, and layout gaps are multiples of 4px.

This mathematical consistency guarantees that form controls, table cells, modal dialogs, and navigation sidebars align precisely without 1px visual offsets.

---

## 2. Spacing Tokens

| Token | Pixel Value | Rem Equiv | Common Enterprise UI Usage |
| :--- | :--- | :--- | :--- |
| `--space-2xs` | 2px | `0.125rem` | Micro badges, input border offsets, icon-to-text spacing |
| `--space-xs` | 4px | `0.25rem` | Form label-to-input gap, icon buttons, toolbar button gap |
| `--space-sm` | 8px | `0.5rem` | Table cell vertical padding, compact button padding, badge gaps |
| `--space-md` | 16px | `1.0rem` | Standard card padding, standard grid gap, header padding |
| `--space-lg` | 24px | `1.5rem` | Modal body padding, large section gaps, page margin on desktop |
| `--space-xl` | 32px | `2.0rem` | Page title bottom margin, form section dividers |
| `--space-2xl` | 48px | `3.0rem` | Hero banners, empty state vertical padding, footer clearance |
| `--space-3xl` | 64px | `4.0rem` | Executive view separators |

---

## 3. Border Radius Tokens

Enterprise software requires sharp, reliable, and modern curvature. Excessive pill-shaped inputs or oversized round corners waste screen real estate; subtle radii communicate industrial precision:

| Token | Value | Applied Components |
| :--- | :--- | :--- |
| `--radius-xs` | 2px | Currency prefix tags, miniature status indicators |
| `--radius-sm` | 4px | Compact buttons, dropdown menu items, checkboxes, tooltips |
| `--radius-md` | 8px | Standard inputs, standard buttons, select controls, table containers |
| `--radius-lg` | 12px | Standard cards, KPI metric widgets, notification dropdowns |
| `--radius-xl` | 16px | Modal dialogs, slide-over drawer panels, command menu |
| `--radius-2xl` | 24px | Feature announcement banners |
| `--radius-full`| 9999px | Status badges, user avatar circles, switch toggle track |

---

## 4. Shadow & Elevation Tokens

Elevations use subtle ambient occlusions with tinted shadows rather than harsh black drop-shadows:

| Token | CSS Definition | Usage |
| :--- | :--- | :--- |
| `--shadow-xs` | `0 1px 2px 0 rgba(0, 0, 0, 0.15)` | Subtle buttons, pill tabs |
| `--shadow-sm` | `0 1px 3px 0 rgba(0, 0, 0, 0.25), 0 1px 2px -1px rgba(0, 0, 0, 0.25)` | Standard cards |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)` | Hovered cards, KPI widgets |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35)` | Dropdown menus, popovers |
| `--shadow-xl` | `0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.45)` | Modals, Command Menu, Drawers |
