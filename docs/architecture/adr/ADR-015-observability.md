# ADR-015: Observability, Correlation IDs & Health Probes

## Status

Accepted

## Context

In an ERP handling high concurrent business transactions, diagnosing a failure (e.g. why did an intercompany dispatch fail at 3:15 PM?) requires tracing the request across the web app, backend controllers, database transactions, background workers, and external integration logs.

## Problem

How should application telemetry, structured logging, distributed request tracing, and liveness/readiness health probes be implemented?

## Options Considered

1. **Unstructured `console.log()`**:
   - _Pros_: Zero setup.
   - _Cons_: Cannot be ingested cleanly by log aggregators (Elasticsearch / Grafana Loki / CloudWatch), no context, no correlation IDs.
2. **Pino Structured Logging + AsyncLocalStorage Correlation Context + Standard Health Probes**:
   - High-performance JSON logger, automated correlation ID injection, sanitized secrets, `/health/live` and `/health/ready` endpoints.

## Decision

Adopt **Pino Structured Logging with AsyncLocalStorage Correlation Context**:

1. **Pino Logger (`@shehswar/logger`)**:
   - Emits structured JSON in staging/production, pretty-printed in local development.
   - Automatically redacts sensitive fields: `password`, `token`, `secret`, `authorization`, `creditCard`, `apiKey`.
2. **Correlation ID & Context Store (`RequestContext`)**:
   - Uses Node.js `AsyncLocalStorage` initialized in `CorrelationMiddleware`.
   - Propagates `correlationId`, `organizationId`, `companyId`, and `actorId` into every log entry without manual parameter passing.
3. **Health Check Probes (`/health`)**:
   - `/health/live`: Liveness probe for Docker/Kubernetes container health.
   - `/health/ready`: Readiness probe verifying PostgreSQL connection and memory availability.
   - Avoids exposing internal passwords or detailed connection strings publicly.

## Reasoning

Allows full distributed traceability and enables seamless integration with ELK, Datadog, Prometheus, and Grafana.

## Trade-offs

Small CPU overhead for AsyncLocalStorage context switching (typically < 1%).

## Consequences

- Fast incident resolution and operational visibility.
- Reliable Kubernetes/Docker container lifecycle orchestration.
