'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Input, TableSkeleton, PdfViewerModal } from '../ui';
import { IconRefresh, IconDownload, IconFileText, IconEye } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportVendorLedgerToPdf, generateVendorLedgerHtml } from '../../lib/pdf-export';
import { SourceDocumentDrillDownModal } from '../operations/SourceDocumentDrillDownModal';

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
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  referenceId?: string;
  purchaseInvoiceId?: string;
  vendorPaymentId?: string;
  purchaseReturnId?: string;
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

  // Transaction Preview Modal state
  const [selectedPreviewEntry, setSelectedPreviewEntry] = useState<VendorLedgerEntryRecord | null>(null);

  // In-App PDF Viewer Modal state
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState<boolean>(false);
  const [pdfViewerHtml, setPdfViewerHtml] = useState<string>('');

  const loadLedger = useCallback(async () => {
    if (!vendor?.id) return;
    setIsLoading(true);
    try {
      let url = `/api/v1/procurement/vendors/${vendor.id}/ledger?limit=300`;
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

  const handleOpenSource = (entry: VendorLedgerEntryRecord) => {
    setSelectedSource({
      sourceType: entry.sourceType || entry.entryType,
      sourceId:
        entry.sourceId ||
        entry.referenceId ||
        entry.purchaseInvoiceId ||
        entry.vendorPaymentId ||
        entry.purchaseReturnId,
      sourceNumber: entry.sourceNumber || entry.voucherNumber,
      voucherNumber: entry.voucherNumber,
      referenceId: entry.referenceId,
    });
    setIsDrillDownOpen(true);
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

  // Chronological ascending sorting: earliest entry on top row (e.g. 11/12/2026), latest at bottom
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const timeA = new Date(a.entryDate).getTime();
      const timeB = new Date(b.entryDate).getTime();
      if (timeA !== timeB) return timeA - timeB; // Earliest / oldest date first
      if (a.entryType === 'OPENING_BALANCE') return -1;
      if (b.entryType === 'OPENING_BALANCE') return 1;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [filteredEntries]);

  // Running totals
  const totalDebits = useMemo(() => {
    return sortedEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
  }, [sortedEntries]);

  const totalCredits = useMemo(() => {
    return sortedEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
  }, [sortedEntries]);

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
      entries: sortedEntries,
    });

    showToast({
      title: 'Ledger PDF Ready',
      message: 'Print & download view launched with Shehswar enterprise letterhead.',
      type: 'success',
    });
  };

  // View PDF in In-App Modal
  const handleViewPdf = () => {
    if (!vendor) return;

    const html = generateVendorLedgerHtml({
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
      entries: sortedEntries,
    });

    setPdfViewerHtml(html);
    setIsPdfViewerOpen(true);
  };

  if (!isOpen || !vendor) return null;

  return (
    <>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ minWidth: '180px', flex: '1 1 200px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Search Ledger
                </label>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search voucher, description, amount..."
                  style={{ fontSize: '12px', padding: '5px 10px', height: '34px' }}
                />
              </div>

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
                  <option value="PURCHASE_ORDER">Purchase Order</option>
                  <option value="PURCHASE_INVOICE">Purchase Invoice (Cr)</option>
                  <option value="VENDOR_PAYMENT">Vendor Payment (Dr)</option>
                  <option value="PURCHASE_RETURN">Purchase Return (Dr)</option>
                  <option value="INTERCOMPANY_TRANSFER">Intercompany Transfer</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={loadLedger} disabled={isLoading}>
                  <IconRefresh size={14} /> Refresh
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleViewPdf}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconEye size={14} /> View PDF
              </Button>

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

          {/* Traceability Pro-Tip Banner */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/70 border border-blue-200/80 rounded-md text-xs text-blue-900 font-medium">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>
                <strong>Full Source Document Traceability:</strong> Click, double-click any row or press{' '}
                <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-mono text-[10px] shadow-xs">
                  Enter
                </kbd>{' '}
                to preview transaction details and drill down to the originating Purchase Order, Invoice, or Cash Payment.
              </span>
            </div>
            <span className="text-blue-700 font-semibold text-[11px]">
              {sortedEntries.length} record(s)
            </span>
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
                <TableSkeleton rows={6} columns={7} />
              </div>
            ) : sortedEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <IconFileText size={36} color="#94a3b8" />
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>
                  No Ledger Transactions Found
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  This vendor has no recorded transactions matching the current filters.
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
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Trace Document</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((e, idx) => {
                    const debit = Number(e.debit || 0);
                    const credit = Number(e.credit || 0);
                    const bal = Number(e.runningBalance || 0);
                    return (
                      <tr
                        key={e.id || idx}
                        tabIndex={0}
                        onClick={() => setSelectedPreviewEntry(e)}
                        onDoubleClick={() => setSelectedPreviewEntry(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault();
                            setSelectedPreviewEntry(e);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                          cursor: 'pointer',
                        }}
                        className="hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none transition-colors"
                        title="Click, double-click, or press Enter to preview details"
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
                                  : e.entryType === 'PURCHASE_ORDER'
                                  ? '#e0e7ff'
                                  : '#f1f5f9',
                              color:
                                e.entryType === 'PURCHASE_INVOICE'
                                  ? '#92400e'
                                  : e.entryType === 'VENDOR_PAYMENT'
                                  ? '#166534'
                                  : e.entryType === 'PURCHASE_ORDER'
                                  ? '#3730a3'
                                  : '#334155',
                            }}
                          >
                            {e.entryType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedPreviewEntry(e);
                            }}
                            className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
                            title="Preview entry details"
                          >
                            {e.voucherNumber || '—'}
                          </button>
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
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setSelectedPreviewEntry(e);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition-colors"
                              title="Preview Transaction Details"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleOpenSource(e);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
                              title="Trace & Open Source Document"
                            >
                              Source
                            </button>
                          </div>
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
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
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

      {/* Keyboard-Friendly Ledger Transaction Preview Modal */}
      {selectedPreviewEntry && (
        <Modal
          isOpen={!!selectedPreviewEntry}
          onClose={() => setSelectedPreviewEntry(null)}
          title={`Ledger Transaction Details: ${selectedPreviewEntry.voucherNumber || selectedPreviewEntry.entryType}`}
          size="md"
        >
          <div
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const entry = selectedPreviewEntry;
                setSelectedPreviewEntry(null);
                handleOpenSource(entry);
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Vendor & Status Header Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Vendor Account</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {vendor.name} <span style={{ color: '#64748b', fontWeight: 500 }}>({vendor.code})</span>
                </div>
              </div>
              <div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor:
                      selectedPreviewEntry.entryType === 'PURCHASE_INVOICE'
                        ? '#fef3c7'
                        : selectedPreviewEntry.entryType === 'VENDOR_PAYMENT'
                        ? '#dcfce7'
                        : selectedPreviewEntry.entryType === 'PURCHASE_ORDER'
                        ? '#e0e7ff'
                        : '#f1f5f9',
                    color:
                      selectedPreviewEntry.entryType === 'PURCHASE_INVOICE'
                        ? '#92400e'
                        : selectedPreviewEntry.entryType === 'VENDOR_PAYMENT'
                        ? '#166534'
                        : selectedPreviewEntry.entryType === 'PURCHASE_ORDER'
                        ? '#3730a3'
                        : '#334155',
                  }}
                >
                  {selectedPreviewEntry.entryType.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Financial Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Transaction Date</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {new Date(selectedPreviewEntry.entryDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Voucher / Ref #</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                  {selectedPreviewEntry.voucherNumber || '—'}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>Payment Settled (Debit)</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', marginTop: '2px' }}>
                  {Number(selectedPreviewEntry.debit) > 0
                    ? `PKR ${Number(selectedPreviewEntry.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'PKR 0.00'}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700 }}>Purchase Billed (Credit)</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', marginTop: '2px' }}>
                  {Number(selectedPreviewEntry.credit) > 0
                    ? `PKR ${Number(selectedPreviewEntry.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'PKR 0.00'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>Running Balance After Entry</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                  PKR {Math.abs(Number(selectedPreviewEntry.runningBalance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: Number(selectedPreviewEntry.runningBalance) >= 0 ? '#dc2626' : '#16a34a' }}>
                    {Number(selectedPreviewEntry.runningBalance) >= 0 ? 'Cr (Payable)' : 'Dr (Advance)'}
                  </span>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', padding: '10px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Description / Remarks</div>
                <div style={{ fontSize: '12.5px', color: '#1e293b', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedPreviewEntry.description || 'Commercial Transaction Recorded in Accounts Payable Ledger'}
                </div>
              </div>
            </div>

            {/* Actions & Keyboard Guidance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Enter</kbd> to inspect source document or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Esc</kbd> to return
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setSelectedPreviewEntry(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  autoFocus
                  onClick={() => {
                    const entry = selectedPreviewEntry;
                    setSelectedPreviewEntry(null);
                    handleOpenSource(entry);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <IconFileText size={14} /> Open Source Document
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* In-App PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        title={`Accounts Payable Ledger — ${vendor.name} (${vendor.code})`}
        htmlContent={pdfViewerHtml}
      />
    </>
  );
};
