/**
 * SHEHSWAR ONE360 - Document Numbering Controller
 */
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { DocumentNumberingService } from './document-numbering.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';

@Controller('api/v1/document-numbering')
export class DocumentNumberingController {
  constructor(private readonly service: DocumentNumberingService) {}

  @Get('sequences')
  async getSequences(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
  ) {
    return this.service.listSequences(
      companyId || ctx.companyId,
      orgId || ctx.organizationId,
    );
  }

  @Post('sequences')
  async configureSequence(
    @Body()
    body: {
      companyId?: string;
      organizationId?: string;
      documentType: string;
      prefix: string;
      startingNumber?: number;
      fiscalYear?: number;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    return this.service.configureSequence({
      organizationId: body.organizationId || ctx.organizationId || user.organizationId,
      companyId: body.companyId || ctx.companyId || user.companyId,
      documentType: body.documentType,
      prefix: body.prefix,
      startingNumber: body.startingNumber,
      fiscalYear: body.fiscalYear,
    });
  }

  @Post('preview')
  previewSequence(
    @Body()
    body: {
      prefix: string;
      startingNumber?: number;
      fiscalYear?: number;
    },
  ) {
    return {
      preview: this.service.previewNextNumber(body),
    };
  }

  @Post('next')
  async getNextNumber(
    @Body()
    body: {
      companyId?: string;
      organizationId?: string;
      documentType: string;
      prefixOverride?: string;
      fiscalYear?: number;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const documentNumber = await this.service.getNextDocumentNumber({
      organizationId: body.organizationId || ctx.organizationId || user.organizationId,
      companyId: body.companyId || ctx.companyId || user.companyId,
      documentType: body.documentType,
      prefixOverride: body.prefixOverride,
      fiscalYear: body.fiscalYear,
    });

    return { documentNumber };
  }
}
