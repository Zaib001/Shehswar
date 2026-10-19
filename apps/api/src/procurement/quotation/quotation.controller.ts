/**
 * SHEHSWAR ONE360 - Vendor Quotation Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  AuthUser,
  CreateQuotationDto,
  QuotationFilterDto,
  QuotationStatus,
} from '@shehswar/types';

@Controller('api/v1/procurement/quotations')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get()
  async getQuotations(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('rfqId') rfqId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: QuotationStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const filter: QuotationFilterDto = {
      organizationId,
      companyId,
      rfqId,
      vendorId,
      status,
      page,
      limit,
    };
    return this.quotationService.findAllQuotations(filter);
  }

  @Get(':id')
  async getQuotation(@Param('id') id: string) {
    return this.quotationService.findQuotationById(id);
  }

  @Post()
  async createQuotation(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.quotationService.createQuotation(dto, user);
  }

  @Post(':id/review')
  async markUnderReview(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.quotationService.markUnderReview(id, user);
  }
}
