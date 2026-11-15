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
  } | null;
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
}

export const DealerLedgerModal: React.FC<DealerLedgerModalProps> = ({
  isOpen,
  onClose,
  dealer,
}) => {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    exportDealerLedgerToPdf({
      dealer: {
        name: dealer.name,
        code: dealer.code,
        phone: dealer.phone,
        city: dealer.city,
        address: dealer.address,
        creditLimit: dealer.creditLimit,
        currentBalance,
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

  const creditLimit = Number(dealer.creditLimit || 0);
  const utilizationPct = creditLimit > 0 ? Math.min(100, Math.round((currentBalance / creditLimit) * 100)) : 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Statement of Account — ${dealer.name} (${dealer.code})`}
        size="xl"
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Dealer Contact
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {dealer.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {dealer.city ? dealer.city : ''} {dealer.phone ? `• Tel: ${dealer.phone}` : ''}
              </div>
              {creditLimit > 0 && (
                <div style={{ fontSize: '11px', color: utilizationPct > 80 ? '#b91c1c' : '#475569', marginTop: '3px', fontWeight: 600 }}>
                  Credit Limit: PKR {creditLimit.toLocaleString()} ({utilizationPct}% used)
                </div>
              )}
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Debits (Sales)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                PKR {totalDebits.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {filteredEntries.filter((e) => Number(e.debit) > 0).length} Invoices
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Credits (Receipts)
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                PKR {totalCredits.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {filteredEntries.filter((e) => Number(e.credit) > 0).length} Credits
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                Net Closing Balance
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: currentBalance > 0 ? '#b91c1c' : '#047857', marginTop: '2px' }}>
                PKR {currentBalance.toLocaleString()} {currentBalance > 0 ? 'Dr' : 'Cr'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {currentBalance > 0 ? 'Outstanding Owed to Shehswar' : 'Settled / In Credit'}
              </div>
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
              maxHeight: '440px',
              overflowY: 'auto',
            }}
          >
            {isLoading ? (
              <div style={{ padding: '24px' }}>
                <TableSkeleton rows={5} columns={8} />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>No ledger transactions recorded in this period.</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  Transactions will appear automatically upon sales invoicing or receipt collection.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#1e293b', color: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '4%' }}>#</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '11%' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '16%' }}>Voucher / Ref #</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '14%' }}>Type</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '21%' }}>Particulars</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '11%', textAlign: 'right' }}>Debit (PKR)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '11%', textAlign: 'right' }}>Credit (PKR)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '11%', textAlign: 'right' }}>Balance (PKR)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, width: '9%', textAlign: 'center' }}>Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e, idx) => {
                    const debitNum = Number(e.debit || 0);
                    const creditNum = Number(e.credit || 0);
                    const balNum = Number(e.runningBalance || 0);

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
                        <td style={{ padding: '9px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {new Date(e.entryDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, fontFamily: 'monospace' }}>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleOpenSource(e);
                            }}
                            className="text-blue-700 hover:text-blue-900 hover:underline text-left font-bold"
                          >
                            {e.voucherNumber || '—'}
                          </button>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
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
                        <td style={{ padding: '9px 12px', color: '#475569' }}>
                          {e.description || 'Commercial Transaction'}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: debitNum > 0 ? 700 : 400,
                            color: debitNum > 0 ? '#0f172a' : '#94a3b8',
                          }}
                        >
                          {debitNum > 0 ? debitNum.toLocaleString() : '—'}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: creditNum > 0 ? 700 : 400,
                            color: creditNum > 0 ? '#047857' : '#94a3b8',
                          }}
                        >
                          {creditNum > 0 ? creditNum.toLocaleString() : '—'}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: balNum > 0 ? '#0f172a' : '#047857',
                          }}
                        >
                          {balNum.toLocaleString()} {balNum > 0 ? 'Dr' : 'Cr'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
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
                    <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
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
