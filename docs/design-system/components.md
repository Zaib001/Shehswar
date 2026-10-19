# SHEHSWAR ONE360 — Component Library Specifications

## 1. Component Architecture & Principles

All components in SHEHSWAR ONE360 adhere to the following strict architectural rules:
1. **Zero Ad-hoc Styling**: Every component consumes tokens from `globals.css`.
2. **Accessible by Default**: ARIA labels, role bindings, keyboard traps, focus rings, and screen-reader polite regions.
3. **Compound & Composable**: Modals, Drawers, Cards, and Tables provide child primitives (`CardHeader`, `CardTitle`, `CardContent`, `CardFooter`) for flexible layouts.
4. **Theme Parity**: Complete visual fidelity in both Dark Mode (`var(--bg-canvas: #090d16)`) and Light Mode (`var(--bg-canvas: #f8fafc)`).

---

## 2. Core Interactive Components

### Buttons (`Button.tsx`)
- **Variants**:
  - `primary`: Solid Emerald (`#0d9488`), white text, used for the single primary call-to-action per view.
  - `secondary`: Slate surface with subtle border, used for complementary actions (Cancel, Filter, Export).
  - `ghost`: Transparent background, hover tint, used for in-row table actions.
  - `outline`: Emerald border with transparent background.
  - `success`: Solid green (`#10b981`) for positive workflow confirmations (Release Batch, Approve PO).
  - `danger`: Solid crimson (`#ef4444`) for destructive actions (Reject, Delete, Quarantine).
- **Sizes**: `sm` (32px), `md` (40px), `lg` (48px).
- **States**: `isLoading` (renders spinning CSS loader, disables click), `disabled`, `fullWidth`.

### Specialized Form Controls
- **`Input.tsx`**: Floating/fixed labels, validation error messages, helper text, start and end icons, clear button (`isClearable`).
- **`CurrencyInput.tsx`**: Industrial financial input with currency code tag (PKR, USD, EUR), tabular font styling, and numeric-only filtering.
- **`QuantityInput.tsx`**: Physical quantity stepper with increment/decrement buttons (`+` / `−`), direct numeric typing, min/max limits, and unit badge (Tons, Bags, Liters, Kg).
- **`PercentageInput.tsx`**: Percentage input with `%` suffix for tax rates, sales discounts, and formulation tolerances.
- **`Select.tsx`**: Accessible custom dropdown supporting fuzzy search, single and multi-select tags, keyboard navigation, and outside-click dismissal.
- **`Textarea.tsx`**: Auto-resizing text area with character counter (`showCount`) and maxLength enforcement.
- **`Checkbox.tsx` & `Switch.tsx`**: Accessible binary selection controls with custom SVG checkmarks and smooth toggle transitions.

### Status Indicators
- **`Badge.tsx`**: Compact semantic tags (`primary`, `secondary`, `success`, `warning`, `danger`, `info`, `neutral`) with optional colored indicator dot.
- **`StatusBadge.tsx`**: Specialized workflow mapping for ERP states:
  - `draft` (Neutral slate)
  - `submitted` (Info blue, pulsing dot)
  - `pending_approval` (Warning amber, pulsing dot)
  - `approved` (Success emerald)
  - `quarantine` (Danger crimson, pulsing dot)
  - `in_production` (Brand primary, pulsing dot)
  - `released` (Success emerald)
  - `completed` (Success emerald)
  - `rejected` (Danger crimson)
  - `cancelled` (Neutral slate)

### Containers, Overlays & Navigation
- **`Card.tsx`**: Clean elevation container with `default`, `raised`, `flat`, and `glass` variants.
- **`KpiCard.tsx`**: Metric display with primary value, trend delta (`+12.4% vs last month`), trend icon, accent top-border, and icon container.
- **`Modal.tsx`**: Centered dialog with backdrop blur, smooth scale-in animation, ESC key dismiss, body scroll lock, and sizes (`sm`, `md`, `lg`, `xl`, `full`).
- **`Drawer.tsx`**: Slide-over panel (right-side on desktop, bottom-sheet/full on mobile) for side filters, entity quick view, or parameter adjustment.
- **`Tabs.tsx`**: Segmented pill switch and traditional underline tabs with count badges and icons.
- **`WorkflowTracker.tsx`**: Stepper component visualizing multi-stage enterprise approval workflows with completed checkmarks, current pulsing indicator, and connector lines.
- **`Timeline.tsx`**: Audit & activity feed component showing actor avatar, action description, timestamp, and field diffs (`Price changed from X to Y`).
- **`DataTable.tsx`**: Enterprise table with multi-column sorting, global fuzzy search, column visibility toggles, pagination, row checkboxes, bulk actions bar, and mobile card view.
- **`FileUpload.tsx`**: Drag-and-drop document upload zone with file size validation, progress display, and attachment list.
