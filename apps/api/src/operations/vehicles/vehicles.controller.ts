/**
 * SHEHSWAR ONE360 - Vehicles & Fleet Management Controller
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import {
  VehiclesService,
  CreateVehicleDto,
  AssignVehicleDto,
  ReturnVehicleDto,
  CreateVehicleExpenseDto,
} from './vehicles.service';

@ApiTags('Vehicles & Fleet Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List vehicles with filters' })
  async getVehicles(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.vehiclesService.getVehicles(companyId, status, search);
  }

  @Get('reports/current-assignment')
  @ApiOperation({ summary: 'Report: Vehicle Current Assignment & Custodian' })
  async getCurrentAssignmentReport(@Query('companyId') companyId?: string) {
    return this.vehiclesService.getCurrentAssignmentReport(companyId);
  }

  @Get('reports/employee-vehicles/:employeeId')
  @ApiOperation({ summary: 'Report: Employee Vehicle History Report' })
  async getEmployeeVehiclesReport(@Param('employeeId') employeeId: string) {
    return this.vehiclesService.getEmployeeVehiclesReport(employeeId);
  }

  @Get('expenses/list')
  @ApiOperation({ summary: 'List vehicle expenses and fuel vouchers' })
  async getVehicleExpenses(
    @Query('companyId') companyId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('expenseType') expenseType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.vehiclesService.getVehicleExpenses({
      companyId,
      vehicleId,
      employeeId,
      expenseType,
      fromDate,
      toDate,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle detail with complete assignment & expense history' })
  async getVehicleById(@Param('id') id: string) {
    return this.vehiclesService.getVehicleById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new vehicle in company fleet' })
  async createVehicle(@Body() dto: CreateVehicleDto, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.vehiclesService.createVehicle(orgId, dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update vehicle record' })
  async updateVehicle(@Param('id') id: string, @Body() dto: Partial<CreateVehicleDto>) {
    return this.vehiclesService.updateVehicle(id, dto);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Vehicle Takeover / Assignment to Employee' })
  async assignVehicle(
    @Param('id') id: string,
    @Body() dto: AssignVehicleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.vehiclesService.assignVehicle(id, dto, userId);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Vehicle Return to Head Office / Available State' })
  async returnVehicle(
    @Param('id') id: string,
    @Body() dto: ReturnVehicleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.vehiclesService.returnVehicle(id, dto, userId);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Record Fuel / Petrol / Maintenance Expense with GL Posting' })
  async createVehicleExpense(@Body() dto: CreateVehicleExpenseDto, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const companyId = req.body?.companyId || req.user?.companyId;
    const userId = req.user?.id;
    return this.vehiclesService.createVehicleExpense(orgId, companyId, dto, userId);
  }
}
