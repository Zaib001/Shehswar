'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, TableSkeleton } from '../ui';
import { IconDownload } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportSourceDocumentToPdf } from '../../lib/pdf-export';

export interface SourceDocumentDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  voucherNumber?: string;
  referenceId?: string;
  companyId?: string;
  onUpdated?: () => void;
}

export interface ResolvedSourceDocument {
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  documentDate: string;
  status: string;
  company?: { id: string; name: string; code: string };
  party?: { id: string; name: string; code: string; type: string; phone?: string; address?: string };
  warehouse?: { id: string; name: string; code: string };
  reference?: string;
  notes?: string;
  currency: string;
  grossAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  items: Array<{
    id: string;
    productCode?: string;
    itemName: string;
    materialType?: string;
    packSize?: string;
    batchNumber?: string;
    quantity: number;
    unitRate: number;
    taxPercent?: number;
    taxAmount?: number;
    grossAmount?: number;
    netAmount: number;
  }>;
  auditChain: Array<{
    step: string;
    title: string;
    documentNumber: string;
    documentId?: string;
    status: string;
    date: string;
    amount?: number;
    description?: string;
    isCurrent?: boolean;
  }>;
  rawDocument: any;
  isPosted: boolean;
  isEditable: boolean;
}

export const SourceDocumentDrillDownModal: React.FC<SourceDocumentDrillDownModalProps> = ({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  sourceNumber,
  voucherNumber,
  referenceId,
  companyId,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const [doc, setDoc] = useState<ResolvedSourceDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Editable draft state
  const [editNotes, setEditNotes] = useState<string>('');
  const [editableItems, setEditableItems] = useState<
    Array<{ id: string; itemName: string; quantity: number; unitRate: number; packSize?: string }>
  >([]);

  // Navigation History Stack for cross-document audit trail hopping
  const [history, setHistory] = useState<
    Array<{ sourceType?: string; sourceId?: string; sourceNumber?: string; voucherNumber?: string }>
  >([]);

  const fetchDocument = useCallback(
    async (params: {
      sourceType?: string;
      sourceId?: string;
      sourceNumber?: string;
      voucherNumber?: string;
      referenceId?: string;
    }) => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams();
        if (params.sourceType) query.set('sourceType', params.sourceType);
        if (params.sourceId) query.set('sourceId', params.sourceId);
        if (params.sourceNumber) query.set('sourceNumber', params.sourceNumber);
        if (params.voucherNumber) query.set('voucherNumber', params.voucherNumber);
        if (params.referenceId) query.set('referenceId', params.referenceId);
        if (companyId) query.set('companyId', companyId);

        const res = await ApiClient.get<any>(`/api/v1/ledger/source-document?${query.toString()}`);
        const data: ResolvedSourceDocument = res.data?.data || res.data;
        setDoc(data);
        setEditNotes(data.notes || '');
        setEditableItems(
          (data.items || []).map((it) => ({
            id: it.id,
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unitRate: Number(it.unitRate),
            packSize: it.packSize,
          }))
        );
        setIsEditing(false);
      } catch (err: any) {
        showToast({
          title: 'Source Document Lookup Failed',
          message: err.message || 'Could not trace originating source document',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [companyId, showToast]
  );

  useEffect(() => {
    if (isOpen) {
      setHistory([]);
      fetchDocument({ sourceType, sourceId, sourceNumber, voucherNumber, referenceId });
    } else {
      setDoc(null);
      setIsEditing(false);
    }
  }, [isOpen, sourceType, sourceId, sourceNumber, voucherNumber, referenceId, fetchDocument]);

  const handleDrillNode = (node: { step: string; documentNumber: string; documentId?: string }) => {
    if (doc) {
      setHistory((prev) => [
        ...prev,
        {
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          sourceNumber: doc.sourceNumber,
        },
      ]);
    }
    fetchDocument({
      sourceType: node.step,
      sourceId: node.documentId,
      sourceNumber: node.documentNumber,
      voucherNumber: node.documentNumber,
    });
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      fetchDocument(prev);
    }
  };

  const handleSaveEdit = async () => {
    if (!doc) return;
    setIsSaving(true);
    try {
      await ApiClient.put('/api/v1/ledger/source-document', {
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        data: {
          notes: editNotes,
          items: editableItems.map((it) => ({
            id: it.id,
            quantity: Number(it.quantity),
            unitRate: Number(it.unitRate),
            itemName: it.itemName,
          })),
        },
      });

      showToast({
        title: 'Original Document Updated',
        message: 'Original document and linked ledger entry amounts synchronized successfully.',
        type: 'success',
      });

      setIsEditing(false);
      if (onUpdated) onUpdated();
      fetchDocument({ sourceType: doc.sourceType, sourceId: doc.sourceId, sourceNumber: doc.sourceNumber });
    } catch (err: any) {
      showToast({
        title: 'Update Failed',
        message: err.message || 'Cannot modify this transaction record',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = () => {
    if (!doc) return;
    exportSourceDocumentToPdf({
      sourceType: doc.sourceType,
      sourceNumber: doc.sourceNumber,
      documentDate: doc.documentDate,
      status: doc.status,
      company: doc.company,
      party: doc.party,
      warehouse: doc.warehouse,
      reference: doc.reference,
      notes: doc.notes,
      grossAmount: doc.grossAmount,
      taxAmount: doc.taxAmount,
      discountAmount: doc.discountAmount,
      netAmount: doc.netAmount,
      paidAmount: doc.paidAmount,
      remainingAmount: doc.remainingAmount,
      items: doc.items,
      auditChain: doc.auditChain,
    });
  };

  if (!isOpen) return null;

  const currentEditedTotal = editableItems.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitRate || 0),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Original Source Document: ${doc?.sourceNumber || sourceNumber || voucherNumber || 'Document'}`}
    >
      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        {history.length > 0 && (
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <button
              type="button"
              onClick={handleBack}
              className="px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors"
            >
              ← Back to previous document
            </button>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500 font-medium">
              Navigation Depth: {history.length} step(s) back
            </span>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4">
            <TableSkeleton rows={8} />
          </div>
        ) : !doc ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">
              No matching original document found for this ledger voucher.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Ref: {voucherNumber || sourceNumber || sourceId || 'N/A'}
            </p>
          </div>
        ) : (
          <>
            {/* Header Status & Control Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Transaction Classification
                </div>
                <div className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <span>{doc.sourceType.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-500 font-normal">
                    • Date:{' '}
                    {new Date(doc.documentDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5"
                >
                  <IconDownload size={15} />
                  Print / Download PDF
                </Button>

                {doc.isEditable && !isEditing && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Draft Document
                  </Button>
                )}

                {isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Syncing...' : 'Save & Sync Ledger'}
                    </Button>
                  </>
                )}

                {doc.isPosted && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-full">
                    <span>🔒</span>
                    <span>Posted / Finalized (Protected)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Context & Parties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Originating Party / Entity */}
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Associated Entity / Party
                </div>
                <div className="mt-2">
                  <div className="font-bold text-gray-900 text-sm">
                    {doc.party?.name || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Code: <span className="font-mono">{doc.party?.code || '-'}</span> •{' '}
                    <span className="capitalize">{doc.party?.type?.toLowerCase() || 'Party'}</span>
                  </div>
                  {doc.party?.phone && (
                    <div className="text-xs text-gray-500 mt-1">
                      Phone: {doc.party.phone}
                    </div>
                  )}
                  {doc.party?.address && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {doc.party.address}
                    </div>
                  )}
                </div>
              </div>

              {/* Warehouse & Company Context */}
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Operating Context
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>
                    <span className="text-gray-500">Company:</span>{' '}
                    <strong className="text-gray-900">
                      {doc.company?.name || 'Shehswar'}
                    </strong>
                  </div>
                  {doc.warehouse && (
                    <div>
                      <span className="text-gray-500">Warehouse:</span>{' '}
                      <strong className="text-gray-900">
                        {doc.warehouse.name} ({doc.warehouse.code})
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Ref / Tracking #:</span>{' '}
                    <span className="font-mono text-gray-900">
                      {doc.reference || doc.sourceNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Financial Value
                </div>
                <div className="mt-2">
                  <div className="text-xl font-extrabold text-gray-900">
                    PKR {(isEditing ? currentEditedTotal : doc.netAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  {doc.paidAmount !== undefined && (
                    <div className="text-xs text-gray-500 mt-1">
                      Settled / Paid: PKR {Number(doc.paidAmount).toLocaleString()}
                    </div>
                  )}
                  {doc.remainingAmount !== undefined && (
                    <div className="text-xs text-amber-700 font-semibold mt-0.5">
                      Remaining: PKR {Number(doc.remainingAmount).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Trail Lifecycle Pipeline Visualizer */}
            {doc.auditChain && doc.auditChain.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Audit Trail & Lifecycle Chain (Click node to inspect)</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Complete cross-document traceability
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {doc.auditChain.map((node, idx) => {
                    const isSelected =
                      node.documentNumber === doc.sourceNumber ||
                      node.documentId === doc.sourceId;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDrillNode(node)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                            : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                          <span>STEP {idx + 1}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-medium text-[9px] ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {node.status}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-gray-900 mt-1 line-clamp-1">
                          {node.title}
                        </div>
                        <div className="font-mono text-[11px] text-blue-700 mt-0.5 truncate">
                          {node.documentNumber}
                        </div>
                        {node.amount !== undefined && (
                          <div className="text-xs font-semibold text-gray-800 mt-1">
                            PKR {Number(node.amount).toLocaleString()}
                          </div>
                        )}
                        {node.description && (
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                            {node.description}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Document Line Items ({doc.items?.length || 0})
                </h4>
                {isEditing && (
                  <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                    Editing Mode: Quantities and Unit Rates are adjustable
                  </span>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-600">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3 text-left">Product Code</th>
                      <th className="py-2.5 px-3 text-left">Product / Item Description</th>
                      <th className="py-2.5 px-3 text-center">Pack Size</th>
                      <th className="py-2.5 px-3 text-center">Batch</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate (PKR)</th>
                      <th className="py-2.5 px-3 text-right">Tax (PKR)</th>
                      <th className="py-2.5 px-3 text-right">Total Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {doc.items && doc.items.length > 0 ? (
                      doc.items.map((it, idx) => {
                        const editItem = editableItems[idx];
                        const lineTotal = isEditing && editItem
                          ? Number(editItem.quantity || 0) * Number(editItem.unitRate || 0)
                          : it.netAmount;

                        return (
                          <tr key={it.id || idx} className="hover:bg-gray-50">
                            <td className="py-2 px-3 text-center text-gray-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-medium text-gray-700">
                              {it.productCode || '-'}
                            </td>
                            <td className="py-2 px-3 font-semibold text-gray-900">
                              {it.itemName}
                              {it.materialType && (
                                <span className="block text-[10px] text-gray-400 font-normal">
                                  {it.materialType}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center text-gray-600">
                              {it.packSize || '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-gray-600">
                              {it.batchNumber || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {isEditing && editItem ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={editItem.quantity}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setEditableItems((items) =>
                                      items.map((m, i) =>
                                        i === idx ? { ...m, quantity: val } : m
                                      )
                                    );
                                  }}
                                  className="w-20 px-2 py-1 text-right border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                />
                              ) : (
                                Number(it.quantity).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700">
                              {isEditing && editItem ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={editItem.unitRate}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setEditableItems((items) =>
                                      items.map((m, i) =>
                                        i === idx ? { ...m, unitRate: val } : m
                                      )
                                    );
                                  }}
                                  className="w-24 px-2 py-1 text-right border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                />
                              ) : (
                                Number(it.unitRate).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-500">
                              {Number(it.taxAmount || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">
                              {Number(lineTotal).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-400">
                          No item records attached to this document.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes & Financial Summary Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Notes */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Document Notes / Remarks
                </div>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full p-2 border border-blue-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter updated remarks..."
                  />
                ) : (
                  <p className="text-xs text-gray-600 italic">
                    {doc.notes || 'No remarks provided for this transaction.'}
                  </p>
                )}
              </div>

              {/* Financial Calculation Box */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-semibold">
                    PKR {(isEditing ? currentEditedTotal : doc.grossAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {doc.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax:</span>
                    <span>
                      PKR {Number(doc.taxAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {doc.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount:</span>
                    <span>
                      - PKR {Number(doc.discountAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-1.5 flex justify-between text-sm font-extrabold text-gray-900">
                  <span>Net Total Amount:</span>
                  <span className="text-blue-700 font-mono">
                    PKR {(isEditing ? currentEditedTotal : doc.netAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500">
          Double-click any ledger row to trace document • Press{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded font-mono text-[10px]">
            Esc
          </kbd>{' '}
          to dismiss
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
