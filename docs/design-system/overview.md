# SHEHSWAR ONE360 — Design System Overview

## 1. Executive Summary

The **SHEHSWAR ONE360 Design System** is the visual, interactive, and architectural foundation powering all enterprise web applications across the Shehswar Group. 

It is engineered to provide an experience comparable to modern SaaS leaders (**Linear, Notion, Stripe Dashboard**) combined with the operational rigor and data density of enterprise ERP suites (**SAP Fiori, Microsoft Dynamics 365, Oracle Fusion**).

### Core Philosophy: "Build Once, Reuse Everywhere"

Every future operational module (Procurement, Raw Material Inventory, Chemical Production, Quality Control, Intercompany Orders, Sales CRM, and Finance) must be assembled strictly from existing design system components, layout tokens, and page archetypes. 

No developer may author ad-hoc buttons, custom tables, unstyled forms, or non-tokenized CSS values.

---

## 2. Design Principles

### Simplicity & Clarity
- ERP systems are operational tools utilized daily by non-technical plant operators, chemical warehouse managers, logistics coordinators, and accountants.
- Interfaces must be obvious, avoiding hidden gestures, confusing navigation trees, or overwhelming screen clutter.

### Information-First Architecture
- Every screen immediately answers four operational questions:
  1. **What is happening?** (Clear titles, status tags, and breadcrumbs)
  2. **What needs attention?** (Pulsing alert badges, quarantine notices, pending approvals)
  3. **What action is required?** (Primary actionable buttons highlighted via brand green)
  4. **What is the current status?** (Unified status badges and multi-stage workflow steppers)

### Industrial Strength & Enterprise Trust
- Visual identity communicates reliability, accuracy, chemical manufacturing strength, and security.
- Avoid gaming-style decorations, high-saturation neon gradients, or distracting decorative animations.
- Precision layout tokens (4px baseline grid) and mathematical typography line heights.

---

## 3. Technology Stack & Zero-Dependency Strategy

1. **Framework**: Next.js 14 App Router, React 18, TypeScript 5.
2. **Styling Core**: Pure CSS Custom Properties (`:root` tokens in `globals.css`) with zero runtime styling overhead.
3. **No External CSS Frameworks**: Built with pure vanilla CSS and standard CSS variables—avoiding Tailwind cascades or bloat while ensuring full dark/light theme switching.
4. **Data Visualization**: Lightweight, accessible, theme-reactive SVG charts with zero external charting library dependencies.
5. **Iconography**: Uniform 24px/20px/16px geometric vector SVG icons with 2px stroke weight.

---

## 4. Architectural Anatomy

```
apps/web/src/
├── app/
│   ├── globals.css              # Centralized token definitions & theme maps
│   ├── layout.tsx               # Root provider setup (Auth, Theme, Toast)
│   └── page.tsx                 # Living Showroom & Archetype Explorer
├── components/
│   ├── ui/                      # 22 Atomic & Composite Enterprise Controls
│   │   ├── Button.tsx           # Button system (6 variants, 3 sizes, loading)
│   │   ├── Input.tsx            # Form input with floating labels & icons
│   │   ├── CurrencyInput.tsx    # Multi-currency financial input (PKR/USD)
│   │   ├── QuantityInput.tsx    # Industrial quantity stepper with unit badge
│   │   ├── PercentageInput.tsx  # Margin/tax percentage input
│   │   ├── Select.tsx           # Searchable multi-select with tag pills
│   │   ├── Textarea.tsx         # Expandable text area with character limit
│   │   ├── Checkbox.tsx         # Accessible custom styled checkbox
│   │   ├── Switch.tsx           # Binary toggle switch
│   │   ├── Badge.tsx            # Semantic badges with status dots
│   │   ├── StatusBadge.tsx      # ERP workflow status badge mapping
│   │   ├── Card.tsx             # Card containers (header, body, footer)
│   │   ├── KpiCard.tsx          # Real-time metric cards with trend indicators
│   │   ├── Modal.tsx            # Accessible modal dialog with backdrop blur
│   │   ├── Drawer.tsx           # Side inspection drawer (slide-over panel)
│   │   ├── Tabs.tsx             # Segmented pill and underline tabs
│   │   ├── WorkflowTracker.tsx  # Multi-stage lifecycle approval stepper
│   │   ├── Timeline.tsx         # Tamper-evident audit & activity history
│   │   ├── Skeleton.tsx         # Shimmer loading placeholders
│   │   ├── EmptyState.tsx       # Empty query/zero-state layouts
│   │   ├── ErrorState.tsx       # Enterprise error boundaries
│   │   ├── FileUpload.tsx       # Drag-and-drop document upload
│   │   └── DataTable.tsx        # Flagship enterprise data table
│   ├── charts/                  # Zero-dependency SVG Charts
│   │   ├── BarChart.tsx         # Grouped and single production bar chart
│   │   ├── LineChart.tsx        # Multi-point trend line with gradient fill
│   │   ├── DonutChart.tsx       # Inventory valuation breakdown chart
│   │   └── ProgressMetric.tsx   # Capacity utilization meter
│   ├── layout/                  # Application Shell & Navigation
│   │   ├── app-shell.tsx        # Responsive layout container
│   │   ├── Sidebar.tsx          # Collapsible multi-tier navigation
│   │   ├── TopHeader.tsx        # Company switcher & notification center
│   │   ├── CommandMenu.tsx      # Spotlight palette (Ctrl+K)
│   │   ├── Breadcrumbs.tsx      # Navigational trail
│   │   └── PageHeader.tsx       # Standardized page title & actions
│   ├── templates/               # 4 Standard Page Archetypes
│   │   ├── ListPageTemplate.tsx     # Master registry / search / table
│   │   ├── DetailPageTemplate.tsx   # 360° record / tabs / timeline
│   │   ├── FormPageTemplate.tsx     # Sectioned create/edit with sticky bar
│   │   └── DashboardTemplate.tsx    # Executive KPIs & telemetry grid
│   └── icons/                       # 30+ Enterprise SVG icons
└── context/
    ├── auth-context.tsx         # Identity & tenant token state
    ├── theme-context.tsx        # Dark/light theme persistence
    └── toast-context.tsx        # Global floating notification toasts
```
