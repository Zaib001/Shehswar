# SHEHSWAR ONE360 — Multi-Tenancy & Multi-Company Architecture

## 1. Context & Business Hierarchy

SHEHSWAR ONE360 is designed from day one with a two-tier tenancy model:

1. **SaaS Multi-Tenancy (Platform Level)**: Allows separate enterprise customers (e.g. Shehswar Group, Future Customer B) to operate on the same software platform without cross-tenant data exposure.
2. **Multi-Company Operations (Organization Level)**: Allows Shehswar Group to operate multiple legal entities (Parent Manufacturing Company and multiple Child Distribution Companies) within a single organization, enabling intercompany transfers and consolidated group financials.

### Definitive Tenancy Boundary Definitions & Responsibilities

| Hierarchy Level | Entity Concept         | Responsibility & Scope                                                                        | In Shehswar Context                                                       | Security Boundary Role                                                                                          |
| :-------------- | :--------------------- | :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| **Level 1**     | **`PlatformTenant`**   | Commercial SaaS billing and subscription customer account.                                    | Customer subscription: `TENANT-SHEHSWAR`.                                 | Controls billing, license tiers, module entitlements.                                                           |
| **Level 2**     | **`Organization`**     | Top-level operational enterprise group and shared master directory.                           | Enterprise group: `ORG-SHEHSWAR-GRP` ("Shehswar Group of Companies").     | **TOP-LEVEL SECURITY ISOLATION BOUNDARY**. Appears as `organization_id` on all operational and business tables. |
| **Level 3**     | **`Company`**          | Individual legal operating entities with their own NTN/STRN tax ID, balance sheet, and books. | `COMP-PARENT` (Manufacturing) & `COMP-CHILD-DIST` (Trading/Distribution). | Intra-organization data isolation. Enforces costing, formula, and margin privacy between sister/child units.    |
| **Level 4**     | **`Plant` / `Branch`** | Physical operating factories, mills, or regional commercial sales offices.                    | `PLANT-MAIN` (Central Feed & Chemical Plant), Lahore Regional Branch.     | Physical inventory, machine-hour tracking, and local dispatch scoping.                                          |
| **Level 5**     | **`Warehouse`**        | Storage locations (Raw Material silos, Finished Goods warehouses).                            | `WH-PARENT-RM`, `WH-PARENT-FG`.                                           | Stock balance ledger and bin/lot location control.                                                              |

#### Answers to Architectural Tenancy Questions:

1. **What is a PlatformTenant?** The paying SaaS customer account.
2. **What is an Organization?** The operational enterprise boundary containing companies, users, roles, settings, and business transactions.
3. **Can one tenant own multiple organizations?** Yes. A large conglomerate can operate multiple separate Organizations if business divisions require fully independent user directories and document numbering.
4. **Is Shehswar Group the tenant or organization?** Shehswar Group is the `Organization` (`ORG-SHEHSWAR-GRP`), provisioned under its initial `PlatformTenant`.
5. **Which ID is the top-level security isolation boundary?** `organization_id`.
6. **Which ID appears on tenant-owned tables?** `organization_id` is the primary foreign key on all tenant-owned tables (`users`, `roles`, `audit_logs`, `domain_event_outbox`, `idempotency_records`, `document_sequences`, `sales_orders`, etc.). Query scoping strictly enforces `where: { organizationId }`.

---

## 2. Multi-Tenancy Strategy Comparison

| Dimension                        | Database-per-Tenant                             | Schema-per-Tenant                   | Shared Database / Discriminator (Selected)                     |
| :------------------------------- | :---------------------------------------------- | :---------------------------------- | :------------------------------------------------------------- |
| **Data Isolation**               | Physical database boundary                      | PostgreSQL Schema (`CREATE SCHEMA`) | Logical row-level discriminator (`tenantId`, `organizationId`) |
| **Operational Complexity**       | High (dozens of databases to patch and back up) | Medium (connection pool bloat)      | Low (single unified migration cycle)                           |
| **Intercompany Transfers**       | Distributed transactions (Saga / 2PC required)  | Cross-schema joins                  | **Native local ACID transaction support**                      |
| **Infrastructure Cost**          | High                                            | Medium                              | **Optimal / Cost-Effective**                                   |
| **Consolidated Group Reporting** | Complex federated queries                       | Complex multi-schema union          | **Direct indexed aggregation queries**                         |

---

## 3. Selected Approach: Shared Database with Strict Contextual Scoping

We selected the **Shared Database with Discriminator Scoping & Row-Level Security Ready** model:

1. **Hard Tenant Isolation**:
   - Every table containing tenant data includes `organization_id UUID NOT NULL REFERENCES organizations(id)`.
   - All Prisma queries generated by domain repositories automatically inject `where: { organizationId }` derived from the verified JWT payload.
2. **Company Boundary Enforcement**:
   - `companyId` is attached to transactional records.
   - `DataScopeGuard` inspects incoming route parameters and rejects cross-company attempts unless the actor holds `company:cross_company_view` or `isSuperAdmin: true`.
3. **Parent vs. Child Separation Guardrails**:
   - Parent manufacturing cost and margin fields are shielded behind `Action.VIEW_COST` and `Action.VIEW_MARGIN`.
   - Child company users are prohibited from reading sensitive parent manufacturing formulas or margins.

---

## 4. Future SaaS Migration Safety

When the platform transitions from hosting Shehswar Group to onboarding external commercial tenants:

- The `PlatformTenant` model already exists in the database schema.
- Feature flags (`FeatureFlagOverride`) allow enabling/disabling modules on an organization or company level.
- Storage paths are organized as `org_{organizationId}/company_{companyId}/...` guaranteeing object storage isolation.
- No schema alteration is needed to onboard Tenant 2, Tenant 3, etc.
