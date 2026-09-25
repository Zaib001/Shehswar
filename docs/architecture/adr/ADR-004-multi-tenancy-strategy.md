# ADR-004: Multi-Tenancy & Multi-Company Isolation Strategy

## Status

Accepted

## Context

Shehswar Group consists of a parent manufacturing company, multiple distribution and commercial child companies, processing plants, branches, departments, and warehouses. Furthermore, Shehswar ONE360 is built as a commercial enterprise product that will eventually host external SaaS tenants.

## Problem

How should tenant and company boundaries be enforced to guarantee that:

1. Data cannot leak between separate SaaS tenants.
2. Inside Shehswar Group, child company staff cannot view parent confidential data (manufacturing costing, margins, secret formulas) or sister companies' transactions.
3. Authorized group management can generate consolidated financial and operational reports.

## Options Considered

1. **Database-Per-Tenant**: Separate physical PostgreSQL database per tenant/company.
   - _Pros_: Maximum physical isolation.
   - _Cons_: High hosting costs, difficult consolidated reporting across group companies, migration schema synchronization overhead.
2. **Schema-Per-Tenant**: Separate PostgreSQL schema (`CREATE SCHEMA tenant_x`).
   - _Pros_: Schema isolation.
   - _Cons_: High connection pool overhead, complex cross-company joins for intercompany reconciliation.
3. **Shared Database with Discriminator Scoping & Row-Level Security (RLS) Ready**:
   - _Pros_: Cost-effective, seamless intercompany transfers, simple unified migrations, robust indexing.
   - _Cons_: Requires rigorous software and database scoping guards.

## Decision

Adopt a **Hierarchical Discriminator Model with Contextual Data Scoping**:
Hierarchy:

```text
PlatformTenant
  └── Organization (e.g. Shehswar Group)
        └── Company (e.g. Parent Manufacturing Co, Child Co 1, Child Co 2)
              ├── Plant
              │     └── Warehouse (RM, FG)
              ├── Branch
              │     └── Warehouse (Local Depots)
              ├── Department
              └── Region -> Zone -> Territory
```

Rules:

1. `tenantId` and `organizationId` provide hard SaaS tenant isolation.
2. `companyId` is applied to every business transaction (PO, GRN, Sales Order, Invoice, Batch).
3. The lowest meaningful ownership boundary is attached to records.
4. `DataScopeGuard` and `AuthorizationService.can(...)` validate that the user's company matches the record company, unless the user holds explicit group-level permissions (`company:cross_company_view`).
5. Child company users are blocked from querying parent manufacturing costs and margins even within the same organization.

## Reasoning

Allows atomic intercompany transfers in one transaction while strictly partitioning data access between operating companies.

## Trade-offs

Developers must ensure `companyId` and `organizationId` are included in query where-clauses.

## Consequences

- Guaranteed data isolation between parent and child companies.
- Fully compatible with future multi-tenant SaaS onboarding.
