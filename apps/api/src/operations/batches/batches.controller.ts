/**
 * SHEHSWAR ONE360 - Product Batch Number API Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';
import { BatchesService, CreateBatchDto, UpdateBatchDto } from './batches.service';

@Controller('api/v1/batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get('product/:productId')
  async getBatchesForProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.getBatchesForProduct(productId, user.companyId);
  }

  @Get(':id')
  async getBatchById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.getBatchById(id, user.companyId);
  }

  @Post()
  async createBatch(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.createBatch(dto, user);
  }

  @Patch(':id')
  async updateBatch(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.updateBatch(id, dto, user);
  }

  @Patch(':id/set-active')
  async setActiveBatch(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.setActiveBatch(id, user);
  }

  @Delete(':id')
  async deleteBatch(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.deleteBatch(id, user);
  }
}

