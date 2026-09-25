# ADR-001: Monorepo Repository Architecture

## Status

Accepted

## Context

Shehswar ONE360 is an enterprise ERP and CRM platform consisting of a Next.js web application, a NestJS backend API, shared types, validation schemas, database models, and future clients (React Native mobile application, Dealer Portal, external integrations). Maintaining multiple separate repositories creates dependency desynchronization, duplicate interfaces, and complex cross-repo deployment choreography.

## Problem

How should the codebase be structured to allow multiple frontend applications, backend services, shared packages, and developer tooling to evolve with strict type safety and atomic commits?

## Options Considered

1. **Polyrepo (Multiple Repositories)**: Separate Git repos for web, api, database, types.
   - _Pros_: Independent repository permissions and version tags.
   - _Cons_: High friction sharing code, API contract drift, complex CI/CD orchestration.
2. **Standard npm Workspaces + Turborepo Monorepo**: Single repository containing `apps/*` and `packages/*`.
   - _Pros_: Unified atomic versioning, shared contracts, fast cached builds, single pull request workflow.
   - _Cons_: Requires disciplined folder boundaries and dependency discipline.

## Decision

Adopt a **Turborepo monorepo with npm workspaces**.
Structure:

- `apps/web`: Next.js 14+ App Router frontend.
- `apps/api`: NestJS 10+ modular backend API.
- `packages/types`: Shared domain interfaces, enums, DTOs, and API envelopes.
- `packages/shared`: Shared mathematical precision value objects (Money, Quantity), Result monads, error codes.
- `packages/config`: Environment schema validation using Zod.
- `packages/logger`: Structured JSON Pino logger with correlation context.
- `packages/database`: Prisma schema, migrations, seeds, and database client.

## Reasoning

Turborepo provides remote caching, dependency graph task execution, and prevents building unchanged packages. Workspaces allow `apps/web` and `apps/api` to reference `@shehswar/types` and `@shehswar/shared` without private registry publishing.

## Trade-offs

Larger Git clone size; requires all developers to understand monorepo task pipelines.

## Consequences

- Every API change can be accompanied by updated types and frontend consumer updates in a single atomic Git commit.
- CI validates the entire dependency graph on each pull request.

## Future Considerations

Enables adding `apps/mobile` (React Native) and `apps/dealer-portal` seamlessly into the existing workspace.
