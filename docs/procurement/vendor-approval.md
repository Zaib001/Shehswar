# SHEHSWAR ONE360 — Vendor Approval Governance

## 1. Objective
Ensures zero unverified suppliers enter the SHEHSWAR Group commercial supply chain. Every vendor profile requires rigorous statutory compliance verification, active tax filer check (NTN/STRN), banking verification, and multi-tier organizational sign-off.

---

## 2. Multi-Tier Approval Chain

```text
[ Procurement Officer ]   ---> Creates Vendor Record (DRAFT)
         |
         v
[ Procurement Manager ]   ---> Evaluates Commercial Rates, Capacity, & Market Reputation
         |
         v
[ Finance & Tax Auditor ] ---> Verifies Active Taxpayer Status (FBR Active List), STRN, & IBAN
         |
         v
[ Executive / Director ]  ---> Final Authorization & Credit Limit Approval
         |
         v
   [ APPROVED ]           ---> Vendor Profile Activated for RFQ and PO Transactions
```

---

## 3. Platform Approval Engine Integration
The Vendor module leverages the Phase 3 `ApprovalEngineService` rather than hardcoding state changes:

1. **Workflow Rule Definition:**
   - Resource: `Resource.VENDOR`
   - Thresholds: Credit limits above PKR 5,000,000 automatically route to the Group Chief Financial Officer (CFO).
2. **Sequential Steps:**
   - Step 1: Procurement Head (`ROLE_PROCUREMENT_MANAGER`)
   - Step 2: Tax & Audit Controller (`ROLE_FINANCE_MANAGER`)
   - Step 3: Executive Committee (`ROLE_MANAGING_DIRECTOR`)

---

## 4. Notifications & Audit Signals

| Event Trigger | Recipient Role | Notification Message | Audit Action |
| :--- | :--- | :--- | :--- |
| `vendor.submitted` | Procurement Manager | *"New supplier profile [VND-XXX] submitted for technical qualification."* | `VENDOR_SUBMITTED` |
| `vendor.approved_step_1` | Finance Manager | *"Supplier [VND-XXX] approved by Procurement. Statutory audit required."* | `APPROVAL_STEP_COMPLETED` |
| `vendor.activated` | Creator, Procurement Team | *"Supplier [VND-XXX] fully approved and active for purchase orders."* | `VENDOR_APPROVED` |
| `vendor.rejected` | Creator | *"Supplier [VND-XXX] rejected. Reason: Missing 2026 Tax Return."* | `VENDOR_REJECTED` |

---

## 5. Security & Isolation
- Company-level isolation restricts vendor editing to designated procurement officers of that legal operating unit.
- Cost/banking information visibility is governed by the `PROCUREMENT_FINANCE_VIEW` permission token.
