/**
 * SHEHSWAR ONE360 - Intercompany Transfer Controller
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IntercompanyService, IntercompanyTransferDto } from './intercompany.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/operations/intercompany')
@UseGuards(JwtAuthGuard)
export class IntercompanyController {
  constructor(private readonly intercompanyService: IntercompanyService) {}

  @Post('transfer')
  async executeTransfer(
    @Body() dto: IntercompanyTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intercompanyService.executeTransfer(dto, user);
  }

  @Get('source-stock')
  async getSourceStock(@Query('warehouseId') warehouseId: string) {
    if (!warehouseId) throw new BadRequestException('warehouseId is required');
    return this.intercompanyService.getSourceStock(warehouseId);
  }

  @Get('profit-report')
  async getProfitReport(
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.intercompanyService.getProfitReport({
      companyId: effectiveCompanyId,
      startDate,
      endDate,
    });
  }

  @Get('child-report')
  async getChildReport(
    @Query('childCompanyId') childCompanyId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    if (!childCompanyId) {
      throw new BadRequestException('childCompanyId is required');
    }
    return this.intercompanyService.getChildReport({
      childCompanyId,
      warehouseId,
    });
  }

  @Get('history')
  async getTransferHistory(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || (user?.isSuperAdmin ? undefined : user?.companyId);
    return this.intercompanyService.getTransferHistory(effectiveCompanyId);
  }
}
