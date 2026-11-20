'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Modal,
  TableSkeleton,
  Badge,
} from '../ui';
import {
  IconPlus,
  IconRefresh,
  IconEye,
  IconEdit,
  IconTrash,
  IconPrinter,
  IconChevronDown,
  IconChevronRight,
  IconFilter,
  IconBuilding,
  IconFinance,
  IconCreditCard,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { useCompany } from '../../context/company-context';
import { ApiClient } from '../../lib/api-client';
import { SourceDocumentDrillDownModal } from './SourceDocumentDrillDownModal';

export interface ExpenseItemRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  expenseHeadId: string;
  subCategoryId?: string | null;
}

export interface ExpenseSubCategoryRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  expenseHeadId: string;
  items: ExpenseItemRecord[];
}

export interface ExpenseHeadRecord {
  id: string;
  code: string;
  name: string;
  mainDivision: 'SALES_EXPENSE' | 'GENERAL_EXPENSE' | 'MISCELLANEOUS_EXPENSE' | 'LIABILITY';
  description?: string | null;
  isActive: boolean;
  glAccountId?: string | null;
  subCategories: ExpenseSubCategoryRecord[];
  items: ExpenseItemRecord[];
}

export interface DivisionGroup {
  division: 'SALES_EXPENSE' | 'GENERAL_EXPENSE' | 'MISCELLANEOUS_EXPENSE' | 'LIABILITY';
  label: string;
  description: string;
  isLiability: boolean;
  heads: ExpenseHeadRecord[];
}

