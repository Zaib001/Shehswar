'use client';

/**
 * SHEHSWAR ONE360 - Dedicated Standalone Product Costing Workspace
 *
 * Mandate:
 * - Completely separate from Product Creation
 * - Dual-Mode: Select Existing Finished Product OR Type & Add New Product Name
 * - Read-only authoritative procurement costs fetched from backend
 * - Simple arithmetic: (Total RM Cost + Total Packaging Cost) ÷ Output Qty = Cost Per Unit
 * - Cost Variance Comparison Card (Current vs New)
 * - "ADD TO PRODUCT" atomic transaction with confirmation dialog
 * - Versioned Costing History ($V_1, V_2, V_3$)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  IconFlask,
  IconPlus,
  IconRefresh,
  IconCheck,
  IconTrash,
} from '../icons';

interface RawMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol: string };
}

interface PackingMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol: string };
}

interface CostingLine {
  id: string;
  selectedId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export const ProductCostingView: React.FC = () => {
  const { showToast } = useToast();

  // Mode: 'existing' vs 'new'
  const [productMode, setProductMode] = useState<'existing' | 'new'>('existing');

  // Master Data Catalogs
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterialItem[]>([]);
  const [packingMaterialsList, setPackingMaterialsList] = useState<PackingMaterialItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Existing Product Selection
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // New Product Name Inline Inputs
  const [newProductName, setNewProductName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newPackSize, setNewPackSize] = useState<number>(2);
  const [newPackUnit, setNewPackUnit] = useState('Liter');
  const [newBasePrice, setNewBasePrice] = useState<number>(2800);

  // Batch Parameters
  const [batchOutputQuantity, setBatchOutputQuantity] = useState<number>(100);
  const [packSize, setPackSize] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState<string>('Liter');

  // Costing Recipe Component Lines
  const [rmLines, setRmLines] = useState<CostingLine[]>([]);
  const [pmLines, setPmLines] = useState<CostingLine[]>([]);

  // Confirmation & History State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [costingHistory, setCostingHistory] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // 1. Fetch Masters
  const loadPrerequisites = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fpRes, rmRes, pmRes, catRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/finished-products'),
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/unified-categories'),
      ]);

      const fps = Array.isArray(fpRes.data) ? fpRes.data : (fpRes.data as any)?.data || [];
      const rms = Array.isArray(rmRes.data) ? rmRes.data : (rmRes.data as any)?.data || [];
      const pms = Array.isArray(pmRes.data) ? pmRes.data : (pmRes.data as any)?.data || [];
      const cats = Array.isArray(catRes.data) ? catRes.data : (catRes.data as any)?.data || [];

      setFinishedProducts(fps);
      setRawMaterialsList(rms);
      setPackingMaterialsList(pms);
      setCategories(cats);

      // Check if URL has ?product=ID
      if (typeof window !== 'undefined' && window.location.hash.includes('product=')) {
        const prodId = window.location.hash.split('product=')[1]?.split('&')[0];
        if (prodId && fps.some((p: any) => p.id === prodId)) {
          setSelectedProductId(prodId);
        }
      } else if (fps.length > 0 && !selectedProductId) {
        setSelectedProductId(fps[0].id);
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load costing masters', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedProductId]);

  useEffect(() => {
    loadPrerequisites();
  }, [loadPrerequisites]);

  // 2. When Selected Product Changes, Auto-Load Its Context
  useEffect(() => {
    if (productMode === 'existing' && selectedProductId) {
      const fp = finishedProducts.find((p) => p.id === selectedProductId);
      if (fp) {
        setSelectedProduct(fp);
        const qty = Number(fp.packingQuantity || fp.packSize?.quantity || 2);
        setPackSize(qty > 0 ? qty : 2);
        setPackSizeUnit(fp.packingUnit || 'Liter');

        // Fetch costing history for this product
        ApiClient.get<any[]>(`/api/v1/costing/product/${fp.id}/history`)
          .then((res) => {
            const hist = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
            setCostingHistory(hist);
          })
          .catch(() => setCostingHistory([]));
      }
    } else {
      setSelectedProduct(null);
    }
  }, [selectedProductId, finishedProducts, productMode]);

  // Initial Recipe Lines Helper
  useEffect(() => {
    if (rmLines.length === 0 && rawMaterialsList.length > 0) {
      const firstRm = rawMaterialsList[0];
      if (firstRm) {
        const rate = Number(firstRm.lastPurchaseCost ?? firstRm.standardCost ?? 0);
        setRmLines([
          {
            id: 'rm-1',
            selectedId: firstRm.id,
            quantity: 4,
            unitCost: rate,
            totalCost: 4 * rate,
          },
        ]);
      }
    }
    if (pmLines.length === 0 && packingMaterialsList.length > 0) {
      const firstPm = packingMaterialsList[0];
      if (firstPm) {
        const rate = Number(firstPm.lastPurchaseCost ?? firstPm.standardCost ?? 0);
        setPmLines([
          {
            id: 'pm-1',
            selectedId: firstPm.id,
            quantity: 100,
            unitCost: rate,
            totalCost: 100 * rate,
          },
        ]);
      }
    }
  }, [rawMaterialsList, packingMaterialsList, rmLines.length, pmLines.length]);

  // 3. Line Item Management Handlers
  const handleAddRmLine = () => {
    const first = rawMaterialsList[0];
    const rate = first ? Number(first.lastPurchaseCost ?? first.standardCost ?? 0) : 0;
    setRmLines((prev) => [
      ...prev,
      {
        id: `rm-${Date.now()}`,
        selectedId: first ? first.id : '',
        quantity: 1,
        unitCost: rate,
        totalCost: rate,
      },
    ]);
  };

  const handleUpdateRmLine = (id: string, field: 'selectedId' | 'quantity', val: any) => {
    setRmLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        let selectedId = line.selectedId;
        let quantity = line.quantity;
        let unitCost = line.unitCost;

        if (field === 'selectedId') {
          selectedId = val;
          const mat = rawMaterialsList.find((m) => m.id === val);
          unitCost = mat ? Number(mat.lastPurchaseCost ?? mat.standardCost ?? 0) : 0;
        } else if (field === 'quantity') {
          quantity = Number(val) || 0;
        }

        return {
          ...line,
          selectedId,
          quantity,
          unitCost,
          totalCost: quantity * unitCost,
        };
      })
    );
  };

  const handleRemoveRmLine = (id: string) => {
    setRmLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddPmLine = () => {
    const first = packingMaterialsList[0];
    const rate = first ? Number(first.lastPurchaseCost ?? first.standardCost ?? 0) : 0;
    setPmLines((prev) => [
      ...prev,
      {
        id: `pm-${Date.now()}`,
        selectedId: first ? first.id : '',
        quantity: 100,
        unitCost: rate,
        totalCost: 100 * rate,
      },
    ]);
  };

  const handleUpdatePmLine = (id: string, field: 'selectedId' | 'quantity', val: any) => {
    setPmLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        let selectedId = line.selectedId;
        let quantity = line.quantity;
        let unitCost = line.unitCost;

        if (field === 'selectedId') {
          selectedId = val;
          const mat = packingMaterialsList.find((m) => m.id === val);
          unitCost = mat ? Number(mat.lastPurchaseCost ?? mat.standardCost ?? 0) : 0;
        } else if (field === 'quantity') {
          quantity = Number(val) || 0;
        }

        return {
          ...line,
          selectedId,
          quantity,
          unitCost,
          totalCost: quantity * unitCost,
        };
      })
    );
  };

  const handleRemovePmLine = (id: string) => {
    setPmLines((prev) => prev.filter((l) => l.id !== id));
  };

  // 4. Batch Calculations
  const totalRmCost = useMemo(() => rmLines.reduce((sum, l) => sum + (l.totalCost || 0), 0), [rmLines]);
  const totalPmCost = useMemo(() => pmLines.reduce((sum, l) => sum + (l.totalCost || 0), 0), [pmLines]);
  const totalBatchCost = totalRmCost + totalPmCost;
  const currentOutputQty = batchOutputQuantity > 0 ? batchOutputQuantity : 100;
  const calculatedCostPerUnit = Math.round((totalBatchCost / currentOutputQty) * 100) / 100;

  // Cost Variance
  const previousCost = selectedProduct?.standardCost ? Number(selectedProduct.standardCost) : 0;
  const costDiff = calculatedCostPerUnit - previousCost;
  const costDiffPct = previousCost > 0 ? (costDiff / previousCost) * 100 : 0;

  // 5. "ADD TO PRODUCT" Handler
  const handleApplyToProduct = async () => {
    setIsApplying(true);
    try {
      const payload: any = {
        batchOutputQuantity: currentOutputQty,
        packSize: productMode === 'new' ? newPackSize : packSize,
        packSizeUnitName: productMode === 'new' ? newPackUnit : packSizeUnit,
        totalRawMaterialCost: totalRmCost,
        totalPackagingCost: totalPmCost,
        totalBatchCost,
        costPerUnit: calculatedCostPerUnit,
        rawMaterials: rmLines.map((l) => ({
          rawMaterialId: l.selectedId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        })),
        packagingMaterials: pmLines.map((l) => ({
          packingMaterialId: l.selectedId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        })),
      };

      if (productMode === 'existing') {
        payload.finishedProductId = selectedProductId;
      } else {
        payload.newProductName = newProductName.trim();
        payload.categoryId = newCategoryId || undefined;
        payload.packSizeQuantity = newPackSize;
        payload.packSizeUnit = newPackUnit;
        payload.baseSellingPrice = newBasePrice;
      }

      const res = await ApiClient.post<any>('/api/v1/costing/apply-to-product', payload);
      showToast({
        title: 'Costing Applied Successfully',
        message: res.data?.message || `Costing V${res.data?.version || 1} applied to product`,
        type: 'success',
      });

      setIsConfirmModalOpen(false);
      // Refresh products & reload
      loadPrerequisites();
    } catch (err: any) {
      showToast({
        title: 'Application Error',
        message: err.response?.data?.message || err.message || 'Failed to apply costing to product',
        type: 'error',
      });
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading costing workspace & procurement rates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <IconFlask size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Product Costing Engine</h1>
            <p className="text-slate-400 text-xs">
              Authoritative batch costing calculation from real procurement rates. Click &quot;ADD TO PRODUCT&quot; to apply.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>Costing History ({costingHistory.length})</span>
          </button>

          <button
            onClick={() => loadPrerequisites()}
            className="p-2 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Rates"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>

      {/* SECTION 1: DUAL-MODE PRODUCT SELECTOR */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Product Context
            </span>
            <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-950">
              <button
                type="button"
                onClick={() => setProductMode('existing')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  productMode === 'existing'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Select Existing Product
              </button>
              <button
                type="button"
                onClick={() => setProductMode('new')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  productMode === 'new'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                + Type & Add New Product Name
              </button>
            </div>
          </div>

          {productMode === 'existing' && selectedProduct && (
            <span className="font-mono text-xs text-slate-400">
              Code: <span className="text-emerald-400 font-bold">{selectedProduct.productCode}</span>
            </span>
          )}
        </div>

        {productMode === 'existing' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Select Finished Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500/50"
              >
                {finishedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.productCode}] {p.productName} ({p.packingQuantity || 2} {p.packingUnit || 'L'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Current Manufacturing Cost
              </label>
              <div className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs font-mono font-bold text-white">
                  {previousCost > 0 ? `PKR ${previousCost.toLocaleString()} / Pack` : 'NOT CONFIGURED'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Base Selling Price (Reference)
              </label>
              <div className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {selectedProduct?.defaultSellingPrice
                    ? `PKR ${Number(selectedProduct.defaultSellingPrice).toLocaleString()}`
                    : 'Not Set'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                New Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Emamectin 1.9% EC"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">-- Default [41-01 Finished Goods] --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `[${c.code}] ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pack Size</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newPackSize}
                  onChange={(e) => setNewPackSize(Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
                <select
                  value={newPackUnit}
                  onChange={(e) => setNewPackUnit(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                >
                  <option value="Liter">Liter</option>
                  <option value="KG">KG</option>
                  <option value="ML">ML</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Base Selling Price</label>
              <input
                type="number"
                value={newBasePrice}
                onChange={(e) => setNewBasePrice(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-bold text-xs"
                placeholder="PKR 2,800"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: BATCH PRODUCTION PARAMETERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">
            Batch Output Quantity (Packs/Bottles)
          </label>
          <input
            type="number"
            value={batchOutputQuantity}
            onChange={(e) => setBatchOutputQuantity(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Pack Size</label>
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold font-mono">
            {packSize} {packSizeUnit}
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Total Bulk Volume</label>
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 text-sm font-bold font-mono">
            {currentOutputQty * packSize} {packSizeUnit}s
          </div>
        </div>
      </div>

      {/* SECTION 3: RAW MATERIALS TABLE */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Raw Materials (Active Ingredients & Solvents)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Rates from Procurement (Read-Only)
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddRmLine}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <IconPlus size={14} />
            <span>+ Add Raw Material</span>
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="p-2.5">Raw Material</th>
                <th className="p-2.5 w-32">Quantity</th>
                <th className="p-2.5 w-40">Procurement Rate (PKR)</th>
                <th className="p-2.5 w-40 text-right">Line Total (PKR)</th>
                <th className="p-2.5 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {rmLines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-800/30">
                  <td className="p-2">
                    <select
                      value={line.selectedId}
                      onChange={(e) => handleUpdateRmLine(line.id, 'selectedId', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                    >
                      {rawMaterialsList.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          [{rm.materialCode}] {rm.materialName} ({rm.baseUom?.symbol || 'KG'})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => handleUpdateRmLine(line.id, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      readOnly
                      value={`PKR ${Number(line.unitCost).toLocaleString()}`}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-mono text-xs cursor-not-allowed"
                    />
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-white">
                    PKR {Number(line.totalCost).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRmLine(line.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <IconTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right text-xs text-slate-400 font-mono">
          Total Raw Material Cost:{' '}
          <span className="font-bold text-white text-sm">PKR {totalRmCost.toLocaleString()}</span>
        </div>
      </div>

      {/* SECTION 4: PACKAGING MATERIALS TABLE */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Packaging Materials (Bottles, Caps, Labels, Cartons)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Rates from Procurement (Read-Only)
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddPmLine}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <IconPlus size={14} />
            <span>+ Add Packaging Item</span>
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="p-2.5">Packaging Item</th>
                <th className="p-2.5 w-32">Quantity</th>
                <th className="p-2.5 w-40">Procurement Rate (PKR)</th>
                <th className="p-2.5 w-40 text-right">Line Total (PKR)</th>
                <th className="p-2.5 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {pmLines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-800/30">
                  <td className="p-2">
                    <select
                      value={line.selectedId}
                      onChange={(e) => handleUpdatePmLine(line.id, 'selectedId', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                    >
                      {packingMaterialsList.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          [{pm.materialCode}] {pm.materialName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => handleUpdatePmLine(line.id, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      readOnly
                      value={`PKR ${Number(line.unitCost).toLocaleString()}`}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-mono text-xs cursor-not-allowed"
                    />
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-white">
                    PKR {Number(line.totalCost).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemovePmLine(line.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <IconTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right text-xs text-slate-400 font-mono">
          Total Packaging Cost:{' '}
          <span className="font-bold text-white text-sm">PKR {totalPmCost.toLocaleString()}</span>
        </div>
      </div>

      {/* SECTION 5: CALCULATION SUMMARY & "ADD TO PRODUCT" ACTION BAR */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Batch Cost = RM (PKR {totalRmCost.toLocaleString()}) + Packaging (PKR {totalPmCost.toLocaleString()})
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-white font-mono">
              PKR {totalBatchCost.toLocaleString()}
            </span>
            <span className="text-sm text-slate-400">÷ {currentOutputQty} bottles =</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              PKR {calculatedCostPerUnit.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-emerald-400/80">/ Bottle</span>
          </div>

          {productMode === 'existing' && previousCost > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              Current: <span className="font-mono text-white">PKR {previousCost}</span> → New:{' '}
              <span className="font-mono text-emerald-400">PKR {calculatedCostPerUnit}</span>{' '}
              <span className={costDiff >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                ({costDiff >= 0 ? `+PKR ${costDiff}` : `-PKR ${Math.abs(costDiff)}`},{' '}
                {costDiffPct >= 0 ? `+${costDiffPct.toFixed(2)}%` : `${costDiffPct.toFixed(2)}%`})
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmModalOpen(true)}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] shrink-0"
        >
          <IconCheck size={18} />
          <span>ADD TO PRODUCT</span>
        </button>
      </div>

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Confirm Apply Costing</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action will atomically record an immutable costing version snapshot and update the finished
              product&apos;s current manufacturing cost.
            </p>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Product:</span>
                <span className="text-white font-bold">
                  {productMode === 'existing' ? selectedProduct?.productName : newProductName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Previous Cost:</span>
                <span className="text-slate-300">
                  {previousCost > 0 ? `PKR ${previousCost}` : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">New Cost Per Pack:</span>
                <span className="text-emerald-400 font-bold">PKR {calculatedCostPerUnit}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyToProduct}
                disabled={isApplying}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {isApplying ? 'Applying...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COSTING HISTORY DRAWER */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col space-y-4 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Costing Version History</h3>
                <p className="text-xs text-slate-400">{selectedProduct?.productName || 'Product History'}</p>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {costingHistory.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">No historical costing snapshots found</p>
              ) : (
                costingHistory.map((hist) => (
                  <div key={hist.id} className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-400">Version {hist.version}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                        {hist.status}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-slate-400">Cost Per Unit:</span>
                      <span className="text-base font-extrabold text-emerald-400 font-mono">
                        PKR {Number(hist.costPerUnit).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Batch Total: PKR {Number(hist.totalBatchCost).toLocaleString()}</span>
                      <span>Output: {hist.batchOutputQuantity} bottles</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block pt-1">
                      {new Date(hist.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
