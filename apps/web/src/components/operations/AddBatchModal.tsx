'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button } from '../ui';
import {
  IconCheck,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconAlertTriangle,
  IconPackage,
  IconTag,
  IconClock,
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
      // Auto-focus the Batch Number input on open
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
    setAvailableQuantity(Number(b.availableQuantity) || 0);
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
      showToast({ type: 'success', title: 'Active Batch Updated', message: 'Designated as primary active batch for rate lists and invoices.' });
      await loadBatches();
      if (onBatchSaved && res.data) {
        onBatchSaved(res.data);
      }
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
      showToast({ type: 'error', title: 'Validation Error', message: 'Expiry Date must be after Manufacturing Date' });
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
        showToast({ type: 'success', title: 'Batch Updated', message: `Batch ${savedBatch.batchNumber} updated successfully` });
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
        showToast({ type: 'success', title: 'Batch Assigned', message: `Batch ${savedBatch.batchNumber} created and assigned to ${product.productName}` });
      }

      resetForm();
      await loadBatches();
      if (onBatchSaved && savedBatch) {
        onBatchSaved(savedBatch);
      }
      // Re-focus batch input for subsequent fast entries
      setTimeout(() => {
        batchNumberInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Save Failed', message: err?.message || 'Failed to save batch' });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for fast agro-chemical shelf-life presets (+2 or +3 years)
  const applyExpiryPreset = (years: number) => {
    const base = manufacturingDate ? new Date(manufacturingDate) : new Date();
    if (isNaN(base.getTime())) return;
    base.setFullYear(base.getFullYear() + years);
    setExpiryDate(base.toISOString().split('T')[0] || '');
    qtyInputRef.current?.focus();
  };

  // Expiry badge helper
  const getExpiryDetails = (expStr?: string | null) => {
    if (!expStr) return { text: 'No Expiry Set', className: 'bg-slate-100 text-slate-600 border-slate-200', isExpired: false };
    const exp = new Date(expStr);
    const now = new Date();
    if (isNaN(exp.getTime())) return { text: 'Invalid Date', className: 'bg-slate-100 text-slate-600 border-slate-200', isExpired: false };
    if (exp < now) {
      return { text: 'Expired', className: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', isExpired: true };
    }
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 60) {
      return { text: `Expiring Soon (${diffDays}d)`, className: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold', isExpired: false };
    }
    const months = Math.round(diffDays / 30.4);
    return { text: `Valid (${months}m left)`, className: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium', isExpired: false };
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
    >
      <div className="space-y-5 text-slate-800 font-sans">
        {/* Product Identity & Status Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white p-4 shadow-md border border-emerald-800/40">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                <IconPackage size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-white text-base tracking-tight">
                    {product?.productName || 'Finished Product'}
                  </h3>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {product?.productCode || '-'}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                    {categoryText}
                  </span>
                  {packText && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                      Pack: {packText}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                  <span>Manufacturing Batch Control</span>
                  <span>•</span>
                  <span>Direct association with Sales Invoices & Rate Lists</span>
                </p>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-right min-w-[110px]">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Batch</div>
                <div className="text-sm font-mono font-bold text-emerald-400 truncate max-w-[140px]">
                  {activeBatch ? activeBatch.batchNumber : <span className="text-amber-400">Not Assigned</span>}
                </div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-right min-w-[95px]">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Stock</div>
                <div className="text-sm font-mono font-bold text-white">
                  {totalStock.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">units</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard-First Batch Entry Form */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${editingBatchId ? 'bg-blue-600 animate-pulse' : 'bg-emerald-600'}`} />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {editingBatchId ? `Edit Batch Specifications (${batchNumber || 'Selected'})` : 'Assign New Batch to Product'}
              </h4>
            </div>

            <div className="flex items-center gap-3">
              {/* Keyboard sequence hint */}
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-300 text-[10px] font-mono text-slate-700 shadow-2xs">Tab</kbd>
                <span>/</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-300 text-[10px] font-mono text-slate-700 shadow-2xs">Enter</kbd>
                <span>to navigate</span>
              </span>

              {editingBatchId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                >
                  Cancel Edit (Add New)
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Field 1: Batch Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="batchNumberInput" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <IconTag size={13} className="text-emerald-700" />
                    <span>Batch Number</span>
                    <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Manual Code</span>
                </div>
                <input
                  id="batchNumberInput"
                  ref={batchNumberInputRef}
                  type="text"
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
                  className="w-full text-sm font-mono font-bold tracking-wide uppercase rounded-lg border border-slate-300 bg-emerald-50/20 px-3 py-2 text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>

              {/* Field 2: Manufacturing Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="mfgDateInput" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <IconClock size={13} className="text-emerald-700" />
                    <span>Manufacturing Date</span>
                    <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Mfg</span>
                </div>
                <input
                  id="mfgDateInput"
                  ref={mfgDateInputRef}
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
                  className="w-full text-sm font-medium rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>

              {/* Field 3: Expiry Date + 1-Click Agro Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="expDateInput" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Expiry Date</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => applyExpiryPreset(2)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Set Expiry to 2 Years from Mfg Date (Agro Chemical Standard)"
                    >
                      +2 Yrs
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => applyExpiryPreset(3)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Set Expiry to 3 Years from Mfg Date"
                    >
                      +3 Yrs
                    </button>
                  </div>
                </div>
                <input
                  id="expDateInput"
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
                  className="w-full text-sm font-medium rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Field 4: Available Quantity / Initial Units */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="qtyInput" className="text-xs font-bold text-slate-700">
                    Available Stock / Units (Optional)
                  </label>
                  <span className="text-[10px] text-slate-400">Inventory Units</span>
                </div>
                <input
                  id="qtyInput"
                  ref={qtyInputRef}
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
                  className="w-full text-sm font-mono font-semibold rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>

              {/* Field 5: Notes & QC Remarks */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="notesInput" className="text-xs font-bold text-slate-700">
                    QC Approval & Batch Remarks
                  </label>
                  <span className="text-[10px] text-slate-400">Optional</span>
                </div>
                <input
                  id="notesInput"
                  ref={notesInputRef}
                  type="text"
                  placeholder="e.g. QC Formulation Lab Line 1 - Released"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSave(e);
                    }
                  }}
                  className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Bottom Actions Row with Active Toggle */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">
                  ⭐ Designate as Active Batch
                </span>
                <span className="text-[11px] text-slate-500">
                  (Default for Rate Lists and Sales Invoices)
                </span>
              </label>

              <div className="flex items-center gap-2 justify-end">
                <span className="hidden md:inline-flex items-center text-[11px] text-slate-400 font-medium mr-1">
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600 mr-1">Ctrl+Enter</kbd>
                  to save
                </span>

                {editingBatchId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                )}

                <button
                  ref={saveButtonRef}
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <IconCheck size={14} />
                  <span>{isSaving ? 'Saving...' : editingBatchId ? 'Update Batch' : 'Save & Assign Batch'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Existing Batches Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Product Batches ({batches.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-normal">
                Double-click or click edit to update batch details
              </span>
            </div>
            <button
              type="button"
              onClick={loadBatches}
              disabled={isLoading}
              className="text-xs text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <IconRefresh size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 border-b border-slate-200 z-10 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3.5">Batch Number</th>
                  <th className="py-2.5 px-3">Mfg Date</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Available Qty</th>
                  <th className="py-2.5 px-3 text-center">Shelf Status</th>
                  <th className="py-2.5 px-3 text-center">Active Flag</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <IconTag size={20} className="text-slate-300 mb-1" />
                        <span className="font-semibold text-slate-600">No batches assigned to this product yet</span>
                        <span className="text-[11px] text-slate-400">Use the form above to record and assign the first batch.</span>
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
                        className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                          b.isActive ? 'bg-emerald-50/30 font-medium' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-[13px] tracking-wide">
                              {b.batchNumber}
                            </span>
                            {b.isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {b.manufacturingDate
                            ? new Date(b.manufacturingDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {b.expiryDate ? (
                            <span className={expiry.isExpired ? 'text-rose-600 font-bold' : ''}>
                              {new Date(b.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Open Shelf</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {Number(b.availableQuantity).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${expiry.className}`}>
                            {expiry.isExpired && <IconAlertTriangle size={11} />}
                            <span>{expiry.text}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {b.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-bold text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              Primary Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetActive(b.id);
                              }}
                              className="text-xs text-slate-600 hover:text-emerald-700 font-semibold px-2 py-1 rounded hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                              title="Set as default active batch for this product"
                            >
                              Make Active
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(b);
                              }}
                              className="text-slate-500 hover:text-blue-700 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Batch"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(b.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Batch"
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

        {/* Modal Footer with Keyboard Shortcuts Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            <span className="font-semibold text-slate-700">Keyboard Shortcuts:</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Enter</kbd> Next Field
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Ctrl+Enter</kbd> Save Batch
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Esc</kbd> Close
            </span>
          </div>

          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
