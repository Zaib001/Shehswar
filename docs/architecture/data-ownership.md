# SHEHSWAR ONE360 — Data Ownership & Hierarchy Architecture

## 1. Ownership Principles

To ensure seamless multi-company operations, reliable intercompany transfers, and clean future SaaS scalability:

1. Every business record belongs to an **Organization** (tenant boundary).
2. Every transactional record belongs to a specific **Company** (legal operating entity).
3. Operational records (such as stock balances and physical movements) are further scoped to the **lowest meaningful operational node**: Plant, Branch, or Warehouse.
4. Commercial records (such as dealers, visits, and sales targets) are scoped through the commercial sales hierarchy: Region -> Zone -> Territory.

---

## 2. Data Ownership Hierarchy Diagram

```mermaid
graph TD
    Platform["Platform Tenant (SaaS Multi-Tenancy Boundary)"]
    Org["Organization (Shehswar Group)"]

    ParentCo["Shehswar Parent Manufacturing Co"]
    ChildCo1["Shehswar Child Distribution Co 1"]
    ChildCo2["Shehswar Child Commercial Co 2"]

    Plant["Central Manufacturing Plant"]
    Branch1["Lahore Regional Branch"]
    Branch2["Multan Regional Branch"]

    DeptQC["QC Lab Department"]
    DeptProd["Production Department"]
    DeptProc["Procurement Department"]

    WH_RM["Raw Material Warehouse (Silos)"]
    WH_FG["Finished Goods Warehouse"]
    WH_Depot["Regional Depot Warehouse"]

    Region["Punjab Region"]
    Zone["North Punjab Zone"]
    Territory["Gujranwala Territory"]

    User["User / Employee / Sales Rep"]

    Platform --> Org
    Org --> ParentCo
    Org --> ChildCo1
    Org --> ChildCo2

    ParentCo --> Plant
    ParentCo --> DeptQC
    ParentCo --> DeptProd
    ParentCo --> DeptProc

    Plant --> WH_RM
    Plant --> WH_FG

    ChildCo1 --> Branch1
    ChildCo1 --> Branch2
    Branch1 --> WH_Depot

    ChildCo1 --> Region
    Region --> Zone
    Zone --> Territory

    Territory --> User
    Plant --> User
```

---

## 3. Data Scoping Rules by Entity Type

| Entity Category                | Attached Scoping Foreign Keys                                           | Access & Isolation Rule                                                                                                       |
| :----------------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **System Settings**            | `scope`, `scopeId` (Organization, Company, or Branch)                   | Cascading resolution: Branch overrides Company, Company overrides Organization, Organization overrides Platform default.      |
| **User & Role**                | `organizationId`, `companyId` (primary), optional `plantId`, `branchId` | Users log into their assigned company context. Super Admin can switch active company context.                                 |
| **Raw Materials & BOM**        | `organizationId`, `companyId` (Parent Co)                               | Strictly owned by Parent Company. Child companies cannot query formula ingredients or BOM percentages.                        |
| **Batch Stock**                | `organizationId`, `companyId`, `plantId`, `warehouseId`                 | Owned by the operating company of the warehouse. Child company cannot see or allocate parent silo inventory directly.         |
| **Sales Orders & Receivables** | `organizationId`, `companyId`, `territoryId`                            | Owned by the selling company (Child Co). Visibility restricted to agents assigned to the territory or company sales managers. |
| **Intercompany Order**         | `organizationId`, `parentCompanyId`, `childCompanyId`                   | Dual-visibility record linking parent sales order to child purchase order with an atomic linked reference.                    |
| **Audit Logs**                 | `organizationId`, `companyId`, `actorId`, `correlationId`               | Immutable security log. Company managers view their company logs; Group Auditors view group-wide logs.                        |
