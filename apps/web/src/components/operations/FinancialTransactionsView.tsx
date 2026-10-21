'use client';

/**
 * SHEHSWAR ONE360 - Financial Transactions & Cash/Bank Control UI
 *
 * Implements enterprise treasury and voucher management matching Sales Orders design system:
 * - ListPageTemplate canonical structure
 * - KpiCard metrics with standard SVG icon components (zero hardcoded emojis)
 * - 4 direct voucher launchers (+ Cash Receipt, - Cash Payment, + Bank Receipt, - Bank Payment) + Salary Disbursement
 * - Complete dynamic Bank Accounts Master with multi-account support per bank (HBL, UBL, Alfalah, Meezan, etc.)
 * - Bank Drill-Down Modal with chronological running ledger
 * - Authoritative Cash & Bank Dashboard (Cash Balance, Bank-wise balances, Total Bank, Total Cash+Bank)
 * - Multi-period Cash & Bank Reports (Daily, Monthly, Quarterly, Yearly, Custom Date Range)
 * - Collections Breakdown across multi-tier hierarchy
 * - Production Modal components with automated GL debit/credit annotations
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
  IconDownload,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import {
  exportCashBankReportCsv,
  exportSalaryDisbursalReportPdf,
  downloadCsv,
} from '../../lib/executive-reports-export';

export const FinancialTransactionsView: React.FC = () => {
  const { showToast } = useToast();
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    showToast({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice', message, type });
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'bank-accounts' | 'collections' | 'all-tx' | 'reports' | 'salary-payments'>('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
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

  // Bank Drill-Down Modal
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownData, setDrillDownData] = useState<any | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [drillDownDateFrom, setDrillDownDateFrom] = useState('');
  const [drillDownDateTo, setDrillDownDateTo] = useState('');

  // Add Bank Account Modal
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    companyId: '',
    bankName: 'HBL',
    accountTitle: '',
    accountNumber: '',
    branchName: '',
    branchCode: '',
    iban: '',
    openingBalance: '',
    currency: 'PKR',
    notes: '',
  });

  // Reports Tab State
  const [reportsData, setReportsData] = useState<any | null>(null);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [reportCompanyId, setReportCompanyId] = useState('ALL');
  const [reportBankName, setReportBankName] = useState('ALL');
  const [reportBankAccountId, setReportBankAccountId] = useState('ALL');
  const [reportTxType, setReportTxType] = useState('ALL');
  const [reportPeriod, setReportPeriod] = useState<'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportStatus, setReportStatus] = useState('ALL');

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
    bankAccountId: '',
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
        setNewAccountForm((prev) => ({ ...prev, companyId: compData[0].id }));
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

  // Fetch Dynamic Bank Accounts
  const fetchBankAccounts = async () => {
    try {
      const params = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/bank-accounts${params}`);
      const data = extractArray(res);
      setBankAccounts(data);
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
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

  // Fetch Cash & Bank Reports
  const fetchReports = async () => {
    setIsReportsLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportCompanyId !== 'ALL') params.set('companyId', reportCompanyId);
      if (reportBankName !== 'ALL') params.set('bankName', reportBankName);
      if (reportBankAccountId !== 'ALL') params.set('bankAccountId', reportBankAccountId);
      if (reportTxType !== 'ALL') params.set('transactionType', reportTxType);
      params.set('period', reportPeriod);
      if (reportDateFrom) params.set('dateFrom', reportDateFrom);
      if (reportDateTo) params.set('dateTo', reportDateTo);
      if (reportStatus !== 'ALL') params.set('status', reportStatus);

      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/reports?${params.toString()}`);
      const data = res?.data || res;
      setReportsData(data || null);
    } catch (err) {
      console.error('Failed to load cash & bank reports:', err);
    } finally {
      setIsReportsLoading(false);
    }
  };

  // Open Bank Drill-Down
  const openBankDrillDown = async (accountId: string, fromDate?: string, toDate?: string) => {
    setSelectedAccountId(accountId);
    setIsDrillDownOpen(true);
    setDrillDownLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res: any = await ApiClient.get<any>(`/api/v1/financial-transactions/bank-accounts/${accountId}/ledger?${params.toString()}`);
      const data = res?.data || res;
      setDrillDownData(data);
    } catch (err: any) {
      notify('Failed to load bank ledger', 'error');
    } finally {
      setDrillDownLoading(false);
    }
  };

  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchBankAccounts();
    fetchCollections();
    fetchTransactions();
    fetchSalaries();
  }, [selectedCompanyId, txTypeFilter]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, reportCompanyId, reportBankName, reportBankAccountId, reportTxType, reportPeriod, reportDateFrom, reportDateTo, reportStatus]);

  // Handle open transaction modal
  const handleOpenTxModal = (type: 'CASH_RECEIPT' | 'CASH_PAYMENT' | 'BANK_RECEIPT' | 'BANK_PAYMENT', defaultBankAccId?: string) => {
    setModalTxType(type);
    const isBank = type === 'BANK_RECEIPT' || type === 'BANK_PAYMENT';
    const initialBankAcc = defaultBankAccId
      ? bankAccounts.find((a) => a.id === defaultBankAccId)
      : bankAccounts.length > 0 ? bankAccounts[0] : null;

    setTxForm((prev) => ({
      ...prev,
      companyId: prev.companyId || companies[0]?.id || '',
      paymentMethod: isBank ? 'BANK' : 'CASH',
      bankAccountId: isBank && initialBankAcc ? initialBankAcc.id : '',
      bankName: isBank && initialBankAcc ? initialBankAcc.bankName : '',
      branchName: isBank && initialBankAcc ? initialBankAcc.branchName || '' : '',
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

    const isBank = modalTxType === 'BANK_RECEIPT' || modalTxType === 'BANK_PAYMENT';
    if (isBank && !txForm.bankAccountId) {
      notify('Please select a Bank Account', 'error');
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
      fetchBankAccounts();
      fetchCollections();
      fetchTransactions();
      if (selectedAccountId) {
        openBankDrillDown(selectedAccountId, drillDownDateFrom, drillDownDateTo);
      }
    } catch (err: any) {
      notify(err?.message || 'Transaction failed', 'error');
    }
  };

  // Submit New Bank Account
  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.bankName || !newAccountForm.accountTitle || !newAccountForm.accountNumber) {
      notify('Please fill all required bank account fields', 'error');
      return;
    }

    try {
      await ApiClient.post('/api/v1/financial-transactions/bank-accounts', {
        ...newAccountForm,
        openingBalance: Number(newAccountForm.openingBalance || 0),
      });

      notify(`Bank Account ${newAccountForm.bankName} - ${newAccountForm.accountNumber} created successfully!`, 'success');
      setIsNewAccountModalOpen(false);
      setNewAccountForm({
        companyId: companies[0]?.id || '',
        bankName: 'HBL',
        accountTitle: '',
        accountNumber: '',
        branchName: '',
        branchCode: '',
        iban: '',
        openingBalance: '',
        currency: 'PKR',
        notes: '',
      });
      fetchBankAccounts();
      fetchDashboard();
    } catch (err: any) {
      notify(err?.message || 'Failed to create bank account', 'error');
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

  // Export Bank Ledger to CSV
  const handleExportLedgerCsv = () => {
    if (!drillDownData || !drillDownData.account) return;
    const acc = drillDownData.account;
    const headers = ['Date', 'Type', 'Voucher #', 'Ref #', 'Party', 'Debit (PKR)', 'Credit (PKR)', 'Running Balance (PKR)', 'Status', 'Remarks'];
    const rows = (drillDownData.transactions || []).map((t: any) => [
      new Date(t.date).toLocaleDateString(),
      t.transactionType,
      t.voucherNumber,
      t.referenceNumber || '',
      t.partyName || '',
      t.debit,
      t.credit,
      t.runningBalance,
      t.status,
      t.remarks || '',
    ]);
    downloadCsv(`Shehswar_Bank_Ledger_${acc.bankName}_${acc.accountNumber}`, headers, rows);
  };

  // Export Bank-Wise Report to CSV
  const handleExportBankReportCsv = () => {
    if (!reportsData) return;
    const headers = ['Bank Name', 'Account Title', 'Account Number', 'Opening (PKR)', 'Receipts (PKR)', 'Payments (PKR)', 'Closing Balance (PKR)'];
    const rows = (reportsData.bankAccounts || []).map((b: any) => [
      b.bankName,
      b.accountTitle,
      b.accountNumber,
      b.opening,
      b.receipts,
      b.payments,
      b.closing,
    ]);
    downloadCsv('Shehswar_Cash_Bank_Wise_Report', headers, rows);
  };

  return (
    <ListPageTemplate
      title="Financial Transactions & Cash/Bank Control"
      subtitle="Authoritative Cash & Bank balances, dynamic bank accounts, ledger drill-downs, multi-period reports, and GL vouchers."
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconRefresh size={14} />}
            onClick={() => {
              fetchDashboard();
              fetchBankAccounts();
              fetchCollections();
              fetchTransactions();
              fetchSalaries();
              if (activeTab === 'reports') fetchReports();
            }}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconFileText size={14} />}
            onClick={() => {
              if (activeTab === 'reports') {
                handleExportBankReportCsv();
              } else if (activeTab === 'salary-payments') {
                const compName = companies.find((c) => c.id === selectedCompanyId)?.name || 'Shehswar Group';
                exportSalaryDisbursalReportPdf({
                  companyName: compName,
                  salaries: salaryPayments,
                });
              } else {
                exportCashBankReportCsv(transactions, 'Shehswar_Cash_Bank_Vouchers_Report');
              }
            }}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            startIcon={<IconPlus size={14} />}
            onClick={() => handleOpenTxModal('CASH_RECEIPT')}
            style={{ backgroundColor: '#10b981', border: 'none', color: '#fff' }}
          >
            Cash Receipt
          </Button>

          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconFinance size={14} />}
            onClick={() => handleOpenTxModal('CASH_PAYMENT')}
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            Cash Payment
          </Button>

          <Button
            variant="primary"
            size="sm"
            startIcon={<IconPlus size={14} />}
            onClick={() => handleOpenTxModal('BANK_RECEIPT')}
            style={{ backgroundColor: '#0284c7', border: 'none', color: '#fff' }}
          >
            Bank Receipt
          </Button>

          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconCreditCard size={14} />}
            onClick={() => handleOpenTxModal('BANK_PAYMENT')}
            style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
          >
            Bank Payment
          </Button>

          <Button
            variant="secondary"
            size="sm"
            startIcon={<IconUser size={14} />}
            onClick={() => setIsSalaryModalOpen(true)}
            style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
          >
            Disburse Salary
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
            title="Total Bank Balance (102000)"
            value={`PKR ${Number(dashboardData.totalBankBalance ?? dashboardData.bankBalance ?? 0).toLocaleString()}`}
            subtitle={`Receipts: PKR ${Number(dashboardData.bankReceipts || 0).toLocaleString()}`}
            icon={<IconFinance size={20} />}
          />
          <KpiCard
            title="Total Cash + Bank Balance"
            value={`PKR ${Number(dashboardData.totalCashBankBalance ?? ((dashboardData.cashBalance || 0) + (dashboardData.totalBankBalance || 0))).toLocaleString()}`}
            subtitle="Combined Treasury Liquidity"
            icon={<IconTrendingUp size={20} />}
          />
          <KpiCard
            title="Total Group Collections"
            value={`PKR ${Number(dashboardData.totalCollections || 0).toLocaleString()}`}
            subtitle={`PR Clearing: PKR ${Number(dashboardData.unallocatedPr || 0).toLocaleString()}`}
            icon={<IconFinance size={20} />}
          />
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flexWrap: 'wrap',
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
            whiteSpace: 'nowrap',
          }}
        >
          <IconFinance size={16} /> Cash & Bank Dashboard
        </button>

        <button
          onClick={() => setActiveTab('bank-accounts')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'bank-accounts' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'bank-accounts' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <IconCreditCard size={16} /> Bank Accounts ({bankAccounts.length})
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
            whiteSpace: 'nowrap',
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
            whiteSpace: 'nowrap',
          }}
        >
          <IconFileText size={16} /> All Transaction Vouchers
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'reports' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <IconDownload size={16} /> Cash & Bank Reports
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
            whiteSpace: 'nowrap',
          }}
        >
          <IconUsers size={16} /> Employee Salary Vouchers
        </button>
      </div>

      {/* Filter Toolbar */}
      <Card style={{ marginBottom: '20px' }}>
        <CardContent style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                placeholder="Search by Voucher #, Party, Bank, Reference, Remarks..."
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Row: Cash Desk & Total Bank Liquidity Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Cash Summary Card */}
            <Card>
              <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ color: '#10b981' }}>Cash Desk Management (Account 101000)</CardTitle>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Separate from Banks</span>
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
                      startIcon={<IconPlus size={13} />}
                      onClick={() => handleOpenTxModal('CASH_RECEIPT')}
                      style={{ flex: 1, backgroundColor: '#10b981', border: 'none', color: '#fff' }}
                    >
                      Receive Cash
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      startIcon={<IconFinance size={13} />}
                      onClick={() => handleOpenTxModal('CASH_PAYMENT')}
                      style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      Pay Cash
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Bank Summary Card */}
            <Card>
              <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ color: '#0284c7' }}>Consolidated Bank Treasury (Account 102000)</CardTitle>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dynamic Multi-Bank Master</span>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Authoritative Bank Balance:</span>
                    <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '18px' }}>
                      PKR {Number(dashboardData.totalBankBalance ?? dashboardData.bankBalance ?? 0).toLocaleString()}
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
                      startIcon={<IconPlus size={13} />}
                      onClick={() => handleOpenTxModal('BANK_RECEIPT')}
                      style={{ flex: 1, backgroundColor: '#0284c7', border: 'none', color: '#fff' }}
                    >
                      Receive Bank
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      startIcon={<IconCreditCard size={13} />}
                      onClick={() => handleOpenTxModal('BANK_PAYMENT')}
                      style={{ flex: 1, color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                    >
                      Pay Bank
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 7: Bank Balances by Bank (HBL, UBL, Alfalah, Meezan, Other Banks) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Dynamic Bank Balances (HBL, UBL, Alfalah, Meezan & Configured Banks)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Click any bank card to inspect accounts or drill down into transactions
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {(dashboardData.bankGroups || []).map((bg: any) => (
                <Card
                  key={bg.bankName}
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onClick={() => {
                    if (bg.accounts && bg.accounts.length > 0) {
                      openBankDrillDown(bg.accounts[0].id);
                    }
                  }}
                >
                  <CardContent style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--brand-primary, #1e40af)' }}>
                        {bg.bankName}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(30, 64, 175, 0.1)',
                          color: 'var(--brand-primary, #1e40af)',
                          fontWeight: 600,
                        }}
                      >
                        {bg.accountCount || (bg.accounts ? bg.accounts.length : 1)} Acc
                      </span>
                    </div>

                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      PKR {Number(bg.totalBalance || 0).toLocaleString()}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Opening: {Number(bg.totalOpening || 0).toLocaleString()}</span>
                      <span style={{ color: '#10b981' }}>+{Number(bg.totalReceipts || 0).toLocaleString()}</span>
                      <span style={{ color: '#ef4444' }}>-{Number(bg.totalPayments || 0).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Individual Bank Accounts Overview Table */}
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle>Bank Accounts Balance Summary</CardTitle>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Authoritative: Current Balance = Opening Balance + Posted Bank Receipts - Posted Bank Payments
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                startIcon={<IconPlus size={14} />}
                onClick={() => setIsNewAccountModalOpen(true)}
              >
                Add Bank Account
              </Button>
            </CardHeader>
            <CardContent style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Bank</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Account Title</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Account Number</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Opening (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Receipts (+)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Payments (-)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Current Balance (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData.bankAccounts || bankAccounts || []).map((acc: any) => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                          {acc.bankName}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{acc.accountTitle}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                          {acc.accountNumber}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          PKR {Number(acc.openingBalance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          PKR {Number(acc.totalReceipts || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                          PKR {Number(acc.totalPayments || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>
                          PKR {Number(acc.currentBalance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openBankDrillDown(acc.id)}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            Drill-Down Ledger
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: BANK ACCOUNTS MASTER */}
      {activeTab === 'bank-accounts' && (
        <Card>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle>Bank Accounts Master Registry</CardTitle>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Configure and manage all dynamic commercial and Islamic bank accounts with real-time balance calculations.
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              startIcon={<IconPlus size={14} />}
              onClick={() => setIsNewAccountModalOpen(true)}
              style={{ backgroundColor: 'var(--brand-primary, #1e40af)', color: '#fff' }}
            >
              Configure Bank Account
            </Button>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {bankAccounts.length === 0 ? (
              <EmptyState
                title="No Bank Accounts Found"
                description="Click '+ Configure Bank Account' to add a bank account record to the database."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Bank</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Account Title</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Account Number / IBAN</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Branch</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Opening Balance</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Receipts</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Payments</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Authoritative Balance</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((acc) => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                          {acc.bankName}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{acc.accountTitle}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                          <div>{acc.accountNumber}</div>
                          {acc.iban && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.iban}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {acc.branchName || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          PKR {Number(acc.openingBalance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          PKR {Number(acc.totalReceipts || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                          PKR {Number(acc.totalPayments || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>
                          PKR {Number(acc.currentBalance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openBankDrillDown(acc.id)}
                            >
                              Ledger
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              startIcon={<IconPlus size={12} />}
                              onClick={() => handleOpenTxModal('BANK_RECEIPT', acc.id)}
                              style={{ color: '#0284c7' }}
                            >
                              BR
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              startIcon={<IconCreditCard size={12} />}
                              onClick={() => handleOpenTxModal('BANK_PAYMENT', acc.id)}
                              style={{ color: '#d97706' }}
                            >
                              BP
                            </Button>
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
      )}

      {/* TAB 3: COLLECTIONS BREAKDOWN */}
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
                              startIcon={<IconPlus size={12} />}
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
                              Collect
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

      {/* TAB 4: ALL TRANSACTION VOUCHERS */}
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
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Counterparty</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Bank / Desk</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Amount (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Status</th>
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
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{tx.partyName || '-'}</div>
                          {tx.partyType && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.partyType}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {tx.bankAccount ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#0284c7' }}>{tx.bankAccount.bankName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.bankAccount.accountNumber}</div>
                            </div>
                          ) : tx.bankName ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#0284c7' }}>{tx.bankName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.branchName || ''}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Cash Desk (101000)</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontWeight: 800,
                            color:
                              tx.transactionType.includes('RECEIPT') ? '#10b981' : '#ef4444',
                          }}
                        >
                          {tx.transactionType.includes('RECEIPT') ? '+' : '-'}PKR {Number(tx.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <StatusBadge status={tx.status} variant={tx.status === 'POSTED' ? 'success' : tx.status === 'REVERSED' ? 'danger' : 'neutral'}>
                            {tx.status}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {tx.remarks || tx.referenceNumber || '-'}
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

      {/* TAB 5: CASH & BANK REPORTS */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Reports Filter Toolbar */}
          <Card>
            <CardContent style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Period</label>
                  <Select
                    value={reportPeriod}
                    onChange={(e: any) => setReportPeriod(e.target.value)}
                    options={[
                      { label: 'Monthly', value: 'MONTHLY' },
                      { label: 'Daily', value: 'DAILY' },
                      { label: 'Quarterly', value: 'QUARTERLY' },
                      { label: 'Yearly', value: 'YEARLY' },
                      { label: 'Custom Date Range', value: 'CUSTOM' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Bank Filter</label>
                  <Select
                    value={reportBankName}
                    onChange={(e) => setReportBankName(e.target.value)}
                    options={[
                      { label: 'All Banks', value: 'ALL' },
                      { label: 'HBL', value: 'HBL' },
                      { label: 'UBL', value: 'UBL' },
                      { label: 'Bank Alfalah', value: 'Bank Alfalah' },
                      { label: 'Meezan Bank', value: 'Meezan Bank' },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Transaction Type</label>
                  <Select
                    value={reportTxType}
                    onChange={(e) => setReportTxType(e.target.value)}
                    options={[
                      { label: 'All Transactions', value: 'ALL' },
                      { label: 'Cash Receipts', value: 'CASH_RECEIPT' },
                      { label: 'Cash Payments', value: 'CASH_PAYMENT' },
                      { label: 'Bank Receipts', value: 'BANK_RECEIPT' },
                      { label: 'Bank Payments', value: 'BANK_PAYMENT' },
                    ]}
                  />
                </div>

                {reportPeriod === 'CUSTOM' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>From Date</label>
                      <Input
                        type="date"
                        value={reportDateFrom}
                        onChange={(e) => setReportDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>To Date</label>
                      <Input
                        type="date"
                        value={reportDateTo}
                        onChange={(e) => setReportDateTo(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Company</label>
                  <Select
                    value={reportCompanyId}
                    onChange={(e) => setReportCompanyId(e.target.value)}
                    options={[
                      { label: 'All Companies', value: 'ALL' },
                      ...(Array.isArray(companies) ? companies : []).map((c) => ({
                        label: `${c.name} (${c.code})`,
                        value: c.id,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Bank Account</label>
                  <Select
                    value={reportBankAccountId}
                    onChange={(e) => setReportBankAccountId(e.target.value)}
                    options={[
                      { label: 'All Accounts', value: 'ALL' },
                      ...bankAccounts.map((a) => ({
                        label: `${a.bankName} - ${a.accountNumber}`,
                        value: a.id,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Status</label>
                  <Select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value)}
                    options={[
                      { label: 'All Statuses', value: 'ALL' },
                      { label: 'Posted Only', value: 'POSTED' },
                      { label: 'Reversed Only', value: 'REVERSED' },
                    ]}
                  />
                </div>

                <div>
                  <Button
                    variant="primary"
                    startIcon={<IconRefresh size={14} />}
                    onClick={fetchReports}
                    style={{ width: '100%' }}
                  >
                    Run Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isReportsLoading && <TableSkeleton rows={4} />}

          {/* Section 13: Bank-Wise Summary Table */}
          {!isReportsLoading && reportsData && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <KpiCard
                  title="Total Bank Opening"
                  value={`PKR ${Number(reportsData.totalBankOpening || 0).toLocaleString()}`}
                  subtitle="Beginning of period"
                  icon={<IconFinance size={20} />}
                />
                <KpiCard
                  title="Total Bank Receipts"
                  value={`PKR ${Number(reportsData.totalBankReceipts || 0).toLocaleString()}`}
                  subtitle="Collections credited"
                  icon={<IconTrendingUp size={20} />}
                />
                <KpiCard
                  title="Total Bank Payments"
                  value={`PKR ${Number(reportsData.totalBankPayments || 0).toLocaleString()}`}
                  subtitle="Disbursements debited"
                  icon={<IconAlertTriangle size={20} />}
                />
                <KpiCard
                  title="Total Bank Closing Balance"
                  value={`PKR ${Number(reportsData.totalBankClosing || 0).toLocaleString()}`}
                  subtitle="Opening + Receipts - Payments"
                  icon={<IconCreditCard size={20} />}
                />
              </div>

              {/* Bank-Wise Comparison Table */}
              <Card>
                <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>Bank-Wise Balance Summary (HBL, UBL, Alfalah, Meezan & Configured Banks)</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    startIcon={<IconDownload size={14} />}
                    onClick={handleExportBankReportCsv}
                  >
                    Download CSV
                  </Button>
                </CardHeader>
                <CardContent style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Bank Name</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Opening Balance</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Receipts (+)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Payments (-)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Closing Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportsData.bankWiseSummary || []).map((b: any) => (
                          <tr key={b.bankName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                              {b.bankName}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              PKR {Number(b.opening || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                              PKR {Number(b.receipts || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                              PKR {Number(b.payments || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>
                              PKR {Number(b.closing || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {/* TOTAL BANK ROW */}
                        <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border-subtle)', fontWeight: 800 }}>
                          <td style={{ padding: '14px 16px', color: 'var(--brand-primary, #1e40af)', fontSize: '14px' }}>
                            TOTAL BANK BALANCE
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            PKR {Number(reportsData.totalBankOpening || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', color: '#10b981' }}>
                            PKR {Number(reportsData.totalBankReceipts || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ef4444' }}>
                            PKR {Number(reportsData.totalBankPayments || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0284c7', fontSize: '15px' }}>
                            PKR {Number(reportsData.totalBankClosing || 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Desk Summary in Report */}
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: '#10b981' }}>Cash Desk Summary (Account 101000)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cash Opening</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>PKR {Number(reportsData.cashSummary?.opening || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cash Receipts (+)</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>PKR {Number(reportsData.cashSummary?.receipts || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cash Payments (-)</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>PKR {Number(reportsData.cashSummary?.payments || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cash Closing</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>PKR {Number(reportsData.cashSummary?.closing || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 6: SALARY LOGS */}
      {activeTab === 'salary-payments' && (
        <Card>
          <CardContent style={{ padding: 0 }}>
            {salaryPayments.length === 0 ? (
              <EmptyState
                title="No Salary Vouchers Logged"
                description="Click 'Disburse Salary' to record an official payroll disbursement voucher."
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

            {/* Dynamic Bank Account Selector for Bank Receipt and Bank Payment */}
            {(modalTxType === 'BANK_RECEIPT' || modalTxType === 'BANK_PAYMENT') && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Select Bank Account *
                </label>
                <Select
                  value={txForm.bankAccountId}
                  onChange={(e) => {
                    const acc = bankAccounts.find((a) => a.id === e.target.value);
                    setTxForm({
                      ...txForm,
                      bankAccountId: e.target.value,
                      bankName: acc ? acc.bankName : '',
                      branchName: acc ? acc.branchName || '' : '',
                    });
                  }}
                  options={[
                    { label: '-- Select Bank Account --', value: '' },
                    ...bankAccounts.map((a) => ({
                      label: `${a.bankName} - ${a.accountTitle} (${a.accountNumber}) | Current Bal: PKR ${Number(a.currentBalance || 0).toLocaleString()}`,
                      value: a.id,
                    })),
                  ]}
                />
                {txForm.bankAccountId && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(2, 132, 199, 0.08)',
                      border: '1px solid rgba(2, 132, 199, 0.2)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      Selected: <strong>{txForm.bankName}</strong> ({txForm.branchName || 'Main Branch'})
                    </span>
                    <span>
                      Current Balance:{' '}
                      <strong style={{ color: '#0284c7' }}>
                        PKR{' '}
                        {Number(
                          bankAccounts.find((a) => a.id === txForm.bankAccountId)?.currentBalance || 0
                        ).toLocaleString()}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

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

      {/* MODAL 2: BANK DRILL-DOWN LEDGER MODAL */}
      <Modal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        title={drillDownData?.account ? `${drillDownData.account.bankName} - ${drillDownData.account.accountTitle}` : 'Bank Account Drill-Down Ledger'}
        description={`Account #: ${drillDownData?.account?.accountNumber || ''} | Branch: ${drillDownData?.account?.branchName || 'Main'}`}
        size="xl"
      >
        {drillDownLoading ? (
          <TableSkeleton rows={5} />
        ) : drillDownData?.account ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Opening Balance</div>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>
                  PKR {Number(drillDownData.account.periodOpeningBalance ?? drillDownData.account.initialOpeningBalance ?? 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Receipts (+)</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
                  PKR {Number(drillDownData.account.periodReceipts ?? drillDownData.account.lifetimeReceipts ?? 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Payments (-)</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>
                  PKR {Number(drillDownData.account.periodPayments ?? drillDownData.account.lifetimePayments ?? 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>Authoritative Current Balance</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7' }}>
                  PKR {Number(drillDownData.account.lifetimeCurrentBalance ?? drillDownData.account.periodClosingBalance ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Date Range Filter for Ledger */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Input
                  type="date"
                  value={drillDownDateFrom}
                  onChange={(e) => setDrillDownDateFrom(e.target.value)}
                  placeholder="From"
                  style={{ width: '150px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                <Input
                  type="date"
                  value={drillDownDateTo}
                  onChange={(e) => setDrillDownDateTo(e.target.value)}
                  placeholder="To"
                  style={{ width: '150px' }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => selectedAccountId && openBankDrillDown(selectedAccountId, drillDownDateFrom, drillDownDateTo)}
                >
                  Filter
                </Button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  startIcon={<IconDownload size={14} />}
                  onClick={handleExportLedgerCsv}
                >
                  Export Ledger CSV
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsDrillDownOpen(false);
                    handleOpenTxModal('BANK_RECEIPT', drillDownData.account.id);
                  }}
                  style={{ backgroundColor: '#0284c7', color: '#fff' }}
                >
                  + New Bank Receipt
                </Button>
              </div>
            </div>

            {/* Chronological Running Balance Ledger Table */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Voucher / Ref</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Received From / Paid To</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Debit (+)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Credit (-)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Running Balance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(drillDownData.transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No transactions recorded for this account.
                      </td>
                    </tr>
                  ) : (
                    (drillDownData.transactions || []).map((row: any) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(row.date).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: row.transactionType === 'BANK_RECEIPT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: row.transactionType === 'BANK_RECEIPT' ? '#10b981' : '#ef4444',
                            }}
                          >
                            {row.transactionType === 'BANK_RECEIPT' ? 'BR (+)' : 'BP (-)'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                          {row.voucherNumber}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{row.partyName || '-'}</div>
                          {row.remarks && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.remarks}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          {row.debit > 0 ? `PKR ${row.debit.toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                          {row.credit > 0 ? `PKR ${row.credit.toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                          PKR {Number(row.runningBalance).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <StatusBadge status={row.status} variant="success">{row.status}</StatusBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* MODAL 3: CONFIGURE NEW BANK ACCOUNT */}
      <Modal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
        title="Configure New Bank Account"
        description="Dynamic Bank Master registry supporting multiple accounts under any bank (HBL, UBL, Alfalah, Meezan, etc.)"
        size="lg"
      >
        <form onSubmit={handleCreateBankAccount}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Operating Company *
              </label>
              <Select
                value={newAccountForm.companyId}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, companyId: e.target.value })}
                options={(Array.isArray(companies) ? companies : []).map((c) => ({
                  label: `${c.name} (${c.code})`,
                  value: c.id,
                }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Bank Name *
              </label>
              <Input
                required
                placeholder="e.g. HBL / UBL / Bank Alfalah / Meezan Bank"
                value={newAccountForm.bankName}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, bankName: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Account Title *
              </label>
              <Input
                required
                placeholder="e.g. Shehswar Corporate Business"
                value={newAccountForm.accountTitle}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, accountTitle: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Account Number *
              </label>
              <Input
                required
                placeholder="e.g. PK00HABB0012345678901"
                value={newAccountForm.accountNumber}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, accountNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Branch Name
              </label>
              <Input
                placeholder="e.g. Main Corporate Branch, Multan"
                value={newAccountForm.branchName}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, branchName: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Opening Balance (PKR)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 5000000"
                value={newAccountForm.openingBalance}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, openingBalance: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                IBAN (Optional)
              </label>
              <Input
                placeholder="e.g. PK98MEZN000123456789"
                value={newAccountForm.iban}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, iban: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Currency
              </label>
              <Input
                value={newAccountForm.currency}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, currency: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Notes / Instructions
            </label>
            <Textarea
              value={newAccountForm.notes}
              onChange={(e) => setNewAccountForm({ ...newAccountForm, notes: e.target.value })}
              rows={2}
              placeholder="Designated usage, authorized signatories, etc."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsNewAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" style={{ backgroundColor: 'var(--brand-primary, #1e40af)', color: '#fff' }}>
              Save Bank Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: DISBURSE EMPLOYEE SALARY */}
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
