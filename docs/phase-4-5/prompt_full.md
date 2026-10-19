<USER_REQUEST>
# SHEHSWAR ONE360 ERP & CRM

# PHASE 4.5 — BUSINESS MODEL ALIGNMENT, MASTER DATA EXPANSION & FUTURE-PHASE COMPATIBILITY

## Pre-Phase-5 Structural Validation & Hardening Gate

---

# ROLE

Act as a combined:

- Principal ERP Architect
- Manufacturing ERP Domain Architect
- Senior Backend Engineer
- Senior Frontend Engineer
- PostgreSQL Data Architect
- Integration Architect
- Security/RBAC Engineer
- QA/Automation Engineer
- Data Migration Engineer

Your responsibility is to perform a **strict compatibility and business-model alignment pass** across Phases 1–4 before Phase 5 begins.

This is NOT a rebuild.

This is NOT Phase 5.

This is NOT a new operational transaction module.

The purpose is to make the existing system structurally correct for:

- Inventory
- Production
- Formula/BOM
- QC
- Packing
- Actual Costing
- Intercompany Sales
- Child Company Inventory
- Dealer Sales
- Finance
- Profit & Loss
- Consolidated Group Reporting

---

# CURRENT SYSTEM STATUS

Phases 1–4 already exist.

The system currently includes:

## Phase 1
- Architecture
- PostgreSQL
- Authentication
- RBAC foundations
- API standards
- Transactions
- Idempotency
- Event/outbox foundations
- Audit architecture
- Security architecture

## Phase 2
- Design system
- Responsive UI
- Reusable components
- Layouts
- Tables
- Forms
- Dark/light mode
- Animation foundation

## Phase 3
- Organizations
- Companies
- Plants
- Branches
- Departments
- Warehouses
- Employees
- Users
- Roles
- Permissions
- Settings
- Audit logs
- Approval engine
- Notifications
- Document numbering

## Phase 4
- Vendor Management
- Vendor Approval
- Purchase Requisition
- RFQ
- Vendor Quotations
- Quotation Comparison
- Purchase Orders
- Goods Receipt
- Vendor Performance

The system has already been connected to:

- Real local PostgreSQL
- Real NestJS APIs
- Real Next.js frontend
- Real authentication
- Real RBAC
- Real database records

Do not replace these with mocks.

---

# CRITICAL BUSINESS MODEL TO LOCK

The system must now be aligned to this exact business model.

---

# ORGANIZATION STRUCTURE

Top-level organization:

```text
Shehswar Group
```

Under the organization:

```text
Shehswar
Type: Parent / Manufacturing Company

consceptAG
Type: Child Company

Nectar
Type: Child Company

AgriventurePakistan
Type: Child Company

Excelium SEEd
Type: Child Company
```

Business hierarchy:

```text
SHEHSWAR GROUP
        ↓
SHEHSWAR
Parent / Manufacturing Company
        ↓
Manufacturing Operations
        ↓
Raw Materials
+
Packing Materials
+
Production Expenses
+
Labor
+
Utilities
+
Freight
+
QC
+
Overhead
        ↓
Finished Product
        ↓
Actual Product Cost
        ↓
Shehswar Profit / Markup
        ↓
Intercompany Selling Price
        ↓
────────────────────────────────────────
↓              ↓              ↓              ↓
consceptAG     Nectar     AgriventurePakistan     Excelium SEEd
↓              ↓              ↓              ↓
Child Company Inventory
        ↓
Dealer / Customer Sale
        ↓
Child Company Revenue
        ↓
Child Company Cost
        ↓
Child Profit / Loss
        ↓
Group Consolidated Reporting
```

This business model must become the foundation for all future development.

---

# MOST IMPORTANT BUSINESS RULE

Shehswar is the manufacturing parent.

Shehswar bears all costs required to manufacture a finished product.

Potential cost components include:

```text
Raw Material
Packing Material
Direct Labor
Electricity
Fuel
Utilities
Maintenance
QC Cost
Inbound Freight
Handling
Factory Overhead
Other Manufacturing Expenses
```

Eventually:

```text
Actual Product Cost
+
Shehswar Profit / Markup
=
Intercompany Selling Price
```

Child companies purchase from Shehswar at the **intercompany selling price**, not at Shehswar's manufacturing cost.

The child company then sells externally and earns its own margin.

---

# EXAMPLE FUTURE FLOW

Example only for architecture validation:

```text
Actual Shehswar Product Cost = 2,800

Configured Parent Markup = 20%

Parent Profit = 560

Intercompany Price = 3,360
```

Child company receives inventory cost:

```text
3,360
```

If child sells externally at:

```text
4,000
```

Child margin:

```text
640
```

Group economic margin:

```text
External Sale 4,000
-
Original Manufacturing Cost 2,800
=
1,200
```

The future consolidated system must distinguish:

- Parent company operational profit
- Child company operational profit
- Consolidated group profit
- Intercompany eliminations

Do NOT implement the complete costing or consolidation engine in Phase 4.5.

Only make the foundation compatible with it.

---

# PHASE 4.5 OBJECTIVES

Complete the following:

