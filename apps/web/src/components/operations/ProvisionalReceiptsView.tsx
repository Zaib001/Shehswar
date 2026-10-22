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
import { ApiClient } from '../../lib/api-client';
import { exportProvisionalReceiptToPdf } from '../../lib/pdf-export';

export const ProvisionalReceiptsView: React.FC = () => {
  const { showToast } = useToast();
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    showToast({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice', message, type });
  };

  const [prs, setPrs] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [productsMaster, setProductsMaster] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [usersMaster, setUsersMaster] = useState<any[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [allocStatusFilter, setAllocStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [isCreatePrOpen, setIsCreatePrOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);

  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [prDetail, setPrDetail] = useState<any | null>(null);
  const [prAudit, setPrAudit] = useState<any[]>([]);
  const [reversalReason, setReversalReason] = useState('');

  // PR Form (matches physical document)
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
    paymentMethod: 'ONLINE',
    paymentReferenceNumber: '',
    bankName: '',
    branchName: '',
    totalAmount: '',
    remarks: '',
    autoPost: true,
  });

  // Dynamic Product Rows in Create PR
  const [productRows, setProductRows] = useState<
    Array<{
      finishedProductId?: string;
      productName: string;
      packSize: string;
      quantity: number;
      policyRate: number;
    }>
  >([]);

  // Dynamic Allocation Rows in Create PR or Allocate Modal
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
      const [compRes, dlrRes, prodRes, regRes, terrRes, usersRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies?all=true').catch((err) => {
          console.error('Failed to load companies:', err);
          return [];
        }),
        ApiClient.get<any>(`/api/v1/dealers${compParam}`).catch((err) => {
          console.error('Failed to load dealers:', err);
          return [];
        }),
        ApiClient.get<any>('/api/v1/master-data/finished-products').catch(async () => {
          return ApiClient.get<any>('/api/v1/pricing/active-products').catch(() => []);
        }),
        ApiClient.get<any>(`/api/v1/master-data/regions${compParam}`).catch((err) => {
          console.error('Failed to load regions:', err);
          return [];
        }),
        ApiClient.get<any>(`/api/v1/master-data/territories${compParam}`).catch((err) => {
          console.error('Failed to load territories:', err);
          return [];
        }),
        ApiClient.get<any>('/api/v1/master-data/users').catch(() => []),
      ]);

      const compData = extractArray(compRes);
      let dlrData = extractArray(dlrRes);
      let prodData = extractArray(prodRes);
      const regData = extractArray(regRes);
      const terrData = extractArray(terrRes);
      const usrData = extractArray(usersRes);

      // If company-scoped dealers returned empty, fallback to all dealers
      if (dlrData.length === 0 && compParam) {
        try {
          const allDlrs = await ApiClient.get<any>('/api/v1/dealers').catch(() => []);
          dlrData = extractArray(allDlrs);
        } catch {}
      }

      setCompanies(compData);
      setDealers(dlrData);
      setProductsMaster(prodData);
      setRegions(regData);
      setTerritories(terrData);
      setUsersMaster(usrData);

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
    fetchDashboard();
    fetchPrs();
  }, [selectedCompanyId, statusFilter, allocStatusFilter]);

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

  // Calculate Product Total in Form
  const calculatedProductTotal = useMemo(() => {
    return productRows.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.policyRate || 0)), 0);
  }, [productRows]);

  // Auto-update total amount in form when products change
  useEffect(() => {
    if (productRows.length > 0) {
      setPrForm((prev) => ({ ...prev, totalAmount: String(calculatedProductTotal) }));
    }
  }, [calculatedProductTotal]);

  // Add Product Row
  const handleAddProductRow = () => {
    const defaultProd = (Array.isArray(productsMaster) ? productsMaster : [])[0];
    setProductRows((prev) => [
      ...prev,
      {
        finishedProductId: defaultProd?.finishedProductId || defaultProd?.id || undefined,
        productName: defaultProd?.productName || 'Fertilizer Product',
        packSize: defaultProd?.packSizeName || defaultProd?.packSize?.name || '50 KG Bag',
        quantity: 50,
        policyRate: Number(defaultProd?.baseRate || defaultProd?.defaultSellingPrice || 1200),
      },
    ]);
  };

  // Remove Product Row
  const handleRemoveProductRow = (idx: number) => {
    setProductRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add Allocation Row
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

  // Auto-fetch Officer -> Dealer, Region, Territory when user/officer is chosen
  const handleHeaderOfficerSelect = (val: string) => {
    if (!val) {
      setPrForm((prev) => ({
        ...prev,
        salesOfficerId: '',
      }));
      return;
    }

    const u = (usersMaster || []).find((x) => x.id === val);
    const officerName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';

    // Check user's market assignment (Region & Territory)
    const ma = (u?.marketAssignments || [])[0];
    let autoRegionId = ma?.regionId || ma?.region?.id || '';
    let autoTerritoryId = ma?.territoryId || ma?.territory?.id || '';
    const autoCompanyId = u?.companyId || prForm.companyId;

    // Check dealers assigned to this sales officer
    const dlrs = Array.isArray(dealers) ? dealers : [];
    const officerDealers = dlrs.filter(
      (d: any) =>
        d.assignedFieldOfficerId === val ||
        d.officerAssignments?.some((oa: any) => oa.userId === val || oa.user?.id === val)
    );

    let assignedPartyDealerId = '';
    let assignedPartyCode = '';
    let assignedReceivedFrom = officerName ? `${officerName} (Sales Officer)` : '';

    if (officerDealers.length > 0) {
      const primaryDealer = officerDealers[0];
      assignedPartyDealerId = primaryDealer.id;
      assignedPartyCode = primaryDealer.code || '';
      assignedReceivedFrom = `${primaryDealer.name} (${primaryDealer.code})`;

      if (primaryDealer.territoryId) {
        autoTerritoryId = primaryDealer.territoryId;
      }
      if (primaryDealer.territory?.zone?.regionId) {
        autoRegionId = primaryDealer.territory.zone.regionId;
      }
    } else if (autoTerritoryId) {
      const terrDealer = dlrs.find((d: any) => d.territoryId === autoTerritoryId);
      if (terrDealer) {
        assignedPartyDealerId = terrDealer.id;
        assignedPartyCode = terrDealer.code || '';
        assignedReceivedFrom = `${terrDealer.name} (${terrDealer.code})`;
      }
    }

    // Auto-generate clean PR number if empty
    const autoPrNum = prForm.prNumber?.trim()
      ? prForm.prNumber
      : `PR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    setPrForm((prev) => ({
      ...prev,
      companyId: autoCompanyId || prev.companyId,
      salesOfficerId: val,
      receivedFrom: assignedReceivedFrom || prev.receivedFrom,
      partyDealerId: assignedPartyDealerId || prev.partyDealerId,
      partyCode: assignedPartyCode || prev.partyCode,
      regionId: autoRegionId || prev.regionId,
      territoryId: autoTerritoryId || prev.territoryId,
      prNumber: autoPrNum,
    }));

    if (officerDealers.length > 0) {
      notify(`Auto-fetched ${officerName}: Dealer "${officerDealers[0].name}", Region & Territory populated`, 'info');
    } else {
      notify(`Auto-fetched ${officerName}: Territory & Region synchronized`, 'info');
    }
  };

  // Auto-fetch Dealer -> Officer, Territory, Region when dealer is chosen
  const handleHeaderDealerSelect = (val: string) => {
    const dlrs = Array.isArray(dealers) ? dealers : [];
    const d = dlrs.find((x) => x.id === val);

    if (!val || !d) {
      setPrForm((prev) => ({
        ...prev,
        partyDealerId: '',
        partyCode: '',
      }));
      return;
    }

    const regId = d?.territory?.zone?.regionId || d?.regionId || prForm.regionId;
    const terrId = d?.territoryId || prForm.territoryId;
    const officerId = d?.assignedFieldOfficerId || prForm.salesOfficerId;

    setPrForm((prev) => ({
      ...prev,
      partyDealerId: val,
      partyCode: d.code || '',
      receivedFrom: `${d.name} (${d.code})`,
      regionId: regId || prev.regionId,
      territoryId: terrId || prev.territoryId,
      salesOfficerId: officerId || prev.salesOfficerId,
      companyId: d.companyId || prev.companyId,
    }));

    notify(`Auto-filled Region & Territory for Dealer ${d.name}`, 'info');
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

  // Submit Create PR
  const handleCreatePrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prForm.prNumber.trim()) {
      notify('Please enter a unique PR Number (e.g. PR-000001)', 'error');
      return;
    }
    if (!prForm.receivedFrom.trim()) {
      notify('Please enter "Received From M/s" / Field Employee', 'error');
      return;
    }

    const totalAmt = Number(prForm.totalAmount) || calculatedProductTotal;
    if (totalAmt <= 0) {
      notify('Please specify a total amount or add product lines', 'error');
      return;
    }

    // Check sum of allocations if provided
    const allocTotal = allocationRows.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
    if (allocTotal > totalAmt) {
      notify(`Total allocated (PKR ${allocTotal}) cannot exceed received amount (PKR ${totalAmt})`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ApiClient.post('/api/v1/provisional-receipts', {
        ...prForm,
        totalAmount: totalAmt,
        products: productRows,
        allocations: allocationRows.filter((a) => a.dealerId && Number(a.allocatedAmount) > 0),
      });

      notify(`Provisional Receipt ${prForm.prNumber.toUpperCase()} created & posted to Collection Clearing!`, 'success');
      setIsCreatePrOpen(false);
      setProductRows([]);
      setAllocationRows([]);
      setPrForm({
        companyId: companies[0]?.id || '',
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
        paymentMethod: 'ONLINE',
        paymentReferenceNumber: '',
        bankName: '',
        branchName: '',
        totalAmount: '',
        remarks: '',
        autoPost: true,
      });
      fetchDashboard();
      fetchPrs();
    } catch (err: any) {
      notify(err?.message || 'Failed to create Provisional Receipt', 'error');
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
            onClick={() => {
              const defaultCompanyId = prForm.companyId || (companies[0]?.id || '');
              setPrForm((prev) => ({
                ...prev,
                companyId: defaultCompanyId,
                prNumber: `PR-${Math.floor(100000 + Math.random() * 900000)}`,
              }));
              fetchAuxiliary(defaultCompanyId);
              setIsCreatePrOpen(true);
            }}
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

      {/* MODAL 1: ISSUE NEW PROVISIONAL RECEIPT */}
      <Modal
        isOpen={isCreatePrOpen}
        onClose={() => setIsCreatePrOpen(false)}
        title="Issue Provisional Receipt (PR)"
        size="xl"
      >
        <form onSubmit={handleCreatePrSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Header Info Panel */}
          <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label className="label">Company *</label>
                <Select
                  value={prForm.companyId}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    setPrForm((prev) => ({
                      ...prev,
                      companyId: val,
                      partyDealerId: '',
                      partyCode: '',
                      regionId: '',
                      territoryId: '',
                    }));
                    fetchAuxiliary(val);
                  }}
                  options={(Array.isArray(companies) ? companies : []).map((c) => ({
                    label: `${c.name} (${c.code})`,
                    value: c.id,
                  }))}
                  required
                />
              </div>

              <div>
                <label className="label">PR Number (Unique) *</label>
                <Input
                  required
                  placeholder="e.g. PR-000001"
                  value={prForm.prNumber}
                  onChange={(e) => setPrForm({ ...prForm, prNumber: e.target.value })}
                  style={{ fontWeight: 700, fontFamily: 'monospace' }}
                />
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
                <label className="label">Collecting Officer / User (Staff Dropdown)</label>
                <Select
                  value={prForm.salesOfficerId}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    handleHeaderOfficerSelect(val);
                  }}
                  options={[
                    { label: '-- Select Collecting Officer (Optional) --', value: '' },
                    ...(Array.isArray(usersMaster) ? usersMaster : []).map((u) => {
                      const officerDealers = (dealers || []).filter(
                        (d: any) =>
                          d.assignedFieldOfficerId === u.id ||
                          d.officerAssignments?.some((oa: any) => oa.userId === u.id || oa.user?.id === u.id)
                      );
                      const dealerCount = officerDealers.length;
                      return {
                        label: `${u.firstName || ''} ${u.lastName || ''}`.trim() + ` (${u.email})${dealerCount > 0 ? ` [${dealerCount} Dealers]` : ''}`,
                        value: u.id,
                      };
                    }),
                  ]}
                />
              </div>

              <div>
                <label className="label">Received From M/s (Payer / Officer Name) *</label>
                <Input
                  required
                  placeholder="e.g. Officer Hamza / M/s Al-Madina Traders"
                  value={prForm.receivedFrom}
                  onChange={(e) => setPrForm({ ...prForm, receivedFrom: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Primary Dealer / Party Code</label>
                <Select
                  value={prForm.partyDealerId}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    handleHeaderDealerSelect(val);
                  }}
                  options={[
                    { label: '-- Select Dealer (Optional) --', value: '' },
                    ...(() => {
                      const dlrs = Array.isArray(dealers) ? dealers : [];
                      // If officer is selected, sort their assigned dealers first
                      return [...dlrs]
                        .sort((a, b) => {
                          if (!prForm.salesOfficerId) return 0;
                          const aAssigned = a.assignedFieldOfficerId === prForm.salesOfficerId || a.officerAssignments?.some((oa: any) => oa.userId === prForm.salesOfficerId);
                          const bAssigned = b.assignedFieldOfficerId === prForm.salesOfficerId || b.officerAssignments?.some((oa: any) => oa.userId === prForm.salesOfficerId);
                          if (aAssigned && !bAssigned) return -1;
                          if (!aAssigned && bAssigned) return 1;
                          return 0;
                        })
                        .map((d) => {
                          const isAssigned = prForm.salesOfficerId && (
                            d.assignedFieldOfficerId === prForm.salesOfficerId ||
                            d.officerAssignments?.some((oa: any) => oa.userId === prForm.salesOfficerId || oa.user?.id === prForm.salesOfficerId)
                          );
                          return {
                            label: `${isAssigned ? '★ ' : ''}${d.code} - ${d.name}${isAssigned ? ' (Assigned)' : ''}`,
                            value: d.id,
                            subtext: d.city ? `City: ${d.city}` : undefined,
                          };
                        });
                    })(),
                  ]}
                />
              </div>

              <div>
                <label className="label">Region</label>
                <Select
                  value={prForm.regionId}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    setPrForm((prev) => ({ ...prev, regionId: val }));
                  }}
                  options={[
                    { label: '-- Select Region --', value: '' },
                    ...(Array.isArray(regions) ? regions : []).map((r) => ({
                      label: `${r.name} (${r.code || 'REG'})`,
                      value: r.id,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="label">Territory</label>
                <Select
                  value={prForm.territoryId}
                  onChange={(valOrEvent) => {
                    const val = valOrEvent?.target?.value ?? valOrEvent;
                    const terr = (territories || []).find((t: any) => t.id === val);
                    setPrForm((prev) => ({
                      ...prev,
                      territoryId: val,
                      regionId: terr?.zone?.regionId || prev.regionId,
                      salesOfficerId: terr?.managerId || prev.salesOfficerId,
                    }));
                  }}
                  options={[
                    { label: '-- Select Territory --', value: '' },
                    ...(Array.isArray(territories) ? territories : []).map((t) => ({
                      label: `${t.name} (${t.code || 'TERR'})`,
                      value: t.id,
                    })),
                  ]}
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
                    { label: 'Online / Bank Deposit', value: 'ONLINE' },
                    { label: 'Bank Cheque', value: 'CHEQUE' },
                    { label: 'Cash Collection', value: 'CASH' },
                    { label: 'Pay Order / Demand Draft', value: 'PAY_ORDER' },
                  ]}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
              <div>
                <label className="label">Cheque / Ref Number</label>
                <Input
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
          </div>

          {/* Dynamic Product Lines Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Product Lines (Matches Physical PR Table)
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Enter physical commercial lines to auto-calculate the total receipt value.
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddProductRow}>
                <IconPlus size={13} /> Add Product Line
              </Button>
            </div>

            {productRows.length > 0 && (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '140px' }}>Pack Size</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Rate (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>Amount (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map((row, idx) => {
                      const lineAmt = Number(row.quantity || 0) * Number(row.policyRate || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={row.finishedProductId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const prods = Array.isArray(productsMaster) ? productsMaster : [];
                                const prod = prods.find((p) => (p.finishedProductId || p.id) === val);
                                const copy = [...productRows];
                                if (copy[idx]) {
                                  copy[idx] = {
                                    ...copy[idx],
                                    finishedProductId: val,
                                    productName: prod?.productName || copy[idx].productName,
                                    packSize: prod?.packSizeName || prod?.packSize?.name || copy[idx].packSize,
                                    policyRate: Number(prod?.baseRate || prod?.defaultSellingPrice || copy[idx].policyRate),
                                  };
                                  setProductRows(copy);
                                }
                              }}
                              style={{
                                width: '100%',
                                minWidth: '180px',
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
                              <option value="">-- Select Master Product --</option>
                              {(Array.isArray(productsMaster) ? productsMaster : []).map((p) => {
                                const pId = p.finishedProductId || p.id;
                                const pPack = p.packSizeName || p.packSize?.name || 'Standard';
                                const pRate = Number(p.baseRate || p.defaultSellingPrice || 0);
                                return (
                                  <option key={pId} value={pId}>
                                    {p.productName} ({pPack}) - PKR {pRate.toLocaleString()}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Input
                              value={row.packSize}
                              onChange={(e) => {
                                const copy = [...productRows];
                                if (copy[idx]) {
                                  copy[idx].packSize = e.target.value;
                                  setProductRows(copy);
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => {
                                const copy = [...productRows];
                                if (copy[idx]) {
                                  copy[idx].quantity = Number(e.target.value);
                                  setProductRows(copy);
                                }
                              }}
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Input
                              type="number"
                              value={row.policyRate}
                              onChange={(e) => {
                                const copy = [...productRows];
                                if (copy[idx]) {
                                  copy[idx].policyRate = Number(e.target.value);
                                  setProductRows(copy);
                                }
                              }}
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                            PKR {lineAmt.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRemoveProductRow(idx)}
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
          </div>

          {/* Total Amount Box */}
          <div
            style={{
              padding: '16px',
              background: 'rgba(217, 119, 6, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Received Amount
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706' }}>
                PKR {(Number(prForm.totalAmount) || calculatedProductTotal).toLocaleString()}
              </div>
            </div>

            <div style={{ maxWidth: '220px' }}>
              <label className="label" style={{ fontSize: '11px' }}>Direct / Override Total (PKR)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Total amount"
                value={prForm.totalAmount}
                onChange={(e) => setPrForm({ ...prForm, totalAmount: e.target.value })}
                style={{ fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Multi-Dealer Allocation Split */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Dealer Allocation (Optional at creation, can be allocated later)
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Unallocated amount remains securely in Account 103500 (Collection Clearing).
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddAllocationRow}>
                <IconPlus size={13} /> Add Dealer Split
              </Button>
            </div>

            {allocationRows.length > 0 && (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Dealer</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '180px' }}>Allocated Amount (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Remarks</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationRows.map((alloc, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <select
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
                            placeholder="Allocation remarks"
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
            )}
          </div>

          {/* GL Accounting Impact Box */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(2, 132, 199, 0.05)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconFileText size={14} />
              Automated Double-Entry General Ledger Impact:
            </div>
            <div style={{ marginTop: '6px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              • <strong>Debit:</strong> Account 101000 (Cash) / Account 102000 (Bank) for received amount.<br />
              • <strong>Credit:</strong> Account 103000 (Accounts Receivable - Dealers) for allocated portion & Account 103500 (Collection Clearing) for unallocated balance.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsCreatePrOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              style={{ background: '#d97706', borderColor: '#d97706', color: '#fff' }}
            >
              <IconCheck size={14} /> {isSubmitting ? 'Posting...' : 'Issue & Post Provisional Receipt'}
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
