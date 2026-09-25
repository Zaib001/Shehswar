# SHEHSWAR ONE360 — Disaster Recovery & Backup Architecture

## 1. Business Objectives (RPO & RTO)

- **Recovery Point Objective (RPO)**: **< 15 minutes**. Maximum allowable data loss in the event of catastrophic infrastructure failure.
- **Recovery Time Objective (RTO)**: **< 2 hours**. Maximum allowable downtime to restore full operational capability.

---

## 2. Backup Strategy

1. **PostgreSQL Continuous Archiving & Point-In-Time Recovery (PITR)**:
   - Automated full daily database snapshots stored in an offsite S3 bucket.
   - Continuous Write-Ahead Log (WAL) archiving to S3 every 5 minutes, allowing rollback or recovery to any specific second within the last 30 days.
2. **Object Storage Replication**:
   - Primary S3/MinIO bucket configured with cross-region replication (CRR) to a secondary geographically isolated data center.
   - Versioning enabled on buckets to protect against accidental mass-deletion or ransomware corruption.
3. **Configuration & Encryption Keys**:
   - Environment templates and encryption secrets backed up in secure enterprise key vaults (e.g. AWS KMS / HashiCorp Vault).

---

## 3. Mandatory Restore Testing Protocol

- A backup that has never been restored is an illusion.
- Every month, an automated CI/CD pipeline downloads the latest database snapshot, boots an ephemeral PostgreSQL instance, runs all migrations, verifies data integrity, and generates a test restoration audit report.
