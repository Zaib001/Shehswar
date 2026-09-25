# SHEHSWAR ONE360 — Configurable Approval Workflow Architecture

## 1. Multi-Level Approval State Machine

In enterprise operations, documents undergo strict multi-tiered review cycles:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED : submitForApproval()
    SUBMITTED --> PENDING_APPROVAL : Rule Evaluation

    state PENDING_APPROVAL {
        [*] --> Level1_Review
        Level1_Review --> Level2_Review : Level 1 Approved
        Level2_Review --> Fully_Approved : Level 2 Approved
    }

    PENDING_APPROVAL --> PARTIALLY_APPROVED : Single Level Approved
    PENDING_APPROVAL --> APPROVED : Final Level Approved
    PENDING_APPROVAL --> REJECTED : Rejected by Reviewer
    PENDING_APPROVAL --> SENT_BACK : Clarification Requested

    SENT_BACK --> DRAFT : Revising
    REJECTED --> [*]
    APPROVED --> REOPENED : Reopened via Emergency Override
    APPROVED --> [*]
```

---

## 2. Rule Evaluation Dimensions

The `ApprovalEngineService` evaluates rules dynamically based on:

1. **Document Type**: Purchase Order (`PO`), Sales Order (`SO`), Production Formula (`FORMULA`), Credit Override (`CREDIT_OVERRIDE`), Stock Adjustment (`STOCK_ADJ`).
2. **Entity Context**: Organization, Company, Plant, or Department.
3. **Monetary Thresholds**:
   - Level 1: Under PKR 500,000 (Department Manager).
   - Level 2: PKR 500,000 to 2,000,000 (General Manager).
   - Level 3: Over PKR 2,000,000 (Director / CEO).
4. **Required Role**: Role code required to execute each approval level.

---

## 3. Approval Engine Schema Foundation

Managed via:

- `approval_rules`: Configurable rules with criteria thresholds and level requirements.
- `approval_requests`: Active tracking of document status, current level, total levels.
- `approval_history`: Append-only history of every review decision, timestamp, and comments.
