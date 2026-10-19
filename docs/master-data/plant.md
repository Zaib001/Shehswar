# Plant Management Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, a `Plant` represents a physical manufacturing, chemical synthesis, or processing facility owned by an operating company. Future production runs, chemical reactors, bills of materials (BOM), and batch records will directly anchor to a specific `Plant`.

```
Shehswar Chemicals Ltd (Parent Manufacturing)
  ├── Plant 01: Kala Shah Kaku Main Complex (Synthesis Reactors & Distillation)
  └── Plant 02: Sheikhupura Agro-Formulation Facility (Blending & Packaging)
```

---

## 2. Entity Schema & Standards

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `organizationId` | `VARCHAR(36)` | `NOT NULL, FK` | Enterprise holding scope |
| `companyId` | `VARCHAR(36)` | `NOT NULL, FK` | Parent manufacturing legal entity |
| `code` | `VARCHAR(50)` | `NOT NULL` | Factory identifier (e.g. `PLANT-KSK`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Operational plant name |
| `location` | `VARCHAR(255)` | `NOT NULL` | Geographic district / industrial zone |
| `address` | `TEXT` | `NULLABLE` | Street and survey coordinates |
| `managerName` | `VARCHAR(255)` | `NULLABLE` | Resident Plant Manager / Works Director |
| `isActive` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Operational readiness flag |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Record creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | `NOT NULL` | Last modified timestamp |

---

## 3. Future Module Dependencies

Phase 3 creates the master data foundation. The following future modules will depend on this entity:
- **Chemical Production**: Batch issuance will require a valid `plantId`. Reactor capacity limits will be enforced per plant.
- **Quality Control (QC)**: Lab tests and Certificates of Analysis (COA) link to the synthesis plant where batches are manufactured.
- **Plant Maintenance**: Work orders and equipment calibration relate directly to plant assets.

---

## 4. UI Architecture & Features

- **Plant List**: Search by plant code, facility name, or industrial location; filter by manufacturing company; display active warehouse counters.
- **Plant Detail**: Visualizes operational facility KPIs, linked raw material / finished goods warehouses, resident plant leadership, and recent audit activity.
- **Plant Form**: Responsive multi-section layout verifying mandatory location metadata, manager assignment, and unique code generation.
