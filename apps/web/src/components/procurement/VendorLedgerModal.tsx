'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Input, TableSkeleton } from '../ui';
import { IconRefresh, IconDownload, IconFileText } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportVendorLedgerToPdf } from '../../lib/pdf-export';

export interface VendorLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: string;
    name: string;
    code: string;
    legalName?: string;
    ntn?: string;
    strn?: string;
    phone?: string;
    city?: string;
    address?: string;
    paymentTerms?: string;
    creditLimit?: number;
    currentBalance?: number;
    bankDetails?: any;
  } | null;
}

export interface VendorLedgerEntryRecord {
  id: string;
  entryDate: string;
  entryType: string;
  voucherNumber: string;
  description?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export const VendorLedgerModal: React.FC<VendorLedgerModalProps> = ({
  isOpen,
  onClose,
  vendor,
}) => {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<VendorLedgerEntryRecord[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const loadLedger = useCallback(async () => {
    if (!vendor?.id) return;
    setIsLoading(true);
    try {
      let url = `/api/v1/procurement/vendors/${vendor.id}/ledger?limit=200`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await ApiClient.get<any>(url);
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data.entries) ? data.entries : [];
      setEntries(list);
      setCurrentBalance(Number(data.currentBalance ?? vendor.currentBalance ?? 0));
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to load vendor ledger statement',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [vendor, startDate, endDate, showToast]);

  useEffect(() => {
    if (isOpen && vendor?.id) {
      loadLedger();
    }
  }, [isOpen, vendor?.id, loadLedger]);

  // Client-side filtering by entry type
  const filteredEntries = useMemo(() => {
    if (typeFilter === 'ALL') return entries;
    return entries.filter((e) => e.entryType === typeFilter);
  }, [entries, typeFilter]);

  // Running totals
  const totalDebits = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
  }, [filteredEntries]);

  const totalCredits = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
  }, [filteredEntries]);

  // Export to PDF
  const handleExportPdf = () => {
    if (!vendor) return;

    exportVendorLedgerToPdf({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        code: vendor.code,
        legalName: vendor.legalName,
        ntn: vendor.ntn,
        strn: vendor.strn,
        phone: vendor.phone,
        city: vendor.city,
        address: vendor.address,
        paymentTerms: vendor.paymentTerms,
        creditLimit: vendor.creditLimit,
        currentBalance: currentBalance,
        bankDetails: vendor.bankDetails,
      },
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      entries: filteredEntries,
    });

    showToast({
      title: 'Ledger PDF Ready',
      message: 'Print & download view launched with Shehswar enterprise letterhead.',
      type: 'success',
    });
  };

  if (!isOpen || !vendor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Accounts Payable Ledger: ${vendor.code} — ${vendor.name}`}
      size="xl"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Outstanding Balance */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: currentBalance > 0 ? '#fef2f2' : '#f0fdf4',
              border: `1.5px solid ${currentBalance > 0 ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: currentBalance > 0 ? '#991b1b' : '#166534',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Current Payable Balance (Closing)
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: currentBalance > 0 ? '#dc2626' : '#16a34a',
                fontFamily: 'monospace',
                marginTop: '4px',
              }}
            >
              PKR {Math.abs(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '6px' }}>
                {currentBalance >= 0 ? 'Cr (Payable)' : 'Dr (Advance)'}
              </span>
            </div>
          </div>

          {/* Period Purchases / Credits */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Period Invoiced Purchases (Credit)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: '4px' }}>
              PKR {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Period Payments / Debits */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Period Settled Payments (Debit)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', marginTop: '4px' }}>
              PKR {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Filter Controls & Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                From Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ fontSize: '12px', padding: '5px 10px', height: '34px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                To Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ fontSize: '12px', padding: '5px 10px', height: '34px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                Entry Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Entries</option>
                <option value="PURCHASE_INVOICE">Purchase Invoice (Cr)</option>
                <option value="VENDOR_PAYMENT">Vendor Payment (Dr)</option>
                <option value="PURCHASE_RETURN">Purchase Return (Dr)</option>
                <option value="OPENING_BALANCE">Opening Balance</option>
              </select>
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={loadLedger} disabled={isLoading}>
                <IconRefresh size={14} /> Filter
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconDownload size={14} /> Download Ledger as PDF
            </Button>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div
          style={{
            maxHeight: '440px',
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '24px' }}>
              <TableSkeleton rows={6} columns={6} />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <IconFileText size={36} color="#94a3b8" />
              <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>
                No Ledger Transactions Found
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                This vendor has no recorded purchase invoices or payments matching this period.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Date</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>Voucher / Ref #</th>
                  <th style={{ padding: '8px 12px' }}>Particulars</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Debit (Paid)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Credit (Billed)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e, idx) => {
                  const debit = Number(e.debit || 0);
                  const credit = Number(e.credit || 0);
                  const bal = Number(e.runningBalance || 0);
                  return (
                    <tr
                      key={e.id || idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                        {new Date(e.entryDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            backgroundColor:
                              e.entryType === 'PURCHASE_INVOICE'
                                ? '#fef3c7'
                                : e.entryType === 'VENDOR_PAYMENT'
                                ? '#dcfce7'
                                : '#f1f5f9',
                            color:
                              e.entryType === 'PURCHICE_INVOICE'
                                ? '#92400e'
                                : e.entryType === 'VENDOR_PAYMENT'
                                ? '#166534'
                                : '#334155',
                          }}
                        >
                          {e.entryType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {e.voucherNumber || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>
                        {e.description || 'Commercial Transaction'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: debit > 0 ? '#16a34a' : '#94a3b8' }}>
                        {debit > 0 ? `PKR ${debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: credit > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {credit > 0 ? `PKR ${credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        PKR {Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        <span style={{ fontSize: '10px', color: bal >= 0 ? '#dc2626' : '#16a34a' }}>
                          {bal >= 0 ? 'Cr' : 'Dr'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #0f172a' }}>
                  <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right' }}>
                    PERIOD TOTALS:
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>
                    PKR {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c' }}>
                    PKR {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a', fontWeight: 800 }}>
                    PKR {Math.abs(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span style={{ fontSize: '11px', color: currentBalance >= 0 ? '#dc2626' : '#16a34a' }}>
                      {currentBalance >= 0 ? 'Cr' : 'Dr'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
};
