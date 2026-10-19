# SHEHSWAR ONE360 — Color System & Design Tokens

## 1. Brand Identity & Semantic Meaning

SHEHSWAR ONE360's color palette represents **Industrial Strength, Chemical Precision, Manufacturing Discipline, and Reliability**.

- **Primary Color — Industrial Emerald (`--brand-600: #0d9488`)**: Reflects chemical growth, plant vitality, agriculture, and quality standards.
- **Secondary Accent — Steel Blue (`--accent-500: #0284c7`)**: Symbolizes engineering precision, ERP telemetry, cloud connectivity, and cold steel.
- **Dark Theme Canvas (`--bg-canvas: #090d16`)**: Deep industrial slate providing high-contrast clarity for continuous plant control room operations.
- **Light Theme Canvas (`--bg-canvas: #f8fafc`)**: Crisp, clean, paper-grade off-white minimizing eye strain in high-ambient office lighting.

---

## 2. Token Definitions

### Brand Scale (Emerald & Teals)
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `--brand-50` | `#f0fdfa` | Subtle light mode tint |
| `--brand-100` | `#ccfbf1` | Light mode badge background |
| `--brand-500` | `#14b8a6` | Bright accent indicator |
| `--brand-600` | `#0d9488` | **Primary Brand Color** |
| `--brand-700` | `#0f766e` | Button hover state |
| `--brand-900` | `#134e4a` | Deep emerald border |
| `--brand-950` | `#042f2e` | Shadow tint |

### Semantic Status Tokens
| State | Light Theme Token | Dark Theme Token | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| **Success** | `#059669` | `#10b981` | Approved, Released, Healthy, In Stock |
| **Warning** | `#d97706` | `#f59e0b` | Pending Approval, Approaching Limit, Low Buffer |
| **Danger** | `#dc2626` | `#ef4444` | QC Quarantine, Rejected, Error, Overdue |
| **Info** | `#2563eb` | `#3b82f6` | Submitted, Informational Notice, In Transit |

---

## 3. Surface & Elevation Layers

### Dark Mode (Default)
```css
--bg-canvas: #090d16;          /* Deepest foundation layer */
--bg-surface: #0f172a;         /* Cards, tables, sidebars */
--bg-surface-raised: #1e293b;  /* Modals, popovers, dropdowns */
--bg-hover: #1e293b;           /* Table row hover, list item hover */
--border-subtle: #1e293b;      /* Subtle dividers */
--border-default: #334155;     /* Standard component borders */
--border-strong: #475569;      /* Focused state borders */
--text-primary: #f8fafc;       /* Highest contrast text */
--text-secondary: #94a3b8;     /* Supporting information */
--text-muted: #64748b;         /* Disabled, timestamps, placeholders */
```

### Light Mode (`[data-theme='light']`)
```css
--bg-canvas: #f8fafc;          /* Off-white background */
--bg-surface: #ffffff;         /* Pure white cards */
--bg-surface-raised: #ffffff;  /* Raised modals with shadow */
--bg-hover: #f1f5f9;           /* Slate-100 hover */
--border-subtle: #f1f5f9;      /* Very light dividing lines */
--border-default: #e2e8f0;     /* Standard borders */
--border-strong: #cbd5e1;      /* Focused borders */
--text-primary: #0f172a;       /* Slate-900 high contrast */
--text-secondary: #475569;     /* Slate-600 body text */
--text-muted: #94a3b8;         /* Slate-400 placeholder text */
```

---

## 4. White-Label & Multi-Company Support

The design system is engineered for future white-label customer deployments. By setting CSS properties on the tenant root, the entire application adapts instantly:

```html
<html data-theme="dark" style="--color-primary: #2563eb; --brand-600: #2563eb;">
```
