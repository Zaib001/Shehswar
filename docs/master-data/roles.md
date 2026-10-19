# Role Management (RBAC) Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, the `Role` entity implements fine-grained Role-Based Access Control (RBAC). Roles bundle specific module capabilities and action permissions, allowing security administrators to assign enterprise duties without hardcoding permissions to individual user records.

### Out-of-the-Box Standard Enterprise Roles
1. **Super Administrator (`SUPER_ADMIN`)**: Unrestricted platform-wide root access.
2. **Group Administrator (`GROUP_ADMIN`)**: Cross-company corporate management and consolidation oversight.
3. **Plant Operations Manager (`PLANT_MGR`)**: Supervisory control over plant synthesis, chemical recipes, and machine batching.
4. **Warehouse Operations Manager (`WH_MGR`)**: Inventory movements, stock transfers, and receiving bay management.
5. **Quality Assurance Chemist (`QC_MGR`)**: Lab tests, COA generation, inspection holds, and release approval.
6. **Finance & Treasury Manager (`FIN_MGR`)**: Financial ledger, PO sign-offs above threshold, credit checks.
7. **Commercial Sales Executive (`SALES_MGR`)**: Customer bookings, dealer dispatch, and sales quotations.

---

## 2. Entity Schema & Standards

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `organizationId` | `VARCHAR(36)` | `NOT NULL, FK` | Enterprise holding scope |
| `code` | `VARCHAR(50)` | `NOT NULL` | Role identifier string (e.g. `PLANT_MGR`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Descriptive role title |
| `description` | `TEXT` | `NULLABLE` | Functional duty and operational scope |
| `isSystem` | `BOOLEAN` | `NOT NULL, DEFAULT false` | Immutable system role flag (cannot be deleted) |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | `NOT NULL` | Last modified timestamp |

---

## 3. Principles of Least Privilege

- Non-system roles can be created, edited, and tuned dynamically per company or department requirements.
- The `isSystem` flag guarantees that essential administrative roles (`SUPER_ADMIN`) cannot be deleted or locked out, protecting system integrity.
- Role changes are applied immediately to permission checking caches without requiring server restarts.

---

## 4. UI Architecture & Features

- **Role List**: Displays active roles, assigned user counts, system role badges, and access scope indicators.
- **Role Detail**:
  - *Overview*: Role code, title, description, and status.
  - *Permissions Matrix Tab*: Visual matrix of effective permissions enabled for this role across all ERP modules.
  - *Assigned Users*: List of active staff accounts holding this role.
  - *Audit History*: Log of role creation and permission modifications.
- **Role Form**: Modal or page form to define custom roles and grant initial permissions.
