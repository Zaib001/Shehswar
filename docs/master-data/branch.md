# Branch Management Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, a `Branch` represents a commercial sales office, regional trading center, or administrative liaison office operated by an enterprise subsidiary. While *Plants* house physical manufacturing equipment, *Branches* anchor dealer relationships, regional dispatch requests, and commercial operations.

```
Shehswar Agro-Tech Ltd (Subsidiary Distribution)
  ├── Branch North: Rawalpindi / Islamabad Sales Hub
  ├── Branch Central: Multan Cotton Belt Regional Depot
  └── Branch South: Sukkur / Sindh Commercial Office
```

---

## 2. Entity Schema & Standards

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `organizationId` | `VARCHAR(36)` | `NOT NULL, FK` | Enterprise holding scope |
| `companyId` | `VARCHAR(36)` | `NOT NULL, FK` | Operating subsidiary reference |
| `code` | `VARCHAR(50)` | `NOT NULL` | Branch code (e.g. `BR-MULTAN`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Regional branch title |
| `region` | `VARCHAR(100)` | `NOT NULL` | Geographic territory (e.g. `Punjab South`, `Sindh`) |
| `managerName` | `VARCHAR(255)` | `NULLABLE` | Regional Commercial Director / Branch Head |
| `email` | `VARCHAR(255)` | `NULLABLE` | Branch office contact email |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Branch switchboard telephone |
| `address` | `TEXT` | `NULLABLE` | Physical commercial office address |
| `isActive` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Active branch status |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | `NOT NULL` | Last modified timestamp |

---

## 3. Future Operational Touchpoints

- **Sales & Distribution (SD)**: Regional sales quotas, dealer order bookings, and sales rep territorial allocations will anchor to the branch.
- **Hierarchical Settings**: Branch-level configuration overrides allow regional branches to set custom invoice print formats, delivery slip templates, and local tax schedules.

---

## 4. UI Architecture & Features

- **Branch List**: Built with `ListPageTemplate`. Supports region filtering, company filtering, and instant search.
- **Branch Detail**: Displays territorial coverage, active personnel, branch performance overview, and audit log.
- **Branch Form**: Modal/Drawer or dedicated `FormPageTemplate` with input validation, regional selection, and status assignment.
