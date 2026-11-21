'use client';

/**
 * SHEHSWAR ONE360 - Provisional Receipts (PR) & Collections View
 *
 * Implements enterprise field collection management matching Sales Orders design system:
 * - ListPageTemplate canonical structure
 * - KpiCard metrics with standard SVG icon components (zero hardcoded emojis)
 * - Complete physical paper receipt parity (PR #, Receipt Date, Received From M/s, Products, Dealer splits)
 * - Authoritative Unallocated Collection Clearing (Account 103500)
 * - Multi-Dealer Allocation & Real-Time Multi-Tier Credit Release
 * - Full Auditable Journal Reversal (`PR_REVERSAL`)
 * - StatusBadge and DataTable design standards
 * - Production Modal components with complete form controls and GL debit/credit annotations
 * - Professional PDF Generation
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ListPageTemplate } from '../templates';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardContent,
  StatusBadge,
  KpiCard,
  Modal,
  TableSkeleton,
  EmptyState,
  SearchableCombobox,
} from '../ui';
import {
  IconPlus,
  IconRefresh,
  IconDownload,
  IconSearch,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconFileText,
  IconEye,
  IconTrendingUp,
  IconFinance,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { useCompany } from '../../context/company-context';
import { ApiClient } from '../../lib/api-client';
import { exportProvisionalReceiptToPdf } from '../../lib/pdf-export';

export const ProvisionalReceiptsView: React.FC = () => {
  const { showToast } = useToast();
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    showToast({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice', message, type });
  };

  // Top header company integration
  const { activeCompany, activeCompanyId, activeCompanyName } = useCompany();

  const [prs, setPrs] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [allocStatusFilter, setAllocStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effective company isolation (Active Company from Header takes priority)
  const effectiveCompanyId = useMemo(() => {
    if (activeCompanyId && activeCompanyId !== 'ALL') return activeCompanyId;
    if (selectedCompanyId && selectedCompanyId !== 'ALL') return selectedCompanyId;
    return companies[0]?.id || '';
  }, [activeCompanyId, selectedCompanyId, companies]);

  // Modals
  const [isCreatePrOpen, setIsCreatePrOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);

  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [prDetail, setPrDetail] = useState<any | null>(null);
  const [prAudit, setPrAudit] = useState<any[]>([]);
  const [reversalReason, setReversalReason] = useState('');

  // Redesigned PR Workflow states
  const [salesOfficers, setSalesOfficers] = useState<any[]>([]);
  const [selectedSalesOfficer, setSelectedSalesOfficer] = useState<any | null>(null);
  const [officerDealers, setOfficerDealers] = useState<any[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [expenseHeads, setExpenseHeads] = useState<any[]>([]);
  const [prNumberError, setPrNumberError] = useState<string>('');
  const [isCheckingPrNumber, setIsCheckingPrNumber] = useState<boolean>(false);

  // Expense Breakdown line items
  interface PrExpenseLine {
    id: string;
    expenseHeadId: string;
    headName: string;
    subCategoryId?: string;
    subCategoryName?: string;
    expenseItemId?: string;
    itemName?: string;
    description: string;
    amount: number | '';
  }
  const [expenseLines, setExpenseLines] = useState<PrExpenseLine[]>([]);

  // Quick modals for adding Head, Sub-Category, Item inline
  const [isQuickHeadOpen, setIsQuickHeadOpen] = useState(false);
  const [quickHeadName, setQuickHeadName] = useState('');
  const [quickHeadDivision, setQuickHeadDivision] = useState<string>('SALES_EXPENSE');
  const [isSavingQuickHead, setIsSavingQuickHead] = useState(false);
  const [quickHeadRowIdx, setQuickHeadRowIdx] = useState<number | null>(null);

  const [isQuickSubCatOpen, setIsQuickSubCatOpen] = useState(false);
  const [quickSubCatHeadId, setQuickSubCatHeadId] = useState('');
  const [quickSubCatName, setQuickSubCatName] = useState('');
  const [isSavingQuickSubCat, setIsSavingQuickSubCat] = useState(false);
  const [quickSubCatRowIdx, setQuickSubCatRowIdx] = useState<number | null>(null);

  const [isQuickItemOpen, setIsQuickItemOpen] = useState(false);
  const [quickItemHeadId, setQuickItemHeadId] = useState('');
  const [quickItemSubCatId, setQuickItemSubCatId] = useState('');
  const [quickItemName, setQuickItemName] = useState('');
  const [isSavingQuickItem, setIsSavingQuickItem] = useState(false);
  const [quickItemRowIdx, setQuickItemRowIdx] = useState<number | null>(null);

  // PR Form (matches physical document & simplified workflow)
  const [prForm, setPrForm] = useState({
    companyId: '',
    prNumber: '',
    receiptDate: new Date().toISOString().split('T')[0],
    issueDate: new Date().toISOString().split('T')[0],
    receivedFrom: '',
    salesOfficerId: '',
    partyDealerId: '',
    partyCode: '',
    name: '',
    address: '',
    regionId: '',
    territoryId: '',
    paymentMethod: 'CASH',
    paymentReferenceNumber: '',
    bankName: '',
    branchName: '',
    remarks: '',
    autoPost: true,
  });

  // Dynamic Allocation Rows in Allocate Modal
  const [allocationRows, setAllocationRows] = useState<
    Array<{
      dealerId: string;
      partyCode?: string;
      dealerName?: string;
      regionId?: string;
      territoryId?: string;
      allocatedAmount: number;
      reference?: string;
      remarks?: string;
    }>
  >([]);

// Safe Array Extractor to handle nested API envelopes: { success: true, data: { total, data: [] } } or { data: [] } or []
const extractArray = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res?.data?.dealers)) return res.data.dealers;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.dealers)) return res.dealers;
  return [];
};

  // Fetch Auxiliary Master Data using ApiClient with auth headers
  const fetchAuxiliary = async (targetCompanyId?: string) => {
    try {
      const compParam = targetCompanyId && targetCompanyId !== 'ALL' ? `?companyId=${targetCompanyId}` : '';
      const [compRes, dlrRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies?all=true').catch((err) => {
          console.error('Failed to load companies:', err);
          return [];
        }),
        ApiClient.get<any>(`/api/v1/dealers${compParam}`).catch((err) => {
          console.error('Failed to load dealers:', err);
          return [];
        }),
      ]);

      const compData = extractArray(compRes);
      let dlrData = extractArray(dlrRes);

      // If company-scoped dealers returned empty, fallback to all dealers
      if (dlrData.length === 0 && compParam) {
        try {
          const allDlrs = await ApiClient.get<any>('/api/v1/dealers').catch(() => []);
          dlrData = extractArray(allDlrs);
        } catch {}
      }

      setCompanies(compData);
      setDealers(dlrData);

      setPrForm((prev) => {
        const compId = prev.companyId || (compData.length > 0 ? compData[0].id : '');
        return { ...prev, companyId: compId };
      });
    } catch (err) {
      console.error('Error loading auxiliary master data:', err);
    }
  };

  // Fetch PR Dashboard Summary
  const fetchDashboard = async () => {
    try {
      const p = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get(`/api/v1/provisional-receipts/dashboard${p}`);
      const data = res?.data || res;
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching PR dashboard:', err);
    }
  };

  // Fetch PR List
  const fetchPrs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId !== 'ALL') params.set('companyId', selectedCompanyId);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (allocStatusFilter !== 'ALL') params.set('allocationStatus', allocStatusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res: any = await ApiClient.get(`/api/v1/provisional-receipts?${params.toString()}`);
      const data = Array.isArray(res) ? res : res?.data || res?.items || [];
      setPrs(data);
    } catch (err) {
      notify('Failed to load Provisional Receipts', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== 'ALL') {
      setSelectedCompanyId(activeCompanyId);
      loadPrAuxiliary(activeCompanyId);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    fetchDashboard();
    fetchPrs();
  }, [selectedCompanyId, statusFilter, allocStatusFilter]);

  // Load next sequential PR number for active company
  const loadNextPrNumber = async (compId: string) => {
    if (!compId || compId === 'ALL') return;
    try {
      const res: any = await ApiClient.get(`/api/v1/provisional-receipts/next-number?companyId=${compId}`);
      const nextNum = res?.nextPrNumber || res?.data?.nextPrNumber || '';
      if (nextNum) {
        setPrForm((prev) => ({ ...prev, prNumber: nextNum }));
        setPrNumberError('');
      }
    } catch (err) {
      console.error('Failed to get next PR number:', err);
    }
  };

  // Validate PR number uniqueness within active company
  const validatePrNumber = async (num: string, compId: string) => {
    if (!num.trim() || !compId || compId === 'ALL') {
      setPrNumberError('');
      return;
    }
    setIsCheckingPrNumber(true);
    try {
      const res: any = await ApiClient.get(`/api/v1/provisional-receipts/check-number?companyId=${compId}&prNumber=${encodeURIComponent(num.trim())}`);
      const exists = res?.exists ?? res?.data?.exists ?? false;
      if (exists) {
        setPrNumberError('PR Number already exists. Please enter a different PR number.');
      } else {
        setPrNumberError('');
      }
    } catch (err) {
      console.error('Failed to check PR number uniqueness:', err);
    } finally {
      setIsCheckingPrNumber(false);
    }
  };

  // Load auxiliary data for PR creation (Sales officers & real Expense hierarchy for active company)
  const loadPrAuxiliary = async (compId: string) => {
    if (!compId || compId === 'ALL') return;
    try {
      const [officersRes, expenseHierarchyRes]: [any, any] = await Promise.all([
        ApiClient.get(`/api/v1/provisional-receipts/sales-officers?companyId=${compId}`).catch(() => []),
        ApiClient.get(`/api/v1/provisional-receipts/expense-hierarchy?companyId=${compId}`).catch(() => []),
      ]);
      const officers = extractArray(officersRes);
      const hierarchy = extractArray(expenseHierarchyRes);
      setSalesOfficers(officers);
      setExpenseHeads(hierarchy);
    } catch (err) {
      console.error('Failed to load PR auxiliary data:', err);
    }
  };

  // When Sales Officer changes, dynamically load only dealers assigned to that officer
  const handleOfficerChange = async (officerId: string) => {
    const officer = salesOfficers.find((o) => o.id === officerId || o.userId === officerId);
    setSelectedSalesOfficer(officer || null);
    setSelectedDealer(null);
    setPrForm((prev) => ({
      ...prev,
      salesOfficerId: officerId,
      receivedFrom: officer ? officer.name : '',
      partyDealerId: '',
      partyCode: '',
    }));

    if (!officerId) {
      setOfficerDealers([]);
      return;
    }

    const compId = effectiveCompanyId;
    try {
      const res: any = await ApiClient.get(`/api/v1/provisional-receipts/dealers-by-officer?companyId=${compId}&officerId=${officerId}`);
      const dlrs = extractArray(res);
      setOfficerDealers(dlrs);

      // If only 1 dealer is assigned, auto-select it
      if (dlrs.length === 1) {
        handleDealerChange(dlrs[0].id, dlrs);
      }
    } catch (err) {
      console.error('Failed to load dealers for officer:', err);
      setOfficerDealers([]);
    }
  };

  // When Dealer changes, only update selectedDealer and auto-fill hierarchy (NO auto-creation of allocation rows!)
  const handleDealerChange = (dealerId: string, currentDealers = officerDealers) => {
    const dlr = currentDealers.find((d) => d.id === dealerId);
    setSelectedDealer(dlr || null);
    setPrForm((prev) => ({
      ...prev,
      partyDealerId: dealerId,
      partyCode: dlr?.code || '',
      receivedFrom: dlr ? `${dlr.name} (${dlr.code})` : prev.receivedFrom,
    }));
  };

  // Add Expense line to Expense Breakdown table
  const handleAddExpenseLine = () => {
    const defaultHead = expenseHeads[0];
    const defaultSub = defaultHead?.subCategories?.[0];
    const defaultItem = defaultSub?.items?.[0] || defaultHead?.items?.[0];

    setExpenseLines((prev) => [
      ...prev,
      {
        id: `exp-${Date.now()}-${Math.random()}`,
        expenseHeadId: defaultHead?.id || '',
        headName: defaultHead?.name || '',
        subCategoryId: defaultSub?.id || '',
        subCategoryName: defaultSub?.name || '',
        expenseItemId: defaultItem?.id || '',
        itemName: defaultItem?.name || '',
        description: '',
        amount: '',
      },
    ]);
  };

  // Remove Expense line
  const handleRemoveExpenseLine = (idx: number) => {
    setExpenseLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // Dynamically calculate total amount from all expense lines
  const calculatedTotal = useMemo(() => {
    return expenseLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [expenseLines]);

  // Quick Modal: Save New Expense Head
  const handleSaveQuickHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHeadName.trim()) return;
    setIsSavingQuickHead(true);
    try {
      const res: any = await ApiClient.post('/api/v1/expense-management/heads', {
        companyId: effectiveCompanyId,
        name: quickHeadName.trim(),
        mainDivision: quickHeadDivision,
        description: '',
      });
      const created = res?.data || res;
      notify(`Expense Head "${quickHeadName}" created!`, 'success');
      await loadPrAuxiliary(effectiveCompanyId);
      if (quickHeadRowIdx !== null && expenseLines[quickHeadRowIdx]) {
        const cur = expenseLines[quickHeadRowIdx];
        if (cur) {
          const copy = [...expenseLines];
          copy[quickHeadRowIdx] = {
            ...cur,
            id: cur.id,
            expenseHeadId: created.id,
            headName: created.name,
            subCategoryId: '',
            subCategoryName: '',
            expenseItemId: '',
            itemName: '',
          };
          setExpenseLines(copy);
        }
      }
      setIsQuickHeadOpen(false);
      setQuickHeadName('');
    } catch (err: any) {
      notify(err?.message || 'Failed to create Expense Head', 'error');
    } finally {
      setIsSavingQuickHead(false);
    }
  };

  // Quick Modal: Save New Sub-Category
  const handleSaveQuickSubCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubCatName.trim() || !quickSubCatHeadId) return;
    setIsSavingQuickSubCat(true);
    try {
      const res: any = await ApiClient.post('/api/v1/expense-management/sub-categories', {
        companyId: effectiveCompanyId,
        expenseHeadId: quickSubCatHeadId,
        name: quickSubCatName.trim(),
        description: '',
      });
      const created = res?.data || res;
      notify(`Sub-Category "${quickSubCatName}" created!`, 'success');
      await loadPrAuxiliary(effectiveCompanyId);
      if (quickSubCatRowIdx !== null && expenseLines[quickSubCatRowIdx]) {
        const cur = expenseLines[quickSubCatRowIdx];
        if (cur) {
          const copy = [...expenseLines];
          copy[quickSubCatRowIdx] = {
            ...cur,
            id: cur.id,
            subCategoryId: created.id,
            subCategoryName: created.name,
            expenseItemId: '',
            itemName: '',
          };
          setExpenseLines(copy);
        }
      }
      setIsQuickSubCatOpen(false);
      setQuickSubCatName('');
    } catch (err: any) {
      notify(err?.message || 'Failed to create Sub-Category', 'error');
    } finally {
      setIsSavingQuickSubCat(false);
    }
  };

  // Quick Modal: Save New Expense Item
  const handleSaveQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItemName.trim() || !quickItemHeadId) return;
    setIsSavingQuickItem(true);
    try {
      const res: any = await ApiClient.post('/api/v1/expense-management/items', {
        companyId: effectiveCompanyId,
        expenseHeadId: quickItemHeadId,
        subCategoryId: quickItemSubCatId || undefined,
        name: quickItemName.trim(),
        description: '',
      });
      const created = res?.data || res;
      notify(`Expense Item "${quickItemName}" created!`, 'success');
      await loadPrAuxiliary(effectiveCompanyId);
      if (quickItemRowIdx !== null && expenseLines[quickItemRowIdx]) {
        const cur = expenseLines[quickItemRowIdx];
        if (cur) {
          const copy = [...expenseLines];
          copy[quickItemRowIdx] = {
            ...cur,
            id: cur.id,
            expenseItemId: created.id,
            itemName: created.name,
          };
          setExpenseLines(copy);
        }
      }
      setIsQuickItemOpen(false);
      setQuickItemName('');
    } catch (err: any) {
      notify(err?.message || 'Failed to create Expense Item', 'error');
    } finally {
      setIsSavingQuickItem(false);
    }
  };

  // Open Create PR Modal with company pre-loaded and auto-fetched next PR number
  const handleOpenCreateModal = () => {
    const compId = effectiveCompanyId;
    loadNextPrNumber(compId);
    loadPrAuxiliary(compId);
    setSelectedSalesOfficer(null);
    setSelectedDealer(null);
    setOfficerDealers([]);
    setExpenseLines([
      {
        id: `exp-${Date.now()}`,
        expenseHeadId: '',
        headName: '',
        subCategoryId: '',
        subCategoryName: '',
        expenseItemId: '',
        itemName: '',
        description: '',
        amount: '',
      },
    ]);
    setPrNumberError('');
    setPrForm({
      companyId: compId,
      prNumber: '',
      receiptDate: new Date().toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      receivedFrom: '',
      salesOfficerId: '',
      partyDealerId: '',
      partyCode: '',
      name: '',
      address: '',
      regionId: '',
      territoryId: '',
      paymentMethod: 'CASH',
      paymentReferenceNumber: '',
      bankName: '',
      branchName: '',
      remarks: '',
      autoPost: true,
    });
    setIsCreatePrOpen(true);
  };

  // Open PR Drill-down detail
  const handleOpenDetail = async (pr: any) => {
    setSelectedPr(pr);
    try {
      const [detailRes, auditRes]: [any, any] = await Promise.all([
        ApiClient.get(`/api/v1/provisional-receipts/${pr.id}`),
        ApiClient.get(`/api/v1/provisional-receipts/${pr.id}/audit`),
      ]);

      const detailData = detailRes?.data || detailRes;
      const auditData = Array.isArray(auditRes) ? auditRes : auditRes?.data || [];

      setPrDetail(detailData);
      setPrAudit(auditData);
      setIsDetailOpen(true);
    } catch (err) {
      notify('Failed to load PR details', 'error');
    }
  };

  // Open Allocate Modal
  const handleOpenAllocate = (pr: any) => {
    setSelectedPr(pr);
    setAllocationRows([
      {
        dealerId: '',
        allocatedAmount: Number(pr.unallocatedAmount || 0),
        remarks: 'Collection allocation',
      },
    ]);
    setIsAllocateOpen(true);
  };

  // Open Reverse Modal
  const handleOpenReverse = (pr: any) => {
    setSelectedPr(pr);
    setReversalReason('');
    setIsReverseOpen(true);
  };

  // Add Allocation Row for Modal 2 (Allocate unallocated PR)
  const handleAddAllocationRow = () => {
    setAllocationRows((prev) => [
      ...prev,
      {
        dealerId: '',
        allocatedAmount: 0,
        remarks: '',
      },
    ]);
  };

  // Remove Allocation Row
  const handleRemoveAllocationRow = (idx: number) => {
    setAllocationRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle Dealer Select in Allocation
  const handleDealerSelect = (idx: number, dealerId: string) => {
    const dealer = dealers.find((d) => d.id === dealerId);
    setAllocationRows((prev) => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = {
          ...copy[idx],
          dealerId,
          dealerName: dealer?.name,
          partyCode: dealer?.code,
          territoryId: dealer?.territoryId,
          regionId: dealer?.territory?.zone?.regionId,
          allocatedAmount: copy[idx]?.allocatedAmount ?? 0,
        };
      }
      return copy;
    });
  };

  // Submit Create PR (Redesigned: Calculated Total, Single Dealer Header, Dynamic Expense Breakdown)
  const handleCreatePrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effCompId = effectiveCompanyId;
    if (!effCompId) {
      notify('Active company could not be resolved. Please select a company from the top bar.', 'error');
      return;
    }

    if (!prForm.prNumber.trim()) {
      notify('Please enter a PR Number (e.g. PR-2026-0001)', 'error');
      return;
    }

    if (prNumberError) {
      notify('PR Number already exists. Please enter a different PR number.', 'error');
      return;
    }

    if (!prForm.salesOfficerId) {
      notify('Please select a Collecting / Sales Officer', 'error');
      return;
    }

    if (!prForm.partyDealerId) {
      notify('Please select a Primary Dealer / Party', 'error');
      return;
    }

    // Filter valid expense lines
    const validLines = expenseLines.filter((l) => l.expenseHeadId && Number(l.amount) > 0);
    if (validLines.length === 0) {
      notify('Please add at least one valid expense line with an amount greater than 0', 'error');
      return;
    }

    const totalAmt = validLines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    if (totalAmt <= 0) {
      notify('Total calculated PR amount must be greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ApiClient.post('/api/v1/provisional-receipts', {
        companyId: effCompId,
        prNumber: prForm.prNumber.trim(),
        receiptDate: prForm.receiptDate,
        issueDate: prForm.issueDate || prForm.receiptDate,
        salesOfficerId: prForm.salesOfficerId,
        receivedFrom: prForm.receivedFrom || selectedSalesOfficer?.name || selectedDealer?.name || 'Field Officer',
        partyDealerId: prForm.partyDealerId || selectedDealer?.id,
        partyCode: selectedDealer?.code || prForm.partyCode,
        totalAmount: totalAmt,
        paymentMethod: prForm.paymentMethod,
        paymentReferenceNumber: prForm.paymentReferenceNumber || undefined,
        bankName: prForm.bankName || undefined,
        branchName: prForm.branchName || undefined,
        remarks: prForm.remarks || undefined, // Main PR Description -> Saved in Dealer Ledger
        autoPost: true,
        allocations: validLines.map((l) => ({
          type: 'EXPENSE',
          expenseHeadId: l.expenseHeadId,
          expenseSubCategoryId: l.subCategoryId || undefined,
          expenseItemId: l.expenseItemId || undefined,
          headName: l.headName || undefined,
          subCategoryName: l.subCategoryName || undefined,
          itemName: l.itemName || undefined,
          allocatedAmount: Number(l.amount),
          remarks: l.description || undefined, // Expense Line Description -> Saved in Expense Ledger
        })),
      });

      notify(`✓ Provisional Receipt ${prForm.prNumber.toUpperCase()} (PKR ${totalAmt.toLocaleString()}) saved and posted successfully!`, 'success');

      // RESET FORM FOR NEXT ENTRY — KEEP MODAL OPEN!
      setPrForm((prev) => ({
        ...prev,
        remarks: '',
        partyDealerId: '',
        partyCode: '',
        paymentReferenceNumber: '',
        bankName: '',
        branchName: '',
        // preserve salesOfficerId and date for rapid batch voucher entry
      }));
      setSelectedDealer(null);
      setExpenseLines([
        {
          id: `exp-${Date.now()}`,
          expenseHeadId: '',
          headName: '',
          subCategoryId: '',
          subCategoryName: '',
          expenseItemId: '',
          itemName: '',
          description: '',
          amount: '',
        },
      ]);

      // Auto-fetch next sequential PR number
      await loadNextPrNumber(effCompId);

      // Refresh background PR list and dashboard
      fetchDashboard();
      fetchPrs();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to save Provisional Receipt';
      notify(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Allocate Modal
  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPr) return;

    const validAllocs = allocationRows.filter((a) => a.dealerId && Number(a.allocatedAmount) > 0);
    if (validAllocs.length === 0) {
      notify('Please select at least one dealer and amount to allocate', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ApiClient.post(`/api/v1/provisional-receipts/${selectedPr.id}/allocate`, {
        allocations: validAllocs,
      });

      notify('PR allocated to dealers! Dealer balances updated & credit released.', 'success');
      setIsAllocateOpen(false);
      fetchDashboard();
      fetchPrs();
      if (isDetailOpen && selectedPr) {
        handleOpenDetail(selectedPr);
      }
    } catch (err: any) {
      notify(err?.message || 'Error during PR allocation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reversal
  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPr) return;

    setIsSubmitting(true);
    try {
      await ApiClient.post(`/api/v1/provisional-receipts/${selectedPr.id}/reverse`, {
        reason: reversalReason,
      });

      notify(`PR ${selectedPr.prNumber} reversed! Dealer balances & GL restored.`, 'success');
      setIsReverseOpen(false);
      fetchDashboard();
      fetchPrs();
      if (isDetailOpen) {
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      notify(err?.message || 'Error reversing PR', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print PDF
  const handlePrintPdf = (pr: any) => {
    try {
      exportProvisionalReceiptToPdf(pr);
      notify(`Generating official PR PDF for ${pr.prNumber}...`, 'success');
    } catch (err) {
      notify('Error generating PDF', 'error');
    }
  };

  return (
    <ListPageTemplate
      title="Provisional Receipts (PR) & Collections"
      subtitle="Controlled field staff paper collection vouchers, Account 103500 clearing, dynamic multi-dealer allocation, and automated credit limit release"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => {
              fetchDashboard();
              fetchPrs();
            }}
          >
            <IconRefresh size={14} /> Refresh
          </Button>

          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            style={{ backgroundColor: '#f59e0b', border: 'none', color: '#fff' }}
          >
            <IconPlus size={14} /> New Provisional Receipt (PR)
          </Button>
        </div>
      }
    >
      {/* 4 Executive KPI Metrics Cards matching SalesOrdersView */}
      {dashboardData && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <KpiCard
            title="Total PR Volume"
            value={`PKR ${dashboardData.totalAmount.toLocaleString()}`}
            subtitle={`${dashboardData.totalPr} Total Issued PRs`}
            icon={<IconFinance size={20} />}
          />
          <KpiCard
            title="Fully Allocated to Dealers"
            value={`PKR ${dashboardData.allocatedAmount.toLocaleString()}`}
            subtitle={`${dashboardData.fullyAllocated} Fully Settled PRs`}
            icon={<IconTrendingUp size={20} />}
          />
          <KpiCard
            title="Unallocated in Clearing (103500)"
            value={`PKR ${dashboardData.unallocatedAmount.toLocaleString()}`}
            subtitle={`${dashboardData.pendingAllocation + dashboardData.partiallyAllocated} PRs Pending Full Allocation`}
            icon={<IconAlertTriangle size={20} />}
          />
          <KpiCard
            title="PR Status Distribution"
            value={`${dashboardData.posted} Posted`}
            subtitle={`${dashboardData.reversed} Reversed | Double-Entry Verified`}
            icon={<IconFileText size={20} />}
          />
        </div>
      )}

      {/* Filter Toolbar matching SalesOrdersView */}
      <Card style={{ marginBottom: '20px' }}>
        <CardContent style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                placeholder="Search by PR Number, Received From, Party Code, Ref #..."
                startIcon={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchPrs()}
              />
            </div>

            <div style={{ minWidth: '200px' }}>
              <Select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                options={[
                  { label: 'All Group Companies', value: 'ALL' },
                  ...(Array.isArray(companies) ? companies : []).map((c) => ({
                    label: `${c.name} (${c.code})`,
                    value: c.id,
                  })),
                ]}
              />
            </div>

            <div style={{ minWidth: '190px' }}>
              <Select
                value={allocStatusFilter}
                onChange={(e) => setAllocStatusFilter(e.target.value)}
                options={[
                  { label: 'All Allocation States', value: 'ALL' },
                  { label: 'UNALLOCATED (In Clearing)', value: 'UNALLOCATED' },
                  { label: 'PARTIALLY ALLOCATED', value: 'PARTIALLY_ALLOCATED' },
                  { label: 'FULLY ALLOCATED', value: 'FULLY_ALLOCATED' },
                ]}
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'POSTED', value: 'POSTED' },
                  { label: 'PENDING ALLOCATION', value: 'PENDING_ALLOCATION' },
                  { label: 'REVERSED', value: 'REVERSED' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PR Table Card */}
      <Card style={{ overflow: 'hidden' }}>
        <CardContent style={{ padding: 0 }}>
          {isLoading ? (
            <TableSkeleton rows={6} columns={10} />
          ) : prs.length === 0 ? (
            <EmptyState
              title="No Provisional Receipts Found"
              description="No field collection PR vouchers match your filters. Click below to issue a collection voucher."
              actionLabel="New Provisional Receipt (PR)"
              onAction={() => {
                setPrForm((prev) => ({
                  ...prev,
                  prNumber: `PR-${Math.floor(100000 + Math.random() * 900000)}`,
                }));
                setIsCreatePrOpen(true);
              }}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>PR Number</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Received From / Staff</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Company</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Region / Territory</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Payment Method</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Total (PKR)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocated (PKR)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Remaining (Clearing)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>State</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '240px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr) => (
                    <tr
                      key={pr.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onClick={() => handleOpenDetail(pr)}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace', color: '#d97706' }}>
                        {pr.prNumber}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{new Date(pr.receiptDate).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{pr.receivedFrom}</div>
                        {pr.partyCode && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Code: {pr.partyCode}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{pr.company?.name || '-'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                        <div>{pr.region?.name || '-'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{pr.territory?.name || '-'}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                          {pr.paymentMethod}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                        PKR {Number(pr.totalAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                        PKR {Number(pr.allocatedAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: Number(pr.unallocatedAmount) > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                        PKR {Number(pr.unallocatedAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <StatusBadge
                          status={pr.allocationStatus}
                          variant={
                            pr.allocationStatus === 'FULLY_ALLOCATED'
                              ? 'success'
                              : pr.allocationStatus === 'PARTIALLY_ALLOCATED'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {pr.allocationStatus}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenDetail(pr)}
                            title="View Drill-Down & Audit Timeline"
                          >
                            <IconEye size={13} /> View
                          </Button>

                          {Number(pr.unallocatedAmount) > 0 && pr.status !== 'REVERSED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAllocate(pr)}
                              style={{ backgroundColor: '#10b981', border: 'none', color: '#fff' }}
                              title="Allocate to Dealers"
                            >
                              <IconTrendingUp size={13} /> Allocate
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePrintPdf(pr)}
                            title="Export Official PDF"
                          >
                            <IconDownload size={13} /> PDF
                          </Button>

                          {pr.status !== 'REVERSED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenReverse(pr)}
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                              title="Reverse PR & Rollback Ledger"
                            >
                              <IconTrash size={13} /> Reverse
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: REDESIGNED PROVISIONAL RECEIPT (PR) WORKFLOW */}
      <Modal
        isOpen={isCreatePrOpen}
        onClose={() => setIsCreatePrOpen(false)}
        title="Issue Provisional Receipt (PR)"
        size="xl"
      >
        <form onSubmit={handleCreatePrSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Active Company Banner (Auto-Resolved from Header - Isolation Enforced) */}
          <div
            style={{
              padding: '10px 16px',
              background: 'rgba(13, 148, 136, 0.08)',
              border: '1px solid rgba(13, 148, 136, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Company Context:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d9488' }}>
                {activeCompanyName || activeCompany?.name || 'Selected Company'}
              </span>
              {activeCompany?.code && (
                <span style={{ fontSize: '11px', background: '#0d9488', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  {activeCompany.code}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Child company isolation strictly enforced • Zero redundant selector
            </span>
          </div>

          {/* Header Info Panel */}
          <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label className="label">PR Number (Unique) *</label>
                <Input
                  required
                  placeholder="e.g. PR-2026-0001"
                  value={prForm.prNumber}
                  onChange={(e) => {
                    setPrForm({ ...prForm, prNumber: e.target.value });
                    if (prNumberError) setPrNumberError('');
                  }}
                  onBlur={(e) => validatePrNumber(e.target.value, effectiveCompanyId)}
                  style={{
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    borderColor: prNumberError ? '#ef4444' : undefined,
                  }}
                />
                {prNumberError ? (
                  <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
                    {prNumberError}
                  </div>
                ) : isCheckingPrNumber ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Checking uniqueness...
                  </div>
                ) : null}
              </div>

              <div>
                <label className="label">Receipt Date *</label>
                <Input
                  type="date"
                  required
                  value={prForm.receiptDate}
                  onChange={(e) => setPrForm({ ...prForm, receiptDate: e.target.value })}
                />
              </div>

              <div>
                <label className="label">PR Issue Date</label>
                <Input
                  type="date"
                  value={prForm.issueDate}
                  onChange={(e) => setPrForm({ ...prForm, issueDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
              <div>
                <label className="label">Collecting / Sales Officer *</label>
                <SearchableCombobox
                  required
                  value={prForm.salesOfficerId}
                  onChange={handleOfficerChange}
                  placeholder="Search sales officer..."
                  options={salesOfficers.map((o) => ({
                    value: o.id,
                    label: o.name,
                    subtext: `${o.position || 'Sales Officer'}${o.dealerCount ? ` • ${o.dealerCount} Dealers` : ''}`,
                    badge: o.code,
                  }))}
                />
              </div>

              <div>
                <label className="label">Dealer / Party *</label>
                <SearchableCombobox
                  required
                  value={prForm.partyDealerId}
                  onChange={(val) => handleDealerChange(val)}
                  disabled={!prForm.salesOfficerId}
                  placeholder={
                    !prForm.salesOfficerId
                      ? 'Select Sales Officer first'
                      : officerDealers.length === 0
                      ? 'No assigned dealers found'
                      : 'Search assigned dealer...'
                  }
                  options={officerDealers.map((d) => ({
                    value: d.id,
                    label: `${d.code} - ${d.name}`,
                    subtext: `Shop: ${d.businessName || d.name} • ${d.territoryName || ''}`,
                    badge: `PKR ${Number(d.currentBalance || 0).toLocaleString()}`,
                  }))}
                />
              </div>

              <div>
                <label className="label">Payment Method</label>
                <Select
                  value={prForm.paymentMethod}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    setPrForm((prev) => ({ ...prev, paymentMethod: val }));
                  }}
                  options={[
                    { label: 'Cash Collection (CASH)', value: 'CASH' },
                    { label: 'Online / Bank Deposit', value: 'ONLINE' },
                    { label: 'Bank Cheque', value: 'CHEQUE' },
                    { label: 'Pay Order / Demand Draft', value: 'PAY_ORDER' },
                  ]}
                />
              </div>
            </div>

            {/* Bank details only when payment method is not Cash */}
            {prForm.paymentMethod !== 'CASH' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
                <div>
                  <label className="label">Cheque / Ref Number *</label>
                  <Input
                    required
                    placeholder="e.g. CHQ-991203 / Dep-Slip #12"
                    value={prForm.paymentReferenceNumber}
                    onChange={(e) => setPrForm({ ...prForm, paymentReferenceNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Bank Name</label>
                  <Input
                    placeholder="e.g. Habib Bank Limited"
                    value={prForm.bankName}
                    onChange={(e) => setPrForm({ ...prForm, bankName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Branch Name</label>
                  <Input
                    placeholder="e.g. Main Boulevard Branch"
                    value={prForm.branchName}
                    onChange={(e) => setPrForm({ ...prForm, branchName: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <label className="label">Description / Remarks (Saved in Dealer Ledger) *</label>
              <Input
                placeholder="Description of overall dealer transaction (saved in Dealer Ledger)..."
                value={prForm.remarks}
                onChange={(e) => setPrForm({ ...prForm, remarks: e.target.value })}
              />
            </div>
          </div>

          {/* Auto-Filled Market Hierarchy Card (Read-Only) */}
          {selectedDealer && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Assigned Dealer Market Hierarchy & Outstanding Balance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Party Code</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedDealer.code}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Shop / Business</span>
                  <span style={{ fontWeight: 700 }}>{selectedDealer.businessName || selectedDealer.name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Territory</span>
                  <span style={{ fontWeight: 600 }}>{selectedDealer.territoryName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Zone</span>
                  <span style={{ fontWeight: 600 }}>{selectedDealer.zoneName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Region</span>
                  <span style={{ fontWeight: 600 }}>{selectedDealer.regionName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Province</span>
                  <span style={{ fontWeight: 600 }}>{selectedDealer.provinceName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Address</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{selectedDealer.address || '—'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px' }}>Current Outstanding</span>
                  <span style={{ fontWeight: 800, color: Number(selectedDealer.currentBalance) > 0 ? '#ef4444' : '#10b981' }}>
                    PKR {Number(selectedDealer.currentBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Expense Breakdown Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Expense Breakdown
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Enter all expense lines for this Provisional Receipt. Total PR Amount is calculated automatically.
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddExpenseLine}>
                <IconPlus size={13} /> Add Expense Line
              </Button>
            </div>

            {expenseLines.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-default)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No expense lines added yet
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Click <strong>Add Expense Line</strong> above to enter expenses.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '35px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>Expense Head *</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '160px' }}>Sub-Category</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '160px' }}>Expense Item / Target</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>Description / Remarks (Expense Ledger)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>Amount (PKR) *</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '45px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseLines.map((line, idx) => {
                      const curHead = expenseHeads.find((h) => h.id === line.expenseHeadId);
                      const subCats = curHead?.subCategories || [];
                      const curSub = subCats.find((s: any) => s.id === line.subCategoryId);
                      const items = curSub?.items?.length ? curSub.items : (curHead?.items || []);

                      return (
                        <tr key={line.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <select
                                required
                                value={line.expenseHeadId}
                                onChange={(e) => {
                                  const hId = e.target.value;
                                  const head = expenseHeads.find((h) => h.id === hId);
                                  const copy = [...expenseLines];
                                  if (copy[idx]) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      expenseHeadId: hId,
                                      headName: head?.name || '',
                                      subCategoryId: '',
                                      subCategoryName: '',
                                      expenseItemId: '',
                                      itemName: '',
                                    };
                                    setExpenseLines(copy);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-default)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">-- Select Expense Head * --</option>
                                {expenseHeads.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    [{h.mainDivision}] {h.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                title="Quick Add Head"
                                onClick={() => {
                                  setQuickHeadRowIdx(idx);
                                  setIsQuickHeadOpen(true);
                                }}
                                style={{ padding: '4px 8px', fontWeight: 700 }}
                              >
                                +
                              </Button>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <select
                                value={line.subCategoryId}
                                onChange={(e) => {
                                  const scId = e.target.value;
                                  const sub = subCats.find((s: any) => s.id === scId);
                                  const copy = [...expenseLines];
                                  if (copy[idx]) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      subCategoryId: scId,
                                      subCategoryName: sub?.name || '',
                                      expenseItemId: '',
                                      itemName: '',
                                    };
                                    setExpenseLines(copy);
                                  }
                                }}
                                disabled={!line.expenseHeadId}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-default)',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">-- Optional Sub-Category --</option>
                                {subCats.map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                title="Quick Add Sub-Category"
                                disabled={!line.expenseHeadId}
                                onClick={() => {
                                  setQuickSubCatHeadId(line.expenseHeadId);
                                  setQuickSubCatRowIdx(idx);
                                  setIsQuickSubCatOpen(true);
                                }}
                                style={{ padding: '4px 8px', fontWeight: 700 }}
                              >
                                +
                              </Button>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <select
                                value={line.expenseItemId}
                                onChange={(e) => {
                                  const itId = e.target.value;
                                  const item = items.find((it: any) => it.id === itId);
                                  const copy = [...expenseLines];
                                  if (copy[idx]) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      expenseItemId: itId,
                                      itemName: item?.name || '',
                                    };
                                    setExpenseLines(copy);
                                  }
                                }}
                                disabled={!line.expenseHeadId}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-default)',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">-- Optional Item / Account --</option>
                                {items.map((it: any) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                title="Quick Add Item"
                                disabled={!line.expenseHeadId}
                                onClick={() => {
                                  setQuickItemHeadId(line.expenseHeadId);
                                  setQuickItemSubCatId(line.subCategoryId || '');
                                  setQuickItemRowIdx(idx);
                                  setIsQuickItemOpen(true);
                                }}
                                style={{ padding: '4px 8px', fontWeight: 700 }}
                              >
                                +
                              </Button>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <Input
                              placeholder="e.g. Bilty / Cartage charges"
                              value={line.description}
                              onChange={(e) => {
                                const copy = [...expenseLines];
                                if (copy[idx]) {
                                  copy[idx].description = e.target.value;
                                  setExpenseLines(copy);
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <Input
                              type="number"
                              step="0.01"
                              required
                              placeholder="0.00"
                              value={line.amount}
                              onChange={(e) => {
                                const copy = [...expenseLines];
                                if (copy[idx]) {
                                  copy[idx].amount = e.target.value === '' ? '' : Number(e.target.value);
                                  setExpenseLines(copy);
                                }
                              }}
                              style={{ textAlign: 'right', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRemoveExpenseLine(idx)}
                              style={{ color: '#ef4444', borderColor: 'transparent', padding: '4px' }}
                            >
                              <IconTrash size={14} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Calculated Total Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.12) 100%)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                borderRadius: '8px',
                marginTop: '14px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Total PR Amount (Calculated Automatically)
                </span>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706' }}>
                  PKR {calculatedTotal.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div>{expenseLines.filter((l) => Number(l.amount) > 0).length} expense item(s) entered</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  Credited to Dealer: {selectedDealer ? `${selectedDealer.name} (${selectedDealer.code})` : 'Selected Dealer'}
                </div>
              </div>
            </div>
          </div>

          {/* GL Double-Entry Notice */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(2, 132, 199, 0.05)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#0284c7' }}>Double-Entry General Ledger Impact: </strong>
            Credit Dealer AR (103000) for PKR {calculatedTotal.toLocaleString()} (Dealer collection) • Debit Operating Expenses (609000) for individual expense lines in Expense Ledger.
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              💡 Form automatically resets & increments PR number upon saving for continuous entry.
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCreatePrOpen(false)}>
                Done / Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !!prNumberError || calculatedTotal <= 0}
                style={{ background: '#d97706', borderColor: '#d97706', color: '#fff' }}
              >
                <IconCheck size={14} /> {isSubmitting ? 'Posting...' : 'Save & Post PR (Reset Ready)'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* QUICK MODAL: ADD EXPENSE HEAD */}
      <Modal
        isOpen={isQuickHeadOpen}
        onClose={() => setIsQuickHeadOpen(false)}
        title="Quick Add Expense Head"
        size="md"
      >
        <form onSubmit={handleSaveQuickHead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Main Division *</label>
            <Select
              value={quickHeadDivision}
              onChange={(valOrEvt) => {
                const val = valOrEvt?.target?.value ?? valOrEvt;
                setQuickHeadDivision(val);
              }}
              options={[
                { label: 'Sales Expenses', value: 'SALES' },
                { label: 'General / Head Office Expenses', value: 'GENERAL' },
                { label: 'Miscellaneous Expenses', value: 'MISCELLANEOUS' },
              ]}
            />
          </div>
          <div>
            <label className="label">Expense Head Name *</label>
            <Input
              required
              placeholder="e.g. Field Operation Expenses"
              value={quickHeadName}
              onChange={(e) => setQuickHeadName(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsQuickHeadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingQuickHead || !quickHeadName.trim()}>
              {isSavingQuickHead ? 'Saving...' : 'Create & Select Head'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK MODAL: ADD SUB-CATEGORY */}
      <Modal
        isOpen={isQuickSubCatOpen}
        onClose={() => setIsQuickSubCatOpen(false)}
        title="Quick Add Sub-Category"
        size="md"
      >
        <form onSubmit={handleSaveQuickSubCat} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Expense Head *</label>
            <Select
              value={quickSubCatHeadId}
              onChange={(valOrEvt) => {
                const val = valOrEvt?.target?.value ?? valOrEvt;
                setQuickSubCatHeadId(val);
              }}
              options={expenseHeads.map((h) => ({
                label: `[${h.mainDivision}] ${h.name}`,
                value: h.id,
              }))}
            />
          </div>
          <div>
            <label className="label">Sub-Category Name *</label>
            <Input
              required
              placeholder="e.g. Fuel / Travel Reimbursement"
              value={quickSubCatName}
              onChange={(e) => setQuickSubCatName(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsQuickSubCatOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingQuickSubCat || !quickSubCatName.trim()}>
              {isSavingQuickSubCat ? 'Saving...' : 'Create & Select Sub-Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK MODAL: ADD EXPENSE ITEM */}
      <Modal
        isOpen={isQuickItemOpen}
        onClose={() => setIsQuickItemOpen(false)}
        title="Quick Add Expense Item / Account"
        size="md"
      >
        <form onSubmit={handleSaveQuickItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Expense Head *</label>
            <Select
              value={quickItemHeadId}
              onChange={(valOrEvt) => {
                const val = valOrEvt?.target?.value ?? valOrEvt;
                setQuickItemHeadId(val);
                setQuickItemSubCatId('');
              }}
              options={expenseHeads.map((h) => ({
                label: `[${h.mainDivision}] ${h.name}`,
                value: h.id,
              }))}
            />
          </div>
          <div>
            <label className="label">Sub-Category (Optional)</label>
            <Select
              value={quickItemSubCatId}
              onChange={(valOrEvt) => {
                const val = valOrEvt?.target?.value ?? valOrEvt;
                setQuickItemSubCatId(val);
              }}
              options={[
                { label: '-- None (Direct Item) --', value: '' },
                ...(expenseHeads
                  .find((h) => h.id === quickItemHeadId)
                  ?.subCategories?.map((s: any) => ({
                    label: s.name,
                    value: s.id,
                  })) || []),
              ]}
            />
          </div>
          <div>
            <label className="label">Expense Item / Account Name *</label>
            <Input
              required
              placeholder="e.g. Vehicle ABC-123 or PTCL Office"
              value={quickItemName}
              onChange={(e) => setQuickItemName(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsQuickItemOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingQuickItem || !quickItemName.trim()}>
              {isSavingQuickItem ? 'Saving...' : 'Create & Select Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ALLOCATE PR TO DEALERS */}
      <Modal
        isOpen={isAllocateOpen && !!selectedPr}
        onClose={() => setIsAllocateOpen(false)}
        title={`Allocate PR: ${selectedPr?.prNumber || ''}`}
        size="lg"
      >
        <form onSubmit={handleAllocateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px 16px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Remaining Unallocated Clearing (Account 103500):</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
              PKR {Number(selectedPr?.unallocatedAmount || 0).toLocaleString()}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dealer</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: '160px' }}>Amount (PKR)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Remarks</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {allocationRows.map((alloc, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        required
                        value={alloc.dealerId || ''}
                        onChange={(e) => handleDealerSelect(idx, e.target.value)}
                        style={{
                          width: '100%',
                          minWidth: '220px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--border-default)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-surface)',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="">-- Select Dealer --</option>
                        {(Array.isArray(dealers) ? dealers : []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} - {d.name} (Bal: PKR {Number(d.currentBalance || 0).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <Input
                        type="number"
                        required
                        value={alloc.allocatedAmount}
                        onChange={(e) => {
                          const copy = [...allocationRows];
                          if (copy[idx]) {
                            copy[idx].allocatedAmount = Number(e.target.value);
                            setAllocationRows(copy);
                          }
                        }}
                        style={{ textAlign: 'right', fontWeight: 700 }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <Input
                        placeholder="Remarks"
                        value={alloc.remarks || ''}
                        onChange={(e) => {
                          const copy = [...allocationRows];
                          if (copy[idx]) {
                            copy[idx].remarks = e.target.value;
                            setAllocationRows(copy);
                          }
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRemoveAllocationRow(idx)}
                        style={{ color: '#ef4444', borderColor: 'transparent', padding: '4px' }}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddAllocationRow}>
              <IconPlus size={13} /> Add Another Dealer
            </Button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsAllocateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
              >
                <IconCheck size={14} /> {isSubmitting ? 'Posting...' : 'Post Dealer Allocation'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: REVERSE PR */}
      <Modal
        isOpen={isReverseOpen && !!selectedPr}
        onClose={() => setIsReverseOpen(false)}
        title={`Reverse PR: ${selectedPr?.prNumber || ''}`}
        size="md"
      >
        <form onSubmit={handleReverseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '14px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconAlertTriangle size={15} />
              Reversing this Provisional Receipt will:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>Reverse all dealer ledger credits and restore dealer balances.</li>
              <li>Automatically reinstate multi-tier credit exposure.</li>
              <li>Post reversing double-entry journal records to the General Ledger.</li>
              <li>Preserve permanent audit trail logs.</li>
            </ul>
          </div>

          <div>
            <label className="label">Reversal Reason *</label>
            <Textarea
              required
              rows={3}
              placeholder="Enter management reason for reversal..."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isSubmitting}
            >
              <IconTrash size={14} /> {isSubmitting ? 'Reversing...' : 'Confirm Total Reversal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: PR DRILL-DOWN DETAILS & AUDIT */}
      <Modal
        isOpen={isDetailOpen && !!prDetail}
        onClose={() => setIsDetailOpen(false)}
        title={`PR Detail: ${prDetail?.prNumber || ''}`}
        size="xl"
      >
        {prDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Bar Snapshot */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '16px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status / State</div>
                <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px' }}>
                  <StatusBadge status={prDetail.status} variant={prDetail.status === 'POSTED' ? 'success' : 'danger'}>
                    {prDetail.status}
                  </StatusBadge>{' '}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({prDetail.allocationStatus})</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Received</div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#d97706', marginTop: '2px' }}>
                  PKR {Number(prDetail.totalAmount).toLocaleString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Allocated Amount</div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#10b981', marginTop: '2px' }}>
                  PKR {Number(prDetail.allocatedAmount).toLocaleString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remaining in Clearing</div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#ef4444', marginTop: '2px' }}>
                  PKR {Number(prDetail.unallocatedAmount).toLocaleString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Payment Method</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                  {prDetail.paymentMethod} {prDetail.paymentReferenceNumber && `(${prDetail.paymentReferenceNumber})`}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bank / Branch</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                  {prDetail.bankName || '-'} {prDetail.branchName ? `(${prDetail.branchName})` : ''}
                </div>
              </div>
            </div>

            {/* Product Lines Table */}
            {prDetail.products?.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                  Product Lines (Physical PR Breakdown)
                </h3>
                <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Sr #</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Pack Size</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Policy Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prDetail.products.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px' }}>{p.srNo}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.productName}</td>
                          <td style={{ padding: '8px 12px' }}>{p.packSize}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Number(p.quantity).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>PKR {Number(p.policyRate).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                            PKR {Number(p.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dealer Allocations Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Dealer Ledger Allocations & Credit Release
                </h3>
                {Number(prDetail.unallocatedAmount) > 0 && prDetail.status !== 'REVERSED' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenAllocate(prDetail);
                    }}
                    style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
                  >
                    <IconPlus size={13} /> Allocate Remaining PKR {Number(prDetail.unallocatedAmount).toLocaleString()}
                  </Button>
                )}
              </div>

              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dealer</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Allocated Amount</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Current Balance</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Credit Limit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prDetail.allocations?.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                          No dealer allocations performed yet. Entire amount sits in Collection Clearing (103500).
                        </td>
                      </tr>
                    ) : (
                      prDetail.allocations.map((a: any) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{a.dealer?.name || a.dealerName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Code: {a.dealer?.code || a.partyCode}</div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                            PKR {Number(a.allocatedAmount).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                            PKR {Number(a.dealer?.currentBalance || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            PKR {Number(a.dealer?.creditLimit || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <StatusBadge status={a.status} variant={a.status === 'POSTED' ? 'success' : 'danger'}>
                              {a.status}
                            </StatusBadge>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {a.remarks || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                Authoritative Audit Trail
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prAudit.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ color: 'var(--brand-primary, #1e40af)' }}>{step.action}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {new Date(step.timestamp).toLocaleString()} | Actor: {step.user}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>{step.details}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <Button variant="secondary" onClick={() => handlePrintPdf(prDetail)}>
                <IconDownload size={14} /> Download PDF
              </Button>
              <Button variant="secondary" onClick={() => setIsDetailOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ListPageTemplate>
  );
};
