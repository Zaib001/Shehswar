/**
 * SHEHSWAR ONE360 - Master Data Service Unit Tests
 *
 * Verifies multi-company scoping, organizational isolation, and RBAC permission assignment.
 */
import { MasterDataService } from './master-data.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('MasterDataService Multi-Company & Isolation', () => {
  let service: MasterDataService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      company: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      plant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rolePermission: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      platformTenant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1', code: 'SHEHSWAR-TENANT' }),
        create: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    service = new MasterDataService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('Organization Isolation', () => {
    it('findCompanies isolates queries strictly to the requesting organization', async () => {
      const mockCompanies = [
        { id: 'comp-1', code: 'CHEM', name: 'Shehswar Chemicals Ltd', organizationId: 'org-1' },
        { id: 'comp-2', code: 'AGRO', name: 'Shehswar Agro-Tech Ltd', organizationId: 'org-1' },
      ];
      mockPrisma.company.findMany.mockResolvedValue(mockCompanies);

      const result = await service.findCompanies('org-1');

      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.organizationId).toBe('org-1');
    });

    it('prevent duplicate company codes within the same organization', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-existing',
        code: 'CHEM',
        organizationId: 'org-1',
      });

      await expect(
        service.createCompany(
          {
            organizationId: 'org-1',
            code: 'CHEM',
            name: 'Shehswar Chemicals Ltd',
          },
          { id: 'user-admin', email: 'admin@shehswar.com' },
        ),
      ).rejects.toThrow('Company code "CHEM" already exists in this organization');
    });
  });

  describe('Role & Permission Management', () => {
    it('creates a role and binds permissions within the organization', async () => {
      const roleId = 'role-plant-mgr';
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.create.mockImplementation(async (args: any) => ({
        id: roleId,
        ...args.data,
      }));
      mockPrisma.role.findUnique.mockResolvedValue({
        id: roleId,
        code: 'PLANT_MGR',
        name: 'Plant Manager',
        rolePermissions: [{ permissionId: 'perm-view' }, { permissionId: 'perm-approve' }],
      });

      const role = await service.createRole(
        {
          organizationId: 'org-1',
          code: 'PLANT_MGR',
          name: 'Plant Manager',
          permissionIds: ['perm-view', 'perm-approve'],
        },
        { id: 'user-admin' },
      );

      expect(mockPrisma.role.create).toHaveBeenCalled();
      expect(mockPrisma.rolePermission.create).toHaveBeenCalledTimes(2);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'ROLE',
          action: 'CREATE',
        }),
      );
      expect(role.code).toBe('PLANT_MGR');
    });
  });

  describe('Audit Trail Recording', () => {
    it('records an audit entry when creating an organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockImplementation(async (args: any) => ({
        id: 'org-new',
        ...args.data,
      }));

      await service.createOrganization(
        {
          code: 'SHEHSWAR-GRP',
          name: 'Shehswar Group',
          legalName: 'Shehswar Enterprises Ltd',
        },
        { id: 'super-admin', email: 'super@shehswar.com' },
      );

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'ORGANIZATION',
          action: 'CREATE',
          actorId: 'super-admin',
          actorEmail: 'super@shehswar.com',
        }),
      );
    });
  });
});
