/**
 * SHEHSWAR ONE360 - Expense Management Service
 *
 * Implements authoritative Expense Management:
 * - 4 Main Divisions: SALES_EXPENSE, GENERAL_EXPENSE, MISCELLANEOUS_EXPENSE, LIABILITY
 * - Hierarchy: Main Division -> Expense Head -> Sub-Category -> Expense Item
 * - Dynamic user creation & configuration (No hardcoding)
 * - Reporting by Division, Head, Sub-Category, Item & Date periods
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export interface CreateExpenseHeadDto {
  companyId?: string;
  name: string;
  code?: string;
  mainDivision: 'SALES_EXPENSE' | 'GENERAL_EXPENSE' | 'MISCELLANEOUS_EXPENSE' | 'LIABILITY';
  description?: string;
  glAccountId?: string;
}

export interface UpdateExpenseHeadDto {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  glAccountId?: string;
}

export interface CreateExpenseSubCategoryDto {
  companyId?: string;
  expenseHeadId: string;
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateExpenseSubCategoryDto {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateExpenseItemDto {
  companyId?: string;
  expenseHeadId: string;
  subCategoryId?: string;
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateExpenseItemDto {
  name?: string;
  code?: string;
  subCategoryId?: string;
  description?: string;
  isActive?: boolean;
}

export interface ExpenseReportFilters {
  companyId?: string;
  mainDivision?: string;
  headId?: string;
  subCategoryId?: string;
  fromDate?: string;
  toDate?: string;
  period?: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
}

@Injectable()
export class ExpenseManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve company and ensure organization context
   */
  private async resolveCompany(companyId?: string, organizationId?: string) {
    if (companyId && companyId !== 'ALL' && companyId !== 'all') {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company) return company;
    }
    const defaultCompany = await this.prisma.company.findFirst({
      where: organizationId ? { organizationId } : {},
      orderBy: [{ isParent: 'desc' }, { createdAt: 'asc' }],
    });
    if (!defaultCompany) {
      throw new BadRequestException('Valid company required for expense management');
    }
    return defaultCompany;
  }

  /**
   * Seed standard template heads if none exist for company
   */
  async ensureInitialTemplates(companyId: string, organizationId: string) {
    const existingCount = await this.prisma.expenseHead.count({ where: { companyId } });
    if (existingCount > 0) return;

    // Standard business template heads
    const templates = [
      // Sales Expenses
      {
        mainDivision: 'SALES_EXPENSE',
        code: 'EH-SLS-001',
        name: 'Fuel & Transportation',
        description: 'Sales and field operations vehicle fuel and transit',
        subCategories: [
          { code: 'ESC-SLS-001', name: 'Field Travel Fuel', items: ['Sales Staff Bikes', 'Field Territory Vans'] },
          { code: 'ESC-SLS-002', name: 'Operational Travel', items: ['Inter-city Dispatch Travel'] },
        ],
      },
      {
        mainDivision: 'SALES_EXPENSE',
        code: 'EH-SLS-002',
        name: 'Sales Staff Expenses',
        description: 'Sales team operational costs, allowances and salaries',
        subCategories: [
          { code: 'ESC-SLS-003', name: 'Sales Staff Salary', items: ['Monthly Field Sales Salary'] },
          { code: 'ESC-SLS-004', name: 'Daily Field Allowance (TA/DA)', items: ['Food & Lodging Daily Allowance'] },
          { code: 'ESC-SLS-005', name: 'Field Incentives', items: ['Target Achievement Bonus'] },
        ],
      },
      {
        mainDivision: 'SALES_EXPENSE',
        code: 'EH-SLS-003',
        name: 'Vehicle Maintenance & Repair',
        description: 'Sales operations vehicle repair, oil change, tuning',
        subCategories: [
          { code: 'ESC-SLS-006', name: 'Vehicle Periodic Tuning', items: ['Mobil Oil & Filter', 'Routine Tuning'] },
          { code: 'ESC-SLS-007', name: 'Mechanical & Tyres Repair', items: ['Tyre Replacement', 'Brake & Suspension'] },
        ],
      },

      // General / Head Office Expenses
      {
        mainDivision: 'GENERAL_EXPENSE',
        code: 'EH-GEN-001',
        name: 'Internet & Communications',
        description: 'Head office and branch broadband and telecommunications',
        subCategories: [
          {
            code: 'ESC-GEN-001',
            name: 'Office Broadband Connections',
            items: ['PTCL — Head Office', 'StormFiber — Office', 'Nayatel — Branch', 'Jazz Internet — Office'],
          },
          { code: 'ESC-GEN-002', name: 'Mobile Postpaid Bills', items: ['Corporate SIM Allowance'] },
        ],
      },
      {
        mainDivision: 'GENERAL_EXPENSE',
        code: 'EH-GEN-002',
        name: 'Office Equipment',
        description: 'Computing, printing, power backup, and office hardware',
        subCategories: [
          { code: 'ESC-GEN-003', name: 'Computers & Laptops', items: ['Office Laptops', 'Desktop Systems'] },
          { code: 'ESC-GEN-004', name: 'Printers & Cartridges', items: ['LaserJet Printers', 'Toner Cartridges'] },
          { code: 'ESC-GEN-005', name: 'UPS & Power Backup', items: ['Dry Batteries', 'UPS Repair'] },
        ],
      },
      {
        mainDivision: 'GENERAL_EXPENSE',
        code: 'EH-GEN-003',
        name: 'Maintenance & Facility Repairs',
        description: 'Factory and head office infrastructure maintenance',
        subCategories: [
          { code: 'ESC-GEN-006', name: 'Factory Machine Repair', items: ['Filling Line Maintenance', 'Pump Servicing'] },
          { code: 'ESC-GEN-007', name: 'Building & Electrical Maintenance', items: ['Office Repair', 'Electric Fixtures'] },
        ],
      },
      {
        mainDivision: 'GENERAL_EXPENSE',
        code: 'EH-GEN-004',
        name: 'Electricity & Utilities',
        description: 'WAPDA electricity, water, and building utility bills',
        subCategories: [
          { code: 'ESC-GEN-008', name: 'Electricity Utility', items: ['WAPDA Head Office Meter', 'Plant Commercial Meter'] },
          { code: 'ESC-GEN-009', name: 'Water & Gas', items: ['Water Bowser Supply', 'SNGPL Gas Bill'] },
        ],
      },
      {
        mainDivision: 'GENERAL_EXPENSE',
        code: 'EH-GEN-005',
        name: 'Stationery & Printing',
        description: 'Office paper, invoice stationery, vouchers, and supplies',
        subCategories: [
          { code: 'ESC-GEN-010', name: 'Official Stationery', items: ['Invoice Books & Challans', 'A4 Paper Reams'] },
        ],
      },

      // Miscellaneous Expenses
      {
        mainDivision: 'MISCELLANEOUS_EXPENSE',
        code: 'EH-MISC-001',
        name: 'Miscellaneous Operational Expenses',
        description: 'Small operational and office miscellaneous payments',
        subCategories: [
          { code: 'ESC-MIS-001', name: 'Office Refreshments & Tea', items: ['Daily Tea & Kitchen Supplies'] },
          { code: 'ESC-MIS-002', name: 'Courier & Postage', items: ['TCS Courier', 'Post Office Parcels'] },
          { code: 'ESC-MIS-003', name: 'Unplanned Incidentals', items: ['Small Cash Incidentals'] },
        ],
      },

      // Liabilities (Separate from Expenses)
      {
        mainDivision: 'LIABILITY',
        code: 'EH-LIA-001',
        name: 'Short-Term Liabilities',
        description: 'Current payables due within operating cycle',
        subCategories: [
          { code: 'ESC-LIA-001', name: 'Vendor Current Payables', items: ['Raw Material Vendor Payable'] },
          { code: 'ESC-LIA-002', name: 'Dealer Security Deposit / Refund', items: ['Dealer Security Payables'] },
          { code: 'ESC-LIA-003', name: 'Other Current Payables', items: ['Accrued Utility Liabilities'] },
        ],
      },
      {
        mainDivision: 'LIABILITY',
        code: 'EH-LIA-002',
        name: 'Long-Term Liabilities',
        description: 'Long-term borrowings, bank debt, and deferred obligations',
        subCategories: [
          { code: 'ESC-LIA-004', name: 'Bank Long-Term Financing', items: ['Commercial Bank Term Loan'] },
          { code: 'ESC-LIA-005', name: 'Directors Loan', items: ['Director / Sponsor Loan'] },
        ],
      },
      {
        mainDivision: 'LIABILITY',
        code: 'EH-LIA-003',
        name: 'Leasing Liabilities',
        description: 'Vehicle and plant equipment lease liabilities',
        subCategories: [
          { code: 'ESC-LIA-006', name: 'Vehicle Lease Obligation', items: ['Bank Vehicle Lease Payable'] },
          { code: 'ESC-LIA-007', name: 'Machinery Lease Obligation', items: ['Plant Equipment Lease'] },
        ],
      },
      {
        mainDivision: 'LIABILITY',
        code: 'EH-LIA-004',
        name: 'Tax Liabilities',
        description: 'Government statutory tax liabilities',
        subCategories: [
          { code: 'ESC-LIA-008', name: 'Income Tax Payable', items: ['Advance Income Tax Liability'] },
          { code: 'ESC-LIA-009', name: 'Sales Tax / Federal Excise', items: ['Sales Tax Payable (FBR)'] },
          { code: 'ESC-LIA-010', name: 'Withholding Tax Payable', items: ['WHT on Supplier Invoices'] },
        ],
      },
    ];

    for (const t of templates) {
      const head = await this.prisma.expenseHead.create({
        data: {
          organizationId,
          companyId,
          code: t.code,
          name: t.name,
          mainDivision: t.mainDivision,
          description: t.description,
        },
      });

      for (const sc of t.subCategories) {
        const subCat = await this.prisma.expenseSubCategory.create({
          data: {
            organizationId,
            companyId,
            expenseHeadId: head.id,
            code: sc.code,
            name: sc.name,
          },
        });

        for (let i = 0; i < sc.items.length; i++) {
          const itemName = sc.items[i] || `Item ${i + 1}`;
          const itemCode = `${sc.code}-ITM-${String(i + 1).padStart(2, '0')}`;
          await this.prisma.expenseItem.create({
            data: {
              organizationId,
              companyId,
              expenseHeadId: head.id,
              subCategoryId: subCat.id,
              code: itemCode,
              name: itemName,
            },
          });
        }
      }
    }
  }

  /**
   * Get full hierarchy tree grouped by 4 Main Divisions
   */
  async getExpenseHierarchy(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.ensureInitialTemplates(company.id, company.organizationId);

    const heads = await this.prisma.expenseHead.findMany({
      where: { companyId: company.id },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            items: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
            },
          },
        },
        items: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ mainDivision: 'asc' }, { name: 'asc' }],
    });

    const grouped: {
      [key: string]: {
        divisionKey: string;
        label: string;
        description: string;
        type: string;
        headsCount: number;
        subCategoriesCount: number;
        itemsCount: number;
        heads: any[];
      };
    } = {
      SALES_EXPENSE: { divisionKey: 'SALES_EXPENSE', label: 'Sales Expenses', description: 'Fuel, sales staff salary, vehicle maintenance, travel, and field operations', type: 'EXPENSE', headsCount: 0, subCategoriesCount: 0, itemsCount: 0, heads: [] },
      GENERAL_EXPENSE: { divisionKey: 'GENERAL_EXPENSE', label: 'General / Head Office Expenses', description: 'Internet, electricity, office equipment, repairs, utilities, and general administration', type: 'EXPENSE', headsCount: 0, subCategoriesCount: 0, itemsCount: 0, heads: [] },
      MISCELLANEOUS_EXPENSE: { divisionKey: 'MISCELLANEOUS_EXPENSE', label: 'Miscellaneous Expenses', description: 'Small operational expenses, refreshments, postage, and unplanned operational costs', type: 'EXPENSE', headsCount: 0, subCategoriesCount: 0, itemsCount: 0, heads: [] },
      LIABILITY: { divisionKey: 'LIABILITY', label: 'Liabilities', description: 'Strictly separate from expenses: Short-term, long-term, leasing, and tax liabilities', type: 'LIABILITY', headsCount: 0, subCategoriesCount: 0, itemsCount: 0, heads: [] },
    };

    for (const head of heads) {
      const div = head.mainDivision || 'GENERAL_EXPENSE';
      if (!grouped[div]) {
        grouped[div] = {
          divisionKey: div,
          label: div,
          description: '',
          type: 'EXPENSE',
          headsCount: 0,
          subCategoriesCount: 0,
          itemsCount: 0,
          heads: [],
        };
      }
      grouped[div].heads.push(head);
      grouped[div].headsCount += 1;
      grouped[div].subCategoriesCount += head.subCategories.length;
      grouped[div].itemsCount += head.items.length;
    }

    return {
      company: { id: company.id, code: company.code, name: company.name },
      totalHeads: heads.length,
      divisions: Object.values(grouped),
    };
  }

  /**
   * List Expense Heads with optional filters
   */
  async getHeads(companyId?: string, mainDivision?: string, isActive?: boolean) {
    const company = await this.resolveCompany(companyId);
    await this.ensureInitialTemplates(company.id, company.organizationId);

    const where: any = { companyId: company.id };
    if (mainDivision && mainDivision !== 'ALL') where.mainDivision = mainDivision;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.expenseHead.findMany({
      where,
      include: {
        _count: {
          select: { subCategories: true, items: true, financialTransactions: true },
        },
      },
      orderBy: [{ mainDivision: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Create new Expense Head with auto-generated code
   */
  async createHead(companyId: string | undefined, dto: CreateExpenseHeadDto, _userId?: string) {
    const company = await this.resolveCompany(companyId || dto.companyId);
    const division = dto.mainDivision || 'GENERAL_EXPENSE';

    let code = dto.code?.trim().toUpperCase();
    if (!code) {
      const prefix = division === 'SALES_EXPENSE'
        ? 'EH-SLS'
        : division === 'GENERAL_EXPENSE'
          ? 'EH-GEN'
          : division === 'MISCELLANEOUS_EXPENSE'
            ? 'EH-MIS'
            : 'EH-LIA';

      const count = await this.prisma.expenseHead.count({
        where: { companyId: company.id, mainDivision: division },
      });
      code = `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }

    // Check duplicate code
    const existing = await this.prisma.expenseHead.findUnique({
      where: { companyId_code: { companyId: company.id, code } },
    });
    if (existing) {
      code = `${code}-${Date.now().toString().slice(-4)}`;
    }

    return this.prisma.expenseHead.create({
      data: {
        organizationId: company.organizationId,
        companyId: company.id,
        code,
        name: dto.name.trim(),
        mainDivision: division,
        description: dto.description?.trim() || null,
        glAccountId: dto.glAccountId || null,
      },
    });
  }

  /**
   * Update Expense Head
   */
  async updateHead(id: string, _companyId: string | undefined, dto: UpdateExpenseHeadDto) {
    const head = await this.prisma.expenseHead.findUnique({ where: { id } });
    if (!head) throw new NotFoundException('Expense head not found');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.code) updateData.code = dto.code.trim().toUpperCase();
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.glAccountId !== undefined) updateData.glAccountId = dto.glAccountId || null;

    return this.prisma.expenseHead.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete or deactivate Expense Head
   */
  async deleteHead(id: string, _companyId?: string) {
    const head = await this.prisma.expenseHead.findUnique({
      where: { id },
      include: { _count: { select: { financialTransactions: true, subCategories: true, items: true } } },
    });
    if (!head) throw new NotFoundException('Expense head not found');

    if (head._count.financialTransactions > 0) {
      // Soft-deactivate if transactions exist to preserve financial integrity
      return this.prisma.expenseHead.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.expenseHead.delete({ where: { id } });
  }

  /**
   * Create Sub-Category under a Head
   */
  async createSubCategory(_companyId: string | undefined, dto: CreateExpenseSubCategoryDto, _userId?: string) {
    const head = await this.prisma.expenseHead.findUnique({ where: { id: dto.expenseHeadId } });
    if (!head) throw new NotFoundException('Parent expense head not found');

    let code = dto.code?.trim().toUpperCase();
    if (!code) {
      const count = await this.prisma.expenseSubCategory.count({
        where: { expenseHeadId: head.id },
      });
      code = `${head.code}-SC-${String(count + 1).padStart(2, '0')}`;
    }

    const existing = await this.prisma.expenseSubCategory.findUnique({
      where: { companyId_code: { companyId: head.companyId, code } },
    });
    if (existing) {
      code = `${code}-${Date.now().toString().slice(-3)}`;
    }

    return this.prisma.expenseSubCategory.create({
      data: {
        organizationId: head.organizationId,
        companyId: head.companyId,
        expenseHeadId: head.id,
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  /**
   * Update Sub-Category
   */
  async updateSubCategory(id: string, _companyId: string | undefined, dto: UpdateExpenseSubCategoryDto) {
    const sc = await this.prisma.expenseSubCategory.findUnique({ where: { id } });
    if (!sc) throw new NotFoundException('Expense sub-category not found');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.code) updateData.code = dto.code.trim().toUpperCase();
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.expenseSubCategory.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete or deactivate Sub-Category
   */
  async deleteSubCategory(id: string) {
    const sc = await this.prisma.expenseSubCategory.findUnique({
      where: { id },
      include: { _count: { select: { financialTransactions: true, items: true } } },
    });
    if (!sc) throw new NotFoundException('Sub-category not found');

    if (sc._count.financialTransactions > 0) {
      return this.prisma.expenseSubCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.expenseSubCategory.delete({ where: { id } });
  }

  /**
   * Create Expense Item under Head / Sub-Category
   */
  async createExpenseItem(_companyId: string | undefined, dto: CreateExpenseItemDto, _userId?: string) {
    const head = await this.prisma.expenseHead.findUnique({ where: { id: dto.expenseHeadId } });
    if (!head) throw new NotFoundException('Parent expense head not found');

    let code = dto.code?.trim().toUpperCase();
    if (!code) {
      const count = await this.prisma.expenseItem.count({
        where: { expenseHeadId: head.id },
      });
      code = `${head.code}-ITM-${String(count + 1).padStart(2, '0')}`;
    }

    const existing = await this.prisma.expenseItem.findUnique({
      where: { companyId_code: { companyId: head.companyId, code } },
    });
    if (existing) {
      code = `${code}-${Date.now().toString().slice(-3)}`;
    }

    return this.prisma.expenseItem.create({
      data: {
        organizationId: head.organizationId,
        companyId: head.companyId,
        expenseHeadId: head.id,
        subCategoryId: dto.subCategoryId || null,
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  /**
   * Update Expense Item
   */
  async updateExpenseItem(id: string, _companyId: string | undefined, dto: UpdateExpenseItemDto) {
    const item = await this.prisma.expenseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Expense item not found');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.code) updateData.code = dto.code.trim().toUpperCase();
    if (dto.subCategoryId !== undefined) updateData.subCategoryId = dto.subCategoryId || null;
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.expenseItem.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete or deactivate Expense Item
   */
  async deleteExpenseItem(id: string) {
    const item = await this.prisma.expenseItem.findUnique({
      where: { id },
      include: { _count: { select: { financialTransactions: true } } },
    });
    if (!item) throw new NotFoundException('Expense item not found');

    if (item._count.financialTransactions > 0) {
      return this.prisma.expenseItem.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.expenseItem.delete({ where: { id } });
  }

  /**
   * Expense & Liability Reports & Analytics
   * Provides complete breakdown by Main Division, Head, Sub-Category, and Item
   */
  async getExpenseReport(filters: ExpenseReportFilters) {
    const company = await this.resolveCompany(filters.companyId);

    const where: any = {
      companyId: company.id,
      transactionType: 'CASH_PAYMENT',
      paymentMethod: 'CASH',
    };

    if (filters.mainDivision && filters.mainDivision !== 'ALL') {
      where.mainDivision = filters.mainDivision;
    }
    if (filters.headId && filters.headId !== 'ALL') {
      where.expenseHeadId = filters.headId;
    }
    if (filters.subCategoryId && filters.subCategoryId !== 'ALL') {
      where.expenseSubCategoryId = filters.subCategoryId;
    }

    if (filters.fromDate || filters.toDate) {
      where.transactionDate = {};
      if (filters.fromDate) where.transactionDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.transactionDate.lte = new Date(filters.toDate + 'T23:59:59.999Z');
    }

    const txRecords = await this.prisma.financialTransaction.findMany({
      where,
      include: {
        expenseHead: { select: { id: true, code: true, name: true, mainDivision: true } },
        expenseSubCategory: { select: { id: true, code: true, name: true } },
        expenseItem: { select: { id: true, code: true, name: true } },
        account: { select: { id: true, accountCode: true, accountName: true } },
        contraAccount: { select: { id: true, accountCode: true, accountName: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 2000,
    });

    let totalExpenseAmount = 0;
    let totalLiabilityAmount = 0;
    let salesExpensesTotal = 0;
    let generalExpensesTotal = 0;
    let miscExpensesTotal = 0;

    // Build hierarchical tree aggregation:
    // Division -> Head -> SubCategory -> Item
    const divisionTree: {
      [divKey: string]: {
        divisionKey: string;
        label: string;
        totalAmount: number;
        transactionCount: number;
        heads: {
          [headKey: string]: {
            headId?: string;
            headCode?: string;
            headName: string;
            totalAmount: number;
            transactionCount: number;
            subCategories: {
              [scKey: string]: {
                subCategoryId?: string;
                subCategoryCode?: string;
                subCategoryName: string;
                totalAmount: number;
                transactionCount: number;
                items: {
                  [itmKey: string]: {
                    itemId?: string;
                    itemCode?: string;
                    itemName: string;
                    totalAmount: number;
                    transactionCount: number;
                  };
                };
              };
            };
          };
        };
      };
    } = {
      SALES_EXPENSE: { divisionKey: 'SALES_EXPENSE', label: 'Sales Expenses', totalAmount: 0, transactionCount: 0, heads: {} },
      GENERAL_EXPENSE: { divisionKey: 'GENERAL_EXPENSE', label: 'General / Head Office Expenses', totalAmount: 0, transactionCount: 0, heads: {} },
      MISCELLANEOUS_EXPENSE: { divisionKey: 'MISCELLANEOUS_EXPENSE', label: 'Miscellaneous Expenses', totalAmount: 0, transactionCount: 0, heads: {} },
      LIABILITY: { divisionKey: 'LIABILITY', label: 'Liabilities', totalAmount: 0, transactionCount: 0, heads: {} },
    };

    const parsedTransactions = txRecords.map((r) => {
      const amount = Number(r.amount);

      // Determine main division
      let div = r.mainDivision || r.expenseHead?.mainDivision;
      if (!div) {
        if (r.partyType === 'VENDOR' || (r.remarks && /liability/i.test(r.remarks))) {
          div = 'LIABILITY';
        } else if (r.remarks && /sales|field|fuel/i.test(r.remarks)) {
          div = 'SALES_EXPENSE';
        } else {
          div = 'GENERAL_EXPENSE';
        }
      }

      // Determine Head
      let hName = r.headName || r.expenseHead?.name;
      if (!hName && r.remarks) {
        const m = r.remarks.match(/\[Head:\s*([^\]]+)\]/i);
        if (m && m[1]?.trim()) hName = m[1].trim();
      }
      if (!hName) {
        if (div === 'LIABILITY') hName = 'Short-Term Liabilities';
        else if (r.partyType === 'VENDOR') hName = 'Vendor Payment';
        else hName = 'General Operating';
      }

      // Determine Sub-Category
      const scName = r.subCategoryName || r.expenseSubCategory?.name || 'General / Unclassified';

      // Determine Item
      const itmName = r.expenseItemName || r.expenseItem?.name || r.partyName || 'Cash Expense Item';

      if (div === 'LIABILITY') {
        totalLiabilityAmount += amount;
      } else {
        totalExpenseAmount += amount;
        if (div === 'SALES_EXPENSE') salesExpensesTotal += amount;
        else if (div === 'MISCELLANEOUS_EXPENSE') miscExpensesTotal += amount;
        else generalExpensesTotal += amount;
      }

      // Populate Tree
      if (!divisionTree[div]) {
        divisionTree[div] = { divisionKey: div, label: div, totalAmount: 0, transactionCount: 0, heads: {} };
      }
      const divNode = divisionTree[div]!;
      divNode.totalAmount += amount;
      divNode.transactionCount += 1;

      const headsObj = divNode.heads;
      if (!headsObj[hName]) {
        headsObj[hName] = {
          headId: r.expenseHeadId || undefined,
          headCode: r.expenseHead?.code || undefined,
          headName: hName,
          totalAmount: 0,
          transactionCount: 0,
          subCategories: {},
        };
      }
      const headNode = headsObj[hName]!;
      headNode.totalAmount += amount;
      headNode.transactionCount += 1;

      const scObj = headNode.subCategories;
      if (!scObj[scName]) {
        scObj[scName] = {
          subCategoryId: r.expenseSubCategoryId || undefined,
          subCategoryCode: r.expenseSubCategory?.code || undefined,
          subCategoryName: scName,
          totalAmount: 0,
          transactionCount: 0,
          items: {},
        };
      }
      const scNode = scObj[scName]!;
      scNode.totalAmount += amount;
      scNode.transactionCount += 1;

      const itmObj = scNode.items;
      if (!itmObj[itmName]) {
        itmObj[itmName] = {
          itemId: r.expenseItemId || undefined,
          itemCode: r.expenseItem?.code || undefined,
          itemName: itmName,
          totalAmount: 0,
          transactionCount: 0,
        };
      }
      const itmNode = itmObj[itmName]!;
      itmNode.totalAmount += amount;
      itmNode.transactionCount += 1;

      return {
        id: r.id,
        voucherNumber: r.voucherNumber,
        transactionDate: r.transactionDate,
        amount,
        mainDivision: div,
        headName: hName,
        subCategoryName: scName,
        expenseItemName: itmName,
        partyName: r.partyName,
        partyType: r.partyType,
        remarks: r.remarks,
        paymentMethod: r.paymentMethod,
        accountName: r.account?.accountName || 'Cash Account',
        contraAccountName: r.contraAccount?.accountName || 'Expense Account',
      };
    });

    // Transform division tree to clean arrays for frontend consumption
    const divisionsList = Object.values(divisionTree).map((d) => ({
      divisionKey: d.divisionKey,
      label: d.label,
      totalAmount: d.totalAmount,
      transactionCount: d.transactionCount,
      percentage: totalExpenseAmount + totalLiabilityAmount > 0
        ? Math.round((d.totalAmount / (totalExpenseAmount + totalLiabilityAmount)) * 1000) / 10
        : 0,
      heads: Object.values(d.heads).map((h) => ({
        headId: h.headId,
        headCode: h.headCode,
        headName: h.headName,
        totalAmount: h.totalAmount,
        transactionCount: h.transactionCount,
        subCategories: Object.values(h.subCategories).map((sc) => ({
          subCategoryId: sc.subCategoryId,
          subCategoryCode: sc.subCategoryCode,
          subCategoryName: sc.subCategoryName,
          totalAmount: sc.totalAmount,
          transactionCount: sc.transactionCount,
          items: Object.values(sc.items),
        })),
      })),
    }));

    return {
      company: { id: company.id, code: company.code, name: company.name },
      summary: {
        totalExpenseAmount,
        totalLiabilityAmount,
        salesExpensesTotal,
        generalExpensesTotal,
        miscExpensesTotal,
        totalTransactions: txRecords.length,
      },
      divisions: divisionsList,
      transactions: parsedTransactions,
    };
  }
}
