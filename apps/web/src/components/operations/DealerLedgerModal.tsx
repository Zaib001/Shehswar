'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Input, TableSkeleton } from '../ui';
import { IconRefresh, IconDownload } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { SHEHSWAR_LOGO_BASE64 } from '../../lib/shehswar-logo-base64';
import { exportDealerLedgerToPdf } from '../../lib/pdf-export';
import { SourceDocumentDrillDownModal } from './SourceDocumentDrillDownModal';

export interface DealerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealer: {
    id: string;
    name: string;
    code: string;
    phone?: string;
    city?: string;
    address?: string;
    creditLimit?: number;
    currentBalance?: number;
    usedCredit?: number;
    pendingCredit?: number;
  } | null;
}

export interface LedgerEntryItem {
  productName: string;
  productCode?: string;
  description?: string;
  packSize?: string;
  ppc?: number;
  ctn?: number | string;
  batchNumber?: string;
  quantity: number | string;
  price: number | string;
  grossAmount?: number;
  discountPercent?: number;
  discountRupees?: number;
  netAmount?: number;
  schemeCode?: string;
}

export interface LedgerEntryRecord {
  id: string;
  entryDate: string;
  entryType: string;
  voucherNumber: string;
  description?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  referenceId?: string;
  salesInvoiceId?: string;
  dealerPaymentId?: string;
  salesReturnId?: string;
  provisionalReceiptAllocationId?: string;
  isAcknowledged?: boolean;
  acknowledgement?: string;
  salesOrderNumber?: string;
  // Product commercial attributes
  items?: LedgerEntryItem[];
  productName?: string;
  descriptionSummary?: string;
  packSize?: string;
  ctn?: number | string;
  batchNumber?: string;
  quantity?: number | string;
  price?: number | string;
  schemeCode?: string;
  discountPercent?: number;
  discountRupees?: number;
}

/**
 * Shortens long voucher / reference codes into compact codes (e.g. SI-0001, PR-0002, IC-7719, #9830)
 * while preserving full voucher number on hover tooltip & drill-down.
 */
export function formatSmallVoucherCode(voucher?: string | null): string {
  if (!voucher) return '—';
  const clean = String(voucher).trim();
  if (clean.length <= 10) return clean;

  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(clean)) {
    return `#${clean.slice(-6).toUpperCase()}`;
  }

  // Intercompany transfer pattern
  if (/^IC/i.test(clean)) {
    const digits = clean.match(/\d+$/);
    return digits ? `IC-${digits[0].slice(-4)}` : clean.slice(0, 8);
  }

  // Sales Invoice pattern
  if (/SI|INV|SALE/i.test(clean)) {
    const digits = clean.match(/\d+$/);
    return digits ? `SI-${digits[0].slice(-4)}` : clean.slice(0, 8);
  }

  // Payment / Receipt pattern
  if (/PR|RCP|PAY|PMT/i.test(clean)) {
    const digits = clean.match(/\d+$/);
    return digits ? `PR-${digits[0].slice(-4)}` : clean.slice(0, 8);
  }

  // Sales Order pattern
  if (/SO|ORD/i.test(clean)) {
    const digits = clean.match(/\d+$/);
    return digits ? `SO-${digits[0].slice(-4)}` : clean.slice(0, 8);
  }

  // Return pattern
  if (/SR|RET/i.test(clean)) {
    const digits = clean.match(/\d+$/);
    return digits ? `SR-${digits[0].slice(-4)}` : clean.slice(0, 8);
  }

  // Fallback: if ends with digits
  const lastDigits = clean.match(/\d+$/);
  if (lastDigits) {
    const prefix = clean.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'VCH';
    return `${prefix}-${lastDigits[0].slice(-4)}`;
  }

  return clean.slice(0, 10);
}

