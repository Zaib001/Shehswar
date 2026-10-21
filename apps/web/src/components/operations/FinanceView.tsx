'use client';

/**
 * SHEHSWAR ONE360 - Financial Management & Accounting Control View
 *
 * Implements real-time transaction-driven accounting:
 * - Balance Sheet (Assets = Liabilities + Equity)
 * - Profit & Loss (Revenue - COGS - Expenses = Net Profit)
 * - General Ledger (Authoritative Double-Entry Journal Entries)
 * - Chart of Accounts Master
 * - Operating Expense Entry
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useAuth } from '../../context/auth-context';
import { useToast } from '../../context/toast-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  TableSkeleton,
  EmptyState,
  Modal,
} from '../ui';
import {
  IconRefresh,
  IconPlus,
  IconDownload,
  IconCheck,
} from '../icons';
import {
  exportBalanceSheetToPdf,
  exportProfitLossToPdf,
  exportGeneralLedgerToPdf,
} from '../../lib/pdf-export';

export const FinanceView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'balance-sheet' | 'profit-loss' | 'general-ledger' | 'accounts' | 'expenses'>('balance-sheet');
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('ALL');
  const [companies, setCompanies] = useState<any[]>([]);

  // Filter States
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Data States
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [profitAndLoss, setProfitAndLoss] = useState<any>(null);
  const [generalLedger, setGeneralLedger] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expenseAccountCode: '601000',
    paymentAccountCode: '101000',
    amount: '',
    payee: '',
    referenceNumber: '',
    description: '',
    category: 'OPERATING',
    expenseDate: new Date().toISOString().split('T')[0],
  });

  // Load Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await ApiClient.get<any>('/api/v1/master-data/companies?all=true');
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        setCompanies(list);
      } catch {
        // keep fallback
      }
    };
    fetchCompanies();
  }, [user]);

  // Fetch Active Tab Data
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      if (activeTab === 'balance-sheet') {
        const res = await ApiClient.get<any>(`/api/v1/finance/balance-sheet?companyId=${companyId}&asOfDate=${asOfDate}`);
        setBalanceSheet((res as any)?.data || res);
      } else if (activeTab === 'profit-loss') {
        const res = await ApiClient.get<any>(`/api/v1/finance/profit-loss?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`);
        setProfitAndLoss((res as any)?.data || res);
      } else if (activeTab === 'general-ledger') {
        const res = await ApiClient.get<any>(`/api/v1/finance/general-ledger?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`);
        setGeneralLedger((res as any)?.data || res);
      } else if (activeTab === 'accounts') {
        const res = await ApiClient.get<any[]>(`/api/v1/finance/accounts?companyId=${companyId}`);
        setAccounts((res as any)?.data || res || []);
      } else if (activeTab === 'expenses') {
        const res = await ApiClient.get<any[]>(`/api/v1/finance/expenses?companyId=${companyId}`);
        setExpenses((res as any)?.data || res || []);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to load financial data' });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, asOfDate, startDate, endDate, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      showToast({ type: 'warning', title: 'Please enter a valid expense amount' });
      return;
    }
    try {
      await ApiClient.post('/api/v1/finance/expenses', {
        ...expenseForm,
        companyId,
        amount: Number(expenseForm.amount),
      });
      showToast({ type: 'success', title: 'Operating expense successfully posted to General Ledger!' });
      setIsExpenseModalOpen(false);
      setExpenseForm({
        expenseAccountCode: '601000',
        paymentAccountCode: '101000',
        amount: '',
        payee: '',
        referenceNumber: '',
        description: '',
        category: 'OPERATING',
        expenseDate: new Date().toISOString().slice(0, 10),
      });
      fetchData();
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to record expense' });
    }
  };

  const formatPKR = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `PKR ${num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const currentCompanyName = companyId === 'ALL'
    ? 'Shehswar Chemicals Group (Consolidated)'
    : (companies.find((c) => c.id === companyId)?.name || 'Shehswar Chemicals');

  const glEntries: any[] = Array.isArray(generalLedger)
    ? generalLedger
    : (generalLedger?.entries || generalLedger?.data || []);

  const handleExportBalanceSheetPdf = () => {
    if (!balanceSheet) return;
    exportBalanceSheetToPdf({
      companyName: currentCompanyName,
      asOfDate,
      data: balanceSheet,
    });
  };

  const handleExportProfitLossPdf = () => {
    if (!profitAndLoss) return;
    exportProfitLossToPdf({
      companyName: currentCompanyName,
      period: `${startDate} to ${endDate}`,
      startDate,
      endDate,
      data: profitAndLoss,
    });
  };

  const handleExportGeneralLedgerPdf = () => {
    if (!glEntries || glEntries.length === 0) return;
    exportGeneralLedgerToPdf({
      companyName: currentCompanyName,
      startDate,
      endDate,
      entries: glEntries,
    });
  };

  const handleExportCurrentTabPdf = () => {
    if (activeTab === 'balance-sheet') handleExportBalanceSheetPdf();
    else if (activeTab === 'profit-loss') handleExportProfitLossPdf();
    else if (activeTab === 'general-ledger') handleExportGeneralLedgerPdf();
    else window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Financial Control & General Ledger
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Authoritative double-entry financial reporting directly derived from posted transactions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {companies.length > 0 && (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <option value="ALL">All Companies (Consolidated Group)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" onClick={handleExportCurrentTabPdf} disabled={loading}>
            <IconDownload size={14} /> Download PDF Report
          </Button>

          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <IconRefresh size={14} /> Refresh
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsExpenseModalOpen(true)}>
            <IconPlus size={14} /> Record Expense
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px' }}>
        {[
          { id: 'balance-sheet', label: 'Balance Sheet' },
          { id: 'profit-loss', label: 'Profit & Loss (P&L)' },
          { id: 'general-ledger', label: 'General Ledger' },
          { id: 'accounts', label: 'Chart of Accounts' },
          { id: 'expenses', label: 'Operating Expenses' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. BALANCE SHEET TAB */}
      {activeTab === 'balance-sheet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>As of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
              {balanceSheet?.isBalanced !== undefined && (
                <Badge variant={balanceSheet.isBalanced ? 'success' : 'danger'}>
                  {balanceSheet.isBalanced ? 'Equation Balanced (Assets = Liabilities + Equity)' : 'Imbalance Detected'}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBalanceSheetPdf}
              disabled={!balanceSheet || loading}
            >
              <IconDownload size={14} /> Download Balance Sheet PDF
            </Button>
          </div>

          {loading ? (
            <TableSkeleton columns={4} rows={6} />
          ) : !balanceSheet ? (
            <EmptyState title="No Balance Sheet Data" description="No posted financial transactions found for this period." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-lg)' }}>
              {/* ASSETS COLUMN */}
              <Card>
                <CardHeader>
                  <CardTitle>1. ASSETS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                      Current Assets
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>101000/102000 - Cash & Bank Balances</span>
                      <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentAssets?.cashAndBank)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>103000 - Accounts Receivable (Trade Debtors)</span>
                      <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentAssets?.accountsReceivable)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>104000/105000 - Commercial Finished Goods & Raw Inventory</span>
                      <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentAssets?.inventory)}</span>
                    </div>
                    {Number(balanceSheet.currentAssets?.otherAssets || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>Advances & Other Current Assets</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentAssets?.otherAssets)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                      <span>Total Current Assets</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatPKR(balanceSheet.currentAssets?.total)}</span>
                    </div>

                    <div style={{ fontWeight: 700, color: 'var(--color-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginTop: '10px' }}>
                      Non-Current Assets
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>Property, Plant & Equipment (Fixed Assets)</span>
                      <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.nonCurrentAssets?.fixedAssets)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                      <span>Total Non-Current Assets</span>
                      <span>{formatPKR(balanceSheet.nonCurrentAssets?.total)}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        borderTop: '2px solid var(--border-default)',
                        paddingTop: '10px',
                        fontSize: 'var(--font-size-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <span>TOTAL ASSETS (A)</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatPKR(balanceSheet.totalAssets)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* LIABILITIES & EQUITY COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>2. LIABILITIES</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#DC2626', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                        Current Liabilities
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>201000 - Accounts Payable (Trade Creditors)</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentLiabilities?.accountsPayable)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>202000 - Sales Tax Payable (STRN)</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentLiabilities?.taxesPayable)}</span>
                      </div>
                      {Number(balanceSheet.currentLiabilities?.otherLiabilities || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                          <span>Accruals & Other Liabilities</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.currentLiabilities?.otherLiabilities)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                        <span>Total Liabilities (B)</span>
                        <span style={{ color: '#DC2626' }}>{formatPKR(balanceSheet.totalLiabilities)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>3. SHAREHOLDERS' EQUITY</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>301000 - Share Capital / Paid-Up Equity</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.equity?.shareCapital)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>302000 - Retained Earnings</span>
                        <span style={{ fontWeight: 600 }}>{formatPKR(balanceSheet.equity?.retainedEarnings)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                        <span>Current Financial Period Net Earnings</span>
                        <span style={{ fontWeight: 700, color: Number(balanceSheet.equity?.currentPeriodProfit || 0) >= 0 ? '#16A34A' : '#DC2626' }}>
                          {formatPKR(balanceSheet.equity?.currentPeriodProfit)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                        <span>Total Shareholders' Equity (C)</span>
                        <span style={{ color: '#0369a1' }}>{formatPKR(balanceSheet.equity?.total)}</span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          borderTop: '2px solid var(--border-default)',
                          paddingTop: '10px',
                          fontSize: 'var(--font-size-md)',
                          backgroundColor: 'var(--bg-subtle)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <span>TOTAL LIABILITIES & EQUITY (B + C)</span>
                        <span style={{ color: '#16A34A' }}>{formatPKR(balanceSheet.totalLiabilitiesAndEquity)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PROFIT & LOSS TAB */}
      {activeTab === 'profit-loss' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportProfitLossPdf}
              disabled={!profitAndLoss || loading}
            >
              <IconDownload size={14} /> Download P&L Statement PDF
            </Button>
          </div>

          {loading ? (
            <TableSkeleton columns={3} rows={6} />
          ) : !profitAndLoss ? (
            <EmptyState title="No P&L Data" description="No sales or expense transactions recorded in this period." />
          ) : (
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                  <CardTitle>STATEMENT OF PROFIT & LOSS ({currentCompanyName})</CardTitle>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    Period: {profitAndLoss.period || `${startDate} to ${endDate}`}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Revenue Section */}
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    1. OPERATING REVENUE
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>401000 - Gross Commercial Sales Revenue</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.revenue?.grossSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                    <span>402000 - Less: Sales Discounts & Rebates</span>
                    <span>({formatPKR(profitAndLoss.revenue?.discounts)})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                    <span>Net Commercial Sales Revenue</span>
                    <span style={{ color: 'var(--color-primary)' }}>{formatPKR(profitAndLoss.revenue?.netSales)}</span>
                  </div>

                  {/* COGS Section */}
                  <div style={{ fontWeight: 700, color: '#EA580C', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginTop: '8px' }}>
                    2. COST OF GOODS SOLD (COGS)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>501000 - Direct Cost of Commercial Formulations & Bottling</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.costOfGoodsSold?.cogs)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                    <span>Total Cost of Goods Sold</span>
                    <span style={{ color: '#EA580C' }}>({formatPKR(profitAndLoss.costOfGoodsSold?.cogs)})</span>
                  </div>

                  {/* Gross Profit */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-md)',
                    }}
                  >
                    <span>GROSS PROFIT ({Number(profitAndLoss.grossMarginPercent || 0).toFixed(1)}% Margin)</span>
                    <span style={{ color: Number(profitAndLoss.grossProfit) >= 0 ? '#16A34A' : '#DC2626' }}>
                      {formatPKR(profitAndLoss.grossProfit)}
                    </span>
                  </div>

                  {/* Operating Expenses */}
                  <div style={{ fontWeight: 700, color: '#DC2626', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginTop: '8px' }}>
                    3. OPERATING & ADMINISTRATIVE EXPENSES
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>601000 - General & Administrative Overheads</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.operatingExpenses?.administrative)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>602000 - Selling & Distribution Expenses</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.operatingExpenses?.sellingAndDistribution)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>603000 - Field Marketing & Scheme Expenses</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.operatingExpenses?.marketingAndSchemes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                    <span>604000/605000 - Freight, Utilities & Other Charges</span>
                    <span style={{ fontWeight: 600 }}>{formatPKR(profitAndLoss.operatingExpenses?.otherExpenses)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                    <span>Total Operating Expenses</span>
                    <span style={{ color: '#DC2626' }}>({formatPKR(profitAndLoss.operatingExpenses?.total)})</span>
                  </div>

                  {/* Operating Profit */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      backgroundColor: 'rgba(0,0,0,0.02)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span>OPERATING PROFIT BEFORE TAX (EBIT)</span>
                    <span style={{ color: Number(profitAndLoss.operatingProfit) >= 0 ? '#16A34A' : '#DC2626' }}>
                      {formatPKR(profitAndLoss.operatingProfit)}
                    </span>
                  </div>

                  {/* Net Profit / Loss */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      backgroundColor: Number(profitAndLoss.netProfit) >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-lg)',
                      border: `1px solid ${Number(profitAndLoss.netProfit) >= 0 ? '#16A34A' : '#DC2626'}`,
                    }}
                  >
                    <span>NET PROFIT / (LOSS) ({Number(profitAndLoss.netMarginPercent || 0).toFixed(1)}% Net Margin)</span>
                    <span style={{ color: Number(profitAndLoss.netProfit) >= 0 ? '#16A34A' : '#DC2626' }}>
                      {formatPKR(profitAndLoss.netProfit)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 3. GENERAL LEDGER TAB */}
      {activeTab === 'general-ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                ({glEntries.length} Posted Vouchers)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportGeneralLedgerPdf}
              disabled={glEntries.length === 0 || loading}
            >
              <IconDownload size={14} /> Download General Ledger PDF
            </Button>
          </div>

          {loading ? (
            <TableSkeleton columns={6} rows={8} />
          ) : glEntries.length === 0 ? (
            <EmptyState title="No Journal Entries" description="No double-entry transactions posted yet for this period." />
          ) : (
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Company</th>
                    <th style={{ padding: '10px 12px' }}>Voucher / JV #</th>
                    <th style={{ padding: '10px 12px' }}>Source Type</th>
                    <th style={{ padding: '10px 12px' }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Debit</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Credit</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Balanced</th>
                  </tr>
                </thead>
                <tbody>
                  {glEntries.map((entry: any) => (
                    <React.Fragment key={entry.id}>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                        <td style={{ padding: '8px 12px' }}>{new Date(entry.entryDate).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e3a8a', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                            {entry.company?.name || entry.company?.code || 'Group Parent'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-primary)' }}>{entry.entryNumber}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <Badge variant="secondary">{entry.sourceType}</Badge>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{entry.description}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPKR(entry.totalDebit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPKR(entry.totalCredit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <IconCheck size={14} style={{ color: '#16A34A', display: 'inline' }} />
                        </td>
                      </tr>
                      {/* Lines Breakdown */}
                      {(entry.lines || []).map((line: any) => (
                        <tr key={line.id} style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <td></td>
                          <td></td>
                          <td style={{ paddingLeft: '24px' }}>└ {line.account?.accountCode || line.accountId}</td>
                          <td colSpan={2}>{line.account?.accountName || line.description}</td>
                          <td style={{ textAlign: 'right', padding: '4px 12px' }}>
                            {Number(line.debit) > 0 ? formatPKR(line.debit) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '4px 12px' }}>
                            {Number(line.credit) > 0 ? formatPKR(line.credit) : '-'}
                          </td>
                          <td></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: 800, borderTop: '2px solid var(--border-default)' }}>
                    <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right' }}>CUMULATIVE GENERAL LEDGER TOTALS:</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-primary)' }}>
                      {formatPKR(glEntries.reduce((s: number, e: any) => s + Number(e.totalDebit || 0), 0))}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-primary)' }}>
                      {formatPKR(glEntries.reduce((s: number, e: any) => s + Number(e.totalCredit || 0), 0))}
                    </td>
                    <td style={{ textAlign: 'center', color: '#16A34A' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <IconCheck size={12} /> Balanced
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. CHART OF ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <Card>
          <CardHeader>
            <CardTitle>STANDARD CHART OF ACCOUNTS MASTER</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={5} rows={10} />
            ) : accounts.length === 0 ? (
              <EmptyState title="No Accounts Found" description="Accounts will be provisioned on first transaction." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Account Code</th>
                      <th style={{ padding: '10px 12px' }}>Account Name</th>
                      <th style={{ padding: '10px 12px' }}>Classification</th>
                      <th style={{ padding: '10px 12px' }}>Category</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>{acc.accountCode}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{acc.accountName}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge
                            variant={
                              acc.accountType === 'ASSET'
                                ? 'primary'
                                : acc.accountType === 'LIABILITY'
                                ? 'danger'
                                : acc.accountType === 'REVENUE'
                                ? 'success'
                                : 'warning'
                            }
                          >
                            {acc.accountType}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{acc.category}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {formatPKR(acc.currentBalance)}
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

      {/* 5. OPERATING EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <Card>
          <CardHeader>
            <CardTitle>OPERATING EXPENSES AUDIT</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={6} rows={6} />
            ) : expenses.length === 0 ? (
              <EmptyState title="No Expenses Recorded" description="Click 'Record Expense' to log an operational expense." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Voucher #</th>
                      <th style={{ padding: '10px 12px' }}>Expense Account</th>
                      <th style={{ padding: '10px 12px' }}>Payee</th>
                      <th style={{ padding: '10px 12px' }}>Category</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>{exp.voucherNumber}</td>
                        <td style={{ padding: '10px 12px' }}>{exp.expenseAccount?.accountName || 'Operating Expense'}</td>
                        <td style={{ padding: '10px 12px' }}>{exp.payee || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="secondary">{exp.category}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                          {formatPKR(exp.amount)}
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

      {/* RECORD EXPENSE MODAL */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Operating Expense"
      >
        <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Expense Account (Debit)</label>
            <select
              value={expenseForm.expenseAccountCode}
              onChange={(e) => setExpenseForm({ ...expenseForm, expenseAccountCode: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}
            >
              <option value="601000">601000 - General & Administrative Expenses</option>
              <option value="602000">602000 - Selling & Distribution Expenses</option>
              <option value="603000">603000 - Marketing & Field Schemes Expenses</option>
              <option value="604000">604000 - Freight & Transportation Charges</option>
              <option value="605000">605000 - Utilities & Communication Expenses</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Payment Method (Credit)</label>
            <select
              value={expenseForm.paymentAccountCode}
              onChange={(e) => setExpenseForm({ ...expenseForm, paymentAccountCode: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}
            >
              <option value="101000">101000 - Cash on Hand</option>
              <option value="102000">102000 - Operating Bank Account</option>
              <option value="201000">201000 - Accounts Payable (Trade Creditors)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Amount (PKR) *</label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Expense Date</label>
              <Input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Payee / Vendor</label>
              <Input
                placeholder="e.g. Lahore Electric Supply"
                value={expenseForm.payee}
                onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Ref / Bill Number</label>
              <Input
                placeholder="e.g. INV-9921"
                value={expenseForm.referenceNumber}
                onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Description</label>
            <Input
              placeholder="e.g. Electricity bill for September manufacturing operations"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Post to General Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
