'use client';

/**
 * SHEHSWAR ONE360 - Inline Unit of Measure Creation Modal
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { IconClose, IconCheck } from '../icons';

interface InlineUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdUnit: { id: string; code: string; name: string }) => void;
}

export const InlineUnitModal: React.FC<InlineUnitModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'VOLUME' | 'WEIGHT' | 'COUNT' | 'LENGTH'>('VOLUME');
  const [symbol, setSymbol] = useState('');
  const decimalPlaces = 3;
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Unit Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const generatedCode = code.trim().toUpperCase() || name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const res = await ApiClient.post<any>('/api/v1/master-data/units-of-measure', {
        code: generatedCode,
        name: name.trim(),
        category,
        symbol: symbol.trim() || generatedCode,
        decimalPlaces,
        isBaseUnit: false,
      });

      const unit = res.data?.data || res.data;
      showToast({
        title: 'Unit Created',
        message: `Created unit "${unit.name}" (${unit.code})`,
        type: 'success',
      });

      onCreated({
        id: unit.id,
        code: unit.code,
        name: unit.name,
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create unit',
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
          <span className="font-semibold text-emerald-400 text-sm">Add New Unit of Measure</span>
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
              Unit Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Milliliter, Gallon, Carton"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!symbol) setSymbol(e.target.value.slice(0, 3));
              }}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Unit Code / Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. ML, GAL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="VOLUME">Volume (L, ML)</option>
                <option value="WEIGHT">Weight (KG, GM, TON)</option>
                <option value="COUNT">Count (Nos, Packs, Cartons)</option>
                <option value="LENGTH">Length (Meter)</option>
              </select>
            </div>
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
                  <span>Save Unit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