export interface LedgerEntry {
  id: string;
  transactionDate: string;
  voucherNumber: string;
  mainDivision: string;
  expenseHeadId?: string;
  headName: string;
  expenseSubCategoryId?: string;
  subCategoryName: string;
  expenseItemId?: string;
  expenseItemName: string;
  description: string;
  partyName?: string;
  partyType?: string;
  paymentMethod: string;
  sourceType: string;
  sourceId: string;
  referenceNumber?: string;
  accountName: string;
  contraAccountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export const MAIN_DIVISIONS = [
  {
    key: 'SALES_EXPENSE',
    label: 'Sales Expenses',
    badgeBg: '#f0fdf4',
    badgeBorder: '#86efac',
    textColor: '#166534',
    desc: 'Directly related to sales & field operations (fuel, sales salaries, vehicle maintenance, travel)',
  },
  {
    key: 'GENERAL_EXPENSE',
    label: 'General / Head Office Expenses',
    badgeBg: '#eff6ff',
    badgeBorder: '#93c5fd',
    textColor: '#1e40af',
    desc: 'General operating expenses of head office (internet, electricity, office equipment, repairs, stationery)',
  },
  {
    key: 'MISCELLANEOUS_EXPENSE',
    label: 'Miscellaneous Expenses',
    badgeBg: '#faf5ff',
    badgeBorder: '#d8b4fe',
    textColor: '#6b21a8',
    desc: 'Small operational expenses, refreshments, or unplanned cash payments',
  },
  {
    key: 'LIABILITY',
    label: 'Liabilities',
    badgeBg: '#fffbeb',
    badgeBorder: '#fcd34d',
    textColor: '#92400e',
    desc: 'Short-term, long-term, leasing, and tax liabilities — strictly segregated from operating expenses',
  },
] as const;

export interface ExpenseManagementViewProps {
  activeCompanyId?: string;
}

export const ExpenseManagementView: React.FC<ExpenseManagementViewProps> = ({ activeCompanyId: propCompanyId }) => {
  const companyCtx = useCompany();
  const effectiveCompanyId = propCompanyId || companyCtx?.activeCompanyId || '';
  const effectiveCompanyName = companyCtx?.activeCompanyName || 'Current Operating Company';
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'HIERARCHY' | 'LEDGER' | 'CASH_PR' | 'REPORTS'>('HIERARCHY');

  // Hierarchy Tab State
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState<boolean>(true);
  const [hierarchyData, setHierarchyData] = useState<DivisionGroup[]>([]);
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL');
  const [hierarchySearch, setHierarchySearch] = useState<string>('');

  // Expanded nodes state in tree view
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    SALES_EXPENSE: true,
    GENERAL_EXPENSE: true,
    MISCELLANEOUS_EXPENSE: true,
    LIABILITY: true,
  });

  // Modal states for Head
  const [isHeadModalOpen, setIsHeadModalOpen] = useState<boolean>(false);
  const [editingHead, setEditingHead] = useState<ExpenseHeadRecord | null>(null);
  const [headFormDivision, setHeadFormDivision] = useState<'SALES_EXPENSE' | 'GENERAL_EXPENSE' | 'MISCELLANEOUS_EXPENSE' | 'LIABILITY'>('GENERAL_EXPENSE');
  const [headFormName, setHeadFormName] = useState<string>('');
  const [headFormDescription, setHeadFormDescription] = useState<string>('');
  const [headFormIsActive, setHeadFormIsActive] = useState<boolean>(true);
  const [isSavingHead, setIsSavingHead] = useState<boolean>(false);

  // Modal states for Sub-Category
  const [isSubCatModalOpen, setIsSubCatModalOpen] = useState<boolean>(false);
  const [editingSubCat, setEditingSubCat] = useState<ExpenseSubCategoryRecord | null>(null);
  const [subCatParentHeadId, setSubCatParentHeadId] = useState<string>('');
  const [subCatFormName, setSubCatFormName] = useState<string>('');
  const [subCatFormDescription, setSubCatFormDescription] = useState<string>('');
  const [subCatFormIsActive, setSubCatFormIsActive] = useState<boolean>(true);
  const [isSavingSubCat, setIsSavingSubCat] = useState<boolean>(false);

  // Modal states for Expense Item
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ExpenseItemRecord | null>(null);
  const [itemParentHeadId, setItemParentHeadId] = useState<string>('');
  const [itemParentSubCatId, setItemParentSubCatId] = useState<string>('');
  const [itemFormName, setItemFormName] = useState<string>('');
  const [itemFormDescription, setItemFormDescription] = useState<string>('');
  const [itemFormIsActive, setItemFormIsActive] = useState<boolean>(true);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'HEAD' | 'SUBCAT' | 'ITEM';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // =========================================================================
  // LEDGER TAB STATE
  // =========================================================================
  const [ledgerDivision, setLedgerDivision] = useState<string>('ALL');
  const [ledgerHeadId, setLedgerHeadId] = useState<string>('ALL');
  const [ledgerSubCatId, setLedgerSubCatId] = useState<string>('ALL');
  const [ledgerItemId, setLedgerItemId] = useState<string>('ALL');
  const [ledgerPaymentMethod, setLedgerPaymentMethod] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerPeriod, setLedgerPeriod] = useState<'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [ledgerFromDate, setLedgerFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [ledgerToDate, setLedgerToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);
  const [ledgerData, setLedgerData] = useState<{
    meta: any;
    summary: { openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; transactionCount: number };
    itemBreakdown: Array<{ code?: string; name: string; amount: number; count: number }>;
    entries: LedgerEntry[];
  }>({
    meta: { ledgerTitle: 'All Expenses & Liabilities Ledger', ledgerSubtitle: '' },
    summary: { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, transactionCount: 0 },
    itemBreakdown: [],
    entries: [],
  });

  // =========================================================================
  // CASH & PR INTEGRATION STATE
  // =========================================================================
  const [isLoadingCashPr, setIsLoadingCashPr] = useState<boolean>(false);
  const [cashPrData, setCashPrData] = useState<any>({
    cashOverview: { totalCashReceived: 0, totalCashPaid: 0, netCashMovement: 0, totalPaymentsCount: 0, totalReceiptsCount: 0 },
    prOverview: { totalPrReceived: 0, totalPrAllocated: 0, totalPrUnallocated: 0, unallocatedCount: 0, recentPendingPrs: [] },
  });

  // =========================================================================
  // REPORTS TAB STATE
  // =========================================================================
  const [reportPeriod, setReportPeriod] = useState<'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [reportFromDate, setReportFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [reportToDate, setReportToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportDivision, setReportDivision] = useState<string>('ALL');
  const [reportHeadId, setReportHeadId] = useState<string>('ALL');
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>({
    kpis: {
      totalDisbursed: 0,
      totalSalesExpenses: 0,
      totalGeneralExpenses: 0,
      totalMiscExpenses: 0,
      totalLiabilities: 0,
      voucherCount: 0,
    },
    treeSummary: [],
    recentTransactions: [],
  });

  // Drilldown Modal
  const [drillDownDoc, setDrillDownDoc] = useState<{
    isOpen: boolean;
    sourceType?: string;
    sourceId?: string;
    voucherNumber?: string;
  }>({ isOpen: false });

  // Toggle node expansion
  const toggleNode = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch Hierarchy
  const fetchHierarchy = useCallback(async () => {
    setIsLoadingHierarchy(true);
    try {
      const q = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : '';
      const res = await ApiClient.get<any>(`/api/v1/expense-management/hierarchy${q}`);
      const raw = res.data?.data ?? res.data?.divisions ?? res.data ?? [];
      const list: DivisionGroup[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.divisions)
        ? raw.divisions
        : [];
      setHierarchyData(list);
    } catch (err: any) {
      showToast({
        title: 'Error Loading Expense Structure',
        message: err?.message || 'Failed to retrieve expense hierarchy',
        type: 'error',
      });
      setHierarchyData([]);
    } finally {
      setIsLoadingHierarchy(false);
    }
  }, [effectiveCompanyId, showToast]);

  // Fetch Ledger Data
  const fetchLedger = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (effectiveCompanyId) params.set('companyId', effectiveCompanyId);
      if (ledgerDivision && ledgerDivision !== 'ALL') params.set('mainDivision', ledgerDivision);
      if (ledgerHeadId && ledgerHeadId !== 'ALL') params.set('headId', ledgerHeadId);
      if (ledgerSubCatId && ledgerSubCatId !== 'ALL') params.set('subCategoryId', ledgerSubCatId);
      if (ledgerItemId && ledgerItemId !== 'ALL') params.set('itemId', ledgerItemId);
      if (ledgerPaymentMethod && ledgerPaymentMethod !== 'ALL') params.set('paymentMethod', ledgerPaymentMethod);
      if (ledgerSearch.trim()) params.set('search', ledgerSearch.trim());
      if (ledgerFromDate) params.set('fromDate', ledgerFromDate);
      if (ledgerToDate) params.set('toDate', ledgerToDate);
      params.set('period', ledgerPeriod);

      const res = await ApiClient.get<any>(`/api/v1/expense-management/ledger?${params.toString()}`);
      const data = res.data?.data || res.data || {};
      setLedgerData({
        meta: data.meta || { ledgerTitle: 'All Expenses & Liabilities Ledger' },
        summary: data.summary || { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, transactionCount: 0 },
        itemBreakdown: data.itemBreakdown || [],
        entries: data.entries || [],
      });
    } catch (err: any) {
      showToast({
        title: 'Ledger Load Failed',
        message: err?.message || 'Failed to retrieve expense ledger entries',
        type: 'error',
      });
    } finally {
      setIsLoadingLedger(false);
    }
  }, [effectiveCompanyId, ledgerDivision, ledgerHeadId, ledgerSubCatId, ledgerItemId, ledgerPaymentMethod, ledgerSearch, ledgerFromDate, ledgerToDate, ledgerPeriod, showToast]);

  // Fetch Cash & PR Integration Summary
  const fetchCashPrSummary = useCallback(async () => {
    setIsLoadingCashPr(true);
    try {
      const q = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : '';
      const res = await ApiClient.get<any>(`/api/v1/expense-management/cash-pr-summary${q}`);
      const data = res.data?.data || res.data || {};
      setCashPrData(data);
    } catch (err: any) {
      showToast({
        title: 'Cash/PR Summary Failed',
        message: err?.message || 'Could not fetch cash and PR metrics',
        type: 'error',
      });
    } finally {
      setIsLoadingCashPr(false);
    }
  }, [effectiveCompanyId, showToast]);

  // Fetch Report Data
  const fetchReport = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (effectiveCompanyId) params.set('companyId', effectiveCompanyId);
      if (reportDivision && reportDivision !== 'ALL') params.set('mainDivision', reportDivision);
      if (reportHeadId && reportHeadId !== 'ALL') params.set('headId', reportHeadId);
      if (reportFromDate) params.set('fromDate', reportFromDate);
      if (reportToDate) params.set('toDate', reportToDate);

      const res = await ApiClient.get<any>(`/api/v1/expense-management/reports?${params.toString()}`);
      const data = res.data?.data || res.data || {};
      setReportData(data);
    } catch (err: any) {
      showToast({
        title: 'Report Load Failed',
        message: err?.message || 'Failed to fetch expense reports',
        type: 'error',
      });
    } finally {
      setIsLoadingReport(false);
    }
  }, [effectiveCompanyId, reportDivision, reportHeadId, reportFromDate, reportToDate, showToast]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  useEffect(() => {
    if (activeTab === 'LEDGER') {
      fetchLedger();
    } else if (activeTab === 'CASH_PR') {
      fetchCashPrSummary();
    } else if (activeTab === 'REPORTS') {
      fetchReport();
    }
  }, [activeTab, fetchLedger, fetchCashPrSummary, fetchReport]);

  // Flat list of all heads for selectors
  const allHeads = useMemo(() => {
    const list: ExpenseHeadRecord[] = [];
    const groups = Array.isArray(hierarchyData)
      ? hierarchyData
      : Array.isArray((hierarchyData as any)?.divisions)
      ? (hierarchyData as any).divisions
      : [];
    groups.forEach((group: any) => {
      if (Array.isArray(group?.heads)) {
        list.push(...group.heads);
      }
    });
    return list;
  }, [hierarchyData]);

  // Sub-categories available for ledger filters based on selected head
  const ledgerAvailableSubCats = useMemo(() => {
    if (!ledgerHeadId || ledgerHeadId === 'ALL') return [];
    const matched = allHeads.find((h) => h.id === ledgerHeadId);
    return matched?.subCategories || [];
  }, [allHeads, ledgerHeadId]);

  // Items available for ledger filters based on selected head and subcat
  const ledgerAvailableItems = useMemo(() => {
    if (!ledgerHeadId || ledgerHeadId === 'ALL') return [];
    const matchedHead = allHeads.find((h) => h.id === ledgerHeadId);
    if (!matchedHead) return [];
    if (ledgerSubCatId && ledgerSubCatId !== 'ALL') {
      const matchedSubCat = matchedHead.subCategories.find((sc) => sc.id === ledgerSubCatId);
      return matchedSubCat?.items || [];
    }
    return matchedHead.items || [];
  }, [allHeads, ledgerHeadId, ledgerSubCatId]);

  // Handle preset date switches for Ledger
  const applyLedgerPreset = (preset: 'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM') => {
    setLedgerPeriod(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      setLedgerFromDate(todayStr);
      setLedgerToDate(todayStr);
    } else if (preset === 'MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setLedgerFromDate(first.toISOString().slice(0, 10));
      setLedgerToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setLedgerFromDate(first.toISOString().slice(0, 10));
      setLedgerToDate(last.toISOString().slice(0, 10));
    } else if (preset === 'YEAR') {
      const first = new Date(today.getFullYear(), 0, 1);
      setLedgerFromDate(first.toISOString().slice(0, 10));
      setLedgerToDate(todayStr);
    } else if (preset === 'ALL') {
      setLedgerFromDate('');
      setLedgerToDate('');
    }
  };

  // Handle preset date switches for Reports
  const applyReportPreset = (preset: 'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM') => {
    setReportPeriod(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      setReportFromDate(todayStr);
      setReportToDate(todayStr);
    } else if (preset === 'MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setReportFromDate(first.toISOString().slice(0, 10));
      setReportToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setReportFromDate(first.toISOString().slice(0, 10));
      setReportToDate(last.toISOString().slice(0, 10));
    } else if (preset === 'YEAR') {
      const first = new Date(today.getFullYear(), 0, 1);
      setReportFromDate(first.toISOString().slice(0, 10));
      setReportToDate(todayStr);
    } else if (preset === 'ALL') {
      setReportFromDate('');
      setReportToDate('');
    }
  };

  // Jump from Hierarchy tree directly to targeted ledger
  const handleOpenLedgerFor = (params: {
    division?: string;
    headId?: string;
    subCategoryId?: string;
    itemId?: string;
  }) => {
    if (params.division) setLedgerDivision(params.division);
    else setLedgerDivision('ALL');

    if (params.headId) setLedgerHeadId(params.headId);
    else setLedgerHeadId('ALL');

    if (params.subCategoryId) setLedgerSubCatId(params.subCategoryId);
    else setLedgerSubCatId('ALL');

    if (params.itemId) setLedgerItemId(params.itemId);
    else setLedgerItemId('ALL');

    setActiveTab('LEDGER');
  };

  // Head Handlers
  const handleOpenNewHead = (defaultDivision?: 'SALES_EXPENSE' | 'GENERAL_EXPENSE' | 'MISCELLANEOUS_EXPENSE' | 'LIABILITY') => {
    setEditingHead(null);
    setHeadFormDivision(defaultDivision || 'GENERAL_EXPENSE');
    setHeadFormName('');
    setHeadFormDescription('');
    setHeadFormIsActive(true);
    setIsHeadModalOpen(true);
  };

  const handleOpenEditHead = (head: ExpenseHeadRecord) => {
    setEditingHead(head);
    setHeadFormDivision(head.mainDivision);
    setHeadFormName(head.name);
    setHeadFormDescription(head.description || '');
    setHeadFormIsActive(head.isActive);
    setIsHeadModalOpen(true);
  };

  const handleSaveHead = async () => {
    if (!headFormName.trim()) {
      showToast({ title: 'Validation', message: 'Expense Head Name is required', type: 'error' });
      return;
    }
    setIsSavingHead(true);
    try {
      if (editingHead) {
        await ApiClient.patch(`/api/v1/expense-management/heads/${editingHead.id}`, {
          name: headFormName.trim(),
          description: headFormDescription.trim() || undefined,
          isActive: headFormIsActive,
        });
        showToast({ title: 'Success', message: `Expense Head "${headFormName}" updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/expense-management/heads', {
          companyId: effectiveCompanyId || undefined,
          mainDivision: headFormDivision,
          name: headFormName.trim(),
          description: headFormDescription.trim() || undefined,
        });
        showToast({ title: 'Success', message: `Expense Head "${headFormName}" created with auto code`, type: 'success' });
      }
      setIsHeadModalOpen(false);
      fetchHierarchy();
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err?.message || 'Could not save expense head', type: 'error' });
    } finally {
      setIsSavingHead(false);
    }
  };

  // Sub-Category Handlers
  const handleOpenNewSubCat = (parentHeadId?: string) => {
    setEditingSubCat(null);
    setSubCatParentHeadId(parentHeadId || allHeads[0]?.id || '');
    setSubCatFormName('');
    setSubCatFormDescription('');
    setSubCatFormIsActive(true);
    setIsSubCatModalOpen(true);
  };

  const handleOpenEditSubCat = (sc: ExpenseSubCategoryRecord) => {
    setEditingSubCat(sc);
    setSubCatParentHeadId(sc.expenseHeadId);
    setSubCatFormName(sc.name);
    setSubCatFormDescription(sc.description || '');
    setSubCatFormIsActive(sc.isActive);
    setIsSubCatModalOpen(true);
  };

  const handleSaveSubCat = async () => {
    if (!subCatParentHeadId) {
      showToast({ title: 'Validation', message: 'Parent Expense Head must be selected', type: 'error' });
      return;
    }
    if (!subCatFormName.trim()) {
      showToast({ title: 'Validation', message: 'Sub-Category Name is required', type: 'error' });
      return;
    }
    setIsSavingSubCat(true);
    try {
      if (editingSubCat) {
        await ApiClient.patch(`/api/v1/expense-management/sub-categories/${editingSubCat.id}`, {
          name: subCatFormName.trim(),
          description: subCatFormDescription.trim() || undefined,
          isActive: subCatFormIsActive,
        });
        showToast({ title: 'Success', message: `Sub-Category "${subCatFormName}" updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/expense-management/sub-categories', {
          companyId: effectiveCompanyId || undefined,
          expenseHeadId: subCatParentHeadId,
          name: subCatFormName.trim(),
          description: subCatFormDescription.trim() || undefined,
        });
        showToast({ title: 'Success', message: `Sub-Category "${subCatFormName}" added`, type: 'success' });
      }
      setIsSubCatModalOpen(false);
      fetchHierarchy();
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err?.message || 'Could not save sub-category', type: 'error' });
    } finally {
      setIsSavingSubCat(false);
    }
  };

  // Expense Item Handlers
  const handleOpenNewItem = (parentHeadId?: string, parentSubCatId?: string) => {
    setEditingItem(null);
    setItemParentHeadId(parentHeadId || allHeads[0]?.id || '');
    setItemParentSubCatId(parentSubCatId || '');
    setItemFormName('');
    setItemFormDescription('');
    setItemFormIsActive(true);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: ExpenseItemRecord) => {
    setEditingItem(item);
    setItemParentHeadId(item.expenseHeadId);
    setItemParentSubCatId(item.subCategoryId || '');
    setItemFormName(item.name);
    setItemFormDescription(item.description || '');
    setItemFormIsActive(item.isActive);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemParentHeadId) {
      showToast({ title: 'Validation', message: 'Parent Expense Head must be selected', type: 'error' });
      return;
    }
    if (!itemFormName.trim()) {
      showToast({ title: 'Validation', message: 'Expense Item Name is required (e.g. PTCL Office, StormFiber, Vehicle ABC-123)', type: 'error' });
      return;
    }
    setIsSavingItem(true);
    try {
      if (editingItem) {
        await ApiClient.patch(`/api/v1/expense-management/items/${editingItem.id}`, {
          name: itemFormName.trim(),
          subCategoryId: itemParentSubCatId || undefined,
          description: itemFormDescription.trim() || undefined,
          isActive: itemFormIsActive,
        });
        showToast({ title: 'Success', message: `Expense Item "${itemFormName}" updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/expense-management/items', {
          companyId: effectiveCompanyId || undefined,
          expenseHeadId: itemParentHeadId,
          subCategoryId: itemParentSubCatId || undefined,
          name: itemFormName.trim(),
          description: itemFormDescription.trim() || undefined,
        });
        showToast({ title: 'Success', message: `Expense Item "${itemFormName}" created`, type: 'success' });
      }
      setIsItemModalOpen(false);
      fetchHierarchy();
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err?.message || 'Could not save expense item', type: 'error' });
    } finally {
      setIsSavingItem(false);
    }
  };

  // Delete / Deactivate Confirmation Handlers
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      let endpoint = '';
      if (deleteTarget.type === 'HEAD') endpoint = `/api/v1/expense-management/heads/${deleteTarget.id}`;
      if (deleteTarget.type === 'SUBCAT') endpoint = `/api/v1/expense-management/sub-categories/${deleteTarget.id}`;
      if (deleteTarget.type === 'ITEM') endpoint = `/api/v1/expense-management/items/${deleteTarget.id}`;

      await ApiClient.delete(endpoint);
      showToast({
        title: 'Deactivated / Deleted',
        message: `${deleteTarget.name} has been processed.`,
        type: 'success',
      });
      setDeleteTarget(null);
      fetchHierarchy();
    } catch (err: any) {
      showToast({
        title: 'Action Failed',
        message: err?.message || 'Could not complete deletion',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Printable Ledger Trigger
  const handlePrint = () => {
    window.print();
  };

  // Sub-categories available for item modal based on selected parent head
  const availableSubCatsForItem = useMemo(() => {
    if (!itemParentHeadId) return [];
    const matchedHead = allHeads.find((h) => h.id === itemParentHeadId);
    return matchedHead?.subCategories || [];
  }, [allHeads, itemParentHeadId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Expense Ledger &amp; Cash Management
            </h1>
            <Badge variant="outline" style={{ fontSize: '12px', borderColor: '#0284c7', color: '#0369a1' }}>
              Ledger + Cash + PR Integration
            </Badge>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
            Unified ledger tracking for every Expense Head, Sub-Category, and Individual Account with automated Cash &amp; PR reconciliation.
          </p>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
            Operating Entity: <strong>{effectiveCompanyName}</strong> (Strict Isolation)
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'HIERARCHY') fetchHierarchy();
              else if (activeTab === 'LEDGER') fetchLedger();
              else if (activeTab === 'CASH_PR') fetchCashPrSummary();
              else fetchReport();
            }}
          >
            <IconRefresh size={14} /> Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenNewHead()}
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
          >
            <IconPlus size={14} /> + New Expense Head
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenNewSubCat()}
            style={{ borderColor: '#6366f1', color: '#4f46e5' }}
          >
            <IconPlus size={14} /> + Sub-Category
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenNewItem()}
            style={{ borderColor: '#10b981', color: '#047857' }}
          >
            <IconPlus size={14} /> + Expense Item
          </Button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('HIERARCHY')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'HIERARCHY' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'HIERARCHY' ? '#0284c7' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconBuilding size={16} /> 1. Expense Heads &amp; Hierarchy
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LEDGER')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'LEDGER' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'LEDGER' ? '#0284c7' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconFinance size={16} /> 2. Expense Ledger (Running Balances)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CASH_PR')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'CASH_PR' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'CASH_PR' ? '#0284c7' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconCreditCard size={16} /> 3. Cash Movement &amp; PR Audit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REPORTS')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'REPORTS' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'REPORTS' ? '#0284c7' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconPrinter size={16} /> 4. Executive Reports
        </button>
      </div>

      {/* =========================================================================
          TAB 1: HIERARCHY & HEAD CONFIGURATION
          ========================================================================= */}
      {activeTab === 'HIERARCHY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Information Notice on Strict Separation & 1-Click Ledgers */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '18px' }}>💡</span>
            <div style={{ fontSize: '12.5px', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>Integrated Ledger Navigation:</strong> Every Main Division, Expense Head, Sub-Category, and Item has a
              direct <strong>&quot;View Ledger&quot;</strong> button. Click it on any node below to view its running balance ledger,
              item breakdown, and source transaction drill-down.
            </div>
          </div>

          {/* Hierarchy Filter Bar */}
          <Card>
            <CardContent style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Division Filter Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setDivisionFilter('ALL')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: divisionFilter === 'ALL' ? '#0284c7' : '#e2e8f0',
                      backgroundColor: divisionFilter === 'ALL' ? '#e0f2fe' : '#ffffff',
                      color: divisionFilter === 'ALL' ? '#0369a1' : '#475569',
                    }}
                  >
                    All Divisions
                  </button>
                  {MAIN_DIVISIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDivisionFilter(d.key)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: divisionFilter === d.key ? d.textColor : '#e2e8f0',
                        backgroundColor: divisionFilter === d.key ? d.badgeBg : '#ffffff',
                        color: divisionFilter === d.key ? d.textColor : '#475569',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ minWidth: '240px' }}>
                  <Input
                    placeholder="Search Head, Sub-Category, Item..."
                    value={hierarchySearch}
                    onChange={(e) => setHierarchySearch(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hierarchy Tree Accordion */}
          {isLoadingHierarchy ? (
            <TableSkeleton rows={8} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(Array.isArray(hierarchyData) ? hierarchyData : [])
                .filter((group) => {
                  const div = group.division || (group as any).divisionKey;
                  return divisionFilter === 'ALL' || div === divisionFilter;
                })
                .map((group) => {
                  const divKey = (group.division || (group as any).divisionKey || 'GENERAL_EXPENSE') as any;
                  const divMeta = MAIN_DIVISIONS.find((d) => d.key === divKey) || MAIN_DIVISIONS[0];
                  const isExpanded = !!expandedNodes[divKey];

                  // Filter heads by search query
                  const headsList = Array.isArray(group.heads) ? group.heads : [];
                  const filteredHeads = headsList.filter((head) => {
                    if (!hierarchySearch.trim()) return true;
                    const q = hierarchySearch.toLowerCase();
                    if (head.name?.toLowerCase().includes(q) || head.code?.toLowerCase().includes(q)) return true;
                    if (head.subCategories?.some((sc: any) => sc.name?.toLowerCase().includes(q) || sc.code?.toLowerCase().includes(q))) return true;
                    if (head.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.code?.toLowerCase().includes(q))) return true;
                    return false;
                  });

                  return (
                    <Card key={divKey} style={{ border: `1px solid ${divMeta.badgeBorder}`, overflow: 'hidden' }}>
                      {/* Division Header Banner */}
                      <div
                        onClick={() => toggleNode(divKey)}
                        style={{
                          padding: '14px 20px',
                          backgroundColor: divMeta.badgeBg,
                          borderBottom: isExpanded ? `1px solid ${divMeta.badgeBorder}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: divMeta.textColor }}>
                            {isExpanded ? <IconChevronDown size={20} /> : <IconChevronRight size={20} />}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px', fontWeight: 800, color: divMeta.textColor }}>
                                {group.label}
                              </span>
                              {(group.isLiability || (group as any).type === 'LIABILITY' || divKey === 'LIABILITY') && (
                                <Badge style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                  Balance Sheet Liability
                                </Badge>
                              )}
                              <Badge variant="outline" style={{ fontSize: '11px' }}>
                                {filteredHeads.length} Heads
                              </Badge>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              {divMeta.desc}
                            </div>
                          </div>
                        </div>

                        {/* Division Actions */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLedgerFor({ division: divKey })}
                            style={{
                              backgroundColor: '#ffffff',
                              borderColor: '#cbd5e1',
                              color: '#0f172a',
                              fontSize: '11.5px',
                              fontWeight: 600,
                            }}
                          >
                            <IconFinance size={13} /> View {group.label} Ledger
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenNewHead(divKey)}
                            style={{
                              backgroundColor: '#ffffff',
                              borderColor: divMeta.badgeBorder,
                              color: divMeta.textColor,
                              fontSize: '11.5px',
                            }}
                          >
                            <IconPlus size={12} /> Add Head
                          </Button>
                        </div>
                      </div>

                      {/* Division Body (Heads list) */}
                      {isExpanded && (
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {filteredHeads.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                              No heads found under {group.label}. Click <strong>&quot;Add Head&quot;</strong> above to create one.
                            </div>
                          ) : (
                            filteredHeads.map((head) => {
                              const headNodeKey = `head_${head.id}`;
                              const isHeadExpanded = expandedNodes[headNodeKey] !== false;

                              return (
                                <div
                                  key={head.id}
                                  style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    backgroundColor: '#ffffff',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {/* Head Row */}
                                  <div
                                    style={{
                                      padding: '12px 16px',
                                      backgroundColor: '#f8fafc',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      borderBottom: isHeadExpanded && (head.subCategories.length > 0 || head.items.length > 0) ? '1px solid #e2e8f0' : 'none',
                                    }}
                                  >
                                    <div
                                      onClick={() => toggleNode(headNodeKey)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                                    >
                                      <span style={{ color: '#64748b' }}>
                                        {isHeadExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                      </span>
                                      <span
                                        style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 700,
                                          fontSize: '12px',
                                          backgroundColor: '#e2e8f0',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          color: '#334155',
                                        }}
                                      >
                                        {head.code}
                                      </span>
                                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                        {head.name}
                                      </span>
                                      {head.description && (
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                          — {head.description}
                                        </span>
                                      )}
                                      {!head.isActive && (
                                        <Badge variant="outline" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                                          Inactive
                                        </Badge>
                                      )}
                                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        ({head.subCategories.length} sub-cats, {head.items.length} accounts)
                                      </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      {/* View Head Ledger Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenLedgerFor({ division: head.mainDivision, headId: head.id })}
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '11.5px',
                                          fontWeight: 700,
                                          color: '#0369a1',
                                          backgroundColor: '#e0f2fe',
                                          border: '1px solid #bae6fd',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                        title={`View Ledger for ${head.name}`}
                                      >
                                        <IconEye size={12} /> View Ledger
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenNewSubCat(head.id)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: '#4f46e5',
                                          backgroundColor: '#eef2ff',
                                          border: '1px solid #c7d2fe',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                        }}
                                        title="Add Sub-Category under this Head"
                                      >
                                        + Sub-Cat
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenNewItem(head.id)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: '#047857',
                                          backgroundColor: '#ecfdf5',
                                          border: '1px solid #a7f3d0',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                        }}
                                        title="Add Individual Item / Account"
                                      >
                                        + Item
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditHead(head)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          color: '#334155',
                                          backgroundColor: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                        }}
                                        title="Edit Expense Head"
                                      >
                                        <IconEdit size={11} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setDeleteTarget({ type: 'HEAD', id: head.id, name: head.name })}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          color: '#dc2626',
                                          backgroundColor: '#fef2f2',
                                          border: '1px solid #fecaca',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                        }}
                                        title="Deactivate / Delete Expense Head"
                                      >
                                        <IconTrash size={11} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sub-Categories & Items nested inside Head */}
                                  {isHeadExpanded && (
                                    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {/* Sub-Categories */}
                                      {head.subCategories.map((sc) => {
                                        const scKey = `sc_${sc.id}`;
                                        const isScExpanded = expandedNodes[scKey] !== false;
                                        return (
                                          <div
                                            key={sc.id}
                                            style={{
                                              border: '1px solid #e0e7ff',
                                              borderRadius: '6px',
                                              backgroundColor: '#fafafa',
                                              marginLeft: '14px',
                                            }}
                                          >
                                            <div
                                              style={{
                                                padding: '8px 12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                borderBottom: isScExpanded && sc.items.length > 0 ? '1px solid #e0e7ff' : 'none',
                                              }}
                                            >
                                              <div
                                                onClick={() => toggleNode(scKey)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
                                              >
                                                <span style={{ color: '#818cf8' }}>
                                                  {isScExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#e0e7ff',
                                                    color: '#3730a3',
                                                    padding: '1px 5px',
                                                    borderRadius: '3px',
                                                  }}
                                                >
                                                  {sc.code}
                                                </span>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e1b4b' }}>
                                                  {sc.name}
                                                </span>
                                                {sc.description && (
                                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                                    — {sc.description}
                                                  </span>
                                                )}
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                  ({sc.items.length} items)
                                                </span>
                                              </div>

                                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                {/* View Sub-Category Ledger */}
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenLedgerFor({ division: head.mainDivision, headId: head.id, subCategoryId: sc.id })}
                                                  style={{
                                                    padding: '3px 8px',
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    color: '#4338ca',
                                                    backgroundColor: '#e0e7ff',
                                                    border: '1px solid #c7d2fe',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                  }}
                                                  title={`View Ledger for Sub-Category ${sc.name}`}
                                                >
                                                  <IconEye size={11} /> Ledger
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenNewItem(head.id, sc.id)}
                                                  style={{
                                                    padding: '3px 6px',
                                                    fontSize: '10.5px',
                                                    fontWeight: 600,
                                                    color: '#059669',
                                                    backgroundColor: '#ecfdf5',
                                                    border: '1px solid #a7f3d0',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  + Item
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenEditSubCat(sc)}
                                                  style={{
                                                    padding: '3px 6px',
                                                    fontSize: '10.5px',
                                                    color: '#475569',
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  Edit
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setDeleteTarget({ type: 'SUBCAT', id: sc.id, name: sc.name })}
                                                  style={{
                                                    padding: '3px 6px',
                                                    fontSize: '10.5px',
                                                    color: '#dc2626',
                                                    backgroundColor: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            </div>

                                            {/* Items under Sub-Category */}
                                            {isScExpanded && sc.items.length > 0 && (
                                              <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {sc.items.map((it) => (
                                                  <div
                                                    key={it.id}
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      padding: '4px 10px',
                                                      backgroundColor: '#ffffff',
                                                      border: '1px solid #d1d5db',
                                                      borderRadius: '6px',
                                                      fontSize: '12px',
                                                    }}
                                                  >
                                                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#047857', fontWeight: 700 }}>
                                                      {it.code}
                                                    </span>
                                                    <span style={{ fontWeight: 600, color: '#111827' }}>{it.name}</span>
                                                    {it.description && (
                                                      <span style={{ fontSize: '11px', color: '#6b7280' }}>({it.description})</span>
                                                    )}
                                                    {/* View Item Ledger */}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenLedgerFor({ division: head.mainDivision, headId: head.id, subCategoryId: sc.id, itemId: it.id })}
                                                      style={{
                                                        padding: '1px 5px',
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        color: '#047857',
                                                        backgroundColor: '#d1fae5',
                                                        border: '1px solid #a7f3d0',
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                      }}
                                                      title={`View Account Ledger for ${it.name}`}
                                                    >
                                                      Ledger
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenEditItem(it)}
                                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', padding: '0 2px' }}
                                                      title="Edit Item"
                                                    >
                                                      ✎
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setDeleteTarget({ type: 'ITEM', id: it.id, name: it.name })}
                                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px' }}
                                                      title="Delete Item"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}

                                      {/* Direct Items under Head (No Sub-Category) */}
                                      {head.items.filter((it) => !it.subCategoryId).length > 0 && (
                                        <div style={{ marginLeft: '14px', marginTop: '4px' }}>
                                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                                            Direct Expense Accounts / Items:
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {head.items
                                              .filter((it) => !it.subCategoryId)
                                              .map((it) => (
                                                <div
                                                  key={it.id}
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: '#f1f5f9',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                  }}
                                                >
                                                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>
                                                    {it.code}
                                                  </span>
                                                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{it.name}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenLedgerFor({ division: head.mainDivision, headId: head.id, itemId: it.id })}
                                                    style={{
                                                      padding: '1px 5px',
                                                      fontSize: '10px',
                                                      fontWeight: 700,
                                                      color: '#0369a1',
                                                      backgroundColor: '#e0f2fe',
                                                      border: '1px solid #bae6fd',
                                                      borderRadius: '3px',
                                                      cursor: 'pointer',
                                                    }}
                                                    title={`View Account Ledger for ${it.name}`}
                                                  >
                                                    Ledger
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditItem(it)}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', padding: '0 2px' }}
                                                    title="Edit Item"
                                                  >
                                                    ✎
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget({ type: 'ITEM', id: it.id, name: it.name })}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px' }}
                                                    title="Delete Item"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: EXPENSE LEDGER (RUNNING BALANCES & ITEM BREAKDOWN)
          ========================================================================= */}
      {activeTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Printable Ledger Header (visible on print only) */}
          <div className="only-on-print" style={{ display: 'none' }}>
            <h2 style={{ margin: 0 }}>{effectiveCompanyName} — {ledgerData?.meta?.ledgerTitle || 'Expense Ledger'}</h2>
            <p style={{ margin: '4px 0 12px 0', fontSize: '12px', color: '#64748b' }}>
              {ledgerData?.meta?.ledgerSubtitle} | Period: {ledgerFromDate || 'Start'} to {ledgerToDate || 'End'} | Printed: {new Date().toLocaleString()}
            </p>
          </div>

          {/* Ledger Filter Bar */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <CardTitle>{ledgerData?.meta?.ledgerTitle || 'Expense Ledger'}</CardTitle>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {ledgerData?.meta?.ledgerSubtitle || 'Complete account statement with accurate progressive running balance.'}
                  </div>
                </div>

                {/* Date Presets & Print */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(['ALL', 'TODAY', 'MONTH', 'LAST_MONTH', 'YEAR'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyLedgerPreset(preset)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: ledgerPeriod === preset ? '#0284c7' : '#e2e8f0',
                        backgroundColor: ledgerPeriod === preset ? '#e0f2fe' : '#ffffff',
                        color: ledgerPeriod === preset ? '#0369a1' : '#475569',
                      }}
                    >
                      {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'MONTH' ? 'This Month' : preset === 'LAST_MONTH' ? 'Last Month' : 'This Year'}
                    </button>
                  ))}
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <IconPrinter size={14} /> Print Ledger
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Comprehensive Filter Controls */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#f8fafc',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={ledgerFromDate}
                    onChange={(e) => {
                      setLedgerFromDate(e.target.value);
                      setLedgerPeriod('CUSTOM');
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={ledgerToDate}
                    onChange={(e) => {
                      setLedgerToDate(e.target.value);
                      setLedgerPeriod('CUSTOM');
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Main Division
                  </label>
                  <Select
                    value={ledgerDivision}
                    onChange={(e) => {
                      setLedgerDivision(e.target.value);
                      setLedgerHeadId('ALL');
                      setLedgerSubCatId('ALL');
                      setLedgerItemId('ALL');
                    }}
                    options={[
                      { value: 'ALL', label: 'All Divisions' },
                      ...MAIN_DIVISIONS.map((d) => ({ value: d.key, label: d.label })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Expense Head
                  </label>
                  <Select
                    value={ledgerHeadId}
                    onChange={(e) => {
                      setLedgerHeadId(e.target.value);
                      setLedgerSubCatId('ALL');
                      setLedgerItemId('ALL');
                    }}
                    options={[
                      { value: 'ALL', label: 'All Heads' },
                      ...allHeads
                        .filter((h) => ledgerDivision === 'ALL' || h.mainDivision === ledgerDivision)
                        .map((h) => ({ value: h.id, label: `[${h.code}] ${h.name}` })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Sub-Category
                  </label>
                  <Select
                    value={ledgerSubCatId}
                    disabled={!ledgerHeadId || ledgerHeadId === 'ALL'}
                    onChange={(e) => {
                      setLedgerSubCatId(e.target.value);
                      setLedgerItemId('ALL');
                    }}
                    options={[
                      { value: 'ALL', label: '-- All Sub-Categories --' },
                      ...ledgerAvailableSubCats.map((sc) => ({ value: sc.id, label: `[${sc.code}] ${sc.name}` })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Expense Item / Account
                  </label>
                  <Select
                    value={ledgerItemId}
                    disabled={!ledgerHeadId || ledgerHeadId === 'ALL'}
                    onChange={(e) => setLedgerItemId(e.target.value)}
                    options={[
                      { value: 'ALL', label: '-- All Accounts / Items --' },
                      ...ledgerAvailableItems.map((it) => ({ value: it.id, label: `[${it.code}] ${it.name}` })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <Select
                    value={ledgerPaymentMethod}
                    onChange={(e) => setLedgerPaymentMethod(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Methods' },
                      { value: 'CASH', label: 'Cash Only' },
                      { value: 'BANK', label: 'Bank / Cheque' },
                      { value: 'ONLINE', label: 'Online / Transfer' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Search Voucher / Party / Remarks
                  </label>
                  <Input
                    placeholder="Search keywords..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button variant="primary" onClick={fetchLedger} style={{ width: '100%', height: '38px' }}>
                    <IconFilter size={14} /> Filter Ledger
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Financial KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <Card style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Opening Balance
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                  PKR {Number(ledgerData?.summary?.openingBalance || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Cumulative prior to {ledgerFromDate || 'period start'}
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>
                  Total Debits (Expenses)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', marginTop: '4px' }}>
                  PKR {Number(ledgerData?.summary?.totalDebit || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                  Total outflow recorded in period
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Total Credits (Adjustments)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#14532d', marginTop: '4px' }}>
                  PKR {Number(ledgerData?.summary?.totalCredit || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                  Reversals, refunds &amp; credits
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Closing Running Balance
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  PKR {Number(ledgerData?.summary?.closingBalance || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
                  {ledgerData?.summary?.transactionCount || 0} transactions in statement
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requirement 10: Expense Head Summary Card (e.g. Internet -> PTCL 50k, StormFiber 75k, Nayatel 30k -> Total 155k) */}
          {ledgerData?.itemBreakdown && ledgerData.itemBreakdown.length > 0 && (
            <Card style={{ border: '1px solid #c7d2fe', backgroundColor: '#fcfdff' }}>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <CardTitle style={{ fontSize: '14px', color: '#1e1b4b' }}>
                      Account Breakdown Summary
                    </CardTitle>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Disbursements grouped by individual account/item. Click any account to isolate its individual ledger.
                    </div>
                  </div>
                  {ledgerItemId !== 'ALL' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLedgerItemId('ALL')}
                      style={{ fontSize: '11px' }}
                    >
                      Clear Account Filter (View All)
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {ledgerData.itemBreakdown.map((itm, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const matchedItm = ledgerAvailableItems.find((a) => a.name === itm.name);
                        if (matchedItm) setLedgerItemId(matchedItm.id);
                      }}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e0e7ff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0e7ff')}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#1e293b' }}>
                          {itm.name}
                        </div>
                        {itm.code && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                            {itm.code}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {itm.count} payment vouchers
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#047857' }}>
                          PKR {itm.amount.toLocaleString()}
                        </div>
                        <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 600 }}>
                          View Ledger ↳
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Running Balance Statement Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Account Ledger Statement</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingLedger ? (
                <TableSkeleton rows={10} />
              ) : !ledgerData?.entries || ledgerData.entries.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  No financial transactions found for the selected scope and date period.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Voucher / Ref #</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Expense Head</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Sub-Category</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Item / Account</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Description</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Method</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>Debit (PKR)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>Credit (PKR)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Running Balance</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      {Number(ledgerData?.summary?.openingBalance || 0) !== 0 && (
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontStyle: 'italic' }}>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>
                            {ledgerFromDate || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>
                            OPENING-BAL
                          </td>
                          <td colSpan={5} style={{ padding: '8px 12px', color: '#64748b' }}>
                            Opening cumulative balance brought forward from prior transactions
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                            PKR {Number(ledgerData.summary.openingBalance).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                        </tr>
                      )}

                      {/* Transaction Rows */}
                      {ledgerData.entries.map((r, idx) => {
                        const divMeta = MAIN_DIVISIONS.find((d) => d.key === r.mainDivision) || MAIN_DIVISIONS[0];
                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            }}
                          >
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                              {r.transactionDate ? new Date(r.transactionDate).toISOString().slice(0, 10) : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                              {r.voucherNumber}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <Badge style={{ backgroundColor: divMeta.badgeBg, color: divMeta.textColor, border: `1px solid ${divMeta.badgeBorder}`, fontSize: '11px' }}>
                                {r.headName}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#4f46e5', fontWeight: 600 }}>
                              {r.subCategoryName !== '—' ? r.subCategoryName : 'Direct'}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 600 }}>
                              {r.expenseItemName}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>
                              {r.description}
                              {r.partyName && <span style={{ color: '#0284c7', marginLeft: '4px' }}>({r.partyName})</span>}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', textTransform: 'uppercase', color: '#475569' }}>
                              {r.paymentMethod}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: r.debit > 0 ? '#b91c1c' : '#94a3b8' }}>
                              {r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: r.credit > 0 ? '#15803d' : '#94a3b8' }}>
                              {r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                              PKR {r.runningBalance.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setDrillDownDoc({
                                    isOpen: true,
                                    sourceType: r.sourceType,
                                    sourceId: r.sourceId,
                                    voucherNumber: r.voucherNumber,
                                  })
                                }
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                title="View original transaction voucher & GL entries"
                              >
                                <IconEye size={12} /> View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CASH MOVEMENT & PROVISIONAL RECEIPT (PR) AUDIT
          ========================================================================= */}
      {activeTab === 'CASH_PR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Architecture Audit Diagram Notice */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              Cash &amp; Provisional Receipt (PR) Audit Trail Architecture
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155', lineHeight: 1.6, backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div>CASH</div>
              <div>├── Cash Receipt ──&gt; Provisional Receipt (PR) ──&gt; Dealer Allocation ──&gt; Dealer Ledger</div>
              <div style={{ color: '#059669', fontWeight: 700 }}>│                                               ↳ Strict Rule: NO DOUBLE COUNTING</div>
              <div>└── Cash Payment ──&gt; Expense Head ──&gt; Sub-Category ──&gt; Expense Item ──&gt; Expense Ledger</div>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              When PR cash is collected, Cash Account (101000) increases once. When PR is allocated across dealers, the amount is distributed to Dealer Accounts Receivable without creating duplicate cash.
            </div>
          </div>

          {/* Cash & PR Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <Card style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Total Cash Receipts
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#14532d', marginTop: '4px' }}>
                  PKR {Number(cashPrData?.cashOverview?.totalCashReceived || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                  From {cashPrData?.cashOverview?.totalReceiptsCount || 0} cash receipt entries
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                  Total Cash Disbursements
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#7f1d1d', marginTop: '4px' }}>
                  PKR {Number(cashPrData?.cashOverview?.totalCashPaid || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                  Expenses &amp; liabilities payments
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Net Cash Movement
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  PKR {Number(cashPrData?.cashOverview?.netCashMovement || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
                  Cash Inflow minus Cash Outflow
                </div>
              </CardContent>
            </Card>

            {/* Requirement 5: Clearly Identify Provisional / Unallocated Cash */}
            <Card style={{ backgroundColor: '#fffbeb', border: '2px solid #f59e0b' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                    Provisional / Unallocated Cash
                  </div>
                  <Badge style={{ backgroundColor: '#fde68a', color: '#78350f', fontSize: '10px' }}>
                    PR Pending
                  </Badge>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#78350f', marginTop: '4px' }}>
                  PKR {Number(cashPrData?.prOverview?.totalPrUnallocated || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
                  {cashPrData?.prOverview?.unallocatedCount || 0} PRs waiting for dealer allocation
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Provisional Receipts Table */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <CardTitle>Provisional Receipts (PR) Cash Tracking</CardTitle>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Trace received PR cash and verify remaining unallocated balance.
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={fetchCashPrSummary}>
                  <IconRefresh size={14} /> Refresh PRs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCashPr ? (
                <TableSkeleton rows={6} />
              ) : !cashPrData?.prOverview?.recentPendingPrs || cashPrData.prOverview.recentPendingPrs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  All collection receipts are fully allocated across dealers! Zero unallocated cash remaining.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>PR Number</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Receipt Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Received From</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Method</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Total Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>Allocated to Dealers</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>Unallocated Cash</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashPrData.prOverview.recentPendingPrs.map((pr: any) => (
                        <tr key={pr.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {pr.prNumber}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            {pr.receiptDate ? new Date(pr.receiptDate).toISOString().slice(0, 10) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                            {pr.receivedFrom}
                          </td>
                          <td style={{ padding: '10px 12px', textTransform: 'uppercase', color: '#64748b' }}>
                            {pr.paymentMethod}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            PKR {Number(pr.totalAmount).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            PKR {Number(pr.allocatedAmount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#b45309', backgroundColor: '#fffbeb' }}>
                            PKR {Number(pr.unallocatedAmount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <Badge
                              variant={pr.allocationStatus === 'FULLY_ALLOCATED' ? 'success' : pr.allocationStatus === 'PARTIALLY_ALLOCATED' ? 'warning' : 'default'}
                            >
                              {pr.allocationStatus}
                            </Badge>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDrillDownDoc({
                                  isOpen: true,
                                  sourceType: 'PROVISIONAL_RECEIPT',
                                  sourceId: pr.id,
                                  voucherNumber: pr.prNumber,
                                })
                              }
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              <IconEye size={12} /> View PR
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 4: EXECUTIVE REPORTS
          ========================================================================= */}
      {activeTab === 'REPORTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Printable Report Header (visible only on print) */}
          <div className="only-on-print" style={{ display: 'none' }}>
            <h2 style={{ margin: 0 }}>{effectiveCompanyName} — Expense &amp; Liability Management Report</h2>
            <p style={{ margin: '4px 0 12px 0', fontSize: '12px', color: '#64748b' }}>
              Period: {reportFromDate || 'Start'} to {reportToDate || 'End'} | Generated: {new Date().toLocaleString()}
            </p>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <CardTitle>Period &amp; Division Filters</CardTitle>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Audit expense disbursements across Head Office, Sales, Misc, and Liabilities.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(['ALL', 'TODAY', 'MONTH', 'LAST_MONTH', 'YEAR'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyReportPreset(preset)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: reportPeriod === preset ? '#0284c7' : '#e2e8f0',
                        backgroundColor: reportPeriod === preset ? '#e0f2fe' : '#ffffff',
                        color: reportPeriod === preset ? '#0369a1' : '#475569',
                      }}
                    >
                      {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'MONTH' ? 'This Month' : preset === 'LAST_MONTH' ? 'Last Month' : 'This Year'}
                    </button>
                  ))}
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <IconPrinter size={14} /> Print / Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={reportFromDate}
                    onChange={(e) => {
                      setReportFromDate(e.target.value);
                      setReportPeriod('CUSTOM');
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={reportToDate}
                    onChange={(e) => {
                      setReportToDate(e.target.value);
                      setReportPeriod('CUSTOM');
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Main Division
                  </label>
                  <Select
                    value={reportDivision}
                    onChange={(e) => setReportDivision(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Divisions' },
                      ...MAIN_DIVISIONS.map((d) => ({ value: d.key, label: d.label })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Expense Head
                  </label>
                  <Select
                    value={reportHeadId}
                    onChange={(e) => setReportHeadId(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Heads' },
                      ...allHeads
                        .filter((h) => reportDivision === 'ALL' || h.mainDivision === reportDivision)
                        .map((h) => ({ value: h.id, label: `${h.code} — ${h.name}` })),
                    ]}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button variant="primary" onClick={fetchReport} style={{ width: '100%', height: '38px' }}>
                    <IconFilter size={14} /> Apply Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drill-Down Summary Tree by Division & Head */}
          <Card>
            <CardHeader>
              <CardTitle>Expenditure Hierarchy Drill-Down</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReport ? (
                <TableSkeleton rows={6} />
              ) : !reportData.treeSummary || reportData.treeSummary.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No expenditures recorded for the selected criteria and period.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {reportData.treeSummary.map((divNode: any) => {
                    const divMeta = MAIN_DIVISIONS.find((d) => d.key === divNode.division) || MAIN_DIVISIONS[0];
                    return (
                      <div
                        key={divNode.division}
                        style={{
                          border: `1px solid ${divMeta.badgeBorder}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Division Header */}
                        <div
                          style={{
                            padding: '10px 16px',
                            backgroundColor: divMeta.badgeBg,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: divMeta.textColor, fontSize: '14px' }}>
                            {divNode.label}
                          </div>
                          <div style={{ fontWeight: 800, color: divMeta.textColor, fontSize: '15px' }}>
                            Total: PKR {Number(divNode.totalAmount || 0).toLocaleString()}
                          </div>
                        </div>

                        {/* Heads */}
                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {divNode.heads.map((headNode: any) => (
                            <div
                              key={headNode.id}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                                  <span style={{ fontFamily: 'monospace', color: '#64748b', marginRight: '6px' }}>
                                    {headNode.code}
                                  </span>
                                  {headNode.name}
                                </div>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                                  PKR {Number(headNode.totalAmount || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODALS: HEAD, SUB-CATEGORY, ITEM & DELETE
          ========================================================================= */}

      {/* 1. Create / Edit Expense Head Modal */}
      <Modal
        isOpen={isHeadModalOpen}
        onClose={() => setIsHeadModalOpen(false)}
        title={editingHead ? `Edit Head: ${editingHead.name}` : 'Create New Expense Head'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Main Division *
            </label>
            <Select
              value={headFormDivision}
              onChange={(e) => setHeadFormDivision(e.target.value as any)}
              disabled={!!editingHead}
              options={MAIN_DIVISIONS.map((d) => ({
                value: d.key,
                label: `${d.label} ${d.key === 'LIABILITY' ? '(Segregated Liability)' : '(Operating Expense)'}`,
              }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Head Name * (e.g. Internet, Fuel, Maintenance, Building Expense)
            </label>
            <Input
              value={headFormName}
              onChange={(e) => setHeadFormName(e.target.value)}
              placeholder="e.g. Internet, Staff Salaries, Vehicle Maintenance..."
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Description / Notes (Optional)
            </label>
            <Input
              value={headFormDescription}
              onChange={(e) => setHeadFormDescription(e.target.value)}
              placeholder="Operational scope or guidelines..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setIsHeadModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveHead} disabled={isSavingHead}>
              {isSavingHead ? 'Saving...' : editingHead ? 'Update Head' : 'Create Head (Auto Code)'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Create / Edit Sub-Category Modal */}
      <Modal
        isOpen={isSubCatModalOpen}
        onClose={() => setIsSubCatModalOpen(false)}
        title={editingSubCat ? `Edit Sub-Category: ${editingSubCat.name}` : 'Create Sub-Category'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Parent Expense Head *
            </label>
            <Select
              value={subCatParentHeadId}
              onChange={(e) => setSubCatParentHeadId(e.target.value)}
              disabled={!!editingSubCat}
              options={allHeads.map((h) => ({
                value: h.id,
                label: `[${h.code}] ${h.name} (${h.mainDivision})`,
              }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Sub-Category Name * (e.g. Laptop, Building Maintenance, Factory Machine Repair)
            </label>
            <Input
              value={subCatFormName}
              onChange={(e) => setSubCatFormName(e.target.value)}
              placeholder="e.g. Laptop, Building Maintenance, Office Staff..."
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Description (Optional)
            </label>
            <Input
              value={subCatFormDescription}
              onChange={(e) => setSubCatFormDescription(e.target.value)}
              placeholder="Additional details..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setIsSubCatModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveSubCat} disabled={isSavingSubCat}>
              {isSavingSubCat ? 'Saving...' : editingSubCat ? 'Update Sub-Category' : 'Create Sub-Category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Create / Edit Expense Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? `Edit Item: ${editingItem.name}` : 'Create Individual Expense Item / Account'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Parent Expense Head *
            </label>
            <Select
              value={itemParentHeadId}
              onChange={(e) => {
                setItemParentHeadId(e.target.value);
                setItemParentSubCatId('');
              }}
              disabled={!!editingItem}
              options={allHeads.map((h) => ({
                value: h.id,
                label: `[${h.code}] ${h.name} (${h.mainDivision})`,
              }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Sub-Category (Optional)
            </label>
            <Select
              value={itemParentSubCatId}
              onChange={(e) => setItemParentSubCatId(e.target.value)}
              options={[
                { value: '', label: '-- None (Direct under Head) --' },
                ...availableSubCatsForItem.map((sc) => ({
                  value: sc.id,
                  label: `[${sc.code}] ${sc.name}`,
                })),
              ]}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Item / Account Name * (e.g. PTCL Head Office, StormFiber, Vehicle ABC-123, Laptop Dell #4)
            </label>
            <Input
              value={itemFormName}
              onChange={(e) => setItemFormName(e.target.value)}
              placeholder="e.g. PTCL Head Office, StormFiber, Nayatel..."
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Description (Optional)
            </label>
            <Input
              value={itemFormDescription}
              onChange={(e) => setItemFormDescription(e.target.value)}
              placeholder="Account #, line ID, or location..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveItem} disabled={isSavingItem}>
              {isSavingItem ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Delete / Deactivate Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Removal / Deactivation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '14px', color: '#1e293b', margin: 0 }}>
            Are you sure you want to deactivate or remove <strong>&quot;{deleteTarget?.name}&quot;</strong>?
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            If financial transactions or cash vouchers are already attached to this entry, it will be safely deactivated
            to maintain GL integrity and historical audit compliance.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Processing...' : 'Confirm Deactivation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Drill-Down Source Document Modal */}
      {drillDownDoc.isOpen && (
        <SourceDocumentDrillDownModal
          isOpen={drillDownDoc.isOpen}
          onClose={() => setDrillDownDoc({ isOpen: false })}
          sourceType={drillDownDoc.sourceType}
          sourceId={drillDownDoc.sourceId}
          voucherNumber={drillDownDoc.voucherNumber}
        />
      )}
    </div>
  );
};
