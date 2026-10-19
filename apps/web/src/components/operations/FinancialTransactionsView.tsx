'use client';

/**
 * SHEHSWAR ONE360 - Financial Transactions & Cash/Bank Control UI
 *
 * Implements enterprise treasury and voucher management matching Sales Orders design system:
 * - ListPageTemplate canonical structure
 * - KpiCard metrics with standard SVG icon components (zero hardcoded emojis)
 * - 4 direct voucher launchers (+ Cash Receipt, - Cash Payment, + Bank Receipt, - Bank Payment) + Salary Disbursement
 * - Clean tab navigation across Cash & Bank Dashboard, Collections Breakdown, All Transactions, and Salary Logs
 * - StatusBadge and DataTable design standards
 * - Production Modal components with complete form controls and automated GL debit/credit annotations
 */
import React, { useState, useEffect } from 'react';
import { ListPageTemplate } from '../templates';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
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
  IconSearch,
  IconAlertTriangle,
  IconCreditCard,
  IconFinance,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconFileText,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export const FinancialTransactionsView: React.FC = () => {
  const { showToast } = useToast();
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    showToast({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice', message, type });
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'collections' | 'all-tx' | 'salary-payments'>('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [collectionsData, setCollectionsData] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [modalTxType, setModalTxType] = useState<'CASH_RECEIPT' | 'CASH_PAYMENT' | 'BANK_RECEIPT' | 'BANK_PAYMENT'>('CASH_RECEIPT');

  // Transaction Form
  const [txForm, setTxForm] = useState({
    companyId: '',
    transactionDate: new Date().toISOString().split('T')[0],
    partyType: 'DEALER',
    partyId: '',
    partyName: '',
    amount: '',
    paymentMethod: 'CASH',
    contraAccountId: '',
    bankName: '',
    branchName: '',
    referenceNumber: '',
    remarks: '',
  });

  // Salary Form
  const [salaryForm, setSalaryForm] = useState({
    companyId: '',
    employeeId: '',
    salaryMonth: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
    paymentDate: new Date().toISOString().split('T')[0],
    grossSalary: 100000,
    adjustments: 0,
    paymentMethod: 'BANK',
    referenceNumber: '',
    remarks: 'Monthly salary disbursement',
  });

// Safe Array Extractor to handle nested API envelopes: { success: true, data: { total, data: [] } } or { data: [] } or []
const extractArray = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};

  // Fetch Auxiliary Master Data
  const fetchAuxiliary = async () => {
    try {
      const [compRes, dlrRes, empRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies?all=true'),
        ApiClient.get<any>('/api/v1/dealers'),
        ApiClient.get<any>('/api/v1/master-data/employees?all=true'),
      ]);

      const compData = extractArray(compRes);
      const dlrData = extractArray(dlrRes);
      const empData = extractArray(empRes);

      setCompanies(compData);
      setDealers(dlrData);
      setEmployees(empData);

      if (compData.length > 0 && !txForm.companyId) {
        setTxForm((prev) => ({ ...prev, companyId: compData[0].id }));
        setSalaryForm((prev) => ({ ...prev, companyId: compData[0].id }));
      }
      if (empData.length > 0 && !salaryForm.employeeId) {
        setSalaryForm((prev) => ({
          ...prev,
          employeeId: empData[0].id,
          grossSalary: Number(empData[0].salary || 100000),
        }));
      }
    } catch (err) {
      console.error('Failed to load auxiliary data:', err);
    }
  };

  // Fetch Cash & Bank Dashboard
  const fetchDashboard = async () => {
    try {
      const params = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/cash-bank-dashboard${params}`);
      const data = res?.data || res;
      setDashboardData(data || null);
    } catch (err) {
      console.error('Failed to load cash/bank dashboard:', err);
    }
  };

  // Fetch Collections Dashboard
  const fetchCollections = async () => {
    try {
      const params = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/collections-dashboard${params}`);
      const data = res?.data || res;
      setCollectionsData(data || null);
    } catch (err) {
      console.error('Failed to load collections dashboard:', err);
    }
  };

  // Fetch Transactions List
  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId !== 'ALL') params.set('companyId', selectedCompanyId);
      if (txTypeFilter !== 'ALL') params.set('transactionType', txTypeFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions?${params.toString()}`);
      const data = extractArray(res);
      setTransactions(data);
    } catch (err) {
      notify('Failed to load transaction vouchers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Salary Payments
  const fetchSalaries = async () => {
    try {
      const params = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/salary-payments${params}`);
      const data = extractArray(res);
      setSalaryPayments(data);
    } catch (err) {
      console.error('Failed to load salary payments:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchCollections();
    fetchTransactions();
    fetchSalaries();
  }, [selectedCompanyId, txTypeFilter]);

  // Handle open transaction modal
  const handleOpenTxModal = (type: 'CASH_RECEIPT' | 'CASH_PAYMENT' | 'BANK_RECEIPT' | 'BANK_PAYMENT') => {
    setModalTxType(type);
    const isBank = type === 'BANK_RECEIPT' || type === 'BANK_PAYMENT';
    setTxForm((prev) => ({
      ...prev,
      companyId: prev.companyId || companies[0]?.id || '',
      paymentMethod: isBank ? 'BANK' : 'CASH',
      amount: '',
      partyName: '',
      referenceNumber: '',
      remarks: '',
    }));
    setIsTxModalOpen(true);
  };

  // Submit Transaction
  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(txForm.amount);
    if (!amt || amt <= 0) {
      notify('Please enter a valid amount', 'error');
      return;
    }

    const endpointMap = {
      CASH_RECEIPT: '/api/v1/financial-transactions/cash-receipt',
      CASH_PAYMENT: '/api/v1/financial-transactions/cash-payment',
      BANK_RECEIPT: '/api/v1/financial-transactions/bank-receipt',
      BANK_PAYMENT: '/api/v1/financial-transactions/bank-payment',
    };

    try {
      await ApiClient.post(endpointMap[modalTxType], {
        ...txForm,
        amount: amt,
      });

      notify(`${modalTxType.replace('_', ' ')} of PKR ${amt.toLocaleString()} posted to GL!`, 'success');
      setIsTxModalOpen(false);
      fetchDashboard();
      fetchCollections();
      fetchTransactions();
    } catch (err: any) {
      notify(err?.message || 'Transaction failed', 'error');
    }
  };

  // Submit Salary Payment
  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Number(salaryForm.grossSalary);
    const adj = Number(salaryForm.adjustments || 0);
    const net = gross + adj;

    if (net <= 0) {
      notify('Net paid salary must be greater than zero', 'error');
      return;
    }

    try {
      await ApiClient.post('/api/v1/financial-transactions/salary-payment', {
        ...salaryForm,
        grossSalary: gross,
        adjustments: adj,
        netPaid: net,
      });

      notify(`Salary payment of PKR ${net.toLocaleString()} posted to GL!`, 'success');
      setIsSalaryModalOpen(false);
      fetchDashboard();
      fetchSalaries();
    } catch (err: any) {
      notify(err?.message || 'Failed to post salary', 'error');
    }
  };

  const getTxBadgeVariant = (type: string) => {
    switch (type) {
      case 'CASH_RECEIPT':
      case 'BANK_RECEIPT':
        return 'success';
      case 'CASH_PAYMENT':
      case 'BANK_PAYMENT':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getTxTypeLabel = (type: string) => {
    switch (type) {
      case 'CASH_RECEIPT':
        return 'Direct Cash Receipt Voucher (CR)';
      case 'CASH_PAYMENT':
        return 'Direct Cash Payment Voucher (CP)';
      case 'BANK_RECEIPT':
        return 'Direct Bank Receipt Voucher (BR)';
      case 'BANK_PAYMENT':
        return 'Direct Bank Payment Voucher (BP)';
      default:
        return 'Financial Voucher';
    }
  };

  return (
    <ListPageTemplate
      title="Financial Transactions & Cash/Bank Control"
      subtitle="Authoritative Cash & Bank balances, 5 financial transaction voucher types, collections dashboard, and salary disbursements."
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => {
              fetchDashboard();
              fetchCollections();
              fetchTransactions();
              fetchSalaries();
            }}
          >
            <IconRefresh size={16} /> Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => handleOpenTxModal('CASH_RECEIPT')}
            style={{ backgroundColor: '#10b981', border: 'none', color: '#fff' }}
          >
            <IconPlus size={14} /> Cash Receipt
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleOpenTxModal('CASH_PAYMENT')}
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            - Cash Payment
          </Button>

          <Button
            variant="primary"
            onClick={() => handleOpenTxModal('BANK_RECEIPT')}
            style={{ backgroundColor: '#0284c7', border: 'none', color: '#fff' }}
          >
            <IconPlus size={14} /> Bank Receipt
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleOpenTxModal('BANK_PAYMENT')}
            style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
          >
            - Bank Payment
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsSalaryModalOpen(true)}
            style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
          >
            <IconUser size={14} /> Disburse Salary
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
            title="Cash on Hand (101000)"
            value={`PKR ${Number(dashboardData.cashBalance || 0).toLocaleString()}`}
            subtitle={`Receipts: PKR ${Number(dashboardData.cashReceipts || 0).toLocaleString()}`}
            icon={<IconCreditCard size={20} />}
          />
          <KpiCard
            title="Bank Balance (102000)"
            value={`PKR ${Number(dashboardData.bankBalance || 0).toLocaleString()}`}
            subtitle={`Receipts: PKR ${Number(dashboardData.bankReceipts || 0).toLocaleString()}`}
            icon={<IconFinance size={20} />}
          />
          <KpiCard
            title="Total Group Collections"
            value={`PKR ${Number(dashboardData.totalCollections || 0).toLocaleString()}`}
            subtitle="Cash + Bank + Allocated PR"
            icon={<IconTrendingUp size={20} />}
          />
          <KpiCard
            title="Unallocated PR Clearing"
            value={`PKR ${Number(dashboardData.unallocatedPr || 0).toLocaleString()}`}
            subtitle={`${Number(dashboardData.pendingPrCount || 0)} PRs Pending Allocation`}
            icon={<IconAlertTriangle size={20} />}
          />
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dashboard' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'dashboard' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconFinance size={16} /> Cash & Bank Dashboard
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'collections' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'collections' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconTrendingUp size={16} /> Collections Breakdown
        </button>

        <button
          onClick={() => setActiveTab('all-tx')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all-tx' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'all-tx' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconFileText size={16} /> All Transaction Vouchers
        </button>

        <button
          onClick={() => setActiveTab('salary-payments')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'salary-payments' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'salary-payments' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconUsers size={16} /> Employee Salary Vouchers (GL 607000)
        </button>
      </div>

      {/* Filter Toolbar matching SalesOrdersView */}
      <Card style={{ marginBottom: '20px' }}>
        <CardContent style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                placeholder="Search by Voucher #, Party, Reference, Remarks..."
                startIcon={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
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

            {activeTab === 'all-tx' && (
              <div style={{ minWidth: '180px' }}>
                <Select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  options={[
                    { label: 'All Voucher Types', value: 'ALL' },
                    { label: 'Cash Receipts (CR)', value: 'CASH_RECEIPT' },
                    { label: 'Cash Payments (CP)', value: 'CASH_PAYMENT' },
                    { label: 'Bank Receipts (BR)', value: 'BANK_RECEIPT' },
                    { label: 'Bank Payments (BP)', value: 'BANK_PAYMENT' },
                  ]}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TAB 1: CASH & BANK DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && dashboardData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Cash Summary Card */}
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle style={{ color: '#10b981' }}>Cash Management (Account 101000)</CardTitle>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reconciled Real-Time</span>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Authoritative Cash Balance:</span>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: '18px' }}>
                    PKR {Number(dashboardData.cashBalance || 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Cash Receipts (+):</span>
                  <span style={{ fontWeight: 600 }}>PKR {Number(dashboardData.cashReceipts || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Cash Payments (-):</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>PKR {Number(dashboardData.cashPayments || 0).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenTxModal('CASH_RECEIPT')}
                    style={{ flex: 1, backgroundColor: '#10b981', border: 'none', color: '#fff' }}
                  >
                    + Receive Cash
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenTxModal('CASH_PAYMENT')}
                    style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    - Pay Cash
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Summary Card */}
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle style={{ color: '#0284c7' }}>Bank Management (Account 102000)</CardTitle>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reconciled Real-Time</span>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Authoritative Bank Balance:</span>
                  <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '18px' }}>
                    PKR {Number(dashboardData.bankBalance || 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Bank Receipts (+):</span>
                  <span style={{ fontWeight: 600 }}>PKR {Number(dashboardData.bankReceipts || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Bank Payments (-):</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>PKR {Number(dashboardData.bankPayments || 0).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenTxModal('BANK_RECEIPT')}
                    style={{ flex: 1, backgroundColor: '#0284c7', border: 'none', color: '#fff' }}
                  >
                    + Receive Bank
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenTxModal('BANK_PAYMENT')}
                    style={{ flex: 1, color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                  >
                    - Pay Bank
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: COLLECTIONS BREAKDOWN */}
      {activeTab === 'collections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <KpiCard
              title="Collections Today"
              value={`PKR ${Number(collectionsData?.today?.total ?? collectionsData?.todayTotal ?? 0).toLocaleString()}`}
              subtitle={`Cash: PKR ${Number(collectionsData?.today?.cash ?? 0).toLocaleString()} | Bank: PKR ${Number(collectionsData?.today?.bank ?? 0).toLocaleString()}`}
              icon={<IconTrendingUp size={20} />}
            />
            <KpiCard
              title="Collections This Month"
              value={`PKR ${Number(collectionsData?.thisMonth?.total ?? collectionsData?.monthTotal ?? 0).toLocaleString()}`}
              subtitle={`Cash: PKR ${Number(collectionsData?.thisMonth?.cash ?? 0).toLocaleString()} | Bank: PKR ${Number(collectionsData?.thisMonth?.bank ?? 0).toLocaleString()}`}
              icon={<IconFinance size={20} />}
            />
            <KpiCard
              title="Collections This Year"
              value={`PKR ${Number(collectionsData?.thisYear?.total ?? collectionsData?.yearTotal ?? 0).toLocaleString()}`}
              subtitle="Fiscal Year cumulative"
              icon={<IconCreditCard size={20} />}
            />
            <KpiCard
              title="All-Time Reconciled"
              value={`PKR ${Number(collectionsData?.allTime?.total ?? 0).toLocaleString()}`}
              subtitle="Total verified collections"
              icon={<IconFinance size={20} />}
            />
          </div>

          {/* Dealer Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>Dealer Collection Performance Leaderboard</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: 0 }}>
              {(!collectionsData?.topDealers || collectionsData.topDealers.length === 0) &&
              (!collectionsData?.dealerCollections || collectionsData.dealerCollections.length === 0) ? (
                <EmptyState
                  title="No Collections Logged"
                  description="Dealer collections will appear here once cash receipts, bank collections, or PR settlements are recorded."
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Dealer Name</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Dealer Code</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Region / Territory</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Collected (PKR)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(collectionsData?.topDealers || collectionsData?.dealerCollections || []).map((dc: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{dc.name || dc.dealerName}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{dc.code || dc.dealerCode}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {dc.region || '-'}{dc.territory ? ` / ${dc.territory}` : ''}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                            PKR {Number(dc.amount ?? dc.totalAmount ?? 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const dlrs = Array.isArray(dealers) ? dealers : [];
                                const found = dlrs.find((d) => d.code === (dc.code || dc.dealerCode) || d.id === dc.dealerId);
                                setTxForm((prev) => ({
                                  ...prev,
                                  partyType: 'DEALER',
                                  partyId: found ? found.id : (dc.dealerId || ''),
                                  partyName: dc.name || dc.dealerName || '',
                                }));
                                handleOpenTxModal('CASH_RECEIPT');
                              }}
                            >
                              + Collect
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

      {/* TAB 3: ALL TRANSACTION VOUCHERS */}
      {activeTab === 'all-tx' && (
        <Card>
          <CardContent style={{ padding: 0 }}>
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : transactions.length === 0 ? (
              <EmptyState
                title="No Transactions Found"
                description="No cash or bank transaction vouchers match the current filters. Click '+ Cash Receipt' or '+ Bank Receipt' to post a voucher."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Voucher #</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Party / Counterparty</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Amount (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Reference</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px' }}>{new Date(tx.transactionDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                          {tx.voucherNumber}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={tx.transactionType} variant={getTxBadgeVariant(tx.transactionType)}>
                            {tx.transactionType.replace('_', ' ')}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{tx.company?.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{tx.partyName || tx.partyType}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type: {tx.partyType}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: tx.paymentMethod === 'BANK' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: tx.paymentMethod === 'BANK' ? '#0284c7' : '#10b981',
                            }}
                          >
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontWeight: 800,
                            color: tx.transactionType.includes('RECEIPT') ? '#10b981' : '#ef4444',
                          }}
                        >
                          PKR {Number(tx.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace' }}>
                          {tx.referenceNumber || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {tx.remarks || '-'}
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

      {/* TAB 4: SALARY PAYMENTS */}
      {activeTab === 'salary-payments' && (
        <Card>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle>Employee Salary Vouchers (GL Account 607000)</CardTitle>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Official payroll disbursement vouchers with double-entry General Ledger postings.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSalaryModalOpen(true)}
              style={{ backgroundColor: '#8b5cf6', border: 'none', color: '#fff' }}
            >
              <IconPlus size={14} /> Disburse Salary
            </Button>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {salaryPayments.length === 0 ? (
              <EmptyState
                title="No Salary Vouchers Logged"
                description="Click 'Disburse Salary' to record a monthly employee salary disbursement voucher."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Payment Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Voucher #</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Employee</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Gross</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Adjustments</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Net Paid (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Ref / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryPayments.map((sp) => (
                      <tr key={sp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px' }}>{new Date(sp.paymentDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#8b5cf6' }}>
                          {sp.voucherNumber}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>
                            {sp.employee ? `${sp.employee.firstName} ${sp.employee.lastName}` : 'Employee'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Code: {sp.employee?.employeeCode}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{sp.salaryMonth}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          PKR {Number(sp.grossSalary).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: Number(sp.adjustments) >= 0 ? '#10b981' : '#ef4444' }}>
                          {Number(sp.adjustments) >= 0 ? '+' : ''}{Number(sp.adjustments).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-primary, #1e40af)' }}>
                          PKR {Number(sp.netPaid).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: sp.paymentMethod === 'BANK' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: sp.paymentMethod === 'BANK' ? '#0284c7' : '#10b981',
                            }}
                          >
                            {sp.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {sp.referenceNumber || sp.remarks || '-'}
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

      {/* MODAL 1: DIRECT FINANCIAL TRANSACTION VOUCHER */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title={getTxTypeLabel(modalTxType)}
        description="Creates balanced double-entry accounting entries directly in the General Ledger."
        size="lg"
      >
        <form onSubmit={handleTxSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Operating Company *
              </label>
              <Select
                value={txForm.companyId}
                onChange={(e) => setTxForm({ ...txForm, companyId: e.target.value })}
                options={(Array.isArray(companies) ? companies : []).map((c) => ({
                  label: `${c.name} (${c.code})`,
                  value: c.id,
                }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Transaction Date *
              </label>
              <Input
                type="date"
                required
                value={txForm.transactionDate}
                onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Counterparty Type *
              </label>
              <Select
                value={txForm.partyType}
                onChange={(e) => setTxForm({ ...txForm, partyType: e.target.value, partyId: '', partyName: '' })}
                options={[
                  { label: 'Registered Dealer (Customer)', value: 'DEALER' },
                  { label: 'Vendor / Supplier', value: 'VENDOR' },
                  { label: 'Employee / Staff', value: 'EMPLOYEE' },
                  { label: 'Direct / Other Party', value: 'DIRECT' },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Party Selection / Name *
              </label>
              {txForm.partyType === 'DEALER' ? (
                <Select
                  value={txForm.partyId}
                  onChange={(e) => {
                    const dlrs = Array.isArray(dealers) ? dealers : [];
                    const dlr = dlrs.find((d) => d.id === e.target.value);
                    setTxForm({
                      ...txForm,
                      partyId: e.target.value,
                      partyName: dlr ? dlr.name : '',
                    });
                  }}
                  options={[
                    { label: '-- Select Registered Dealer --', value: '' },
                    ...(Array.isArray(dealers) ? dealers : []).map((d) => ({
                      label: `${d.name} (${d.code})`,
                      value: d.id,
                    })),
                  ]}
                />
              ) : txForm.partyType === 'EMPLOYEE' ? (
                <Select
                  value={txForm.partyId}
                  onChange={(e) => {
                    const emps = Array.isArray(employees) ? employees : [];
                    const emp = emps.find((x) => x.id === e.target.value);
                    setTxForm({
                      ...txForm,
                      partyId: e.target.value,
                      partyName: emp ? `${emp.firstName} ${emp.lastName}` : '',
                    });
                  }}
                  options={[
                    { label: '-- Select Employee --', value: '' },
                    ...(Array.isArray(employees) ? employees : []).map((emp) => ({
                      label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                      value: emp.id,
                    })),
                  ]}
                />
              ) : (
                <Input
                  required
                  placeholder="e.g. PSO Fuel Station / Office Landlord"
                  value={txForm.partyName}
                  onChange={(e) => setTxForm({ ...txForm, partyName: e.target.value })}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Voucher Amount (PKR) *
              </label>
              <Input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 500000"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Reference / Cheque #
              </label>
              <Input
                placeholder="e.g. CHQ-908123 or Bank Ref #"
                value={txForm.referenceNumber}
                onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Bank specific details */}
          {(modalTxType === 'BANK_RECEIPT' || modalTxType === 'BANK_PAYMENT') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Bank Name
                </label>
                <Input
                  placeholder="e.g. Habib Bank Limited / Meezan Bank"
                  value={txForm.bankName}
                  onChange={(e) => setTxForm({ ...txForm, bankName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Branch Name
                </label>
                <Input
                  placeholder="e.g. Main Boulevard Branch"
                  value={txForm.branchName}
                  onChange={(e) => setTxForm({ ...txForm, branchName: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Remarks / Description
            </label>
            <Textarea
              value={txForm.remarks}
              onChange={(e) => setTxForm({ ...txForm, remarks: e.target.value })}
              rows={2}
              placeholder="Official transaction memo or purpose of voucher..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsTxModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Post Voucher to GL
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: DISBURSE EMPLOYEE SALARY */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Disburse Employee Salary (GL 607000)"
        description="Records an official payroll voucher and immediately debits Salary Expense Account 607000."
        size="lg"
      >
        <form onSubmit={handleSalarySubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Operating Company *
              </label>
              <Select
                value={salaryForm.companyId}
                onChange={(e) => setSalaryForm({ ...salaryForm, companyId: e.target.value })}
                options={(Array.isArray(companies) ? companies : []).map((c) => ({
                  label: `${c.name} (${c.code})`,
                  value: c.id,
                }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Select Employee *
              </label>
              <Select
                value={salaryForm.employeeId}
                onChange={(e) => {
                  const emps = Array.isArray(employees) ? employees : [];
                  const emp = emps.find((x) => x.id === e.target.value);
                  setSalaryForm({
                    ...salaryForm,
                    employeeId: e.target.value,
                    grossSalary: emp ? Number(emp.salary || 100000) : 100000,
                  });
                }}
                options={(Array.isArray(employees) ? employees : []).map((emp) => ({
                  label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                  value: emp.id,
                }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Salary Month *
              </label>
              <Input
                required
                placeholder="e.g. October 2026"
                value={salaryForm.salaryMonth}
                onChange={(e) => setSalaryForm({ ...salaryForm, salaryMonth: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Payment Date *
              </label>
              <Input
                type="date"
                required
                value={salaryForm.paymentDate}
                onChange={(e) => setSalaryForm({ ...salaryForm, paymentDate: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Gross Salary (PKR) *
              </label>
              <Input
                type="number"
                required
                value={salaryForm.grossSalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, grossSalary: Number(e.target.value) })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Adjustments (+/-)
              </label>
              <Input
                type="number"
                value={salaryForm.adjustments}
                onChange={(e) => setSalaryForm({ ...salaryForm, adjustments: Number(e.target.value) })}
                placeholder="e.g. +5000 bonus or -2000 tax"
              />
            </div>
          </div>

          {/* Net Salary Preview */}
          <div
            style={{
              padding: '14px 18px',
              background: 'var(--bg-subtle)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Net Disbursed to Employee
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6' }}>
                PKR {(Number(salaryForm.grossSalary) + Number(salaryForm.adjustments)).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>
              <div>Debit: Salaries Expense (607000)</div>
              <div>Credit: {salaryForm.paymentMethod === 'BANK' ? 'Bank (102000)' : 'Cash (101000)'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Payment Method
              </label>
              <Select
                value={salaryForm.paymentMethod}
                onChange={(e) => setSalaryForm({ ...salaryForm, paymentMethod: e.target.value })}
                options={[
                  { label: 'Bank Transfer (Account 102000)', value: 'BANK' },
                  { label: 'Cash Disbursement (Account 101000)', value: 'CASH' },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Reference / Cheque #
              </label>
              <Input
                placeholder="Optional bank ref or transaction ID"
                value={salaryForm.referenceNumber}
                onChange={(e) => setSalaryForm({ ...salaryForm, referenceNumber: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsSalaryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' }}>
              Post Salary to GL
            </Button>
          </div>
        </form>
      </Modal>
    </ListPageTemplate>
  );
};
