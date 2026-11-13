'use client';

/**
 * SHEHSWAR ONE360 - Inter Company Transfer (Parent → Child Company Business Flow)
 *
 * Implements Full Business Flow:
 * 1. Shehswar is the sole Parent/Manufacturing company: holds Finished Products, actual costs, and stock.
 * 2. Sells Finished Products to dynamic child companies (ConsceptAG, Nectar, AgriventurePakistan, Excelium SEEd, etc.).
 * 3. Configurable markup % (10%, 15%, 20%, or custom user-defined % - NOT hardcoded).
 * 4. Multi-product transfer with independent product-level costing and selling calculations:
 *    - Selling Rate = Cost + (Cost * Markup%)
 *    - Sales = Qty * Selling Rate
 *    - Shehswar Cost = Qty * Cost
 *    - Shehswar Profit = Sales - Cost
 * 5. Strict stock validation against Shehswar's source warehouse (no stock from nothing).
 * 6. Preserves batch numbers into child company inventory without duplicating master records.
 * 7. Comprehensive Shehswar Profit Reporting & Child Company Inventory & Payables reporting.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Modal,
  TableSkeleton,
} from '../ui';
import {
  IconRefresh,
  IconCheck,
  IconPlus,
  IconTrash,
  IconBuilding,
  IconPercent,
  IconTrendingUp,
  IconBox,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface SourceStockItem {
  id: string;
  finishedProductId: string;
  productCode: string;
  productName: string;
  packSize: string;
  uom: string;
  availableStock: number;
  unitCost: number;
  batchNumber: string;
  mfgDate?: string;
  expiryDate?: string;
}

export interface TransferLineItem {
  id: string;
  finishedProductId: string;
  productCode: string;
  productName: string;
  packSize: string;
  batchNumber: string;
  availableStock: number;
  quantity: number;
  unitCost: number;
  markupPercent: number;
  sellingPrice: number;
  totalCost: number;
  totalSales: number;
  profit: number;
}

export const IntercompanyTransferView: React.FC = () => {
  const { showToast } = useToast();

  // Active View Tab
  const [activeTab, setActiveTab] = useState<
    'NEW_SALE' | 'SHEHSWAR_PROFIT' | 'CHILD_REPORT' | 'HISTORY'
  >('NEW_SALE');

  // Master Data
  const [companies, setCompanies] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [sourceStock, setSourceStock] = useState<SourceStockItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State: Company & Warehouse Selection
  const [parentCompanyId, setParentCompanyId] = useState<string>('');
  const [childCompanyId, setChildCompanyId] = useState<string>('');
  const [parentWarehouseId, setParentWarehouseId] = useState<string>('');
  const [childWarehouseId, setChildWarehouseId] = useState<string>('');

  // Global Markup & Reference
  const [globalMarkupPercent, setGlobalMarkupPercent] = useState<number>(15);
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Multi-Product Line Items
  const [lineItems, setLineItems] = useState<TransferLineItem[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Profit Report State
  const [profitReport, setProfitReport] = useState<any>(null);
  const [isLoadingProfitReport, setIsLoadingProfitReport] = useState<boolean>(false);

  // Child Report State
  const [selectedChildForReport, setSelectedChildForReport] = useState<string>('');
  const [childReport, setChildReport] = useState<any>(null);
  const [isLoadingChildReport, setIsLoadingChildReport] = useState<boolean>(false);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // 1. Initial Master Data Loading
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [compRes, whRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/warehouses?all=true'),
      ]);

      const compList = Array.isArray(compRes.data)
        ? compRes.data
        : compRes.data?.data || [];
      const whList = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];

      setCompanies(compList);
      setWarehouses(whList);

      // Identify Parent (Shehswar)
      const parent =
        compList.find((c: any) => c.isParent || c.code === 'COMP-SHEHSWAR') || compList[0];
      const children = compList.filter((c: any) => c.id !== parent?.id);

      if (parent) {
        setParentCompanyId(parent.id);
        const parentWhs = whList.filter((w: any) => w.companyId === parent.id);
        if (parentWhs.length > 0) {
          setParentWarehouseId(parentWhs[0].id);
        }
      }

      if (children.length > 0) {
        setChildCompanyId(children[0].id);
        setSelectedChildForReport(children[0].id);
        const childWhs = whList.filter((w: any) => w.companyId === children[0].id);
        if (childWhs.length > 0) {
          setChildWarehouseId(childWhs[0].id);
        }
      }
    } catch (err: any) {
      showToast({
        title: 'Error Loading Master Data',
        message: err?.message || 'Could not fetch companies/warehouses',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Fetch available Finished Product Stock when Source Warehouse changes
  const fetchSourceStock = useCallback(
    async (warehouseId: string) => {
      if (!warehouseId) return;
      setIsLoadingStock(true);
      try {
        const res = await ApiClient.get<SourceStockItem[]>(
          `/api/v1/operations/intercompany/source-stock?warehouseId=${warehouseId}`,
        );
        const items = Array.isArray(res.data) ? res.data : [];
        setSourceStock(items);
        if (items.length > 0 && items[0] && !selectedProductToAdd) {
          setSelectedProductToAdd(items[0].finishedProductId);
        }
      } catch (err: any) {
        showToast({
          title: 'Stock Query Failed',
          message: err?.message || 'Failed to fetch warehouse stock',
          type: 'error',
        });
      } finally {
        setIsLoadingStock(false);
      }
    },
    [showToast, selectedProductToAdd],
  );

  useEffect(() => {
    if (parentWarehouseId) {
      fetchSourceStock(parentWarehouseId);
    }
  }, [parentWarehouseId, fetchSourceStock]);

  // Update Child Warehouses when Child Company changes
  const availableChildWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.companyId === childCompanyId);
  }, [warehouses, childCompanyId]);

  useEffect(() => {
    if (availableChildWarehouses.length > 0) {
      setChildWarehouseId(availableChildWarehouses[0].id);
    } else {
      setChildWarehouseId('');
    }
  }, [availableChildWarehouses]);

  const availableParentWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.companyId === parentCompanyId);
  }, [warehouses, parentCompanyId]);

  // Active Parent & Child company details
  const activeParentCompany = useMemo(
    () => companies.find((c) => c.id === parentCompanyId),
    [companies, parentCompanyId],
  );
  const activeChildCompany = useMemo(
    () => companies.find((c) => c.id === childCompanyId),
    [companies, childCompanyId],
  );

  // 3. Add Product to Line Items Table
  const handleAddProduct = (prodId?: string) => {
    const targetId = prodId || selectedProductToAdd;
    if (!targetId) return;

    const stockItem = sourceStock.find((s) => s.finishedProductId === targetId);
    if (!stockItem) {
      showToast({
        title: 'Product Selection',
        message: 'Selected product is not currently in source stock',
        type: 'warning',
      });
      return;
    }

    // Check if already in table
    const existing = lineItems.find((i) => i.finishedProductId === targetId);
    if (existing) {
      showToast({
        title: 'Already Added',
        message: `${stockItem.productName} is already in the transfer list. Adjust its quantity directly.`,
        type: 'info',
      });
      return;
    }

    const defaultQty = Math.min(100, stockItem.availableStock);
    const unitCost = stockItem.unitCost;
    const markup = globalMarkupPercent;
    const sellingRate = Math.round(unitCost * (1 + markup / 100) * 100) / 100;
    const totalCost = Math.round(defaultQty * unitCost * 100) / 100;
    const totalSales = Math.round(defaultQty * sellingRate * 100) / 100;
    const profit = Math.round((totalSales - totalCost) * 100) / 100;

    const newLine: TransferLineItem = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      finishedProductId: stockItem.finishedProductId,
      productCode: stockItem.productCode,
      productName: stockItem.productName,
      packSize: stockItem.packSize,
      batchNumber: stockItem.batchNumber,
      availableStock: stockItem.availableStock,
      quantity: defaultQty,
      unitCost,
      markupPercent: markup,
      sellingPrice: sellingRate,
      totalCost,
      totalSales,
      profit,
    };

    setLineItems((prev) => [...prev, newLine]);
  };

  // Quick Load Acceptance Scenario Items
  const handleLoadAcceptanceScenario = () => {
    if (sourceStock.length === 0) {
      showToast({
        title: 'Stock Empty',
        message: 'No stock available in the selected warehouse.',
        type: 'warning',
      });
      return;
    }

    const newRows: TransferLineItem[] = [];
    sourceStock.slice(0, 3).forEach((stockItem) => {
      const defaultQty = 100;
      const unitCost = stockItem.unitCost;
      const markup = 15;
      const sellingRate = Math.round(unitCost * (1 + markup / 100) * 100) / 100;
      const totalCost = Math.round(defaultQty * unitCost * 100) / 100;
      const totalSales = Math.round(defaultQty * sellingRate * 100) / 100;
      const profit = Math.round((totalSales - totalCost) * 100) / 100;

      newRows.push({
        id: `row-${stockItem.finishedProductId}`,
        finishedProductId: stockItem.finishedProductId,
        productCode: stockItem.productCode,
        productName: stockItem.productName,
        packSize: stockItem.packSize,
        batchNumber: stockItem.batchNumber,
        availableStock: stockItem.availableStock,
        quantity: defaultQty,
        unitCost,
        markupPercent: markup,
        sellingPrice: sellingRate,
        totalCost,
        totalSales,
        profit,
      });
    });

    setLineItems(newRows);
    setGlobalMarkupPercent(15);
    showToast({
      title: 'Loaded Multi-Product Scenario',
      message: 'Added sample finished products (100 units each @ 15% markup).',
      type: 'success',
    });
  };

  // Update Line Item Values
  const handleUpdateLine = (
    id: string,
    field: 'quantity' | 'markupPercent' | 'sellingPrice',
    val: number,
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        let quantity = item.quantity;
        let markupPercent = item.markupPercent;
        let sellingPrice = item.sellingPrice;
        const unitCost = item.unitCost;

        if (field === 'quantity') {
          quantity = Math.max(0, val);
        } else if (field === 'markupPercent') {
          markupPercent = val;
          sellingPrice = Math.round(unitCost * (1 + val / 100) * 100) / 100;
        } else if (field === 'sellingPrice') {
          sellingPrice = Math.max(0, val);
          markupPercent =
            unitCost > 0
              ? Math.round(((sellingPrice - unitCost) / unitCost) * 1000) / 10
              : 0;
        }

        const totalCost = Math.round(quantity * unitCost * 100) / 100;
        const totalSales = Math.round(quantity * sellingPrice * 100) / 100;
        const profit = Math.round((totalSales - totalCost) * 100) / 100;

        return {
          ...item,
          quantity,
          markupPercent,
          sellingPrice,
          totalCost,
          totalSales,
          profit,
        };
      }),
    );
  };

  const handleRemoveLine = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Apply Global Markup to all lines
  const handleApplyGlobalMarkup = (markup: number) => {
    setGlobalMarkupPercent(markup);
    setLineItems((prev) =>
      prev.map((item) => {
        const sellingPrice = Math.round(item.unitCost * (1 + markup / 100) * 100) / 100;
        const totalCost = Math.round(item.quantity * item.unitCost * 100) / 100;
        const totalSales = Math.round(item.quantity * sellingPrice * 100) / 100;
        const profit = Math.round((totalSales - totalCost) * 100) / 100;

        return {
          ...item,
          markupPercent: markup,
          sellingPrice,
          totalCost,
          totalSales,
          profit,
        };
      }),
    );
  };

  // Financial Grand Totals
  const grandTotals = useMemo(() => {
    const totalCost = lineItems.reduce((acc, i) => acc + i.totalCost, 0);
    const totalSales = lineItems.reduce((acc, i) => acc + i.totalSales, 0);
    const totalProfit = Math.round((totalSales - totalCost) * 100) / 100;
    const totalUnits = lineItems.reduce((acc, i) => acc + i.quantity, 0);
    const effectiveMarkup =
      totalCost > 0 ? Math.round(((totalSales - totalCost) / totalCost) * 1000) / 10 : 0;

    const hasStockError = lineItems.some((i) => i.quantity > i.availableStock);
    const hasZeroQty = lineItems.some((i) => i.quantity <= 0);

    return {
      totalCost,
      totalSales,
      totalProfit,
      totalUnits,
      effectiveMarkup,
      hasStockError,
      hasZeroQty,
    };
  }, [lineItems]);

  // 4. Submit Intercompany Transfer
  const handleSubmitTransfer = async () => {
    if (!parentCompanyId || !childCompanyId) {
      showToast({
        title: 'Validation Error',
        message: 'Please select both Parent and Child companies',
        type: 'warning',
      });
      return;
    }
    if (parentCompanyId === childCompanyId) {
      showToast({
        title: 'Validation Error',
        message: 'Parent and Child companies cannot be identical',
        type: 'warning',
      });
      return;
    }
    if (!parentWarehouseId || !childWarehouseId) {
      showToast({
        title: 'Validation Error',
        message: 'Please select both source and destination warehouses',
        type: 'warning',
      });
      return;
    }
    if (lineItems.length === 0) {
      showToast({
        title: 'Validation Error',
        message: 'Please add at least one finished product to transfer',
        type: 'warning',
      });
      return;
    }
    if (grandTotals.hasStockError) {
      const offending = lineItems.find((i) => i.quantity > i.availableStock);
      showToast({
        title: 'Insufficient Stock',
        message: `Insufficient stock for ${offending?.productName}. Available: ${offending?.availableStock}, Requested: ${offending?.quantity}`,
        type: 'error',
      });
      return;
    }
    if (grandTotals.hasZeroQty) {
      showToast({
        title: 'Validation Error',
        message: 'All line items must have a quantity greater than zero',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        parentCompanyId,
        childCompanyId,
        parentWarehouseId,
        childWarehouseId,
        defaultMarkupPercent: globalMarkupPercent,
        items: lineItems.map((i) => ({
          finishedProductId: i.finishedProductId,
          batchNumber: i.batchNumber,
          quantity: i.quantity,
          unitCost: i.unitCost,
          markupPercent: i.markupPercent,
          sellingPrice: i.sellingPrice,
        })),
        notes: transferNotes,
      };

      const res = await ApiClient.post<any>(
        '/api/v1/operations/intercompany/transfer',
        payload,
      );

      setIsConfirmModalOpen(false);
      showToast({
        title: 'Intercompany Transfer Posted!',
        message: `Parent Sale (${res.data?.parentSale?.invoiceNumber}) & Child Purchase (${res.data?.childPurchase?.voucherNumber}) posted atomically! Profit: PKR ${res.data?.totalProfit?.toLocaleString()}`,
        type: 'success',
      });

      // Clear table and refresh stock
      setLineItems([]);
      setTransferNotes('');
      fetchSourceStock(parentWarehouseId);
    } catch (err: any) {
      showToast({
        title: 'Transfer Failed',
        message: err?.message || 'Error processing intercompany transfer transaction',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Load Shehswar Profit Report
  const loadProfitReport = useCallback(async () => {
    setIsLoadingProfitReport(true);
    try {
      const res = await ApiClient.get<any>(
        `/api/v1/operations/intercompany/profit-report?companyId=${parentCompanyId}`,
      );
      setProfitReport(res.data);
    } catch (err: any) {
      showToast({
        title: 'Report Error',
        message: err?.message || 'Failed to load profit report',
        type: 'error',
      });
    } finally {
      setIsLoadingProfitReport(false);
    }
  }, [parentCompanyId, showToast]);

  // 6. Load Child Company Report
  const loadChildReport = useCallback(
    async (childId: string) => {
      if (!childId) return;
      setIsLoadingChildReport(true);
      try {
        const res = await ApiClient.get<any>(
          `/api/v1/operations/intercompany/child-report?childCompanyId=${childId}`,
        );
        setChildReport(res.data);
      } catch (err: any) {
        showToast({
          title: 'Child Report Error',
          message: err?.message || 'Failed to load child company report',
          type: 'error',
        });
      } finally {
        setIsLoadingChildReport(false);
      }
    },
    [showToast],
  );

  // 7. Load Transfer History
  const loadTransferHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await ApiClient.get<any[]>('/api/v1/operations/intercompany/history');
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      showToast({
        title: 'History Error',
        message: err?.message || 'Failed to load transfer history',
        type: 'error',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [showToast]);

  // Trigger data fetching on tab switch
  useEffect(() => {
    if (activeTab === 'SHEHSWAR_PROFIT') {
      loadProfitReport();
    } else if (activeTab === 'CHILD_REPORT') {
      loadChildReport(selectedChildForReport || childCompanyId);
    } else if (activeTab === 'HISTORY') {
      loadTransferHistory();
    }
  }, [
    activeTab,
    loadProfitReport,
    loadChildReport,
    loadTransferHistory,
    selectedChildForReport,
    childCompanyId,
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Inter Company Transfer
            </h1>
            <Badge variant="primary" style={{ fontWeight: 600 }}>
              Parent → Child Company Flow
            </Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Shehswar sells manufactured Finished Goods to child distribution companies with
            configurable profit margins and automated atomic multi-company ledger updates.
          </p>
        </div>

        {/* Global Tab Navigation */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-subtle)',
            borderRadius: '10px',
            padding: '4px',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setActiveTab('NEW_SALE')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background:
                activeTab === 'NEW_SALE' ? 'var(--surface-primary)' : 'transparent',
              color:
                activeTab === 'NEW_SALE'
                  ? 'var(--brand-primary)'
                  : 'var(--text-secondary)',
              boxShadow:
                activeTab === 'NEW_SALE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <IconPlus size={15} /> Create Intercompany Sale
          </button>
          <button
            onClick={() => setActiveTab('SHEHSWAR_PROFIT')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background:
                activeTab === 'SHEHSWAR_PROFIT'
                  ? 'var(--surface-primary)'
                  : 'transparent',
              color:
                activeTab === 'SHEHSWAR_PROFIT'
                  ? 'var(--brand-primary)'
                  : 'var(--text-secondary)',
              boxShadow:
                activeTab === 'SHEHSWAR_PROFIT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <IconTrendingUp size={15} /> Shehswar Profit Report
          </button>
          <button
            onClick={() => setActiveTab('CHILD_REPORT')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background:
                activeTab === 'CHILD_REPORT' ? 'var(--surface-primary)' : 'transparent',
              color:
                activeTab === 'CHILD_REPORT'
                  ? 'var(--brand-primary)'
                  : 'var(--text-secondary)',
              boxShadow:
                activeTab === 'CHILD_REPORT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <IconBuilding size={15} /> Child Inventory & Payables
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background:
                activeTab === 'HISTORY' ? 'var(--surface-primary)' : 'transparent',
              color:
                activeTab === 'HISTORY'
                  ? 'var(--brand-primary)'
                  : 'var(--text-secondary)',
              boxShadow: activeTab === 'HISTORY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <IconRefresh size={15} /> Transfer History
          </button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent style={{ padding: '24px' }}>
            <TableSkeleton rows={4} columns={4} />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: CREATE INTERCOMPANY SALE                                           */}
          {/* ========================================================================= */}
          {activeTab === 'NEW_SALE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Business Flow Configuration */}
          <Card>
            <CardHeader>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CardTitle>1. Transaction Structure & Company Routing</CardTitle>
                  <Badge variant="success">Transfer Type: Inter Company Sale</Badge>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadAcceptanceScenario}
                  title="Loads the 3-Product 15% Markup scenario from specifications"
                >
                  <IconBox size={14} /> Load Acceptance Scenario (A, B, C)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Source Parent Company */}
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    FROM (Parent / Manufacturing Company)
                  </div>
                  <Select
                    value={parentCompanyId}
                    onChange={(e) => setParentCompanyId(e.target.value)}
                    options={companies.map((c) => ({
                      label: `${c.name} ${c.isParent ? '(Parent / Manufacturing)' : ''}`,
                      value: c.id,
                    }))}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--brand-primary)',
                      marginTop: '4px',
                    }}
                  >
                    ★ Holds Finished Product inventory & actual manufacturing cost
                  </div>
                </div>

                {/* Destination Child Company */}
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    TO (Destination Child Company)
                  </div>
                  <Select
                    value={childCompanyId}
                    onChange={(e) => setChildCompanyId(e.target.value)}
                    options={companies
                      .filter((c) => c.id !== parentCompanyId)
                      .map((c) => ({
                        label: `${c.code} - ${c.name}`,
                        value: c.id,
                      }))}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    Selectable child company (e.g. Nectar, ConsceptAG, Agriventure, Excelium)
                  </div>
                </div>

                {/* Source Warehouse */}
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Shehswar Source Warehouse (Stock OUT -)
                  </div>
                  <Select
                    value={parentWarehouseId}
                    onChange={(e) => setParentWarehouseId(e.target.value)}
                    options={availableParentWarehouses.map((w) => ({
                      label: `${w.code} - ${w.name}`,
                      value: w.id,
                    }))}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    {isLoadingStock
                      ? 'Loading stock...'
                      : `${sourceStock.length} Finished Products available in this warehouse`}
                  </div>
                </div>

                {/* Destination Warehouse */}
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Child Destination Warehouse (Stock IN +)
                  </div>
                  <Select
                    value={childWarehouseId}
                    onChange={(e) => setChildWarehouseId(e.target.value)}
                    options={availableChildWarehouses.map((w) => ({
                      label: `${w.code} - ${w.name}`,
                      value: w.id,
                    }))}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    Receives Finished Products into child inventory
                  </div>
                </div>
              </div>

              {/* Intercompany Profit / Markup Setting */}
              <div
                style={{
                  marginTop: '18px',
                  padding: '14px 18px',
                  background: 'var(--surface-subtle)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconPercent size={18} color="var(--brand-primary)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>
                      Intercompany Profit / Markup Percentage
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Formula: Selling Rate = Cost + (Cost × Markup%). Fully customizable, not
                      hardcoded.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Presets:</span>
                  {[10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyGlobalMarkup(pct)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border:
                          globalMarkupPercent === pct
                            ? '1px solid var(--brand-primary)'
                            : '1px solid var(--border-color)',
                        background:
                          globalMarkupPercent === pct
                            ? 'var(--brand-primary)'
                            : 'var(--surface-primary)',
                        color: globalMarkupPercent === pct ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', width: '90px' }}>
                    <Input
                      type="number"
                      value={globalMarkupPercent}
                      onChange={(e) =>
                        handleApplyGlobalMarkup(parseFloat(e.target.value) || 0)
                      }
                      style={{ textAlign: 'center' }}
                    />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Multi-Product Line Items */}
          <Card>
            <CardHeader>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <CardTitle>2. Product Selection & Multi-Product Line Items</CardTitle>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Select Finished Products from Shehswar's actual stock. Rates and costs are
                    fetched automatically.
                  </p>
                </div>

                {/* Quick Add Form */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ minWidth: '320px' }}>
                    <Select
                      value={selectedProductToAdd}
                      onChange={(e) => setSelectedProductToAdd(e.target.value)}
                      options={sourceStock.map((s) => ({
                        label: `${s.productCode} - ${s.productName} (${s.packSize}) | Avail: ${s.availableStock} | Cost: PKR ${s.unitCost}`,
                        value: s.finishedProductId,
                      }))}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAddProduct()}
                    disabled={sourceStock.length === 0}
                  >
                    <IconPlus size={15} /> Add Product
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {lineItems.length === 0 ? (
                <div
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <IconBox size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    No products added to this transfer yet
                  </div>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    Select a Finished Product above and click <strong>Add Product</strong>, or click{' '}
                    <strong>Load Acceptance Scenario</strong> to test the 3-product transfer.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: '2px solid var(--border-color)',
                          textAlign: 'left',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <th style={{ padding: '10px 8px' }}>#</th>
                        <th style={{ padding: '10px 8px' }}>Product & Code</th>
                        <th style={{ padding: '10px 8px' }}>Pack Size</th>
                        <th style={{ padding: '10px 8px' }}>Batch #</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                          Available Stock
                        </th>
                        <th style={{ padding: '10px 8px', width: '110px' }}>
                          Transfer Qty *
                        </th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                          Shehswar Cost
                        </th>
                        <th style={{ padding: '10px 8px', width: '90px' }}>Markup %</th>
                        <th style={{ padding: '10px 8px', width: '120px' }}>Selling Rate</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                          Total Sales
                        </th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                          Shehswar Profit
                        </th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => {
                        const isExceeded = item.quantity > item.availableStock;
                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              background: isExceeded ? '#fff5f5' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.productName}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {item.productCode}
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                              {item.packSize}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <Badge variant="secondary">{item.batchNumber}</Badge>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color:
                                    item.availableStock > 0
                                      ? 'var(--brand-success)'
                                      : 'var(--brand-danger)',
                                }}
                              >
                                {item.availableStock.toLocaleString()}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    item.id,
                                    'quantity',
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                style={{
                                  borderColor: isExceeded
                                    ? 'var(--brand-danger)'
                                    : undefined,
                                  color: isExceeded ? 'var(--brand-danger)' : undefined,
                                  fontWeight: 600,
                                }}
                              />
                              {isExceeded && (
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--brand-danger)',
                                    marginTop: '2px',
                                    fontWeight: 600,
                                  }}
                                >
                                  Max: {item.availableStock}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              PKR {item.unitCost.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Input
                                type="number"
                                value={item.markupPercent}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    item.id,
                                    'markupPercent',
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                style={{ textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Input
                                type="number"
                                value={item.sellingPrice}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    item.id,
                                    'sellingPrice',
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                style={{ textAlign: 'right', fontWeight: 600 }}
                              />
                            </td>
                            <td
                              style={{
                                padding: '12px 8px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: 'var(--brand-primary)',
                              }}
                            >
                              PKR {item.totalSales.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: '12px 8px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: 'var(--brand-success)',
                              }}
                            >
                              PKR {item.profit.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(item.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--brand-danger)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                title="Remove row"
                              >
                                <IconTrash size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          borderTop: '2px solid var(--border-color)',
                          background: 'var(--surface-subtle)',
                          fontWeight: 700,
                        }}
                      >
                        <td colSpan={5} style={{ padding: '12px 8px' }}>
                          TOTALS ({lineItems.length} Products, {grandTotals.totalUnits} Units)
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {grandTotals.totalUnits.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          PKR {grandTotals.totalCost.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {grandTotals.effectiveMarkup}%
                        </td>
                        <td style={{ padding: '12px 8px' }}>-</td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'right',
                            color: 'var(--brand-primary)',
                            fontSize: '14px',
                          }}
                        >
                          PKR {grandTotals.totalSales.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'right',
                            color: 'var(--brand-success)',
                            fontSize: '14px',
                          }}
                        >
                          PKR {grandTotals.totalProfit.toLocaleString()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Transfer Reference Notes */}
              <div style={{ marginTop: '16px' }}>
                <Input
                  label="Transfer Delivery Notes & Reference"
                  placeholder="e.g. Monthly replenishment batch #2026-04 for regional distribution"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>

              {/* Financial KPI Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                  marginTop: '20px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Total Shehswar Manufacturing Cost
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      marginTop: '4px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    PKR {grandTotals.totalCost.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Actual cost of {grandTotals.totalUnits} units dispatched
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Total Intercompany Sales Value
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      marginTop: '4px',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    PKR {grandTotals.totalSales.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Billed to {activeChildCompany?.name || 'Child Company'}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: '#e6f8f0',
                    border: '1px solid #7be4b8',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#0d764e', fontWeight: 600 }}>
                    Shehswar Intercompany Profit Earned
                  </div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      marginTop: '4px',
                      color: '#0d764e',
                    }}
                  >
                    PKR {grandTotals.totalProfit.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#0d764e', fontWeight: 600 }}>
                    Profit Margin: +{grandTotals.effectiveMarkup}%
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Child Inventory Valuation
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      marginTop: '4px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    PKR {grandTotals.totalSales.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Child purchase cost & intercompany payable
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '24px',
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setLineItems([])}
                  disabled={lineItems.length === 0 || isSubmitting}
                >
                  Clear All
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={
                    lineItems.length === 0 ||
                    grandTotals.hasStockError ||
                    grandTotals.hasZeroQty ||
                    isSubmitting
                  }
                  style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
                >
                  <IconCheck size={18} />
                  {isSubmitting ? 'Posting Transfer...' : 'POST Intercompany Transfer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHEHSWAR PROFIT REPORT (Parent View)                               */}
      {/* ========================================================================= */}
      {activeTab === 'SHEHSWAR_PROFIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <CardTitle>Shehswar Intercompany Profit & Margin Report</CardTitle>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Real-time aggregated profitability on Finished Products sold to child
                    companies.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadProfitReport}
                  disabled={isLoadingProfitReport}
                >
                  <IconRefresh size={14} /> Refresh Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProfitReport ? (
                <TableSkeleton rows={4} columns={6} />
              ) : !profitReport ? (
                <div style={{ textAlign: 'center', padding: '36px' }}>
                  No profit report data available.
                </div>
              ) : (
                <>
                  {/* Summary KPI Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '14px',
                      marginBottom: '24px',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Total Intercompany Sales
                      </div>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 700,
                          color: 'var(--brand-primary)',
                        }}
                      >
                        PKR {profitReport.summary?.totalSales?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Total Manufacturing Cost
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>
                        PKR {profitReport.summary?.totalCost?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '16px',
                        background: '#e6f8f0',
                        borderRadius: '8px',
                        border: '1px solid #7be4b8',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#0d764e', fontWeight: 600 }}>
                        Shehswar Profit Earned
                      </div>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#0d764e',
                        }}
                      >
                        PKR {profitReport.summary?.totalProfit?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Overall Margin %
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>
                        {profitReport.summary?.overallMarginPercent || 0}%
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Total Units Dispatched
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>
                        {profitReport.summary?.totalUnits?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>

                  {/* Product-Level Profit Table */}
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      margin: '0 0 12px 0',
                    }}
                  >
                    Product-Level Profit Performance
                  </h3>
                  <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '2px solid var(--border-color)',
                            textAlign: 'left',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Product</th>
                          <th style={{ padding: '10px 8px' }}>Pack Size</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Qty Dispatched
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Cost Rate (PKR)
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Avg Selling Rate (PKR)
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Total Sales (PKR)
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Total Cost (PKR)
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Profit (PKR)
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitReport.productPerformance?.map((p: any) => (
                          <tr
                            key={p.productId}
                            style={{ borderBottom: '1px solid var(--border-color)' }}
                          >
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{ fontWeight: 600 }}>{p.productName}</div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {p.productCode}
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                              {p.packSize}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                              {p.totalQuantity?.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {p.unitCost?.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {p.averageSellingRate?.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: '12px 8px',
                                textAlign: 'right',
                                fontWeight: 600,
                                color: 'var(--brand-primary)',
                              }}
                            >
                              {p.totalSales?.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {p.totalCost?.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: '12px 8px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: 'var(--brand-success)',
                              }}
                            >
                              {p.totalProfit?.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: '12px 8px',
                                textAlign: 'right',
                                fontWeight: 600,
                              }}
                            >
                              +{p.marginPercent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr
                          style={{
                            borderTop: '2px solid var(--border-color)',
                            background: 'var(--surface-subtle)',
                            fontWeight: 700,
                          }}
                        >
                          <td colSpan={2} style={{ padding: '12px 8px' }}>
                            GRAND TOTALS
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {profitReport.summary?.totalUnits?.toLocaleString()}
                          </td>
                          <td colSpan={2} />
                          <td
                            style={{
                              padding: '12px 8px',
                              textAlign: 'right',
                              color: 'var(--brand-primary)',
                            }}
                          >
                            PKR {profitReport.summary?.totalSales?.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            PKR {profitReport.summary?.totalCost?.toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: '12px 8px',
                              textAlign: 'right',
                              color: 'var(--brand-success)',
                            }}
                          >
                            PKR {profitReport.summary?.totalProfit?.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            +{profitReport.summary?.overallMarginPercent}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHILD COMPANY REPORT (Child View)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'CHILD_REPORT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <CardTitle>Child Company Received Goods & Intercompany Payables</CardTitle>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Inventory valuation and outstanding payables owed to Shehswar.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Select Child Company:</span>
                  <div style={{ width: '220px' }}>
                    <Select
                      value={selectedChildForReport}
                      onChange={(e) => {
                        setSelectedChildForReport(e.target.value);
                        loadChildReport(e.target.value);
                      }}
                      options={companies
                        .filter((c) => !c.isParent && c.code !== 'COMP-SHEHSWAR')
                        .map((c) => ({
                          label: `${c.code} - ${c.name}`,
                          value: c.id,
                        }))}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadChildReport(selectedChildForReport)}
                    disabled={isLoadingChildReport}
                  >
                    <IconRefresh size={14} /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingChildReport ? (
                <TableSkeleton rows={4} columns={6} />
              ) : !childReport ? (
                <div style={{ textAlign: 'center', padding: '36px' }}>
                  No child company report data found.
                </div>
              ) : (
                <>
                  {/* Summary KPI Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      marginBottom: '24px',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px',
                        background: '#fef3f2',
                        borderRadius: '8px',
                        border: '1px solid #fecdca',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#b42318', fontWeight: 600 }}>
                        Total Intercompany Payable to Shehswar
                      </div>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#b42318',
                          marginTop: '4px',
                        }}
                      >
                        PKR {childReport.intercompanyPayable?.toLocaleString() || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#b42318' }}>
                        Liability balance on child ledger
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Total Received Line Items
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                        {childReport.receivedItems?.length || 0}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--surface-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Child Finished Goods Stock Items
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                        {childReport.childStockStatus?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Received Goods Table */}
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>
                    Finished Goods Received from Shehswar
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '2px solid var(--border-color)',
                            textAlign: 'left',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Voucher #</th>
                          <th style={{ padding: '10px 8px' }}>Date</th>
                          <th style={{ padding: '10px 8px' }}>Parent Invoice</th>
                          <th style={{ padding: '10px 8px' }}>Product</th>
                          <th style={{ padding: '10px 8px' }}>Pack Size & Batch</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Qty Received
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Purchase Rate
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Total Value
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                            Current Warehouse Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {childReport.receivedItems?.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              style={{
                                padding: '24px',
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              No goods received for this child company yet.
                            </td>
                          </tr>
                        ) : (
                          childReport.receivedItems?.map((it: any, idx: number) => (
                            <tr
                              key={idx}
                              style={{ borderBottom: '1px solid var(--border-color)' }}
                            >
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {it.voucherNumber}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                {new Date(it.date).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                                {it.vendorInvoiceNo}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{it.productName}</div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {it.productCode}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>{it.packSize}</td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                }}
                              >
                                {it.quantityReceived?.toLocaleString()}
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                PKR {it.purchaseRate?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--brand-primary)',
                                }}
                              >
                                PKR {it.totalValue?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--brand-success)',
                                }}
                              >
                                {it.currentStockInChildWarehouse?.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TRANSFER HISTORY                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <Card>
          <CardHeader>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <CardTitle>Intercompany Transfer History Log</CardTitle>
                <p
                  style={{
                    margin: '2px 0 0 0',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Complete audit log of multi-product parent sales and child purchase vouchers.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadTransferHistory}
                disabled={isLoadingHistory}
              >
                <IconRefresh size={14} /> Refresh History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <TableSkeleton rows={4} columns={6} />
            ) : history.length === 0 ? (
              <div
                style={{
                  padding: '36px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                No transfers recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '2px solid var(--border-color)',
                        textAlign: 'left',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <th style={{ padding: '10px 8px' }}>Invoice No</th>
                      <th style={{ padding: '10px 8px' }}>Date</th>
                      <th style={{ padding: '10px 8px' }}>Route</th>
                      <th style={{ padding: '10px 8px' }}>Items Transferred</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                        Total Value (PKR)
                      </th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                        Shehswar Profit (PKR)
                      </th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr
                        key={t.id}
                        style={{ borderBottom: '1px solid var(--border-color)' }}
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                          {t.invoiceNumber}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {new Date(t.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: 600 }}>
                            {t.sourceCompany} → {t.targetCompany}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {t.warehouse} → {t.targetWarehouse}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: 500 }}>
                            {t.items?.map((i: any) => i.productName).join(', ') ||
                              `${t.itemsCount} items`}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--brand-primary)',
                          }}
                        >
                          PKR {Number(t.amount || 0).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--brand-success)',
                          }}
                        >
                          PKR {Number(t.profit || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <Badge variant="success">POSTED</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Intercompany Transfer"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                background: 'var(--surface-subtle)',
                borderRadius: '8px',
              }}
            >
              <IconBuilding size={20} color="var(--brand-primary)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {activeParentCompany?.name} → {activeChildCompany?.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {lineItems.length} Products | {grandTotals.totalUnits} Units
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Total Sales Value:</span>
                <div style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '16px' }}>
                  PKR {grandTotals.totalSales.toLocaleString()}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Shehswar Profit:</span>
                <div style={{ fontWeight: 700, color: 'var(--brand-success)', fontSize: '16px' }}>
                  PKR {grandTotals.totalProfit.toLocaleString()} (+{grandTotals.effectiveMarkup}%)
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: '#f0f9ff',
                border: '1px solid #b9e6fe',
                fontSize: '12px',
                color: '#026aa2',
              }}
            >
              <strong>Atomic Transaction Impact:</strong>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li>Shehswar: Generates Sales Invoice & deducts {grandTotals.totalUnits} units.</li>
                <li>
                  {activeChildCompany?.name}: Generates Purchase Invoice & increments inventory.
                </li>
                <li>Financial ledgers updated simultaneously with matching transaction ID.</li>
              </ul>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '8px',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitTransfer}
                disabled={isSubmitting}
              >
                <IconCheck size={16} />
                {isSubmitting ? 'Posting Transfer...' : 'Confirm & Post Transfer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
