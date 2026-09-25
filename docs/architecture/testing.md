# SHEHSWAR ONE360 — Testing Architecture & Quality Foundation

## 1. Testing Pyramid Strategy

To maintain velocity while guaranteeing zero financial regressions, ONE360 structures its testing suite around the testing pyramid:

```text
       / \
      /   \      E2E Tests (Playwright / Cypress)
     /  ▲  \     [Critical Path Scenarios, e.g. Login -> PO Approval]
    /───────\
   /    ▲    \   Integration & API Tests (Supertest + Real PostgreSQL)
  /           \  [Transactions, RBAC Guards, Data Scoping, Outbox Relay]
 /─────────────\
/       ▲       \ Unit Tests (Vitest / Jest)
───────────────── [Financial Precision, UOM Conversions, AuthZ can(), Domain Logic]
```

---

## 2. Test Suites Setup

1. **Packages Unit Tests (`vitest`)**:
   - `packages/shared/src/math/money.spec.ts`: Validates zero IEEE-754 drift, currency checks, markups, and rounding.
   - `packages/shared/src/math/quantity.spec.ts`: Validates exact UOM conversions and zero division guards.
2. **API & Security Tests (`jest` / `supertest`)**:
   - `apps/api/src/platform/authorization/authorization.service.spec.ts`: Validates RBAC permissions, sensitive costing protections, and contextual company boundary isolation.
   - Guard tests: Validates `JwtAuthGuard`, `RbacGuard`, and `DataScopeGuard`.

---

## 3. Continuous Integration Pipeline (GitHub Actions)

The automated workflow `.github/workflows/ci.yml` triggers on every push and pull request:

1. Boots containerized PostgreSQL and Redis services.
2. Runs `npm ci` with caching.
3. Checks code style via Prettier.
4. Generates Prisma client types.
5. Performs complete TypeScript type check across all monorepo apps and packages.
6. Executes all unit and integration test suites.
