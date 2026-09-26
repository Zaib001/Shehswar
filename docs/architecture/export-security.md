# SHEHSWAR ONE360 — Export Security & Bulk Data Protection Architecture

## 1. Principles

1. **Frontend Filtering is NOT a Security Boundary**: Any user can manipulate frontend network calls to request unauthorized records or unmasked fields. Export security is enforced 100% on the server side.
2. **Identical RBAC & Tenant Scoping**: Every export request passes through the same `DataScopeGuard` and `AuthorizationService` pipeline as standard interactive API calls.
3. **Sensitive Field Stripping**: If a user lacks `costing:view_cost` or `costing:view_margin`, those columns are physically omitted from generated CSV, Excel, or PDF files.
4. **Audit Logging**: Every export operation generates an immutable `audit_logs` record containing the user ID, company context, filter parameters, export format, and row count.

---

## 2. Synchronous vs Asynchronous Export Execution

```mermaid
flowchart TD
    Req["User Requests Export (CSV / Excel / PDF)"] --> Check{"Dataset Size < 1,000 Rows?"}

    Check -->|Yes| Sync["Synchronous Generation (< 2s)<br/>Stream directly to HTTP Response"]
    Sync --> Audit["Record Security Audit Log"]

    Check -->|No (Large Export)| Async["Queue Job in BullMQ (reports queue)<br/>Return Job ID + 202 Accepted"]
    Async --> Worker["Background Worker Generates File<br/>Applies Scoping & Masking"]
    Worker --> Store["Upload to Private S3 Bucket<br/>Generate 15-Minute Presigned Download URL"]
    Store --> Notif["Send User In-App & Email Notification"]
    Notif --> Audit
```

---

## 3. Mandatory Export Security Checklist

- [x] Hard multi-tenant boundary: export query strictly binds `organization_id = user.organization_id`.
- [x] Company boundary: export query binds `company_id = user.company_id` unless user possesses `company:cross_company_view`.
- [x] PII & Banking: Employee CNIC, personal mobile numbers, and bank account details masked according to role.
- [x] Rate Limiting: Bulk exports capped at 5 requests per user per 10-minute window to prevent automated scraping.
- [x] File Retention: Exported files in temporary storage auto-expire after 24 hours.
