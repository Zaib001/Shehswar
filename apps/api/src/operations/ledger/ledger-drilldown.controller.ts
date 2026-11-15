/**
 * SHEHSWAR ONE360 - Ledger Drilldown Controller
 * 
 * Exposes endpoints for universal source document lookup and synchronized edits from ledgers:
 * - GET /api/v1/ledger/source-document
 * - PUT /api/v1/ledger/source-document
 */
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';
import { LedgerDrilldownService } from './ledger-drilldown.service';

@Controller('api/v1/ledger')
@UseGuards(JwtAuthGuard)
export class LedgerDrilldownController {
  constructor(private readonly drilldownService: LedgerDrilldownService) {}

  @Get('source-document')
  async getSourceDocument(
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
    @Query('sourceNumber') sourceNumber?: string,
    @Query('voucherNumber') voucherNumber?: string,
    @Query('referenceId') referenceId?: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() context?: SecurityContext,
  ) {
    if (!sourceType && !sourceId && !sourceNumber && !voucherNumber && !referenceId) {
      throw new BadRequestException('At least one document identifier (sourceType, sourceId, sourceNumber, voucherNumber, or referenceId) must be provided');
    }

    const effectiveCompanyId = companyId || context?.companyId || user?.companyId;

    return this.drilldownService.getSourceDocument({
      sourceType,
      sourceId,
      sourceNumber,
      voucherNumber,
      referenceId,
      companyId: effectiveCompanyId,
    });
  }

  @Put('source-document')
  async updateSourceDocument(
    @Body() body: { sourceType: string; sourceId: string; data: any },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.sourceType || !body.sourceId) {
      throw new BadRequestException('sourceType and sourceId are required');
    }
    return this.drilldownService.updateSourceDocument(
      body.sourceType,
      body.sourceId,
      body.data || {},
      user,
    );
  }
}

