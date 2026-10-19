# SHEHSWAR ONE360 — Purchase Order (PO) Management

## 1. Domain Overview
The **Purchase Order (PO)** is the legally binding contractual instrument issued by SHEHSWAR Group to an authorized supplier. It commits commercial funds, specifies deliverable material quantities, locks unit rates and taxes, and mandates delivery milestones at specific manufacturing plant warehouses.

---

## 2. PO Entity & Financial Model

```text
+-----------------------------------------------------------+
|                     PURCHASE ORDER                        |
+-----------------------------------------------------------+
| poNumber: SH-PO-2026-000102 (Via DocumentNumberingService)|
| organizationId / companyId: Tenant & Company Scope        |
| vendorId: Reference to APPROVED Vendor                    |
| departmentName: Chemical Production & Batching            |
| currency: PKR, USD, EUR                                   |
| paymentTerms: 30_DAYS_CREDIT, ADVANCE_PAYMENT             |
| deliveryLocation: Sheikhupura Manufacturing Complex       |
| expectedDeliveryDate: Promised arrival date               |
| subtotal: Base sum of lines                               |
| taxAmount: GST / withholding liabilities                  |
| discountAmount: Negotiated volume concessions             |
| totalAmount: Net contractual liability                    |
| status: DRAFT | SUBMITTED | APPROVED | SENT_TO_VENDOR...  |
| approvedByName: Name of authorizing executive             |
| approvedAt: Authorization timestamp                       |
+-----------------------------------------------------------+
                             | 1
                             |
                             | N
+-----------------------------------------------------------+
|                   PURCHASE ORDER ITEM                     |
+-----------------------------------------------------------+
| itemName: Nitric Acid 68% Technical Grade                 |
| category: RAW_MATERIAL                                    |
| quantity: Ordered quantity (e.g., 75 MT)                  |
| unit: TON                                                 |
| unitRate: Contracted rate per unit (PKR 102,000)          |
| taxRate & taxAmount: Line GST (18%)                       |
| discountRate & discountAmount: 2%                         |
| lineTotal: Total line commitment                          |
| receivedQuantity: Cumulative received via GRNs            |
+-----------------------------------------------------------+
```

---

## 3. Strict Business Rules
1. **Approved Vendor Rule:** POs can **only** be created against suppliers who hold active `VendorStatus.APPROVED` status. Draft, pending, blocked, or inactive vendors are blocked by database guards and API validation.
2. **Atomic Document Numbering:** Hardcoded numbering is prohibited; all POs fetch unique, non-colliding serials from `DocumentNumberingService` using document type `PURCHASE_ORDER`.
3. **Receipt Progress Tracking:** As physical consignments arrive via Goods Receipt Notes (GRN), the PO's items dynamically increment `receivedQuantity`.
   - When all line items satisfy $\text{receivedQuantity} \ge \text{quantity}$, PO status automatically transitions to `COMPLETED`.
   - Partial receipts advance status to `PARTIALLY_RECEIVED`.
4. **Approval Integration:** Purchase Orders exceeding corporate threshold limits (e.g. > PKR 1,000,000) require sequential two-tier approval (Procurement Manager and Plant Operations Director).
