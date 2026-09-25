# ADR-002: Modular Monolith Backend Architecture

## Status

Accepted

## Context

Enterprise ERP systems involve complex transactional interactions across procurement, inventory, production, QC, sales, and accounting. Microservices introduced prematurely add network latency, distributed transaction failure modes (2PC / saga overhead), operational complexity, and deployment friction.

## Problem

How should the backend be architected to ensure clean business domain boundaries, prevent spaghetti dependencies, and maintain ACID transaction guarantees while retaining the option to extract microservices later if scale demands it?

## Options Considered

1. **Premature Distributed Microservices**: Splitting procurement, inventory, costing, and auth into separate networked services.
   - _Pros_: Independent deployment.
   - _Cons_: Distributed transactions (risk of inconsistent inventory/financial state), high infrastructure overhead, complex debugging.
2. **Unstructured Monolith**: Single codebase where any controller can access any database table.
   - _Pros_: Fast initial prototyping.
   - _Cons_: High coupling, impossible to maintain, leads to complete architectural collapse.
3. **Structured Modular Monolith (NestJS)**: Single deployable artifact organized into strict bounded contexts with internal service interfaces and events.
   - _Pros_: ACID local transactions, in-process performance, enforced domain boundaries, easy extraction path.
   - _Cons_: Requires discipline to avoid cross-module database bypassing.

## Decision

Adopt a **Modular Monolith** using NestJS.
The backend is structured into bounded business domains:

- Core Platform (Auth, Authorization, Audit, Settings, Feature Flags, Health)
- Master Data, Procurement, Inventory, Warehouse, Production, QC, Packing, Costing, Intercompany, Sales, CRM, Finance.
  Each module maintains:
- `domain/`: Business entities and rules
- `application/`: Use cases, commands, queries
- `infrastructure/`: Database access, external drivers
- `presentation/`: Controllers, DTOs

## Reasoning

Allows critical operations like intercompany inventory transfers (parent sales dispatch + child purchase receipt) to commit inside a single ACID database transaction via `TransactionService`. Modules communicate through exported services or internal domain events, never direct table mutations.

## Trade-offs

A crash in one module could affect the runtime process if unhandled, though mitigated by NestJS global exception filters.

## Consequences

- Clean separation of business domains.
- If a domain (such as AI forecasting or high-throughput telemetry) requires independent scaling later, its bounded context can be extracted with minimal refactoring.

## Future Considerations

Use domain events and outbox tables so module interactions mimic asynchronous service messaging.