1. Correct company hierarchy.
2. Lock parent/child relationship architecture.
3. Expand Master Data required by future phases.
4. Retrofit Procurement line items to real material/UOM masters.
5. Remove hardcoded tax assumptions.
6. Verify GRN does not create an independent competing stock ledger.
7. Verify PO does not implement premature full financial accounting.
8. Prepare intercompany identity architecture.
9. Prepare future pricing-rule architecture.
10. Prepare future cost-component architecture.
11. Strengthen RBAC around sensitive parent cost/margin data.
12. Seed correct real business structure.
13. Maintain full real API/database integration.
14. Run full Phase 1–4 regression testing.
15. Create compatibility certification report.

---

# PART 1 — AUDIT BEFORE CHANGING ANYTHING

Before modifying code:

Perform a complete codebase and database audit.

Review:

- Prisma schema
- Existing migrations
- Seed scripts
- Phase 3 Master Data APIs
- Phase 4 Procurement APIs
- Existing company records
- Existing item fields
- Existing UOM handling
- Existing warehouse relationships
- Existing GRN behavior
- Existing PO behavior
- Existing tax handling
- Existing RBAC
- Existing approval engine
- Existing notifications
- Existing audit logs
- Existing document numbering
- Existing outbox/events
- Existing frontend navigation

Create:

```text
docs/phase-4-5/current-state-audit.md
```

Document:

- What already exists
- What can be reused
- What needs migration
- What must not be duplicated
- What must be corrected
- Which existing database records will be affected

Do not start by blindly creating duplicate tables.

---

# PART 2 — BACKUP & MIGRATION SAFETY

Before modifying the database:

Create a local PostgreSQL backup.

Document:

```text
Database name
Backup timestamp
Migration starting version
Schema version
Seed version
```

Never silently delete transactional data.

If the local database contains only development/test data, a clean rebuild may be used only if clearly documented.

Otherwise:

- migrate data
- remap foreign keys
- preserve audit trails
- preserve references
- preserve document numbers

---

# PART 3 — ORGANIZATION MASTER

Maintain one top-level organization:

```text
Shehswar Group
```

Organization represents the overall enterprise/group.

It must NOT be treated as the manufacturing company.

Required distinction:

```text
Organization = Enterprise Group
Company = Legal / Operating Entity
```

No transaction should accidentally use Organization as seller/buyer where Company is required.

---

# PART 4 — COMPANY MASTER CORRECTION

Ensure the Company entity supports:

```text
id
organizationId
companyCode
companyName
legalName
companyType
parentCompanyId
currency
financialYear
taxProfile
status
createdAt
updatedAt
```

Company type must support at least:

```text
PARENT_MANUFACTURING
CHILD_COMPANY
TRADING
DISTRIBUTION
```

Do not hardcode business behavior against names.

Forbidden:

```javascript
if (company.name === "Shehswar")
```

Correct approach:

```text
companyType
+
parentCompanyId
+
configuration
+
permissions
```

---

# PART 5 — REAL COMPANY HIERARCHY SEED

Seed/update the local database to represent:

```text
Organization:
Shehswar Group

Company 1:
Shehswar
Type: PARENT_MANUFACTURING
Parent: NULL

Company 2:
consceptAG
Type: CHILD_COMPANY
Parent: Shehswar

Company 3:
Nectar
Type: CHILD_COMPANY
Parent: Shehswar

Company 4:
AgriventurePakistan
Type: CHILD_COMPANY
Parent: Shehswar

Company 5:
Excelium SEEd
Type: CHILD_COMPANY
Parent: Shehswar
```

Use only business details actually confirmed.

Do NOT invent:

- NTN
- STRN
- addresses
- legal registrations
- bank details
- tax IDs

Unconfirmed fields should remain:

- null
- configurable
- pending configuration

Never seed fake legal information just to make a form look complete.

---

# PART 6 — COMPANY HIERARCHY API

Verify real APIs support:

```text
GET /master-data/companies

GET /master-data/companies/:id

GET /master-data/companies/:id/children

GET /master-data/companies/:id/parent
```

or equivalent architecture.

Frontend Company detail should clearly show:

```text
Company Type
Parent Company
Child Companies
Plants
Branches
Warehouses
Departments
Employees
```

---

# PART 7 — MASTER DATA NAVIGATION RESTRUCTURE

Current basic Master Data should be expanded from only organizational records.

Final recommended structure:

```text
MASTER DATA

Organization Structure
├── Organizations
├── Companies
├── Plants
├── Branches
├── Departments
├── Warehouses
└── Employees

Inventory & Item Masters
├── Units of Measure
├── UOM Conversions
├── Material Categories
├── Raw Materials
├── Packing Materials
├── Product Categories
├── Finished Products
├── Pack Sizes
└── Warehouse Locations

Manufacturing Masters
├── Production Lines
├── Shifts
├── QC Specifications
└── Formula / BOM Foundation

Commercial Configuration
├── Payment Terms
├── Tax Categories
└── Intercompany Pricing Rules

System Governance
├── Approval Rules
├── Document Numbering
└── Reason Codes
```

Keep navigation clean and grouped.

Do not place 30 unrelated items in one flat list.

---

# PART 8 — UNIT OF MEASURE MASTER

Implement a proper UOM Master.

Fields:

```text
id
code
name
category
symbol
precision
status
```

Examples:

```text
KG
TON
BAG
LITER
PIECE
PACK
```

