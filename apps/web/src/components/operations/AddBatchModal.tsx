'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button } from '../ui';
import { IconPlus, IconCheck, IconEdit, IconTrash, IconRefresh, IconAlertTriangle, IconPackage } from '../icons';
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
  const [availableQuantity, setAvailableQuantity] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  const resetForm = useCallback(() => {
    setEditingBatchId(null);
    setBatchNumber('');
    setManufacturingDate(new Date().toISOString().split('T')[0] || '');
    setExpiryDate('');
    setAvailableQuantity(0);
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
    }
  }, [isOpen, product?.id, loadBatches, resetForm]);

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
  };

  const handleSetActive = async (batchId: string) => {
    try {
      const res = await ApiClient.patch<BatchRecord>(`/api/v1/batches/${batchId}/set-active`, {});
      showToast({ type: 'success', title: 'Active Batch Updated', message: 'Active batch updated successfully' });
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
      showToast({ type: 'success', title: 'Batch Deleted', message: 'Batch deleted successfully' });
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
      return;
    }
    if (!manufacturingDate) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Manufacturing Date is required' });
      return;
    }
    if (expiryDate && new Date(expiryDate) <= new Date(manufacturingDate)) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Expiry Date must be after Manufacturing Date' });
      return;
    }

    setIsSaving(true);
    try {
      let savedBatch: BatchRecord | null = null;
      if (editingBatchId) {
        const res = await ApiClient.patch<any>(`/api/v1/batches/${editingBatchId}`, {
          batchNumber: batchNumber.trim().toUpperCase(),
          manufacturingDate,
          expiryDate: expiryDate || null,
          availableQuantity: Number(availableQuantity) || 0,
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
          initialQuantity: Number(availableQuantity) || 0,
          availableQuantity: Number(availableQuantity) || 0,
          isActive,
          notes: notes.trim() || undefined,
        });
        savedBatch = (res.data?.data || res.data) as BatchRecord;
        showToast({ type: 'success', title: 'Batch Created', message: `Batch ${savedBatch.batchNumber} created successfully` });
      }

      resetForm();
      await loadBatches();
      if (onBatchSaved && savedBatch) {
        onBatchSaved(savedBatch);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to save batch' });
    } finally {
      setIsSaving(false);
    }
  };

  const packText =
    product?.packSize?.name ||
    (typeof product?.packSize === 'string' ? product.packSize : '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product Batch Number Management"
      size="xl"
    >
      <div className="space-y-6">
        {/* Read-Only Product Identification Header */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              <IconPackage size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base">{product?.productName || 'Unknown Product'}</h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {product?.productCode || '-'}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {packText ? `Pack: ${packText}` : ''} 
                {product?.category?.name ? ` • Category: ${product.category.name}` : ''}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 font-medium">Associated Batches</div>
            <div className="text-sm font-bold text-emerald-800">
              {batches.length} Registered {batches.length === 1 ? 'Batch' : 'Batches'}
            </div>
          </div>
        </div>

        {/* Batch Entry / Edit Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              {editingBatchId ? (
                <>
                  <IconEdit size={16} className="text-blue-600" />
                  <span>Edit Batch Details</span>
                </>
              ) : (
                <>
                  <IconPlus size={16} className="text-emerald-600" />
                  <span>Assign New Batch to Product</span>
                </>
              )}
            </h4>
            {editingBatchId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
              >
                Cancel Edit (Add New)
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Batch Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B-2026-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                  className="w-full text-sm font-mono font-bold uppercase rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">Manual client code (e.g. B-2026-001)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Manufacturing Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  className="w-full text-sm rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full text-sm rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">Expired batches are blocked from invoices</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Available Quantity / Initial Units
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Batch Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. QC Approved - Formulation Lab line 2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-gray-800">
                  Set as Active Batch (Default for Rate Lists & Invoices)
                </span>
              </label>

              <div className="flex items-center gap-2">
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
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSaving}
                >
                  <IconCheck size={14} className="mr-1" />
                  {editingBatchId ? 'Update Batch' : 'Save & Assign Batch'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Existing Batches Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Batches History & Status
            </h4>
            <button
              type="button"
              onClick={loadBatches}
              disabled={isLoading}
              className="text-xs text-gray-500 hover:text-emerald-700 flex items-center gap-1 font-medium"
            >
              <IconRefresh size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 text-gray-600 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Batch #</th>
                  <th className="py-2.5 px-3 font-semibold">Mfg Date</th>
                  <th className="py-2.5 px-3 font-semibold">Expiry Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Available Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Active Flag</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No batches assigned yet. Enter batch details above to assign the first batch.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => {
                    const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                    return (
                      <tr
                        key={b.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          b.isActive ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                          {b.batchNumber}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium">
                          {b.manufacturingDate
                            ? new Date(b.manufacturingDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium">
                          {b.expiryDate ? (
                            <span className={isExpired ? 'text-red-600 font-bold' : ''}>
                              {new Date(b.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                          {Number(b.availableQuantity).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <IconAlertTriangle size={11} /> Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-700 border border-green-200">
                              Valid
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {b.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                              ⭐ Active Batch
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetActive(b.id)}
                              className="text-[11px] text-gray-600 hover:text-emerald-700 hover:underline font-medium"
                            >
                              Make Active
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditClick(b)}
                              className="text-gray-500 hover:text-blue-600 p-1"
                              title="Edit Batch"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b.id)}
                              className="text-gray-500 hover:text-red-600 p-1"
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

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
