# SHEHSWAR ONE360 — Procurement & Vendor API Specification

## 1. API Standards & Multi-Tenant Conventions
All Procurement REST API endpoints follow the Phase 1 enterprise architecture standards:
- **Base Route:** `/api/v1/procurement/...`
- **Tenant & Entity Scoping:** Mandatory `x-organization-id` and `x-company-id` header validation with JWT identity token extraction.
- **Envelope Standardization:** Every successful response wraps payloads inside standard `{ success: true, data: ..., timestamp: ... }`.
- **Atomic Serial Generation:** PR, RFQ, PO, and GRN numbers are obtained via `DocumentNumberingService`.

---

## 2. API Endpoint Catalog

### 1. Vendor Master (`/api/v1/procurement/vendors`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Register new supplier master record (DRAFT) | `PROCUREMENT_CREATE` |
| `GET` | `/` | Paginated vendor list with filters & category search | `PROCUREMENT_READ` |
| `GET` | `/:id` | 360-degree vendor details with documents & history | `PROCUREMENT_READ` |
| `PATCH`| `/:id/status` | Advance approval state (SUBMIT, APPROVE, BLOCK) | `PROCUREMENT_APPROVE` |

### 2. Purchase Requisitions (`/api/v1/procurement/purchase-requisitions`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Create multi-item departmental requisition | `REQUISITION_CREATE` |
| `GET` | `/` | Filter by department, priority, and approval status | `REQUISITION_READ` |
| `GET` | `/:id` | Retrieve PR header, items, and approval timeline | `REQUISITION_READ` |
| `PATCH`| `/:id/status` | Route for approval or departmental rejection | `REQUISITION_APPROVE` |

### 3. Request For Quotation (`/api/v1/procurement/rfqs`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Generate RFQ from approved PR & invite vendors | `RFQ_CREATE` |
| `GET` | `/` | List active RFQs with response tracking counts | `RFQ_READ` |
| `GET` | `/:id` | View invited vendors, response deadlines, and bids | `RFQ_READ` |
| `POST` | `/:id/send` | Transmit formal RFQ invitations to invited suppliers| `RFQ_UPDATE` |

### 4. Vendor Quotations (`/api/v1/procurement/quotations`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Submit/record formal vendor commercial quotation | `QUOTATION_CREATE` |
| `GET` | `?rfqId=...` | Query all competing quotes submitted for an RFQ | `QUOTATION_READ` |
| `GET` | `/:id` | Detailed quotation breakdown with taxes & discounts | `QUOTATION_READ` |

### 5. Quotation Comparison Matrix (`/api/v1/procurement/quotation-comparisons`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/:rfqId/matrix` | Generate normalized side-by-side comparison grid | `QUOTATION_READ` |
| `POST` | `/select` | Award winning vendor with mandatory audit reason | `QUOTATION_APPROVE` |

### 6. Purchase Orders (`/api/v1/procurement/purchase-orders`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Create PO (Enforces `VendorStatus.APPROVED` rule) | `PO_CREATE` |
| `GET` | `/` | Paginated PO register with receipt progress bars | `PO_READ` |
| `GET` | `/:id` | 360-degree PO view with item delivery balances | `PO_READ` |
| `PATCH`| `/:id/status` | Approve, send to vendor, or cancel order | `PO_APPROVE` |

### 7. Goods Receipt Notes (`/api/v1/procurement/goods-receipts`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Log physical gate receipt against approved PO | `GRN_CREATE` |
| `GET` | `/` | List GRNs with carrier logistics & QC status | `GRN_READ` |
| `GET` | `/:id` | Detailed receiving inspection with package condition | `GRN_READ` |
| `PATCH`| `/:id/qc` | Record laboratory QC assay disposition & accepted qty| `QC_INSPECT` |

### 8. Vendor Performance Scorecards (`/api/v1/procurement/vendor-performance`)
| Method | Endpoint | Description | Permissions Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/:vendorId` | Retrieve empirical scorecards and star ratings | `PERFORMANCE_READ` |
| `POST` | `/recalculate` | Re-index empirical delivery punctuality & QC records | `PERFORMANCE_ADMIN` |