Do not hardcode these in transactions.

---

# PART 9 — UOM CONVERSION MASTER

Create controlled conversions.

Fields:

```text
id
fromUomId
toUomId
conversionFactor
effectiveFrom
effectiveTo
status
```

Examples:

```text
1 TON = 1000 KG
```

Pack/product-specific conversions may require contextual rules.

Example:

```text
1 BAG = 50 KG
```

Do not globally assume every BAG equals 50 KG.

Where required, conversion should be linked to:

- Product
- Material
- Pack Size

---

# PART 10 — MATERIAL CATEGORY MASTER

Create Material Category.

Possible categories should be configurable.

Examples may include:

```text
Chemical Raw Material
Mineral Raw Material
Packing Material
Maintenance Material
Consumable
Spare Part
```

Do not hardcode categories into frontend code.

---

# PART 11 — RAW MATERIAL MASTER

Create full Raw Material Master.

Fields:

```text
id
organizationId
companyOwnershipMode
materialCode
materialName
categoryId
baseUomId
purchaseUomId
purchaseConversionFactor
batchControlled
expiryControlled
shelfLifeDays
qcRequired
minimumStock
maximumStock
reorderLevel
storageRequirements
standardCost
lastPurchaseCost
averageCost
status
```

Cost fields are foundations only.

Do not make manual cost fields authoritative for future actual costing.

Raw Material must support approved vendor relationships.

Future dependency:

```text
Raw Material
↓
PR
↓
RFQ
↓
Quotation
↓
PO
↓
GRN
↓
Inventory
↓
Production
```

---

# PART 12 — PACKING MATERIAL MASTER

Packing Material must be separate from Raw Material.

Support items such as:

```text
Fertilizer Bag
Printed Bag
Label
Sticker
Thread
Film
Carton
Bottle
Cap
Other Packaging
```

Fields:

```text
id
materialCode
materialName
categoryId
baseUomId
purchaseUomId
packCompatibility
batchControlled
minimumStock
maximumStock
reorderLevel
standardCost
status
```

Do not store Packing Materials as Finished Products.

Do not mix packing stock and chemical raw-material stock.

---

# PART 13 — PRODUCT CATEGORY MASTER

Create configurable Product Category.

Fields:

```text
id
code
name
description
status
```

Future finished products must reference Product Category IDs.

---

# PART 14 — FINISHED PRODUCT MASTER

Create the master structure required for future Manufacturing.

Fields:

```text
id
productCode
sku
productName
brand
categoryId
grade
fertilizerType
productForm
baseUomId
salesUomId
packSizeId
bagWeight
barcode
batchControlled
expiryControlled
shelfLifeDays
minimumStock
reorderLevel
formulaId
qcSpecificationId
standardCost
defaultSellingPrice
status
```

Important:

Do NOT build production transactions here.

This is Master Data only.

---

# PART 15 — PACK SIZE MASTER

Create Pack Size configuration.

Fields:

```text
id
code
name
quantity
uomId
status
```

Examples:

```text
5 KG
10 KG
25 KG
50 KG
1 LITER
```

Finished Products may reference allowed/default Pack Sizes.

---

# PART 16 — WAREHOUSE LOCATION MASTER

Extend Warehouse hierarchy:

```text
Warehouse
↓
Zone
↓
Rack
↓
Bin / Location
```

Fields:

```text
id
warehouseId
locationCode
locationName
parentLocationId
locationType
capacity
allowedMaterialCategory
status
```

This is foundation only.

Do not create Stock Ledger yet.

---

# PART 17 — PRODUCTION LINE MASTER

Create Production Line Master.

Fields:

```text
id
companyId
plantId
lineCode
lineName
capacity
capacityUomId
productCompatibility
status
```

Do not create Production Orders yet.

---

# PART 18 — SHIFT MASTER

Create Shift Master.

Fields:

```text
id
companyId
plantId
shiftCode
shiftName
startTime
endTime
status
```

Production will reference this later.

---

# PART 19 — QC SPECIFICATION FOUNDATION

Create QC Specification Master foundation.

Fields:

```text
id
code
name
appliesToType
rawMaterialId
productId
version
effectiveFrom
effectiveTo
status
```

Specification Parameters:

```text
parameterName
minimumValue
maximumValue
targetValue
uom
testMethod
mandatory
```

Do NOT create the complete laboratory/QC transaction engine.

That belongs to the QC phase.

---

# PART 20 — FORMULA / BOM FOUNDATION

Create Formula/BOM Master structure only if not already present.

Do not create production transactions.

Formula fields:

```text
id
formulaCode
finishedProductId
version
standardBatchSize
batchSizeUomId
effectiveFrom
effectiveTo
status
approvalStatus
```

Formula Components:

```text
componentType
rawMaterialId
packingMaterialId
quantity
uomId
expectedWastagePercent
```

Lifecycle:

```text
DRAFT
↓
PENDING_APPROVAL
↓
APPROVED
↓
ACTIVE
↓
SUPERSEDED
```

Historical formulas must never be overwritten.

Create a new version instead.

---

# PART 21 — PAYMENT TERMS MASTER

Replace hardcoded payment terms with master records.

Fields:

```text
id
code
name
days
paymentType
description
status
```

Examples:

