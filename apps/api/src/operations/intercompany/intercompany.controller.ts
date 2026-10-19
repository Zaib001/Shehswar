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

  @Get('history')
  async getTransferHistory(
    @Query('companyId') companyId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    if (!effectiveCompanyId) throw new BadRequestException('Company ID is required');

    return this.intercompanyService.getTransferHistory(effectiveCompanyId);
  }
}
