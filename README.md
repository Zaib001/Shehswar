# SHEHSWAR ONE360

### Enterprise ERP & CRM Platform Foundation

[![CI Pipeline](https://github.com/shehswar/shehswar-one360/actions/workflows/ci.yml/badge.svg)](https://github.com/shehswar/shehswar-one360/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](<>)

SHEHSWAR ONE360 is a commercial-grade, multi-company, API-first Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) platform designed for Shehswar Group and future commercial SaaS multi-tenancy.

---

## 🏛️ Architecture Overview

SHEHSWAR ONE360 is built as a **Modular Monolith** using **Turborepo** and **npm workspaces**:

- **Web Frontend (`apps/web`)**: Next.js 14+ (App Router), React 18, TypeScript, custom modern CSS design system tokens.
- **Backend API (`apps/api`)**: NestJS 10, TypeScript, OpenAPI / Swagger, AsyncLocalStorage correlation tracing.
- **Database (`packages/database`)**: PostgreSQL 16 managed via Prisma ORM with strict `DECIMAL(18, 4)` precision.
- **Shared Contracts (`packages/types`)**: Common DTOs, API envelopes, security contexts, and domain enums.
- **Shared Mathematics (`packages/shared`)**: Exact fixed-point `Money` and `Quantity` value objects.
- **Configuration (`packages/config`)**: Zod-validated environment configuration schema.
- **Structured Logging (`packages/logger`)**: Pino JSON logging with automated redaction of sensitive credentials.

---

## 🚀 Quick Start Guide

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose

### 1. Clone & Configure Environment

```bash
# Clone the repository
git clone https://github.com/shehswar/shehswar-one360.git
cd shehswar360

# Copy environment template
cp .env.example .env
```

### 2. Start Infrastructure Containers

Start local PostgreSQL 16, Redis 7, and MinIO S3 object storage:

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### 3. Install Monorepo Dependencies

```bash
npm install
```

### 4. Run Database Migrations & Seed

```bash
# Generate Prisma Client
npm run db:generate

# Execute Migrations
npm run db:migrate

# Seed baseline tenant, parent company, roles, permissions, and admin user
npm run db:seed
```

### 5. Launch Development Servers

```bash
npm run dev
```

- **Web ERP Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Swagger API Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **MinIO Storage Console**: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `miniopassword`)

---

## 🧪 Testing

```bash
# Run all unit and integration tests across workspaces
npm run test

# Run code formatting check
npm run format:check
```

---

## 📚 Architectural Documentation

All architectural specifications and decision records are maintained under `docs/architecture/`:

- **[System Overview](file:///d:/Shehswar360/docs/architecture/system-overview.md)** (System Context & Container Diagrams)
- **[Domain Boundaries](file:///d:/Shehswar360/docs/architecture/domain-boundaries.md)** (Module Architecture Diagram)
- **[Data Ownership](file:///d:/Shehswar360/docs/architecture/data-ownership.md)** (Hierarchy Diagram)
- **[API Standards](file:///d:/Shehswar360/docs/architecture/api-standards.md)** (Request Flow Diagram)
- **[Event Architecture](file:///d:/Shehswar360/docs/architecture/event-architecture.md)** (Outbox Relay Diagram)
- **[Background Jobs](file:///d:/Shehswar360/docs/architecture/background-jobs.md)** (Processing Flow Diagram)
- **[External Integrations](file:///d:/Shehswar360/docs/architecture/integrations.md)** (Future Integration Diagram)
- **[Module Development Lifecycle](file:///d:/Shehswar360/docs/architecture/module-development-lifecycle.md)** (17-Step Process)
- **[Architecture Decision Records (ADRs)](file:///d:/Shehswar360/docs/architecture/adr/)** (ADR-001 through ADR-020)
- **[Phase 1 Completion Report](file:///d:/Shehswar360/PHASE_1_COMPLETION_REPORT.md)** (Executive Summary & DoD Checklist)

---

## 🔒 Security & Data Isolation

- **Contextual Access Control**: `can(user, action, resource, context)`.
- **Sensitive Field Isolation**: Child companies are programmatically prohibited from viewing parent manufacturing costs and profit margins.
- **Immutable Auditing**: Append-only `audit_logs` tracking actor, entity, state diffs, and correlation IDs.
- **Zero Floating-Point Financials**: Strict `DECIMAL(18, 4)` and `Money` value objects prevent binary floating-point drift.
