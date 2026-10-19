/**
 * SHEHSWAR ONE360 - System Settings Controller
 */
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext, ConfigurationScope } from '@shehswar/types';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(
    @CurrentContext() ctx: SecurityContext,
    @Query('scope') scope?: string,
    @Query('scopeId') scopeId?: string,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
  ) {
    return this.settingsService.list({
      scope,
      scopeId,
      companyId: companyId || ctx.companyId,
      organizationId: orgId || ctx.organizationId,
    });
  }

  @Post('set')
  async setSetting(
    @Body()
    body: {
      key: string;
      value: unknown;
      scope: ConfigurationScope | string;
      scopeId?: string;
      companyId?: string;
      organizationId?: string;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    return this.settingsService.set({
      key: body.key,
      value: body.value,
      scope: body.scope,
      scopeId: body.scopeId,
      organizationId: body.organizationId || ctx.organizationId || user.organizationId,
      companyId: body.companyId || ctx.companyId || user.companyId,
    });
  }

  @Post('resolve')
  async resolveHierarchy(
    @Body()
    body: {
      keys: string[];
      companyId?: string;
      branchId?: string;
      organizationId?: string;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    return this.settingsService.resolveHierarchy(body.keys, {
      organizationId: body.organizationId || ctx.organizationId || user.organizationId,
      companyId: body.companyId || ctx.companyId || user.companyId,
      branchId: body.branchId || ctx.branchId,
    });
  }
}
