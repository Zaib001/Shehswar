# ADR-017: Testing Architecture & Quality Foundation

## Status

Accepted

## Context

Enterprise ERP systems govern mission-critical manufacturing, financials, and inventory. Regressions in product costing, formula calculations, stock reservations, or intercompany ledger entries can cause direct financial and legal damage.

## Problem

What testing strategy and harness must be established to ensure high confidence and rapid refactoring without relying on slow manual testing?

## Options Considered

1. **Manual QA Only**:
   - _Risk_: High regression rate, slow release cycles.
2. **End-to-End (E2E) Heavy Testing**:
   - _Pros_: Tests real UI.
   - _Cons_: Extremely brittle, slow, expensive to maintain.
3. **Pyramid Testing Strategy (Unit + Integration + API Contract Tests)**:
   - High volume of fast unit tests for business math and policies, integration tests with ephemeral database containers, and automated CI validation.

## Decision

Adopt **Test Pyramid Strategy**:

1. **Unit Tests (Vitest / Jest)**:
   - Financial precision and UOM conversion (`Money`, `Quantity`).
   - Authorization policy evaluator (`AuthorizationService.can(...)`).
   - Approval state machine transitions.
   - Settings hierarchy resolution.
2. **Integration & API Tests**:
   - Executed against a dedicated test PostgreSQL instance.
   - Tests transaction rollback behavior (`TransactionService`).
   - Tests JWT auth guard, RBAC guard, and company data isolation.
3. **Database Test Harness**:
   - Seeds minimal system fixtures (tenant, organization, parent company, child company, permissions, roles).
   - Independent tests execute within rolled-back transactions or isolated test schemas.
4. **CI Enforcement**:
   - Pull requests must pass `npm run format:check`, `npm run build`, and `npm run test` before merging.

## Reasoning

Detects regressions in milliseconds during local development before code is committed.

## Trade-offs

Writing tests requires upfront development effort, which pays off exponentially in ERP stability.

## Consequences

- Costing and inventory algorithms can be refactored safely.
- No untested business logic reaches staging.
