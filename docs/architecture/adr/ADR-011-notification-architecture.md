# ADR-011: Notification Architecture (Decoupled Multichannel)

## Status

Accepted

## Context

When business events occur (e.g. Purchase Order approved, Goods Receipt posted, QC inspection failed, Dealer credit limit exceeded), various stakeholders must be notified via In-App alerts, Email, SMS, WhatsApp, or Mobile Push notifications. Tightly coupling notification delivery into transactional domain services causes network lag and failure cascades.

## Problem

How should notifications be triggered, formatted, queued, and dispatched without embedding third-party vendor SDKs into core business logic?

## Options Considered

1. **Direct Synchronous Calls in Business Services**:
   - Calling SendGrid or Twilio directly inside `approvePurchaseOrder()`.
   - _Pros_: Simple.
   - _Cons_: Network failure rolls back business transactions, adds hundreds of milliseconds to HTTP response time.
2. **Decoupled Notification Pipeline with Template Engine & Queue**:
   - Event -> Notification Rule -> Recipient Resolution -> Template -> Queue -> Channel Worker.

## Decision

Adopt **Decoupled Multichannel Notification Pipeline**:

1. Business services emit domain events or call `NotificationService.dispatch()`.
2. **In-App Channel**: Writes directly to `user_notifications` table for instant UI rendering via WebSockets/polling.
3. **External Channels (Email, SMS, WhatsApp)**:
   - Written to `notification_queue_items` with status `PENDING`.
   - BullMQ worker picks items up and calls external adapters (SMTP/SendGrid, Twilio, Meta WhatsApp Business API).
   - Retries handled with exponential backoff; failures recorded in `lastError`.
4. **Template Engine**: Message bodies are composed from versioned `notification_templates` records using parameter substitution.

## Reasoning

Decouples transactional ERP reliability from third-party telecommunication gateway uptime.

## Trade-offs

External notification delivery is asynchronous (a few seconds delay), which is acceptable and expected for email/SMS.

## Consequences

- Business logic never imports email or SMS SDKs directly.
- Failed deliveries can be retried without re-executing business operations.
