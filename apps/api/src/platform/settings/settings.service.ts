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
}
