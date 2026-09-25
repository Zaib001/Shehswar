# SHEHSWAR ONE360 — Security Baseline & Data Protection Architecture

## 1. Security Baseline Standards

ONE360 enforces defense-in-depth across the application and infrastructure:

1. **HTTPS & Transport Security**: All production traffic strictly enforces TLS 1.3 with HSTS headers.
2. **Input Sanitization & Validation**:
   - NestJS global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
   - Prevents parameter injection and mass-assignment vulnerabilities.
3. **SQL Injection Defense**:
   - Zero raw concatenated SQL strings.
   - All queries parameterized through Prisma ORM.
4. **Cross-Site Scripting (XSS) & Header Protections**:
   - Content Security Policy (CSP), X-Frame-Options, X-Content-Type-Options headers.
5. **Rate Limiting**:
   - Sliding-window IP and account rate limiting (100 requests / minute) to prevent brute-force and DDoS saturation.
6. **CORS Policy**:
   - Strict origin whitelisting (`CORS_ORIGIN`).

---

## 2. Enterprise Data Classification

| Classification Level | Definition & Scope                                 | Examples                                                                | Protective Controls                                                    |
| :------------------- | :------------------------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **PUBLIC**           | Freely sharable outside the group.                 | Marketing catalogue, public brochures                                   | Public CDN caching allowed                                             |
| **INTERNAL**         | Standard operational data for group staff.         | Standard stock lists, delivery challans                                 | Authenticated session required                                         |
| **CONFIDENTIAL**     | Sensitive business agreements and commercial data. | Dealer contracts, sales prices, supplier terms                          | RBAC + Company Scope enforcement                                       |
| **HIGHLY SENSITIVE** | Critical proprietary and financial assets.         | Actual product cost, profit margin, feed formulas, payroll, credentials | Dedicated sensitive permissions (`view_cost`), immutable audit logging |

---

## 3. Sensitive Data Masking & Redaction

The structured logger (`@shehswar/logger`) automatically redacts sensitive keys at the serializer level:

- `password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `creditCard`, `apiKey`.
- Values are replaced with `[REDACTED_BY_SECURITY]` before disk or network emission.
