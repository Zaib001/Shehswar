# Audit Trail Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, the `AuditService` captures an append-only, tamper-evident log of all sensitive state transitions, entity modifications, security events, and approval actions across the platform.

### Standard Audit Format
```
[Timestamp] [Actor Name] ([Actor Role]) 
Changed [Entity] Status: [Active] → [Suspended] 
Reason / Context: Compliance annual review
IP: 192.168.1.45 | Company: Shehswar Chemicals Ltd
```

---

## 2. Entity Schema & Standards

The `AuditLog` table follows Phase 1 architectural standards for append-only forensic compliance.

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `tenantId` | `VARCHAR(36)` | `NOT NULL` | Tenant boundary identifier |
| `userId` | `VARCHAR(36)` | `NULLABLE` | Initiating actor user ID |
| `companyId` | `VARCHAR(36)` | `NULLABLE` | Subsidiary context of the action |
| `action` | `VARCHAR(50)` | `NOT NULL` | Event verb (`CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `LOGIN`) |
| `entityName` | `VARCHAR(100)` | `NOT NULL` | Target resource (`Company`, `Plant`, `User`, `Role`, `Sequence`) |
| `entityId` | `VARCHAR(36)` | `NOT NULL` | Unique ID of the affected record |
| `oldValue` | `JSONB` | `NULLABLE` | Snapshot of record before modification |
| `newValue` | `JSONB` | `NULLABLE` | Snapshot of record after modification |
| `ipAddress` | `VARCHAR(45)` | `NULLABLE` | Client IPv4 or IPv6 address |
| `userAgent` | `VARCHAR(500)` | `NULLABLE` | Browser / device client header |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Immutable event timestamp |

---

## 3. Automatic Master Data Auditing

The `MasterDataService` automatically records audit entries on every mutation method (`createCompany`, `updateCompany`, `deleteCompany`, `updateUserStatus`, etc.) via `AuditService.record()`.

```typescript
await this.auditService.record({
  tenantId: org.tenantId,
  userId: actorId,
  companyId,
  action: 'STATUS_CHANGE',
  entityName: 'Company',
  entityId: company.id,
  oldValue: { status: 'ACTIVE' },
  newValue: { status: 'SUSPENDED' },
});
```

---

## 4. UI Architecture & Features

- **Timeline Presentation**: Utilizes the Phase 2 `Timeline` component to present chronological events with initials avatars, color-coded action badges, and structured state diffs (`oldValue → newValue`).
- **Multi-Factor Filtering**: Filter audit trails by:
  - Actor (User name or email)
  - Action type (`CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `SECURITY`)
  - Target resource (`Company`, `Plant`, `Warehouse`, `User`, `Role`)
- **Forensic Export**: One-click download of audit event records formatted for ISO/statutory inspection.
