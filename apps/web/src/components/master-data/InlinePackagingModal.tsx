'use client';

/**
 * SHEHSWAR ONE360 - Inline Packaging Creation Modal
 *
 * Mandate: "+ Add New Packaging" creates a REAL PackingMaterial record in the database
 * (e.g. 2L HDPE Bottle, Code PM-XXXXXX, Category = Bottles 41-82).
 * It must NOT create only a PackSize record.
 */
import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { IconPackage, IconClose, IconCheck } from '../icons';

interface InlinePackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdPackaging: { id: string; materialCode: string; materialName: string; lastPurchaseCost?: number }) => void;
}

export const InlinePackagingModal: React.FC<InlinePackagingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [baseUomId, setBaseUomId] = useState('');
  const [uoms, setUoms] = useState<any[]>([]);
  const [unitCost, setUnitCost] = useState<number>(45);
  const [packCompatibility, setPackCompatibility] = useState('2L Liquid Formulations');
  const [minStock, setMinStock] = useState<number>(500);
  const [reorderLevel, setReorderLevel] = useState<number>(200);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load packing categories (Bottles, Cartons, etc.) and UOMs
      ApiClient.get<any[]>('/api/v1/master-data/material-categories').then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setCategories(list);
        // Default to Bottles (41-82) if found
        const bottles = list.find((c: any) => c.code === '41-82' || c.name.toLowerCase().includes('bottle'));
        if (bottles) setCategoryId(bottles.id);
        else if (list.length > 0) setCategoryId(list[0].id);
      }).catch(console.error);

      ApiClient.get<any[]>('/api/v1/master-data/units-of-measure').then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setUoms(list);
        const nos = list.find((u: any) => u.code === 'NOS' || u.name.toLowerCase().includes('piece'));
        if (nos) setBaseUomId(nos.id);
        else if (list.length > 0) setBaseUomId(list[0].id);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Packaging Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      // Create via Unified Item endpoint with Category = Bottles
      const res = await ApiClient.post<any>('/api/v1/master-data/unified-items', {
        categoryId,
        itemName: name.trim(),
        urduName: urduName.trim() || undefined,
        baseUomId: baseUomId || undefined,
        packCompatibility,
        minimumStock: minStock,
        reorderLevel,
      });

      const item = res.data?.item || res.data;
      showToast({
        title: 'Packaging Created',
        message: `Created ${item.materialCode || ''} ${item.materialName}`,
        type: 'success',
      });

      onCreated({
        id: item.id,
        materialCode: item.materialCode || res.data?.code,
        materialName: item.materialName || name.trim(),
        lastPurchaseCost: unitCost,
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create packaging material',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
            <IconPackage size={20} />
            <span>Add New Packaging (Packing Material)</span>
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
              Packaging Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2L HDPE Bottle White"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Packaging Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Base Unit <span className="text-rose-400">*</span>
              </label>
              <select
                value={baseUomId}
                onChange={(e) => setBaseUomId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol || u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Urdu Name (Optional)
              </label>
              <input
                type="text"
                placeholder="بوتل 2 لیٹر"
                dir="rtl"
                value={urduName}
                onChange={(e) => setUrduName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reference Procurement Cost (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Pack Compatibility
            </label>
            <input
              type="text"
              placeholder="e.g. Fits 2L EC & SC liquid products"
              value={packCompatibility}
              onChange={(e) => setPackCompatibility(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Minimum Stock
              </label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reorder Level
              </label>
              <input
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm"
              />
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
                  <span>Save Packaging</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
