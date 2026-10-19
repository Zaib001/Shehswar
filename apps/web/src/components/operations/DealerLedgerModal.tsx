'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Input, TableSkeleton } from '../ui';
import { IconRefresh } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { SHEHSWAR_LOGO_BASE64 } from '../../lib/shehswar-logo-base64';
import { exportDealerLedgerToPdf } from '../../lib/pdf-export';

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

  const loadLedger = useCallback(async () => {
    if (!dealer?.id) return;
    setIsLoading(true);
    try {
      let url = `/api/v1/dealers/${dealer.id}/ledger?limit=200`;
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

  const filteredEntries = useMemo(() => {
    if (typeFilter === 'ALL') return entries;
    return entries.filter((e) => e.entryType === typeFilter);
  }, [entries, typeFilter]);

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
              {isRegenerating ? 'Recalculating...' : '⚡ Regenerate Ledger'}
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
              🖨️ Print Statement / PDF
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
              {dealer.city ? `📍 ${dealer.city}` : ''} {dealer.phone ? `• 📞 ${dealer.phone}` : ''}
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

        {/* Filter Toolbar */}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Statement Date:</span>
            <div style={{ width: '140px' }}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span>
            <div style={{ width: '140px' }}>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
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
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              <option value="ALL">All Types</option>
              <option value="SALE_INVOICE">Sale Invoices (Dr)</option>
              <option value="PAYMENT_RECEIPT">Payment Receipts (Cr)</option>
              <option value="SALES_RETURN">Sales Returns (Cr)</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
            </select>
          </div>
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
              <TableSkeleton rows={5} />
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
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '12%' }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '18%' }}>Voucher / Ref #</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '14%' }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '22%' }}>Particulars</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '10%', textAlign: 'right' }}>Debit (PKR)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '10%', textAlign: 'right' }}>Credit (PKR)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '10%', textAlign: 'right' }}>Balance (PKR)</th>
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
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      <td style={{ padding: '9px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 500 }}>
                        {new Date(e.entryDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {e.voucherNumber || '—'}
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
                                : e.entryType?.includes('PAYMENT') || e.entryType === 'CREDIT'
                                ? '#ecfdf5'
                                : '#f1f5f9',
                            color:
                              e.entryType?.includes('SALE') || e.entryType === 'DEBIT'
                                ? '#1d4ed8'
                                : e.entryType?.includes('PAYMENT') || e.entryType === 'CREDIT'
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
            ✕ Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