```text
ADVANCE
CASH
15 DAYS
30 DAYS
60 DAYS
90 DAYS
CUSTOM
```

---

# PART 22 — TAX CATEGORY MASTER

Remove hardcoded tax percentage assumptions.

Create:

```text
id
companyId
code
name
rate
effectiveFrom
effectiveTo
status
```

Transactions should reference:

```text
taxCategoryId
taxRateSnapshot
```

The snapshot preserves historical accuracy.

Do NOT make old transactions change when future tax rates change.

---

# PART 23 — INTERCOMPANY PRICING RULE FOUNDATION

Create configuration foundation for future Phase 9.

Do not implement complete intercompany sales yet.

Fields:

```text
id
sourceCompanyId
targetCompanyId
productId
productCategoryId
pricingMethod
markupPercent
fixedMarkupAmount
manualApprovedPrice
effectiveFrom
effectiveTo
approvalStatus
status
```

Pricing methods:

```text
PERCENTAGE
FIXED_AMOUNT
MANUAL_APPROVED_PRICE
```

The rule may apply by:

- Product
- Product Category
- Child Company
- Effective Period

Do not place one global markup directly on Finished Product.

Example:

```text
Shehswar → Nectar = 20%

Shehswar → consceptAG = 15%
```

must be possible.

---

# PART 24 — FUTURE COST COMPONENT FOUNDATION

Do not build Actual Costing in this phase.

However, define/document a future-compatible cost-component taxonomy.

At minimum:

```text
RAW_MATERIAL
PACKING_MATERIAL
DIRECT_LABOR
ELECTRICITY
FUEL
UTILITIES
MAINTENANCE
QC_COST
INBOUND_FREIGHT
HANDLING
FACTORY_OVERHEAD
OTHER_MANUFACTURING_COST
```

Create documentation/schema foundation only as necessary.

The future formula will be:

```text
Total Batch Cost
/
Accepted Finished Quantity
=
Actual Unit Cost
```

Do NOT calculate it in Phase 4.5.

---

# PART 25 — PROCUREMENT LINE ITEM RETROFIT

Audit Phase 4 item records.

PR, RFQ, Quotation, PO, and GRN lines must reference real masters.

Required pattern:

```text
materialId
materialType
quantity
uomId
```

Relevant types:

```text
RAW_MATERIAL
PACKING_MATERIAL
SERVICE
SPARE_PART
OTHER_ALLOWED_TYPE
```

Do not use free-text item names as the authoritative identity.

Allowed:

```text
materialId = UUID
descriptionSnapshot = "Caustic Soda Flakes..."
specificationSnapshot = "..."
```

Not allowed:

```text
itemName only
```

Master ID must be authoritative.

---

# PART 26 — SNAPSHOT STRATEGY

Transactional documents must preserve historical values.

For example, Purchase Order Item may store:

```text
materialId
materialCodeSnapshot
materialNameSnapshot
uomId
uomCodeSnapshot
unitRate
taxCategoryId
taxRateSnapshot
```

This prevents old documents from changing visually when master data is renamed.

---

# PART 27 — PHASE 4 PROCUREMENT RELATIONSHIP VALIDATION

Verify entire flow still works after master retrofit:

```text
Raw Material Master
↓
Purchase Requisition
↓
Approval
↓
RFQ
↓
Vendor Quotation
↓
Quotation Comparison
↓
PO
↓
GRN
```

All must use real IDs from PostgreSQL.

No mocks.

No frontend-only relationships.

---

# PART 28 — GRN / INVENTORY BOUNDARY AUDIT

This is CRITICAL.

Phase 4 owns:

```text
Goods Receipt Documentation
Physical Receiving
PO Quantity Comparison
Receiving Status
QC Placeholder / Disposition Reference
```

Phase 5 will own:

```text
Inventory Batch/Lot
Stock Ledger
Warehouse Quantity
Available Quantity
Reserved Quantity
QC Hold Quantity
Stock Valuation
```

Verify Phase 4 is NOT maintaining its own independent permanent inventory ledger.

Correct future flow:

```text
GRN POSTED
↓
Outbox/Event
↓
goods_receipt.posted
↓
Phase 5 Inventory Handler
↓
Inventory Receipt
↓
Batch
↓
Stock Ledger
```

If Phase 4 currently changes warehouse stock directly through an ad-hoc stock implementation:

Refactor it before Phase 5.

Do not create two stock sources of truth.

---

# PART 29 — QC HOLD FUTURE BEHAVIOR

Raw Material with:

```text
qcRequired = true
```

must eventually follow:

```text
GRN
↓
QC HOLD / QUARANTINE
↓
QC Inspection
↓
PASSED / PARTIALLY_ACCEPTED / REJECTED
↓
Inventory Availability
```

Phase 4.5 should define the integration contract.

Do NOT fully implement QC release stock movement now.

---

# PART 30 — PO / FINANCE BOUNDARY AUDIT

Verify Phase 4 has not built a conflicting full accounting system.

PO approval may create:

```text
Purchase Commitment
```

but should not prematurely become the authoritative final GL posting if Finance has not yet been built.

Future finance flow:

```text
PO
↓
GRN
↓
Supplier Invoice
↓
2-way / 3-way Match
↓
Accounts Payable
↓
Payment
↓
GL
```

If current code says PO approval directly posts permanent financial ledger entries:

