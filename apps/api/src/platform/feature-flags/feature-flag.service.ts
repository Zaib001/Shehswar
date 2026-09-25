/**
 * SHEHSWAR ONE360 - Feature Flag Service
 *
 * Evaluates feature activation across Global, Organization, and Company scopes.
 * Decoupled from user permissions.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks whether a feature flag is enabled for a given organization or company
   */
  async isEnabled(
    flagKey: string,
    context?: { organizationId?: string; companyId?: string },
  ): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: flagKey },
      include: {
        overrides: true,
      },
    });

    if (!flag) {
      return false;
    }

    // Check company-specific override first
    if (context?.companyId) {
      const companyOverride = flag.overrides.find((o) => o.companyId === context.companyId);
      if (companyOverride) {
        return companyOverride.isEnabled;
      }
    }

    // Check organization-specific override
    if (context?.organizationId) {
      const orgOverride = flag.overrides.find((o) => o.organizationId === context.organizationId);
      if (orgOverride) {
        return orgOverride.isEnabled;
      }
    }

    // Fall back to global default
    return flag.isEnabledGlobally;
  }
}
