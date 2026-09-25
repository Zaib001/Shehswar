# SHEHSWAR ONE360 — Caching Architecture & Redis Invalidation

## 1. Principles of ERP Caching

In enterprise manufacturing and accounting, the **database is the sole source of truth**.

- **Rule 1**: Cache reads to accelerate authorization, reference data, and repetitive configuration lookups.
- **Rule 2**: NEVER cache operational transactional data (stock levels, batch availability, general ledger balances).
- **Rule 3**: All cache keys must be scoped with tenant/organization prefixes to prevent cross-tenant data leakage.

---

## 2. Permitted vs. Forbidden Cache Targets

### Permitted Cache Candidates (Allowed)

- **User Permissions**: Formatted permission sets (`user_perms:{userId}`) with 15-minute TTL.
- **Resolved System Settings**: Company/Branch settings hierarchy lookups with 10-minute TTL.
- **Static Master Data**: UOMs, currency exchange rates, tax withholding rates with 1-hour TTL.
- **Rate Limit Buckets**: Sliding window counters with 60-second TTL.

### Forbidden Cache Targets (Strictly Prohibited)

- **Batch Physical & Available Stock**: Reading cached stock leads to duplicate reservations and inventory overselling.
- **General Ledger Balances**: Financial ledgers must reflect verified committed database transactions.
- **Pending Approvals**: Must always query the database to reflect real-time approval transitions.
- **Document Sequences**: Sequential numbers must use atomic database increments, never cached counters.

---

## 3. Cache Key Naming Convention

```text
shehswar:{tenantId}:{companyId}:{domain}:{identifier}
```

Examples:

- `shehswar:org_123:comp_parent:settings:currency_code`
- `shehswar:org_123:user_perms:u_987654`

---

## 4. Invalidation Strategy

- **Time-to-Live (TTL)**: Every cache entry has an explicit maximum TTL to prevent permanent stale data in case of eviction failures.
- **Explicit Invalidation**:
  - Updating a user's roles or permissions immediately deletes `shehswar:org_*:user_perms:{userId}`.
  - Modifying a system setting deletes the corresponding `settings:*` key pattern.
