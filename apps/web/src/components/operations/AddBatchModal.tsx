'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Input } from '../ui';
import {
  IconCheck,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconAlertTriangle,
  IconPackage,
  IconTag,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface BatchRecord {
  id: string;
  batchNumber: string;
  finishedProductId: string;
  manufacturingDate: string;
  expiryDate?: string | null;
  initialQuantity: number;
  availableQuantity: number;
  allocatedQuantity: number;
  isActive: boolean;
  status: string;
  notes?: string | null;
  isExpired?: boolean;
}

export interface AddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    productName: string;
    productCode: string;
    packSize?: any;
    category?: any;
  } | null;
  onBatchSaved?: (savedBatch: BatchRecord) => void;
}

export const AddBatchModal: React.FC<AddBatchModalProps> = ({
  isOpen,
  onClose,
  product,
  onBatchSaved,
}) => {
  const { showToast } = useToast();

  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // Form State
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [manufacturingDate, setManufacturingDate] = useState<string>(
    new Date().toISOString().split('T')[0] || ''
  );
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [availableQuantity, setAvailableQuantity] = useState<number | ''>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Field Refs for keyboard-first navigation
  const batchNumberInputRef = useRef<HTMLInputElement>(null);
  const mfgDateInputRef = useRef<HTMLInputElement>(null);
  const expDateInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const resetForm = useCallback(() => {
    setEditingBatchId(null);
    setBatchNumber('');
    setManufacturingDate(new Date().toISOString().split('T')[0] || '');
    setExpiryDate('');
    setAvailableQuantity('');
    setIsActive(batches.length === 0);
    setNotes('');
  }, [batches.length]);

  const loadBatches = useCallback(async () => {
    if (!product?.id) return;
    setIsLoading(true);
    try {
      const res = await ApiClient.get<BatchRecord[]>(`/api/v1/batches/product/${product.id}`);
      const data = res.data || [];
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setBatches(list);
      if (list.length === 0) {
        setIsActive(true);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to load product batches' });
    } finally {
      setIsLoading(false);
    }
  }, [product?.id, showToast]);

  useEffect(() => {
    if (isOpen && product?.id) {
      loadBatches();
      resetForm();
      // Auto-focus Batch Number on modal open
      setTimeout(() => {
        batchNumberInputRef.current?.focus();
        batchNumberInputRef.current?.select();
      }, 120);
    }
  }, [isOpen, product?.id, loadBatches, resetForm]);

  // Global Keyboard shortcuts: Ctrl+Enter to save
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveButtonRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  const handleEditClick = (b: BatchRecord) => {
    setEditingBatchId(b.id);
    setBatchNumber(b.batchNumber);
    setManufacturingDate(
      b.manufacturingDate ? (new Date(b.manufacturingDate).toISOString().split('T')[0] || '') : ''
    );
    setExpiryDate(b.expiryDate ? (new Date(b.expiryDate).toISOString().split('T')[0] || '') : '');
    setAvailableQuantity(b.availableQuantity !== undefined && b.availableQuantity !== null ? Number(b.availableQuantity) : '');
    setIsActive(b.isActive);
    setNotes(b.notes || '');

    // Focus Batch Number for editing
    setTimeout(() => {
      batchNumberInputRef.current?.focus();
      batchNumberInputRef.current?.select();
    }, 80);
  };

  const handleSetActive = async (batchId: string) => {
    try {
      const res = await ApiClient.patch<BatchRecord>(`/api/v1/batches/${batchId}/set-active`, {});
      showToast({
        type: 'success',
        title: 'Active Batch Updated',
        message: 'Designated as primary active batch for rate lists and invoices.',
      });
      await loadBatches();
      if (onBatchSaved && res.data) {
        onBatchSaved(res.data);
      }
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to set active batch' });
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) {
      return;
    }
    try {
      await ApiClient.delete(`/api/v1/batches/${batchId}`);
      showToast({ type: 'success', title: 'Batch Deleted', message: 'Batch removed successfully' });
      await loadBatches();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to delete batch' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id) return;
    if (!batchNumber.trim()) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Batch Number is required' });
      batchNumberInputRef.current?.focus();
      return;
    }
    if (!manufacturingDate) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Manufacturing Date is required' });
      mfgDateInputRef.current?.focus();
      return;
    }
    if (expiryDate && new Date(expiryDate) <= new Date(manufacturingDate)) {
      showToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Expiry Date must be later than Manufacturing Date',
      });
      expDateInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      let savedBatch: BatchRecord | null = null;
      const numQty = availableQuantity === '' ? 0 : Number(availableQuantity);

      if (editingBatchId) {
        const res = await ApiClient.patch<any>(`/api/v1/batches/${editingBatchId}`, {
          batchNumber: batchNumber.trim().toUpperCase(),
          manufacturingDate,
          expiryDate: expiryDate || null,
          availableQuantity: numQty,
          isActive,
          notes: notes.trim() || undefined,
        });
        savedBatch = (res.data?.data || res.data) as BatchRecord;
        showToast({
          type: 'success',
          title: 'Batch Updated',
          message: `Batch ${savedBatch.batchNumber} updated successfully`,
        });
      } else {
        const res = await ApiClient.post<any>('/api/v1/batches', {
          finishedProductId: product.id,
          batchNumber: batchNumber.trim().toUpperCase(),
          manufacturingDate,
          expiryDate: expiryDate || null,
          initialQuantity: numQty,
          availableQuantity: numQty,
          isActive,
          notes: notes.trim() || undefined,
        });
        savedBatch = (res.data?.data || res.data) as BatchRecord;
        showToast({
          type: 'success',
          title: 'Batch Assigned',
          message: `Batch ${savedBatch.batchNumber} assigned to ${product.productName}`,
        });
      }

      resetForm();
      if (onBatchSaved && savedBatch) {
        onBatchSaved(savedBatch);
      }
      // Automatically close modal when batch number is added/saved
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Save Failed', message: err?.message || 'Failed to save batch' });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for fast agrochemical shelf-life presets (+2 or +3 years)
  const applyExpiryPreset = (years: number) => {
    const base = manufacturingDate ? new Date(manufacturingDate) : new Date();
    if (isNaN(base.getTime())) return;
    base.setFullYear(base.getFullYear() + years);
    setExpiryDate(base.toISOString().split('T')[0] || '');
    qtyInputRef.current?.focus();
  };

  // Expiry badge helper
  const getExpiryDetails = (expStr?: string | null) => {
    if (!expStr) return { text: 'Open Shelf', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', isExpired: false };
    const exp = new Date(expStr);
    const now = new Date();
    if (isNaN(exp.getTime())) return { text: 'Invalid Date', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', isExpired: false };
    if (exp < now) {
      return { text: 'Expired', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', isExpired: true };
    }
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 60) {
      return { text: `Expiring Soon (${diffDays}d)`, bg: '#fef3c7', color: '#b45309', border: '#fde68a', isExpired: false };
    }
    const months = Math.round(diffDays / 30.4);
    return { text: `Valid (${months}m left)`, bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', isExpired: false };
  };

  const packText =
    product?.packSize?.name ||
    (typeof product?.packSize === 'string' ? product.packSize : '');
  const categoryText =
    product?.category?.name ||
    (typeof product?.category === 'string' ? product.category : 'General Formulation');

  const activeBatch = batches.find((b) => b.isActive);
  const totalStock = batches.reduce((sum, b) => sum + Number(b.availableQuantity || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product Batch Number Management"
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Keyboard Shortcuts:</span>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>↵ Enter</kbd> Next Field
            </span>
            <span>•</span>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+Enter</kbd> Save Batch
            </span>
            <span>•</span>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Esc</kbd> Close
            </span>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Window
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif" }}>

        {/* 1. Top Executive Product Identification Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #022c22 0%, #064e3b 45%, #0f172a 100%)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(2, 44, 34, 0.18)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid rgba(110, 231, 183, 0.35)',
                color: '#6ee7b7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconPackage size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {product?.productName || 'Finished Product'}
                </h3>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#6ee7b7',
                    padding: '2px 8px',
                    borderRadius: '5px',
                    border: '1px solid rgba(110, 231, 183, 0.4)',
                  }}
                >
                  {product?.productCode || '-'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '5px',
                  }}
                >
                  {categoryText}
                </span>
                {packText && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.12)',
                      color: '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '5px',
                    }}
                  >
                    Pack: {packText}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Batch Tracking & Quality Control • Direct integration with Invoicing and Official Scheme Rate Lists
              </div>
            </div>
          </div>

          {/* Quick Header KPI Chips */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'right',
                minWidth: '115px',
              }}
            >
              <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Active Batch
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: activeBatch ? '#34d399' : '#fbbf24',
                  marginTop: '1px',
                }}
              >
                {activeBatch ? activeBatch.batchNumber : 'Not Assigned'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'right',
                minWidth: '95px',
              }}
            >
              <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Stock
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 800, color: '#ffffff', marginTop: '1px' }}>
                {totalStock.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8' }}>Units</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Keyboard-First Batch Entry & Edit Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Header row of form */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              paddingBottom: '8px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: editingBatchId ? '#2563eb' : '#059669',
                }}
              />
              <h4 style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
                {editingBatchId ? `Edit Batch Specifications (${batchNumber})` : 'Assign New Batch to Product'}
              </h4>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Press <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>↵ Enter</kbd> to jump across fields
              </span>

              {editingBatchId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#2563eb',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Cancel Edit (Add New)
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSave}>
            {/* Row 1: Batch Number, Mfg Date, Expiry Date */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
              <div>
                <Input
                  ref={batchNumberInputRef}
                  label="Batch Number *"
                  required
                  placeholder="e.g. B-2026-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      mfgDateInputRef.current?.focus();
                    }
                  }}
                  helperText="Manual manufacturer code (e.g. B-2026-001)"
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: '#064e3b',
                  }}
                />
              </div>

              <div>
                <Input
                  ref={mfgDateInputRef}
                  label="Manufacturing Date *"
                  type="date"
                  required
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      expDateInputRef.current?.focus();
                    }
                  }}
                  helperText="Production / formulation release date"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                    Expiry Date
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => applyExpiryPreset(2)}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        cursor: 'pointer',
                      }}
                      title="Set Expiry to 2 Years from Mfg Date (Agro Chemical Standard)"
                    >
                      +2 Yrs
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => applyExpiryPreset(3)}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        cursor: 'pointer',
                      }}
                      title="Set Expiry to 3 Years from Mfg Date"
                    >
                      +3 Yrs
                    </button>
                  </div>
                </div>

                <Input
                  ref={expDateInputRef}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      qtyInputRef.current?.focus();
                    }
                  }}
                  helperText="Expired batches are blocked from invoices"
                />
              </div>
            </div>

            {/* Row 2: Available Units & QC Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <Input
                  ref={qtyInputRef}
                  label="Available Quantity (Stock Units)"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      notesInputRef.current?.focus();
                    }
                  }}
                  helperText="Initial or available units for this batch"
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </div>

              <div>
                <Input
                  ref={notesInputRef}
                  label="QC Approval & Batch Remarks"
                  placeholder="e.g. QC Formulation Lab Line 1 - Approved for Commercial Release"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSave(e);
                    }
                  }}
                  helperText="Optional technical notes or QC sign-off reference"
                />
              </div>
            </div>

            {/* Bottom Actions Row with Active Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#059669',
                    cursor: 'pointer',
                  }}
                />
                <span>⭐ Designate as Active Batch</span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                  (Default for Rate Lists and Sales Invoices)
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+Enter</kbd> to save
                </span>

                {editingBatchId && (
                  <Button variant="secondary" size="sm" type="button" onClick={resetForm}>
                    Cancel
                  </Button>
                )}

                <Button
                  ref={saveButtonRef}
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isSaving}
                  style={{
                    backgroundColor: editingBatchId ? '#2563eb' : '#059669',
                    borderColor: editingBatchId ? '#2563eb' : '#059669',
                    color: '#ffffff',
                    fontWeight: 700,
                    padding: '0 16px',
                    height: '36px',
                  }}
                >
                  <IconCheck size={14} />
                  {editingBatchId ? 'Update Batch' : 'Save & Assign Batch'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* 3. Existing Batches History & Status Table */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              padding: '10px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong style={{ fontSize: '12px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Assigned Product Batches ({batches.length})
              </strong>
              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                Double-click any row or click edit icon to update batch specifications
              </span>
            </div>

            <button
              type="button"
              onClick={loadBatches}
              disabled={isLoading}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#475569',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <IconRefresh size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '8px 14px', fontWeight: 700, color: '#475569', width: '22%' }}>Batch Number</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '15%' }}>Mfg Date</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '15%' }}>Expiry Date</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right', width: '14%' }}>Stock Units</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'center', width: '14%' }}>Shelf Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'center', width: '12%' }}>Active Flag</th>
                  <th style={{ padding: '8px 14px', fontWeight: 700, color: '#475569', textAlign: 'right', width: '8%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <IconTag size={22} color="#cbd5e1" />
                        <span style={{ fontWeight: 600, color: '#475569' }}>No batches registered for this product yet.</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Use the form above to record and assign the first batch.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => {
                    const expiry = getExpiryDetails(b.expiryDate);
                    return (
                      <tr
                        key={b.id}
                        onDoubleClick={() => handleEditClick(b)}
                        title="Double-click to edit batch details"
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: b.isActive ? '#f0fdf4' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = b.isActive ? '#ecfdf5' : '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = b.isActive ? '#f0fdf4' : 'transparent';
                        }}
                      >
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', fontSize: '12.5px' }}>
                              {b.batchNumber}
                            </span>
                            {b.isActive && (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  background: '#059669',
                                  color: '#ffffff',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '8px 12px', color: '#475569', fontWeight: 500 }}>
                          {b.manufacturingDate
                            ? new Date(b.manufacturingDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>

                        <td style={{ padding: '8px 12px', color: '#475569', fontWeight: 500 }}>
                          {b.expiryDate ? (
                            <span style={{ color: expiry.isExpired ? '#dc2626' : 'inherit', fontWeight: expiry.isExpired ? 700 : 500 }}>
                              {new Date(b.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Open Shelf</span>
                          )}
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          {Number(b.availableQuantity).toLocaleString()}
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '10.5px',
                              fontWeight: 600,
                              background: expiry.bg,
                              color: expiry.color,
                              border: `1px solid ${expiry.border}`,
                            }}
                          >
                            {expiry.isExpired && <IconAlertTriangle size={11} />}
                            {expiry.text}
                          </span>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {b.isActive ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>
                              ⭐ Primary Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetActive(b.id);
                              }}
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#475569',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                              title="Set as default active batch for rate lists and invoices"
                            >
                              Make Active
                            </button>
                          )}
                        </td>

                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(b);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#2563eb',
                                cursor: 'pointer',
                                padding: '3px',
                                borderRadius: '4px',
                              }}
                              title="Edit batch specifications"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(b.id);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                padding: '3px',
                                borderRadius: '4px',
                              }}
                              title="Delete batch"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Modal>
  );
};
