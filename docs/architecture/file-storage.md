# SHEHSWAR ONE360 — File & Document Storage Architecture

## 1. Storage Abstraction Architecture

SHEHSWAR ONE360 strictly decouples document metadata from binary BLOB storage:

1. **PostgreSQL** stores structured document records in the `file_metadata` table.
2. **Object Storage (S3 / Cloudflare R2 / MinIO / Local Disk)** stores the physical binary files.

```mermaid
graph TD
    Client["Client (Browser / Mobile)"]
    API["NestJS Storage API"]
    DB[("PostgreSQL file_metadata")]
    StorageDriver["StorageDriver Interface"]
    S3[("S3 / Cloudflare R2 / MinIO")]

    Client -->|1. Request Presigned Upload URL| API
    API -->|2. Register Metadata in DB| DB
    API -->|3. Generate Signed PUT URL| StorageDriver
    StorageDriver -->|Provider Driver| S3
    API -->>|4. Return Upload URL + File ID| Client

    Client -->|5. Binary Upload Direct to S3| S3
    Client -->|6. Confirm Upload Success| API
    API -->|7. Mark Ready / Verified| DB
```

---

## 2. File Metadata Schema Standards

Every stored document is tracked with:

- `id` (UUID): Unique file identifier.
- `organizationId`, `companyId`: Ownership scoping.
- `provider`: S3, R2, MINIO, or LOCAL.
- `storageKey`: Physical object key path (`org_{orgId}/{companyId}/{uuid}-{filename}`).
- `bucket`: Target bucket name.
- `originalFileName`, `mimeType`, `fileSizeBytes`: File specifications.
- `sha256Hash`: Cryptographic checksum for integrity verification.
- `classification`: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, or `HIGHLY_SENSITIVE`.
- `entityType`, `entityId`: Relational link (e.g. `purchase_order`, `po-uuid-123`).
- `uploadedById`: Actor who initiated the upload.

---

## 3. Presigned Expiring URLs & Security

- Direct binary downloads and uploads never proxy large streams through the NestJS Node.js event loop.
- Client uploads use presigned HTTP PUT URLs valid for 15 minutes.
- Client downloads use presigned HTTP GET URLs valid for 15 minutes.
- Before issuing a download URL, `StorageService` verifies the requesting user's authorization and data classification clearance.
