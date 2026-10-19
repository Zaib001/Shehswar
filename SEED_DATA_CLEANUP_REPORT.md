# SHEHSWAR ONE360 — Seed Data Cleanup Report

**Execution Date:** 2026-09-29  
**Target Environment:** Local / Development Database (`shehswar_one360`)  
**Status:** **READY FOR MANUAL DATA CREATION**

---

## 1. Executive Summary

A complete, precise cleanup of all seeded demo and business transactional data has been successfully executed against the PostgreSQL database.
All user accounts, roles, permissions, role-permission mappings, and core authentication structures remain **100% intact and functional**. All demo business entities across Master Data, Organization Structure, Procurement, Quality Control, and Manufacturing have been purged to a clean empty state.

A full pre-cleanup database backup was generated before applying changes:
- **Backup File:** `D:\Shehswar360\shehswar_one360_pre_cleanup_backup.dump` (PostgreSQL Custom Format)

---

## 2. Tables Cleaned (Business & Demo Data Purged)

All records were truncated/deleted across the following 50+ business tables:

| Domain | Tables Cleaned | Status |
| :--- | :--- | :---: |
| **Procurement Lifecycle** | `goods_receipt_note_items`, `goods_receipt_notes`, `purchase_order_items`, `purchase_orders`, `vendor_quotation_items`, `vendor_quotations`, `rfq_vendors`, `request_for_quotations`, `purchase_requisition_items`, `purchase_requisitions`, `vendor_performances`, `vendor_documents`, `vendors` | **CLEAN (0 items)** |
| **Manufacturing & Formula** | `formula_bom_components`, `formula_boms`, `production_lines`, `shifts` | **CLEAN (0 items)** |
| **Quality Control (QC)** | `qc_parameters`, `qc_specifications` | **CLEAN (0 items)** |
| **Material & Product Masters** | `raw_materials`, `packing_materials`, `finished_products`, `material_categories`, `product_categories`, `pack_sizes`, `intercompany_pricing_rules` | **CLEAN (0 items)** |
| **Units of Measure** | `units_of_measure`, `uom_conversions` | **CLEAN (0 items)** |
| **Commercial Configuration** | `payment_terms`, `tax_categories`, `reason_codes`, `document_sequences` | **CLEAN (0 items)** |
| **Approval Workflows** | `approval_history`, `approval_requests`, `approval_rules` | **CLEAN (0 items)** |
| **Organization Structure** | `warehouse_locations`, `warehouses`, `employees`, `departments`, `plants`, `branches` | **CLEAN (0 items)** |
| **Operational & Activity Logs** | `audit_logs`, `idempotency_records`, `domain_event_outbox`, `notification_queue_items`, `user_notifications`, `file_metadata`, `zones`, `territories`, `regions`, `password_reset_tokens` | **CLEAN (0 items)** |

---

## 3. Preserved Authentication & Core System Structure

The following authentication records and baseline multi-tenant system links were preserved:

| Table | Preserved Count | Purpose / Details |
| :--- | :---: | :--- |
| `permissions` | **326** | Complete platform-wide permission matrix (CRUD, sensitive actions) |
| `roles` | **7** | Super Admin, Parent Ops, Child Sales, Procurement Mgr, Finance Mgr, Dept User, Warehouse User |
| `role_permissions` | **447** | Active role-to-permission security mappings |
| `users` | **8** | Preserved operational user accounts |
| `user_roles` | **7** | Assigned user-to-role associations |
| `platform_tenants` | **1** | System Platform Tenant (`TENANT-SHEHSWAR`) required for foreign key constraints |
| `organizations` | **1** | Baseline organization anchor (`ORG-SHEHSWAR-GRP`) for user/role multi-tenancy |
| `companies` | **1** | Baseline parent company anchor (`COMP-SHEHSWAR`) for user context resolution |

### Verified User Accounts for Testing

| Email | Role | Test Password | Access / Scope |
| :--- | :--- | :--- | :--- |
| `admin@shehswar.com` | Super Administrator | `Shehswar@2026!` | Full unrestricted system access |
| `procurement.manager@shehswar.com` | Procurement Manager | `Shehswar@2026!` | Requisitions, RFQs, POs, Vendors |
| `finance.manager@shehswar.com` | Finance Manager | `Shehswar@2026!` | Commercial approvals, costing clearance |
| `dept.user@shehswar.com` | Department User | `Shehswar@2026!` | Requisition creation |
| `warehouse.user@shehswar.com` | Warehouse User | `Shehswar@2026!` | Goods receipt (GRN) logging |

---

## 4. Runtime API & Empty State Verification

All APIs were tested with a live JWT token from `admin@shehswar.com` against the running NestJS API (`http://localhost:4000`):

| Endpoint | HTTP Status | Returned Count | Empty State Validated |
| :--- | :---: | :---: | :---: |
| `/api/v1/auth/login` | **200 OK** | Valid JWT Token Pair | Yes |
| `/api/v1/master-data/raw-materials` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/packing-materials` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/finished-products` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/uoms` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/material-categories` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/product-categories` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/pack-sizes` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/production-lines` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/shifts` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/formula-boms` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/qc-specifications` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/warehouse-locations` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/warehouses` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/plants` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/branches` | **200 OK** | 0 items | Yes |
| `/api/v1/master-data/departments` | **200 OK** | 0 items | Yes |
| `/api/v1/procurement/vendors` | **200 OK** | 0 items | Yes |
| `/api/v1/procurement/purchase-requisitions` | **200 OK** | 0 items | Yes |
| `/api/v1/procurement/purchase-orders` | **200 OK** | 0 items | Yes |
| `/api/v1/procurement/goods-receipts` | **200 OK** | 0 items | Yes |

---

## 5. Record Creation Verification

A live record creation test was executed via `POST /api/v1/master-data/material-categories`:
- **Result:** Successfully created with HTTP `201 Created`
- **Follow-up:** Test record deleted to keep database completely clean

---

## 6. System Status

The database cleanup is complete. The system is in a pristine state, authentication works seamlessly, and all views render clean empty states.

**Final Status:** **READY FOR MANUAL DATA CREATION**
