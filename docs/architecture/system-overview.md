# SHEHSWAR ONE360 — System Overview & Architecture Foundation

## 1. Executive Summary

**SHEHSWAR ONE360** is a modular, scalable, multi-company-ready, and future-SaaS-ready Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) platform. Designed for commercial enterprise deployment with **Shehswar Group** as its flagship enterprise customer, ONE360 unifies manufacturing operations, procurement, inventory tracking, batch traceability, production formula/BOM management, actual product costing, intercompany transactions, and dealer sales networks.

Phase 1 establishes the **technical foundation and architectural contract** across all layers of the platform, guaranteeing that subsequent functional phases (Procurement, Production, Inventory, Costing, Intercompany, Sales, CRM, Finance) plug in without architectural rework or schema dismantling.

---

## 2. System Context Diagram (C4 Level 1)

```mermaid
C4Context
    title System Context Diagram - SHEHSWAR ONE360

    Person(admin, "Group Executive / Admin", "Full governance, cross-company reporting, and configuration")
    Person(plant_mgr, "Plant & QC Manager", "Formulas, raw material QC, batch release, and costing")
    Person(sales_rep, "Sales Representative", "Dealer orders, visits, collections via Web & Mobile")
    Person(dealer, "External Dealer", "Dealer portal: orders, ledger, invoices, outstanding balance")

    System(shehswar_platform, "SHEHSWAR ONE360", "Enterprise ERP & CRM Platform (Modular Monolith)")

    System_Ext(fbr_system, "FBR / Tax Authority", "E-Invoicing and sales tax verification")
    System_Ext(msg_gateway, "Messaging Gateway", "Twilio, WhatsApp Business, SendGrid SMTP")
    System_Ext(banking, "Banking & Payments", "1Link, bank statement reconciliation, payment gateways")
    System_Ext(s3_storage, "Object Storage", "AWS S3 / Cloudflare R2 / MinIO documents")

    Rel(admin, shehswar_platform, "Manages governance, master data, and approvals via Web", "HTTPS")
    Rel(plant_mgr, shehswar_platform, "Manages production, QC, and costing via Web", "HTTPS")
    Rel(sales_rep, shehswar_platform, "Books sales orders and collections via Web/Mobile", "HTTPS / REST")
    Rel(dealer, shehswar_platform, "Views ledger, places orders via Dealer Portal", "HTTPS / REST")

    Rel(shehswar_platform, fbr_system, "Submits verified e-invoices", "REST / JSON")
    Rel(shehswar_platform, msg_gateway, "Dispatches SMS, WhatsApp, and Email alerts", "REST / Webhooks")
    Rel(shehswar_platform, banking, "Processes collections and payment confirmations", "REST / ISO 20022")
    Rel(shehswar_platform, s3_storage, "Uploads and streams signed document URLs", "HTTPS / S3 API")
```

---

## 3. Container Architecture Diagram (C4 Level 2)

```mermaid
graph TD
    subgraph Client Layer
        WebClient["Web ERP App (Next.js 14 App Router)"]
        MobileClient["Future Mobile App (React Native)"]
        DealerPortal["Future Dealer Portal (Next.js)"]
    end

    subgraph Edge & Ingress
        NginxGateway["Reverse Proxy / SSL Termination / Rate Limiter"]
    end

    subgraph Application Tier
        API["Backend API: NestJS 10 (Modular Monolith)<br/>REST /api/v1 | Swagger | AsyncLocalStorage"]
        Worker["Background Queue Worker (BullMQ)<br/>Emails, Reports, Sync, Outbox Relay"]
    end

    subgraph Data & Storage Tier
        Postgres[("PostgreSQL 16 Primary<br/>DECIMAL(18,4) | UUIDv7 | Row Scoping")]
        RedisCache[("Redis 7 In-Memory<br/>Sessions, Key-Prefixed Cache, BullMQ")]
        S3Storage[("Object Storage (S3 / R2 / MinIO)<br/>Document BLOBs, Lab Certificates")]
    end

    WebClient -->|HTTPS / WSS| NginxGateway
    MobileClient -->|HTTPS REST| NginxGateway
    DealerPortal -->|HTTPS REST| NginxGateway

    NginxGateway -->|Reverse Proxy| API

    API -->|Read/Write ACID Transactions| Postgres
    API -->|Cache & Enqueue Jobs| RedisCache
    API -->|Presigned Signed URLs| S3Storage

    Worker -->|Consume Queued Jobs| RedisCache
    Worker -->|Publish Domain Events / Outbox| Postgres
    Worker -->|Stream Export Files| S3Storage
```

---

## 4. Architectural Tenets & Invariants

1. **API-First Architecture**: All platform features are built as versioned RESTful APIs. Web, mobile, and external integrations consume identical endpoints and validation contracts.
2. **Modular Monolith First**: Single deployable repository organized into bounded business contexts. Eliminates premature distributed transaction complexity while enforcing clean code boundaries.
3. **No Floating-Point Financials**: All currency and quantity calculations use exact `DECIMAL(18, 4)` in PostgreSQL and `Money` / `Quantity` value objects backed by Decimal.js in Node.js.
4. **Contextual Multi-Company Data Isolation**: Hard tenant isolation between organizations; strict contextual isolation between Parent and Child companies. Child companies are physically prevented from reading parent manufacturing costs and profit margins.
5. **Post / Reverse / Adjust Immutability**: Historical financial postings and stock ledger movements cannot be silently edited or hard deleted. Corrections occur strictly via auditable reversal transactions.
6. **No Binary BLOBs in PostgreSQL**: Documents, photos, and PDFs are stored in S3-compatible object storage via expiring signed URLs; PostgreSQL stores only metadata.
7. **Transactional Outbox for Domain Events**: Entity mutations and domain event records commit atomically in the same database transaction, eliminating event loss.