Document and correct the boundary.

Do not allow two future finance sources of truth.

---

# PART 31 — INTERCOMPANY TRANSACTION FOUNDATION

Prepare standard intercompany identity fields.

Future transactional records should support:

```text
isIntercompany
sourceCompanyId
targetCompanyId
intercompanyReferenceId
counterpartDocumentId
```

Do not implement complete intercompany sales yet.

Create architecture, schema support, common types, or reusable interfaces as appropriate.

Example future relationship:

```text
Shehswar Intercompany Sale
↓
IC-2026-000001
↑
Nectar Intercompany Purchase
```

Both sides must be linked to one common intercompany reference.

---

# PART 32 — CONSOLIDATION COMPATIBILITY

Every future intercompany transaction must be distinguishable from external transactions.

Why:

```text
Shehswar → Nectar
```

is internal group revenue.

It must not be treated as external revenue in consolidated group sales.

Prepare fields/data architecture required for future:

- company-level P&L
- parent profit
- child profit
- intercompany eliminations
- consolidated external sales
- consolidated group profit

Do NOT implement full consolidation now.

---

# PART 33 — SENSITIVE COST & MARGIN RBAC

Add/verify granular permissions.

At minimum prepare:

```text
VIEW_PRODUCT_COST
VIEW_PARENT_MANUFACTURING_COST
VIEW_PARENT_MARGIN
VIEW_INTERCOMPANY_PRICE
MODIFY_INTERCOMPANY_PRICE
APPROVE_INTERCOMPANY_PRICE
VIEW_CHILD_MARGIN
VIEW_CONSOLIDATED_MARGIN
```

Rules:

### Parent/Group authorized management

May see:

- Shehswar manufacturing cost
- parent margin
- intercompany price
- child performance
- consolidated performance

### Child Company ordinary users

May see:

- their intercompany purchase cost
- their inventory cost
- their own selling price
- their own margin if authorized

They must NOT automatically see:

- Shehswar internal manufacturing cost
- Shehswar internal markup
- sister-company information

Backend APIs must enforce this.

Hiding UI buttons is not sufficient.

---

# PART 34 — DATA SCOPE VALIDATION

Verify RBAC continues to enforce:

```text
Organization
Company
Plant
Branch
Department
Warehouse
Region
Zone
Territory
Module
Action
```

Examples:

```text
Nectar user
cannot access
consceptAG records
```

unless explicit Group permission exists.

Child users cannot query parent-sensitive costing records by API.

---

# PART 35 — APPROVAL ENGINE COMPATIBILITY

Do not create new standalone approval implementations.

Reuse Phase 3 approval engine.

Prepare it to support future documents:

```text
Formula Approval
Product Cost Approval
Intercompany Price Approval
Stock Adjustment Approval
Batch Release Approval
Credit Override Approval
```

Only configure foundation where required.

Do not build future operational workflows prematurely.

---

# PART 36 — DOCUMENT NUMBERING COMPATIBILITY

Reuse Phase 3 Document Numbering Service.

Ensure it can support future types:

```text
PR
RFQ
PO
GRN
STOCK_RECEIPT
STOCK_TRANSFER
PRODUCTION_ORDER
BATCH
COA
INTERCOMPANY_ORDER
INTERCOMPANY_INVOICE
SALES_ORDER
INVOICE
PAYMENT
CREDIT_NOTE
```

Do not hardcode number formats.

---

# PART 37 — REASON CODE MASTERS

Create reusable configurable reasons.

## Return Reasons
Examples:

```text
QUALITY_FAILURE
DAMAGED
WRONG_ITEM
EXCESS_DELIVERY
OTHER
```

## Adjustment Reasons

```text
PHYSICAL_COUNT_DIFFERENCE
DAMAGE
CORRECTION
LOSS
OTHER
```

## Wastage Reasons

```text
PROCESS_LOSS
SPILLAGE
PACKING_DAMAGE
REJECTION
OTHER
```

These should be configuration records, not embedded strings.

---

# PART 38 — FRONTEND MASTER DATA UX

All new Master Data pages must use the current modernized enterprise design system.

Do not create basic CRUD-looking screens.

Every List Page should include:

- Search
- Filters
- Status
- Sort
- Pagination
- Column control
- Export where applicable
- Row actions
- Loading skeleton
- Empty state
- Error state

Every Detail Page should include:

- Summary
- Status
- Related records
- Audit timeline
- Permissions-aware actions

Every Form should include:

- Clear sections
- Field validation
- Dependency-based dropdowns
- Searchable selectors
- Save/Cancel
- Approval submission where applicable

---

# PART 39 — HIERARCHICAL FORM BEHAVIOR

Forms must understand dependencies.

Example:

Select:

```text
Company = Shehswar
```

Then Plant dropdown must show only Shehswar plants.

Warehouse dropdown must show only valid warehouses.

Employee assignment must respect:

```text
Company
→ Plant/Branch
→ Department
→ Warehouse
```

Do not show unrelated records.

---

# PART 40 — PRODUCT/MATERIAL FORM UX

Raw Material and Packing Material forms should visually separate:

```text
Identity
Classification
Units
Inventory Rules
QC Rules
Purchasing Rules
Cost Reference
Status
```

Finished Product:

