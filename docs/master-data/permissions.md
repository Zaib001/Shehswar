# Permission Management Architecture & Matrix Specification

## 1. Executive Overview

**SHEHSWAR ONE360** implements a multi-dimensional Permission Matrix architecture. Every operation in the platform evaluates a pair consisting of an **ERP Module Resource** and a specific **Action Verb**.

### Matrix Dimensions
- **Modules**:
  - `Organization` (Enterprise structure & master records)
  - `Users` (User administration, sessions & roles)
  - `Procurement` (Vendor orders & requisitions)
  - `Inventory` (Warehouses, stock & goods receipts)
  - `Production` (Chemical reactors, batch recipes & formulas)
  - `QC` (Laboratory testing, certificates of analysis)
  - `Sales` (Dealers, commercial bookings & deliveries)
  - `Finance` (General ledger, billing & payments)
- **Standard Actions**:
  1. `View` (Read-only query access)
  2. `Create` (Draft new entity or document)
  3. `Edit` (Modify existing draft record)
  4. `Delete` (Soft delete / deactivate record)
  5. `Submit` (Advance record to workflow review)
  6. `Approve` (Authorize workflow transition)
  7. `Reject` (Decline workflow transition)
  8. `Export` (Download data to CSV / Excel / PDF)

---

## 2. Interactive Permission Matrix View

The permissions matrix view provides administrative users with full interactive control over role entitlements:

```
+------------------------------------+---------------------------------------------------------------+
| Module                             | View   Create   Edit   Delete   Submit   Approve  Reject   Export |
+------------------------------------+---------------------------------------------------------------+
| Organization                       |  [✓]    [✓]     [✓]     [ ]      [ ]       [ ]      [ ]     [✓]   |
| Users & RBAC                       |  [✓]    [✓]     [✓]     [ ]      [ ]       [ ]      [ ]     [✓]   |
| Procurement & Purchase Orders      |  [✓]    [✓]     [✓]     [ ]      [✓]       [✓]      [✓]     [✓]   |
| Inventory & Warehousing            |  [✓]    [✓]     [✓]     [ ]      [✓]       [✓]      [ ]     [✓]   |
| Chemical Production & Batches      |  [✓]    [✓]     [✓]     [ ]      [✓]       [✓]      [ ]     [✓]   |
| Quality Control & COA              |  [✓]    [✓]     [✓]     [ ]      [✓]       [✓]      [✓]     [✓]   |
| Commercial Sales & Dealers         |  [✓]    [✓]     [✓]     [ ]      [✓]       [✓]      [ ]     [✓]   |
| General Ledger & Treasury          |  [✓]    [ ]     [ ]     [ ]      [ ]       [✓]      [ ]     [✓]   |
+------------------------------------+---------------------------------------------------------------+
```

---

## 3. Responsive UI Behavior

To guarantee optimal user experience across all device form factors:
- **Desktop (>= 1024px)**: Complete multi-column interactive matrix table with row-level bulk toggles (`Select All`, `Clear All`) and column-level toggles.
- **Tablet & Mobile (< 1024px)**: Automatically switches to a touch-optimized **Card-based Matrix**. Each module renders as an individual card with grouped action checkboxes and badge counters.

---

## 4. Backend Authorization Enforcement

Frontend permission checks hide unauthorized actions; however, backend APIs **always enforce** permission verification:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permissions('procurement:approve')
@Post('purchase-orders/:id/approve')
async approvePurchaseOrder(...) { ... }
```
Attempts to bypass the UI and hit API endpoints directly without requisite permissions trigger an immutable audit event and return `HTTP 403 Forbidden`.
