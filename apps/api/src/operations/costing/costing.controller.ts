/**
 * SHEHSWAR ONE360 - Product Costing Controller
 * Base URL: /api/v1/costing
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CostingService, CostingMethod, BatchCostCalculationInput, ApplyCostingInput } from './costing.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';

@Controller('api/v1/costing')
@UseGuards(JwtAuthGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Post('calculate')
  async calculateBatchCost(@Body() input: BatchCostCalculationInput) {
    return this.costingService.calculateCostBatch(input);
  }

  @Post('apply-to-product')
  async applyCostingToProduct(
    @Body() input: ApplyCostingInput,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const enrichedUser: AuthUser = {
      ...user,
      companyId: input.companyId || ctx?.companyId || user?.companyId,
      organizationId: ctx?.organizationId || user?.organizationId,
    };
    return this.costingService.applyCostingToProduct(input, enrichedUser);
  }

  @Get('product/:id/history')
  async getCostingHistory(@Param('id') id: string) {
    return this.costingService.getProductCostingHistory(id);
  }

  @Get('finished-products/:id/calculate')
  async calculateCost(
    @Param('id') id: string,
    @Query('formulaId') formulaId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('method') method?: CostingMethod,
    @Query('productionQuantity') productionQuantity?: string,
    @Query('packSize') packSize?: string,
  ) {
    return this.costingService.calculateFinishedProductCost(
      id,
      formulaId,
      warehouseId,
      method,
      productionQuantity ? Number(productionQuantity) : undefined,
      packSize ? Number(packSize) : undefined,
    );
  }

  @Get('raw-materials/:id/cost')
  async getRawMaterialCost(
    @Param('id') id: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('method') method?: CostingMethod,
  ) {
    const cost = await this.costingService.getRawMaterialCost(id, warehouseId, method);
    return { rawMaterialId: id, unitCost: cost };
  }

  @Get('packing-materials/:id/cost')
  async getPackingMaterialCost(
    @Param('id') id: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('method') method?: CostingMethod,
  ) {
    const cost = await this.costingService.getPackingMaterialCost(id, warehouseId, method);
    return { packingMaterialId: id, unitCost: cost };
  }
}