```text
Identity
Classification
Units & Packaging
Batch/Expiry
Technical Attributes
Formula Reference
QC Reference
Inventory Controls
Commercial References
```

---

# PART 41 — REAL API REQUIREMENT

Every new screen must be backed by real NestJS APIs.

Required pattern:

```text
Next.js Frontend
↓
Authenticated REST API
↓
Business Service
↓
Prisma
↓
PostgreSQL
```

Forbidden:

- localStorage as business database
- static JSON
- mock arrays
- frontend-generated fake IDs
- fake save-success messages

---

# PART 42 — API STANDARDS

Follow Phase 1 API standards.

Implement appropriate:

```text
GET
POST
PATCH
DELETE / archive
workflow actions
```

Maintain:

- authentication
- RBAC
- validation
- pagination
- filters
- sorting
- consistent errors
- audit
- idempotency for critical mutations

---

# PART 43 — DATABASE RULES

Follow existing database conventions.

Required:

- UUIDv7 IDs
- Foreign Keys
- Unique constraints
- Proper indexes
- organizationId/companyId where relevant
- createdAt
- updatedAt
- audit compatibility
- no floating point for money/quantity

Use existing numeric precision rules.

---

# PART 44 — DUPLICATE PREVENTION

Create appropriate unique constraints.

Examples:

```text
Company code within organization
Plant code within company
Warehouse code within company
Material code within applicable scope
SKU within applicable scope
UOM code
Pack size code
```

Do not rely only on frontend duplicate checks.

---

# PART 45 — STATUS / ARCHIVING RULES

Master records already used in transactions should generally not be hard-deleted.

Support:

```text
ACTIVE
INACTIVE
BLOCKED
ARCHIVED
```

as appropriate.

If a Raw Material is referenced by a historical PO:

Do not allow deletion that breaks history.

---

# PART 46 — AUDIT REQUIREMENT

Audit all critical Master Data changes.

Examples:

```text
Company hierarchy changed
Material UOM changed
Product status changed
Tax rate added
Intercompany price rule changed
Sensitive cost permission granted
Formula version approved
```

For sensitive data preserve:

- actor
- timestamp
- old value
- new value
- entity
- reason where applicable

---

# PART 47 — NOTIFICATION FOUNDATION

Use existing notifications when applicable.

Examples:

```text
Master approval required
Intercompany price approval required
Formula approval required
Tax configuration updated
Sensitive master modified
```

Do not create a second notification system.

---

# PART 48 — REALISTIC SEED DATA

Seed enough real-structure data to test all relationships.

At minimum:

```text
Organization
1 Shehswar Group
```

Companies:

```text
Shehswar
consceptAG
Nectar
AgriventurePakistan
Excelium SEEd
```

Create only confirmed structural data.

For technical test records:

Clearly label test entities where necessary.

Do not invent real company legal/tax facts.

---

# PART 49 — MATERIAL SEED DATA

Create a small controlled test set sufficient for workflow testing.

For example:

```text
Raw Material 1
Raw Material 2

Packing Material 1

Finished Product 1
```

These may be explicitly marked as:

```text
Development/Test Master Record
```

if the exact client's production catalog has not yet been provided.

Do not pretend they are approved real production products.

---

# PART 50 — PROCUREMENT MIGRATION TEST

Use the new masters in a real procurement flow.

Test:

```text
Department User
↓
Create PR using RawMaterial.id
↓
Approve PR
↓
Create RFQ
↓
Invite approved Vendors
↓
Create Quotations
↓
Compare
↓
Select Vendor
↓
Create PO
↓
Approve
↓
Create GRN
```

Verify IDs and relationships in PostgreSQL.

---

# PART 51 — CROSS-COMPANY SECURITY TEST

Test:

```text
User assigned to Nectar
```

Attempt:

```text
GET Shehswar confidential cost data
```

Expected:

```text
403
```

Attempt:

```text
GET consceptAG restricted records
```

Expected:

```text
403
```

unless explicit group permissions exist.

---

# PART 52 — PARENT MANAGEMENT TEST

Create/verify authorized Group Management user.

It should be able to see approved consolidated operational records according to permissions.

Do not give unrestricted access merely because user belongs to Shehswar.

Use explicit roles and scopes.

---

# PART 53 — MASTER DATA DEPENDENCY TESTS

Test:

Cannot create:

```text
Plant
```

without valid Company.

Cannot create:

```text
Warehouse Location
```

without valid Warehouse.

Cannot create:

```text
Finished Product
```

with invalid UOM.

Cannot create:

```text
PO Item
```

with deleted/inactive Material where prohibited.

Cannot create:

```text
Intercompany Pricing Rule
```

where sourceCompanyId = targetCompanyId.

---

# PART 54 — UOM TESTING

Verify:

```text
TON → KG
```

conversion.

Test decimal precision.

Test invalid conversion cycles if architecture prevents them.

Test product-specific packaging conversions.

Never silently treat all bags as the same weight.

---

# PART 55 — TAX TESTING

Verify:

Transaction stores:

```text
taxCategoryId
taxRateSnapshot
```

Change current Tax Master rate.

Verify historical PO still displays its original tax rate.

---

# PART 56 — INTERCOMPANY RULE TESTING

Create test rule:

