# ADR-005: Authentication Strategy & Session Security

## Status

Accepted

## Context

Shehswar ONE360 will be accessed by internal management, factory supervisors, warehouse staff, sales reps on mobile devices, external dealers via the Dealer Portal, and automated integration agents. A unified, secure authentication mechanism is needed.

## Problem

How should user identity be securely verified, sessions tracked, and credentials protected against credential stuffing, brute-force attacks, and token theft?

## Options Considered

1. **Stateful Server-Side Cookies**:
   - _Pros_: Easy revocation.
   - _Cons_: Difficult to share across mobile apps, CORS complexity with external portals.
2. **Stateless JWT Only (No Session Tracking)**:
   - _Pros_: Zero database lookup on API calls.
   - _Cons_: Cannot revoke a compromised user token immediately before expiration.
3. **Hybrid JWT + Database Session Tracking**:
   - Short-lived Access Token (15m JWT) + Long-lived Refresh Token (7d) tied to a `UserSession` table record.
   - _Pros_: Fast stateless verification for 15 minutes, instant session revocation capability, device tracking, mobile and web compatible.
   - _Cons_: Refresh requests touch the database.

## Decision

Adopt **Hybrid JWT with Active Session Tracking**:

1. **Password Hashing**: Bcrypt with salt rounds = 12.
2. **Access Token**: Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`. Encodes `sub`, `organizationId`, `companyId`, `sessionId`, `roles`, and `permissions`.
3. **Refresh Token**: Long-lived (7 days), signed with `JWT_REFRESH_SECRET`. Stored as a cryptographic hash in `UserSession`.
4. **Brute Force Protection**: Account locking for 15 minutes after 5 consecutive failed login attempts (`failedLoginAttempts`, `lockedUntil`).
5. **Session Revocation**: `isRevoked: true` on logout or administrative session termination immediately prevents refreshing.
6. **Future SSO & MFA**: Architecture leaves hooks for TOTP 2FA and Google/Microsoft OAuth SSO.

## Reasoning

Combines the low latency of JWTs for web and mobile clients with the strict governance requirement of an enterprise ERP to revoke sessions instantly.

## Trade-offs

Requires storing session metadata in PostgreSQL.

## Consequences

- Unified auth for web, future mobile, and dealer portal.
- Account lockout protects against automated password attacks.
