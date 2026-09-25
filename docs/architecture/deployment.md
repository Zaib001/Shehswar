# SHEHSWAR ONE360 — Deployment & DevOps Architecture

## 1. Containerization Standards

All services are packaged as lightweight, secure OCI-compliant Docker containers using Alpine Linux bases:

- **`infrastructure/docker/Dockerfile.api`**:
  - Multi-stage build with Turborepo docker pruning.
  - Drops root privileges; executes as `USER nestjs` (UID 1001).
  - Production image size < 180MB.
- **`infrastructure/docker/Dockerfile.web`**:
  - Multi-stage build producing a Next.js standalone runner.
  - Executes as `USER nextjs` (UID 1001).
  - Production image size < 150MB.

---

## 2. Environment Segregation

ONE360 isolates environments across four tiers:

1. **Local**: Developer machine using Docker Compose for PostgreSQL, Redis, and MinIO.
2. **Development**: Shared integration server running latest `develop` branch.
3. **Staging / UAT**: Exact replica of production for Quality Assurance, automated migration testing, and client sign-off.
4. **Production**: High-availability live business environment with clustered databases, read replicas, and SSL edge termination.

---

## 3. Database Migration Deployment Workflow

Production database migrations are never executed manually.

1. During deployment, the CD pipeline executes `prisma migrate deploy` from a one-off migration task container before traffic is routed to the new API instances.
2. Schema changes follow the **Expand and Contract pattern**:
   - Step 1 (Expand): Add new nullable column or table.
   - Step 2: Deploy new code that writes to both old and new columns.
   - Step 3: Run data migration script to backfill historical rows.
   - Step 4 (Contract): Remove old column in a subsequent release.
3. Zero-downtime deployments are achieved using rolling container updates behind an ingress reverse proxy.