```text
Source:
Shehswar

Target:
Nectar

Product:
Test Finished Product

Pricing Method:
PERCENTAGE

Markup:
20%
```

Confirm record can be created and approved/configured.

Do NOT create actual intercompany sale transactions yet.

---

# PART 57 — GRN BOUNDARY TEST

Create GRN.

Verify:

```text
Procurement receipt exists
```

but no competing/duplicate permanent stock ledger is created by Procurement.

Record future inventory event/integration contract.

If stock changes today through old code:

Refactor and document it.

---

# PART 58 — FINANCE BOUNDARY TEST

Approve PO.

Verify it does not create an authoritative final accounting journal if the Finance engine has not yet been formally implemented.

If an existing temporary finance record exists:

Classify/document it as:

```text
Commitment / Reference
```

not final GL unless formally designed.

---

# PART 59 — REGRESSION TESTING

Re-run all existing tests from:

```text
Phase 1
Phase 2
Phase 3
Phase 4
```

Zero regressions are required.

Test:

- authentication
- sessions
- RBAC
- company isolation
- approvals
- numbering
- audit
- notifications
- idempotency
- procurement
- GRN
- frontend build

---

# PART 60 — NEW AUTOMATED TESTS

Add tests for:

1. Parent/child hierarchy
2. Child company isolation
3. Company type rules
4. UOM conversion
5. Material master validation
6. Product master validation
7. Packing material separation
8. Warehouse location hierarchy
9. Tax snapshot
10. Procurement real Material ID usage
11. Invalid/inactive material PO protection
12. GRN inventory boundary
13. Finance boundary
14. Intercompany pricing-rule validation
15. Cost visibility permissions
16. Historical snapshot preservation
17. Duplicate-code prevention
18. Master archive safety
19. Real API behavior
20. Master Data dependency rules

---

# PART 61 — CLEAN DATABASE VALIDATION

Run a clean database validation.

Recommended process:

```text
Create empty PostgreSQL database

Run migrations

Run system seeds

Run client-structure seeds

Run development/test master seeds

Start API

Start Web

Login

Test Master Data

Test Procurement
```

Document exact results.

---

# PART 62 — FRONTEND BUILD VERIFICATION

Run:

```text
TypeScript check
Lint
Production build
```

Must complete with zero blocking errors.

---

# PART 63 — BACKEND BUILD VERIFICATION

Run:

```text
TypeScript check
Unit tests
Integration tests
Production build
```

Must pass.

---

# PART 64 — REQUIRED DOCUMENTATION

Create:

```text
docs/phase-4-5/
```

Required files:

```text
current-state-audit.md

business-model.md

company-hierarchy.md

master-data-architecture.md

uom-and-conversions.md

raw-material-master.md

packing-material-master.md

finished-product-master.md

warehouse-location-master.md

manufacturing-master-foundations.md

tax-architecture.md

procurement-master-integration.md

grn-inventory-boundary.md

finance-boundary.md

intercompany-foundation.md

intercompany-pricing-rules.md

costing-future-architecture.md

rbac-cost-visibility.md

data-migration.md

seed-strategy.md

future-phase-compatibility.md
```

---

# PART 65 — REQUIRED FINAL REPORT

Create:

```text
PHASE_4_5_COMPATIBILITY_VALIDATION_REPORT.md
```

The report must contain actual evidence.

---

# REPORT SECTION 1 — EXECUTIVE SUMMARY

State:

- What changed
- Why it changed
- What was preserved
- Whether existing functionality still works

---

# REPORT SECTION 2 — COMPANY STRUCTURE

Show actual DB hierarchy:

```text
Shehswar Group

└── Shehswar
    ├── consceptAG
    ├── Nectar
    ├── AgriventurePakistan
    └── Excelium SEEd
```

Include real database IDs/codes where appropriate in technical report.

---

# REPORT SECTION 3 — MASTER DATA COMPLETION MATRIX

Example:

| Master | DB | API | UI | Tests | Result |
|---|---|---|---|---|---|
| Organizations | ✓ | ✓ | ✓ | ✓ | PASS |
| Companies | ✓ | ✓ | ✓ | ✓ | PASS |
| UOM | ✓ | ✓ | ✓ | ✓ | PASS |
| Raw Materials | ✓ | ✓ | ✓ | ✓ | PASS |
| Packing Materials | ✓ | ✓ | ✓ | ✓ | PASS |
| Finished Products | ✓ | ✓ | ✓ | ✓ | PASS |

Continue for all relevant masters.

---

# REPORT SECTION 4 — PROCUREMENT COMPATIBILITY

Confirm:

```text
PR → Material ID
RFQ → Material ID
Quotation → Material ID
PO → Material ID
GRN → Material ID
```

Include API/database evidence.

---

# REPORT SECTION 5 — BOUNDARY VALIDATION

Explicitly report:

```text
GRN Stock Ledger Ownership:
PASS / FAIL

Finance GL Ownership:
PASS / FAIL

Production Scope Separation:
PASS / FAIL

QC Scope Separation:
PASS / FAIL
```

---

# REPORT SECTION 6 — SECURITY

Show results for:

```text
Child Company Isolation
Parent Cost Protection
Sibling Company Protection
Group Management Visibility
Sensitive Permission Enforcement
```

---

# REPORT SECTION 7 — REAL DATABASE VALIDATION

