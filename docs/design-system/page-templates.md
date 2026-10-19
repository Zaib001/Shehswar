# SHEHSWAR ONE360 — Page Template System

## 1. Overview & Architectural Role

All future business modules in SHEHSWAR ONE360 (Procurement, Inventory, Production, QC, Sales, CRM, Finance) **must not invent bespoke page layouts**.

Instead, developers must instantiate one of the four standardized enterprise archetypes:
1. **Template 1 — List Page** (`ListPageTemplate.tsx`)
2. **Template 2 — 360-Degree Detail Page** (`DetailPageTemplate.tsx`)
3. **Template 3 — Create / Edit Form Page** (`FormPageTemplate.tsx`)
4. **Template 4 — Executive Dashboard** (`DashboardTemplate.tsx`)

---

## 2. Template 1: List Page (`ListPageTemplate`)

### Primary Use Cases
Master registries (Chemical Products, Approved Vendors, Dealer Network, Raw Materials, Inventory Stock Balances, Active Work Orders).

### Structural Anatomy
```
ListPageTemplate
├── PageHeader (Title, subtitle, breadcrumbs, "+ New Record", "Export Excel")
├── KPI Summary Cards Row (Total records, cumulative yield/valuation, active alerts)
└── DataTable Container
    ├── Search Bar (Fuzzy matching)
    ├── Column Visibility Menu
    ├── Bulk Selection Actions Bar
    ├── Tabular Grid / Mobile Card View Switcher
    └── Pagination Controls (Items per page, page jump)
```

### Usage Pattern
```tsx
import { ListPageTemplate } from '@/components/templates';

export default function ProductsPage() {
  return (
    <ListPageTemplate
      header={{
        title: "Master Chemical Products",
        subtitle: "Enterprise chemical product specifications, MSDS, and master formulas.",
        breadcrumbs: [{ label: "Master Data" }, { label: "Products" }],
        actions: <Button variant="primary">Add Product</Button>
      }}
      kpis={[...]}
      tableProps={{
        data: products,
        columns: productColumns,
        keyExtractor: (p) => p.id,
      }}
    />
  );
}
```

---

## 3. Template 2: 360° Detail Page (`DetailPageTemplate`)

### Primary Use Cases
Single-entity deep inspection (Chemical Batch record, Dealer profile, Supplier ledger, Purchase Order lifecycle).

### Structural Anatomy
```
DetailPageTemplate
├── PageHeader (Entity code, title, status badge, "Quick Edit", "Approve / Release")
├── Lifecycle Workflow Stepper (Draft → Synthesis → QC Lab → Manager Clearance → Released)
├── Summary Metric KPI Cards (Yield, Valuation, Assay purity, Warehouse location)
└── Tabbed Content Container
    ├── Tab 1: Overview & Technical BOM Recipe
    ├── Tab 2: S3 Document Attachments & QC Certificates
    └── Tab 3: Tamper-Evident Immutable Audit Timeline
```

---

## 4. Template 3: Create / Edit Form Page (`FormPageTemplate`)

### Primary Use Cases
Data entry workflows (Raw Material Purchase Requisitions, Formulation adjustments, Dealer onboarding).

### Structural Anatomy
```
FormPageTemplate
├── PageHeader (Breadcrumbs, title, helper text)
├── Form Section Cards (Grouped logical fields with clear descriptions)
│   ├── General Info (Subsidiary context, reference code, target delivery)
│   ├── Commercial Quantities (QuantityInput stepper, CurrencyInput, PercentageInput)
│   └── Attachments (FileUpload dropzone, MSDS PDFs, operational notes)
└── Fixed Sticky Action Bar
    ├── Validation Status Text
    ├── "Cancel" (Ghost button)
    ├── "Save Draft" (Secondary button)
    └── "Submit for Approval" (Primary button with loading state)
```

---

## 5. Template 4: Executive Dashboard (`DashboardTemplate`)

### Primary Use Cases
Plant management operational dashboards, executive finance summaries, and procurement command centers.

### Structural Anatomy
```
DashboardTemplate
├── PageHeader (Entity selector, live status badge, "Refresh Telemetry")
├── Real-Time KPI Metric Cards (Revenue, Active batches, Stock valuation, Yield %)
├── Primary Analytics Row (Production BarChart, 30-Day Revenue LineChart)
└── Auxiliary Widgets Row
    ├── Stock Valuation DonutChart
    ├── Critical Operational Alerts (Quarantine warnings, pending approvals)
    └── Recent Audit & Activity Timeline feed
```
