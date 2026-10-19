/**
 * SHEHSWAR ONE360 - Quotation Comparison Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { QuotationComparisonService } from './quotation-comparison.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser, SelectQuotationWinnerDto } from '@shehswar/types';

@Controller('api/v1/procurement/quotation-comparisons')
export class QuotationComparisonController {
  constructor(
    private readonly comparisonService: QuotationComparisonService,
  ) {}

  @Get('rfq/:rfqId')
  async getComparisonMatrix(@Param('rfqId') rfqId: string) {
    return this.comparisonService.getComparisonMatrix(rfqId);
  }

  @Post('select-winner')
  async selectWinner(
    @Body() dto: SelectQuotationWinnerDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.comparisonService.selectWinner(dto, user);
  }

  @Post('generate-po')
  async generatePo(
    @Body() dto: { rfqId: string; quotationId?: string; warehouseId?: string; deliveryLocation?: string },
    @CurrentUser() user?: AuthUser,
  ) {
    return this.comparisonService.generatePoForWinner(dto, user);
  }
}
