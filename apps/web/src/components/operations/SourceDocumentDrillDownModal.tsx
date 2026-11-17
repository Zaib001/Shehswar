'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, TableSkeleton } from '../ui';
import { IconDownload, IconEdit, IconCheck, IconClose, IconTrash } from '../icons';
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
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Editable draft state
  const [editNotes, setEditNotes] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editReference, setEditReference] = useState<string>('');
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
        setEditAmount(Number(data.netAmount || 0));
        setEditReference(data.reference || '');
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
          amount: editAmount,
          referenceNumber: editReference,
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

  const currentEditedItemsTotal = useMemo(() => {
    return editableItems.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitRate || 0),
      0
    );
  }, [editableItems]);

  const effectiveTotal = useMemo(() => {
    if (!doc) return 0;
    if (editableItems.length > 0) {
      return isEditing ? currentEditedItemsTotal : Number(doc.netAmount || 0);
    }
    return isEditing ? editAmount : Number(doc.netAmount || 0);
  }, [doc, editableItems.length, isEditing, currentEditedItemsTotal, editAmount]);

  const isDeletableFinancialTx = useMemo(() => {
    if (!doc) return false;
    const st = doc.sourceType?.toUpperCase();
    return (
      st === 'CASH_PAYMENT' ||
      st === 'CASH_RECEIPT' ||
      st === 'BANK_PAYMENT' ||
      st === 'BANK_RECEIPT' ||
      st === 'FINANCIAL_TRANSACTION'
    );
  }, [doc]);

  const handleDeleteFinancialTx = async () => {
    if (!doc?.sourceId) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${doc.sourceType.replace(/_/g, ' ')} voucher ${doc.sourceNumber}? This will reverse the Cash/GL journal entry permanently.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/financial-transactions/${doc.sourceId}`);
      showToast({
        title: 'Voucher Deleted',
        message: `${doc.sourceNumber} has been permanently deleted and ledger entries reversed.`,
        type: 'success',
      });
      onUpdated?.();
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err.message || 'Failed to delete transaction',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={doc?.sourceNumber || sourceNumber || voucherNumber || 'Transaction Document'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '16px 20px', maxHeight: '82vh', overflowY: 'auto' }}>
        {doc?.status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: doc.isPosted ? '#ECFDF5' : '#FEF3C7',
                color: doc.isPosted ? '#059669' : '#D97706',
                border: doc.isPosted ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              {doc.status}
            </span>
          </div>
        )}
        {/* Navigation History Trace */}
        {history.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingBottom: '10px',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#F1F5F9',
                color: '#1E293B',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
              }}
            >
              ← Back to previous document
            </button>
            <span style={{ color: '#94A3B8' }}>|</span>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
              Audit Depth: {history.length} level(s) deep
            </span>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '24px 0' }}>
            <TableSkeleton rows={8} />
          </div>
        ) : !doc ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
              No matching original document found for this ledger voucher.
            </p>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              Ref: {voucherNumber || sourceNumber || sourceId || 'N/A'}
            </p>
          </div>
        ) : (
          <>
            {/* Top Classification & Action Control Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748B' }}>
                  Transaction Classification
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    {doc.sourceType.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    • Date: {new Date(doc.documentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px' }}
                >
                  <IconDownload size={14} /> Print / Export PDF
                </Button>

                {isDeletableFinancialTx && !isEditing && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteFinancialTx}
                    disabled={isDeleting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '32px',
                      backgroundColor: '#fee2e2',
                      borderColor: '#fca5a5',
                      color: '#b91c1c',
                      fontWeight: 600,
                    }}
                  >
                    <IconTrash size={14} /> {isDeleting ? 'Deleting...' : 'Delete Voucher'}
                  </Button>
                )}

                {!isEditing ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '32px',
                      backgroundColor: '#2563EB',
                      borderColor: '#2563EB',
                    }}
                  >
                    <IconEdit size={14} /> Edit Document / Adjust Values
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      style={{ height: '32px' }}
                    >
                      <IconClose size={13} style={{ marginRight: '4px' }} /> Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '32px',
                        backgroundColor: '#059669',
                        borderColor: '#059669',
                      }}
                    >
                      <IconCheck size={14} /> {isSaving ? 'Syncing...' : 'Save & Sync Ledger'}
                    </Button>
                  </>
                )}

                {doc.isPosted && !isEditing && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#065F46',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                    }}
                  >
                    🔒 Finalized & Reconciled
                  </span>
                )}
              </div>
            </div>

            {/* Editing Alert Banner */}
            {isEditing && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  color: '#1E40AF',
                }}
              >
                <IconEdit size={16} />
                <span>
                  <strong>Editing Mode Active:</strong> You can adjust line item quantities, unit rates, amount, and remarks. Changes will immediately recalculate the balance and update the associated ledger entries.
                </span>
              </div>
            )}

            {/* Context & Parties Grid (3 Cards) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Card 1: Originating Party / Entity */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Associated Entity / Party
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    {doc.party?.name || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{doc.party?.code || '-'}</span>
                    <span>•</span>
                    <span style={{ textTransform: 'capitalize' }}>{doc.party?.type?.toLowerCase() || 'Party'}</span>
                  </div>
                  {doc.party?.phone && (
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                      Phone: {doc.party.phone}
                    </div>
                  )}
                  {doc.party?.address && (
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.party.address}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Operating Context */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Operating Context
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Company:</span>{' '}
                    <strong style={{ color: '#0F172A' }}>{doc.company?.name || 'Shehswar Group'}</strong>
                  </div>
                  {doc.warehouse && (
                    <div>
                      <span style={{ color: '#64748B' }}>Warehouse:</span>{' '}
                      <strong style={{ color: '#0F172A' }}>{doc.warehouse.name} ({doc.warehouse.code})</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#64748B' }}>Reference / Tracking:</span>{' '}
                    {isEditing ? (
                      <input
                        type="text"
                        value={editReference}
                        onChange={(e) => setEditReference(e.target.value)}
                        style={{
                          height: '26px',
                          padding: '0 6px',
                          border: '1px solid #3B82F6',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#0F172A', fontWeight: 600 }}>
                        {doc.reference || doc.sourceNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Financial Snapshot */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Financial Value
                </div>
                <div style={{ marginTop: '8px' }}>
                  {isEditing && editableItems.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>PKR</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editAmount}
                        onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                        style={{
                          height: '34px',
                          padding: '0 8px',
                          border: '2px solid #3B82F6',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono, monospace)',
                          width: '180px',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
                      PKR {effectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}

                  {doc.paidAmount !== undefined && (
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                      Settled / Paid: PKR {Number(doc.paidAmount).toLocaleString()}
                    </div>
                  )}
                  {doc.remainingAmount !== undefined && (
                    <div style={{ fontSize: '11.5px', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
                      Remaining Balance: PKR {Number(doc.remainingAmount).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Trail Lifecycle Pipeline Visualizer */}
            {doc.auditChain && doc.auditChain.length > 0 && (
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Audit Trail & Lifecycle Chain (Click step to trace document)</span>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                    Full End-to-End Traceability
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {doc.auditChain.map((node, idx) => {
                    const isSelected =
                      node.documentNumber === doc.sourceNumber ||
                      node.documentId === doc.sourceId;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDrillNode(node)}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                          backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                          <span>STEP {idx + 1}</span>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              backgroundColor: isSelected ? '#2563EB' : '#F1F5F9',
                              color: isSelected ? '#FFFFFF' : '#475569',
                            }}
                          >
                            {node.status}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {node.title}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#2563EB', fontWeight: 600, marginTop: '2px' }}>
                          {node.documentNumber}
                        </div>
                        {node.amount !== undefined && (
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginTop: '3px' }}>
                            PKR {Number(node.amount).toLocaleString()}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Document Line Items ({doc.items?.length || 0})
                </h4>
                {isEditing && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#1D4ED8',
                      fontWeight: 700,
                      backgroundColor: '#EFF6FF',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    Editable Mode: Quantities and Unit Rates are adjustable
                  </span>
                )}
              </div>

              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ overflowX: 'auto', maxHeight: '320px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F8FAFC', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1.5px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '9px 10px', textAlign: 'center', width: '36px' }}>#</th>
                        <th style={{ padding: '9px 10px' }}>Product Code</th>
                        <th style={{ padding: '9px 10px' }}>Product / Item Description</th>
                        <th style={{ padding: '9px 10px', textAlign: 'center' }}>Pack Size</th>
                        <th style={{ padding: '9px 10px', textAlign: 'center' }}>Batch #</th>
                        <th style={{ padding: '9px 10px', textAlign: 'right' }}>Quantity</th>
                        <th style={{ padding: '9px 10px', textAlign: 'right' }}>Unit Rate (PKR)</th>
                        <th style={{ padding: '9px 10px', textAlign: 'right' }}>Tax (PKR)</th>
                        <th style={{ padding: '9px 10px', textAlign: 'right' }}>Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.items && doc.items.length > 0 ? (
                        doc.items.map((it, idx) => {
                          const editItem = editableItems[idx];
                          const lineTotal = isEditing && editItem
                            ? Number(editItem.quantity || 0) * Number(editItem.unitRate || 0)
                            : it.netAmount;

                          return (
                            <tr
                              key={it.id || idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                              }}
                            >
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: '#334155' }}>
                                {it.productCode || '-'}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0F172A' }}>
                                {isEditing && editItem ? (
                                  <input
                                    type="text"
                                    value={editItem.itemName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditableItems((items) =>
                                        items.map((m, i) => (i === idx ? { ...m, itemName: val } : m))
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      height: '28px',
                                      padding: '0 6px',
                                      border: '1px solid #3B82F6',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                    }}
                                  />
                                ) : (
                                  <div>
                                    <span>{it.itemName}</span>
                                    {it.materialType && (
                                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748B', fontWeight: 400 }}>
                                        {it.materialType}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>
                                {it.packSize || '-'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', color: '#475569' }}>
                                {it.batchNumber || '-'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                {isEditing && editItem ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={editItem.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setEditableItems((items) =>
                                        items.map((m, i) => (i === idx ? { ...m, quantity: val } : m))
                                      );
                                    }}
                                    style={{
                                      width: '80px',
                                      height: '28px',
                                      padding: '0 6px',
                                      border: '1.5px solid #3B82F6',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontWeight: 700,
                                      fontFamily: 'var(--font-mono, monospace)',
                                    }}
                                  />
                                ) : (
                                  Number(it.quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>
                                {isEditing && editItem ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={editItem.unitRate}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setEditableItems((items) =>
                                        items.map((m, i) => (i === idx ? { ...m, unitRate: val } : m))
                                      );
                                    }}
                                    style={{
                                      width: '100px',
                                      height: '28px',
                                      padding: '0 6px',
                                      border: '1.5px solid #3B82F6',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontWeight: 700,
                                      fontFamily: 'var(--font-mono, monospace)',
                                    }}
                                  />
                                ) : (
                                  Number(it.unitRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748B' }}>
                                {Number(it.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
                                {Number(lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>
                            No line item records attached to this document.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Row: Remarks & Financial Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
                alignItems: 'start',
              }}
            >
              {/* Document Notes */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Document Notes / Remarks
                </div>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1.5px solid #3B82F6',
                      borderRadius: '6px',
                      fontSize: '12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                    placeholder="Enter updated transaction remarks..."
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontStyle: doc.notes ? 'normal' : 'italic' }}>
                    {doc.notes || 'No remarks provided for this transaction.'}
                  </p>
                )}
              </div>

              {/* Financial Calculation Box */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Gross Subtotal:</span>
                  <span style={{ fontWeight: 600, color: '#334155', fontFamily: 'var(--font-mono, monospace)' }}>
                    PKR {effectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {doc.taxAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Tax:</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                      PKR {Number(doc.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {doc.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 600 }}>
                    <span>Discount:</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                      - PKR {Number(doc.discountAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    borderTop: '1.5px solid #CBD5E1',
                    paddingTop: '8px',
                    marginTop: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    Net Total Amount:
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)' }}>
                    PKR {effectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          borderRadius: '0 0 12px 12px',
        }}
      >
        <div style={{ fontSize: '12px', color: '#64748B' }}>
          Double-click any ledger row to trace document • Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              backgroundColor: '#E2E8F0',
              color: '#334155',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            Esc
          </kbd>{' '}
          to dismiss
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="outline" size="sm" onClick={onClose} style={{ height: '32px' }}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
