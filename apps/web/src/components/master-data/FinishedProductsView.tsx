'use client';

/**
 * SHEHSWAR ONE360 - Unified Product & Item Management Workspace
 *
 * Full Architectural Separation:
 * - Product Master represents "What the item is".
 * - Costing logic is completely isolated in Product Costing.
 * - Single professional "+ Add Item" entry point with dynamic category routing.
 * - Full legacy columns rendered (PPC, Urdu Name, MType, Packaging Material, Base Price).
 * - Live category tabs (Finished Goods 41-01, Raw Materials 41-51, Bottles 41-82, Cartons 41-83, etc.)
 * - Dynamic file import / upload support.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  IconPlus,
  IconRefresh,
  IconDownload,
  IconEye,
  IconFlask,
} from '../icons';
import { UnifiedAddItemModal } from './UnifiedAddItemModal';
import { ProductImportModal } from './ProductImportModal';

interface FinishedProductItem {
  id: string;
  productCode: string;
  productName: string;
  urduName?: string;
  category?: { id: string; code: string; name: string };
  packagingMaterial?: { id: string; materialCode: string; materialName: string };
  packingQuantity?: number;
  packingUnit?: string;
  ppc?: number;
  mType?: string;
  productType?: string;
  defaultSellingPrice?: number;
  standardCost?: number;
  status: string;
  createdAt: string;
}

export const FinishedProductsView: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<FinishedProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<FinishedProductItem | null>(null);

  // Load Products
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const prodRes = await ApiClient.get<any[]>('/api/v1/master-data/finished-products');
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data as any)?.data || [];
      setProducts(prodList);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load catalog data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter products by category & search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.urduName && p.urduName.includes(searchQuery));

      const matchesCat =
        activeCategoryFilter === 'ALL' ||
        p.category?.code === activeCategoryFilter ||
        p.category?.name === activeCategoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, activeCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <IconFlask size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Product & Item Management</h1>
              <p className="text-slate-400 text-xs">
                Master definition of products, identities, packaging, and commercial base prices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <IconDownload size={15} className="text-indigo-400" />
            <span>Product Import / Upload</span>
          </button>

          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Catalog"
          >
            <IconRefresh size={16} />
          </button>

          <button
            onClick={() => setIsAddItemOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <IconPlus size={16} />
            <span>+ Add Item</span>
          </button>
        </div>
      </div>

      {/* Category Navigation Bar & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveCategoryFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategoryFilter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Products ({products.length})
          </button>

          <button
            onClick={() => setActiveCategoryFilter('41-01')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategoryFilter === '41-01'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Finished Goods [41-01]
          </button>

          <button
            onClick={() => {
              window.location.hash = '#raw-materials';
              showToast({ title: 'Navigation', message: 'Opening Raw Materials catalog', type: 'info' });
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            Raw Materials [41-51] →
          </button>

          <button
            onClick={() => {
              window.location.hash = '#packing-materials';
              showToast({ title: 'Navigation', message: 'Opening Packing Materials catalog', type: 'info' });
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            Packing Materials [41-81..87] →
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search by code, name, or Urdu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading product master records...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <IconFlask size={24} />
            </div>
            <h4 className="text-white font-semibold text-sm">No products found</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Click &quot;+ Add Item&quot; to create your first finished good or import product records from a file.
            </p>
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              + Add First Item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Product Code</th>
                  <th className="p-3.5">Product Name / Account</th>
                  <th className="p-3.5">Urdu Name</th>
                  <th className="p-3.5">Packing & Size</th>
                  <th className="p-3.5">PPC</th>
                  <th className="p-3.5">MType</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Base Selling Price</th>
                  <th className="p-3.5">Costing Status</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredProducts.map((p) => {
                  const hasCost = Number(p.standardCost || 0) > 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="p-3.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {p.productCode}
                      </td>
                      <td className="p-3.5 font-semibold text-white max-w-[200px] truncate">
                        {p.productName}
                      </td>
                      <td className="p-3.5 font-medium text-slate-400 text-right whitespace-nowrap" dir="rtl">
                        {p.urduName || '-'}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-slate-200">
                          {p.packingQuantity ? `${p.packingQuantity} ${p.packingUnit || 'Liter'}` : '-'}
                        </span>
                        {p.packagingMaterial && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {p.packagingMaterial.materialName}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {p.ppc || 1}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-medium">
                          {p.mType || 'Insecticides'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {p.productType || '-'}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white whitespace-nowrap">
                        {p.defaultSellingPrice ? `PKR ${Number(p.defaultSellingPrice).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {hasCost ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold font-mono">
                              PKR {Number(p.standardCost).toLocaleString()} / Pack
                            </span>
                            <button
                              onClick={() => {
                                window.location.hash = `#product-costing?product=${p.id}`;
                              }}
                              className="text-[10px] text-slate-400 hover:text-emerald-400 underline"
                              title="Recalculate Costing"
                            >
                              Edit Cost
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                              NOT CONFIGURED
                            </span>
                            <button
                              onClick={() => {
                                window.location.hash = `#product-costing?product=${p.id}`;
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-semibold transition-colors"
                            >
                              Cost Now
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="View Product Master Details"
                          >
                            <IconEye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400">{viewingProduct.productCode}</span>
                <h3 className="text-lg font-bold text-white">{viewingProduct.productName}</h3>
                {viewingProduct.urduName && (
                  <p className="text-slate-400 text-sm" dir="rtl">{viewingProduct.urduName}</p>
                )}
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">Packaging Material</span>
                <p className="text-white font-medium mt-0.5">
                  {viewingProduct.packagingMaterial?.materialName || 'Not Linked'}
                </p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">Pack Size & Unit</span>
                <p className="text-white font-medium mt-0.5">
                  {viewingProduct.packingQuantity} {viewingProduct.packingUnit}
                </p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">PPC (Packs / Carton)</span>
                <p className="text-white font-medium mt-0.5">{viewingProduct.ppc || 1}</p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">MType</span>
                <p className="text-white font-medium mt-0.5">{viewingProduct.mType || 'Insecticides'}</p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">Base Selling Price</span>
                <p className="text-emerald-400 font-bold mt-0.5">
                  {viewingProduct.defaultSellingPrice ? `PKR ${Number(viewingProduct.defaultSellingPrice).toLocaleString()}` : 'Not Set'}
                </p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl">
                <span className="text-slate-400">Manufacturing Cost</span>
                <p className="text-white font-bold mt-0.5">
                  {viewingProduct.standardCost ? `PKR ${Number(viewingProduct.standardCost).toLocaleString()} / Pack` : 'Not Configured'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Add Item Modal */}
      <UnifiedAddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onItemCreated={() => loadData()}
      />

      {/* Product File Import Modal */}
      <ProductImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => loadData()}
      />
    </div>
  );
};
