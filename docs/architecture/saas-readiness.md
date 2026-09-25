# SHEHSWAR ONE360 — Future SaaS Multi-Tenancy Readiness

## 1. Commercial Product Strategy

While **Shehswar Group** is the inaugural enterprise deployment, ONE360 is built as a commercial-grade platform capable of serving external SaaS tenants in future versions without architectural rewriting.

---

## 2. Multi-Tenant Architectural Guardrails Established in Phase 1

1. **Platform Tenant Hierarchy**:
   - `PlatformTenant` is the root relational entity.
   - `Organization` represents an enterprise customer account.
   - All shared tables index `organizationId` as a foreign key discriminator.
2. **Context-Aware Feature Flags**:
   - `FeatureFlagService` supports activating modules globally or per organization/company via `feature_flag_overrides`.
   - Allows enabling advanced modules (e.g. MRP, Lab QC, AI Forecasting) for specific commercial plans.
3. **Tenant-Scoped Object Storage**:
   - Storage keys follow `org_{orgId}/...` so files from different tenants never collide in shared object storage buckets.
4. **Tenant-Aware Cache Keys**:
   - Redis keys prefix all entries with `{tenantId}` to prevent cache collisions across organizations.
5. **Subscription & Billing Readiness**:
   - The user model and tenant model contain clean integration points for future subscription tiers (Starter, Professional, Enterprise) and seat-based licensing.
