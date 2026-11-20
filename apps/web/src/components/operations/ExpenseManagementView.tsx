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

  const [activeTab, setActiveTab] = useState<'HIERARCHY' | 'REPORTS'>('HIERARCHY');
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

  // Report State
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
      const data = res.data?.data || res.data || [];
      setHierarchyData(data);
    } catch (err: any) {
      showToast({
        title: 'Error Loading Expense Structure',
        message: err?.message || 'Failed to retrieve expense hierarchy',
        type: 'error',
      });
    } finally {
      setIsLoadingHierarchy(false);
    }
  }, [effectiveCompanyId, showToast]);

  // Fetch Report
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
    if (activeTab === 'REPORTS') {
      fetchReport();
    }
  }, [activeTab, fetchReport]);

  // Handle Preset Changes in Reports
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

  // Flat list of all heads for selectors
  const allHeads = useMemo(() => {
    const list: ExpenseHeadRecord[] = [];
    hierarchyData.forEach((group) => {
      if (Array.isArray(group.heads)) {
        list.push(...group.heads);
      }
    });
    return list;
  }, [hierarchyData]);

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

  // Printable Report Trigger
  const handlePrintReport = () => {
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
              Expense &amp; Liability Management
            </h1>
            <Badge variant="outline" style={{ fontSize: '12px', borderColor: '#0284c7', color: '#0369a1' }}>
              4-Tier Architecture
            </Badge>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
            Configure and audit Expense Heads, Sub-Categories, and Individual Expense Accounts with strict liability segregation.
          </p>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
            Active Entity: <strong>{effectiveCompanyName}</strong>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'HIERARCHY') fetchHierarchy();
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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={() => setActiveTab('HIERARCHY')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
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
          onClick={() => setActiveTab('REPORTS')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
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
          <IconFinance size={16} /> 2. Expense &amp; Liability Reports / Audit
        </button>
      </div>

      {/* =========================================================================
          TAB 1: HIERARCHY & HEAD CONFIGURATION
          ========================================================================= */}
      {activeTab === 'HIERARCHY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Information Notice on Strict Separation */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fffbeb',
              borderRadius: '8px',
              border: '1px solid #fde68a',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}>
              <strong>Strict Separation of Liabilities &amp; Expenses:</strong> In compliance with corporate finance standards,
              Liabilities (Short-Term, Long-Term, Leasing, Taxes) remain strictly isolated in their own division and never commingle
              with operating Expense Heads (Sales, General, Miscellaneous).
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
              {hierarchyData
                .filter((group) => divisionFilter === 'ALL' || group.division === divisionFilter)
                .map((group) => {
                  const divMeta = MAIN_DIVISIONS.find((d) => d.key === group.division) || MAIN_DIVISIONS[0];
                  const isExpanded = !!expandedNodes[group.division];

                  // Filter heads by search query
                  const filteredHeads = group.heads.filter((head) => {
                    if (!hierarchySearch.trim()) return true;
                    const q = hierarchySearch.toLowerCase();
                    if (head.name.toLowerCase().includes(q) || head.code.toLowerCase().includes(q)) return true;
                    if (head.subCategories.some((sc) => sc.name.toLowerCase().includes(q) || sc.code.toLowerCase().includes(q))) return true;
                    if (head.items.some((it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q))) return true;
                    return false;
                  });

                  return (
                    <Card key={group.division} style={{ border: `1px solid ${divMeta.badgeBorder}`, overflow: 'hidden' }}>
                      {/* Division Header Banner */}
                      <div
                        onClick={() => toggleNode(group.division)}
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
                              {group.isLiability && (
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

                        {/* Quick Add Head inside this division */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenNewHead(group.division)}
                            style={{
                              backgroundColor: '#ffffff',
                              borderColor: divMeta.badgeBorder,
                              color: divMeta.textColor,
                              fontSize: '12px',
                            }}
                          >
                            <IconPlus size={12} /> Add {group.isLiability ? 'Liability Head' : 'Expense Head'}
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
                              const isHeadExpanded = expandedNodes[headNodeKey] !== false; // expanded by default

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
                                        ({head.subCategories.length} sub-categories, {head.items.length} accounts/items)
                                      </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                        title="Add Sub-Category under this Head"
                                      >
                                        <IconPlus size={10} /> Sub-Category
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
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                        title="Add Individual Item / Account"
                                      >
                                        <IconPlus size={10} /> Item/Account
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
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                        }}
                                        title="Edit Expense Head"
                                      >
                                        <IconEdit size={11} /> Edit
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
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
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
          TAB 2: EXPENSE & LIABILITY REPORTS / AUDIT
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

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                  <Button size="sm" variant="outline" onClick={handlePrintReport}>
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

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <Card style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Total Cash Outflow (Period)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#14532d', marginTop: '4px' }}>
                  PKR {Number(reportData?.kpis?.totalDisbursed || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                  Across {reportData?.kpis?.voucherCount || 0} cash payment vouchers
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Sales Expenses
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  PKR {Number(reportData?.kpis?.totalSalesExpenses || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
                  Fuel, sales salaries, maintenance
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#faf5ff', border: '1px solid #d8b4fe' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
                  General / Head Office
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#581c87', marginTop: '4px' }}>
                  PKR {Number(reportData?.kpis?.totalGeneralExpenses || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '4px' }}>
                  Internet, utilities, repairs, stationery
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Liabilities Paid (Separated)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#78350f', marginTop: '4px' }}>
                  PKR {Number(reportData?.kpis?.totalLiabilities || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
                  Balance sheet payables &amp; debt
                </div>
              </CardContent>
            </Card>
          </div>

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

                              {/* Sub-categories and items */}
                              {headNode.subCategories && headNode.subCategories.length > 0 && (
                                <div style={{ marginTop: '8px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {headNode.subCategories.map((scNode: any) => (
                                    <div
                                      key={scNode.id}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '12px',
                                        color: '#334155',
                                        padding: '3px 8px',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      <span>↳ {scNode.name}</span>
                                      <span style={{ fontWeight: 600 }}>
                                        PKR {Number(scNode.totalAmount || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
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

          {/* Recent Detailed Cash Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Cash Disbursements Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReport ? (
                <TableSkeleton rows={8} />
              ) : !reportData.recentTransactions || reportData.recentTransactions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  No cash vouchers recorded in this period.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Voucher #</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Division</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Head &amp; Sub-Cat</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Item / Account</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Paid To (Party)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Amount (PKR)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Remarks</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.recentTransactions.map((tx: any) => {
                        const divMeta = MAIN_DIVISIONS.find((d) => d.key === tx.mainDivision) || MAIN_DIVISIONS[0];
                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                              {tx.voucherNumber}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>
                              {tx.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 10) : ''}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <Badge style={{ backgroundColor: divMeta.badgeBg, color: divMeta.textColor, border: `1px solid ${divMeta.badgeBorder}`, fontSize: '11px' }}>
                                {divMeta.label}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{tx.headName || tx.head || '—'}</div>
                              {tx.subCategoryName && (
                                <div style={{ fontSize: '11px', color: '#6366f1' }}>↳ {tx.subCategoryName}</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#047857' }}>
                              {tx.expenseItemName || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#1e293b' }}>
                              {tx.partyName || tx.partyId || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#14532d' }}>
                              PKR {Number(tx.amount || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.remarks || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setDrillDownDoc({
                                    isOpen: true,
                                    sourceType: 'FINANCIAL_TRANSACTION',
                                    sourceId: tx.id,
                                    voucherNumber: tx.voucherNumber,
                                  })
                                }
                                style={{ padding: '3px 8px', fontSize: '11px' }}
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
