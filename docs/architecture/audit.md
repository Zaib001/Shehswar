# SHEHSWAR ONE360 — Immutable Audit Logging Architecture

## 1. Compliance & Security Imperative

For an industrial group operating large manufacturing facilities and multi-million-rupee credit lines, auditability is non-negotiable.
ONE360 provides an **immutable, append-only audit trail** for:

- Who initiated the action (`actorId`, `actorEmail`, `ipAddress`, `userAgent`).
- Which legal entity was affected (`organizationId`, `companyId`).
- What changed (`resource`, `resourceId`, `action`).
- Before and after state snapshots (`previousState`, `newState`, `changedFields`).
- End-to-end request tracing (`correlationId`).

---

## 2. Audit Table Schema Standards (`audit_logs`)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    company_id UUID,
    actor_id UUID NOT NULL,
    actor_email VARCHAR(255),
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    changed_fields VARCHAR(100)[],
    correlation_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Optimized Covering Indexes for Compliance Lookups
CREATE INDEX idx_audit_org_created ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_resource_id ON audit_logs (resource, resource_id);
CREATE INDEX idx_audit_actor_created ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_correlation_id ON audit_logs (correlation_id);
```

---

## 3. Mandatory Audit Trigger Points

1. **Financial & Cost Mutations**:
   - Product manufacturing cost calculations or manual cost adjustments.
   - Profit markup changes and price list updates.
   - Credit limit alterations or credit override approvals.
2. **Manufacturing & Quality Mutations**:
   - Production formula / BOM revisions and final approvals.
   - QC test parameter overrides or batch release decisions.
   - Emergency batch recall orders.
3. **Security & Governance Mutations**:
   - User creation, role assignment, and permission modifications.
   - Account lockouts and manual password resets.
   - Viewing of highly sensitive confidential data (e.g. `view_cost`, `view_margin`).

---

## 4. Immutability Enforcements

- Application level: `AuditService` exposes only a `record()` method; no update or delete methods exist.
- Database level: Production PostgreSQL roles grant only `INSERT` and `SELECT` on `audit_logs`. `UPDATE` and `DELETE` privileges are strictly revoked.
