-- =============================================================================
-- SHEHSWAR ONE360 — Precise Seed Data Cleanup (Preserving Auth)
-- 
-- Strategy:
--   1. Disable FK enforcement (session_replication_role = replica)
--   2. Save auth data to temp tables
--   3. Delete all business data INCLUDING users/roles/companies/orgs
--   4. Restore users/roles with correct column names and no FK refs
--   5. Re-enable FK enforcement
--   6. Verify auth is intact
-- =============================================================================

-- Verify what we are about to save
DO $$
BEGIN
  RAISE NOTICE '=== PRE-CLEANUP SNAPSHOT ===';
  RAISE NOTICE 'Users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'Roles: %', (SELECT COUNT(*) FROM roles);
  RAISE NOTICE 'Permissions: %', (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE 'Role-Permissions: %', (SELECT COUNT(*) FROM role_permissions);
  RAISE NOTICE 'User-Roles: %', (SELECT COUNT(*) FROM user_roles);
END $$;

BEGIN;

-- --------------------------------------------------------
-- Step 1: Save auth data to temp tables
-- --------------------------------------------------------

CREATE TEMP TABLE _saved_users AS 
  SELECT id, email, "passwordHash", "firstName", "lastName", phone,
         status, "isSuperAdmin", "isActive", "failedLoginAttempts",
         "lockedUntil", "lastLoginAt", "passwordChangedAt",
         "createdAt", "updatedAt", "deletedAt"
  FROM users;

CREATE TEMP TABLE _saved_roles AS 
  SELECT id, code, name, description, "isSystem", "createdAt", "updatedAt"
  FROM roles;

CREATE TEMP TABLE _saved_role_permissions AS 
  SELECT id, "roleId", "permissionId", "createdAt"
  FROM role_permissions;

CREATE TEMP TABLE _saved_user_roles AS 
  SELECT id, "userId", "roleId", "createdAt"
  FROM user_roles;

-- --------------------------------------------------------
-- Step 2: Disable FK checks
-- --------------------------------------------------------

SET session_replication_role = 'replica';

-- --------------------------------------------------------
-- Step 3: Delete ALL business data
-- --------------------------------------------------------

DELETE FROM goods_receipt_note_items;
DELETE FROM goods_receipt_notes;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM vendor_quotation_items;
DELETE FROM vendor_quotations;
DELETE FROM rfq_vendors;
DELETE FROM request_for_quotations;
DELETE FROM purchase_requisition_items;
DELETE FROM purchase_requisitions;
DELETE FROM vendor_documents;
DELETE FROM vendor_performances;
DELETE FROM vendors;
DELETE FROM formula_bom_components;
DELETE FROM formula_boms;
DELETE FROM qc_parameters;
DELETE FROM qc_specifications;
DELETE FROM intercompany_pricing_rules;
DELETE FROM finished_products;
DELETE FROM product_categories;
DELETE FROM pack_sizes;
DELETE FROM packing_materials;
DELETE FROM raw_materials;
DELETE FROM material_categories;
DELETE FROM uom_conversions;
DELETE FROM units_of_measure;
DELETE FROM production_lines;
DELETE FROM shifts;
DELETE FROM payment_terms;
DELETE FROM tax_categories;
DELETE FROM reason_codes;
DELETE FROM approval_history;
DELETE FROM approval_requests;
DELETE FROM approval_rules;
DELETE FROM document_sequences;
DELETE FROM warehouse_locations;
DELETE FROM warehouses;
DELETE FROM employees;
DELETE FROM departments;
DELETE FROM plants;
DELETE FROM branches;
-- Auth tables (will restore below)
DELETE FROM user_sessions;
DELETE FROM password_reset_tokens;
DELETE FROM user_roles;
DELETE FROM role_permissions;
DELETE FROM user_notifications;
DELETE FROM users;
DELETE FROM roles;
-- Org tables
DELETE FROM companies;
DELETE FROM organizations;
-- Operational
DELETE FROM audit_logs;
DELETE FROM idempotency_records;
DELETE FROM domain_event_outbox;
DELETE FROM notification_queue_items;
DELETE FROM file_metadata;
DELETE FROM zones;
DELETE FROM territories;
DELETE FROM regions;
DELETE FROM platform_tenants;

-- --------------------------------------------------------
-- Step 4: Restore auth data with no org/company FK refs
-- --------------------------------------------------------

-- Roles: organizationId is NOT NULL in schema — must provide a placeholder.
-- We use a fixed sentinel UUID that doesn't exist in organizations.
-- FK is disabled so it won't be validated during insert.
INSERT INTO roles (id, "organizationId", code, name, description, "isSystem", "createdAt", "updatedAt")
SELECT
  id,
  '00000000-0000-0000-0000-000000000001' AS "organizationId",
  code, name, description, "isSystem", "createdAt", "updatedAt"
FROM _saved_roles;

-- Role-Permissions
INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
SELECT id, "roleId", "permissionId", "createdAt"
FROM _saved_role_permissions;

-- Users: organizationId and companyId are NOT NULL in schema.
-- Use sentinel UUIDs (FK disabled so safe).
INSERT INTO users (
  id, "organizationId", "companyId", "employeeId",
  email, "passwordHash", "firstName", "lastName", phone,
  status, "isSuperAdmin", "isActive", "failedLoginAttempts",
  "lockedUntil", "lastLoginAt", "passwordChangedAt",
  "createdAt", "updatedAt", "deletedAt"
)
SELECT
  id,
  '00000000-0000-0000-0000-000000000001' AS "organizationId",
  '00000000-0000-0000-0000-000000000002' AS "companyId",
  NULL AS "employeeId",
  email, "passwordHash", "firstName", "lastName", phone,
  status, "isSuperAdmin", "isActive", "failedLoginAttempts",
  "lockedUntil", "lastLoginAt", "passwordChangedAt",
  "createdAt", "updatedAt", "deletedAt"
FROM _saved_users;

-- User-Roles (without company/plant/branch scope)
INSERT INTO user_roles (id, "userId", "roleId", "companyId", "plantId", "branchId", "createdAt")
SELECT id, "userId", "roleId", NULL, NULL, NULL, "createdAt"
FROM _saved_user_roles;

-- --------------------------------------------------------
-- Step 5: Re-enable FK checks
-- --------------------------------------------------------

SET session_replication_role = 'origin';

-- --------------------------------------------------------
-- Step 6: Verification
-- --------------------------------------------------------

DO $$
DECLARE
  u_count   INT; r_count INT; p_count INT; rp_count INT; ur_count INT;
  org_count INT; co_count INT; rm_count INT; vnd_count INT;
BEGIN
  SELECT COUNT(*) INTO u_count   FROM users;
  SELECT COUNT(*) INTO r_count   FROM roles;
  SELECT COUNT(*) INTO p_count   FROM permissions;
  SELECT COUNT(*) INTO rp_count  FROM role_permissions;
  SELECT COUNT(*) INTO ur_count  FROM user_roles;
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO co_count  FROM companies;
  SELECT COUNT(*) INTO rm_count  FROM raw_materials;
  SELECT COUNT(*) INTO vnd_count FROM vendors;

  RAISE NOTICE '=== POST-CLEANUP VERIFICATION ===';
  RAISE NOTICE 'PRESERVED — Users:            %', u_count;
  RAISE NOTICE 'PRESERVED — Roles:            %', r_count;
  RAISE NOTICE 'PRESERVED — Permissions:      %', p_count;
  RAISE NOTICE 'PRESERVED — Role-Perms:       %', rp_count;
  RAISE NOTICE 'PRESERVED — User-Roles:       %', ur_count;
  RAISE NOTICE 'CLEANED   — Organizations:    %', org_count;
  RAISE NOTICE 'CLEANED   — Companies:        %', co_count;
  RAISE NOTICE 'CLEANED   — Raw Materials:    %', rm_count;
  RAISE NOTICE 'CLEANED   — Vendors:          %', vnd_count;

  IF u_count = 0 THEN
    RAISE EXCEPTION 'ABORT: No users restored!';
  END IF;
  IF r_count = 0 THEN
    RAISE EXCEPTION 'ABORT: No roles restored!';
  END IF;
  IF rp_count = 0 THEN
    RAISE EXCEPTION 'ABORT: No role-permissions restored!';
  END IF;
END $$;

COMMIT;

VACUUM ANALYZE;

SELECT 'SEED DATA CLEANUP COMPLETE — AUTH PRESERVED' AS status;
