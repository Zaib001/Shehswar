/**
 * SHEHSWAR ONE360 - Request For Quotation Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { RfqService } from './rfq.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  AuthUser,
  CreateRfqDto,
  RfqFilterDto,
  RfqStatus,
} from '@shehswar/types';

@Controller('api/v1/procurement/rfqs')
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Get()
  async getRfqs(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('prId') prId?: string,
    @Query('status') status?: RfqStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const filter: RfqFilterDto = {
      organizationId,
      companyId,
      prId,
      status,
      search,
      page,
      limit,
    };
    return this.rfqService.findAllRfqs(filter);
  }

  @Get(':id')
  async getRfq(@Param('id') id: string) {
    return this.rfqService.findRfqById(id);
  }

  @Post()
  async createRfq(
    @Body() dto: CreateRfqDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.rfqService.createRfq(dto, user);
  }

  @Post(':id/send')
  async sendRfq(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.rfqService.sendRfq(id, user);
  }

  @Post(':id/close')
  async closeRfq(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.rfqService.closeRfq(id, user);
  }
}
