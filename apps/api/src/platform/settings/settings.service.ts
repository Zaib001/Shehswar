/**
 * SHEHSWAR ONE360 - Hierarchical Configuration & Settings Service
 *
 * Implements cascading inheritance:
 * Platform Default -> Organization Override -> Company Override -> Branch Override
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ConfigurationScope, ResolvedSetting } from '@shehswar/types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a configuration key by looking up the hierarchy
   */
  async get<T = unknown>(
    key: string,
    context: {
      organizationId?: string;
      companyId?: string;
      branchId?: string;
    },
    defaultValue?: T,
  ): Promise<ResolvedSetting<T>> {
    // 1. Check Branch Override
    if (context.branchId) {
      const branchSetting = await this.prisma.systemSetting.findFirst({
        where: { key, scope: ConfigurationScope.BRANCH, scopeId: context.branchId },
      });
      if (branchSetting) {
        return {
          key,
          value: branchSetting.value as T,
          resolvedScope: ConfigurationScope.BRANCH,
          isOverridden: true,
        };
      }
    }

    // 2. Check Company Override
    if (context.companyId) {
      const companySetting = await this.prisma.systemSetting.findFirst({
        where: { key, scope: ConfigurationScope.COMPANY, scopeId: context.companyId },
      });
      if (companySetting) {
        return {
          key,
          value: companySetting.value as T,
          resolvedScope: ConfigurationScope.COMPANY,
          isOverridden: true,
        };
      }
    }

    // 3. Check Organization Override
    if (context.organizationId) {
      const orgSetting = await this.prisma.systemSetting.findFirst({
        where: { key, scope: ConfigurationScope.ORGANIZATION, scopeId: context.organizationId },
      });
      if (orgSetting) {
        return {
          key,
          value: orgSetting.value as T,
          resolvedScope: ConfigurationScope.ORGANIZATION,
          isOverridden: true,
        };
      }
    }

    // 4. Check Platform Default
    const platformSetting = await this.prisma.systemSetting.findFirst({
      where: { key, scope: ConfigurationScope.PLATFORM },
    });
    if (platformSetting) {
      return {
        key,
        value: platformSetting.value as T,
        resolvedScope: ConfigurationScope.PLATFORM,
        isOverridden: false,
      };
    }

    // 5. Fallback to hardcoded code default
    return {
      key,
      value: defaultValue as T,
      resolvedScope: ConfigurationScope.PLATFORM,
      isOverridden: false,
    };
  }

  /**
   * Lists settings filtered by scope, scopeId, organization or company
   */
  async list(params?: {
    scope?: string;
    scopeId?: string;
    organizationId?: string;
    companyId?: string;
  }) {
    const where: any = {};
    if (params?.scope) where.scope = params.scope;
    if (params?.scopeId) where.scopeId = params.scopeId;
    if (params?.organizationId) where.organizationId = params.organizationId;
    if (params?.companyId) where.companyId = params.companyId;

    return this.prisma.systemSetting.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { key: 'asc' }],
    });
  }

  /**
   * Sets or overrides a configuration value at the specified scope
   */
  async set(params: {
    key: string;
    value: unknown;
    scope: ConfigurationScope | string;
    scopeId?: string;
    organizationId?: string;
    companyId?: string;
  }) {
    return this.prisma.systemSetting.upsert({
      where: {
        scope_key_scopeId: {
          scope: params.scope,
          key: params.key,
          scopeId: params.scopeId ?? (null as any),
        },
      },
      update: {
        value: params.value as any,
        organizationId: params.organizationId,
        companyId: params.companyId,
      },
      create: {
        key: params.key,
        value: params.value as any,
        scope: params.scope,
        scopeId: params.scopeId,
        organizationId: params.organizationId,
        companyId: params.companyId,
      },
    });
  }

  /**
   * Resolves a batch of configuration keys through the full cascading hierarchy
   */
  async resolveHierarchy(
    keys: string[],
    context: {
      organizationId?: string;
      companyId?: string;
      branchId?: string;
    },
  ): Promise<Record<string, ResolvedSetting>> {
    const results: Record<string, ResolvedSetting> = {};
    for (const key of keys) {
      results[key] = await this.get(key, context);
    }
    return results;
  }
}

