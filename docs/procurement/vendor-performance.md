# SHEHSWAR ONE360 — Vendor Performance & Scorecards

## 1. Executive Purpose
The **Vendor Performance Engine** transforms operational procurement logs into empirical, data-driven supplier evaluations. For the SHEHSWAR Group, where timely delivery of chemical raw materials (e.g. Ammonia, Nitric Acid) is critical to continuous factory throughput, tracking supplier reliability protects against costly plant shutdowns.

---

## 2. Multi-Criteria Performance Metrics & Mathematical Formula

Every active supplier is evaluated using a weighted multi-factor composite rating out of 5.00 stars:

$$\text{Overall Rating} = (W_{\text{ot}} \times S_{\text{ot}}) + (W_{\text{qc}} \times S_{\text{qc}}) + (W_{\text{lt}} \times S_{\text{lt}})$$

Where standard weights and scoring functions are defined as:

### 1. Delivery Punctuality ($W_{\text{ot}} = 0.40$)
Measures the percentage of purchase order items delivered on or before the agreed PO delivery milestone:
$$S_{\text{ot}} = \left(\frac{\text{On-Time Delivery Rate \%}}{100}\right) \times 5.0$$

### 2. Quality Acceptance Factor ($W_{\text{qc}} = 0.40$)
Derived from physical and laboratory QC inspection dispositions on Goods Receipt Notes (GRN):
$$\text{Rejection Rate \%} = \left(\frac{\sum \text{Rejected Quantity}}{\sum \text{Received Quantity}}\right) \times 100$$
$$S_{\text{qc}} = \left(\frac{100 - \text{Rejection Rate \%}}{100}\right) \times 5.0$$

### 3. Lead Time Reliability Benchmark ($W_{\text{lt}} = 0.20$)
Evaluates variance between quoted delivery lead days and actual offloading completion.
$$S_{\text{lt}} = \max\left(1.0, 5.0 - (\text{Average Lead Days} / \text{Standard Benchmark})\right)$$

---

## 3. Performance Tiers & Supplier Governance

| Overall Score | Supplier Classification | Commercial Action & Governance |
| :--- | :--- | :--- |
| **4.50 — 5.00** | **Tier-1 Preferred Partner** | Automatic qualification for annual volume contracts, preferential payment terms (30 days credit), prioritized RFQ dispatch. |
| **3.50 — 4.49** | **Satisfactory Active Supplier** | Standard operational procurement; normal credit lines; quarterly audit review. |
| **2.50 — 3.49** | **Under Observation / Conditional** | Compulsory pre-shipment inspection; 100% lab testing of incoming lots; credit limit restricted. |
| **< 2.50** | **Critical Quality Default / Blocked** | Automated flag preventing new Purchase Order issuance until formal corrective action plan (CAPA) is approved by Plant Operations Director. |

---

## 4. UI Capabilities & Scorecard Drilldowns
- **Executive KPI Dashboard:** Real-time visibility into Group average rating, average on-time percentage, material rejection rate, and total evaluated suppliers.
- **Visual Performance Bars:** Dynamic progress bars reflecting fulfillment progress, quality pass rate, and delivery punctuality.
- **Dynamic Recalculation Simulation:** One-click re-indexing aggregating latest GRN inspection results and PO delivery logs.
