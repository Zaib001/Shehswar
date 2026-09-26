/**
 * SHEHSWAR ONE360 - System Seed (Generic SaaS Reference Data)
 *
 * Seeds platform-wide permissions and required reference configurations.
 * Contains ZERO customer-specific or Shehswar-specific data.
 */
import { PrismaClient } from '@prisma/client';
import { Action, Resource } from '@shehswar/types';

export async function seedSystem(prisma: PrismaClient) {
  console.log('🔧 [System Seed] Seeding universal platform permissions & reference definitions...');

  const permissionsToSeed: {
    resource: string;
    action: string;
    code: string;
    isSensitive: boolean;
    description: string;
  }[] = [];

  // 1. Generate standard CRUD lifecycle permissions for all resources
  for (const resource of Object.values(Resource)) {
    for (const action of [
      Action.VIEW,
      Action.CREATE,
      Action.EDIT,
      Action.DELETE,
      Action.SUBMIT,
      Action.APPROVE,
      Action.EXPORT,
    ]) {
      permissionsToSeed.push({
        resource,
        action,
        code: `${resource}:${action}`,
        isSensitive: false,
        description: `Can ${action} ${resource}`,
      });
    }
  }

  // 2. Cross-company consolidated view permission
  permissionsToSeed.push({
    resource: Resource.COMPANY,
    action: 'cross_company_view',
    code: 'company:cross_company_view',
    isSensitive: true,
    description: 'Can view consolidated multi-company transactions',
  });

  // 3. Sensitive domain-specific permissions
  const sensitivePermissions = [
    {
      resource: Resource.COSTING,
      action: Action.VIEW_COST,
      code: 'costing:view_cost',
      desc: 'Can view parent manufacturing cost',
    },
    {
      resource: Resource.COSTING,
      action: Action.VIEW_MARGIN,
      code: 'costing:view_margin',
      desc: 'Can view parent margins and profit breakdown',
    },
    {
      resource: Resource.FORMULA_BOM,
      action: Action.EDIT_FORMULA,
      code: 'formula_bom:edit_formula',
      desc: 'Can create or modify production formulas',
    },
    {
      resource: Resource.FORMULA_BOM,
      action: Action.APPROVE_FORMULA,
      code: 'formula_bom:approve_formula',
      desc: 'Can approve and lock production formulas',
    },
    {
      resource: Resource.SALES_ORDER,
      action: Action.MODIFY_PRICE,
      code: 'sales_order:modify_price',
      desc: 'Can override base price list',
    },
    {
      resource: Resource.DEALER,
      action: Action.MODIFY_CREDIT_LIMIT,
      code: 'dealer:modify_credit_limit',
      desc: 'Can modify dealer credit limits',
    },
    {
      resource: Resource.DEALER,
      action: Action.APPROVE_CREDIT_OVERRIDE,
      code: 'dealer:approve_credit_override',
      desc: 'Can approve sales order exceeding credit limit',
    },
    {
      resource: Resource.FINISHED_BATCH,
      action: Action.RELEASE_BATCH,
      code: 'finished_batch:release_batch',
      desc: 'Can release finished product batch for dispatch',
    },
    {
      resource: Resource.FINISHED_BATCH,
      action: Action.RECALL_BATCH,
      code: 'finished_batch:recall_batch',
      desc: 'Can recall batch from distribution',
    },
    {
      resource: Resource.AUDIT_LOG,
      action: Action.VIEW_AUDIT_LOGS,
      code: 'audit_log:view_audit_logs',
      desc: 'Can view immutable security audit logs',
    },
  ];

  for (const sp of sensitivePermissions) {
    permissionsToSeed.push({
      resource: sp.resource,
      action: sp.action,
      code: sp.code,
      isSensitive: true,
      description: sp.desc,
    });
  }

  for (const perm of permissionsToSeed) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description, isSensitive: perm.isSensitive },
      create: {
        resource: perm.resource,
        action: perm.action,
        code: perm.code,
        description: perm.description,
        isSensitive: perm.isSensitive,
      },
    });
  }

  console.log(`✓ [System Seed] ${permissionsToSeed.length} permissions verified.`);
}

// Standalone runner
if (require.main === module) {
  const prisma = new PrismaClient();
  seedSystem(prisma)
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
