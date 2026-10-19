# Approval Foundation Architecture & Specification

## 1. Executive Overview

Phase 3 establishes the **Approval Foundation Layer** for SHEHSWAR ONE360. In strict accordance with Phase 3 instructions, **no business transactions (such as Purchase Orders or Production Batches) are created in this phase**. Instead, Phase 3 delivers the generalized, reusable approval rule management engine and UI foundation that all future modules will plug into.

### Example Reusable Rules
```
Module: Procurement
Condition: Amount > 1,000,000 PKR
Approval Tier: Level 1
Required Approver: Finance & Treasury Manager

Module: Chemical Production
Condition: Formula Toxicity Class == Class 1 (Hazardous Precursors)
Approval Tier: Level 2
Required Approver: Works Director / Plant Manager
```

---

## 2. Entity Schema & Standards

The approval foundation utilizes three core database models:

### 1. `ApprovalRule`
Defines when and who must approve a document transition.

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `organizationId` | `VARCHAR(36)` | `NOT NULL, FK` | Enterprise holding scope |
| `companyId` | `VARCHAR(36)` | `NULLABLE, FK` | Operating subsidiary scope |
| `module` | `VARCHAR(50)` | `NOT NULL` | ERP module resource (`procurement`, `production`, etc.) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Descriptive title for the approval policy |
| `condition` | `JSONB` | `NOT NULL` | Evaluated criteria (`{ "field": "totalAmount", "operator": ">", "value": 1000000 }`) |
| `approverRole` | `VARCHAR(50)` | `NOT NULL` | RBAC role required to authorize |
| `level` | `INTEGER` | `NOT NULL, DEFAULT 1` | Sequential tier (1 = first review, 2 = senior sign-off) |
| `isActive` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Active policy switch |

### 2. `ApprovalRequest`
Created when any future document advances to approval workflow.
- `documentType`: Type of document (`PO`, `BATCH`, etc.)
- `documentId`: Foreign key to the business document.
- `currentLevel`: Currently pending approval tier.
- `status`: `PENDING`, `APPROVED`, `REJECTED`, `SENT_BACK`.

### 3. `ApprovalHistory`
Immutable audit log recording every sign-off, comment, rejection reason, or escalation.

---

## 3. UI Architecture & Features

- **Approval Rule Builder**: Admin screen to configure multi-tier approval rules by selecting module, defining numerical threshold or categorical conditions, assigning approver roles, and establishing tier hierarchy.
- **Workflow State Display**: Uses the Phase 2 `WorkflowTracker` and `StatusBadge` to visualize multi-stage progression.
- **Action Modal**: Standardized sign-off dialogue allowing approvers to input signature remarks or mandatory rejection justifications.
