/**
 * SHEHSWAR ONE360 - Vendor Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  AuthUser,
  CreateVendorDto,
  UpdateVendorDto,
  VendorFilterDto,
  VendorType,
  VendorStatus,
} from '@shehswar/types';

@Controller('api/v1/procurement/vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async getVendors(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('vendorType') vendorType?: VendorType,
    @Query('status') status?: VendorStatus,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const filter: VendorFilterDto = {
      organizationId,
      companyId,
      search,
      vendorType,
      status,
      category,
      page,
      limit,
    };
    return this.vendorService.findAllVendors(filter);
  }

  @Get(':id')
  async getVendor(@Param('id') id: string) {
    return this.vendorService.findVendorById(id);
  }

  @Post()
  async createVendor(
    @Body() dto: CreateVendorDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.createVendor(dto, user);
  }

  @Patch(':id')
  async updateVendor(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.updateVendor(id, dto, user);
  }

  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorService.submitForApproval(id, user);
  }

  @Post(':id/approve')
  async approveVendor(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.processApproval(id, 'APPROVE', comments, user);
  }

  @Post(':id/reject')
  async rejectVendor(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.processApproval(id, 'REJECT', comments, user);
  }

  @Post(':id/block')
  async blockVendor(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.blockVendor(id, reason, user);
  }

  @Post(':id/activate')
  async activateVendor(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.activateVendor(id, user);
  }

  @Get(':id/ledger')
  async getVendorLedger(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorService.getVendorLedger(id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post(':id/documents')
  async addDocument(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.addDocument(id, dto, user);
  }

  @Delete(':id/documents/:docId')
  async deleteDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.vendorService.deleteDocument(id, docId, user);
  }
}
