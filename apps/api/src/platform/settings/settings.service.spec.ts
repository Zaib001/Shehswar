/**
 * SHEHSWAR ONE360 - Hierarchical Settings Service Unit Tests
 *
 * Verifies cascading override resolution:
 * Platform Default -> Organization Override -> Company Override -> Branch Override
 */
import { SettingsService } from './settings.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ConfigurationScope } from '@shehswar/types';

describe('SettingsService Hierarchical Resolution', () => {
  let service: SettingsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      systemSetting: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new SettingsService(mockPrisma as unknown as PrismaService);
  });

  it('Resolves Platform default when no organizational overrides exist', async () => {
    mockPrisma.systemSetting.findFirst.mockImplementation(async (args: any) => {
      if (args.where.scope === ConfigurationScope.PLATFORM) {
        return {
          id: 's-1',
          key: 'general.timezone',
          value: 'Asia/Karachi',
          scope: ConfigurationScope.PLATFORM,
        };
      }
      return null;
    });

    const result = await service.get('general.timezone', {
      organizationId: 'org-1',
      companyId: 'comp-1',
    });

    expect(result.value).toBe('Asia/Karachi');
    expect(result.resolvedScope).toBe(ConfigurationScope.PLATFORM);
    expect(result.isOverridden).toBe(false);
  });

  it('Organization override takes precedence over Platform default', async () => {
    mockPrisma.systemSetting.findFirst.mockImplementation(async (args: any) => {
      if (
        args.where.scope === ConfigurationScope.ORGANIZATION &&
        args.where.scopeId === 'org-1'
      ) {
        return {
          id: 's-2',
          key: 'general.currency',
          value: 'USD',
          scope: ConfigurationScope.ORGANIZATION,
        };
      }
      if (args.where.scope === ConfigurationScope.PLATFORM) {
        return {
          id: 's-1',
          key: 'general.currency',
          value: 'PKR',
          scope: ConfigurationScope.PLATFORM,
        };
      }
      return null;
    });

    const result = await service.get('general.currency', {
      organizationId: 'org-1',
      companyId: 'comp-1',
    });

    expect(result.value).toBe('USD');
    expect(result.resolvedScope).toBe(ConfigurationScope.ORGANIZATION);
    expect(result.isOverridden).toBe(true);
  });

  it('Company override takes precedence over Organization override', async () => {
    mockPrisma.systemSetting.findFirst.mockImplementation(async (args: any) => {
      if (
        args.where.scope === ConfigurationScope.COMPANY &&
        args.where.scopeId === 'comp-1'
      ) {
        return {
          id: 's-3',
          key: 'security.session_duration_minutes',
          value: 120,
          scope: ConfigurationScope.COMPANY,
        };
      }
      if (
        args.where.scope === ConfigurationScope.ORGANIZATION &&
        args.where.scopeId === 'org-1'
      ) {
        return {
          id: 's-2',
          key: 'security.session_duration_minutes',
          value: 60,
          scope: ConfigurationScope.ORGANIZATION,
        };
      }
      return null;
    });

    const result = await service.get('security.session_duration_minutes', {
      organizationId: 'org-1',
      companyId: 'comp-1',
    });

    expect(result.value).toBe(120);
    expect(result.resolvedScope).toBe(ConfigurationScope.COMPANY);
    expect(result.isOverridden).toBe(true);
  });

  it('Branch override takes highest precedence in hierarchy', async () => {
    mockPrisma.systemSetting.findFirst.mockImplementation(async (args: any) => {
      if (
        args.where.scope === ConfigurationScope.BRANCH &&
        args.where.scopeId === 'branch-1'
      ) {
        return {
          id: 's-4',
          key: 'notifications.sms_enabled',
          value: true,
          scope: ConfigurationScope.BRANCH,
        };
      }
      if (
        args.where.scope === ConfigurationScope.COMPANY &&
        args.where.scopeId === 'comp-1'
      ) {
        return {
          id: 's-3',
          key: 'notifications.sms_enabled',
          value: false,
          scope: ConfigurationScope.COMPANY,
        };
      }
      return null;
    });

    const result = await service.get('notifications.sms_enabled', {
      organizationId: 'org-1',
      companyId: 'comp-1',
      branchId: 'branch-1',
    });

    expect(result.value).toBe(true);
    expect(result.resolvedScope).toBe(ConfigurationScope.BRANCH);
    expect(result.isOverridden).toBe(true);
  });
});
