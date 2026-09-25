# SHEHSWAR ONE360 — Scalability & Performance Architecture

## 1. Stateless API Tier

- The NestJS API process is completely stateless. No session state or temporary files are stored on local container disk.
- Session tokens are verified cryptographically via JWT and validated against Redis/PostgreSQL.
- Any API container can serve any incoming request.
- Horizontal auto-scaling (e.g. 2 to 20 instances) can be deployed behind a standard cloud load balancer without sticky sessions.

---

## 2. Database Connection Pooling & Performance

1. **Connection Pooling**:
   - Connection pools are tuned via `DATABASE_POOL_MIN` and `DATABASE_POOL_MAX`.
   - In production, PGBouncer is positioned in front of PostgreSQL in transaction-pooling mode to support thousands of concurrent client connections with minimal database memory consumption.
2. **Covering Indexes**:
   - Composite indexes are placed on foreign key pairs and tenant discriminators (e.g. `idx_companies_org_code`, `idx_audit_org_created`).
3. **Unbounded Query Prevention**:
   - Every operational query enforces default pagination limits (max 100 items per page).

---

## 3. Concurrency & Race-Condition Defenses

In manufacturing and sales operations, simultaneous requests can attempt to claim the same inventory or post duplicate numbers:

1. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**: Used during inventory batch reservation to prevent two users from consuming the same batch quantity simultaneously.
2. **Optimistic Concurrency Control (`version` column)**: Entity updates verify that the record's version has not changed before committing: `UPDATE items SET quantity = new_qty, version = version + 1 WHERE id = item_id AND version = current_version`.
3. **Database Unique Constraints**: Used for document numbering and session hashes to ensure the database enforces uniqueness even under extreme concurrent load.
