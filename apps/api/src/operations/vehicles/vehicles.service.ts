/**
 * SHEHSWAR ONE360 - Vehicles & Fleet Management Service
 *
 * Implements authoritative vehicle lifecycle:
 * - Vehicle Master (No duplicate registration, chassis/engine tracking)
 * - Takeover / Assignment to Employee with immutable history
 * - Vehicle Return to Head Office / Available state
 * - Vehicle Fuel & Maintenance Expense with atomic GL Journal Entry
 * - Current Assignment & Employee Vehicle Reports
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { v7 as uuidv7 } from 'uuid';

export interface CreateVehicleDto {
  vehicleNumber: string;
  companyId: string;
  companyName?: string;
  vehicleModel: string;
  registrationYear: number;
  engineNumber?: string;
  chassisNumber?: string;
  status?: string;
  currentLocation?: string;
  notes?: string;
}

export interface AssignVehicleDto {
  employeeId: string;
  assignmentDate?: string | Date;
  notes?: string;
}

export interface ReturnVehicleDto {
  returnDate?: string | Date;
  returnReason?: string;
  returnCondition?: string;
  notes?: string;
}

export interface CreateVehicleExpenseDto {
  vehicleId: string;
  employeeId?: string;
  expenseType?: 'FUEL' | 'MAINTENANCE' | 'REPAIR' | 'TOLL_TAX' | 'INSURANCE' | 'OTHER';
  expenseDate: string | Date;
  fuelStation?: string;
  quantity?: number;
  rate?: number;
  totalAmount?: number;
  paymentMethod?: 'CASH' | 'BANK' | 'PAYABLE';
  remarks?: string;
  attachmentUrl?: string;
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  /**
   * Create a new Vehicle record in the database
   */
  async createVehicle(organizationId: string, dto: CreateVehicleDto, _userId?: string) {
    // 1. Validate unique vehicle number in company scope
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        companyId: dto.companyId,
        vehicleNumber: { equals: dto.vehicleNumber.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Vehicle number "${dto.vehicleNumber}" already exists in this company`,
      );
    }

    // 2. Validate optional engine and chassis uniqueness if provided
    if (dto.engineNumber?.trim()) {
      const eng = await this.prisma.vehicle.findFirst({
        where: {
          companyId: dto.companyId,
          engineNumber: { equals: dto.engineNumber.trim(), mode: 'insensitive' },
        },
      });
      if (eng) {
        throw new ConflictException(`Engine number "${dto.engineNumber}" is already registered`);
      }
    }

    if (dto.chassisNumber?.trim()) {
      const chas = await this.prisma.vehicle.findFirst({
        where: {
          companyId: dto.companyId,
          chassisNumber: { equals: dto.chassisNumber.trim(), mode: 'insensitive' },
        },
      });
      if (chas) {
        throw new ConflictException(`Chassis number "${dto.chassisNumber}" is already registered`);
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { name: true },
    });

    return this.prisma.vehicle.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId: dto.companyId,
        companyName: company?.name || dto.companyName,
        vehicleNumber: dto.vehicleNumber.trim().toUpperCase(),
        vehicleModel: dto.vehicleModel.trim(),
        registrationYear: Number(dto.registrationYear),
        engineNumber: dto.engineNumber?.trim() || null,
        chassisNumber: dto.chassisNumber?.trim() || null,
        status: dto.status || 'AVAILABLE',
        currentLocation: dto.currentLocation || 'Head Office',
        notes: dto.notes || null,
      },
      include: {
        company: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * List vehicles with filters
   */
  async getVehicles(companyId?: string, status?: string, search?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (status && status !== 'ALL') where.status = status;
    if (search?.trim()) {
      where.OR = [
        { vehicleNumber: { contains: search.trim(), mode: 'insensitive' } },
        { vehicleModel: { contains: search.trim(), mode: 'insensitive' } },
        { engineNumber: { contains: search.trim(), mode: 'insensitive' } },
        { chassisNumber: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.vehicle.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        currentEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            phone: true,
          },
        },
        _count: {
          select: { assignments: true, expenses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Detailed vehicle view with full assignment history and expense history
   */
  async getVehicleById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        currentEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            phone: true,
            email: true,
          },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                position: true,
                phone: true,
              },
            },
          },
          orderBy: { assignmentDate: 'desc' },
        },
        expenses: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { expenseDate: 'desc' },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID "${id}" not found`);
    }

    return vehicle;
  }

  /**
   * Update vehicle master data
   */
  async updateVehicle(id: string, dto: Partial<CreateVehicleDto>) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        vehicleModel: dto.vehicleModel !== undefined ? dto.vehicleModel.trim() : undefined,
        registrationYear: dto.registrationYear !== undefined ? Number(dto.registrationYear) : undefined,
        engineNumber: dto.engineNumber !== undefined ? dto.engineNumber?.trim() || null : undefined,
        chassisNumber: dto.chassisNumber !== undefined ? dto.chassisNumber?.trim() || null : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
        currentLocation: dto.currentLocation !== undefined ? dto.currentLocation : undefined,
        notes: dto.notes !== undefined ? dto.notes : undefined,
      },
    });
  }

  /**
   * Takeover / Assignment workflow: Assign vehicle to an employee
   */
  async assignVehicle(id: string, dto: AssignVehicleDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      if (['SOLD', 'DISPOSED', 'INACTIVE'].includes(vehicle.status)) {
        throw new BadRequestException(`Cannot assign vehicle with status "${vehicle.status}"`);
      }

      const employee = await tx.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      });
      if (!employee) throw new NotFoundException('Target employee not found');

      // 1. Close any existing ACTIVE assignment for this vehicle
      const activeAssignments = await tx.vehicleAssignment.findMany({
        where: { vehicleId: id, status: 'ACTIVE' },
      });
      for (const active of activeAssignments) {
        await tx.vehicleAssignment.update({
          where: { id: active.id },
          data: {
            status: 'RETURNED',
            returnDate: dto.assignmentDate ? new Date(dto.assignmentDate) : new Date(),
            returnReason: `Reassigned to ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
          },
        });
      }

      // 2. Create new assignment
      const assignDate = dto.assignmentDate ? new Date(dto.assignmentDate) : new Date();
      const assignment = await tx.vehicleAssignment.create({
        data: {
          id: uuidv7(),
          organizationId: vehicle.organizationId,
          companyId: vehicle.companyId,
          vehicleId: id,
          employeeId: dto.employeeId,
          assignedById: userId || null,
          assignmentDate: assignDate,
          status: 'ACTIVE',
          notes: dto.notes || null,
        },
      });

      // 3. Update vehicle status and custodian
      const updatedVehicle = await tx.vehicle.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          currentEmployeeId: dto.employeeId,
          assignmentDate: assignDate,
          currentLocation: `With ${employee.firstName} ${employee.lastName}`,
        },
        include: {
          currentEmployee: true,
          company: true,
        },
      });

      this.logger.log(
        `Vehicle ${vehicle.vehicleNumber} assigned to employee ${employee.employeeCode} (${employee.firstName})`,
      );

      return { vehicle: updatedVehicle, assignment };
    });
  }

  /**
   * Return vehicle to Head Office / Available state
   */
  async returnVehicle(id: string, dto: ReturnVehicleDto, _userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id },
        include: { currentEmployee: true },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      const returnDate = dto.returnDate ? new Date(dto.returnDate) : new Date();

      // 1. Find and close active assignment
      const activeAssignment = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: id, status: 'ACTIVE' },
      });

      if (activeAssignment) {
        await tx.vehicleAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            status: 'RETURNED',
            returnDate,
            returnReason: dto.returnReason || 'Regular Return',
            returnCondition: dto.returnCondition || 'Good Condition',
            notes: dto.notes || activeAssignment.notes,
          },
        });
      }

      // 2. Update vehicle to Available at Head Office
      const updatedVehicle = await tx.vehicle.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          currentEmployeeId: null,
          assignmentDate: null,
          currentLocation: 'Head Office',
        },
      });

      this.logger.log(`Vehicle ${vehicle.vehicleNumber} returned to Head Office`);

      return updatedVehicle;
    });
  }

  /**
   * Report: "Vehicle Current Assignment"
   * Answers immediately: "Which vehicle is currently with which employee?"
   */
  async getCurrentAssignmentReport(companyId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        currentEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            phone: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { vehicleNumber: 'asc' }],
    });

    return vehicles.map((v) => ({
      vehicleId: v.id,
      vehicleNumber: v.vehicleNumber,
      companyId: v.companyId,
      companyName: v.company?.name || v.companyName,
      model: v.vehicleModel,
      registrationYear: v.registrationYear,
      status: v.status,
      currentEmployee: v.currentEmployee
        ? `${v.currentEmployee.firstName} ${v.currentEmployee.lastName}`
        : 'Head Office / Available',
      employeeId: v.currentEmployee?.employeeCode || '-',
      assignmentDate: v.assignmentDate,
      location: v.currentLocation || 'Head Office',
      phone: v.currentEmployee?.phone || '-',
    }));
  }

  /**
   * Report: "Employee Vehicle Report"
   */
  async getEmployeeVehiclesReport(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: true,
        currentVehicles: true,
        vehicleAssignments: {
          include: {
            vehicle: true,
          },
          orderBy: { assignmentDate: 'desc' },
        },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName}`,
      company: employee.company.name,
      currentVehicle: employee.currentVehicles[0] || null,
      assignmentHistory: employee.vehicleAssignments.map((a) => ({
        assignmentId: a.id,
        vehicleNumber: a.vehicle.vehicleNumber,
        vehicleModel: a.vehicle.vehicleModel,
        registrationYear: a.vehicle.registrationYear,
        assignedDate: a.assignmentDate,
        returnDate: a.returnDate,
        status: a.status,
        reason: a.returnReason || '-',
        condition: a.returnCondition || '-',
        notes: a.notes,
      })),
    };
  }

  /**
   * Fuel & Vehicle Expense Management
   * Backend calculates Total = Quantity × Rate (or direct amount)
   * Integrates atomically with General Ledger (Debit Fuel Expense 606000, Credit Cash/Bank)
   */
  async createVehicleExpense(
    organizationId: string,
    companyId: string,
    dto: CreateVehicleExpenseDto,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id: dto.vehicleId },
        include: { company: true },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      const targetCompanyId = companyId || vehicle.companyId;
      const targetOrgId = organizationId || vehicle.company.organizationId;

      const qty = Number(dto.quantity || 0);
      const rate = Number(dto.rate || (dto as any).unitPrice || 0);
      const totalAmount =
        qty > 0 && rate > 0
          ? Math.round(qty * rate * 100) / 100
          : Math.round(Number(dto.totalAmount || 0) * 100) / 100;

      if (totalAmount <= 0) {
        throw new BadRequestException('Expense total amount must be greater than zero');
      }

      const voucherNumber = `VEX-${vehicle.vehicleNumber.replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`;
      const expDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();
      const paymentMethod = dto.paymentMethod || 'CASH';

      // Determine GL accounts: Debit 606000 (Vehicle & Fuel Expense), Credit 101000 (Cash) or 102000 (Bank)
      const expenseAccountCode = '606000';
      const paymentAccountCode = paymentMethod === 'BANK' ? '102000' : '101000';

      // 1. Post GL Journal Entry
      const journal = await this.financeService.postJournalEntry(tx, {
        organizationId: targetOrgId,
        companyId: targetCompanyId,
        sourceType: 'EXPENSE',
        sourceId: vehicle.id,
        referenceType: 'VEHICLE_EXPENSE',
        referenceNumber: voucherNumber,
        description: `Vehicle Expense [${vehicle.vehicleNumber}]: ${dto.expenseType || 'FUEL'} (${qty} qty @ ${rate})`,
        entryDate: expDate,
        createdById: userId,
        lines: [
          {
            accountCode: expenseAccountCode,
            debit: totalAmount,
            credit: 0,
            description: `Vehicle expense ${vehicle.vehicleNumber} - ${dto.expenseType || 'FUEL'}`,
          },
          {
            accountCode: paymentAccountCode,
            debit: 0,
            credit: totalAmount,
            description: `Payment for vehicle expense ${vehicle.vehicleNumber}`,
          },
        ],
      });

      // 2. Create VehicleExpense record
      const expense = await tx.vehicleExpense.create({
        data: {
          id: uuidv7(),
          organizationId: targetOrgId,
          companyId: targetCompanyId,
          vehicleId: vehicle.id,
          employeeId: dto.employeeId || vehicle.currentEmployeeId || null,
          voucherNumber,
          expenseType: dto.expenseType || 'FUEL',
          expenseDate: expDate,
          fuelStation: dto.fuelStation?.trim() || null,
          quantity: qty,
          rate,
          totalAmount,
          paymentMethod,
          remarks: dto.remarks || null,
          attachmentUrl: dto.attachmentUrl || null,
          journalEntryId: journal.id,
          status: 'POSTED',
          createdById: userId || null,
        },
        include: {
          vehicle: { select: { id: true, vehicleNumber: true, vehicleModel: true } },
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        },
      });

      this.logger.log(
        `Vehicle expense created: ${voucherNumber} | PKR ${totalAmount} | ${vehicle.vehicleNumber}`,
      );

      return expense;
    });
  }

  /**
   * List vehicle expenses with filtering
   */
  async getVehicleExpenses(filters: {
    companyId?: string;
    vehicleId?: string;
    employeeId?: string;
    expenseType?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const where: any = {};
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.expenseType && filters.expenseType !== 'ALL') where.expenseType = filters.expenseType;

    if (filters.fromDate || filters.toDate) {
      where.expenseDate = {};
      if (filters.fromDate) where.expenseDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.expenseDate.lte = new Date(filters.toDate);
    }

    return this.prisma.vehicleExpense.findMany({
      where,
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, vehicleModel: true, companyName: true } },
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }
}
