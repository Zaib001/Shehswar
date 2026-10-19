# SHEHSWAR ONE360 — Frontend Architecture & Developer Guidelines

## 1. Directory Structure Standards

To ensure long-term codebase hygiene across all future ERP modules (Procurement, Inventory, Production, QC, Sales, CRM, Finance), code must be organized strictly according to these conventions:

```
apps/web/src/
├── app/                      # Next.js App Router routes & layouts
│   ├── globals.css           # Global design tokens and animations
│   ├── layout.tsx            # Root layout with theme, auth, toast providers
│   └── page.tsx              # Living showroom & component gallery
├── components/
│   ├── ui/                   # Reusable atomic & composite components (Button, Input, DataTable)
│   ├── charts/               # Zero-dependency SVG data visualization components
│   ├── layout/               # Application Shell, Sidebar, TopHeader, CommandMenu
│   ├── templates/            # 4 Reusable Page Templates (List, Detail, Form, Dashboard)
│   └── icons/                # Uniform 2px stroke enterprise SVG icons
├── context/                  # React Context providers (Auth, Theme, Toast)
└── lib/                      # API client, numeric formatters, dates, permission helpers
```

---

## 2. Component Construction Rules

### Rule 1: Zero Hardcoded Colors or Spacing
Never write hardcoded pixel margins, hex colors, or custom box-shadows:
- **WRONG**: `style={{ color: '#10b981', padding: '15px' }}`
- **CORRECT**: `style={{ color: 'var(--success-500)', padding: 'var(--space-md)' }}`

### Rule 2: Pure CSS Variables — Zero Tailwind Cascades
To guarantee instant theme swapping between Dark and Light mode without runtime class recalculations or heavy CSS bundle overhead, all styles must bind to CSS custom properties defined in `globals.css`.

### Rule 3: Monetary & Numeric Precision
- Never format currency numbers manually.
- Use `CurrencyInput` for user inputs and standard decimal formatting (`DECIMAL(18, 4)` compatibility) with `--font-mono` for all tabular ledger displays.

### Rule 4: Permission-Aware UI Rendering
Before rendering mutating action buttons (Edit, Delete, Approve, Export), verify user authorizations via the `useAuth()` hook:
```tsx
const { can } = useAuth();

{can('approve', 'purchase_order') && (
  <Button variant="success" onClick={handleApprove}>Approve PO</Button>
)}
```
*Note: Backend authorization checks remain the final security authority.*

---

## 3. Data Fetching & State Management Strategy

1. **Server State**: Managed via structured REST calls to `/api/v1` through `ApiClient`.
2. **Local Component State**: Handled via standard React `useState` / `useReducer` for form inputs, table sorting, active tabs, and modals.
3. **Cross-Cutting Global State**: Isolated to lightweight Contexts:
   - `ThemeContext`: Dark/Light theme mode and persistence.
   - `AuthContext`: Active JWT, permissions check `can(...)`, and tenant company context.
   - `ToastContext`: Floating asynchronous notifications.
4. **No Giant Global Stores**: Avoid introducing massive Redux/Zustand boilerplate for simple screen state.

---

## 4. Performance Requirements

- **Zero Blank Screens**: Always render `TableSkeleton` or `Skeleton` during asynchronous API fetching.
- **Pure SVG Charts**: All charts (`BarChart`, `LineChart`, `DonutChart`) are pure inline SVGs without heavy D3 or Chart.js bundle weight, rendering smoothly at 60fps.
- **Virtualization & Pagination**: Data tables default to 10 or 25 records per page to prevent DOM bloat during large multi-thousand-row queries.
