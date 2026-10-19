/**
 * SHEHSWAR ONE360 - Product Costing Controller
 * Base URL: /api/v1/costing
 */
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CostingService, CostingMethod } from './costing.service';

@Controller('api/v1/costing')
@UseGuards(JwtAuthGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

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