Report:

```text
Database
Migration Status
Seed Status
Record Counts
Relationship Validation
Foreign Key Validation
```

---

# REPORT SECTION 8 — TEST RESULTS

Include actual:

```text
Test Suites
Tests Passed
Tests Failed
Build Status
Lint Status
Typecheck Status
```

Do not claim PASS without actual execution.

---

# REPORT SECTION 9 — FUTURE PHASE COMPATIBILITY

Explicitly verify readiness for:

```text
Phase 5 — Inventory
Phase 6 — Production
Phase 7 — QC / Packing
Phase 8 — Actual Costing
Phase 9 — Intercompany
Phase 10 — Child Company Sales
Phase 11 — Finance
Phase 12 — Consolidated Reporting
```

For each use:

```text
READY
READY WITH DOCUMENTED DEPENDENCY
NOT READY
```

---

# DEFINITION OF DONE

Phase 4.5 is complete only when ALL of the following are true.

## Business Structure

- Shehswar Group exists as Organization
- Shehswar exists as Parent Manufacturing Company
- consceptAG exists as child
- Nectar exists as child
- AgriventurePakistan exists as child
- Excelium SEEd exists as child
- Parent relationships are stored in DB
- No company-name hardcoded business logic exists

## Master Data

- UOM exists
- UOM conversion exists
- Material Categories exist
- Raw Materials exist
- Packing Materials exist
- Product Categories exist
- Finished Products exist
- Pack Sizes exist
- Warehouse Locations exist
- Production Lines exist
- Shifts exist
- QC Specification foundation exists
- Formula/BOM foundation exists
- Payment Terms are dynamic
- Tax Categories are dynamic
- Intercompany Pricing foundation exists

## Procurement

- PR references master items
- RFQ references master items
- Quotation references master items
- PO references master items
- GRN references master items
- UOM references real IDs
- Historical snapshots are retained
- No hardcoded tax rates remain in core logic

## Architecture

- GRN has clean Phase-5 integration boundary
- Procurement does not own duplicate stock ledger
- PO does not create conflicting final finance ledger
- Intercompany identifiers are future-ready
- Consolidation architecture is documented
- Cost-component architecture is future-ready

## Security

- Parent manufacturing cost can be permission-restricted
- Parent margin can be permission-restricted
- Child company users cannot see sister-company records
- Backend enforces security
- Frontend follows backend permissions

## Engineering

- Real PostgreSQL only
- Real APIs only
- No active mocks/fallbacks
- Migrations pass
- Seeds pass
- Tests pass
- Typecheck passes
- Builds pass
- Existing Phase 1–4 functionality remains operational

---

# HARD STOP RULE

DO NOT begin Phase 5 automatically after completing this work.

First generate:

```text
PHASE_4_5_COMPATIBILITY_VALIDATION_REPORT.md
```

The report must be reviewed before Phase 5 starts.

---

# FINAL QUALITY GATE

The report must end with exactly one of:

```text
PASS
```

or:

```text
PASS WITH CORRECTIONS COMPLETED
```

or:

```text
NOT READY FOR PHASE 5
```

Do not mark PASS merely because code compiles.

PASS requires:

- Real database verification
- Real API verification
- Real hierarchy verification
- Real procurement regression verification
- Security verification
- Scope-boundary verification
- Automated test evidence

---

# FINAL TARGET ARCHITECTURE

After Phase 4.5 the platform should be structurally ready for:

```text
PHASE 1–4.5
Architecture
Design System
Core Platform
Master Data
Procurement
Business Model Alignment
        ↓
PHASE 5
Inventory & Warehouse Stock Ledger
        ↓
PHASE 6
Formula / MRP / Production
        ↓
PHASE 7
QC / Packing / Batch Release
        ↓
PHASE 8
Actual Product Costing
        ↓
PHASE 9
Shehswar Markup & Intercompany Sales
        ↓
PHASE 10
Child Company Inventory / Dealer Sales / CRM
        ↓
PHASE 11
Finance / AP / AR / Collections / P&L
        ↓
PHASE 12
Management BI / Parent / Child / Consolidated Reporting
```

The primary objective is to ensure:

**nothing implemented today forces architectural rework in future phases.**

Proceed with Phase 4.5 only.

Do not start Phase 5.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-28T13:42:48+05:00.

The user's current state is as follows:
Active Document: d:\Shehswar360\apps\web\src\components\layout\Sidebar.tsx (LANGUAGE_TSX)
Cursor is on line: 144
Other open documents:
- d:\Shehswar360\apps\web\src\components\layout\Sidebar.tsx (LANGUAGE_TSX)
- d:\Shehswar360\apps\web\src\app\page.tsx (LANGUAGE_TSX)
- d:\Shehswar360\apps\web\src\components\procurement\VendorPerformanceView.tsx (LANGUAGE_TSX)
- d:\Shehswar360\apps\api\src\procurement\purchase-order\purchase-order.controller.ts (LANGUAGE_TYPESCRIPT)
- d:\Shehswar360\apps\api\src\procurement\purchase-requisition\purchase-requisition.service.ts (LANGUAGE_TYPESCRIPT)
No browser pages are currently open.
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.8 Flash (Medium) to Claude Sonnet 4.6 (Thinking). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>