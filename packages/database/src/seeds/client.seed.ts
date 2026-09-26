/**
 * SHEHSWAR ONE360 - Client Bootstrap Seed (Shehswar Group Customer Account)
 *
 * Bootstraps the enterprise customer account:
 *  - Platform Tenant & Shehswar Group Organization
 *  - Parent manufacturing company & Child distribution company
 *  - Core manufacturing plant and inventory warehouses
 *  - Enterprise RBAC roles and permissions mapping
 *  - Initial System Administrator account
 *  - Document numbering sequences
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedClient(prisma: PrismaClient) {
  console.log('🏢 [Client Bootstrap] Initializing Shehswar Group enterprise structure...');

  // 1. Platform Tenant
  const tenant = await prisma.platformTenant.upsert({
    where: { code: 'TENANT-SHEHSWAR' },
    update: {},
    create: {
      code: 'TENANT-SHEHSWAR',
      name: 'Shehswar Enterprise Platform Tenant',
      isActive: true,
    },
  });

  // 2. Organization (Shehswar Group)
  const organization = await prisma.organization.upsert({
    where: { code: 'ORG-SHEHSWAR-GRP' },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'ORG-SHEHSWAR-GRP',
      name: 'Shehswar Group of Companies',
      isActive: true,
    },
  });

  // 3. Parent Manufacturing Company
  const parentCompany = await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-PARENT',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'COMP-PARENT',
      name: 'Shehswar Industries (Parent Manufacturing Co)',
      isParent: true,
      currencyCode: 'PKR',
      taxId: 'NTN-1234567-8',
      isActive: true,
    },
  });

  // 4. Child Distribution Company
  await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-CHILD-DIST',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'COMP-CHILD-DIST',
      name: 'Shehswar Distribution Co (Child)',
      isParent: false,
      currencyCode: 'PKR',
      taxId: 'NTN-7654321-0',
      isActive: true,
    },
  });

  // 5. Parent Plant & Warehouses
  const plant = await prisma.plant.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'PLANT-MAIN',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      code: 'PLANT-MAIN',
      name: 'Shehswar Central Feed & Chemical Plant',
      location: 'Industrial Area, Punjab',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'WH-PARENT-RM',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      plantId: plant.id,
      code: 'WH-PARENT-RM',
      name: 'Parent Raw Materials Silo & Warehouse',
      type: 'RAW_MATERIAL',
    },
  });

  await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'WH-PARENT-FG',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      plantId: plant.id,
      code: 'WH-PARENT-FG',
      name: 'Parent Finished Goods Central Warehouse',
      type: 'FINISHED_GOODS',
    },
  });

  // 6. Organization Roles
  const superAdminRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'ROLE_SUPER_ADMIN',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Unrestricted system-wide access',
      isSystem: true,
    },
  });

  const parentOpsRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'ROLE_PARENT_OPS',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_PARENT_OPS',
      name: 'Parent Plant Operations & Costing',
      description: 'Operations role with costing and formula clearance',
      isSystem: false,
    },
  });

  const childSalesRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'ROLE_CHILD_SALES',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_CHILD_SALES',
      name: 'Child Company Sales Representative',
      description: 'Distribution sales without manufacturing cost access',
      isSystem: false,
    },
  });

  // Assign base permissions to roles
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    });

    // Parent Ops gets manufacturing and costing
    if (perm.code.startsWith('costing:') || perm.code.startsWith('formula_bom:')) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: parentOpsRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: parentOpsRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Child Sales gets only sales and dealer
    if (perm.code.startsWith('sales_order:') || perm.code.startsWith('dealer:')) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: childSalesRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: childSalesRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // 7. Initial Super Admin Account
  const passwordHash = await bcrypt.hash('Shehswar@2026!', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@shehswar.com' },
    update: {},
    create: {
      organizationId: organization.id,
      companyId: parentCompany.id,
      email: 'admin@shehswar.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isSuperAdmin: true,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
      companyId: parentCompany.id,
    },
  });

  // 8. Default Document Numbering Sequences
  const docTypes = ['PO', 'SO', 'GRN', 'INVOICE', 'BATCH'];
  const fiscalYear = 2026;
  for (const docType of docTypes) {
    await prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: parentCompany.id,
          documentType: docType,
          fiscalYear,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        companyId: parentCompany.id,
        documentType: docType,
        fiscalYear,
        prefix: `SH-${docType}-${fiscalYear}`,
        currentNumber: BigInt(0),
      },
    });
  }

  console.log('✓ [Client Bootstrap] Shehswar Group initial setup complete.');
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
