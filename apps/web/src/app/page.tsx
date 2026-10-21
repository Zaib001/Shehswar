'use client';

/**
 * SHEHSWAR ONE360 - DESIGN SYSTEM & ENTERPRISE UX FOUNDATION SHOWROOM
 *
 * Interactive living showroom showcasing:
 * 1. Executive Dashboard Template
 * 2. Enterprise List Page Template
 * 3. 360-Degree Detail Page Template
 * 4. Multi-Section Create/Edit Form Template
 * 5. Complete Component Library & Design Tokens Explorer
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import LoginPage from './login/page';
import { AppShell } from '../components/layout/app-shell';
import {
  Button,
  Input,
  CurrencyInput,
  QuantityInput,
  PercentageInput,
  Select,
  Textarea,
  Checkbox,
  Switch,
  Badge,
  StatusBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  KpiCard,
  Modal,
  Drawer,
  Tabs,
  WorkflowTracker,
  Timeline,
  Skeleton,
  TableSkeleton,
  EmptyState,
  ErrorState,
  FileUpload,
  UploadedFile,
} from '../components/ui';
import {
  BarChart,
  LineChart,
  DonutChart,
  ProgressMetric,
} from '../components/charts';
import {
  ListPageTemplate,
  DetailPageTemplate,
  FormPageTemplate,
  DashboardTemplate,
} from '../components/templates';
import {
  IconDashboard,
  IconProducts,
  IconInventory,
  IconProduction,
  IconQC,
  IconPlus,
  IconDownload,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconFileText,
} from '../components/icons';
import { useToast } from '../context/toast-context';
import {
  OrganizationsView,
  CompaniesView,
  PlantsView,
  BranchesView,
  DepartmentsView,
  WarehousesView,
  UsersView,
  RolesView,
  PermissionMatrixView,
  EmployeesView,
  DocumentNumberingView,
  SystemSettingsView,
  AuditLogsView,
  ApprovalRulesView,
  NotificationCenterView,
  MarketManagementView,
  UomView,
  MaterialCategoriesView,
  RawMaterialsView,
  PackingMaterialsView,
  ProductCategoriesView,
  PackSizesView,
  FinishedProductsView,
  WarehouseLocationsView,
  ProductionLinesView,
  ShiftsView,
  PaymentTermsView,
  TaxCategoriesView,
  ReasonCodesView,
  QcSpecificationsView,
  FormulaBomsView,
  IntercompanyPricingView,
} from '../components/master-data';
import {
  VendorsView,
  PurchaseRequisitionsView,
  RfqView,
  QuotationsView,
  QuotationComparisonView,
  GoodsReceiptView,
  VendorPerformanceView,
} from '../components/procurement';
import {
  PurchasesView,
  PurchaseOrdersView,
  PurchaseReturnsView,
  DealersView,
  SalesOrdersView,
  SalesInvoicesView,
  SalesReturnsView,
  DealerPaymentsView,
  WarehouseStockView,
  ProductCostingView,
  GatePassesView,
  IntercompanyTransferView,
  MarketPerformanceView,
  PricingManagementView,
  FinanceView,
  CreditControlView,
  ControlAuditView,
  ConsolidatedReportingView,
  VehiclesView,
  FinancialTransactionsView,
  ProvisionalReceiptsView,
} from '../components/operations';
import { ExecutiveDashboard } from '../components/dashboard';

function isRoutePermittedForUser(route: string, user: any): { permitted: boolean; requiredPermission?: string } {
  if (!user) return { permitted: false };
  if (user.isSuperAdmin) return { permitted: true };

  const permissions: string[] = user.permissions || [];

  switch (route) {
    case 'procurement-vendors':
      return { permitted: permissions.includes('vendor:view'), requiredPermission: 'vendor:view' };
    case 'procurement-pr':
      return { permitted: permissions.includes('purchase_requisition:view'), requiredPermission: 'purchase_requisition:view' };
    case 'procurement-rfq':
      return { permitted: permissions.includes('rfq:view'), requiredPermission: 'rfq:view' };
    case 'procurement-quotations':
      return { permitted: permissions.includes('quotation:view'), requiredPermission: 'quotation:view' };
    case 'procurement-comparison':
      return { permitted: permissions.includes('quotation_comparison:view'), requiredPermission: 'quotation_comparison:view' };
    case 'procurement-po':
      return { permitted: permissions.includes('purchase_order:view'), requiredPermission: 'purchase_order:view' };
    case 'procurement-grn':
      return { permitted: permissions.includes('goods_receipt:view'), requiredPermission: 'goods_receipt:view' };
    case 'procurement-performance':
      return { permitted: permissions.includes('vendor_performance:view'), requiredPermission: 'vendor_performance:view' };
    case 'audit-logs':
      return { permitted: permissions.includes('audit_log:view'), requiredPermission: 'audit_log:view' };
    case 'approvals':
      return {
        permitted: permissions.includes('approval_workflow:view') || permissions.includes('approval_workflow:approve'),
        requiredPermission: 'approval_workflow:view',
      };
    case 'notifications':
      return { permitted: true };
    case 'organizations':
    case 'companies':
    case 'plants':
    case 'branches':
    case 'departments':
    case 'warehouses':
    case 'employees':
    case 'uoms':
    case 'material-categories':
    case 'raw-materials':
    case 'packing-materials':
    case 'product-categories':
    case 'pack-sizes':
    case 'finished-products':
    case 'formula-boms':
    case 'qc-specifications':
    case 'production-lines':
    case 'shifts':
    case 'warehouse-locations':
    case 'payment-terms':
    case 'tax-categories':
    case 'reason-codes':
    case 'intercompany-pricing':
      return {
        permitted: permissions.includes('company:view') || permissions.includes('organization:view'),
        requiredPermission: 'company:view',
      };
    case 'users':
    case 'roles':
    case 'permissions':
      return {
        permitted: permissions.includes('user:view') || permissions.includes('role:view'),
        requiredPermission: 'user:view',
      };
    case 'document-numbering':
    case 'settings':
      return {
        permitted: permissions.includes('setting:view') || permissions.includes('document_sequence:view'),
        requiredPermission: 'setting:view',
      };
    case 'dashboard':
      return { permitted: true };
    case 'purchases':
    case 'purchase-orders':
    case 'purchase-returns':
    case 'dealers':
    case 'rate-lists':
    case 'sales-orders':
    case 'sales-invoices':
    case 'sales-returns':
    case 'dealer-payments':
    case 'market-management':
    case 'market-performance':
    case 'intercompany-transfers':
    case 'warehouse-stock':
    case 'product-costing':
    case 'gate-passes':
    case 'finance':
    case 'financial-transactions':
    case 'provisional-receipts':
    case 'vehicles':
    case 'credit-control':
    case 'percentage-credit-report':
    case 'employee-cost':
    case 'control-audit':
    case 'consolidated-reporting':
      return { permitted: true };
    case 'showroom':
      return { permitted: user.isSuperAdmin, requiredPermission: 'admin:super_admin' };
    default:
      return { permitted: false };
  }
}

export default function ShowroomPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { showToast } = useToast();

  // Active showcase archetype tab
  const [activeView, setActiveView] = useState<
    'dashboard' | 'list' | 'detail' | 'form' | 'components'
  >('dashboard');

  // Dynamic route initialized to user's permitted domain
  const [currentRoute, setCurrentRoute] = useState<string>('procurement-vendors');
  const [selectedPoForConversion, setSelectedPoForConversion] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.isSuperAdmin) {
      setCurrentRoute('dashboard');
    } else if (user.roles?.includes('ROLE_PROCUREMENT_MGR')) {
      setCurrentRoute('procurement-vendors');
    } else if (user.roles?.includes('ROLE_FINANCE_MGR')) {
      setCurrentRoute('procurement-po');
    } else if (user.roles?.includes('ROLE_DEPT_USER')) {
      setCurrentRoute('procurement-pr');
    }
  }, [user]);

  // Interactive modal & drawer states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Form State Demo
  const [formQuantity, setFormQuantity] = useState(500);
  const [formPrice, setFormPrice] = useState<string | number>('125000');
  const [formTax, setFormTax] = useState<string | number>('18');
  const [formFiles, setFormFiles] = useState<UploadedFile[]>([
    {
      id: 'f1',
      name: 'MSDS_Chemical_Safety_Sheet_Rev4.pdf',
      size: 2450000,
      type: 'application/pdf',
      progress: 100,
    },
    {
      id: 'f2',
      name: 'Supplier_Purity_Analysis_Certificate.pdf',
      size: 1120000,
      type: 'application/pdf',
      progress: 100,
    },
  ]);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Table selection state demo
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  // Sample Products / Batches Master Data
  const sampleBatches = [
    {
      id: 'BCH-2026-001',
      productName: 'Agricultural Grade Urea 46% N',
      batchNumber: 'UB-4401',
      category: 'Fertilizer Base',
      yieldTons: 120.5,
      costPkr: '4,820,000',
      purity: '99.4%',
      status: 'approved',
      warehouse: 'Warehouse A (Multan)',
      createdAt: '2026-09-24',
    },
    {
      id: 'BCH-2026-002',
      productName: 'Monocalcium Phosphate P21%',
      batchNumber: 'MCP-992',
      category: 'Feed Chemical',
      yieldTons: 85.0,
      costPkr: '6,120,000',
      purity: '98.8%',
      status: 'in_production',
      warehouse: 'Processing Plant 2',
      createdAt: '2026-09-25',
    },
    {
      id: 'BCH-2026-003',
      productName: 'Industrial Sulfuric Acid 98%',
      batchNumber: 'SA-1029',
      category: 'Raw Acid',
      yieldTons: 250.0,
      costPkr: '3,750,000',
      purity: '98.1%',
      status: 'quarantine',
      warehouse: 'Tank Yard Gamma',
      createdAt: '2026-09-25',
    },
    {
      id: 'BCH-2026-004',
      productName: 'Potassium Nitrate Soluble Powder',
      batchNumber: 'PN-3310',
      category: 'Specialty Nutrients',
      yieldTons: 40.0,
      costPkr: '5,200,000',
      purity: '99.7%',
      status: 'released',
      warehouse: 'Central Finished Goods',
      createdAt: '2026-09-26',
    },
    {
      id: 'BCH-2026-005',
      productName: 'Zinc Sulfate Monohydrate 35%',
      batchNumber: 'ZS-0442',
      category: 'Micronutrient',
      yieldTons: 65.0,
      costPkr: '2,925,000',
      purity: '97.9%',
      status: 'pending_approval',
      warehouse: 'Warehouse B (Faisalabad)',
      createdAt: '2026-09-26',
    },
  ];

  // Table Columns Definition
  const batchColumns = [
    {
      key: 'batchNumber',
      header: 'Batch ID',
      width: '130px',
      cell: (item: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
          {item.batchNumber}
        </span>
      ),
    },
    {
      key: 'productName',
      header: 'Product / Chemical Entity',
      cell: (item: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</div>
          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
            Category: {item.category}
          </div>
        </div>
      ),
    },
    {
      key: 'yieldTons',
      header: 'Yield (Tons)',
      align: 'right' as const,
      cell: (item: any) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{item.yieldTons.toFixed(1)} MT</span>
      ),
    },
    {
      key: 'costPkr',
      header: 'Cost Valuation (PKR)',
      align: 'right' as const,
      cell: (item: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Rs. {item.costPkr}</span>
      ),
    },
    {
      key: 'purity',
      header: 'Assay Purity',
      align: 'center' as const,
      cell: (item: any) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success-500)',
          }}
        >
          {item.purity}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Workflow Status',
      cell: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: 'warehouse',
      header: 'Location / Storage',
      cell: (item: any) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
          {item.warehouse}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right' as const,
      cell: (item: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRecord(item);
            setIsDrawerOpen(true);
          }}
        >
          Inspect
        </Button>
      ),
    },
  ];

  // Handler for form submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForm(true);

    setTimeout(() => {
      setIsSubmittingForm(false);
      showToast({
        type: 'success',
        title: 'Requisition Submitted Successfully',
        message: 'Requisition PR-2026-904 has been routed to Executive Management for approval.',
      });
    }, 1000);
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-canvas)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            border: '3px solid var(--border-default)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Verifying Shehswar ONE360 Security Context...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  const permissionCheck = isRoutePermittedForUser(currentRoute, user);

  return (
    <AppShell activeRoute={currentRoute} onNavigate={(r) => {
      setCurrentRoute(r);
      if (['dashboard', 'list', 'detail', 'form', 'components'].includes(r)) {
        setActiveView(r as any);
      }
    }}>


      {/* Role-Based Route Permission Guard */}
      {!permissionCheck.permitted ? (
        <div style={{ padding: '60px 24px', maxWidth: '580px', margin: '40px auto', textAlign: 'center' }}>
          <Card style={{ padding: '36px 28px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'var(--bg-surface-raised)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <IconAlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              403 - Module Access Restricted
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Your active account <strong>{user?.firstName} {user?.lastName}</strong> ({user?.roles?.[0] || 'AUTHORIZED_USER'}) does not have permission to view <strong>{currentRoute}</strong>.
            </p>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', fontFamily: 'monospace' }}>
              Required Permission: {permissionCheck.requiredPermission}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (user?.roles?.includes('ROLE_PROCUREMENT_MGR')) setCurrentRoute('procurement-vendors');
                  else if (user?.roles?.includes('ROLE_FINANCE_MGR')) setCurrentRoute('procurement-po');
                  else if (user?.roles?.includes('ROLE_DEPT_USER')) setCurrentRoute('procurement-pr');
                  else setCurrentRoute('organizations');
                }}
              >
                Go to My Primary Workspace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout().then(() => {
                    window.location.href = '/login';
                  });
                }}
              >
                Sign Out / Switch Account
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Executive Operational Dashboard (Live Real PostgreSQL Data) */}
          {currentRoute === 'dashboard' && <ExecutiveDashboard onNavigate={setCurrentRoute} />}

          {/* Phase 3 Conditional View Rendering */}
          {currentRoute === 'organizations' && <OrganizationsView />}
          {currentRoute === 'companies' && <CompaniesView />}
          {currentRoute === 'plants' && <PlantsView />}
          {currentRoute === 'branches' && <BranchesView />}
          {currentRoute === 'departments' && <DepartmentsView />}
          {currentRoute === 'warehouses' && <WarehousesView />}
          {currentRoute === 'employees' && <EmployeesView />}
          {currentRoute === 'users' && <UsersView />}
          {currentRoute === 'roles' && <RolesView />}
          {currentRoute === 'permissions' && <PermissionMatrixView />}
          {currentRoute === 'document-numbering' && <DocumentNumberingView />}
          {currentRoute === 'settings' && <SystemSettingsView />}
          {currentRoute === 'audit-logs' && <AuditLogsView />}
          {currentRoute === 'approvals' && <ApprovalRulesView />}
          {currentRoute === 'notifications' && <NotificationCenterView />}

          {/* Phase 4.5 — Materials Master */}
          {currentRoute === 'uoms' && <UomView />}
          {currentRoute === 'material-categories' && <MaterialCategoriesView />}
          {currentRoute === 'raw-materials' && <RawMaterialsView />}
          {currentRoute === 'packing-materials' && <PackingMaterialsView />}

          {/* Phase 4.5 — Products Master */}
          {currentRoute === 'product-categories' && <ProductCategoriesView />}
          {currentRoute === 'pack-sizes' && <PackSizesView />}
          {currentRoute === 'finished-products' && <FinishedProductsView />}
          {currentRoute === 'formula-boms' && <FormulaBomsView />}
          {currentRoute === 'qc-specifications' && <QcSpecificationsView />}

          {/* Phase 4.5 — Manufacturing Master */}
          {currentRoute === 'production-lines' && <ProductionLinesView />}
          {currentRoute === 'shifts' && <ShiftsView />}
          {currentRoute === 'warehouse-locations' && <WarehouseLocationsView />}

          {/* Phase 4.5 — Finance & Tax Master */}
          {currentRoute === 'payment-terms' && <PaymentTermsView />}
          {currentRoute === 'tax-categories' && <TaxCategoriesView />}
          {currentRoute === 'reason-codes' && <ReasonCodesView />}
          {currentRoute === 'intercompany-pricing' && <IntercompanyPricingView />}

          {/* Phase 4 Procurement Module View Rendering */}
          {(currentRoute === 'procurement-vendors' || currentRoute === 'vendors') && <VendorsView />}
          {currentRoute === 'procurement-pr' && <PurchaseRequisitionsView />}
          {currentRoute === 'procurement-rfq' && <RfqView />}
          {currentRoute === 'procurement-quotations' && <QuotationsView />}
          {currentRoute === 'procurement-comparison' && (
            <QuotationComparisonView onNavigateToPoCreate={() => setCurrentRoute('procurement-po')} />
          )}
          {currentRoute === 'procurement-po' && <PurchaseOrdersView />}
          {currentRoute === 'procurement-grn' && <GoodsReceiptView />}
          {currentRoute === 'procurement-performance' && <VendorPerformanceView />}

          {/* Canonical Operations Modules */}
          {currentRoute === 'purchase-orders' && (
            <PurchaseOrdersView
              onConvertToPurchase={(poData) => {
                setSelectedPoForConversion(poData);
                setCurrentRoute('purchases');
              }}
            />
          )}
          {currentRoute === 'purchases' && (
            <PurchasesView
              initialPoData={selectedPoForConversion}
              onClearPoData={() => setSelectedPoForConversion(null)}
            />
          )}
          {currentRoute === 'purchase-returns' && <PurchaseReturnsView />}
          {currentRoute === 'rate-lists' && <PricingManagementView />}
          {currentRoute === 'sales-orders' && (
            <SalesOrdersView onNavigateToInvoices={() => setCurrentRoute('sales-invoices')} />
          )}
          {currentRoute === 'sales-invoices' && (
            <SalesInvoicesView onNavigateToOrders={() => setCurrentRoute('sales-orders')} />
          )}
          {currentRoute === 'dealers' && <DealersView />}
          {currentRoute === 'market-management' && <MarketManagementView />}
          {currentRoute === 'market-performance' && <MarketPerformanceView />}
          {currentRoute === 'sales-returns' && <SalesReturnsView />}
          {currentRoute === 'dealer-payments' && <DealerPaymentsView />}
          {currentRoute === 'intercompany-transfers' && <IntercompanyTransferView />}
          {currentRoute === 'warehouse-stock' && <WarehouseStockView />}
          {currentRoute === 'product-costing' && <ProductCostingView />}
          {currentRoute === 'gate-passes' && <GatePassesView />}
          {currentRoute === 'finance' && <FinanceView />}
          {currentRoute === 'financial-transactions' && <FinancialTransactionsView />}
          {currentRoute === 'provisional-receipts' && <ProvisionalReceiptsView />}
          {currentRoute === 'vehicles' && <VehiclesView />}
          {currentRoute === 'credit-control' && <CreditControlView defaultTab="dashboard" />}
          {currentRoute === 'percentage-credit-report' && <CreditControlView defaultTab="percentage-credit" />}
          {currentRoute === 'employee-cost' && <EmployeesView defaultTab="cost-control" />}
          {currentRoute === 'control-audit' && <ControlAuditView />}
          {currentRoute === 'consolidated-reporting' && <ConsolidatedReportingView />}
        </>
      )}

      {/* Render Showroom if active */}
      {currentRoute === 'showroom' && (
        <div>
      {/* Showroom Top Mode Selector Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: 'var(--font-size-2xs)',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            PHASE 2 FOUNDATION
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Design System & Enterprise UX Archetype Explorer
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <Button
            variant={activeView === 'dashboard' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('dashboard')}
          >
            1. Executive Dashboard
          </Button>
          <Button
            variant={activeView === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('list')}
          >
            2. List Page Template
          </Button>
          <Button
            variant={activeView === 'detail' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('detail')}
          >
            3. Detail Page Template
          </Button>
          <Button
            variant={activeView === 'form' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('form')}
          >
            4. Create/Edit Form Template
          </Button>
          <Button
            variant={activeView === 'components' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('components')}
          >
            5. Component Library
          </Button>
        </div>
      </div>

      {/* =====================================================================
          1. EXECUTIVE DASHBOARD ARCHETYPE
          ===================================================================== */}
      {activeView === 'dashboard' && (
        <DashboardTemplate
          title="Executive Operational Dashboard"
          subtitle="Real-time multi-entity performance metrics, chemical batch output, inventory valuation, and pending compliance approvals."
          badge={<StatusBadge status="approved">Enterprise Live</StatusBadge>}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                startIcon={<IconRefresh size={14} />}
                onClick={() =>
                  showToast({
                    type: 'info',
                    title: 'Metrics Synced',
                    message: 'All telemetry and GL balances refreshed from PostgreSQL core.',
                  })
                }
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                startIcon={<IconPlus size={14} />}
                onClick={() => setActiveView('form')}
              >
                New Requisition
              </Button>
            </>
          }
          kpis={[
            {
              title: 'Total Monthly Revenue',
              value: 'PKR 184.2M',
              delta: { value: '+12.4%', isPositive: true, label: 'vs last month' },
              icon: <IconDashboard size={20} />,
              accentColor: 'var(--color-primary)',
            },
            {
              title: 'Active Chemical Batches',
              value: '38 Batches',
              delta: { value: '+6', isPositive: true, label: 'in production line' },
              icon: <IconProduction size={20} />,
              accentColor: 'var(--accent-500)',
            },
            {
              title: 'Raw Material Inventory',
              value: 'PKR 492.6M',
              delta: { value: '-2.1%', isPositive: false, label: 'consumed this week' },
              icon: <IconInventory size={20} />,
              accentColor: 'var(--warning-500)',
            },
            {
              title: 'QC Lab Batch Clearance Rate',
              value: '99.4%',
              delta: { value: '+0.6%', isPositive: true, label: 'zero quarantine spill' },
              icon: <IconQC size={20} />,
              accentColor: 'var(--success-500)',
            },
          ]}
          mainChart={
            <BarChart
              title="Daily Chemical Batch Production Output (Metric Tons)"
              primaryLabel="Actual Produced (MT)"
              secondaryLabel="Planned Target (MT)"
              unit="MT"
              data={[
                { label: 'Mon', value: 140, secondaryValue: 150 },
                { label: 'Tue', value: 165, secondaryValue: 150 },
                { label: 'Wed', value: 180, secondaryValue: 160 },
                { label: 'Thu', value: 155, secondaryValue: 150 },
                { label: 'Fri', value: 195, secondaryValue: 175 },
                { label: 'Sat', value: 120, secondaryValue: 120 },
                { label: 'Sun', value: 90, secondaryValue: 90 },
              ]}
            />
          }
          secondaryChart={
            <LineChart
              title="30-Day Revenue & Intercompany Settlements Trend (PKR Millions)"
              unit="M PKR"
              data={[
                { label: 'Sep 1', value: 4.2 },
                { label: 'Sep 6', value: 5.8 },
                { label: 'Sep 11', value: 5.1 },
                { label: 'Sep 16', value: 6.9 },
                { label: 'Sep 21', value: 7.4 },
                { label: 'Sep 26', value: 8.5 },
              ]}
            />
          }
          tertiaryWidget={
            <DonutChart
              title="Stock Valuation by Entity & Category"
              centerLabel="Total Stock"
              centerValue="PKR 492M"
              data={[
                { label: 'Sulfuric & Nitric Acids', value: 185, color: '#0d9488', formattedValue: 'PKR 185M' },
                { label: 'Soluble Fertilizers & NPK', value: 145, color: '#0284c7', formattedValue: 'PKR 145M' },
                { label: 'Packaging & Drums', value: 72, color: '#f59e0b', formattedValue: 'PKR 72M' },
                { label: 'Finished Goods in Transit', value: 90, color: '#10b981', formattedValue: 'PKR 90M' },
              ]}
            />
          }
          alertsWidget={
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-md)',
                }}
              >
                <h4
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Critical Operational Alerts
                </h4>
                <Badge variant="warning" size="sm" dot pulse>
                  3 Requires Action
                </Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <IconAlertTriangle size={18} style={{ color: 'var(--danger-500)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Batch #SA-1029 Quarantined in Lab
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Acid purity recorded 97.4% vs 98.0% spec requirement. Secondary assay required before release.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <IconAlertTriangle size={18} style={{ color: 'var(--warning-500)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Supplier Contract PO-881 Pending Signature
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Indus Solvents Ltd. requires signed dual-authorization for 500 Tons delivery next Tuesday.
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <ProgressMetric
                    label="Tank Yard Alpha Bulk Capacity"
                    value={840}
                    max={1000}
                    unit="MT"
                    color="var(--color-primary)"
                    subtext="840 of 1,000 MT filled (160 MT buffer remaining)"
                  />
                </div>
              </div>
            </div>
          }
          activityWidget={
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-md)',
                }}
              >
                <h4
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Recent Audit & Operational Activity
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => showToast({ type: 'info', title: 'Audit Log Export', message: 'Downloading full audit trail...' })}
                >
                  View All
                </Button>
              </div>

              <Timeline
                events={[
                  {
                    id: 'e1',
                    actor: { name: 'Dr. Tariq Mahmood', role: 'Head of QC' },
                    action: 'approved chemical assay for',
                    target: 'Batch #UB-4401 (Urea 46%)',
                    timestamp: '14 mins ago',
                    category: 'approval',
                    note: 'Purity verified at 99.4%, moisture content 0.3%. Passed compliance.',
                  },
                  {
                    id: 'e2',
                    actor: { name: 'Usman Ali', role: 'Procurement Officer' },
                    action: 'updated raw material unit cost on',
                    target: 'Requisition PR-882',
                    timestamp: '1 hour ago',
                    diff: {
                      field: 'Unit Price',
                      oldValue: 'Rs. 4,500/MT',
                      newValue: 'Rs. 4,200/MT',
                    },
                  },
                  {
                    id: 'e3',
                    actor: { name: 'System Outbox Relay', role: 'Daemon' },
                    action: 'dispatched 3 domain events to RabbitMQ event bus',
                    timestamp: '2 hours ago',
                  },
                ]}
              />
            </div>
          }
        />
      )}

      {/* =====================================================================
          2. ENTERPRISE LIST PAGE ARCHETYPE
          ===================================================================== */}
      {activeView === 'list' && (
        <ListPageTemplate
          header={{
            title: 'Master Chemical Batches & Formulations',
            subtitle: 'Central register of active and released chemical production batches, QA assay certificates, and warehouse stock allocation.',
            breadcrumbs: [
              { label: 'Master Registries' },
              { label: 'Chemical Batches' },
            ],
            badge: <StatusBadge status="in_production" />,
            actions: (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  startIcon={<IconDownload size={14} />}
                  onClick={() =>
                    showToast({
                      type: 'success',
                      title: 'Export Initiated',
                      message: 'Exporting 5 chemical batch records to Excel...',
                    })
                  }
                >
                  Export Excel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  startIcon={<IconPlus size={14} />}
                  onClick={() => setActiveView('form')}
                >
                  Create Batch Work Order
                </Button>
              </>
            ),
          }}
          kpis={[
            {
              title: 'Total Active Batches',
              value: '142 Batches',
              delta: { value: '+8', isPositive: true, label: 'this week' },
              icon: <IconProduction size={20} />,
            },
            {
              title: 'Cumulative Production Yield',
              value: '12,480 MT',
              delta: { value: '+14.2%', isPositive: true, label: 'vs last month' },
              icon: <IconProducts size={20} />,
            },
            {
              title: 'Under QC Quarantine',
              value: '3 Batches',
              delta: { value: '-2', isPositive: true, label: 're-tested today' },
              icon: <IconQC size={20} />,
              accentColor: 'var(--danger-500)',
            },
            {
              title: 'Average Batch Assay',
              value: '98.9%',
              delta: { value: '+0.4%', isPositive: true, label: 'grade spec' },
              icon: <IconCheck size={20} />,
              accentColor: 'var(--success-500)',
            },
          ]}
          tableProps={{
            data: sampleBatches,
            columns: batchColumns,
            keyExtractor: (item) => item.id,
            title: 'Production Register',
            subtitle: 'Click any row to open the 360-degree batch inspection view.',
            selectable: true,
            selectedIds: selectedTableIds,
            onSelectionChange: setSelectedTableIds,
            bulkActions: (
              <div style={{ display: 'flex', gap: '4px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    showToast({
                      type: 'success',
                      title: 'Bulk Approval',
                      message: `Approved ${selectedTableIds.length} batches for release.`,
                    })
                  }
                >
                  Release Selected
                </Button>
              </div>
            ),
            onRowClick: (item) => {
              setSelectedRecord(item);
              setActiveView('detail');
            },
          }}
        />
      )}

      {/* =====================================================================
          3. 360-DEGREE DETAIL PAGE ARCHETYPE
          ===================================================================== */}
      {activeView === 'detail' && (
        <DetailPageTemplate
          title="Chemical Batch 360° Record"
          recordCode={selectedRecord?.batchNumber || 'UB-4401'}
          subtitle="Complete operational lifecycle, formulation BOM ingredients, quality assay certificates, and immutable audit history."
          statusBadge={<StatusBadge status={selectedRecord?.status || 'approved'} />}
          breadcrumbs={[
            { label: 'Operations', onClick: () => setActiveView('list') },
            { label: 'Chemical Batches', onClick: () => setActiveView('list') },
            { label: selectedRecord?.batchNumber || 'UB-4401' },
          ]}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDrawerOpen(true)}
              >
                Quick Parameters
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                Release Batch
              </Button>
            </>
          }
          workflowSteps={[
            {
              id: 's1',
              label: 'Batch Initiated',
              actor: 'Kamran Shah',
              timestamp: 'Sep 24, 08:30 AM',
              status: 'completed',
            },
            {
              id: 's2',
              label: 'Reactor Synthesis',
              actor: 'Plant Unit 1',
              timestamp: 'Sep 24, 04:15 PM',
              status: 'completed',
            },
            {
              id: 's3',
              label: 'QC Lab Assay Inspection',
              actor: 'Dr. Tariq Mahmood',
              timestamp: 'Sep 25, 11:20 AM',
              status: 'completed',
            },
            {
              id: 's4',
              label: 'Plant Manager Approval',
              actor: 'Engr. Haris Khan',
              timestamp: 'Sep 25, 02:40 PM',
              status: 'current',
            },
            {
              id: 's5',
              label: 'Finished Goods Inventory Release',
              status: 'pending',
            },
          ]}
          summaryKpis={[
            {
              title: 'Net Batch Weight',
              value: `${selectedRecord?.yieldTons || 120.5} MT`,
              subtitle: '100% of theoretical recipe output',
              accentColor: 'var(--color-primary)',
            },
            {
              title: 'Cost Valuation',
              value: `Rs. ${selectedRecord?.costPkr || '4,820,000'}`,
              subtitle: 'DECIMAL(18, 4) relational precision',
              accentColor: 'var(--accent-500)',
            },
            {
              title: 'Assay Purity Score',
              value: selectedRecord?.purity || '99.4%',
              subtitle: 'Minimum required spec: 98.0%',
              accentColor: 'var(--success-500)',
            },
            {
              title: 'Storage Facility',
              value: selectedRecord?.warehouse || 'Warehouse A (Multan)',
              subtitle: 'Storage Silo #04',
              accentColor: 'var(--warning-500)',
            },
          ]}
          tabs={[
            {
              id: 'overview',
              label: 'Technical Formulation & BOM',
              icon: <IconProducts size={16} />,
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <Card variant="default" padding="lg">
                    <CardHeader>
                      <CardTitle>Recipe Bill of Materials (BOM) Breakdown</CardTitle>
                      <CardDescription>
                        Raw ingredients consumed under ACID transaction isolation.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Ingredient Code</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Chemical Name</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Target Ratio</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Consumed Quantity</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Total Cost (PKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>RAW-AMMONIA-01</td>
                            <td style={{ padding: '8px' }}>Liquid Anhydrous Ammonia 99.5%</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>58.2%</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>70.13 MT</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Rs. 2,805,200</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>RAW-CO2-09</td>
                            <td style={{ padding: '8px' }}>Purified Carbon Dioxide Liquid</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>39.8%</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>47.96 MT</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Rs. 1,438,800</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>RAW-ANTI-CAKE</td>
                            <td style={{ padding: '8px' }}>Polymeric Anti-Caking Coating</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>2.0%</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>2.41 MT</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Rs. 576,000</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              id: 'documents',
              label: 'Certificates & QC Lab Reports',
              icon: <IconFileText size={16} />,
              count: 2,
              content: (
                <Card variant="default" padding="lg">
                  <CardHeader>
                    <CardTitle>Certified QC Documents & Lab Reports</CardTitle>
                    <CardDescription>
                      Secure signed S3 document references with cryptographic SHA-256 integrity.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          backgroundColor: 'var(--bg-canvas)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IconFileText size={20} style={{ color: 'var(--color-primary)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                              Certificate_Of_Analysis_COA_UB4401.pdf
                            </div>
                            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                              Signed by Chief Chemist • 1.4 MB • Uploaded Sep 25, 2026
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          startIcon={<IconDownload size={14} />}
                          onClick={() => showToast({ type: 'success', title: 'Download Started', message: 'Downloading COA Certificate...' })}
                        >
                          Download
                        </Button>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          backgroundColor: 'var(--bg-canvas)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IconFileText size={20} style={{ color: 'var(--accent-500)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                              Material_Safety_Data_Sheet_MSDS_Rev4.pdf
                            </div>
                            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                              Environmental Safety Compliance • 2.8 MB • Uploaded Sep 20, 2026
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          startIcon={<IconDownload size={14} />}
                          onClick={() => showToast({ type: 'success', title: 'Download Started', message: 'Downloading MSDS Sheet...' })}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'audit',
              label: 'Complete Audit Trail',
              icon: <IconRefresh size={16} />,
              content: (
                <Card variant="default" padding="lg">
                  <CardHeader>
                    <CardTitle>Tamper-Evident Audit Timeline</CardTitle>
                    <CardDescription>
                      Full immutable log of all state transitions, user actors, and field diffs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Timeline
                      events={[
                        {
                          id: 'ev-1',
                          actor: { name: 'Engr. Haris Khan', role: 'Plant Operations Manager' },
                          action: 'approved chemical batch transition from',
                          target: 'QC Quarantine to Pending Clearance',
                          timestamp: 'Today at 02:40 PM',
                          category: 'approval',
                          note: 'Lab report COA confirms purity meets national standard specification PS-450.',
                        },
                        {
                          id: 'ev-2',
                          actor: { name: 'Dr. Tariq Mahmood', role: 'Chief Quality Chemist' },
                          action: 'submitted certified assay results for',
                          target: 'Sample #UB-4401-QC-A',
                          timestamp: 'Today at 11:20 AM',
                          diff: {
                            field: 'Assay Purity',
                            oldValue: 'Untested',
                            newValue: '99.4%',
                          },
                        },
                        {
                          id: 'ev-3',
                          actor: { name: 'Kamran Shah', role: 'Reactor Shift Supervisor' },
                          action: 'initiated synthesis work order on reactor line Alpha-3',
                          timestamp: 'Yesterday at 08:30 AM',
                        },
                      ]}
                    />
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      )}

      {/* =====================================================================
          4. CREATE/EDIT FORM PAGE ARCHETYPE
          ===================================================================== */}
      {activeView === 'form' && (
        <FormPageTemplate
          title="Create Raw Material Procurement Requisition"
          subtitle="Initiate an authorized procurement request for chemical raw materials. Follows Shehswar multi-company purchasing guidelines."
          breadcrumbs={[
            { label: 'Operations' },
            { label: 'Procurement' },
            { label: 'New Requisition' },
          ]}
          isSubmitting={isSubmittingForm}
          onSaveDraft={() =>
            showToast({
              type: 'info',
              title: 'Draft Saved',
              message: 'Procurement requisition draft saved to local offline storage.',
            })
          }
          onSubmit={handleFormSubmit}
          onCancel={() => setActiveView('list')}
          sections={[
            {
              id: 'general',
              title: '1. General Requisition Information',
              description: 'Company entity context, priority level, and delivery schedule.',
              content: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                  <Input
                    label="Requisition Reference Code"
                    value="PR-2026-904"
                    disabled
                    helperText="Auto-generated by sequence generator"
                  />
                  <Select
                    label="Target Entity / Subsidiary"
                    required
                    options={[
                      { label: 'Shehswar Chemicals Ltd. (Parent)', value: 'parent' },
                      { label: 'Shehswar Agro-Tech Ltd. (Subsidiary)', value: 'agro' },
                      { label: 'Shehswar Logistics Fleet', value: 'logistics' },
                    ]}
                    value="parent"
                    onChange={() => {}}
                  />
                  <Select
                    label="Procurement Category"
                    required
                    options={[
                      { label: 'Bulk Industrial Acids', value: 'acids' },
                      { label: 'Specialty Mineral Nutrients', value: 'nutrients' },
                      { label: 'HDPE Heavy Drums Packaging', value: 'drums' },
                    ]}
                    value="acids"
                    onChange={() => {}}
                  />
                  <Input
                    label="Required On-Site Date"
                    type="date"
                    required
                    defaultValue="2026-10-15"
                  />
                </div>
              ),
            },
            {
              id: 'items',
              title: '2. Chemical Entity & Commercial Quantities',
              description: 'Industrial quantity stepper, currency valuation, and tax percentages.',
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                    <Select
                      label="Select Chemical Raw Material"
                      required
                      options={[
                        { label: 'Concentrated Sulfuric Acid 98% (H2SO4)', value: 'h2so4' },
                        { label: 'Liquid Anhydrous Ammonia 99.5%', value: 'nh3' },
                        { label: 'Phosphoric Acid Technical 85%', value: 'h3po4' },
                      ]}
                      value="h2so4"
                      onChange={() => {}}
                    />
                    <Select
                      label="Approved Vendor / Supplier"
                      required
                      options={[
                        { label: 'Indus Solvents Ltd. (Grade A Approved)', value: 'v1' },
                        { label: 'Engro Chemical Trading Corp.', value: 'v2' },
                        { label: 'National Chemical Importers', value: 'v3' },
                      ]}
                      value="v1"
                      onChange={() => {}}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                    <QuantityInput
                      label="Ordered Quantity"
                      value={formQuantity}
                      onChange={setFormQuantity}
                      unit="Metric Tons"
                      min={10}
                      step={25}
                      required
                    />

                    <CurrencyInput
                      label="Agreed Unit Price (PKR/MT)"
                      value={formPrice}
                      onChange={setFormPrice}
                      currencyCode="PKR"
                      required
                    />

                    <PercentageInput
                      label="Sales Tax / Federal Excise Duty (%)"
                      value={formTax}
                      onChange={setFormTax}
                    />
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Calculated Total Valuation:</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      PKR {((formQuantity * Number(formPrice || 0)) * (1 + Number(formTax || 0) / 100)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              id: 'attachments',
              title: '3. Technical Documentation & MSDS Compliance',
              description: 'Upload quote slips, lab certificates, or MSDS sheets.',
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <FileUpload
                    label="Attach Supplier Quotation & Specification Certificates"
                    files={formFiles}
                    onFilesChange={setFormFiles}
                  />

                  <Textarea
                    label="Operational Notes / Quality Instructions"
                    placeholder="Enter any special unloading, transport hazmat compliance, or QA requirements..."
                    rows={3}
                    maxLength={500}
                    showCount
                  />

                  <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
                    <Checkbox
                      label="Urgent Chemical Requisition"
                      description="Flag for immediate expedited priority in reactor staging"
                    />
                    <Switch
                      label="Pre-Delivery Inspection Required"
                      checked={true}
                      onChange={() => {}}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* =====================================================================
          5. COMPLETE COMPONENT LIBRARY & DESIGN TOKENS SHOWCASE
          ===================================================================== */}
      {activeView === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-md)' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Enterprise Component Library & Token Specimen
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
              All reusable atomic UI components constructed with zero Tailwind dependency, pure CSS Custom Properties, and dark/light mode parity.
            </p>
          </div>

          {/* Section: Buttons */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>1. Button Variants & Interactive States</CardTitle>
              <CardDescription>Primary, Secondary, Ghost, Danger, Success, Outline, with loading and disabled states.</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center' }}>
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline Action</Button>
                <Button variant="ghost">Ghost Action</Button>
                <Button variant="success">Success Action</Button>
                <Button variant="danger">Danger Action</Button>
                <Button variant="primary" isLoading>Loading State</Button>
                <Button variant="secondary" disabled>Disabled State</Button>
                <Button variant="primary" size="sm">Small (sm)</Button>
                <Button variant="primary" size="lg">Large (lg)</Button>
              </div>
            </CardContent>
          </Card>

          {/* Section: Status Badges */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>2. ERP Workflow Status Badges</CardTitle>
              <CardDescription>Dynamic status badges with animated pulse indicators matching ERP operational states.</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <StatusBadge status="draft" />
                <StatusBadge status="submitted" />
                <StatusBadge status="pending_approval" />
                <StatusBadge status="approved" />
                <StatusBadge status="in_production" />
                <StatusBadge status="quarantine" />
                <StatusBadge status="released" />
                <StatusBadge status="completed" />
                <StatusBadge status="rejected" />
                <StatusBadge status="cancelled" />
              </div>
            </CardContent>
          </Card>

          {/* Section: Form Inputs */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>3. Specialized Industrial & Financial Inputs</CardTitle>
              <CardDescription>Formatters for currency, physical quantities, percentages, and search filtering.</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                <Input label="Standard Text Input" placeholder="Enter text..." helperText="Standard helper text" />
                <CurrencyInput label="Financial Currency Input" value="4820000" onChange={() => {}} currencyCode="PKR" />
                <QuantityInput label="Physical Quantity Stepper" value={150} onChange={() => {}} unit="Bags (50kg)" />
                <PercentageInput label="Tax / Ratio Percentage" value="18" onChange={() => {}} />
                <Select
                  label="Multi-Select Tag Field"
                  isMulti
                  options={[
                    { label: 'Multan Plant', value: 'multan' },
                    { label: 'Faisalabad Hub', value: 'faisalabad' },
                    { label: 'Karachi Port Terminal', value: 'karachi' },
                  ]}
                  value={['multan', 'karachi']}
                  onChange={() => {}}
                />
                <Textarea label="Expandable Textarea" placeholder="Enter description..." rows={2} maxLength={200} showCount />
              </div>
            </CardContent>
          </Card>

          {/* Section: Skeletons, Empty & Error States */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>4. Loading Skeletons, Empty & Error Boundaries</CardTitle>
              <CardDescription>Built-in fallback UX to guarantee zero blank or broken screens.</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-lg)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Skeleton Loading Animation
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <Skeleton height="24px" width="60%" />
                    <Skeleton height="16px" width="100%" />
                    <Skeleton height="16px" width="80%" />
                  </div>
                  <TableSkeleton rows={2} columns={3} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Empty State UI
                    </div>
                    <EmptyState
                      title="No Purchase Orders Found"
                      description="No orders currently match the applied filter parameters."
                      actionLabel="Create Order"
                      onAction={() => showToast({ type: 'info', title: 'Action Triggered', message: 'Create PO clicked' })}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Error State UI
                    </div>
                    <ErrorState
                      title="API Sync Suspended"
                      message="Temporary connectivity interruption with remote subsidiary database."
                      onRetry={() => showToast({ type: 'info', title: 'Retrying', message: 'Re-establishing TLS socket...' })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section: KPI Cards & Workflow Tracker */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>5. Metric KPI Cards & Workflow Tracker</CardTitle>
              <CardDescription>Real-time telemetry cards and multi-stage operational approval indicators.</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <KpiCard
                  title="Daily Yield Metric"
                  value="164.2 MT"
                  delta={{ value: '+4.8%', isPositive: true }}
                />
                <KpiCard
                  title="Chemical QC Variance"
                  value="0.12%"
                  delta={{ value: '-0.04%', isPositive: true }}
                  accentColor="var(--accent-500)"
                />
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Operational Workflow Progression
              </div>
              <WorkflowTracker
                steps={[
                  { id: '1', label: '1. Requisition', status: 'completed' },
                  { id: '2', label: '2. QC Inspection', status: 'completed' },
                  { id: '3', label: '3. Manager Approval', status: 'current' },
                  { id: '4', label: '4. Release to Silo', status: 'pending' },
                ]}
              />

              <div style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Segmented Pill Tabs
                </div>
                <Tabs
                  variant="pills"
                  items={[
                    { id: 'all', label: 'All Batches', count: 142 },
                    { id: 'active', label: 'Active Lines', count: 38 },
                    { id: 'quarantine', label: 'Quarantine', count: 3 },
                  ]}
                  activeId="all"
                  onChange={() => {}}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE SIDE DRAWER INSPECTOR
          ===================================================================== */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Quick Batch Parameters"
        subtitle={selectedRecord?.batchNumber || 'Batch Inspection'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDrawerOpen(false);
                showToast({
                  type: 'success',
                  title: 'Changes Saved',
                  message: 'Batch inspection parameters updated in database.',
                });
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input
            label="Product Name"
            value={selectedRecord?.productName || 'Agricultural Grade Urea 46% N'}
            disabled
          />
          <Input
            label="Assay Purity Score"
            defaultValue={selectedRecord?.purity || '99.4%'}
          />
          <QuantityInput
            label="Current Stored Yield"
            value={selectedRecord?.yieldTons || 120.5}
            onChange={() => {}}
            unit="Tons"
          />
          <Select
            label="Storage Warehouse"
            options={[
              { label: 'Warehouse A (Multan)', value: 'w_a' },
              { label: 'Warehouse B (Faisalabad)', value: 'w_b' },
              { label: 'Tank Yard Gamma', value: 'w_c' },
            ]}
            value="w_a"
            onChange={() => {}}
          />
          <Textarea
            label="Inspector Comments"
            placeholder="Add inspector notes..."
            defaultValue="Batch conforms to ISO 9001 quality specifications."
            rows={3}
          />
        </div>
      </Drawer>

      {/* =====================================================================
          INTERACTIVE CONFIRMATION MODAL
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirm Batch Release to Finished Goods"
        description="This will lock all chemical formulation parameters and release stock to Sales & Dealer distribution."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                showToast({
                  type: 'success',
                  title: 'Batch Released',
                  message: `Batch ${selectedRecord?.batchNumber || 'UB-4401'} is now live in Finished Goods Inventory.`,
                });
              }}
            >
              Confirm Release
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
          Are you sure you want to release <strong>{selectedRecord?.batchNumber || 'UB-4401'}</strong> ({selectedRecord?.productName || 'Agricultural Grade Urea'})?
          An immutable audit entry will be recorded under your administrator credentials.
        </p>
      </Modal>
        </div>
      )}
    </AppShell>
  );
}
