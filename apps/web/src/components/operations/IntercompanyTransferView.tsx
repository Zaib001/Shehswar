'use client';

/**
 * SHEHSWAR ONE360 - Inter Company Transfer (Modern ERP Interface)
 *
 * Requirements:
 * 1. Modern, professional, compact, keyboard-first ERP layout with minimal scrolling.
 * 2. Compact Header: Transfer No (e.g. IC-000001), Date, Document Status Lifecycle (Draft, Pending Approval, Approved, Posted).
 * 3. Keyboard-first Company & Warehouse selection (Tab -> Focus -> Type -> Enter -> Auto Advance).
 * 4. Compact Product Selection Table:
 *    # | Product | Batch | Available | Qty | Cost | Markup % | Sale Rate | Total | Actions
 *    - Searchable Combobox for quick adding by Code, Name, or Batch.
 *    - Auto-fill Available Stock, Cost, Batch Number.
 *    - Strict quantity validation with inline warning: "Insufficient stock available in the selected source warehouse."
 *    - Live recalculation of Selling Rate = Cost + (Cost * Markup%) and Total = Qty * Sale Rate.
 * 5. Compact Summary & Actions:
 *    - Products Count, Total Qty, Total Cost, Intercompany Sales, Gross Profit.
 *    - [ Save Draft ], [ Review ], [ Post Transfer ] action lifecycle buttons.
 * 6. Scoped data & multi-tab reporting:
 *    - Shehswar Profit Report
 *    - Child Inventory & Payables
 *    - Transfer History with Status badges
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Badge,
  Modal,
  TableSkeleton,
  SearchableCombobox,
  ComboboxOption,
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
  IconClock,
  IconFileText,
  IconArrowsRightLeft,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { useCompany } from '../../context/company-context';
import { ApiClient } from '../../lib/api-client';

export type DocumentLifecycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'CANCELLED';

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
  availableBatches?: string[];
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
  const { activeCompany } = useCompany();

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

  // Document Lifecycle & Meta
  const [docNumber, setDocNumber] = useState<string>('IC-000001');
  const [docDate, setDocDate] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '');
  const [docStatus, setDocStatus] = useState<DocumentLifecycleStatus>('DRAFT');

  // Form State: Company & Warehouse Selection
  const [fromCompanyId, setFromCompanyId] = useState<string>('');
  const [toCompanyId, setToCompanyId] = useState<string>('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [destWarehouseId, setDestWarehouseId] = useState<string>('');

  // Global Markup & Reference
  const [globalMarkupPercent, setGlobalMarkupPercent] = useState<number>(15);
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Multi-Product Line Items
  const [lineItems, setLineItems] = useState<TransferLineItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');

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
        ApiClient.get<any>('/api/v1/master-data/companies?all=true'),
        ApiClient.get<any>('/api/v1/master-data/warehouses?all=true'),
      ]);

      const compList = Array.isArray(compRes.data)
        ? compRes.data
        : compRes.data?.data || [];
      const whList = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];

      setCompanies(compList);
      setWarehouses(whList);

      // Identify Parent (Shehswar or activeCompany)
      let parent = compList.find((c: any) => c.isParent || c.code === 'COMP-SHEHSWAR');
      if (activeCompany && (activeCompany.isParent || compList.some((c: any) => c.id === activeCompany.id))) {
        const found = compList.find((c: any) => c.id === activeCompany.id);
        if (found && (found.isParent || found.code === 'COMP-SHEHSWAR')) {
          parent = found;
        }
      }
      if (!parent && compList.length > 0) parent = compList[0];

      const children = compList.filter((c: any) => c.id !== parent?.id);

      if (parent) {
        setFromCompanyId(parent.id);
        const parentWhs = whList.filter((w: any) => w.companyId === parent.id);
        if (parentWhs.length > 0) {
          setSourceWarehouseId(parentWhs[0].id);
        }
      }

      if (children.length > 0) {
        setToCompanyId(children[0].id);
        setSelectedChildForReport(children[0].id);
        const childWhs = whList.filter((w: any) => w.companyId === children[0].id);
        if (childWhs.length > 0) {
          setDestWarehouseId(childWhs[0].id);
        }
      }

      // Generate a dynamic preview document number
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      setDocNumber(`IC-${new Date().getFullYear()}-${randomSeq}`);
    } catch (err: any) {
      showToast({
        title: 'Error Loading Master Data',
        message: err?.message || 'Could not fetch companies/warehouses',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, activeCompany]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Fetch available Finished Product Stock when Source Warehouse changes
  const fetchSourceStock = useCallback(
    async (warehouseId: string) => {
      if (!warehouseId) {
        setSourceStock([]);
        return;
      }
      setIsLoadingStock(true);
      try {
        const res = await ApiClient.get<SourceStockItem[]>(
          `/api/v1/operations/intercompany/source-stock?warehouseId=${warehouseId}`,
        );
        const items = Array.isArray(res.data) ? res.data : [];
        setSourceStock(items);
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
    [showToast],
  );

  useEffect(() => {
    if (sourceWarehouseId) {
      fetchSourceStock(sourceWarehouseId);
    }
  }, [sourceWarehouseId, fetchSourceStock]);

  // Update Child Warehouses when Child Company changes
  const availableChildWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.companyId === toCompanyId);
  }, [warehouses, toCompanyId]);

  useEffect(() => {
    if (availableChildWarehouses.length > 0) {
      if (!availableChildWarehouses.some((w) => w.id === destWarehouseId)) {
        setDestWarehouseId(availableChildWarehouses[0].id);
      }
    } else {
      setDestWarehouseId('');
    }
  }, [availableChildWarehouses, destWarehouseId]);

  // Available Parent Warehouses
  const availableParentWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.companyId === fromCompanyId);
  }, [warehouses, fromCompanyId]);

  useEffect(() => {
    if (availableParentWarehouses.length > 0) {
      if (!availableParentWarehouses.some((w) => w.id === sourceWarehouseId)) {
        setSourceWarehouseId(availableParentWarehouses[0].id);
      }
    } else {
      setSourceWarehouseId('');
    }
  }, [availableParentWarehouses, sourceWarehouseId]);

  // Active Company names
  const activeFromCompany = useMemo(
    () => companies.find((c) => c.id === fromCompanyId),
    [companies, fromCompanyId],
  );
  const activeToCompany = useMemo(
    () => companies.find((c) => c.id === toCompanyId),
    [companies, toCompanyId],
  );

  // Combobox Options
  const fromCompanyOptions: ComboboxOption[] = useMemo(
    () =>
      companies.map((c) => ({
        value: c.id,
        label: c.name,
        badge: c.isParent ? 'PARENT / MFR' : 'ENTITY',
        subtext: `Code: ${c.code}`,
        searchTerms: `${c.name} ${c.code}`,
      })),
    [companies],
  );

  const toCompanyOptions: ComboboxOption[] = useMemo(
    () =>
      companies
        .filter((c) => c.id !== fromCompanyId)
        .map((c) => ({
          value: c.id,
          label: c.name,
          badge: 'CHILD DISTRIBUTOR',
          subtext: `Code: ${c.code}`,
          searchTerms: `${c.name} ${c.code}`,
        })),
    [companies, fromCompanyId],
  );

  const sourceWarehouseOptions: ComboboxOption[] = useMemo(
    () =>
      availableParentWarehouses.map((w) => ({
        value: w.id,
        label: w.name,
        badge: 'STOCK OUT',
        subtext: `Code: ${w.code}`,
        searchTerms: `${w.name} ${w.code}`,
      })),
    [availableParentWarehouses],
  );

  const destWarehouseOptions: ComboboxOption[] = useMemo(
    () =>
      availableChildWarehouses.map((w) => ({
        value: w.id,
        label: w.name,
        badge: 'STOCK IN',
        subtext: `Code: ${w.code}`,
        searchTerms: `${w.name} ${w.code}`,
      })),
    [availableChildWarehouses],
  );

  // Group source stock products for the searchable combobox
  const productSearchOptions: ComboboxOption[] = useMemo(() => {
    return sourceStock.map((s) => ({
      value: s.finishedProductId,
      label: `${s.productName} (${s.packSize})`,
      subtext: `Code: ${s.productCode} • Batch: ${s.batchNumber} • Avail: ${s.availableStock} • Cost: PKR ${s.unitCost.toLocaleString()}`,
      badge: `${s.availableStock} in stock`,
      searchTerms: `${s.productCode} ${s.productName} ${s.batchNumber} ${s.packSize}`,
    }));
  }, [sourceStock]);

  // 3. Add Product to Line Items Table
  const handleAddProduct = useCallback(
    (targetProdId: string) => {
      if (!targetProdId) return;

      const stockItem = sourceStock.find((s) => s.finishedProductId === targetProdId);
      if (!stockItem) {
        showToast({
          title: 'Product Not Found',
          message: 'Selected item is not currently available in source warehouse stock.',
          type: 'warning',
        });
        return;
      }

      // If already present, focus that row's quantity input
      const existing = lineItems.find((i) => i.finishedProductId === targetProdId);
      if (existing) {
        showToast({
          title: 'Already in Transfer',
          message: `${stockItem.productName} is already added. Adjust its quantity directly.`,
          type: 'info',
        });
        const existingInput = document.getElementById(`ic-qty-${existing.id}`);
        if (existingInput) existingInput.focus();
        setSearchProductQuery('');
        return;
      }

      const defaultQty = Math.min(100, stockItem.availableStock > 0 ? stockItem.availableStock : 100);
      const unitCost = stockItem.unitCost;
      const markup = globalMarkupPercent;
      const sellingRate = Math.round(unitCost * (1 + markup / 100) * 100) / 100;
      const totalCost = Math.round(defaultQty * unitCost * 100) / 100;
      const totalSales = Math.round(defaultQty * sellingRate * 100) / 100;
      const profit = Math.round((totalSales - totalCost) * 100) / 100;

      // Extract all available batches for this product in sourceStock
      const allBatches = sourceStock
        .filter((s) => s.finishedProductId === targetProdId && s.batchNumber)
        .map((s) => s.batchNumber);

      const newRowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newLine: TransferLineItem = {
        id: newRowId,
        finishedProductId: stockItem.finishedProductId,
        productCode: stockItem.productCode,
        productName: stockItem.productName,
        packSize: stockItem.packSize,
        batchNumber: stockItem.batchNumber || 'STD-BATCH',
        availableBatches: allBatches.length > 0 ? Array.from(new Set(allBatches)) : [stockItem.batchNumber || 'STD-BATCH'],
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
      setSearchProductQuery('');

      // Auto-focus the quantity input of the newly added row
      setTimeout(() => {
        const qtyEl = document.getElementById(`ic-qty-${newRowId}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    },
    [sourceStock, lineItems, globalMarkupPercent, showToast],
  );

  // Quick Load Standard Acceptance Scenario (Product A, B, C @ 15% Markup)
  const handleLoadAcceptanceScenario = () => {
    if (sourceStock.length === 0) {
      showToast({
        title: 'Source Stock Empty',
        message: 'No stock available in the selected source warehouse.',
        type: 'warning',
      });
      return;
    }

    const targetItems = sourceStock.slice(0, 3);
    const newRows: TransferLineItem[] = targetItems.map((stockItem) => {
      const defaultQty = 100;
      const unitCost = stockItem.unitCost;
      const markup = 15;
      const sellingRate = Math.round(unitCost * (1 + markup / 100) * 100) / 100;
      const totalCost = Math.round(defaultQty * unitCost * 100) / 100;
      const totalSales = Math.round(defaultQty * sellingRate * 100) / 100;
      const profit = Math.round((totalSales - totalCost) * 100) / 100;

      return {
        id: `row-${stockItem.finishedProductId}`,
        finishedProductId: stockItem.finishedProductId,
        productCode: stockItem.productCode,
        productName: stockItem.productName,
        packSize: stockItem.packSize,
        batchNumber: stockItem.batchNumber || 'STD-BATCH',
        availableStock: stockItem.availableStock,
        quantity: defaultQty,
        unitCost,
        markupPercent: markup,
        sellingPrice: sellingRate,
        totalCost,
        totalSales,
        profit,
      };
    });

    setLineItems(newRows);
    setGlobalMarkupPercent(15);
    setDocStatus('DRAFT');
    showToast({
      title: 'Acceptance Scenario Loaded',
      message: `Loaded ${newRows.length} Finished Products (100 units each @ 15% markup).`,
      type: 'success',
    });
  };

  // Update Line Item Values
  const handleUpdateLine = (
    id: string,
    field: 'quantity' | 'markupPercent' | 'sellingPrice' | 'batchNumber',
    val: any,
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        let quantity = item.quantity;
        let markupPercent = item.markupPercent;
        let sellingPrice = item.sellingPrice;
        let batchNumber = item.batchNumber;
        const unitCost = item.unitCost;

        if (field === 'quantity') {
          quantity = Math.max(0, parseFloat(val) || 0);
        } else if (field === 'markupPercent') {
          markupPercent = parseFloat(val) || 0;
          sellingPrice = Math.round(unitCost * (1 + markupPercent / 100) * 100) / 100;
        } else if (field === 'sellingPrice') {
          sellingPrice = Math.max(0, parseFloat(val) || 0);
          markupPercent =
            unitCost > 0
              ? Math.round(((sellingPrice - unitCost) / unitCost) * 1000) / 10
              : 0;
        } else if (field === 'batchNumber') {
          batchNumber = val;
        }

        const totalCost = Math.round(quantity * unitCost * 100) / 100;
        const totalSales = Math.round(quantity * sellingPrice * 100) / 100;
        const profit = Math.round((totalSales - totalCost) * 100) / 100;

        return {
          ...item,
          quantity,
          markupPercent,
          sellingPrice,
          batchNumber,
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

  // Financial Grand Totals & Validation
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

  // Execute Transfer Lifecycle Action (DRAFT, PENDING_APPROVAL, POSTED)
  const executeTransferAction = async (targetStatus: DocumentLifecycleStatus) => {
    if (!fromCompanyId || !toCompanyId) {
      showToast({
        title: 'Validation Error',
        message: 'Please select both From Company and To Company.',
        type: 'warning',
      });
      return;
    }
    if (fromCompanyId === toCompanyId) {
      showToast({
        title: 'Validation Error',
        message: 'From Company and To Company cannot be the same.',
        type: 'warning',
      });
      return;
    }
    if (!sourceWarehouseId || !destWarehouseId) {
      showToast({
        title: 'Validation Error',
        message: 'Please select both source and destination warehouses.',
        type: 'warning',
      });
      return;
    }
    if (lineItems.length === 0) {
      showToast({
        title: 'No Products',
        message: 'Please add at least one finished product to the transfer.',
        type: 'warning',
      });
      return;
    }
    if (grandTotals.hasZeroQty) {
      showToast({
        title: 'Invalid Quantity',
        message: 'All transfer items must have a quantity greater than zero.',
        type: 'warning',
      });
      return;
    }
    if (targetStatus === 'POSTED' && grandTotals.hasStockError) {
      const offending = lineItems.find((i) => i.quantity > i.availableStock);
      showToast({
        title: 'Insufficient Stock',
        message: `Insufficient stock for ${offending?.productName}. Available: ${offending?.availableStock}, Requested: ${offending?.quantity}`,
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        parentCompanyId: fromCompanyId,
        childCompanyId: toCompanyId,
        parentWarehouseId: sourceWarehouseId,
        childWarehouseId: destWarehouseId,
        defaultMarkupPercent: globalMarkupPercent,
        status: targetStatus,
        items: lineItems.map((i) => ({
          finishedProductId: i.finishedProductId,
          batchNumber: i.batchNumber,
          quantity: i.quantity,
          unitCost: i.unitCost,
          markupPercent: i.markupPercent,
          sellingPrice: i.sellingPrice,
        })),
        notes: transferNotes || `Intercompany dispatch ${docNumber}`,
      };

      const res = await ApiClient.post<any>('/api/v1/operations/intercompany/transfer', payload);

      setDocStatus(targetStatus);
      setIsConfirmModalOpen(false);

      if (targetStatus === 'DRAFT') {
        showToast({
          title: 'Draft Saved',
          message: `Intercompany transfer saved as Draft (${res.data?.parentSale?.invoiceNumber || docNumber}).`,
          type: 'info',
        });
      } else if (targetStatus === 'PENDING_APPROVAL') {
        showToast({
          title: 'Transfer Under Review',
          message: `Transfer ${res.data?.parentSale?.invoiceNumber || docNumber} is marked Pending Approval.`,
          type: 'success',
        });
      } else if (targetStatus === 'POSTED') {
        showToast({
          title: 'Transfer Posted Successfully!',
          message: `Sales Invoice ${res.data?.parentSale?.invoiceNumber} & Child Purchase ${res.data?.childPurchase?.voucherNumber} generated atomically. Profit: PKR ${res.data?.totalProfit?.toLocaleString()}`,
          type: 'success',
        });
        // Refresh source stock
        fetchSourceStock(sourceWarehouseId);
      }
    } catch (err: any) {
      showToast({
        title: 'Transaction Error',
        message: err?.message || 'Error processing intercompany transfer transaction.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to start a new transfer
  const handleStartNewTransfer = () => {
    setLineItems([]);
    setTransferNotes('');
    setDocStatus('DRAFT');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    setDocNumber(`IC-${new Date().getFullYear()}-${randomSeq}`);
    if (sourceWarehouseId) fetchSourceStock(sourceWarehouseId);
    showToast({
      title: 'New Transfer Initialized',
      message: 'Clean form ready for entry.',
      type: 'info',
    });
  };

  // Load Shehswar Profit Report
  const loadProfitReport = useCallback(async () => {
    setIsLoadingProfitReport(true);
    try {
      const res = await ApiClient.get<any>(
        `/api/v1/operations/intercompany/profit-report?companyId=${fromCompanyId}`,
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
  }, [fromCompanyId, showToast]);

  // Load Child Company Report
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

  // Load Transfer History
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

  // Refresh data on tab change
  useEffect(() => {
    if (activeTab === 'SHEHSWAR_PROFIT') {
      loadProfitReport();
    } else if (activeTab === 'CHILD_REPORT') {
      loadChildReport(selectedChildForReport || toCompanyId);
    } else if (activeTab === 'HISTORY') {
      loadTransferHistory();
    }
  }, [
    activeTab,
    loadProfitReport,
    loadChildReport,
    loadTransferHistory,
    selectedChildForReport,
    toCompanyId,
  ]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '4px',
      }}
    >
      {/* ── TOP NAV BAR & TABS ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <IconArrowsRightLeft size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                INTER COMPANY TRANSFER
              </h1>
              <Badge variant="primary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Parent → Child Flow
              </Badge>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Keyboard-first multi-product intercompany transfers with real-time margins & ledger isolation
            </div>
          </div>
        </div>

        {/* Global Tabs Navigation */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface-raised)',
            borderRadius: 'var(--radius-md)',
            padding: '3px',
            gap: '3px',
            border: '1px solid var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('NEW_SALE')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'NEW_SALE' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'NEW_SALE' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconPlus size={14} /> Create Transfer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SHEHSWAR_PROFIT')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'SHEHSWAR_PROFIT' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'SHEHSWAR_PROFIT' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconTrendingUp size={14} /> Profit Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CHILD_REPORT')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'CHILD_REPORT' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'CHILD_REPORT' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconBuilding size={14} /> Child Payables
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'HISTORY' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'HISTORY' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconRefresh size={14} /> History Log
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '24px', background: 'var(--bg-surface-raised)', borderRadius: '8px' }}>
          <TableSkeleton rows={4} columns={4} />
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: CREATE INTERCOMPANY TRANSFER (Keyboard-First Compact View)         */}
          {/* ========================================================================= */}
          {activeTab === 'NEW_SALE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* ── 1. COMPACT HEADER & 4-SELECTOR KEYBOARD ROUTING ────────────────── */}
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Document Meta Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingBottom: '10px',
                    marginBottom: '10px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        TRANSFER NO:
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          fontFamily: 'monospace',
                          background: 'rgba(13, 148, 136, 0.08)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(13, 148, 136, 0.2)',
                        }}
                      >
                        {docNumber}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        DATE:
                      </span>
                      <input
                        type="date"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{
                          border: '1px solid var(--border-default)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '12px',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        STATUS:
                      </span>
                      <Badge
                        variant={
                          docStatus === 'POSTED'
                            ? 'success'
                            : docStatus === 'PENDING_APPROVAL'
                            ? 'warning'
                            : docStatus === 'APPROVED'
                            ? 'primary'
                            : 'secondary'
                        }
                        style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}
                      >
                        {docStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleLoadAcceptanceScenario}
                      title="Load sample 3-Product test scenario (100 units each @ 15% markup)"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      <IconBox size={13} /> Load Scenario (A, B, C)
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleStartNewTransfer}
                      title="Reset transfer document"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      <IconRefresh size={13} /> Reset
                    </Button>
                  </div>
                </div>

                {/* 4-Field Responsive Keyboard Navigation Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: '12px',
                    alignItems: 'start',
                  }}
                >
                  {/* From Company */}
                  <div>
                    <SearchableCombobox
                      id="ic-from-company"
                      label="From Company *"
                      required
                      options={fromCompanyOptions}
                      value={fromCompanyId}
                      onChange={(val) => setFromCompanyId(val)}
                      nextFocusId="ic-source-warehouse"
                      placeholder="Type & Enter to select Parent..."
                      style={{ fontSize: '12px' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px' }}>
                      ★ Holds Finished Stock & Standard Cost
                    </div>
                  </div>

                  {/* Source Warehouse */}
                  <div>
                    <SearchableCombobox
                      id="ic-source-warehouse"
                      label="Source Warehouse *"
                      required
                      options={sourceWarehouseOptions}
                      value={sourceWarehouseId}
                      onChange={(val) => setSourceWarehouseId(val)}
                      nextFocusId="ic-to-company"
                      placeholder="Type & Enter warehouse..."
                      style={{ fontSize: '12px' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {isLoadingStock
                        ? 'Loading source stock...'
                        : `${sourceStock.length} Products physically available`}
                    </div>
                  </div>

                  {/* To Company */}
                  <div>
                    <SearchableCombobox
                      id="ic-to-company"
                      label="To Company *"
                      required
                      options={toCompanyOptions}
                      value={toCompanyId}
                      onChange={(val) => setToCompanyId(val)}
                      nextFocusId="ic-dest-warehouse"
                      placeholder="Type & Enter Child Company..."
                      style={{ fontSize: '12px' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Child distributor receiving inventory
                    </div>
                  </div>

                  {/* Destination Warehouse */}
                  <div>
                    <SearchableCombobox
                      id="ic-dest-warehouse"
                      label="Destination Warehouse *"
                      required
                      options={destWarehouseOptions}
                      value={destWarehouseId}
                      onChange={(val) => setDestWarehouseId(val)}
                      nextFocusId="ic-product-search"
                      placeholder="Type & Enter destination warehouse..."
                      style={{ fontSize: '12px' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Stock incremented upon posting
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. PRODUCT SEARCH & QUICK-ADD TOOLBAR ──────────────────────── */}
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                {/* Search / Add Combobox */}
                <div style={{ flex: '1 1 340px', minWidth: '280px' }}>
                  <SearchableCombobox
                    id="ic-product-search"
                    options={productSearchOptions}
                    value={searchProductQuery}
                    onChange={(val) => {
                      if (val) {
                        handleAddProduct(val);
                      }
                    }}
                    placeholder="Search Finished Product by Code, Name, or Batch (Enter to add)..."
                    disabled={sourceStock.length === 0}
                    style={{ fontSize: '12px' }}
                  />
                </div>

                {/* Global Markup Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--bg-surface)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <IconPercent size={14} color="var(--color-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    MARKUP:
                  </span>
                  {[10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyGlobalMarkup(pct)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border:
                          globalMarkupPercent === pct
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--border-default)',
                        background:
                          globalMarkupPercent === pct
                            ? 'var(--color-primary)'
                            : 'var(--bg-surface-raised)',
                        color: globalMarkupPercent === pct ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '11px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', width: '56px' }}>
                    <input
                      type="number"
                      value={globalMarkupPercent}
                      onChange={(e) =>
                        handleApplyGlobalMarkup(parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>

              {/* ── 3. COMPACT PRODUCT SELECTION TABLE ─────────────────────────── */}
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {lineItems.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <IconBox size={28} style={{ marginBottom: '6px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      No Products Added to Transfer
                    </div>
                    <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                      Search a product above or click <strong>Load Scenario (A, B, C)</strong> to populate.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '12px',
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: 'var(--bg-surface)',
                            borderBottom: '1px solid var(--border-default)',
                            color: 'var(--text-muted)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '11px',
                            letterSpacing: '0.03em',
                          }}
                        >
                          <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Product</th>
                          <th style={{ padding: '8px 10px', width: '130px' }}>Batch</th>
                          <th style={{ padding: '8px 10px', width: '90px', textAlign: 'right' }}>
                            Available
                          </th>
                          <th style={{ padding: '8px 10px', width: '110px' }}>Qty *</th>
                          <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>
                            Cost
                          </th>
                          <th style={{ padding: '8px 10px', width: '85px', textAlign: 'center' }}>
                            Markup %
                          </th>
                          <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>
                            Sale Rate
                          </th>
                          <th style={{ padding: '8px 10px', width: '120px', textAlign: 'right' }}>
                            Total
                          </th>
                          <th style={{ padding: '8px 10px', width: '45px', textAlign: 'center' }}>
                            Act
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => {
                          const isExceeded = item.quantity > item.availableStock;
                          const isZero = item.quantity <= 0;

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid var(--border-default)',
                                background: isExceeded
                                  ? 'rgba(239, 68, 68, 0.06)'
                                  : idx % 2 === 0
                                  ? 'transparent'
                                  : 'var(--bg-surface-table-alt, rgba(0,0,0,0.01))',
                              }}
                            >
                              {/* # */}
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </td>

                              {/* Product & Pack Size */}
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.productName}
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    gap: '6px',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span>{item.productCode}</span>
                                  <span>•</span>
                                  <span style={{ color: 'var(--color-primary)' }}>{item.packSize}</span>
                                </div>
                              </td>

                              {/* Batch Selection */}
                              <td style={{ padding: '6px 8px' }}>
                                {item.availableBatches && item.availableBatches.length > 1 ? (
                                  <select
                                    value={item.batchNumber}
                                    onChange={(e) =>
                                      handleUpdateLine(item.id, 'batchNumber', e.target.value)
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '4px 6px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-default)',
                                      background: 'var(--bg-surface)',
                                      color: 'var(--text-primary)',
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {item.availableBatches.map((b) => (
                                      <option key={b} value={b}>
                                        {b}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '11px',
                                      background: 'var(--bg-surface)',
                                      padding: '3px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-default)',
                                    }}
                                  >
                                    {item.batchNumber}
                                  </span>
                                )}
                              </td>

                              {/* Available Stock */}
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color:
                                    item.availableStock > 0
                                      ? 'var(--color-success)'
                                      : 'var(--color-danger)',
                                }}
                              >
                                {item.availableStock.toLocaleString()}
                              </td>

                              {/* Quantity */}
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  id={`ic-qty-${item.id}`}
                                  type="number"
                                  min="1"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onChange={(e) =>
                                    handleUpdateLine(
                                      item.id,
                                      'quantity',
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const markupEl = document.getElementById(`ic-markup-${item.id}`);
                                      if (markupEl) markupEl.focus();
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                    border: isExceeded
                                      ? '1.5px solid var(--color-danger)'
                                      : '1px solid var(--border-default)',
                                    background: isExceeded
                                      ? '#fef2f2'
                                      : 'var(--bg-surface)',
                                    color: isExceeded ? '#dc2626' : 'var(--text-primary)',
                                    textAlign: 'right',
                                  }}
                                />
                                {isExceeded && (
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: 'var(--color-danger)',
                                      marginTop: '2px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Insufficient stock available in the selected source warehouse.
                                  </div>
                                )}
                                {isZero && (
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: 'var(--color-danger)',
                                      marginTop: '2px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Quantity must be &gt; 0
                                  </div>
                                )}
                              </td>

                              {/* Cost */}
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 500,
                                }}
                              >
                                PKR {item.unitCost.toLocaleString()}
                              </td>

                              {/* Markup % */}
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  id={`ic-markup-${item.id}`}
                                  type="number"
                                  value={item.markupPercent}
                                  onChange={(e) =>
                                    handleUpdateLine(
                                      item.id,
                                      'markupPercent',
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      // Advance to next row or back to product search
                                      const nextIndex = idx + 1;
                                      const nextItem = lineItems[nextIndex];
                                      if (nextItem) {
                                        const nextQtyEl = document.getElementById(
                                          `ic-qty-${nextItem.id}`,
                                        );
                                        if (nextQtyEl) nextQtyEl.focus();
                                      } else {
                                        const searchEl = document.getElementById('ic-product-search');
                                        if (searchEl) searchEl.focus();
                                      }
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              </td>

                              {/* Sale Rate */}
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--color-primary)',
                                }}
                              >
                                PKR {item.sellingPrice.toLocaleString()}
                              </td>

                              {/* Total */}
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                PKR {item.totalSales.toLocaleString()}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(item.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-danger)',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto',
                                  }}
                                  title="Delete Line"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── 4. COMPACT SUMMARY & ACTION CONTROLS ───────────────────────── */}
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Metrics Breakdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Products: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{lineItems.length}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Total Qty: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {grandTotals.totalUnits.toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Total Cost: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      PKR {grandTotals.totalCost.toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Intercompany Sales: </span>
                    <strong style={{ color: 'var(--color-primary)' }}>
                      PKR {grandTotals.totalSales.toLocaleString()}
                    </strong>
                  </div>
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Gross Profit:</span>
                    <strong style={{ color: 'var(--color-success)' }}>
                      PKR {grandTotals.totalProfit.toLocaleString()} (+{grandTotals.effectiveMarkup}%)
                    </strong>
                  </div>
                </div>

                {/* Action Buttons: Save Draft, Review, Post Transfer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => executeTransferAction('DRAFT')}
                    disabled={isSubmitting || lineItems.length === 0}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    <IconFileText size={14} /> Save Draft
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => executeTransferAction('PENDING_APPROVAL')}
                    disabled={isSubmitting || lineItems.length === 0 || grandTotals.hasZeroQty}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    <IconClock size={14} /> Review
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={
                      isSubmitting ||
                      lineItems.length === 0 ||
                      grandTotals.hasStockError ||
                      grandTotals.hasZeroQty ||
                      docStatus === 'POSTED'
                    }
                    style={{
                      fontSize: '12px',
                      padding: '6px 16px',
                      fontWeight: 600,
                      background: grandTotals.hasStockError ? 'var(--color-danger)' : undefined,
                    }}
                  >
                    <IconCheck size={14} />
                    {docStatus === 'POSTED' ? 'Posted (Complete)' : 'Post Intercompany Transfer'}
                  </Button>
                </div>
              </div>

              {/* Delivery Reference / Notes (Optional compact row) */}
              <div style={{ padding: '0 4px' }}>
                <input
                  type="text"
                  placeholder="Optional delivery notes / transfer remarks..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface-raised)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SHEHSWAR PROFIT REPORT (Parent View)                               */}
          {/* ========================================================================= */}
          {activeTab === 'SHEHSWAR_PROFIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Shehswar Intercompany Profit & Margin Report
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Real-time aggregated profitability on Finished Products sold to child distributors
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadProfitReport}
                    disabled={isLoadingProfitReport}
                    style={{ fontSize: '11px' }}
                  >
                    <IconRefresh size={13} /> Refresh
                  </Button>
                </div>

                {isLoadingProfitReport ? (
                  <TableSkeleton rows={4} columns={6} />
                ) : !profitReport ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No profit report data available.
                  </div>
                ) : (
                  <>
                    {/* Summary KPI Cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '10px',
                        marginBottom: '16px',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Total Intercompany Sales
                        </div>
                        <div
                          style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            marginTop: '2px',
                          }}
                        >
                          PKR {profitReport.summary?.totalSales?.toLocaleString() || 0}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Total Manufacturing Cost
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                          PKR {profitReport.summary?.totalCost?.toLocaleString() || 0}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                          Shehswar Profit Earned
                        </div>
                        <div
                          style={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: 'var(--color-success)',
                            marginTop: '2px',
                          }}
                        >
                          PKR {profitReport.summary?.totalProfit?.toLocaleString() || 0}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overall Margin %</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                          +{profitReport.summary?.overallMarginPercent || 0}%
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Units Dispatched</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                          {profitReport.summary?.totalUnits?.toLocaleString() || 0}
                        </div>
                      </div>
                    </div>

                    {/* Product Performance Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '12px',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-default)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              textAlign: 'left',
                              fontSize: '11px',
                            }}
                          >
                            <th style={{ padding: '8px 10px' }}>Product</th>
                            <th style={{ padding: '8px 10px' }}>Pack Size</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty Dispatched</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cost Rate</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Avg Selling Rate</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Sales</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Cost</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Profit</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Margin %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profitReport.productPerformance?.map((p: any) => (
                            <tr key={p.productId} style={{ borderBottom: '1px solid var(--border-default)' }}>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 600 }}>{p.productName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {p.productCode}
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                                {p.packSize}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                {p.totalQuantity?.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                PKR {p.unitCost?.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                PKR {p.averageSellingRate?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--color-primary)',
                                }}
                              >
                                PKR {p.totalSales?.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                PKR {p.totalCost?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: 'var(--color-success)',
                                }}
                              >
                                PKR {p.totalProfit?.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                +{p.marginPercent}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CHILD COMPANY REPORT (Child View)                                  */}
          {/* ========================================================================= */}
          {activeTab === 'CHILD_REPORT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Child Company Inventory & Intercompany Payables
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Received finished stock valuation and outstanding liability owed to Shehswar
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Child Entity:</span>
                    <select
                      value={selectedChildForReport}
                      onChange={(e) => {
                        setSelectedChildForReport(e.target.value);
                        loadChildReport(e.target.value);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-default)',
                        fontSize: '12px',
                        background: 'var(--bg-surface)',
                      }}
                    >
                      {companies
                        .filter((c) => !c.isParent && c.code !== 'COMP-SHEHSWAR')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => loadChildReport(selectedChildForReport)}
                      disabled={isLoadingChildReport}
                      style={{ fontSize: '11px' }}
                    >
                      <IconRefresh size={13} />
                    </Button>
                  </div>
                </div>

                {isLoadingChildReport ? (
                  <TableSkeleton rows={4} columns={6} />
                ) : !childReport ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No child records available.
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '10px',
                        marginBottom: '16px',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                          Total Payable to Shehswar
                        </div>
                        <div
                          style={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: '#b91c1c',
                            marginTop: '2px',
                          }}
                        >
                          PKR {childReport.intercompanyPayable?.toLocaleString() || 0}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Received Transfer Invoices
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                          {childReport.receivedItems?.length || 0}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          background: 'var(--bg-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Child Physical Stock Lines
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                          {childReport.childStockStatus?.length || 0}
                        </div>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '12px',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-default)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              textAlign: 'left',
                              fontSize: '11px',
                            }}
                          >
                            <th style={{ padding: '8px 10px' }}>Voucher #</th>
                            <th style={{ padding: '8px 10px' }}>Date</th>
                            <th style={{ padding: '8px 10px' }}>Product</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty Received</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Purchase Rate</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Value</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Child Stock Now</th>
                          </tr>
                        </thead>
                        <tbody>
                          {childReport.receivedItems?.map((it: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.voucherNumber}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {new Date(it.date).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 600 }}>{it.productName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {it.productCode} • {it.packSize}
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                {it.quantityReceived?.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                PKR {it.purchaseRate?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--color-primary)',
                                }}
                              >
                                PKR {it.totalValue?.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: 'var(--color-success)',
                                }}
                              >
                                {it.currentStockInChildWarehouse?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: TRANSFER HISTORY                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'HISTORY' && (
            <div
              style={{
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Intercompany Transfer Audit History
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Comprehensive audit trail with document status and ledger impact
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadTransferHistory}
                  disabled={isLoadingHistory}
                  style={{ fontSize: '11px' }}
                >
                  <IconRefresh size={13} /> Refresh History
                </Button>
              </div>

              {isLoadingHistory ? (
                <TableSkeleton rows={4} columns={6} />
              ) : history.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No transfers recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-default)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          textAlign: 'left',
                          fontSize: '11px',
                        }}
                      >
                        <th style={{ padding: '8px 10px' }}>Invoice No</th>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Route</th>
                        <th style={{ padding: '8px 10px' }}>Items Transferred</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Value</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Shehswar Profit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.invoiceNumber}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {new Date(t.date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600 }}>
                              {t.sourceCompany} → {t.targetCompany}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t.warehouse} → {t.targetWarehouse}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {t.items?.map((i: any) => i.productName).join(', ') || `${t.itemsCount} items`}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: 'var(--color-primary)',
                            }}
                          >
                            PKR {Number(t.amount || 0).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: 'var(--color-success)',
                            }}
                          >
                            PKR {Number(t.profit || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <Badge
                              variant={
                                t.status === 'POSTED'
                                  ? 'success'
                                  : t.status === 'PENDING_APPROVAL'
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {t.status || 'POSTED'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Intercompany Transfer Posting"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
              }}
            >
              <IconBuilding size={18} color="var(--color-primary)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {activeFromCompany?.name} → {activeToCompany?.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {lineItems.length} Products | {grandTotals.totalUnits} Total Units
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  padding: '10px',
                  background: 'var(--bg-surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Total Sales Value:</div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '15px' }}>
                  PKR {grandTotals.totalSales.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ color: 'var(--color-success)', fontSize: '11px', fontWeight: 600 }}>
                  Shehswar Profit:
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '15px' }}>
                  PKR {grandTotals.totalProfit.toLocaleString()} (+{grandTotals.effectiveMarkup}%)
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'rgba(13, 148, 136, 0.08)',
                border: '1px solid rgba(13, 148, 136, 0.2)',
                fontSize: '11px',
                color: 'var(--text-primary)',
              }}
            >
              <strong>Atomic Impact:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Shehswar: Generates Sales Invoice & deducts {grandTotals.totalUnits} units from {availableParentWarehouses.find(w => w.id === sourceWarehouseId)?.name || 'source warehouse'}.</li>
                <li>{activeToCompany?.name}: Generates Purchase Voucher, automatically creates/links Finished Products & adds {grandTotals.totalUnits} units to {availableChildWarehouses.find(w => w.id === destWarehouseId)?.name || 'destination warehouse'}.</li>
                <li>Batches, cost/transfer rates, and audit logs are recorded atomically with zero duplicates.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => executeTransferAction('POSTED')}
                disabled={isSubmitting || grandTotals.hasStockError}
              >
                <IconCheck size={14} />
                {isSubmitting ? 'Posting Transfer...' : 'Confirm & Post Intercompany Transfer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
