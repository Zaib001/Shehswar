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
  const [expenseProducts, setExpenseProducts] = useState<any[]>([]);
  const [prNumberError, setPrNumberError] = useState<string>('');
  const [isCheckingPrNumber, setIsCheckingPrNumber] = useState<boolean>(false);

  // Unified allocation line items (Dealer or Expense lines)
  interface UnifiedAllocationLine {
    id: string;
    type: 'DEALER' | 'EXPENSE';
    dealerId?: string;
    partyCode?: string;
    dealerName?: string;
    expenseProductId?: string;
    expenseName?: string;
    expenseHeadId?: string;
    expenseItemId?: string;
    description: string;
    allocatedAmount: number | '';
  }
  const [unifiedAllocations, setUnifiedAllocations] = useState<UnifiedAllocationLine[]>([]);

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
    totalAmount: '',
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

  // Load auxiliary data for PR creation (Sales officers & Expense products for active company)
  const loadPrAuxiliary = async (compId: string) => {
    if (!compId || compId === 'ALL') return;
    try {
      const [officersRes, expenseRes]: [any, any] = await Promise.all([
        ApiClient.get(`/api/v1/provisional-receipts/sales-officers?companyId=${compId}`).catch(() => []),
        ApiClient.get(`/api/v1/provisional-receipts/expense-products?companyId=${compId}`).catch(() => []),
      ]);
      const officers = extractArray(officersRes);
      const expenses = extractArray(expenseRes);
      setSalesOfficers(officers);
      setExpenseProducts(expenses);
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

  // When Dealer changes, update selectedDealer and auto-fill hierarchy
  const handleDealerChange = (dealerId: string, currentDealers = officerDealers) => {
    const dlr = currentDealers.find((d) => d.id === dealerId);
    setSelectedDealer(dlr || null);
    setPrForm((prev) => ({
      ...prev,
      partyDealerId: dealerId,
      partyCode: dlr?.code || '',
    }));

    // If unifiedAllocations has an empty dealer line or is empty, auto-add this dealer
    setUnifiedAllocations((prev) => {
      if (prev.length === 0 && dlr) {
        return [
          {
            id: `line-${Date.now()}`,
            type: 'DEALER',
            dealerId: dlr.id,
            partyCode: dlr.code,
            dealerName: dlr.name,
            description: `Collection from ${dlr.businessName || dlr.name}`,
            allocatedAmount: Number(prForm.totalAmount) || '',
          },
        ];
      }
      return prev;
    });
  };

  // Add Dealer allocation line
  const handleAddDealerLine = () => {
    const defaultDealer = selectedDealer || officerDealers[0];
    const totalRec = Number(prForm.totalAmount) || 0;
    const currentAlloc = unifiedAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
    const rem = Math.max(0, totalRec - currentAlloc);

    setUnifiedAllocations((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        type: 'DEALER',
        dealerId: defaultDealer?.id || '',
        partyCode: defaultDealer?.code || '',
        dealerName: defaultDealer?.name || '',
        description: defaultDealer ? `Collection from ${defaultDealer.businessName || defaultDealer.name}` : 'Dealer Collection',
        allocatedAmount: rem > 0 ? rem : '',
      },
    ]);
  };

  // Add Expense allocation line
  const handleAddExpenseLine = () => {
    const defaultExp = expenseProducts[0];
    const totalRec = Number(prForm.totalAmount) || 0;
    const currentAlloc = unifiedAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
    const rem = Math.max(0, totalRec - currentAlloc);

    setUnifiedAllocations((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        type: 'EXPENSE',
        expenseProductId: defaultExp?.id || defaultExp?.finishedProductId,
        expenseName: defaultExp?.productName || 'Bilty / Freight Expense',
        expenseHeadId: defaultExp?.expenseHeadId,
        expenseItemId: defaultExp?.expenseItemId,
        description: defaultExp?.productName ? `${defaultExp.productName} reimbursement` : 'Field Expense',
        allocatedAmount: rem > 0 ? rem : '',
      },
    ]);
  };

  // Remove allocation line
  const handleRemoveUnifiedLine = (idx: number) => {
    setUnifiedAllocations((prev) => prev.filter((_, i) => i !== idx));
  };

  // Open Create PR Modal with company pre-loaded and auto-fetched next PR number
  const handleOpenCreateModal = () => {
    const compId = effectiveCompanyId;
    loadNextPrNumber(compId);
    loadPrAuxiliary(compId);
    setSelectedSalesOfficer(null);
    setSelectedDealer(null);
    setOfficerDealers([]);
    setUnifiedAllocations([]);
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
      totalAmount: '',
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

  // Submit Create PR (Redesigned: Saves to Ledgers & Resets Form WITHOUT Closing Modal)
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

    const totalAmt = Number(prForm.totalAmount) || 0;
    if (totalAmt <= 0) {
      notify('Please enter a valid Total Received Amount (PKR)', 'error');
      return;
    }

    // Filter valid allocations
    const validAllocs = unifiedAllocations.filter((a) => {
      const hasTarget = a.type === 'DEALER' ? !!a.dealerId : (!!a.expenseProductId || !!a.expenseName);
      return hasTarget && Number(a.allocatedAmount) > 0;
    });

    if (validAllocs.length === 0) {
      notify('Please add at least one valid allocation line (Dealer or Expense)', 'error');
      return;
    }

    const totalAllocated = validAllocs.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
    const remaining = totalAmt - totalAllocated;

    if (Math.abs(remaining) > 0.01) {
      if (remaining < 0) {
        notify(`Total allocated (PKR ${totalAllocated.toLocaleString()}) cannot exceed received amount (PKR ${totalAmt.toLocaleString()}). Please balance allocations.`, 'error');
        return;
      } else {
        notify(`Total allocated (PKR ${totalAllocated.toLocaleString()}) must equal Total Received (PKR ${totalAmt.toLocaleString()}). Remaining unallocated: PKR ${remaining.toLocaleString()}.`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await ApiClient.post('/api/v1/provisional-receipts', {
        companyId: effCompId,
        prNumber: prForm.prNumber.trim(),
        receiptDate: prForm.receiptDate,
        issueDate: prForm.issueDate || prForm.receiptDate,
        salesOfficerId: prForm.salesOfficerId,
        receivedFrom: prForm.receivedFrom || selectedSalesOfficer?.name || 'Field Officer',
        partyDealerId: selectedDealer?.id || validAllocs.find((a) => a.type === 'DEALER')?.dealerId || undefined,
        partyCode: selectedDealer?.code || validAllocs.find((a) => a.type === 'DEALER')?.partyCode || undefined,
        totalAmount: totalAmt,
        paymentMethod: prForm.paymentMethod,
        paymentReferenceNumber: prForm.paymentReferenceNumber || undefined,
        bankName: prForm.bankName || undefined,
        branchName: prForm.branchName || undefined,
        remarks: prForm.remarks || undefined,
        autoPost: true,
        allocations: validAllocs.map((a) => ({
          type: a.type,
          dealerId: a.type === 'DEALER' ? a.dealerId : undefined,
          partyCode: a.type === 'DEALER' ? a.partyCode : undefined,
          expenseProductId: a.type === 'EXPENSE' ? a.expenseProductId : undefined,
          expenseName: a.type === 'EXPENSE' ? a.expenseName : undefined,
          expenseHeadId: a.type === 'EXPENSE' ? a.expenseHeadId : undefined,
          expenseItemId: a.type === 'EXPENSE' ? a.expenseItemId : undefined,
          allocatedAmount: Number(a.allocatedAmount),
          remarks: a.description || undefined,
        })),
      });

      notify(`✓ Provisional Receipt ${prForm.prNumber.toUpperCase()} (PKR ${totalAmt.toLocaleString()}) saved and posted successfully!`, 'success');

      // RESET FORM FOR NEXT ENTRY — KEEP MODAL OPEN!
      setPrForm((prev) => ({
        ...prev,
        totalAmount: '',
        remarks: '',
        paymentReferenceNumber: '',
        bankName: '',
        branchName: '',
        // preserve salesOfficerId and date for rapid batch voucher entry
      }));
      setUnifiedAllocations([]);
      setSelectedDealer(null);

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

              <div>
                <label className="label">Total Received (PKR) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500000"
                  value={prForm.totalAmount}
                  onChange={(e) => setPrForm({ ...prForm, totalAmount: e.target.value })}
                  style={{ fontWeight: 800, fontSize: '15px', color: '#d97706' }}
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
                <label className="label">Primary Dealer / Party</label>
                <SearchableCombobox
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
              <label className="label">Remarks / Description</label>
              <Input
                placeholder="Optional PR collection remarks..."
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

          {/* Unified Allocation Table (Dealer & Expense Lines) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Allocation Breakdown (Dealer & Expense Lines)
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Distribute the received collection across assigned dealers and operating expense items.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="button" variant="secondary" size="sm" onClick={handleAddDealerLine}>
                  <IconPlus size={13} /> Add Dealer Line
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleAddExpenseLine}>
                  <IconPlus size={13} /> Add Expense Line
                </Button>
              </div>
            </div>

            {unifiedAllocations.length === 0 ? (
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
                  No allocation lines added yet
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Click <strong>Add Dealer Line</strong> or <strong>Add Expense Line</strong> above to allocate the received amount.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '110px' }}>Type</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dealer / Expense Target</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '220px' }}>Description / Remarks</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '150px' }}>Amount (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedAllocations.map((alloc, idx) => {
                      return (
                        <tr key={alloc.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: alloc.type === 'DEALER' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                                color: alloc.type === 'DEALER' ? '#10b981' : '#8b5cf6',
                              }}
                            >
                              {alloc.type === 'DEALER' ? 'Dealer' : 'Expense'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {alloc.type === 'DEALER' ? (
                              <select
                                required
                                value={alloc.dealerId || ''}
                                onChange={(e) => {
                                  const dId = e.target.value;
                                  const dlr = officerDealers.find((d) => d.id === dId);
                                  const copy = [...unifiedAllocations];
                                  if (copy[idx]) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      dealerId: dId,
                                      partyCode: dlr?.code || '',
                                      dealerName: dlr?.name || '',
                                      description: dlr ? `Collection from ${dlr.businessName || dlr.name}` : copy[idx].description,
                                    };
                                    setUnifiedAllocations(copy);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-default)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">-- Select Assigned Dealer --</option>
                                {officerDealers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.code} - {d.name} ({d.businessName || 'Shop'}) [Bal: PKR {Number(d.currentBalance || 0).toLocaleString()}]
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                required
                                value={alloc.expenseProductId || ''}
                                onChange={(e) => {
                                  const epId = e.target.value;
                                  const exp = expenseProducts.find((p) => (p.id || p.finishedProductId) === epId);
                                  const copy = [...unifiedAllocations];
                                  if (copy[idx]) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      expenseProductId: epId,
                                      expenseName: exp?.productName || 'Operational Expense',
                                      expenseHeadId: exp?.expenseHeadId,
                                      expenseItemId: exp?.expenseItemId,
                                      description: exp?.productName ? `${exp.productName} reimbursement` : copy[idx].description,
                                    };
                                    setUnifiedAllocations(copy);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-default)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">-- Select Expense / Product Head --</option>
                                {expenseProducts.map((p) => {
                                  const id = p.id || p.finishedProductId;
                                  return (
                                    <option key={id} value={id}>
                                      {p.productName} ({p.category || p.productType || 'EXPENSE'})
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Input
                              placeholder="Line remarks"
                              value={alloc.description}
                              onChange={(e) => {
                                const copy = [...unifiedAllocations];
                                if (copy[idx]) {
                                  copy[idx].description = e.target.value;
                                  setUnifiedAllocations(copy);
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Input
                              type="number"
                              required
                              value={alloc.allocatedAmount}
                              onChange={(e) => {
                                const copy = [...unifiedAllocations];
                                if (copy[idx]) {
                                  copy[idx].allocatedAmount = e.target.value === '' ? '' : Number(e.target.value);
                                  setUnifiedAllocations(copy);
                                }
                              }}
                              style={{ textAlign: 'right', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRemoveUnifiedLine(idx)}
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

            {/* Real-time Reconciliation Bar */}
            {(() => {
              const totalRec = Number(prForm.totalAmount) || 0;
              const totalAlloc = unifiedAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
              const remaining = totalRec - totalAlloc;
              const isBalanced = Math.abs(remaining) <= 0.01 && totalRec > 0;
              const isOver = remaining < -0.01;

              return (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: isBalanced
                      ? 'rgba(16, 185, 129, 0.08)'
                      : isOver
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${
                      isBalanced ? '#10b981' : isOver ? '#ef4444' : '#f59e0b'
                    }`,
                    borderRadius: '8px',
                    marginTop: '12px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Total Received</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>
                        PKR {totalRec.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Total Allocated</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
                        PKR {totalAlloc.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Remaining Balance</span>
                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: isBalanced ? '#10b981' : isOver ? '#ef4444' : '#f59e0b',
                        }}
                      >
                        PKR {remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    {isBalanced ? (
                      <span style={{ background: '#10b981', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                        ✓ Perfectly Balanced (Ready to Post)
                      </span>
                    ) : isOver ? (
                      <span style={{ background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                        ✕ Overallocated by PKR {Math.abs(remaining).toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ background: '#f59e0b', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                        ⚠ Unallocated: PKR {remaining.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
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
            Debit Cash (101000) / Bank (102000) • Credit Dealer AR (103000) for dealer splits • Credit Operating Expenses (609000) for expense lines • Credit Collection Clearing (103500) for unallocated balance.
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
                disabled={isSubmitting || !!prNumberError}
                style={{ background: '#d97706', borderColor: '#d97706', color: '#fff' }}
              >
                <IconCheck size={14} /> {isSubmitting ? 'Posting...' : 'Save & Post PR (Reset Ready)'}
              </Button>
            </div>
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
