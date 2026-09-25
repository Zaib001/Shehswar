# SHEHSWAR ONE360 — Background Jobs & Worker Architecture

## 1. Background Worker Principles

Heavy computations, file generation, and third-party integrations must never block the main HTTP request loop.
We utilize **BullMQ** running on **Redis 7**.

---

## 2. Background Processing Flow Diagram

```mermaid
graph TD
    subgraph HTTP Application Layer
        Client["Web / Mobile User"]
        API["NestJS API Controller"]
    end

    subgraph Redis Queue Engine
        QueueNotifications[("Queue: notifications")]
        QueueFileProcessing[("Queue: file-processing")]
        QueueReports[("Queue: reports")]
        QueueIntegrations[("Queue: integrations")]
        DLQ[("Dead Letter Queue (Failed Jobs)")]
    end

    subgraph Asynchronous Worker Process
        Worker["BullMQ Worker Process"]
        RetryManager["Exponential Backoff Retry Manager"]
    end

    subgraph Target Destinations
        Postgres[("PostgreSQL Database")]
        S3[("Object Storage (S3 / R2)")]
        ExternalAPIs["Third-Party Gateways<br/>(WhatsApp, FBR, SMS, Email)"]
        Alerts["Monitoring & Pager Alerts"]
    end

    Client -->|Upload Excel Import / Request Report| API
    API -->|Enqueue Job with correlationId| QueueFileProcessing
    API -->>|202 Accepted { jobId }| Client

    QueueFileProcessing --> Worker
    QueueNotifications --> Worker
    QueueReports --> Worker
    QueueIntegrations --> Worker

    Worker -->|Process Chunks| Postgres
    Worker -->|Upload Generated PDF / Excel| S3
    Worker -->|Dispatch Messages / E-Invoices| ExternalAPIs

    Worker -.->|On Failure (Attempts < Max)| RetryManager
    RetryManager -.->|Re-enqueue with Backoff| QueueNotifications

    Worker -.->|On Exhausted Attempts| DLQ
    DLQ --> Alerts
```

---

## 3. Dedicated Queues & Retry Policies

| Queue Name        | Typical Workloads                                         | Concurrency | Retry Limit | Backoff Strategy                   |
| :---------------- | :-------------------------------------------------------- | :---------- | :---------- | :--------------------------------- |
| `notifications`   | SendGrid Email, Twilio SMS, WhatsApp alerts               | 10          | 5           | Exponential: 2s initial, 2x factor |
| `file-processing` | Excel master data import, bank statement parsing          | 2           | 3           | Fixed delay: 5s                    |
| `reports`         | Large P&L PDF exports, aging reports, inventory valuation | 4           | 2           | Fixed delay: 10s                   |
| `integrations`    | FBR e-invoicing submission, bank API settlement           | 5           | 5           | Exponential: 5s initial, 2x factor |
| `outbox-relay`    | Periodic outbox polling and domain event distribution     | 1           | 3           | Immediate retry                    |

---

## 4. Job Payload Standards

Every job added to any BullMQ queue must extend `BaseJobPayload`:

```typescript
interface BaseJobPayload {
  correlationId: string;
  organizationId: string;
  companyId?: string;
  actorId?: string;
  enqueuedAt: string;
}
```

This guarantees that worker processes retain request correlation IDs in logs and propagate data-scoping boundaries when updating the database.
