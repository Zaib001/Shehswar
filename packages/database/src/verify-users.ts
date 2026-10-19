import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      company: true,
      organization: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  console.log(`\n================ REAL DATABASE USERS VERIFIED (${users.length} TOTAL) ================`);
  for (const u of users) {
    const roles = u.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(
        u.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    );
    const pwdOk = await bcrypt.compare('Shehswar@2026!', u.passwordHash);

    console.log(
      JSON.stringify(
        {
          id: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
          isSuperAdmin: u.isSuperAdmin,
          organization: u.organization.name,
          company: u.company.name,
          roles,
          permissionCount: permissions.length,
          passwordMatches: pwdOk,
          samplePermissions: permissions.slice(0, 5),
        },
        null,
        2,
      ),
    );
  }
}

main().finally(() => prisma.$disconnect());
