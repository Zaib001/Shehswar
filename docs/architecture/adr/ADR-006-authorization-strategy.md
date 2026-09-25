# ADR-006: Authorization Strategy (Contextual RBAC & Data Scoping)

## Status

Accepted

## Context

In an enterprise ERP, permission logic cannot simply be `user.role === 'admin'`. Different users have distinct roles (e.g. Procurement Officer, QC Chemist, Plant Manager, Sales Rep, Finance Controller). Furthermore, access depends heavily on context: a Sales Rep in Child Company 1 must never see Child Company 2's sales orders, and child company staff must never view parent company manufacturing costs or formulas.

## Problem

How should authorization be structured so that:

1. Permissions are granular (`resource:action`).
2. Multi-company and plant/warehouse scoping is enforced contextually.
3. Backend services are the single source of truth, with frontend checks existing strictly for UX.

## Options Considered

1. **Simple Role Checks (`@Roles('ADMIN')`)**:
   - _Pros_: Simple to write.
   - _Cons_: Coarse, brittle, cannot handle contextual boundaries or sensitive field views.
2. **Third-Party Policy Engines (OPA / Keto)**:
   - _Pros_: Externalized policies.
   - _Cons_: Network latency on every request, operational overhead.
3. **Centralized In-Process Authorization Service (`can(user, action, resource, context)`)**:
   - _Pros_: High performance, evaluates RBAC + tenant hierarchy + sensitive attributes in one clean call.
   - _Cons_: Requires careful decorator and guard integration.

## Decision

Adopt **Contextual RBAC with Centralized Policy Engine**:

1. Permissions are stored as `resource:action` (e.g., `sales_order:create`, `costing:view_cost`).
2. Roles aggregate permissions (`RolePermission`).
3. Core decision API:
   ```typescript
   authorizationService.can({
     user,
     action,
     resource,
     context, // { organizationId, companyId, plantId, warehouseId }
     targetRecord,
   });
   ```
4. Sensitive actions (`VIEW_COST`, `VIEW_MARGIN`, `EDIT_FORMULA`, `APPROVE_FORMULA`, `MODIFY_PRICE`, `MODIFY_CREDIT_LIMIT`, `RELEASE_BATCH`, `RECALL_BATCH`) require specific high-privilege permissions and forbid cross-company escalation.
5. NestJS Guards:
   - `@RequirePermissions('resource:action')` validated by `RbacGuard`.
   - `DataScopeGuard` verifies company/tenant boundaries.

## Reasoning

Ensures security decisions are centralized, auditable, and decoupled from controller routing.

## Trade-offs

Developers must pass contextual attributes when checking record-level access.

## Consequences

- Backend remains authoritative.
- Child company users are programmatically prevented from accessing parent costing data.
