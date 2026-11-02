'use client';

/**
 * SHEHSWAR ONE360 - Unified "+ Add Item" Modal
 *
 * Professional Single Entry Point:
 * User selects Item Category -> The system automatically determines:
 * - Entity Type (FinishedProduct, RawMaterial, PackingMaterial)
 * - Dynamic form fields
 * - Sequential collision-safe code (FG-XXXXXX, RM-XXXXXX, PM-XXXXXX)
 * - Database destination table and UI section
 *
 * Mandate:
 * - Packaging is separate from Pack Size
 * - "+ Add New Packaging" creates a real PackingMaterial
 * - Inline "+ Add New Unit" and "+ Add New Category"
 * - Complete legacy fields rendered (PPC, Urdu Name, MType, Base Price, etc.)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  IconPlus,
  IconClose,
  IconCheck,
  IconAlertTriangle,
  IconPackage,
  IconTag,
} from '../icons';
import { InlinePackagingModal } from './InlinePackagingModal';
import { InlineUnitModal } from './InlineUnitModal';
import { InlineCategoryModal } from './InlineCategoryModal';

export interface UnifiedAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: (createdItem: any, destinationUrl: string) => void;
  defaultCategoryId?: string;
}

export const UnifiedAddItemModal: React.FC<UnifiedAddItemModalProps> = ({
  isOpen,
  onClose,
  onItemCreated,
  defaultCategoryId,
}) => {
  const { showToast } = useToast();

  // Categories & Routing State
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [routeInfo, setRouteInfo] = useState<any | null>(null);
  const [previewCode, setPreviewCode] = useState<string>('Loading...');

  // Form Fields - Common
  const [itemName, setItemName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [description, setDescription] = useState('');

  // Form Fields - Finished Goods Specific
  const [productType, setProductType] = useState('Insecticide');
  const [mType, setMType] = useState('Insecticides');
  const [packagingMaterials, setPackagingMaterials] = useState<any[]>([]);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>('');
  const [packSizeQuantity, setPackSizeQuantity] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState('Liter');
  const [uoms, setUoms] = useState<any[]>([]);
  const [selectedBaseUomId, setSelectedBaseUomId] = useState<string>('');
  const [ppc, setPpc] = useState<number>(12); // Pack Per Carton
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(2800);
  const [brand, setBrand] = useState('Shehswar Agro');
  const [grade, setGrade] = useState('Standard');

  // Form Fields - Raw Material Specific
  const [purchaseUoms, setPurchaseUoms] = useState<any[]>([]);
  const [selectedPurchaseUomId, setSelectedPurchaseUomId] = useState<string>('');
  const [conversionFactor, setConversionFactor] = useState<number>(1);
  const [batchControlled, setBatchControlled] = useState(true);
  const [qcRequired, setQcRequired] = useState(false);
  const [storageRequirements, setStorageRequirements] = useState('');

  // Form Fields - Packing Material Specific
  const [packCompatibility, setPackCompatibility] = useState('');
  const [minStock, setMinStock] = useState<number>(500);
  const [reorderLevel, setReorderLevel] = useState<number>(200);

  // Sub-modals
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Status & Validation
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  // 1. Fetch Categories, Packaging Materials & UOMs on Open
  const loadPrerequisites = useCallback(async () => {
    try {
      const [catsRes, pmRes, uomRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/unified-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/units-of-measure'),
      ]);

      const catList = Array.isArray(catsRes.data) ? catsRes.data : (catsRes.data as any)?.data || [];
      setCategories(catList);

      const pmList = Array.isArray(pmRes.data) ? pmRes.data : (pmRes.data as any)?.data || [];
      setPackagingMaterials(pmList);

      const uomList = Array.isArray(uomRes.data) ? uomRes.data : (uomRes.data as any)?.data || [];
      setUoms(uomList);
      setPurchaseUoms(uomList);

      // Set initial Category
      if (defaultCategoryId && catList.some((c: any) => c.id === defaultCategoryId)) {
        setSelectedCategoryId(defaultCategoryId);
      } else if (catList.length > 0) {
        setSelectedCategoryId(catList[0].id);
      }
    } catch (err) {
      console.error('Failed to load prerequisites:', err);
    }
  }, [defaultCategoryId]);

  useEffect(() => {
    if (isOpen) {
      loadPrerequisites();
      setCreatedResult(null);
      setDuplicateWarning(null);
      setItemName('');
      setUrduName('');
    }
  }, [isOpen, loadPrerequisites]);

  // 2. When Category Changes, Resolve Route & Code Prefix
  useEffect(() => {
    if (!selectedCategoryId) return;

    ApiClient.get<any>(`/api/v1/master-data/category-router/${selectedCategoryId}`)
      .then((res) => {
        setRouteInfo(res.data);
        // Preview next sequential code
        return ApiClient.get<any>(`/api/v1/master-data/next-code?entityType=${res.data.targetEntity}`);
      })
      .then((codeRes) => {
        setPreviewCode(codeRes.data?.nextCode || `${routeInfo?.codePrefix || 'ITEM'}-XXXXXX`);
      })
      .catch((err) => {
        console.error('Routing resolution failed:', err);
      });
  }, [selectedCategoryId]);

  // 3. Real-time Duplicate Check
  useEffect(() => {
    if (!itemName.trim() || !routeInfo?.targetEntity) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(() => {
      ApiClient.get<any>(
        `/api/v1/master-data/check-duplicate-item?name=${encodeURIComponent(itemName.trim())}&entityType=${routeInfo.targetEntity}`
      )
        .then((res) => {
          if (res.data?.hasDuplicate) {
            setDuplicateWarning(res.data.matchedItem);
          } else {
            setDuplicateWarning(null);
          }
        })
        .catch(console.error);
    }, 400);

    return () => clearTimeout(timer);
  }, [itemName, routeInfo?.targetEntity]);

  if (!isOpen) return null;

  // 4. Handle Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      showToast({ title: 'Validation', message: 'Please select an item category', type: 'warning' });
      return;
    }
    if (!itemName.trim()) {
      showToast({ title: 'Validation', message: 'Item Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        categoryId: selectedCategoryId,
        itemName: itemName.trim(),
        urduName: urduName.trim() || undefined,
        description: description.trim() || undefined,
        brand,
        grade,
      };

      if (routeInfo?.targetEntity === 'FINISHED_PRODUCT') {
        payload.productType = productType;
        payload.mType = mType;
        payload.packagingMaterialId = selectedPackagingId || undefined;
        payload.packSizeQuantity = packSizeQuantity;
        payload.packSizeUnit = packSizeUnit;
        payload.ppc = ppc;
        payload.baseSellingPrice = baseSellingPrice;
        payload.baseUomId = selectedBaseUomId || undefined;
      } else if (routeInfo?.targetEntity === 'RAW_MATERIAL') {
        payload.baseUomId = selectedBaseUomId || undefined;
        payload.purchaseUomId = selectedPurchaseUomId || undefined;
        payload.purchaseConversionFactor = conversionFactor;
        payload.batchControlled = batchControlled;
        payload.qcRequired = qcRequired;
        payload.storageRequirements = storageRequirements || undefined;
        payload.minimumStock = minStock;
        payload.reorderLevel = reorderLevel;
      } else {
        // Packing Material
        payload.baseUomId = selectedBaseUomId || undefined;
        payload.packCompatibility = packCompatibility || undefined;
        payload.minimumStock = minStock;
        payload.reorderLevel = reorderLevel;
      }

      const res = await ApiClient.post<any>('/api/v1/master-data/unified-items', payload);
      setCreatedResult(res.data);
      showToast({
        title: 'Item Created Successfully',
        message: res.data?.message || 'Item saved to database',
        type: 'success',
      });
      if (onItemCreated) {
        onItemCreated(res.data.item, res.data.destinationUrl);
      }
    } catch (err: any) {
      showToast({
        title: 'Save Failed',
        message: err.response?.data?.message || err.message || 'Failed to create item',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <IconPlus size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold text-base leading-tight">Add New Item</h3>
                <p className="text-slate-400 text-xs">
                  Category determines entity, fields, sequential code, and destination.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <IconClose size={20} />
            </button>
          </div>

          {/* Form Body or Success Card */}
          {createdResult ? (
            <div className="p-8 text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <IconCheck size={32} />
              </div>
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {createdResult.entityType}
                </span>
                <h3 className="text-xl font-bold text-white mt-2">
                  {createdResult.item?.productName || createdResult.item?.materialName}
                </h3>
                <p className="text-slate-400 font-mono text-sm mt-0.5">
                  Code: <span className="text-emerald-400 font-bold">{createdResult.code}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Stored in table: <code className="text-slate-300 font-mono">{createdResult.destinationLabel}</code>
                </p>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedResult(null);
                    setItemName('');
                    setUrduName('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                >
                  + Add Another Item
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/20"
                >
                  View in {createdResult.destinationLabel} →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* STEP 1: CATEGORY SELECTION */}
              <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <IconTag size={14} />
                    <span>1. Item Category / Item Type (Routing Layer)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                  >
                    <IconPlus size={12} />
                    <span>+ Add New Category</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-medium focus:ring-2 focus:ring-emerald-500/50"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `[${c.code}] ` : ''}{c.name} ({c.badge || c.entityType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/60 border border-slate-700/60 rounded-xl">
                    <span className="text-slate-400 text-xs">Destination:</span>
                    <span className="text-xs font-semibold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      {routeInfo?.destinationLabel || 'Loading routing...'}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 ml-auto font-bold">
                      {previewCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Duplicate Warning Alert */}
              {duplicateWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs animate-in fade-in">
                  <IconAlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
                  <div className="flex-1">
                    <p className="font-semibold">Possible duplicate detected:</p>
                    <p className="text-amber-200/90 mt-0.5">
                      &quot;{duplicateWarning.name}&quot; already exists with Code{' '}
                      <span className="font-mono font-bold">{duplicateWarning.code}</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: DYNAMIC FIELDS BASED ON ENTITY */}

              {/* Common Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {routeInfo?.targetEntity === 'FINISHED_PRODUCT' ? 'Product Name' : 'Material Name'}{' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      routeInfo?.targetEntity === 'FINISHED_PRODUCT'
                        ? 'e.g. ABC 20% EC'
                        : routeInfo?.targetEntity === 'RAW_MATERIAL'
                        ? 'e.g. Chlorpyrifos 97% Tech'
                        : 'e.g. 2 Liter HDPE Bottle'
                    }
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Urdu Name / Local Description
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    placeholder="اے بی سی بیس فیصد"
                    value={urduName}
                    onChange={(e) => setUrduName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Item Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Additional specifications or formulation remarks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* ============================================================== */}
              {/* FINISHED PRODUCT DYNAMIC SUBFORM */}
              {/* ============================================================== */}
              {routeInfo?.targetEntity === 'FINISHED_PRODUCT' && (
                <div className="space-y-4 pt-1">
                  {/* PACKAGING vs PACK SIZE SEPARATION (Mandatory Rule) */}
                  <div className="p-4 bg-slate-800/30 border border-slate-700/60 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                        <IconPackage size={14} />
                        <span>Packaging & Unit Configuration</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPackagingModalOpen(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                      >
                        <IconPlus size={12} />
                        <span>+ Add New Packaging</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Packaging Material (Bottle/Bag)
                        </label>
                        <select
                          value={selectedPackagingId}
                          onChange={(e) => setSelectedPackagingId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500/50"
                        >
                          <option value="">-- Select Physical Packaging --</option>
                          {packagingMaterials.map((pm) => (
                            <option key={pm.id} value={pm.id}>
                              {pm.materialCode} {pm.materialName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Pack Size Quantity <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={packSizeQuantity}
                          onChange={(e) => setPackSizeQuantity(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500/50"
                          placeholder="e.g. 2"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300">
                            Pack Size Unit
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsUnitModalOpen(true)}
                            className="text-[10px] text-indigo-400 hover:underline"
                          >
                            + Add Unit
                          </button>
                        </div>
                        <select
                          value={packSizeUnit}
                          onChange={(e) => setPackSizeUnit(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500/50"
                        >
                          <option value="Liter">Liter</option>
                          <option value="KG">KG</option>
                          <option value="ML">ML</option>
                          <option value="GM">GM</option>
                          <option value="Pack">Pack</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Classification & Commercial Master Fields */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        MType (Classification)
                      </label>
                      <select
                        value={mType}
                        onChange={(e) => setMType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <option value="Insecticides">Insecticides</option>
                        <option value="Herbicides">Herbicides</option>
                        <option value="Weedicides">Weedicides</option>
                        <option value="Fungicides">Fungicides</option>
                        <option value="Fertilizers">Fertilizers</option>
                        <option value="Seeds">Seeds</option>
                        <option value="PGRs / Nutrients">PGRs / Nutrients</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Product Type
                      </label>
                      <input
                        type="text"
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="e.g. Insecticide"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        PPC (Packs / Carton)
                      </label>
                      <input
                        type="number"
                        value={ppc}
                        onChange={(e) => setPpc(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="12"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Base Selling Price (PKR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={baseSellingPrice}
                        onChange={(e) => setBaseSellingPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-emerald-400 font-bold text-xs focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="PKR 2,800"
                      />
                    </div>
                  </div>

                  {/* Brand & Grade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand</label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Grade</label>
                      <input
                        type="text"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* RAW MATERIAL DYNAMIC SUBFORM */}
              {/* ============================================================== */}
              {routeInfo?.targetEntity === 'RAW_MATERIAL' && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-300">Base Unit (UOM)</label>
                        <button
                          type="button"
                          onClick={() => setIsUnitModalOpen(true)}
                          className="text-[10px] text-emerald-400 hover:underline"
                        >
                          + Add Unit
                        </button>
                      </div>
                      <select
                        value={selectedBaseUomId}
                        onChange={(e) => setSelectedBaseUomId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      >
                        <option value="">-- Base UOM --</option>
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.symbol || u.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Purchase Unit (Drum/Bag)
                      </label>
                      <select
                        value={selectedPurchaseUomId}
                        onChange={(e) => setSelectedPurchaseUomId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      >
                        <option value="">-- Purchase UOM --</option>
                        {purchaseUoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.symbol || u.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Conversion Factor
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={conversionFactor}
                        onChange={(e) => setConversionFactor(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                        placeholder="e.g. 200 (KG/Drum)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                      <input
                        type="checkbox"
                        id="batchCtrl"
                        checked={batchControlled}
                        onChange={(e) => setBatchControlled(e.target.checked)}
                        className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-700"
                      />
                      <label htmlFor="batchCtrl" className="text-xs text-slate-300">
                        Batch Controlled Material
                      </label>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                      <input
                        type="checkbox"
                        id="qcReq"
                        checked={qcRequired}
                        onChange={(e) => setQcRequired(e.target.checked)}
                        className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-700"
                      />
                      <label htmlFor="qcReq" className="text-xs text-slate-300">
                        QC Inspection Required
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Storage Requirements / Safety Specs
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Store below 25°C in ventilated area"
                      value={storageRequirements}
                      onChange={(e) => setStorageRequirements(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* PACKING MATERIAL DYNAMIC SUBFORM (Bottles, Cartons, Shrink...) */}
              {/* ============================================================== */}
              {routeInfo?.targetEntity === 'PACKING_MATERIAL' && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-300">Unit of Count</label>
                        <button
                          type="button"
                          onClick={() => setIsUnitModalOpen(true)}
                          className="text-[10px] text-emerald-400 hover:underline"
                        >
                          + Add Unit
                        </button>
                      </div>
                      <select
                        value={selectedBaseUomId}
                        onChange={(e) => setSelectedBaseUomId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      >
                        <option value="">-- Select UOM --</option>
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.symbol || u.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Pack Compatibility
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Fits 2L liquid bottles or 10KG boxes"
                        value={packCompatibility}
                        onChange={(e) => setPackCompatibility(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Minimum Stock Level
                      </label>
                      <input
                        type="number"
                        value={minStock}
                        onChange={(e) => setMinStock(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Reorder Stock Level
                      </label>
                      <input
                        type="number"
                        value={reorderLevel}
                        onChange={(e) => setReorderLevel(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Code will be generated automatically as{' '}
                  <span className="font-mono text-emerald-400 font-bold">{previewCode}</span>
                </span>

                <div className="flex gap-2.5">
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
                    className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Creating Item...</span>
                      </>
                    ) : (
                      <>
                        <IconCheck size={16} />
                        <span>Save Item</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Sub-Modals */}
      <InlinePackagingModal
        isOpen={isPackagingModalOpen}
        onClose={() => setIsPackagingModalOpen(false)}
        onCreated={(created) => {
          setPackagingMaterials((prev) => [created, ...prev]);
          setSelectedPackagingId(created.id);
        }}
      />

      <InlineUnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onCreated={(created) => {
          setUoms((prev) => [created, ...prev]);
          setPackSizeUnit(created.name);
          setSelectedBaseUomId(created.id);
        }}
      />

      <InlineCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCreated={(created) => {
          setCategories((prev) => [created, ...prev]);
          setSelectedCategoryId(created.id);
        }}
      />
    </>
  );
};
