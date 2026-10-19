# SHEHSWAR ONE360 — Vendor Quotation Management

## 1. Overview
The **Vendor Quotation** captures formal bids submitted by suppliers in response to an RFQ. It standardizes pricing structures, sales tax liabilities (e.g., standard 18% GST), trade discounts, delivery lead times, payment terms, and validity horizons.

---

## 2. Quotation Entity Structure

```text
+-----------------------------------------------------------+
|                    VENDOR QUOTATION                       |
+-----------------------------------------------------------+
| quotationNumber: Supplier's internal quote ref            |
| rfqId / rfqNumber: Linked RFQ                             |
| vendorId: Supplier reference                              |
| currency: PKR (with Multi-currency exchange support)      |
| subtotal: Base line-item summation                        |
| taxAmount: Statutory sales tax (GST 18%)                  |
| discountAmount: Volume rebate / early payment discount    |
| netAmount: Net payable commitment                         |
| deliveryLeadDays: Promised lead time from PO issuance     |
| paymentTerms: 30_DAYS_CREDIT, ADVANCE_PAYMENT, etc.       |
| validityDate: Price guarantee expiration                  |
| warranty: Quality guarantee / COA certification           |
| status: RECEIVED | UNDER_REVIEW | SELECTED | REJECTED     |
| isSelected: Boolean                                       |
| selectionJustification: Audit reason for vendor choice    |
+-----------------------------------------------------------+
```

---

## 3. Commercial Calculations
For every line item $i$:
$$\text{Line Net}_i = (\text{Quantity}_i \times \text{Unit Rate}_i) \times (1 - \text{Discount Rate}_i) \times (1 + \text{Tax Rate}_i)$$

Overall Quotation:
$$\text{Subtotal} = \sum (\text{Quantity}_i \times \text{Unit Rate}_i)$$
$$\text{Discount Total} = \sum (\text{Base}_i \times \text{Discount Rate}_i)$$
$$\text{Tax Total} = \sum ((\text{Base}_i - \text{Discount}_i) \times \text{Tax Rate}_i)$$
$$\text{Net Total} = \text{Subtotal} - \text{Discount Total} + \text{Tax Total}$$

---

## 4. UI Capabilities
- **Direct Entry & PDF Parser:** Procurement officers can manually record incoming paper bids or upload formal supplier quotation sheets.
- **Validity Warning:** Automatically highlights expiring quotes in amber/red when within 3 business days of expiration.
- **Audit Logging:** Every price alteration or status transition records a full audit diff.
