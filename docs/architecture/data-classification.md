# SHEHSWAR ONE360 — Data Classification & Information Security Policy

## 1. Classification Levels

All information assets, database columns, documents, and API payloads within Shehswar ONE360 are categorized into four explicit classification tiers:

| Tier       | Classification       | Description & Examples                                                                                                                                                                  | Access Boundary                                                                                    | Logging & Storage Rules                                                                                      |
| :--------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Tier 1** | **Public**           | Marketing product catalogs, public branch addresses, general marketing brochures.                                                                                                       | Anonymous / Public Internet.                                                                       | Standard logging permitted; CDN caching enabled.                                                             |
| **Tier 2** | **Internal**         | Standard operational data: Sales Orders, Goods Receipts, Stock Balances, Warehouse locations, General vendor names.                                                                     | Authenticated users within the assigned Organization & Company.                                    | Standard correlation logging; encrypted at rest (AES-256).                                                   |
| **Tier 3** | **Confidential**     | Commercial contract pricing, dealer credit limits, customer financial statements, tax filings, HR employee performance records.                                                         | Authenticated users with explicit RBAC permission grants.                                          | PII masked in application logs; strict export audits.                                                        |
| **Tier 4** | **Highly Sensitive** | Proprietary feed manufacturing formulas / chemical recipes, raw-material purchase costs per KG, parent company profit margins, executive payroll, system master secrets / private keys. | Explicit elevated clearance (Super Admin / Plant Head / CFO). Child company users strictly denied. | **NEVER logged in plain text**. Field-level masking in UI and export files. Immutable audit trail on access. |

---

## 2. Highly Sensitive Domain Rules

### Proprietary Manufacturing Recipes (BOM / Formulas)

- **Classification**: `HIGHLY SENSITIVE`.
- **Constraint**: Child distribution company users (e.g. `COMP-CHILD-DIST`) can NEVER query or inspect the constituent raw-material recipe percentages of parent manufacturing formulas.
- **Enforcement**:
  - Service layer assertion: `AuthorizationService.can(...)` validates `Resource.FORMULA_BOM`.
  - Database scoping: formula queries filter strictly by `companyId: user.companyId`.

### Parent Manufacturing Cost & Margin

- **Classification**: `HIGHLY SENSITIVE`.
- **Constraint**: Wholesale dealers and child trading companies buy at transfer prices or finished price list values. They must not see parent procurement cost or gross manufacturing margins.
- **Enforcement**:
  - Permissions `costing:view_cost` and `costing:view_margin` are isolated from child roles.
  - API responses strip cost fields when accessed by non-parent context.

### Authentication Secrets & Credentials

- **Classification**: `HIGHLY SENSITIVE`.
- **Constraint**: Passwords, refresh tokens, and webhook secrets are cryptographically salted and hashed (Bcrypt / Argon2id). Never stored or transmitted in plain text.
