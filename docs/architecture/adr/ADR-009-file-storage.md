# ADR-009: File & Document Storage Abstraction

## Status

Accepted

## Context

Shehswar ONE360 will handle large volumes of documents: vendor quotation PDFs, goods receipt photos, lab quality test certificates, signed delivery challans, dealer agreement scans, and export spreadsheets. Storing binary BLOBs inside PostgreSQL bloats database backups, slows queries, and degrades performance.

## Problem

How should file uploads and downloads be managed to keep PostgreSQL lean while preventing tight vendor lock-in to AWS S3, Cloudflare R2, MinIO, or local disk storage?

## Options Considered

1. **Database Bytea / BLOB Storage**:
   - _Pros_: Stored in one place.
   - _Cons_: Severe database bloat, slow VACUUM, costly database backups.
2. **Direct Vendor Coupling (AWS S3 SDK hardcoded)**:
   - _Pros_: Standard implementation.
   - _Cons_: Impossible to run locally without internet or AWS account; prevents switching to Cloudflare R2 or MinIO.
3. **Storage Driver Interface with Presigned URLs**:
   - Database stores only metadata (`FileMetadata`).
   - Binary data is streamed directly to/from S3-compatible object storage via expiring presigned URLs.
   - Driver abstraction supports AWS S3, Cloudflare R2, MinIO, and Local File System.

## Decision

Adopt **Provider-Agnostic Storage Driver Pattern with Presigned URLs**:

1. **Metadata in PostgreSQL**:
   - `FileMetadata`: id, organizationId, companyId, provider, storageKey, bucket, originalFileName, mimeType, fileSizeBytes, sha256Hash, classification, entityType, entityId, uploadedById.
2. **Storage Drivers**:
   - Local Disk (for dev and offline testing)
   - MinIO (for local docker containerized testing)
   - S3 / Cloudflare R2 (for staging and production)
3. **Upload Flow**:
   Client requests presigned URL -> Server validates permissions & registers metadata -> Client uploads binary directly to storage -> Client confirms upload.
4. **Security & Signed URLs**:
   All downloads use short-lived (15 minutes) presigned URLs generated after verifying user permissions and data classification.

## Reasoning

Protects PostgreSQL database performance, enables unlimited scalable document storage, and allows seamless switching between on-premise MinIO and cloud object storage.

## Trade-offs

Requires a two-step upload handshake (request URL -> upload binary).

## Consequences

- Zero binary data stored in transactional PostgreSQL tables.
- Complete vendor independence.
