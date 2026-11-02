'use client';

/**
 * SHEHSWAR ONE360 - Inline Category Creation Modal
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { IconClose, IconCheck, IconTag } from '../icons';

interface InlineCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdCategory: { id: string; code: string; name: string; entityType: string }) => void;
}

export const InlineCategoryModal: React.FC<InlineCategoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState<'FINISHED_PRODUCT' | 'RAW_MATERIAL' | 'PACKING_MATERIAL'>('PACKING_MATERIAL');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Category Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      if (categoryType === 'FINISHED_PRODUCT') {
        const res = await ApiClient.post<any>('/api/v1/master-data/product-categories', {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        const cat = res.data?.data || res.data;
        showToast({ title: 'Category Created', message: `Created "${cat.name}" (${cat.code})`, type: 'success' });
        onCreated({ id: cat.id, code: cat.code, name: cat.name, entityType: 'FINISHED_PRODUCT' });
      } else {
        const res = await ApiClient.post<any>('/api/v1/master-data/material-categories', {
          name: name.trim(),
          categoryType: categoryType === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : 'PACKING_MATERIAL',
          description: description.trim() || undefined,
        });
        const cat = res.data?.data || res.data;
        showToast({ title: 'Category Created', message: `Created "${cat.name}" (${cat.code})`, type: 'success' });
        onCreated({ id: cat.id, code: cat.code, name: cat.name, entityType: categoryType });
      }
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create category',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <IconTag size={18} />
            <span>Add New Category</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Category Group <span className="text-rose-400">*</span>
            </label>
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="PACKING_MATERIAL">Packing Material (Bottles, Cartons, Shrink, etc.)</option>
              <option value="RAW_MATERIAL">Raw Material (Active Ingredients, Solvents)</option>
              <option value="FINISHED_PRODUCT">Finished Goods (Formulated Products)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Category Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Drums, Pallets, Labels, Emulsifiers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of items under this category..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  <span>Save Category</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

