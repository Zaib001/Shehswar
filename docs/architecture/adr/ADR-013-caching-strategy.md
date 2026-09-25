# ADR-013: Caching Strategy & Redis Key Isolation

## Status

Accepted

## Context

In an ERP, caching operational transactional data (such as available batch stock or general ledger balances) blindly leads to stale reads, double allocations, and balance mismatches. However, repeatedly querying reference data, user permissions, system settings, and tax configurations creates unnecessary database load.

## Problem

What should be cached, what must NEVER be cached, and how should cache keys and invalidation be structured to guarantee tenant isolation and freshness?

## Options Considered

1. **Aggressive Cache-Everything Pattern**:
   - Cache entity queries including stock balances.
   - _Risk_: Catastrophic inventory overselling when two users read cached stock simultaneously.
2. **No Caching (Database Only)**:
   - _Pros_: Always fresh.
   - _Cons_: Database saturated by repeated lookups for user permissions, system settings, and static master data.
3. **Selective Caching with Tenant Prefixes and Explicit Invalidation**:
   - Cache only reference/permission data with bounded TTLs and deterministic keys.

## Decision

Adopt **Selective Reference Data Caching with Explicit Invalidation**:

1. **Cache Candidates (Allowed)**:
   - User permissions and active session validity (`user_perms:{userId}`).
   - Resolved system settings and feature flags (`setting:{orgId}:{key}`).
   - Static master data (units of measure, countries, tax rates).
   - Rate limiting counters.
2. **Strictly Forbidden from Caching**:
   - Batch stock levels and available inventory.
   - General ledger balances and financial transactions.
   - Pending approval request queues.
3. **Key Naming Convention**:
   `{app}:{tenantId}:{companyId}:{domain}:{identifier}`
   Example: `shehswar:org_123:comp_parent:settings:currency_code`
4. **TTL Policies**:
   - Default TTL: 300 seconds (5 minutes).
   - Rate limit counters: 60 seconds.
5. **Invalidation**:
   - Explicit eviction on mutation (e.g. updating a role evicts all cached permissions for users in that role).

## Reasoning

Maintains high throughput for API authorization while preserving the PostgreSQL database as the single infallible source of truth for transactional data.

## Trade-offs

Developers must write invalidation triggers when reference data is edited.

## Consequences

- Fast response times (< 15ms) for authz checks.
- Zero risk of financial or stock inconsistencies due to stale cache.
