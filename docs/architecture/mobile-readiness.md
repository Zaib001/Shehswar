# SHEHSWAR ONE360 — Mobile Architecture & Offline Readiness

## 1. Context & Mobile Use Cases

In subsequent phases, a **React Native** cross-platform mobile application will be built for field sales representatives, delivery drivers, and plant supervisors.
Primary mobile capabilities will include:

- Dealer visit logging and GPS check-in.
- Offline sales order booking in remote agricultural zones.
- Dealer outstanding ledger inspection.
- Payment collection logging and cheque photo capture.
- Urgent workflow approval notifications.

---

## 2. Omnichannel Backend Reuse

The mobile app will NOT have a dedicated "mobile backend".
It consumes the exact same `/api/v1` endpoints used by the Web ERP:

- Reuses `/api/v1/auth/login` and JWT token refresh.
- Reuses central authorization and company isolation logic.
- Reuses standard `ApiResponse<T>` envelopes and error structures.
- Imports shared TypeScript interfaces directly from `@shehswar/types`.

---

## 3. Offline Synchronization & Idempotency

To support sales reps booking orders in rural locations with intermittent 3G/4G connectivity:

1. **Local SQLite / WatermelonDB Cache**: The mobile client caches product price lists, dealer accounts, and credit balances locally.
2. **Idempotency Keys (`X-Idempotency-Key`)**:
   - When an order is created offline, the mobile app generates a client-side UUID idempotency key.
   - When network connectivity is restored, queued orders are synced to the backend.
   - If a network drop occurs during transmission, retrying the request with the identical key prevents duplicate orders or double credit reductions.
3. **Bandwidth Optimization**:
   - Compressed JSON responses (Gzip / Brotli).
   - Minimalist pagination query parameters to reduce cellular data usage.
