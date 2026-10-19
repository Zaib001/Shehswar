# SHEHSWAR ONE360 — Quotation Comparison Matrix & Vendor Award

## 1. Domain Purpose
The **Quotation Comparison Matrix** provides procurement decision-makers (Procurement Committee, CFO, Plant Operations Director) with a side-by-side evaluation tool. It normalizes commercial rates, taxes, freight terms, lead times, and payment structures across multiple competing suppliers for the same material specification.

---

## 2. Multi-Vendor Side-by-Side Comparison Layout

| Metric / Parameter | Vendor A (Engro Precursors) | Vendor B (Pakistan Oxygen) | Vendor C (Descon Engineering) | Benchmark / Best |
| :--- | :--- | :--- | :--- | :--- |
| **Nitric Acid 68% (75 MT)** | PKR 102,000 / MT | PKR 106,000 / MT | PKR 108,000 / MT | **Engro (Lowest)** |
| **Phosphoric Acid 85% (30 MT)** | PKR 195,000 / MT | PKR 200,000 / MT | PKR 203,333 / MT | **Engro (Lowest)** |
| **Base Subtotal** | PKR 13,500,000 | PKR 13,950,000 | PKR 14,200,000 | **Engro (-3.2%)** |
| **Trade Discount** | 2% (-PKR 270,000) | 0% | 1% (-PKR 150,000) | **Engro** |
| **GST (18%)** | PKR 2,430,000 | PKR 2,511,000 | PKR 2,556,000 | Statutory |
| **Net Payable Total** | **PKR 15,660,000** | PKR 16,461,000 | PKR 16,606,000 | **Engro (Best Net)** |
| **Delivery Lead Days** | **5 Days** | 8 Days | 12 Days | **Engro (Fastest)** |
| **Payment Credit Terms** | 30 Days Credit | 100% Advance | 30 Days Credit | **Engro / Descon** |
| **QC / COA Warranty** | Batch Purity COA | ISO 9001 Warranty | Standard Commercial | **Engro** |
| **Vendor Scorecard** | ★ 4.85 / 5.0 | ★ 4.52 / 5.0 | ★ 4.40 / 5.0 | **Engro** |

---

## 3. Award Selection & Justification Audit
In high-value agricultural chemical manufacturing, award decisions must comply with transparent audit regulations:

1. **Selection Justification:** When a vendor is awarded, the procurement system mandates a recorded `selectionJustification` text block explaining why the chosen quote represents the best commercial and technical value for the group.
2. **Non-Lowest Price Exceptions:** If an evaluator awards a quote that is *not* the lowest net price (e.g., due to critical 5-day lead time vs 15-day lead time to avoid plant shutdown), the system flags an audit exception requiring Director-level concurrence.
3. **Automated Status Update:** Selecting a vendor automatically sets `isSelected = true`, updates quote status to `SELECTED`, and marks unselected competing quotes as `REJECTED`.
4. **PO Transition:** Direct one-click conversion from the awarded quotation into an authorized Purchase Order (PO).
