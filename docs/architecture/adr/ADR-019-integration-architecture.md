# ADR-019: External Integration & Webhook Security

## Status

Accepted

## Context

Shehswar ONE360 will integrate with external systems: tax authorities (e.g. FBR e-invoicing in Pakistan), bank payment gateways, WhatsApp Business API, SMS aggregators, and external CRM/dealer platforms. Incoming webhooks and outbound API calls must be secure against spoofing, replay attacks, and network failures.

## Problem

How should third-party integrations and webhooks be secured and abstracted so that vendor SDK changes don't ripple through business domains?

## Options Considered

1. **Direct In-Line Vendor Calls in Controllers**:
   - _Risk_: High coupling; vendor API changes break business logic.
2. **Adapter Pattern with Secure Ingestion Gateway**:
   - Isolate each external service behind an explicit interface (Adapter pattern).
   - Inbound webhooks validated with cryptographic HMAC-SHA256 signatures, timestamp checks, and idempotency tracking.

## Decision

Adopt **Adapter Pattern with Secure Webhook Ingestion Standard**:

1. **Integration Adapters**:
   - Business modules interact with abstract interfaces (e.g. `TaxInvoiceProvider`, `MessagingProvider`), never direct third-party SDKs.
2. **Inbound Webhook Security Requirements**:
   - **Signature Verification**: Every incoming webhook must include an HMAC-SHA256 signature in headers verified with a shared secret.
   - **Timestamp Validation**: Reject requests older than 300 seconds to prevent replay attacks.
   - **Idempotency Key**: Webhook payload ID or event ID recorded in Redis/database before execution to prevent duplicate payment or status processing.
3. **Outbound Integration Resilience**:
   - Outbound requests routed through BullMQ queue with automatic exponential backoff retries and circuit breaker protection.

## Reasoning

Prevents fraudulent external webhook injection and shields Shehswar ONE360 from vendor downtime or breaking API revisions.

## Trade-offs

Requires implementing signature verification boilerplate on each external webhook endpoint.

## Consequences

- Clean, testable mocks for third-party integrations in automated test suites.
- High resilience against network blips and third-party rate limits.
