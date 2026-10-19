/**
 * SHEHSWAR ONE360 - Gate Pass Controller
 * Base URL: /api/v1/gate-passes
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
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { GatePassService, CreateGatePassDto } from './gate-pass.service';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/gate-passes')
@UseGuards(JwtAuthGuard)
export class GatePassController {
  constructor(private readonly gatePassService: GatePassService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('gatePassType') gatePassType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.gatePassService.findAll(user.companyId, {
      gatePassType,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gatePassService.findOne(id, user.companyId);
  }

  @Post()
  async create(@Body() dto: CreateGatePassDto, @CurrentUser() user: AuthUser) {
    return this.gatePassService.create(dto, user);
  }
}
