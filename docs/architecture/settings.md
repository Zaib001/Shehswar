# SHEHSWAR ONE360 — Hierarchical Settings & Configuration Architecture

## 1. Cascading Configuration Principle

Hardcoding business configurations (e.g. default currency, tax withholding rates, approval thresholds, fiscal year start) in source code creates rigid, unmaintainable software.
ONE360 implements **Cascading Configuration Inheritance**:

```text
┌────────────────────────────────────────────────────────┐
│                   Platform Default                     │
│         (System baseline, e.g. currency: PKR)          │
└──────────────────────────┬─────────────────────────────┘
                           │ Fallback
┌──────────────────────────▼─────────────────────────────┐
│                 Organization Override                  │
│       (Shehswar Group global rules, e.g. tax: 18%)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Fallback
┌──────────────────────────▼─────────────────────────────┐
│                   Company Override                     │
│        (Child Co 1 specific terms, e.g. credit: 30d)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Fallback
┌──────────────────────────▼─────────────────────────────┐
│                   Branch Override                      │
│        (Local Depot rules, e.g. local toll tax)        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Configuration Resolution Order

When any domain service calls `SettingsService.get('invoice.payment_terms_days', context)`:

1. It queries `system_settings` for a **Branch** record (`scope = 'BRANCH'`, `scopeId = branchId`).
2. If none exists, it queries for a **Company** record (`scope = 'COMPANY'`, `scopeId = companyId`).
3. If none exists, it queries for an **Organization** record (`scope = 'ORGANIZATION'`, `scopeId = organizationId`).
4. If none exists, it queries for a **Platform** record (`scope = 'PLATFORM'`).
5. If none exists, it returns the programmatic code default.

---

## 3. Schema Foundation (`system_settings`)

- `id` (UUID)
- `scope`: `PLATFORM`, `ORGANIZATION`, `COMPANY`, `BRANCH`, `USER`
- `scopeId` (UUID, nullable)
- `key` (VARCHAR): e.g. `pricing.max_discount_percentage`, `finance.fiscal_year_start_month`
- `value` (JSONB): Structured value (number, string, or boolean object)
- `isEncrypted` (BOOLEAN): For API keys or secret credentials
- Unique index: `(scope, key, scopeId)`