export const DealerLedgerModal: React.FC<DealerLedgerModalProps> = ({
  isOpen,
  onClose,
  dealer,
}) => {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(Number(dealer?.currentBalance || 0));
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(Number(dealer?.creditLimit || 0));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (dealer) {
      setDealerCreditLimit(Number(dealer.creditLimit || 0));
      setCurrentBalance(Number(dealer.currentBalance || 0));
    }
  }, [dealer]);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Source Document Drill-Down state
  const [selectedSource, setSelectedSource] = useState<{
    sourceType?: string;
    sourceId?: string;
    sourceNumber?: string;
    voucherNumber?: string;
    referenceId?: string;
  } | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState<boolean>(false);

  const loadLedger = useCallback(async () => {
    if (!dealer?.id) return;
    setIsLoading(true);
    try {
      let url = `/api/v1/dealers/${dealer.id}/ledger?limit=300`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await ApiClient.get<any>(url);
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data.entries) ? data.entries : [];
      setEntries(list);
      setCurrentBalance(Number(data.currentBalance ?? data.dealer?.currentBalance ?? dealer.currentBalance ?? 0));
      const lim = Number(data.creditLimit ?? data.dealer?.creditLimit ?? dealer.creditLimit ?? 0);
      if (lim > 0) setDealerCreditLimit(lim);
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to load dealer ledger statement',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [dealer, startDate, endDate, showToast]);

  useEffect(() => {
    if (isOpen && dealer?.id) {
      loadLedger();
    }
  }, [isOpen, dealer?.id, loadLedger]);

  const handleOpenSource = (entry: LedgerEntryRecord) => {
    setSelectedSource({
      sourceType: entry.sourceType || entry.entryType,
      sourceId:
        entry.sourceId ||
        entry.referenceId ||
        entry.salesInvoiceId ||
        entry.dealerPaymentId ||
        entry.salesReturnId ||
        entry.provisionalReceiptAllocationId,
      sourceNumber: entry.sourceNumber || entry.voucherNumber,
      voucherNumber: entry.voucherNumber,
      referenceId: entry.referenceId,
    });
    setIsDrillDownOpen(true);
  };

  // Regenerate / Recalculate Ledger from document records
  const handleRegenerateLedger = async () => {
    if (!dealer?.id) return;
    setIsRegenerating(true);
    try {
      const res = await ApiClient.post<any>(`/api/v1/dealers/${dealer.id}/ledger/regenerate`, {});
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data.entries) ? data.entries : [];
      setEntries(list);
      const newBal = Number(data.currentBalance ?? data.dealer?.currentBalance ?? 0);
      setCurrentBalance(newBal);

      showToast({
        title: 'Ledger Regenerated Successfully',
        message: `Running balance recalculated across all vouchers. Closing balance: PKR ${newBal.toLocaleString()}`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Regeneration Error',
        message: err.message || 'Failed to regenerate ledger running balances',
        type: 'error',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Client-side filtering by entry type & search query
  const filteredEntries = useMemo(() => {
    let list = entries;
    if (typeFilter !== 'ALL') {
      list = list.filter((e) => e.entryType === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          (e.voucherNumber && e.voucherNumber.toLowerCase().includes(q)) ||
          (e.sourceNumber && e.sourceNumber.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.productName && e.productName.toLowerCase().includes(q)) ||
          (e.batchNumber && e.batchNumber.toLowerCase().includes(q)) ||
          (e.schemeCode && e.schemeCode.toLowerCase().includes(q)) ||
          (e.items && e.items.some((it) => it.productName.toLowerCase().includes(q) || (it.schemeCode && it.schemeCode.toLowerCase().includes(q)))) ||
          String(e.debit).includes(q) ||
          String(e.credit).includes(q)
      );
    }
    return list;
  }, [entries, typeFilter, searchQuery]);

  const totalDebits = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0),
    [filteredEntries],
  );

  const totalCredits = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0),
    [filteredEntries],
  );

  const handlePrintPdf = () => {
    if (!dealer) return;
    const creditLimit = Number(dealerCreditLimit || dealer.creditLimit || 0);
    const usedCredit = Math.max(0, currentBalance);
    const pendingCredit = Math.max(0, creditLimit - usedCredit);

    exportDealerLedgerToPdf({
      dealer: {
        name: dealer.name,
        code: dealer.code,
        phone: dealer.phone,
        city: dealer.city,
        address: dealer.address,
        creditLimit,
        currentBalance,
        usedCredit,
        pendingCredit,
      },
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      entries: filteredEntries,
    });
  };

  const handleQuickFilter = (range: 'ALL' | '30DAYS' | 'THIS_MONTH') => {
    const today = new Date();
    if (range === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (range === '30DAYS') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0] ?? '');
      setEndDate(today.toISOString().split('T')[0] ?? '');
    } else if (range === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0] ?? '');
      setEndDate(today.toISOString().split('T')[0] ?? '');
    }
  };

  if (!dealer) return null;

  const creditLimit = Number(dealerCreditLimit || dealer.creditLimit || 0);
  const usedCredit = Math.max(0, currentBalance);
  const pendingCredit = Math.max(0, creditLimit - usedCredit);
  const utilizationPct = creditLimit > 0 ? Math.min(100, Math.round((usedCredit / creditLimit) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - utilizationPct);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Statement of Account — ${dealer.name} (${dealer.code})`}
        size="2xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Corporate Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={SHEHSWAR_LOGO_BASE64}
                alt="Shehswar Emblem"
                style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
              />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.01em' }}>
                  SHEHSWAR CHEMICALS (PVT) LTD
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Dealer Sub-Ledger & Statement of Account • Authoritative Accounting Records
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerateLedger}
                disabled={isRegenerating || isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  color: '#0f172a',
                  borderColor: '#cbd5e1',
                }}
              >
                <IconRefresh size={14} />
                {isRegenerating ? 'Recalculating...' : 'Regenerate Ledger'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handlePrintPdf}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconDownload size={14} /> Print Statement / PDF
              </Button>
            </div>
          </div>

          {/* Executive Account Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {/* Card 1: Approved Limit */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Approved Credit Limit
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {creditLimit.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Authorized Facility
              </div>
            </div>

            {/* Card 2: Used Credit */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Used Credit (Exposure)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#b91c1c', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {usedCredit.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px', fontWeight: 600 }}>
                {utilizationPct}% utilized
              </div>
            </div>

            {/* Card 3: Pending Credit */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending Credit (Available)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {pendingCredit.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px', fontWeight: 600 }}>
                {creditLimit > 0 ? `${remainingPct}% remaining` : 'No limit set'}
              </div>
            </div>

            {/* Card 4: Total Debits */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Debits (Sales)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {totalDebits.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {filteredEntries.filter((e) => Number(e.debit) > 0).length} Invoices
              </div>
            </div>

            {/* Card 5: Total Credits */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Credits (Receipts)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {totalCredits.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {filteredEntries.filter((e) => Number(e.credit) > 0).length} Credits
              </div>
            </div>

            {/* Card 6: Net Closing Balance */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Net Closing Balance
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: currentBalance > 0 ? '#b91c1c' : '#047857', marginTop: '3px', fontFamily: 'monospace' }}>
                PKR {currentBalance.toLocaleString()} {currentBalance > 0 ? 'Dr' : 'Cr'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {currentBalance > 0 ? 'Outstanding Receivable' : 'Settled / In Credit'}
              </div>
            </div>
          </div>

          {/* Credit Status & Utilization Visual Bar */}
          <div
            style={{
              padding: '9px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Credit Utilization:</span>
                <span>
                  <strong style={{ color: '#b91c1c' }}>Used:</strong> PKR {usedCredit.toLocaleString()} ({utilizationPct}%)
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>
                  <strong style={{ color: '#15803d' }}>Pending:</strong> PKR {pendingCredit.toLocaleString()} ({remainingPct}%)
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: '11.5px' }}>
                Total Limit: PKR {creditLimit.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '7px',
                borderRadius: '4px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, utilizationPct)}%`,
                  backgroundColor: utilizationPct >= 90 ? '#dc2626' : utilizationPct >= 75 ? '#f59e0b' : '#3b82f6',
                  transition: 'width 0.3s ease',
                }}
                title={`Used Credit: PKR ${usedCredit.toLocaleString()} (${utilizationPct}%)`}
              />
              <div
                style={{
                  width: `${Math.max(0, remainingPct)}%`,
                  backgroundColor: '#22c55e',
                  transition: 'width 0.3s ease',
                }}
                title={`Pending Credit: PKR ${pendingCredit.toLocaleString()} (${remainingPct}%)`}
              />
            </div>
          </div>

          {/* Filter Toolbar & Search */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ minWidth: '180px', flex: '1 1 200px' }}>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search voucher, particulars, amount..."
                  style={{ fontSize: '12px', padding: '5px 10px', height: '34px' }}
                />
              </div>

              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Date:</span>
              <div style={{ width: '130px' }}>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ fontSize: '12px', padding: '4px 8px', height: '34px' }}
                />
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span>
              <div style={{ width: '130px' }}>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ fontSize: '12px', padding: '4px 8px', height: '34px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Button
                variant={!startDate && !endDate ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleQuickFilter('ALL')}
              >
                All Time
              </Button>
              <Button
                variant={startDate && !endDate ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleQuickFilter('30DAYS')}
              >
                Last 30 Days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickFilter('THIS_MONTH')}
              >
                This Month
              </Button>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  height: '34px',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">All Types</option>
                <option value="SALES_INVOICE">Sale Invoices (Dr)</option>
                <option value="SALE_INVOICE">Sale Invoices (Legacy)</option>
                <option value="SALES_ORDER">Sales Orders</option>
                <option value="PROVISIONAL_RECEIPT">Provisional Receipts (Cr)</option>
                <option value="PAYMENT_RECEIPT">Payment Receipts (Cr)</option>
                <option value="SALES_RETURN">Sales Returns (Cr)</option>
                <option value="INTERCOMPANY_TRANSFER">Intercompany Transfer</option>
                <option value="OPENING_BALANCE">Opening Balance</option>
              </select>
            </div>
          </div>

          {/* Traceability Pro-Tip Banner */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/70 border border-blue-200/80 rounded-md text-xs text-blue-900 font-medium">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>
                <strong>Full Source Document Traceability:</strong> Double-click any transaction row or press{' '}
                <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-mono text-[10px] shadow-xs">
                  Enter
                </kbd>{' '}
                to open the originating Sales Invoice, Order, Provisional Receipt, or Payment.
              </span>
            </div>
            <span className="text-blue-700 font-semibold text-[11px]">
              {filteredEntries.length} record(s)
            </span>
          </div>

          {/* Professional Ledger Table */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              maxHeight: '480px',
              overflowY: 'auto',
              overflowX: 'auto',
            }}
          >
            {isLoading ? (
              <div style={{ padding: '24px' }}>
                <TableSkeleton rows={5} columns={10} />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>No ledger transactions recorded in this period.</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  Transactions will appear automatically upon sales invoicing or receipt collection.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: '1380px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#1e293b', color: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '32px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '85px' }}>Date</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '80px' }}>Voucher</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '85px' }}>Type</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '90px', textAlign: 'center' }}>Ack</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, minWidth: '140px' }}>Product Name</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, minWidth: '110px' }}>Description</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '75px' }}>Pack Size</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '50px', textAlign: 'center' }}>CTN</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '75px' }}>Batch</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '60px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '80px', textAlign: 'right' }}>Price (PKR)</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, minWidth: '120px' }}>Scheme</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '90px', textAlign: 'right' }}>Debit (PKR)</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '90px', textAlign: 'right' }}>Credit (PKR)</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '100px', textAlign: 'right' }}>Balance (PKR)</th>
                    <th style={{ padding: '10px 10px', fontWeight: 700, width: '55px', textAlign: 'center' }}>Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e, idx) => {
                    const debitNum = Number(e.debit || 0);
                    const creditNum = Number(e.credit || 0);
                    const balNum = Number(e.runningBalance || 0);
                    const itemsToRender: LedgerEntryItem[] = (Array.isArray(e.items) && e.items.length > 0)
                      ? e.items
                      : [{
                          productName: e.productName || (e.entryType?.includes('PAYMENT') || e.entryType?.includes('RECEIPT') ? 'Payment Received' : 'Commercial Transaction'),
                          description: e.descriptionSummary || e.description || '—',
                          packSize: e.packSize || '—',
                          ctn: e.ctn || '—',
                          batchNumber: e.batchNumber || '—',
                          quantity: e.quantity || '—',
                          price: e.price || '—',
                          schemeCode: e.schemeCode || '—',
                          discountPercent: e.discountPercent || 0,
                          discountRupees: e.discountRupees || 0,
                        }];

                    return (
                      <tr
                        key={e.id || idx}
                        tabIndex={0}
                        onDoubleClick={() => handleOpenSource(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') handleOpenSource(e);
                        }}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          cursor: 'pointer',
                        }}
                        className="hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none transition-colors"
                        title="Double-click or press Enter to inspect source document"
                      >
                        {/* # */}
                        <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace', textAlign: 'center', verticalAlign: 'top' }}>
                          {idx + 1}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '8px 10px', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {new Date(e.entryDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Voucher / Ref # as Small Code */}
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleOpenSource(e);
                            }}
                            className="text-blue-700 hover:text-blue-900 hover:underline text-left font-bold"
                            title={`Original Voucher: ${e.voucherNumber || '—'}`}
                          >
                            {formatSmallVoucherCode(e.voucherNumber)}
                          </button>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor:
                                e.entryType?.includes('SALE') || e.entryType === 'DEBIT'
                                  ? '#eff6ff'
                                  : e.entryType?.includes('PAYMENT') || e.entryType?.includes('RECEIPT') || e.entryType === 'CREDIT'
                                  ? '#ecfdf5'
                                  : '#f1f5f9',
                              color:
                                e.entryType?.includes('SALE') || e.entryType === 'DEBIT'
                                  ? '#1d4ed8'
                                  : e.entryType?.includes('PAYMENT') || e.entryType?.includes('RECEIPT') || e.entryType === 'CREDIT'
                                  ? '#047857'
                                  : '#475569',
                            }}
                          >
                            {e.entryType?.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Acknowledgement Status */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                          {e.entryType?.includes('SALE') || e.salesInvoiceId ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: e.isAcknowledged ? '#dcfce7' : '#fef3c7',
                                color: e.isAcknowledged ? '#15803d' : '#b45309',
                                border: `1px solid ${e.isAcknowledged ? '#86efac' : '#fde68a'}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {e.isAcknowledged ? '✓ Received' : 'Pending'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* Product Name */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontWeight: 600,
                                color: e.entryType?.includes('PAYMENT') || e.entryType?.includes('RECEIPT') ? '#047857' : '#0f172a',
                              }}
                            >
                              {it.productName}
                              {it.productCode && (
                                <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px', fontFamily: 'monospace' }}>
                                  ({it.productCode})
                                </span>
                              )}
                            </div>
                          ))}
                        </td>

                        {/* Description */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                color: '#475569',
                                fontSize: '11.5px',
                              }}
                            >
                              {it.description || '—'}
                            </div>
                          ))}
                        </td>

                        {/* Pack Size */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontFamily: 'monospace',
                                color: '#334155',
                              }}
                            >
                              {it.packSize || '—'}
                            </div>
                          ))}
                        </td>

                        {/* CTN */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontFamily: 'monospace',
                                fontWeight: it.ctn && it.ctn !== '—' ? 700 : 400,
                                color: it.ctn && it.ctn !== '—' ? '#0f172a' : '#94a3b8',
                              }}
                            >
                              {it.ctn !== undefined && it.ctn !== null && it.ctn !== '—' ? Number(it.ctn).toLocaleString() : '—'}
                            </div>
                          ))}
                        </td>

                        {/* Batch */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: it.batchNumber && it.batchNumber !== '—' ? '#0284c7' : '#94a3b8',
                              }}
                            >
                              {it.batchNumber || '—'}
                            </div>
                          ))}
                        </td>

                        {/* Quantity */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontFamily: 'monospace',
                                fontWeight: it.quantity && it.quantity !== '—' ? 700 : 400,
                                color: it.quantity && it.quantity !== '—' ? '#0f172a' : '#94a3b8',
                              }}
                            >
                              {it.quantity !== undefined && it.quantity !== null && it.quantity !== '—' && !isNaN(Number(it.quantity))
                                ? Number(it.quantity).toLocaleString()
                                : (it.quantity || '—')}
                            </div>
                          ))}
                        </td>

                        {/* Price (PKR) */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top', textAlign: 'right' }}>
                          {itemsToRender.map((it, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '2px 0',
                                borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: Number(it.price) > 0 ? '#334155' : '#94a3b8',
                              }}
                            >
                              {Number(it.price) > 0 ? Number(it.price).toLocaleString() : '—'}
                            </div>
                          ))}
                        </td>

                        {/* Scheme: code, discount in %, discount in rupees */}
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          {itemsToRender.map((it, i) => {
                            const hasCode = it.schemeCode && it.schemeCode !== '—';
                            const hasPct = Number(it.discountPercent || 0) > 0;
                            const hasRs = Number(it.discountRupees || 0) > 0;

                            return (
                              <div
                                key={i}
                                style={{
                                  padding: '2px 0',
                                  borderBottom: i < itemsToRender.length - 1 ? '1px dashed #e2e8f0' : 'none',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {hasCode && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe',
                                      }}
                                      title={`Scheme Code: ${it.schemeCode}`}
                                    >
                                      {it.schemeCode}
                                    </span>
                                  )}
                                  {hasPct && (
                                    <span
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        color: '#047857',
                                      }}
                                      title={`Discount: ${it.discountPercent}%`}
                                    >
                                      {it.discountPercent}%
                                    </span>
                                  )}
                                  {hasRs && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        color: '#059669',
                                      }}
                                      title={`Discount: Rs. ${Number(it.discountRupees).toLocaleString()}`}
                                    >
                                      Rs. {Number(it.discountRupees).toLocaleString()}
                                    </span>
                                  )}
                                  {!hasCode && !hasPct && !hasRs && (
                                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </td>

                        {/* Debit */}
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: debitNum > 0 ? 700 : 400,
                            color: debitNum > 0 ? '#0f172a' : '#94a3b8',
                            verticalAlign: 'top',
                          }}
                        >
                          {debitNum > 0 ? debitNum.toLocaleString() : '—'}
                        </td>

                        {/* Credit */}
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: creditNum > 0 ? 700 : 400,
                            color: creditNum > 0 ? '#047857' : '#94a3b8',
                            verticalAlign: 'top',
                          }}
                        >
                          {creditNum > 0 ? creditNum.toLocaleString() : '—'}
                        </td>

                        {/* Balance */}
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: balNum > 0 ? '#0f172a' : '#047857',
                            verticalAlign: 'top',
                          }}
                        >
                          {balNum.toLocaleString()} {balNum > 0 ? 'Dr' : 'Cr'}
                        </td>

                        {/* Trace */}
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleOpenSource(e);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                  <tr>
                    <td colSpan={12} style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                      STATEMENT TOTALS:
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a' }}>
                      PKR {totalDebits.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                      PKR {totalCredits.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: currentBalance > 0 ? '#b91c1c' : '#047857' }}>
                      PKR {currentBalance.toLocaleString()} {currentBalance > 0 ? 'Dr' : 'Cr'}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Footer Notes & Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Official Computer-Generated Statement of Account • Validated against immutable sub-ledger entries.
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Universal Source Document Drill-Down Modal */}
      <SourceDocumentDrillDownModal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        sourceType={selectedSource?.sourceType}
        sourceId={selectedSource?.sourceId}
        sourceNumber={selectedSource?.sourceNumber}
        voucherNumber={selectedSource?.voucherNumber}
        referenceId={selectedSource?.referenceId}
        onUpdated={loadLedger}
      />
    </>
  );
};
