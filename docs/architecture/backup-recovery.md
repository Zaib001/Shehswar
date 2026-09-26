# SHEHSWAR ONE360 — Disaster Recovery & Backup Architecture

## 1. Business Objectives (RPO & RTO Targets)

> [!IMPORTANT]
> **Status: PROPOSED** (Pending formal executive, infrastructure owner, and cloud budget ratification).
> These figures represent targeted architectural design parameters and are not marked ratified until signed off by the business owner.

- **Recovery Point Objective (RPO)**: **< 15 minutes** (PROPOSED target). Maximum allowable data loss in the event of catastrophic infrastructure failure.
- **Recovery Time Objective (RTO)**: **< 2 hours** (PROPOSED target). Maximum allowable downtime to restore full operational capability.

---

## 2. Backup Strategy & PITR Specification

### 1. PostgreSQL Continuous Archiving & Point-In-Time Recovery (PITR)

- **Daily Full Snapshot**: Automated physical/logical backup executed every 24 hours at 02:00 UTC and streamed to encrypted offsite object storage (S3/MinIO).
- **Continuous Write-Ahead Log (WAL) Archiving**: WAL segments shipped to immutable object storage every 5 minutes (`archive_command` / pgBackRest). Enables recovery to any specific microsecond within the retention window.
- **Retention Window**: 30 days of continuous PITR WAL archives; 12 monthly cold snapshots retained for compliance.

### 2. Object Storage Replication & Immutability

- **Versioning**: Enabled on all document storage buckets (`shehswar-documents`) to protect against accidental mass-deletion or ransomware tampering.
- **Cross-Region Replication (CRR)**: Primary S3 bucket replicated asynchronously to a secondary geographically isolated data center.

### 3. Encryption & Secrets

- All backup archives encrypted at rest using AES-256 with KMS customer-managed keys.

---

## 3. Step-by-Step Restoration Procedure Runbook

1. **Infrastructure Provisioning**:
   - Spin up target PostgreSQL instance matching production hardware and PostgreSQL 16 configuration.
2. **Base Snapshot Retrieval**:
   - Download the latest daily base backup archive from the secure backup S3 bucket.
   - Extract base backup into PostgreSQL `data` directory.
3. **WAL Replay Configuration**:
   - Configure `recovery.signal` and `restore_command`:
     ```text
     restore_command = 'aws s3 cp s3://shehswar-backup-vault/wal/%f %p'
     recovery_target_time = '2026-09-25 14:30:00 UTC'
     recovery_target_action = 'promote'
     ```
4. **Database Startup & Verification**:
   - Start PostgreSQL service. Engine automatically replays archived WAL logs up to the exact target recovery timestamp.
   - Run integrity checksum queries and schema verification.
5. **DNS & Application Re-pointing**:
   - Update `DATABASE_URL` in application runtime secret vaults.
   - Boot API services and verify `/health/ready` probe returns `HTTP 200 UP`.

---

## 4. Disaster Recovery Rehearsal & Verification Drill

- **Rule**: An untested backup is not verified disaster recovery.
- **Drill Protocol**: Every 30 days, an automated CI/CD pipeline downloads the latest database snapshot, boots an ephemeral PostgreSQL instance, runs all migrations, verifies row checksums, and publishes an audit report to the DevOps compliance dashboard.
