'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  IconCheck,
  IconEye,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { SourceDocumentDrillDownModal } from './SourceDocumentDrillDownModal';

export interface PurchaseCashPaymentsViewProps {
  activeCompanyId?: string;
  activeCompanyName?: string;
  user?: any;
}

export interface CashPaymentRecord {
  id: string;
  voucherNumber: string;
  transactionDate: string;
  partyType?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
  head: string;
  account?: { id: string; accountCode: string; accountName: string };
  contraAccount?: { id: string; accountCode: string; accountName: string };
  company?: { id: string; code: string; name: string };
}

export interface HeadSummaryItem {
  head: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

const DEFAULT_HEADS = [
  'Purchase',
  'Car Repairing',
  'Vehicle Expense',
  'Building Expense',
  'Dealer Refund',
  'General Liability',
  'Other',
];

const unpackArray = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.items)) return res.data.items;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data?.rows)) return res.data.rows;
  if (Array.isArray(res.rows)) return res.rows;
  return [];
};

const normalizeVendor = (v: any) => ({
  id: v.id,
  code: v.code || '',
  name: v.name || v.legalName || v.vendorName || 'Unnamed Vendor',
});

export const PurchaseCashPaymentsView: React.FC<PurchaseCashPaymentsViewProps> = ({
  activeCompanyId,
  activeCompanyName: _activeCompanyName,
  user: _user,
}) => {
  const { showToast } = useToast();

  // Data & State
  const [payments, setPayments] = useState<CashPaymentRecord[]>([]);
  const [headSummary, setHeadSummary] = useState<HeadSummaryItem[]>([]);
  const [totalCashPaid, setTotalCashPaid] = useState<number>(0);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Entities for Party selectors
  const [vendors, setVendors] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // Filters & Reporting
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [headFilter, setHeadFilter] = useState<string>('ALL');
  const [partyTypeFilter, setPartyTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Cash Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [nextVoucherNo, setNextVoucherNo] = useState<string>('CP-AUTO');

  // Form Fields (Strictly Cash Only)
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formPartyType, setFormPartyType] = useState<'VENDOR' | 'EMPLOYEE' | 'DEALER' | 'OTHER'>('VENDOR');
  const [formPartyId, setFormPartyId] = useState<string>('');
  const [formPartyName, setFormPartyName] = useState<string>('');
  const [formHead, setFormHead] = useState<string>('Purchase');
  const [customHead, setCustomHead] = useState<string>('');
  const [formCashPaid, setFormCashPaid] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formReferenceNumber, setFormReferenceNumber] = useState<string>('');

  // Drill-Down Modal
  const [drillDownDoc, setDrillDownDoc] = useState<{
    isOpen: boolean;
    sourceType?: string;
    sourceId?: string;
    voucherNumber?: string;
  }>({ isOpen: false });

  // Handle Preset Changes
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM') => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(last.toISOString().slice(0, 10));
    } else if (preset === 'YEAR') {
      const first = new Date(today.getFullYear(), 0, 1);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    }
  };

  // Load Transactions & Summary
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (activeCompanyId) query.set('companyId', activeCompanyId);
      if (fromDate) query.set('fromDate', fromDate);
      if (toDate) query.set('toDate', toDate);
      if (headFilter && headFilter !== 'ALL') query.set('head', headFilter);
      if (partyTypeFilter && partyTypeFilter !== 'ALL') query.set('partyType', partyTypeFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const res = await ApiClient.get<any>(`/api/v1/financial-transactions/cash-payments-report?${query.toString()}`);
      const data = res.data?.data || res.data || {};

      setPayments(data.transactions || []);
      setHeadSummary(data.headSummary || []);
      setTotalCashPaid(Number(data.totalCashPaid || 0));
      setTotalTransactions(Number(data.totalTransactions || 0));
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to load cash payments report', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId, fromDate, toDate, headFilter, partyTypeFilter, searchQuery, showToast]);

  // Load Master Data for Form
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const [vRes, dRes, eRes, poRes] = await Promise.all([
          ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000')
            .catch(() => ApiClient.get<any>('/api/v1/vendors'))
            .catch(() => ({ data: [] })),
          ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
          ApiClient.get<any>('/api/v1/master-data/employees').catch(() => ({ data: [] })),
          ApiClient.get<any>('/api/v1/operations/purchase-orders').catch(() => ({ data: [] })),
        ]);

        const vList = unpackArray(vRes).map(normalizeVendor);
        const dList = unpackArray(dRes).map((d: any) => ({
          id: d.id,
          code: d.code || '',
          name: d.name || d.dealerName || 'Dealer',
        }));
        const eList = unpackArray(eRes).map((e: any) => ({
          id: e.id,
          employeeCode: e.employeeCode || e.code || '',
          fullName: e.fullName || e.name || 'Employee',
        }));
        const poList = unpackArray(poRes);

        setVendors(vList);
        setDealers(dList);
        setEmployees(eList);
        setPurchaseOrders(poList);
      } catch {
        // silent fail
      }
    };
    fetchEntities();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open New Cash Payment Modal
  const handleOpenNewModal = async () => {
    try {
      const q = activeCompanyId ? `?companyId=${activeCompanyId}&type=CASH_PAYMENT` : '?type=CASH_PAYMENT';
      const res = await ApiClient.get<any>(`/api/v1/financial-transactions/next-voucher${q}`);
      setNextVoucherNo(res.data?.voucherNumber || 'CP-00001');
    } catch {
      setNextVoucherNo('CP-AUTO');
    }

    let activeVendors = vendors;
    if (activeVendors.length === 0) {
      try {
        const vRes = await ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000')
          .catch(() => ApiClient.get<any>('/api/v1/vendors'))
          .catch(() => null);
        const unpacked = unpackArray(vRes).map(normalizeVendor);
        if (unpacked.length > 0) {
          activeVendors = unpacked;
          setVendors(unpacked);
        }
      } catch {
        // silent
      }
    }

    setFormDate(new Date().toISOString().slice(0, 10));
    setFormPartyType('VENDOR');
    setFormPartyId(activeVendors[0]?.id || '');
    setFormPartyName(activeVendors[0]?.name || '');
    setFormHead('Purchase');
    setCustomHead('');
    setFormCashPaid('');
    setFormDescription('');
    setFormReferenceNumber('');
    setIsModalOpen(true);
  };

  // Sync party name when ID changes
  const handlePartyIdChange = (id: string) => {
    setFormPartyId(id);
    if (formPartyType === 'VENDOR') {
      const v = vendors.find((item) => item.id === id);
      if (v) setFormPartyName(v.name || v.code || '');
    } else if (formPartyType === 'DEALER') {
      const d = dealers.find((item) => item.id === id);
      if (d) setFormPartyName(d.name || d.code || '');
    } else if (formPartyType === 'EMPLOYEE') {
      const e = employees.find((item) => item.id === id);
      if (e) setFormPartyName(e.fullName || e.name || e.employeeCode || '');
    }
  };

  // Sync Party Type change
  const handlePartyTypeChange = (type: 'VENDOR' | 'EMPLOYEE' | 'DEALER' | 'OTHER') => {
    setFormPartyType(type);
    setFormPartyId('');
    setFormPartyName('');

    if (type === 'VENDOR') {
      if (vendors.length > 0) {
        setFormPartyId(vendors[0].id);
        setFormPartyName(vendors[0].name || vendors[0].code || '');
      }
      setFormHead('Purchase');
    } else if (type === 'DEALER') {
      if (dealers.length > 0) {
        setFormPartyId(dealers[0].id);
        setFormPartyName(dealers[0].name || dealers[0].code || '');
      }
      setFormHead('Dealer Refund');
    } else if (type === 'EMPLOYEE') {
      if (employees.length > 0) {
        setFormPartyId(employees[0].id);
        setFormPartyName(employees[0].fullName || employees[0].name || employees[0].employeeCode || '');
      }
      setFormHead('Vehicle Expense');
    } else {
      setFormHead('General Liability');
    }
  };

  // Optional Link to Purchase Order
  const handleLinkPo = (poNumber: string) => {
    setFormReferenceNumber(poNumber);
    const matchedPo = purchaseOrders.find((p) => p.poNumber === poNumber);
    if (matchedPo) {
      if (matchedPo.vendorId || matchedPo.vendor?.id) {
        setFormPartyType('VENDOR');
        setFormPartyId(matchedPo.vendorId || matchedPo.vendor.id);
        setFormPartyName(matchedPo.vendor?.name || '');
      }
      if (matchedPo.totalAmount && !formCashPaid) {
        setFormCashPaid(String(matchedPo.totalAmount));
      }
      setFormDescription((prev) => prev || `Cash payment against Purchase Order ${poNumber}`);
    }
  };

  // Save Cash Payment (Strictly Cash Only)
  const handleSavePayment = async () => {
    const amountNum = parseFloat(formCashPaid.replace(/,/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ title: 'Validation', message: 'Please enter a valid Cash Paid amount (PKR > 0)', type: 'error' });
      return;
    }

    const effectivePartyName = formPartyType === 'OTHER' ? formPartyName.trim() : formPartyName;
    if (!effectivePartyName && !formPartyId) {
      showToast({ title: 'Validation', message: 'Please select or enter the payee (Paid To)', type: 'error' });
      return;
    }

    const effectiveHead = (formHead === 'Other' && customHead.trim()) ? customHead.trim() : formHead;
    if (!effectiveHead) {
      showToast({ title: 'Validation', message: 'Please select or enter a Payment Head', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        companyId: activeCompanyId,
        voucherNumber: nextVoucherNo !== 'CP-AUTO' ? nextVoucherNo : undefined,
        transactionDate: formDate,
        partyType: formPartyType,
        partyId: formPartyId || undefined,
        partyName: effectivePartyName,
        head: effectiveHead,
        amount: amountNum,
        paymentMethod: 'CASH',
        referenceNumber: formReferenceNumber.trim() || undefined,
        remarks: formDescription.trim() || undefined,
      };

      await ApiClient.post('/api/v1/financial-transactions/cash-payment', payload);

      showToast({
        title: 'Cash Payment Recorded',
        message: `Successfully posted ${nextVoucherNo} for PKR ${amountNum.toLocaleString()}. Cash balance and ledger updated.`,
        type: 'success',
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to record cash payment', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Render
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '18px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>💵</span>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              Cash Payments &amp; Liability Management
            </h1>
            <Badge variant="success">Strictly Cash Only</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Record cash disbursements, supplier payments, and liability heads with real-time GL and vendor ledger integration.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button variant="secondary" onClick={loadData} icon={<IconRefresh size={16} />}>
            Refresh
          </Button>
          <Button variant="primary" onClick={handleOpenNewModal} icon={<IconPlus size={16} />}>
            New Cash Payment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        <Card style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
          <CardContent style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Cash Paid (Period)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#14532d', marginTop: '6px' }}>
              PKR {totalCashPaid.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
              From GL Cash Account (101000)
            </div>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <CardContent style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Cash Vouchers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              {totalTransactions}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Authorized Cash Payment entries
            </div>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <CardContent style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Top Expenditure Head
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a', marginTop: '6px' }}>
              {headSummary[0]?.head || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px' }}>
              {headSummary[0] ? `PKR ${headSummary[0].totalAmount.toLocaleString()} (${headSummary[0].percentage}%)` : 'No data in range'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Head-Based Reporting & Audit Breakdown (Requirement 7) */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
            <div>
              <CardTitle>Head-Based Reporting &amp; Audit</CardTitle>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Breakdown of cash disbursements by Head for monthly and yearly audit compliance.
              </div>
            </div>

            {/* Date Preset Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['ALL', 'TODAY', 'MONTH', 'LAST_MONTH', 'YEAR'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyDatePreset(preset)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: datePreset === preset ? '#0284c7' : '#e2e8f0',
                    backgroundColor: datePreset === preset ? '#e0f2fe' : '#ffffff',
                    color: datePreset === preset ? '#0369a1' : '#475569',
                  }}
                >
                  {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'MONTH' ? 'This Month' : preset === 'LAST_MONTH' ? 'Last Month' : 'This Year'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filter Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '18px',
              border: '1px solid #f1f5f9',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                From Date
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                To Date
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Filter Head
              </label>
              <Select
                value={headFilter}
                onChange={(e) => setHeadFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Heads' },
                  ...DEFAULT_HEADS.map((h) => ({ value: h, label: h })),
                  ...headSummary
                    .filter((h) => !DEFAULT_HEADS.includes(h.head))
                    .map((h) => ({ value: h.head, label: h.head })),
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Filter Paid To
              </label>
              <Select
                value={partyTypeFilter}
                onChange={(e) => setPartyTypeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Parties' },
                  { value: 'VENDOR', label: 'Vendor' },
                  { value: 'EMPLOYEE', label: 'Employee' },
                  { value: 'DEALER', label: 'Dealer' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Search
              </label>
              <Input
                placeholder="Voucher, party, remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Audit Summary Table */}
          {headSummary.length > 0 && (
            <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Head</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Vouchers</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>Total Cash Paid (PKR)</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', width: '220px' }}>Audit Share</th>
                  </tr>
                </thead>
                <tbody>
                  {headSummary.map((item, idx) => (
                    <tr
                      key={item.head}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: idx === 0 ? '#10b981' : idx === 1 ? '#0ea5e9' : '#8b5cf6',
                            marginRight: '8px',
                          }}
                        />
                        {item.head}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                        {item.count}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        PKR {item.totalAmount.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, item.percentage)}%`,
                                height: '100%',
                                backgroundColor: idx === 0 ? '#10b981' : idx === 1 ? '#0ea5e9' : '#8b5cf6',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', minWidth: '42px' }}>
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '10px 12px', color: '#0f172a' }}>Total Cash Paid</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{totalTransactions}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#166534', fontSize: '14px' }}>
                      PKR {totalCashPaid.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>100% (Audited)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table: Cash Payments (Requirement 8) */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <CardTitle>Cash Payment Transactions ({payments.length})</CardTitle>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Double-click any row to view source audit chain
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>No cash payments found</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                No cash transactions matched your filters. Click &quot;New Cash Payment&quot; to record a payment.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Voucher</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Paid To</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Head</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Description</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>Reference / Link</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>Cash Paid (PKR)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr
                      key={p.id}
                      onDoubleClick={() => setDrillDownDoc({ isOpen: true, sourceType: 'CASH_PAYMENT', sourceId: p.id, voucherNumber: p.voucherNumber })}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa')}
                    >
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                        {p.transactionDate ? p.transactionDate.slice(0, 10) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {p.voucherNumber}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.partyName || '—'}</div>
                        {p.partyType && (
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                            {p.partyType}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge
                          variant={
                            p.head === 'Purchase'
                              ? 'primary'
                              : p.head === 'Dealer Refund'
                              ? 'warning'
                              : p.head.includes('Expense') || p.head.includes('Car')
                              ? 'info'
                              : 'default'
                          }
                        >
                          {p.head}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '250px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.remarks ? p.remarks.replace(/^\[Head:[^\]]+\]\s*/i, '') : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {p.referenceNumber ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                            {p.referenceNumber}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#166534', whiteSpace: 'nowrap' }}>
                        PKR {Number(p.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrillDownDoc({ isOpen: true, sourceType: 'CASH_PAYMENT', sourceId: p.id, voucherNumber: p.voucherNumber });
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#0f172a',
                          }}
                        >
                          <IconEye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Cash Payment Modal (Strictly Cash Only) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Cash Payment &amp; Liability"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Banner Notice */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              fontSize: '12px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>Strictly Cash Only:</strong> Updates Cash Account (101000) and Vendor/Dealer Ledger immediately upon saving.
            </div>
            <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>
              Voucher: {nextVoucherNo}
            </div>
          </div>

          {/* Form Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
            {/* Date */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Payment Date *
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>

            {/* Voucher Number (AUTO) */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Voucher No. (AUTO) *
              </label>
              <Input
                value={nextVoucherNo}
                readOnly
                style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700, color: '#0369a1' }}
              />
            </div>

            {/* Paid To Type */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Paid To Category *
              </label>
              <Select
                value={formPartyType}
                onChange={(e) => handlePartyTypeChange(e.target.value as any)}
                options={[
                  { value: 'VENDOR', label: 'Vendor (Supplier)' },
                  { value: 'EMPLOYEE', label: 'Employee' },
                  { value: 'DEALER', label: 'Dealer (Customer)' },
                  { value: 'OTHER', label: 'Other Payee' },
                ]}
              />
            </div>

            {/* Paid To Party Selector */}
            <div style={{ gridColumn: 'span 7' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Paid To Party *
              </label>
              {formPartyType === 'VENDOR' ? (
                <Select
                  value={formPartyId}
                  onChange={(e) => handlePartyIdChange(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Vendor --' },
                    ...vendors.map((v) => ({ value: v.id, label: `${v.code ? `[${v.code}] ` : ''}${v.name || 'Vendor'}` })),
                  ]}
                />
              ) : formPartyType === 'DEALER' ? (
                <Select
                  value={formPartyId}
                  onChange={(e) => handlePartyIdChange(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Dealer --' },
                    ...dealers.map((d) => ({ value: d.id, label: `${d.code ? `[${d.code}] ` : ''}${d.name || 'Dealer'}` })),
                  ]}
                />
              ) : formPartyType === 'EMPLOYEE' ? (
                <Select
                  value={formPartyId}
                  onChange={(e) => handlePartyIdChange(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Employee --' },
                    ...employees.map((em) => ({ value: em.id, label: `${em.employeeCode ? `[${em.employeeCode}] ` : ''}${em.fullName || em.name || 'Employee'}` })),
                  ]}
                />
              ) : (
                <Input
                  placeholder="Enter Payee Name / Company / Person..."
                  value={formPartyName}
                  onChange={(e) => setFormPartyName(e.target.value)}
                  required
                />
              )}
            </div>

            {/* Payment Head */}
            <div style={{ gridColumn: 'span 5' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Payment Head *
              </label>
              <Select
                value={formHead}
                onChange={(e) => setFormHead(e.target.value)}
                options={DEFAULT_HEADS.map((h) => ({ value: h, label: h }))}
              />
            </div>

            {/* Custom Head if 'Other' */}
            {formHead === 'Other' && (
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Specify Custom Head / Reason *
                </label>
                <Input
                  placeholder="e.g. Office Rent, Legal Retainer, Stationary..."
                  value={customHead}
                  onChange={(e) => setCustomHead(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Cash Paid (PKR) */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                Cash Paid (PKR) *
              </label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={formCashPaid}
                onChange={(e) => setFormCashPaid(e.target.value)}
                required
                style={{ fontSize: '16px', fontWeight: 700, color: '#14532d' }}
              />
              {parseFloat(formCashPaid) > 0 && (
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#15803d', marginTop: '4px' }}>
                  PKR {parseFloat(formCashPaid).toLocaleString()}
                </div>
              )}
            </div>

            {/* Optional Purchase Order / Invoice Link */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Link to Purchase Order / Invoice (Optional)
              </label>
              <Select
                value={formReferenceNumber}
                onChange={(e) => handleLinkPo(e.target.value)}
                options={[
                  { value: '', label: '-- Manual Entry (No PO Link) --' },
                  ...purchaseOrders.slice(0, 50).map((po) => ({
                    value: po.poNumber,
                    label: `${po.poNumber} — ${po.vendor?.name || 'Vendor'} (PKR ${Number(po.totalAmount || 0).toLocaleString()})`,
                  })),
                ]}
              />
            </div>

            {/* Description / Remarks */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Description / Remarks
              </label>
              <Input
                placeholder="Why was the cash paid? e.g. Paid for raw material order, Car oil replacement..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePayment} disabled={isSaving} icon={<IconCheck size={16} />}>
              {isSaving ? 'Posting Transaction...' : 'Save Cash Payment'}
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
          companyId={activeCompanyId}
        />
      )}
    </div>
  );
};
export default PurchaseCashPaymentsView;

