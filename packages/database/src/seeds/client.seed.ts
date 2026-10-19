/**
 * SHEHSWAR ONE360 - Comprehensive Enterprise Client Bootstrap Seed
 *
 * Bootstraps the complete, realistic Shehswar Group enterprise structure:
 *  - Platform Tenant & Shehswar Group Organization
 *  - 3 Companies: Shehswar Manufacturing Ltd, Shehswar Trading Ltd, Shehswar Distribution Ltd
 *  - 3 Plants: Main Manufacturing Plant, Fertilizer Processing Plant, Packing Plant
 *  - 4 Warehouses: Raw Material, Finished Goods, Packing Material, Quarantine
 *  - 7 Departments: Procurement, Production, Quality Control, Finance, Sales, Warehouse, HR
 *  - Enterprise RBAC roles & permissions
 *  - 5 Operational Users: Super Admin, Procurement Manager, Finance Manager, Dept User, Warehouse User
 *  - 5 Vendors across all procurement categories
 *  - Complete Procurement Lifecycle: PRs, RFQ, Quotations, PO, and GRN
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedClient(prisma: PrismaClient) {
  console.log('🏢 [Client Bootstrap] Initializing Shehswar Group enterprise structure...');

  // 1. Platform Tenant
  const tenant = await prisma.platformTenant.upsert({
    where: { code: 'TENANT-SHEHSWAR' },
    update: { name: 'Shehswar Enterprise Platform Tenant' },
    create: {
      code: 'TENANT-SHEHSWAR',
      name: 'Shehswar Enterprise Platform Tenant',
      isActive: true,
    },
  });

  // 2. Organization (Shehswar Group)
  const organization = await prisma.organization.upsert({
    where: { code: 'ORG-SHEHSWAR-GRP' },
    update: {
      name: 'Shehswar Group',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      taxId: '3124567-9',
      strnId: '17-00-3124-567-99',
      address: 'Plot 45-C, Industrial Estate, Multan Road, Lahore, Pakistan',
    },
    create: {
      tenantId: tenant.id,
      code: 'ORG-SHEHSWAR-GRP',
      name: 'Shehswar Group',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      taxId: '3124567-9',
      strnId: '17-00-3124-567-99',
      address: 'Plot 45-C, Industrial Estate, Multan Road, Lahore, Pakistan',
      country: 'Pakistan',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      isActive: true,
    },
  });

  // 3. Companies — Phase 4.5 Correct Business Hierarchy
  // =========================================================
  // Business Rule: Company Type drives behavior, NOT company names
  // Parent: Shehswar (Manufacturing)
  // Children: consceptAG, Nectar, AgriventurePakistan, Excelium SEEd
  // =========================================================

  // 3A. Shehswar — Parent Manufacturing Company
  const PARENT_ID = '30872089-360b-463b-98cf-f4224862fb15';
  const mfgCompany = await prisma.company.upsert({
    where: { id: PARENT_ID },
    update: {
      code: 'COMP-SHEHSWAR',
      name: 'Shehswar Group (Parent)',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      companyType: 'PARENT_MANUFACTURING',
      isParent: true,
      parentCompanyId: null,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      id: PARENT_ID,
      organizationId: organization.id,
      code: 'COMP-SHEHSWAR',
      name: 'Shehswar Group (Parent)',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      companyType: 'PARENT_MANUFACTURING',
      isParent: true,
      parentCompanyId: null,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  // 3B. consceptAG — Child Company
  const CONCEPAG_ID = '01a13f27-c363-7ee0-b283-6867a78f3785';
  await prisma.company.upsert({
    where: { id: CONCEPAG_ID },
    update: {
      code: 'COMP-CONSCEPAG',
      name: 'consceptAG',
      legalName: 'consceptAG (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      parentCompanyId: mfgCompany.id,
      isParent: false,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      id: CONCEPAG_ID,
      organizationId: organization.id,
      code: 'COMP-CONSCEPAG',
      name: 'consceptAG',
      legalName: 'consceptAG (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: mfgCompany.id,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  // 3C. Nectar Enterprises — Child Company
  const NECTAR_ID = '01a0f18d-8a7e-73f4-9306-5d5f6e3270fa';
  await prisma.company.upsert({
    where: { id: NECTAR_ID },
    update: {
      code: 'COMP-NECTAR',
      name: 'Nectar Enterprises',
      legalName: 'Nectar Enterprises (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      parentCompanyId: mfgCompany.id,
      isParent: false,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      id: NECTAR_ID,
      organizationId: organization.id,
      code: 'COMP-NECTAR',
      name: 'Nectar Enterprises',
      legalName: 'Nectar Enterprises (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: mfgCompany.id,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  // 3D. Agriventure Pakistan — Child Company
  const AGRIVENTURE_ID = '01a13f27-c38f-7ee0-b283-7dbb26fba230';
  await prisma.company.upsert({
    where: { id: AGRIVENTURE_ID },
    update: {
      code: 'COMP-AGRIVENTURE',
      name: 'Agriventure Pakistan',
      legalName: 'Agriventure Pakistan (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      parentCompanyId: mfgCompany.id,
      isParent: false,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      id: AGRIVENTURE_ID,
      organizationId: organization.id,
      code: 'COMP-AGRIVENTURE',
      name: 'Agriventure Pakistan',
      legalName: 'Agriventure Pakistan (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: mfgCompany.id,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  // 3E. Excelium Seed — Child Company
  const EXCELIUM_ID = '01a13f27-c393-7ee0-b283-81d3762edda0';
  await prisma.company.upsert({
    where: { id: EXCELIUM_ID },
    update: {
      code: 'COMP-EXCELIUM',
      name: 'Excelium Seed',
      legalName: 'Excelium Seed (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      parentCompanyId: mfgCompany.id,
      isParent: false,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      id: EXCELIUM_ID,
      organizationId: organization.id,
      code: 'COMP-EXCELIUM',
      name: 'Excelium Seed',
      legalName: 'Excelium Seed (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: mfgCompany.id,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });

  // Use mfgCompany as the primary company for all downstream seeding


  // 4. Plants (under Shehswar Manufacturing Ltd)
  const mainPlant = await prisma.plant.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'PLANT-MFG' } },
    update: { name: 'Main Manufacturing Plant', location: 'Industrial Estate Phase 2, Multan' },
    create: {
      companyId: mfgCompany.id,
      code: 'PLANT-MFG',
      name: 'Main Manufacturing Plant',
      location: 'Industrial Estate Phase 2, Multan',
      isActive: true,
    },
  });

  await prisma.plant.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'PLANT-FERT' } },
    update: { name: 'Fertilizer Processing Plant', location: 'G.T. Road, Kala Shah Kaku, Lahore' },
    create: {
      companyId: mfgCompany.id,
      code: 'PLANT-FERT',
      name: 'Fertilizer Processing Plant',
      location: 'G.T. Road, Kala Shah Kaku, Lahore',
      isActive: true,
    },
  });

  const packPlant = await prisma.plant.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'PLANT-PACK' } },
    update: { name: 'Packing Plant', location: 'Eastern Industrial Zone, Port Qasim, Karachi' },
    create: {
      companyId: mfgCompany.id,
      code: 'PLANT-PACK',
      name: 'Packing Plant',
      location: 'Eastern Industrial Zone, Port Qasim, Karachi',
      isActive: true,
    },
  });

  // 5. Warehouses (under Shehswar Manufacturing Ltd)
  const rmWarehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'WH-RM' } },
    update: { name: 'Raw Material Warehouse', type: 'RAW_MATERIAL' },
    create: {
      companyId: mfgCompany.id,
      plantId: mainPlant.id,
      code: 'WH-RM',
      name: 'Raw Material Warehouse',
      type: 'RAW_MATERIAL',
      location: 'Bay 1-4, Multan Complex',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'WH-FG' } },
    update: { name: 'Finished Goods Warehouse', type: 'FINISHED_GOODS' },
    create: {
      companyId: mfgCompany.id,
      plantId: mainPlant.id,
      code: 'WH-FG',
      name: 'Finished Goods Warehouse',
      type: 'FINISHED_GOODS',
      location: 'Central Dispatch Hub, Multan',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'WH-PM' } },
    update: { name: 'Packing Material Warehouse', type: 'PACKING_MATERIAL' },
    create: {
      companyId: mfgCompany.id,
      plantId: packPlant.id,
      code: 'WH-PM',
      name: 'Packing Material Warehouse',
      type: 'PACKING_MATERIAL',
      location: 'Terminal Packaging Silos, Port Qasim',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: mfgCompany.id, code: 'WH-QUAR' } },
    update: { name: 'Quarantine Warehouse', type: 'QUARANTINE' },
    create: {
      companyId: mfgCompany.id,
      plantId: mainPlant.id,
      code: 'WH-QUAR',
      name: 'Quarantine Warehouse',
      type: 'QUARANTINE',
      location: 'QC Holding Yard, Multan',
      isActive: true,
    },
  });

  // 6. Departments (under Shehswar Manufacturing Ltd)
  const deptData = [
    { code: 'DEPT-PROC', name: 'Procurement', manager: 'Bilal ProcurementHead' },
    { code: 'DEPT-PROD', name: 'Production', manager: 'Kamran PlantHead' },
    { code: 'DEPT-QC', name: 'Quality Control', manager: 'Dr. Asim QCLead' },
    { code: 'DEPT-FIN', name: 'Finance', manager: 'Fariha FinanceLead' },
    { code: 'DEPT-SALES', name: 'Sales', manager: 'Tariq Salesman' },
    { code: 'DEPT-WH', name: 'Warehouse', manager: 'Waqas WarehouseDock' },
    { code: 'DEPT-HR', name: 'HR', manager: 'Zainab HRLead' },
  ];

  const depts: Record<string, any> = {};
  for (const d of deptData) {
    depts[d.code] = await prisma.department.upsert({
      where: { companyId_code: { companyId: mfgCompany.id, code: d.code } },
      update: { name: d.name, managerName: d.manager },
      create: {
        companyId: mfgCompany.id,
        code: d.code,
        name: d.name,
        managerName: d.manager,
        isActive: true,
      },
    });
  }

  // 7. Roles & Permissions
  const superAdminRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_SUPER_ADMIN' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Unrestricted system-wide access',
      isSystem: true,
    },
  });

  const procurementMgrRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_PROCUREMENT_MGR' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_PROCUREMENT_MGR',
      name: 'Procurement Manager',
      description: 'Full procurement suite: Vendors, PR, RFQ, Quotes, Comparison, PO, GRN, Performance',
      isSystem: false,
    },
  });

  const financeMgrRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_FINANCE_MGR' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_FINANCE_MGR',
      name: 'Finance Manager',
      description: 'Fiscal controls: PO approvals, vendor fiscal review, costing clearance',
      isSystem: false,
    },
  });

  const deptUserRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_DEPT_USER' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_DEPT_USER',
      name: 'Department User',
      description: 'Plant requisition requester: PR create, edit, submit, and PO status tracking',
      isSystem: false,
    },
  });

  const warehouseUserRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_WAREHOUSE_USER' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_WAREHOUSE_USER',
      name: 'Warehouse User',
      description: 'Receiving dock supervisor: Goods Receipt (GRN) logging, PO receiving progress, QC tracking',
      isSystem: false,
    },
  });

  const companyAdminRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_COMPANY_ADMIN' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_COMPANY_ADMIN',
      name: 'Company Administrator / Managing Director',
      description: 'Complete operational and governance control within assigned company entity.',
      isSystem: false,
    },
  });

  const salesOfficerRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_SALES_OFFICER' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_SALES_OFFICER',
      name: 'Sales Officer / Field Officer',
      description: 'Field execution: Dealer order booking, visit logging, territory performance',
      isSystem: false,
    },
  });

  const areaMgrRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_AREA_MANAGER' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_AREA_MANAGER',
      name: 'Area Manager',
      description: 'Zone-level management: Order approval, sales officer supervision, zone performance',
      isSystem: false,
    },
  });

  const businessMgrRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ROLE_BUSINESS_MANAGER' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_BUSINESS_MANAGER',
      name: 'Business Manager',
      description: 'Regional leadership: Commercial policy, credit approvals, regional performance',
      isSystem: false,
    },
  });

  // Assign Permissions to Roles
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    // Super Admin gets everything
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });

    // Company Admin gets all operational permissions
    if (!perm.code.startsWith('tenant:')) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: companyAdminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: companyAdminRole.id, permissionId: perm.id },
      });
    }

    // Procurement Manager
    const isProcurementPerm = [
      'vendor:', 'purchase_requisition:', 'rfq:', 'quotation:',
      'quotation_comparison:', 'purchase_order:', 'goods_receipt:',
      'vendor_performance:', 'qc_inspection:',
    ].some((p) => perm.code.startsWith(p));

    if (
      isProcurementPerm ||
      perm.code === 'approval_workflow:view' ||
      perm.code === 'approval_workflow:approve' ||
      perm.code === 'audit_log:view'
    ) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: procurementMgrRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: procurementMgrRole.id, permissionId: perm.id },
      });
    }

    // Finance Manager
    if ([
      'purchase_order:view', 'purchase_order:approve', 'purchase_order:export',
      'vendor:view', 'vendor:approve', 'quotation:view', 'quotation_comparison:view',
      'costing:view_cost', 'costing:view_margin', 'audit_log:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: financeMgrRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: financeMgrRole.id, permissionId: perm.id },
      });
    }

    // Department User
    if ([
      'purchase_requisition:create', 'purchase_requisition:view',
      'purchase_requisition:edit', 'purchase_requisition:submit',
      'purchase_order:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: deptUserRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: deptUserRole.id, permissionId: perm.id },
      });
    }

    // Warehouse User
    if ([
      'goods_receipt:create', 'goods_receipt:view', 'goods_receipt:edit',
      'goods_receipt:submit', 'purchase_order:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: warehouseUserRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: warehouseUserRole.id, permissionId: perm.id },
      });
    }

    // Sales Officer / Field Officer
    if (['dealer:view', 'dealer:create', 'dealer:edit', 'sales_order:view', 'sales_order:create', 'sales_order:edit', 'sales_order:submit'].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: salesOfficerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: salesOfficerRole.id, permissionId: perm.id },
      });
    }

    // Area Manager
    if (['dealer:view', 'dealer:create', 'dealer:edit', 'dealer:export', 'sales_order:view', 'sales_order:create', 'sales_order:edit', 'sales_order:submit', 'sales_order:approve', 'sales_order:export'].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: areaMgrRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: areaMgrRole.id, permissionId: perm.id },
      });
    }

    // Business Manager
    if (perm.code.startsWith('dealer:') || perm.code.startsWith('sales_order:') || perm.code.startsWith('customer:')) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: businessMgrRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: businessMgrRole.id, permissionId: perm.id },
      });
    }
  }

  // 8. Users (with standard password: Shehswar@2026!)
  const passwordHash = await bcrypt.hash('Shehswar@2026!', 10);

  const usersData = [
    {
      email: 'admin@shehswar.com',
      firstName: 'System',
      lastName: 'Administrator',
      role: superAdminRole,
      isSuperAdmin: true,
    },
    {
      email: 'procurement.manager@shehswar.com',
      firstName: 'Bilal',
      lastName: 'ProcurementHead',
      role: procurementMgrRole,
      isSuperAdmin: false,
    },
    {
      email: 'finance.manager@shehswar.com',
      firstName: 'Fariha',
      lastName: 'FinanceLead',
      role: financeMgrRole,
      isSuperAdmin: false,
    },
    {
      email: 'dept.user@shehswar.com',
      firstName: 'Danish',
      lastName: 'PlantRequester',
      role: deptUserRole,
      isSuperAdmin: false,
    },
    {
      email: 'warehouse.user@shehswar.com',
      firstName: 'Waqas',
      lastName: 'WarehouseDock',
      role: warehouseUserRole,
      isSuperAdmin: false,
    },
  ];

  const seededUsers: Record<string, any> = {};
  for (const u of usersData) {
    const userRecord = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        companyId: mfgCompany.id,
        organizationId: organization.id,
        passwordHash,
        isActive: true,
        firstName: u.firstName,
        lastName: u.lastName,
      },
      create: {
        organizationId: organization.id,
        companyId: mfgCompany.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isSuperAdmin: u.isSuperAdmin,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: userRecord.id, roleId: u.role.id } },
      update: {},
      create: {
        userId: userRecord.id,
        roleId: u.role.id,
        companyId: mfgCompany.id,
      },
    });

    seededUsers[u.email] = userRecord;
  }

  // 9. Realistic Vendors
  const vendorList = [
    {
      code: 'VND-001',
      name: 'Agrifert Bulk Nitrogen Corp',
      legalName: 'Agrifert Chemicals Pakistan (Pvt) Ltd',
      vendorType: 'RAW_MATERIAL',
      category: 'Fertilizer Base Chemicals',
      status: 'APPROVED',
      ntn: '3019283-4',
      strn: '1700301928314',
      city: 'Multan',
      address: 'Plot 44-B, Industrial Estate Phase 2, Multan',
      contactPerson: 'Tariq Mehmood',
      phone: '+92 61 6512901',
      email: 'sales@agrifert.com.pk',
      website: 'https://agrifert.com.pk',
      paymentTerms: '30_DAYS_CREDIT',
      creditLimit: 25000000,
      bankName: 'Habib Bank Ltd',
      bankAccountNumber: '04910293819201',
      bankIban: 'PK36HABB00004910293819201',
      rating: 4.8,
      totalOrdersCount: 28,
      totalSpendPkr: 84500000,
      onTimeDeliveryRate: 96.5,
      qualityAcceptanceRate: 99.2,
    },
    {
      code: 'VND-002',
      name: 'National Chemical Synthesis Ltd',
      legalName: 'National Chemical Synthetics PLC',
      vendorType: 'RAW_MATERIAL',
      category: 'Acids & Catalysts',
      status: 'APPROVED',
      ntn: '4910294-1',
      strn: '1700491029415',
      city: 'Karachi',
      address: 'S.I.T.E. Industrial Zone, Karachi',
      contactPerson: 'Adnan Sheikh',
      phone: '+92 21 32567890',
      email: 'corporate@nationalchem.com.pk',
      website: 'https://nationalchem.com.pk',
      paymentTerms: '15_DAYS_CREDIT',
      creditLimit: 18000000,
      bankName: 'MCB Bank Ltd',
      bankAccountNumber: '01928374650192',
      bankIban: 'PK82MUCB00001928374650192',
      rating: 4.5,
      totalOrdersCount: 16,
      totalSpendPkr: 42000000,
      onTimeDeliveryRate: 91.2,
      qualityAcceptanceRate: 97.8,
    },
    {
      code: 'VND-003',
      name: 'PolyPack Industries Ltd',
      legalName: 'PolyPack Polymer Containers Ltd',
      vendorType: 'PACKING_MATERIAL',
      category: 'Woven Bags & Liners',
      status: 'APPROVED',
      ntn: '5829102-7',
      strn: '1700582910216',
      city: 'Lahore',
      address: 'Sundar Industrial Estate, Lahore',
      contactPerson: 'Khurram Shahzad',
      phone: '+92 42 35912345',
      email: 'orders@polypack.com.pk',
      website: 'https://polypack.com.pk',
      paymentTerms: '30_DAYS_CREDIT',
      creditLimit: 8000000,
      bankName: 'Meezan Bank Ltd',
      bankAccountNumber: '02910293847561',
      bankIban: 'PK44MEZN00002910293847561',
      rating: 4.9,
      totalOrdersCount: 34,
      totalSpendPkr: 19500000,
      onTimeDeliveryRate: 98.4,
      qualityAcceptanceRate: 99.8,
    },
    {
      code: 'VND-004',
      name: 'Shehswar Logistics Fleet',
      legalName: 'Shehswar Freight & Haulage Ltd',
      vendorType: 'TRANSPORT',
      category: 'Bulk Logistics & Flatbeds',
      status: 'APPROVED',
      ntn: '6728190-3',
      strn: '1700672819017',
      city: 'Faisalabad',
      address: 'Dry Port Logistics Park, Faisalabad',
      contactPerson: 'Malik Usman',
      phone: '+92 41 87654321',
      email: 'dispatch@shehswarlogistics.com',
      paymentTerms: '15_DAYS_CREDIT',
      creditLimit: 5000000,
      bankName: 'Bank Alfalah Ltd',
      bankAccountNumber: '03829102938475',
      bankIban: 'PK55ALFH00003829102938475',
      rating: 4.6,
      totalOrdersCount: 52,
      totalSpendPkr: 14200000,
      onTimeDeliveryRate: 93.0,
      qualityAcceptanceRate: 100.0,
    },
    {
      code: 'VND-005',
      name: 'Heavy Mech Spares & Engineering',
      legalName: 'Heavy Mech Technologies Corp',
      vendorType: 'MACHINERY',
      category: 'Mechanical Seals & Impellers',
      status: 'PENDING_APPROVAL',
      ntn: '7829104-5',
      city: 'Gujranwala',
      address: 'G.T. Road Engineering Cluster, Gujranwala',
      contactPerson: 'Engr. Salman Rauf',
      phone: '+92 55 4291823',
      email: 'spares@heavymech.pk',
      paymentTerms: 'ADVANCE',
      creditLimit: 2000000,
      rating: 4.0,
      totalOrdersCount: 4,
      totalSpendPkr: 3800000,
      onTimeDeliveryRate: 88.0,
      qualityAcceptanceRate: 95.0,
    },
  ];

  const seededVendors: Record<string, any> = {};
  for (const v of vendorList) {
    const vendorRecord = await prisma.vendor.upsert({
      where: { companyId_code: { companyId: mfgCompany.id, code: v.code } },
      update: {
        name: v.name,
        legalName: v.legalName,
        status: v.status,
        rating: v.rating,
        bankDetails: v.bankName
          ? {
              bankName: v.bankName,
              bankAccountNumber: v.bankAccountNumber,
              bankIban: v.bankIban,
            }
          : undefined,
      },
      create: {
        organizationId: organization.id,
        companyId: mfgCompany.id,
        code: v.code,
        name: v.name,
        legalName: v.legalName,
        vendorType: v.vendorType,
        category: v.category,
        status: v.status,
        ntn: v.ntn,
        strn: v.strn,
        city: v.city,
        address: v.address,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        website: v.website,
        paymentTerms: v.paymentTerms,
        creditLimit: v.creditLimit,
        bankDetails: v.bankName
          ? {
              bankName: v.bankName,
              bankAccountNumber: v.bankAccountNumber,
              bankIban: v.bankIban,
            }
          : undefined,
        rating: v.rating,
      },
    });
    seededVendors[v.code] = vendorRecord;

    await prisma.vendorPerformance.upsert({
      where: {
        vendorId_companyId: {
          vendorId: vendorRecord.id,
          companyId: mfgCompany.id,
        },
      },
      update: {
        totalOrders: v.totalOrdersCount,
        completedOrders: Math.round(v.totalOrdersCount * 0.95),
        onTimeDeliveryRate: v.onTimeDeliveryRate,
        rejectionRate: Number((100 - v.qualityAcceptanceRate).toFixed(2)),
        overallRating: v.rating,
      },
      create: {
        vendorId: vendorRecord.id,
        companyId: mfgCompany.id,
        totalOrders: v.totalOrdersCount,
        completedOrders: Math.round(v.totalOrdersCount * 0.95),
        onTimeDeliveryRate: v.onTimeDeliveryRate,
        rejectionRate: Number((100 - v.qualityAcceptanceRate).toFixed(2)),
        averageLeadDays: 4.5,
        overallRating: v.rating,
        evaluationNotes: `Historical performance scorecard for ${v.name}.`,
      },
    });
  }

  // 10. Purchase Requisitions (PR)
  // PR-1: Approved Raw Materials
  const pr1 = await prisma.purchaseRequisition.upsert({
    where: { companyId_prNumber: { companyId: mfgCompany.id, prNumber: 'PR-2026-0001' } },
    update: { status: 'APPROVED' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      departmentId: depts['DEPT-PROD'].id,
      prNumber: 'PR-2026-0001',
      requestedById: seededUsers['dept.user@shehswar.com'].id,
      requestedByName: 'Danish PlantRequester',
      requiredDate: new Date('2026-10-15'),
      priority: 'HIGH',
      purpose: 'Q4 High-Yield Urea Synthesis & NPK Granulation Base Stock',
      notes: 'Required for scheduled continuous reactor run at Main Manufacturing Plant.',
      status: 'APPROVED',
      totalEstimatedAmount: 10500000,
      approvedAt: new Date(),
      approvedById: seededUsers['procurement.manager@shehswar.com'].id,
    },
  });

  // PR-1 Items
  await prisma.purchaseRequisitionItem.deleteMany({ where: { prId: pr1.id } });
  await prisma.purchaseRequisitionItem.createMany({
    data: [
      {
        prId: pr1.id,
        itemName: 'Technical Urea 46% N Prilled',
        category: 'RAW_MATERIAL',
        quantity: 50,
        unit: 'MT',
        requiredDate: new Date('2026-10-15'),
        specification: 'Biuret max 0.8%, Moisture max 0.4%, Nitrogen min 46.0%',
        estimatedRate: 140000,
        estimatedAmount: 7000000,
      },
      {
        prId: pr1.id,
        itemName: 'Diammonium Phosphate (DAP) Technical Grade',
        category: 'RAW_MATERIAL',
        quantity: 20,
        unit: 'MT',
        requiredDate: new Date('2026-10-18'),
        specification: 'P2O5 min 46.0%, Nitrogen min 18.0%, Water Soluble',
        estimatedRate: 175000,
        estimatedAmount: 3500000,
      },
    ],
  });

  // PR-2: Submitted Packing Materials
  const pr2 = await prisma.purchaseRequisition.upsert({
    where: { companyId_prNumber: { companyId: mfgCompany.id, prNumber: 'PR-2026-0002' } },
    update: { status: 'SUBMITTED' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      departmentId: depts['DEPT-PROD'].id,
      prNumber: 'PR-2026-0002',
      requestedById: seededUsers['dept.user@shehswar.com'].id,
      requestedByName: 'Danish PlantRequester',
      requiredDate: new Date('2026-10-25'),
      priority: 'NORMAL',
      purpose: '50kg Woven Polypropylene Packing Sacks (UV Resistant)',
      notes: 'Replenishment for Fertilizer Packing Line 2.',
      status: 'SUBMITTED',
      totalEstimatedAmount: 1625000,
    },
  });

  await prisma.purchaseRequisitionItem.deleteMany({ where: { prId: pr2.id } });
  await prisma.purchaseRequisitionItem.create({
    data: {
      prId: pr2.id,
      itemName: 'Polypropylene Sacks (50kg capacity, UV-coated)',
      category: 'PACKING_MATERIAL',
      quantity: 25000,
      unit: 'BAGS',
      requiredDate: new Date('2026-10-25'),
      specification: 'Double-stitched bottom, PE inner liner 50 micron, tensile strength > 850N',
      estimatedRate: 65,
      estimatedAmount: 1625000,
    },
  });

  // 11. Request For Quotation (RFQ)
  const rfq1 = await prisma.requestForQuotation.upsert({
    where: { companyId_rfqNumber: { companyId: mfgCompany.id, rfqNumber: 'RFQ-2026-0001' } },
    update: { status: 'QUOTATIONS_RECEIVED' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      rfqNumber: 'RFQ-2026-0001',
      prId: pr1.id,
      title: 'Bulk Nitrogen Fertilizer Chemicals Sourcing (50 MT Urea + 20 MT DAP)',
      issueDate: new Date('2026-09-20'),
      deadline: new Date('2026-10-05'),
      status: 'QUOTATIONS_RECEIVED',
      notes: 'Bids must include delivery to Shehswar Main Manufacturing Plant, Multan Industrial Estate.',
      createdById: seededUsers['procurement.manager@shehswar.com'].id,
    },
  });

  // Invite Vendors to RFQ
  await prisma.rfqVendor.upsert({
    where: { rfqId_vendorId: { rfqId: rfq1.id, vendorId: seededVendors['VND-001'].id } },
    update: { status: 'SUBMITTED' },
    create: {
      rfqId: rfq1.id,
      vendorId: seededVendors['VND-001'].id,
      status: 'SUBMITTED',
      notes: 'Quotation submitted on Sep 22.',
    },
  });

  await prisma.rfqVendor.upsert({
    where: { rfqId_vendorId: { rfqId: rfq1.id, vendorId: seededVendors['VND-002'].id } },
    update: { status: 'SUBMITTED' },
    create: {
      rfqId: rfq1.id,
      vendorId: seededVendors['VND-002'].id,
      status: 'SUBMITTED',
      notes: 'Quotation submitted on Sep 23.',
    },
  });

  // 12. Vendor Quotations
  // Quote 1: Agrifert Corp (Winner / Selected)
  const quote1 = await prisma.vendorQuotation.upsert({
    where: {
      rfqId_vendorId_quotationNumber: {
        rfqId: rfq1.id,
        vendorId: seededVendors['VND-001'].id,
        quotationNumber: 'AF-Q-9921',
      },
    },
    update: { status: 'SELECTED', isSelected: true },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      rfqId: rfq1.id,
      vendorId: seededVendors['VND-001'].id,
      quotationNumber: 'AF-Q-9921',
      currency: 'PKR',
      subtotal: 10300000,
      taxAmount: 1854000,
      discountAmount: 0,
      netAmount: 12154000,
      deliveryLeadDays: 5,
      paymentTerms: '30_DAYS_CREDIT',
      validityDate: new Date('2026-11-30'),
      warranty: 'Standard manufacturer certificate of analysis guarantee',
      status: 'SELECTED',
      isSelected: true,
      selectionJustification: 'Lowest compliant commercial bid with fastest 5-day delivery to Multan plant.',
      selectedAt: new Date(),
      selectedById: seededUsers['procurement.manager@shehswar.com'].id,
    },
  });

  await prisma.vendorQuotationItem.deleteMany({ where: { quotationId: quote1.id } });
  await prisma.vendorQuotationItem.createMany({
    data: [
      {
        quotationId: quote1.id,
        itemName: 'Technical Urea 46% N Prilled',
        quantity: 50,
        unit: 'MT',
        unitPrice: 138000,
        taxRate: 18,
        lineTotal: 6900000,
      },
      {
        quotationId: quote1.id,
        itemName: 'Diammonium Phosphate (DAP) Technical Grade',
        quantity: 20,
        unit: 'MT',
        unitPrice: 170000,
        taxRate: 18,
        lineTotal: 3400000,
      },
    ],
  });

  // Quote 2: National Chemical Synthesis Ltd (Rejected)
  const quote2 = await prisma.vendorQuotation.upsert({
    where: {
      rfqId_vendorId_quotationNumber: {
        rfqId: rfq1.id,
        vendorId: seededVendors['VND-002'].id,
        quotationNumber: 'NCS-2026-881',
      },
    },
    update: { status: 'REJECTED', isSelected: false },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      rfqId: rfq1.id,
      vendorId: seededVendors['VND-002'].id,
      quotationNumber: 'NCS-2026-881',
      currency: 'PKR',
      subtotal: 10810000,
      taxAmount: 1945800,
      discountAmount: 0,
      netAmount: 12755800,
      deliveryLeadDays: 12,
      paymentTerms: '15_DAYS_CREDIT',
      validityDate: new Date('2026-10-31'),
      status: 'REJECTED',
      isSelected: false,
    },
  });

  await prisma.vendorQuotationItem.deleteMany({ where: { quotationId: quote2.id } });
  await prisma.vendorQuotationItem.createMany({
    data: [
      {
        quotationId: quote2.id,
        itemName: 'Technical Urea 46% N Prilled',
        quantity: 50,
        unit: 'MT',
        unitPrice: 145000,
        taxRate: 18,
        lineTotal: 7250000,
      },
      {
        quotationId: quote2.id,
        itemName: 'Diammonium Phosphate (DAP) Technical Grade',
        quantity: 20,
        unit: 'MT',
        unitPrice: 178000,
        taxRate: 18,
        lineTotal: 3560000,
      },
    ],
  });

  // 13. Purchase Order (PO)
  const po1 = await prisma.purchaseOrder.upsert({
    where: { companyId_poNumber: { companyId: mfgCompany.id, poNumber: 'PO-2026-0001' } },
    update: { status: 'APPROVED' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      departmentId: depts['DEPT-PROC'].id,
      vendorId: seededVendors['VND-001'].id,
      warehouseId: rmWarehouse.id,
      prId: pr1.id,
      rfqId: rfq1.id,
      poNumber: 'PO-2026-0001',
      currency: 'PKR',
      paymentTerms: '30_DAYS_CREDIT',
      deliveryLocation: 'Shehswar Main Manufacturing Plant, Multan Industrial Estate',
      expectedDeliveryDate: new Date('2026-10-12'),
      subtotal: 10300000,
      taxAmount: 1854000,
      discountAmount: 0,
      totalAmount: 12154000,
      status: 'APPROVED',
      createdById: seededUsers['procurement.manager@shehswar.com'].id,
      approvedAt: new Date(),
      approvedById: seededUsers['finance.manager@shehswar.com'].id,
      notes: 'Approved under Annual Raw Material Procurement Allocation FY2026.',
    },
  });

  await prisma.purchaseOrderItem.deleteMany({ where: { poId: po1.id } });
  await prisma.purchaseOrderItem.createMany({
    data: [
      {
        poId: po1.id,
        itemName: 'Technical Urea 46% N Prilled',
        category: 'RAW_MATERIAL',
        quantity: 50,
        unit: 'MT',
        unitRate: 138000,
        taxRate: 18,
        taxAmount: 1242000,
        discountRate: 0,
        discountAmount: 0,
        lineTotal: 8142000,
        receivedQuantity: 30, // 30 MT received via GRN-1
      },
      {
        poId: po1.id,
        itemName: 'Diammonium Phosphate (DAP) Technical Grade',
        category: 'RAW_MATERIAL',
        quantity: 20,
        unit: 'MT',
        unitRate: 170000,
        taxRate: 18,
        taxAmount: 612000,
        discountRate: 0,
        discountAmount: 0,
        lineTotal: 4012000,
        receivedQuantity: 0, // Pending delivery
      },
    ],
  });

  const createdPoItem1 = await prisma.purchaseOrderItem.findFirst({
    where: { poId: po1.id, itemName: 'Technical Urea 46% N Prilled' },
  });

  // 14. Goods Receipt Note (GRN)
  const grn1 = await prisma.goodsReceiptNote.upsert({
    where: { companyId_grnNumber: { companyId: mfgCompany.id, grnNumber: 'GRN-2026-0001' } },
    update: { status: 'ACCEPTED', qcStatus: 'PASSED' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      poId: po1.id,
      vendorId: seededVendors['VND-001'].id,
      warehouseId: rmWarehouse.id,
      grnNumber: 'GRN-2026-0001',
      receivedDate: new Date(),
      receivedById: seededUsers['warehouse.user@shehswar.com'].id,
      receivedByName: 'Waqas WarehouseDock',
      carrierName: 'National Freight Haulage',
      vehicleNumber: 'TL-4492-MLT',
      deliveryNoteNumber: 'DN-88201',
      status: 'ACCEPTED',
      qcStatus: 'PASSED',
      qcNotes: 'Nitrogen assay confirmed at 46.2% purity via lab titrimetry. Free moisture 0.32%. Physical packaging intact.',
      notes: 'Initial consignment of 30 MT received at Raw Materials Silo Dock 1.',
    },
  });

  if (createdPoItem1) {
    await prisma.goodsReceiptNoteItem.deleteMany({ where: { grnId: grn1.id } });
    await prisma.goodsReceiptNoteItem.create({
      data: {
        grnId: grn1.id,
        poItemId: createdPoItem1.id,
        itemName: 'Technical Urea 46% N Prilled',
        orderedQuantity: 50,
        receivedQuantity: 30,
        acceptedQuantity: 30,
        rejectedQuantity: 0,
        unit: 'MT',
        packageCondition: 'INTACT',
        notes: 'Silo Bay 2 unloaded successfully.',
      },
    });
  }

  // 15. Default Document Numbering Sequences
  const docTypes = ['PO', 'SO', 'GRN', 'PR', 'RFQ', 'INVOICE', 'BATCH'];
  const fiscalYear = 2026;
  for (const docType of docTypes) {
    await prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: mfgCompany.id,
          documentType: docType,
          fiscalYear,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        companyId: mfgCompany.id,
        documentType: docType,
        fiscalYear,
        prefix: `SH-${docType}-${fiscalYear}`,
        currentNumber: BigInt(1),
      },
    });
  }

  console.log('✓ [Client Bootstrap] Full Shehswar Group enterprise & procurement data seeded successfully.');

  // ==========================================
  // PHASE 4.5 — MASTER DATA FOUNDATION SEED
  // ==========================================

  // A. Unit of Measure Master
  console.log('  → Seeding UOM Master...');
  const uomData = [
    { code: 'KG', name: 'Kilogram', category: 'WEIGHT', symbol: 'kg', decimalPlaces: 3, isBaseUnit: true },
    { code: 'TON', name: 'Metric Ton', category: 'WEIGHT', symbol: 'MT', decimalPlaces: 3, isBaseUnit: false },
    { code: 'G', name: 'Gram', category: 'WEIGHT', symbol: 'g', decimalPlaces: 3, isBaseUnit: false },
    { code: 'LB', name: 'Pound', category: 'WEIGHT', symbol: 'lb', decimalPlaces: 3, isBaseUnit: false },
    { code: 'LITER', name: 'Liter', category: 'VOLUME', symbol: 'L', decimalPlaces: 3, isBaseUnit: true },
    { code: 'ML', name: 'Milliliter', category: 'VOLUME', symbol: 'mL', decimalPlaces: 0, isBaseUnit: false },
    { code: 'DRUM', name: 'Drum', category: 'VOLUME', symbol: 'DRM', decimalPlaces: 0, isBaseUnit: false },
    { code: 'PIECE', name: 'Piece', category: 'COUNT', symbol: 'PC', decimalPlaces: 0, isBaseUnit: true },
    { code: 'BAG', name: 'Bag', category: 'COUNT', symbol: 'BAG', decimalPlaces: 0, isBaseUnit: false },
    { code: 'PACK', name: 'Pack', category: 'COUNT', symbol: 'PK', decimalPlaces: 0, isBaseUnit: false },
    { code: 'BUNDLE', name: 'Bundle', category: 'COUNT', symbol: 'BDL', decimalPlaces: 0, isBaseUnit: false },
    { code: 'MTR', name: 'Meter', category: 'LENGTH', symbol: 'm', decimalPlaces: 2, isBaseUnit: true },
  ];

  const createdUoms: Record<string, string> = {};
  for (const uom of uomData) {
    const created = await prisma.unitOfMeasure.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: uom.code } },
      update: { name: uom.name, category: uom.category, symbol: uom.symbol, isBaseUnit: uom.isBaseUnit },
      create: {
        organizationId: organization.id,
        ...uom,
        status: 'ACTIVE',
      },
    });
    createdUoms[uom.code] = created.id;
  }

  // UOM Conversions (standard)
  await prisma.uomConversion.upsert({
    where: { id: '00000000-0001-0001-0001-000000000001' },
    update: { conversionFactor: 1000 },
    create: {
      id: '00000000-0001-0001-0001-000000000001',
      organizationId: organization.id,
      fromUomId: createdUoms['TON']!,
      toUomId: createdUoms['KG']!,
      conversionFactor: 1000,
    },
  }).catch(() => {/* ignore duplicate */});

  // B. Material Categories
  console.log('  → Seeding Material Categories...');
  const materialCategories = [
    { code: 'CHEM-RAW', name: 'Chemical Raw Material', description: 'Chemical inputs for fertilizer production' },
    { code: 'MINERAL', name: 'Mineral Input', description: 'Mineral-based raw materials' },
    { code: 'PACKING', name: 'Packing Material', description: 'Bags, wrapping, labeling materials' },
    { code: 'CONSUMABLE', name: 'Consumable', description: 'Day-to-day operational consumables' },
    { code: 'SPARE-PART', name: 'Spare Part', description: 'Machine spare parts and maintenance items' },
    { code: 'FERTILIZER', name: 'Fertilizer Input', description: 'Direct fertilizer raw material inputs' },
    { code: 'ADDITIVE', name: 'Additive / Coating', description: 'Production additives and coating agents' },
  ];

  for (const cat of materialCategories) {
    await prisma.materialCategory.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: cat.code } },
      update: { name: cat.name },
      create: { organizationId: organization.id, ...cat, status: 'ACTIVE' },
    });
  }

  // C. Product Categories
  console.log('  → Seeding Product Categories...');
  const productCategories = [
    { code: 'FERTILIZER', name: 'Fertilizer', description: 'All fertilizer finished products' },
    { code: 'AGRI-CHEM', name: 'Agricultural Chemical', description: 'Agricultural chemical products' },
    { code: 'MICRONUTRIENT', name: 'Micronutrient', description: 'Micronutrient products' },
    { code: 'SEED', name: 'Seed', description: 'Seed products' },
  ];

  for (const cat of productCategories) {
    await (prisma as any).productCategory.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: cat.code } },
      update: { name: cat.name },
      create: { organizationId: organization.id, ...cat, status: 'ACTIVE' },
    }).catch(() => {/* skip if model not yet accessible */});
  }

  // D. Payment Terms (for all active companies)
  console.log('  → Seeding Payment Terms...');
  const paymentTermsData = [
    { code: 'ADVANCE', name: 'Advance Payment', days: 0, paymentType: 'ADVANCE', description: '100% payment before delivery' },
    { code: 'CASH', name: 'Cash on Delivery', days: 0, paymentType: 'CASH', description: 'Payment at time of delivery' },
    { code: 'NET_15', name: 'Net 15 Days', days: 15, paymentType: 'CREDIT', description: '15 days credit from invoice date' },
    { code: 'NET_30', name: 'Net 30 Days', days: 30, paymentType: 'CREDIT', description: '30 days credit from invoice date' },
    { code: 'NET_45', name: 'Net 45 Days', days: 45, paymentType: 'CREDIT', description: '45 days credit from invoice date' },
    { code: 'NET_60', name: 'Net 60 Days', days: 60, paymentType: 'CREDIT', description: '60 days credit from invoice date' },
    { code: 'NET_90', name: 'Net 90 Days', days: 90, paymentType: 'CREDIT', description: '90 days credit from invoice date' },
  ];

  for (const pt of paymentTermsData) {
    await prisma.paymentTerm.upsert({
      where: { companyId_code: { companyId: mfgCompany.id, code: pt.code } },
      update: { name: pt.name, days: pt.days },
      create: { companyId: mfgCompany.id, ...pt, status: 'ACTIVE' },
    });
  }

  // E. Tax Categories
  console.log('  → Seeding Tax Categories...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taxCategoriesData = [
    { code: 'EXEMPT', name: 'Tax Exempt', rate: 0, description: 'Zero tax - exempt supplies' },
    { code: 'GST_17', name: 'GST @ 17%', rate: 17, description: 'Standard GST 17% (Pakistan)' },
    { code: 'GST_5', name: 'GST @ 5%', rate: 5, description: 'Reduced GST 5%' },
    { code: 'ZERO_RATED', name: 'Zero Rated GST', rate: 0, description: 'Zero rated for exports' },
  ];

  for (const tc of taxCategoriesData) {
    await prisma.taxCategory.upsert({
      where: { companyId_code_effectiveFrom: { companyId: mfgCompany.id, code: tc.code, effectiveFrom: today } },
      update: { name: tc.name, rate: tc.rate },
      create: { companyId: mfgCompany.id, ...tc, effectiveFrom: today, status: 'ACTIVE' },
    });
  }

  // F. Pack Sizes
  console.log('  → Seeding Pack Sizes...');
  const packSizesData = [
    { code: '50KG', name: '50 KG Bag', quantity: 50 },
    { code: '25KG', name: '25 KG Bag', quantity: 25 },
    { code: '10KG', name: '10 KG Bag', quantity: 10 },
    { code: '5KG', name: '5 KG Bag', quantity: 5 },
    { code: '1KG', name: '1 KG Bag', quantity: 1 },
    { code: '20L', name: '20 Liter Drum', quantity: 20 },
    { code: '200L', name: '200 Liter Barrel', quantity: 200 },
    { code: '1TON', name: '1 Ton Jumbo Bag', quantity: 1000 },
  ];

  for (const ps of packSizesData) {
    await prisma.packSize.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: ps.code } },
      update: { name: ps.name },
      create: {
        organizationId: organization.id,
        uomId: ps.code.includes('L') ? createdUoms['LITER'] : createdUoms['KG'],
        ...ps,
        status: 'ACTIVE',
      },
    });
  }

  // G. Reason Codes
  console.log('  → Seeding Reason Codes...');
  const reasonCodes = [
    { category: 'REJECTION', code: 'QC-FAIL', name: 'QC Inspection Failed' },
    { category: 'REJECTION', code: 'WRONG-SPEC', name: 'Wrong Specification Delivered' },
    { category: 'REJECTION', code: 'DAMAGED', name: 'Material Damaged in Transit' },
    { category: 'REJECTION', code: 'EXPIRED', name: 'Expired / Near-Expiry' },
    { category: 'WASTAGE', code: 'PROCESS-WASTE', name: 'Process Wastage (Normal)' },
    { category: 'WASTAGE', code: 'SPILLAGE', name: 'Material Spillage' },
    { category: 'ADJUSTMENT', code: 'STOCK-COUNT-ADJ', name: 'Stock Count Adjustment' },
    { category: 'RETURN', code: 'VENDOR-RETURN', name: 'Returned to Vendor' },
    { category: 'RETURN', code: 'CUSTOMER-RETURN', name: 'Customer Return (Defective)' },
    { category: 'OTHER', code: 'GENERAL', name: 'General / Other' },
  ];

  for (const rc of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { organizationId_category_code: { organizationId: organization.id, category: rc.category, code: rc.code } },
      update: { name: rc.name },
      create: { organizationId: organization.id, ...rc, isActive: true },
    });
  }

  // H. Shifts (for Manufacturing Plant)
  console.log('  → Seeding Shift Master...');
  const shiftsData = [
    { shiftCode: 'A', shiftName: 'Morning Shift (A)', startTime: '06:00', endTime: '14:00' },
    { shiftCode: 'B', shiftName: 'Evening Shift (B)', startTime: '14:00', endTime: '22:00' },
    { shiftCode: 'C', shiftName: 'Night Shift (C)', startTime: '22:00', endTime: '06:00' },
    { shiftCode: 'GEN', shiftName: 'General Shift', startTime: '08:00', endTime: '17:00' },
  ];

  for (const sh of shiftsData) {
    await prisma.shift.upsert({
      where: { companyId_shiftCode: { companyId: mfgCompany.id, shiftCode: sh.shiftCode } },
      update: { shiftName: sh.shiftName },
      create: { companyId: mfgCompany.id, plantId: mainPlant.id, ...sh, status: 'ACTIVE' },
    });
  }

  // I. Warehouse Locations (Zone hierarchy for main warehouse)
  console.log('  → Seeding Warehouse Location Zones...');
  const zoneData = [
    { locationCode: 'RM-ZONE', locationName: 'Raw Material Storage Zone', locationType: 'ZONE' },
    { locationCode: 'FG-ZONE', locationName: 'Finished Goods Zone', locationType: 'ZONE' },
    { locationCode: 'PM-ZONE', locationName: 'Packing Material Zone', locationType: 'ZONE' },
    { locationCode: 'QC-ZONE', locationName: 'QC Quarantine Zone', locationType: 'ZONE' },
    { locationCode: 'RETURN-ZONE', locationName: 'Returns & Rejection Zone', locationType: 'ZONE' },
  ];

  for (const zone of zoneData) {
    await prisma.warehouseLocation.upsert({
      where: { warehouseId_locationCode: { warehouseId: rmWarehouse.id, locationCode: zone.locationCode } },
      update: { locationName: zone.locationName },
      create: {
        warehouseId: rmWarehouse.id,
        ...zone,
        status: 'ACTIVE',
      },
    });
  }

  // J. Production Lines
  console.log('  → Seeding Production Lines...');
  await prisma.productionLine.upsert({
    where: { companyId_lineCode: { companyId: mfgCompany.id, lineCode: 'LINE-GRAN-01' } },
    update: { lineName: 'Fertilizer Granulation Line 1', capacity: 200 },
    create: {
      companyId: mfgCompany.id,
      plantId: mainPlant.id,
      lineCode: 'LINE-GRAN-01',
      lineName: 'Fertilizer Granulation Line 1',
      capacity: 200,
      capacityUomId: createdUoms['TON'],
      status: 'ACTIVE',
    },
  });

  // K. Raw Materials (Controlled Test Master Records - Part 49)
  console.log('  → Seeding Raw Materials...');
  const chemCategory = await prisma.materialCategory.findFirst({
    where: { organizationId: organization.id, code: 'CHEM-RAW' },
  });

  const rawMatUrea = await prisma.rawMaterial.upsert({
    where: { companyId_materialCode: { companyId: mfgCompany.id, materialCode: 'RM-UREA-46' } },
    update: { materialName: 'Technical Urea 46% N Prilled', standardCost: 135000, lastPurchaseCost: 138000 },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      categoryId: chemCategory?.id,
      baseUomId: createdUoms['TON'],
      purchaseUomId: createdUoms['TON'],
      materialCode: 'RM-UREA-46',
      materialName: 'Technical Urea 46% N Prilled',
      description: 'High purity prilled technical urea 46% Nitrogen content (Development/Test Master Record)',
      purchaseConversionFactor: 1,
      batchControlled: true,
      expiryControlled: false,
      qcRequired: true,
      minimumStock: 100,
      maximumStock: 1000,
      reorderLevel: 250,
      storageRequirements: 'Dry bulk silo / covered warehouse',
      standardCost: 135000,
      lastPurchaseCost: 138000,
      averageCost: 136500,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  const rawMatDap = await prisma.rawMaterial.upsert({
    where: { companyId_materialCode: { companyId: mfgCompany.id, materialCode: 'RM-DAP-TECH' } },
    update: { materialName: 'Diammonium Phosphate (DAP) Technical Grade', standardCost: 168000, lastPurchaseCost: 170000 },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      categoryId: chemCategory?.id,
      baseUomId: createdUoms['TON'],
      purchaseUomId: createdUoms['TON'],
      materialCode: 'RM-DAP-TECH',
      materialName: 'Diammonium Phosphate (DAP) Technical Grade',
      description: 'Technical grade DAP for compound fertilizer formulation (Development/Test Master Record)',
      purchaseConversionFactor: 1,
      batchControlled: true,
      expiryControlled: false,
      qcRequired: true,
      minimumStock: 50,
      maximumStock: 500,
      reorderLevel: 100,
      storageRequirements: 'Moisture-free silo bay',
      standardCost: 168000,
      lastPurchaseCost: 170000,
      averageCost: 169000,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  // L. Packing Materials (Controlled Test Master Records - Part 49)
  console.log('  → Seeding Packing Materials...');
  const packCategory = await prisma.materialCategory.findFirst({
    where: { organizationId: organization.id, code: 'PACKING' },
  });

  const packMatBag = await prisma.packingMaterial.upsert({
    where: { companyId_materialCode: { companyId: mfgCompany.id, materialCode: 'PM-BAG-50KG' } },
    update: { materialName: '50kg Printed PP Woven Bag with Inner Liner', standardCost: 85, lastPurchaseCost: 88 },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      categoryId: packCategory?.id,
      baseUomId: createdUoms['BAG'],
      purchaseUomId: createdUoms['BAG'],
      materialCode: 'PM-BAG-50KG',
      materialName: '50kg Printed PP Woven Bag with Inner Liner',
      description: 'Heavy duty polypropylene woven bag with laminated PE inner liner (Development/Test Master Record)',
      packCompatibility: '50KG fertilizer bags',
      batchControlled: true,
      minimumStock: 5000,
      maximumStock: 50000,
      reorderLevel: 10000,
      standardCost: 85,
      lastPurchaseCost: 88,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  // M. Finished Products (Controlled Test Master Records - Part 49)
  console.log('  → Seeding Finished Products...');
  const fertCategory = await prisma.productCategory.findFirst({
    where: { organizationId: organization.id, code: 'FERTILIZER' },
  });
  const bag50kgPack = await prisma.packSize.findFirst({
    where: { organizationId: organization.id, code: '50KG' },
  });

  const finishedProdNpk = await prisma.finishedProduct.upsert({
    where: { companyId_productCode: { companyId: mfgCompany.id, productCode: 'FP-NPK-151515' } },
    update: { productName: 'NPK 15-15-15 Compound Fertilizer', defaultSellingPrice: 5200 },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      categoryId: fertCategory?.id,
      packSizeId: bag50kgPack?.id,
      baseUomId: createdUoms['BAG'],
      salesUomId: createdUoms['BAG'],
      productCode: 'FP-NPK-151515',
      sku: 'SKU-NPK-50KG',
      productName: 'NPK 15-15-15 Compound Fertilizer',
      brand: 'Shehswar Gold',
      grade: 'Premium',
      fertilizerType: 'NPK Compound',
      productForm: 'GRANULAR',
      bagWeight: 50,
      batchControlled: true,
      expiryControlled: false,
      minimumStock: 200,
      reorderLevel: 500,
      standardCost: 3800,
      defaultSellingPrice: 5200,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  // N. QC Specification Foundation (Part 19)
  console.log('  → Seeding QC Specification Foundation...');
  const qcUrea = await prisma.qcSpecification.upsert({
    where: { companyId_code_version: { companyId: mfgCompany.id, code: 'QC-SPEC-UREA-46', version: 1 } },
    update: { name: 'Technical Urea 46% Quality Specification' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      code: 'QC-SPEC-UREA-46',
      name: 'Technical Urea 46% Quality Specification',
      appliesToType: 'RAW_MATERIAL',
      rawMaterialId: rawMatUrea.id,
      version: 1,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  await prisma.qcParameter.deleteMany({ where: { specificationId: qcUrea.id } });
  await prisma.qcParameter.createMany({
    data: [
      { specificationId: qcUrea.id, parameterName: 'Nitrogen Content (N)', minimumValue: 46.0, maximumValue: 46.8, targetValue: 46.2, uom: '%', testMethod: 'Kjeldahl Method', mandatory: true, sortOrder: 1 },
      { specificationId: qcUrea.id, parameterName: 'Moisture (Free Water)', minimumValue: 0.0, maximumValue: 0.5, targetValue: 0.25, uom: '%', testMethod: 'Oven Drying 105C', mandatory: true, sortOrder: 2 },
      { specificationId: qcUrea.id, parameterName: 'Biuret Content', minimumValue: 0.0, maximumValue: 1.0, targetValue: 0.8, uom: '%', testMethod: 'Spectrophotometric', mandatory: true, sortOrder: 3 },
    ],
  });

  // O. Formula / BOM Foundation (Part 20)
  console.log('  → Seeding Formula / BOM Foundation...');
  const bomNpk = await prisma.formulaBom.upsert({
    where: { companyId_formulaCode_version: { companyId: mfgCompany.id, formulaCode: 'BOM-NPK-151515', version: 1 } },
    update: { notes: 'Standard 1 Metric Ton Formulation Batch' },
    create: {
      organizationId: organization.id,
      companyId: mfgCompany.id,
      finishedProductId: finishedProdNpk.id,
      formulaCode: 'BOM-NPK-151515',
      version: 1,
      standardBatchSize: 1, // 1 Ton = 20 bags of 50kg
      batchSizeUomId: createdUoms['TON'],
      notes: 'Standard 1 Metric Ton Formulation Batch for 20x 50kg Bags',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  await prisma.formulaBomComponent.deleteMany({ where: { formulaId: bomNpk.id } });
  await prisma.formulaBomComponent.createMany({
    data: [
      { formulaId: bomNpk.id, componentType: 'RAW_MATERIAL', rawMaterialId: rawMatUrea.id, quantity: 0.326, uomId: createdUoms['TON'], expectedWastagePercent: 1.5, notes: 'Urea for 15% Nitrogen', sortOrder: 1 },
      { formulaId: bomNpk.id, componentType: 'RAW_MATERIAL', rawMaterialId: rawMatDap.id, quantity: 0.326, uomId: createdUoms['TON'], expectedWastagePercent: 1.5, notes: 'DAP for 15% P2O5', sortOrder: 2 },
      { formulaId: bomNpk.id, componentType: 'PACKING_MATERIAL', packingMaterialId: packMatBag.id, quantity: 20, uomId: createdUoms['BAG'], expectedWastagePercent: 0.5, notes: '20 Bags per Metric Ton', sortOrder: 3 },
    ],
  });

  // P. Intercompany Pricing Rule (Part 23)
  console.log('  → Seeding Intercompany Pricing Rules...');
  const childConscept = await prisma.company.findFirst({
    where: { organizationId: organization.id, code: 'COMP-CONCEPTAG' },
  });

  if (childConscept) {
    await prisma.intercompanyPricingRule.upsert({
      where: { id: '00000000-0002-0001-0001-000000000001' },
      update: { markupPercent: 15.0 },
      create: {
        id: '00000000-0002-0001-0001-000000000001',
        organizationId: organization.id,
        sourceCompanyId: mfgCompany.id,
        targetCompanyId: childConscept.id,
        finishedProductId: finishedProdNpk.id,
        pricingMethod: 'PERCENTAGE',
        markupPercent: 15.0, // 15% markup over standard manufacturing cost
        approvalStatus: 'APPROVED',
        notes: 'Shehswar Parent to consceptAG standard transfer markup 15%',
        status: 'ACTIVE',
      },
    });
  }

  // Q. Retrofit Seed Procurement Line Items with Material FK and Snapshots (Part 25 & 26)
  console.log('  → Retrofitting Seed Procurement Items with Material Master linkage & snapshots...');
  const gst17 = await prisma.taxCategory.findFirst({
    where: { companyId: mfgCompany.id, code: 'GST_17' },
  });

  // Retrofit PO Items
  await prisma.purchaseOrderItem.updateMany({
    where: { poId: po1.id, itemName: 'Technical Urea 46% N Prilled' },
    data: {
      materialId: rawMatUrea.id,
      materialType: 'RAW_MATERIAL',
      uomId: createdUoms['TON'],
      taxCategoryId: gst17?.id,
      materialCodeSnapshot: rawMatUrea.materialCode,
      materialNameSnapshot: rawMatUrea.materialName,
      uomCodeSnapshot: 'TON',
      taxRateSnapshot: 18.0,
      specificationSnapshot: 'Nitrogen minimum 46.0%, Moisture maximum 0.5%',
    },
  });

  await prisma.purchaseOrderItem.updateMany({
    where: { poId: po1.id, itemName: 'Diammonium Phosphate (DAP) Technical Grade' },
    data: {
      materialId: rawMatDap.id,
      materialType: 'RAW_MATERIAL',
      uomId: createdUoms['TON'],
      taxCategoryId: gst17?.id,
      materialCodeSnapshot: rawMatDap.materialCode,
      materialNameSnapshot: rawMatDap.materialName,
      uomCodeSnapshot: 'TON',
      taxRateSnapshot: 18.0,
      specificationSnapshot: 'Technical grade DAP for fertilizer formulation',
    },
  });

  // Retrofit GRN Items
  await prisma.goodsReceiptNoteItem.updateMany({
    where: { grnId: grn1.id, itemName: 'Technical Urea 46% N Prilled' },
    data: {
      materialId: rawMatUrea.id,
      materialType: 'RAW_MATERIAL',
      uomId: createdUoms['TON'],
      materialCodeSnapshot: rawMatUrea.materialCode,
      materialNameSnapshot: rawMatUrea.materialName,
      uomCodeSnapshot: 'TON',
    },
  });

  console.log('✓ [Phase 4.5] All Expanded Masters & Procurement Retrofits successfully seeded.');
}

// Standalone runner
if (require.main === module) {
  const prisma = new PrismaClient();
  seedClient(prisma)
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
