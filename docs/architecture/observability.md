# SHEHSWAR ONE360 — Observability & Telemetry Architecture

## 1. Observability Pillars

SHEHSWAR ONE360 establishes three foundational telemetry pillars:

1. **Structured JSON Logs**: Formatted with Pino for seamless ingestion into log aggregators (ELK, Datadog, Grafana Loki).
2. **Distributed Correlation Tracing**: Every inbound HTTP request or background job carries a unique `correlationId`.
3. **Container Health Probes**: Explicit liveness and readiness endpoints for Docker and Kubernetes orchestration.

---

## 2. Distributed Correlation Context

Using Node.js `AsyncLocalStorage` (`RequestContext` in `@shehswar/shared`), the request correlation ID is available globally across all async call stacks, database queries, and service logs without manual parameter passing:

```text
HTTP Request (Header: X-Correlation-ID)
  └── CorrelationMiddleware
        └── AsyncLocalStorage Store { correlationId, organizationId, companyId, actorId }
              ├── Pino Logger mixin (auto-injects correlationId in all log entries)
              ├── Database Transactions (attaches correlationId to audit_logs)
              └── Background Queue Jobs (enqueues correlationId in job payload)
```

---

## 3. Health & Liveness Probes

Exposed publicly without authentication under `/health`:

- **`GET /health/live`**:
  - Purpose: Liveness probe. Returns HTTP 200 `{ status: "UP", uptimeSeconds: 120 }`.
  - Tells the container orchestrator whether the Node.js event loop is alive.
- **`GET /health/ready`**:
  - Purpose: Readiness probe. Tests PostgreSQL connection (`SELECT 1`) and heap memory usage.
  - Returns HTTP 200 `{ status: "UP", checks: { database: "UP", memoryUsageMb: 85 } }`.
  - If PostgreSQL is unreachable, returns `{ status: "DEGRADED", checks: { database: "DOWN" } }` so the load balancer stops routing traffic to this instance.
