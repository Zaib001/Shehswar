# SHEHSWAR ONE360 — Typography System

## 1. Typeface Hierarchy

SHEHSWAR ONE360 uses an enterprise multi-font typographic hierarchy designed for high data density, readability across large financial tables, and clarity on plant terminal displays:

1. **Body & Interface Text — Inter (`--font-sans`)**:
   - Modern, geometric grotesque sans-serif with tall x-height and clear punctuation distinctions.
   - Standard font for inputs, labels, table cells, buttons, and navigation.
2. **Display Headings — Outfit (`--font-display`)**:
   - Distinctive, confident industrial display font for H1/H2 page titles, brand marks, and large KPI metric numerals.
3. **Data & Telemetry — JetBrains Mono (`--font-mono`)**:
   - Monospaced font with tabular numerals for currency values (`PKR 48,250,000`), chemical batch IDs (`#UB-4401`), percentages, timestamps, and assay metrics to guarantee exact vertical column alignment.

---

## 2. Scale & Tokens

| Token | CSS Size | Pixel Equiv | Default Line Height | Primary Enterprise Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--font-size-2xs` | `0.6875rem` | 11px | `1.2` | Table subtext, timestamp notes, badge pills |
| `--font-size-xs` | `0.75rem` | 12px | `1.3` | Form labels, table headers, helper text, breadcrumbs |
| `--font-size-sm` | `0.875rem` | 14px | `1.4` | Table cell data, standard body text, input fields, buttons |
| `--font-size-base` | `1.0rem` | 16px | `1.5` | Section introductions, card titles, modal body |
| `--font-size-lg` | `1.125rem` | 18px | `1.4` | Subsection titles, modal headers |
| `--font-size-xl` | `1.25rem` | 20px | `1.3` | Section headers (H3), dialog titles |
| `--font-size-2xl` | `1.5rem` | 24px | `1.2` | Page title (H1), primary KPI metric values |
| `--font-size-3xl` | `1.875rem` | 30px | `1.2` | Executive dashboard summary headline |
| `--font-size-4xl` | `2.25rem` | 36px | `1.1` | Financial executive balance banners |

---

## 3. Font Weights

```css
--font-weight-regular: 400;   /* Standard descriptive copy */
--font-weight-medium: 500;    /* Interactive elements, labels, table rows */
--font-weight-semibold: 600;  /* Card titles, column headers, highlighted metrics */
--font-weight-bold: 700;      /* Section headings, primary values */
--font-weight-extrabold: 800; /* SHEHSWAR brand mark and major titles */
```

---

## 4. Operational Rules for Large Data Tables & Forms

- **No Pure Black Text**: High contrast text is styled as `var(--text-primary)` (Dark mode `#f8fafc` / Light mode `#0f172a`), avoiding `#000000` to prevent visual fatigue.
- **Tabular Numerals**: All numbers, quantities, and currencies must use `--font-mono` so digits line up without horizontal jitter.
- **Truncation**: Use `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` with explicit max-width for long chemical product names.
