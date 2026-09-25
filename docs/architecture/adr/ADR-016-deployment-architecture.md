# ADR-016: Deployment & Containerization Architecture

## Status

Accepted

## Context

Shehswar ONE360 must be reliably deployable on local developer workstations, staging QA servers, on-premise Linux servers, and cloud container environments (AWS ECS / EKS / DigitalOcean). Environment discrepancies between "works on my machine" and production cause deployment failures.

## Problem

How should application components and dependencies be packaged, configured, and orchestrated across environments?

## Options Considered

1. **Direct VM Deployment (PM2 + Bare Metal)**:
   - _Pros_: Simple on single server.
   - _Cons_: Difficult to reproduce, host dependency conflicts (Node version differences).
2. **Standard Docker Containers + Docker Compose**:
   - Multi-stage OCI containers with minimal Alpine base images, non-root execution, and 12-Factor environment configuration.

## Decision

Adopt **Docker Multi-Stage Containerization with Docker Compose**:

1. **Multi-Stage Builds**:
   - `Dockerfile.api`: Turborepo pruned build -> production runner with non-root `nestjs` user on Alpine.
   - `Dockerfile.web`: Turborepo pruned Next.js standalone server with non-root `nextjs` user.
2. **Local Infrastructure (`docker-compose.yml`)**:
   - PostgreSQL 16 (port 5432) with health check.
   - Redis 7 (port 6379) with health check.
   - MinIO S3 Object Storage (ports 9000 & 9001) with bucket auto-provisioning.
3. **12-Factor Configuration**:
   - Zero hardcoded environment configs in images. Configured exclusively via validated environment variables (`@shehswar/config`).

## Reasoning

Guarantees identical behavior between developer workstations and staging/production clusters while keeping container image sizes small (< 200MB).

## Trade-offs

Developers must have Docker installed for full local containerized testing.

## Consequences

- Fast CI builds and deterministic deployments.
- Ready for future Kubernetes or container cloud migration.
