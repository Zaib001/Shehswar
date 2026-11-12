'use client';

/**
 * SHEHSWAR ONE360 - Enterprise Product Costing & Production Engine
 *
 * Fully integrated business flow with rigorous Unit of Measure (UoM) normalization:
 * - Direct integration with real database Purchase Orders (PurchaseOrderItem)
 * - Live WarehouseStock checking and remaining stock preview
 * - Automatic Commercial Pack Size normalization (e.g. 1000 ML = 1 LTR, 500 ML = 0.5 LTR, 500 GM = 0.5 KG)
 * - Expected Output calculation: Batch Volume ÷ Normalized Pack Size (200 LTR ÷ 1 LTR = 200 Units, NOT 0)
 * - Support for RM, PM, FP, and OT component types with real warehouse inventory deduction
 * - Two distinct execution paths:
 *    1. "Save Draft": Saves costing snapshot as DRAFT without touching inventory
 *    2. "Confirm & Post Production": Atomic Prisma transaction that consumes components from
 *       WarehouseStock, generates ProductBatch, credits Finished Product to WarehouseStock,
 *       and updates FinishedProduct.standardCost.
 * - Full audit trail & immutable historical snapshot modal
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  Button,
  Modal,
  TableSkeleton,
  SearchableCombobox,
} from '../ui';
import {
  IconFlask,
  IconPlus,
  IconCheck,
  IconTrash,
  IconEye,
  IconFilter,
  IconSearch,
  IconClose,
  IconRefresh,
} from '../icons';

// ==========================================
// 1. UOM NORMALIZATION & CONVERSION ENGINE
// ==========================================

export type ComponentType = 'RM' | 'PM' | 'FP' | 'OT';
export type UnitCategory = 'VOLUME' | 'WEIGHT' | 'COUNT';

export interface NormalizedUnitInfo {
  category: UnitCategory;
  baseUnit: 'LTR' | 'KG' | 'NOS';
  factorToBase: number; // multiply raw value by factor to get baseUnit
  standardUnit: string;
}

export function getUnitNormalization(unitStr?: string): NormalizedUnitInfo {
  const clean = (unitStr || '').trim().toUpperCase();

  // Volume units (Base: LTR)
  if (/^(ML|MILLILITER|MILLILITRE|M\.L\.|CC)$/i.test(clean)) {
    return { category: 'VOLUME', baseUnit: 'LTR', factorToBase: 0.001, standardUnit: 'ML' };
  }
  if (/^(CL|CENTILITER)$/i.test(clean)) {
    return { category: 'VOLUME', baseUnit: 'LTR', factorToBase: 0.01, standardUnit: 'CL' };
  }
  if (/^(LTR|LITER|LITRE|L|LITERS|LITRES)$/i.test(clean)) {
    return { category: 'VOLUME', baseUnit: 'LTR', factorToBase: 1.0, standardUnit: 'LTR' };
  }
  if (/^(KL|KILOLITER)$/i.test(clean)) {
    return { category: 'VOLUME', baseUnit: 'LTR', factorToBase: 1000.0, standardUnit: 'KL' };
  }

  // Weight / Mass units (Base: KG)
  if (/^(MG|MILLIGRAM|MILLIGRAMS)$/i.test(clean)) {
    return { category: 'WEIGHT', baseUnit: 'KG', factorToBase: 0.000001, standardUnit: 'MG' };
  }
  if (/^(GM|G|GRAM|GRAMS)$/i.test(clean)) {
    return { category: 'WEIGHT', baseUnit: 'KG', factorToBase: 0.001, standardUnit: 'GM' };
  }
  if (/^(KG|KILOGRAM|KILOGRAMS)$/i.test(clean)) {
    return { category: 'WEIGHT', baseUnit: 'KG', factorToBase: 1.0, standardUnit: 'KG' };
  }
  if (/^(TON|TONNE|TONS|TONNES|MT)$/i.test(clean)) {
    return { category: 'WEIGHT', baseUnit: 'KG', factorToBase: 1000.0, standardUnit: 'TON' };
  }

  // Count / Discrete (Base: NOS)
  return { category: 'COUNT', baseUnit: 'NOS', factorToBase: 1.0, standardUnit: clean || 'Nos' };
}

export function extractUomFromPack(packStr?: string, fallback = 'LTR'): string {
  if (!packStr) return fallback;
  const clean = packStr.trim();
  const match = clean.match(/(?:^|\s)(LTR|LITER|LITRE|ML|MILLILITER|KG|KILOGRAM|GM|GRAM|NOS|PCS|UNITS?|DRUMS?|BAGS?)$/i);
  if (match && match[1]) {
    const u = match[1].toUpperCase();
    if (u === 'LITER' || u === 'LITRE') return 'LTR';
    if (u === 'MILLILITER') return 'ML';
    if (u === 'KILOGRAM') return 'KG';
    if (u === 'GRAM') return 'GM';
    return u;
  }
  if (clean.toLowerCase().includes('ltr') || clean.toLowerCase().includes('liter')) return 'LTR';
  if (clean.toLowerCase().includes('ml')) return 'ML';
  if (clean.toLowerCase().includes('kg')) return 'KG';
  if (clean.toLowerCase().includes('gm') || clean.toLowerCase().includes('gram')) return 'GM';
  return fallback;
}

export function formatVolume(qty?: number, unitOrPack?: string): string {
  const safeQty = Number(qty || 0);
  if (!unitOrPack) return safeQty.toLocaleString();
  const clean = String(unitOrPack).trim();
  return `${safeQty.toLocaleString()} ${clean}`;
}

export function formatUom(unitOrPack?: string): string {
  if (!unitOrPack) return 'Unit';
  return extractUomFromPack(unitOrPack, 'Unit');
}

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface PurchasedMaterialRecord {
  id: string; // PurchaseOrderItem ID
  purchaseOrderId: string;
  poNumber: string;
  purchaseDate: string;
  vendorId?: string;
  vendorName: string;
  vendorCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  materialId?: string;
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT' | 'OTHER';
  materialCode: string;
  materialName: string;
  pack: string;
  uom?: string;
  purchaseQuantity: number;
  purchaseRate: number;
  lineTotal: number;
  availableStock?: number;
}

export interface CostingLineItem {
  id: string;
  materialId?: string;
  materialName: string;
  materialCode?: string;
  type: ComponentType;
  pack: string;
  uom: string; // e.g. "LTR", "ML", "KG", "GM", "Nos"
  availableQuantity: number;
  quantity: number; // Used Qty entered by user
  rate: number; // Rate per line UoM
  cost: number; // quantity * rate
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  vendorName?: string;
  warehouseName?: string;
  sourcePoTotal?: number;
  sourcePoQuantity?: number;
}

export interface MasterWarehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
}

export interface MasterVendor {
  id: string;
  code: string;
  name: string;
}

export interface MasterFinishedProduct {
  id: string;
  productCode: string;
  productName: string;
  packingQuantity?: number;
  packingUnit?: string;
  standardCost?: number;
}

export interface SavedCostingRecord {
  id: string;
  version: number;
  createdAt: string;
  batchOutputQuantity: number;
  packSize: number;
  packSizeUnit: string;
  totalBatchCost: number;
  costPerUnit: number;
  finishedProductId?: string;
  notes?: string;
  status: string;
  costingCode?: string;
  costingDate?: string;
  batchNumber?: string;
  batchVolume?: number;
  expectedOutput?: number;
  actualOutput?: number;
  warehouseName?: string;
  contractorName?: string;
  finishedProduct?: {
    id: string;
    productCode: string;
    productName: string;
  };
}

export function ProductCostingView() {
  const { showToast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'voucher' | 'history'>('voucher');

  // Master Data State
  const [warehouses, setWarehouses] = useState<MasterWarehouse[]>([]);
  const [vendors, setVendors] = useState<MasterVendor[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<MasterFinishedProduct[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState<boolean>(true);

  // Real Purchased Materials & Stock from DB
  const [purchasedMaterials, setPurchasedMaterials] = useState<PurchasedMaterialRecord[]>([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState<Record<string, number>>({});
  const [isLoadingPurchases, setIsLoadingPurchases] = useState<boolean>(false);

  // Costing Voucher Header
  const [serialNumber, setSerialNumber] = useState<string>('CST-000001');
  const [costingDate, setCostingDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '2026-11-12');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [selectedFinishedProductId, setSelectedFinishedProductId] = useState<string>('');
  const [customBatchNumber, setCustomBatchNumber] = useState<string>('');

  // Batch Output Quantity State
  const [actualQuantity, setActualQuantity] = useState<number>(0);
  const [hasManuallyEditedActual, setHasManuallyEditedActual] = useState<boolean>(false);

  // Costing Table Lines
  const [lines, setLines] = useState<CostingLineItem[]>([]);

  // Previous Recipe & Batch States (Requirements 2, 6, 7, 12)
  const [latestRecipeData, setLatestRecipeData] = useState<{
    hasPreviousCosting: boolean;
    latestCosting: any;
    previousCosting: any;
    recipeLines: CostingLineItem[];
    costingsCount: number;
  } | null>(null);
  const [isLoadingLatestRecipe, setIsLoadingLatestRecipe] = useState<boolean>(false);

  // Batch Validation & Creation State
  const [batchCheckStatus, setBatchCheckStatus] = useState<{
    checked: boolean;
    exists: boolean;
    batch: any | null;
    isChecking: boolean;
  }>({ checked: false, exists: false, batch: null, isChecking: false });
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState<boolean>(false);
  const [newBatchMfgDate, setNewBatchMfgDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');
  const [newBatchExpDate, setNewBatchExpDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0] || '';
  });
  const [isCreatingBatch, setIsCreatingBatch] = useState<boolean>(false);

  // Action states
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isPostingProduction, setIsPostingProduction] = useState<boolean>(false);
  const [isApplyingCost, setIsApplyingCost] = useState<boolean>(false);
  const [isPostConfirmOpen, setIsPostConfirmOpen] = useState<boolean>(false);

  // Real Purchase Picker Modal
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [activeLineIdForPicker, setActiveLineIdForPicker] = useState<string | null>(null);
  const [pickerFilterType, setPickerFilterType] = useState<'ALL' | ComponentType>('ALL');
  const [pickerSearchQuery, setPickerSearchQuery] = useState<string>('');

  // Costing History State
  const [historyRecords, setHistoryRecords] = useState<SavedCostingRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [selectedHistoryModalRecord, setSelectedHistoryModalRecord] = useState<SavedCostingRecord | null>(null);

  // History Sub-Tab: 'RECIPES' | 'PRICE_HISTORY'
  const [historySubTab, setHistorySubTab] = useState<'RECIPES' | 'PRICE_HISTORY'>('RECIPES');
  const [priceHistoryRecords, setPriceHistoryRecords] = useState<any[]>([]);
  const [isLoadingPriceHistory, setIsLoadingPriceHistory] = useState<boolean>(false);

  // ==========================================
  // 1. DATA INITIALIZATION & REAL PO QUERY
  // ==========================================

  // Auto-generate next sequential Costing Serial Number (CST-XXXXXX)
  const fetchNextSerialNumber = useCallback(async (): Promise<string> => {
    try {
      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const validCompanyQuery = activeComp && activeComp !== 'ALL' && activeComp.length > 10 ? `?companyId=${encodeURIComponent(activeComp)}` : '';

      let code: string | null = null;
      try {
        const res = await ApiClient.get<any>(`/api/v1/costing/next-code${validCompanyQuery}`);
        code = res.data?.code || res.data?.nextCode || res.data?.serialNumber || (res as any)?.code || (res as any)?.nextCode;
      } catch {
        const fallbackRes = await ApiClient.get<any>(`/api/v1/master-data/next-code?entityType=COSTING${validCompanyQuery ? '&' + validCompanyQuery.slice(1) : ''}`);
        code = fallbackRes.data?.nextCode || fallbackRes.data?.code || (fallbackRes as any)?.nextCode || (fallbackRes as any)?.code;
      }

      if (code && typeof code === 'string') {
        setSerialNumber(code);
        return code;
      }
    } catch (e) {
      console.error('Failed to get sequential costing code', e);
    }
    return 'CST-000001';
  }, []);

  // Fetch real purchases & warehouse stocks for the selected warehouse
  const fetchPurchasedMaterials = useCallback(async (warehouseId?: string) => {
    setIsLoadingPurchases(true);
    try {
      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const params = new URLSearchParams();
      if (activeComp && activeComp !== 'ALL' && activeComp.length > 10) params.append('companyId', activeComp);
      if (warehouseId) params.append('warehouseId', warehouseId);

      const res = await ApiClient.get<any>(`/api/v1/costing/purchased-materials?${params.toString()}`);
      const data = res.data || res;
      const pList: PurchasedMaterialRecord[] = Array.isArray(data.purchases) ? data.purchases : [];
      const sMap: Record<string, number> = data.stockMap || {};

      setPurchasedMaterials(pList);
      setWarehouseStockMap(sMap);

      // Update available stock in existing costing lines
      setLines((prev) =>
        prev.map((line) => {
          let avail = 0;
          if (line.materialId && sMap[line.materialId] !== undefined) {
            avail = sMap[line.materialId] ?? 0;
          } else if (line.materialName) {
            const foundP = pList.find((p) => p.materialName.toLowerCase() === line.materialName.toLowerCase());
            if (foundP && foundP.availableStock !== undefined) {
              avail = foundP.availableStock ?? 0;
            }
          }
          return {
            ...line,
            availableQuantity: avail,
          };
        })
      );
    } catch (err) {
      console.error('Failed to load purchased materials:', err);
    } finally {
      setIsLoadingPurchases(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoadingMasterData(true);
    try {
      const [whRes, venRes, fpRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/warehouses?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products?all=true').catch(() => ({ data: [] })),
      ]);

      const normalizeList = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data?.items)) return res.data.items;
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.items)) return res.items;
        if (Array.isArray(res.data?.rows)) return res.data.rows;
        if (Array.isArray(res.rows)) return res.rows;
        return [];
      };

      const whList: MasterWarehouse[] = normalizeList(whRes);
      const venList: MasterVendor[] = normalizeList(venRes).map((v: any) => ({
        id: v.id,
        code: v.code || '',
        name: v.name || v.legalName || 'Unnamed Vendor',
      }));
      const fpList: MasterFinishedProduct[] = normalizeList(fpRes);

      setWarehouses(whList);
      setVendors(venList);
      setFinishedProducts(fpList);

      await fetchNextSerialNumber();

      // Default Warehouse (prefer Faisalabad Warehouse if present)
      let initialWhId = '';
      if (whList.length > 0) {
        const preferredWh = whList.find((w) => w.name.toLowerCase().includes('faisalabad')) || whList[0];
        if (preferredWh) {
          initialWhId = preferredWh.id;
          setSelectedWarehouseId(preferredWh.id);
        }
      }

      // Default Contractor / Vendor
      if (venList.length > 0) {
        const preferredVen =
          venList.find((v) => v.name.toLowerCase().includes('v agrics')) ||
          venList.find((v) => v.name.toLowerCase().includes('al nasar')) ||
          venList[0];
        if (preferredVen) setSelectedContractorId(preferredVen.id);
      }

      // Load purchases & live warehouse stock
      await fetchPurchasedMaterials(initialWhId);
    } catch (err: any) {
      console.error('Failed to load costing initial data:', err);
      showToast({
        title: 'Data Load Notice',
        message: 'Could not load complete master data.',
        type: 'error',
      });
    } finally {
      setIsLoadingMasterData(false);
    }
  }, [showToast, fetchNextSerialNumber, fetchPurchasedMaterials]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle warehouse change: reloads stock for that warehouse
  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    fetchPurchasedMaterials(whId);
  };

  // Batch check function (Requirement 6 & 7)
  const checkBatchExists = useCallback(async (productId: string, bNum: string) => {
    if (!productId || !bNum || !bNum.trim()) {
      setBatchCheckStatus({ checked: false, exists: false, batch: null, isChecking: false });
      return;
    }
    setBatchCheckStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const res = await ApiClient.get<any>(`/api/v1/costing/batches/check?finishedProductId=${productId}&batchNumber=${encodeURIComponent(bNum.trim())}`);
      const data = res.data || res;
      setBatchCheckStatus({
        checked: true,
        exists: !!data.exists,
        batch: data.batch || null,
        isChecking: false,
      });
    } catch {
      setBatchCheckStatus({ checked: true, exists: false, batch: null, isChecking: false });
    }
  }, []);

  // Create new batch explicitly (Requirement 7)
  const handleCreateNewBatch = async () => {
    if (!selectedFinishedProductId) {
      showToast({ title: 'Validation', message: 'Please select a finished product first.', type: 'warning' });
      return;
    }
    if (!customBatchNumber || !customBatchNumber.trim()) {
      showToast({ title: 'Validation', message: 'Please enter a batch number.', type: 'warning' });
      return;
    }

    setIsCreatingBatch(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/costing/batches/create', {
        finishedProductId: selectedFinishedProductId,
        batchNumber: customBatchNumber.trim(),
        manufacturingDate: newBatchMfgDate,
        expiryDate: newBatchExpDate || undefined,
        initialQuantity: actualQuantity || 0,
      });
      const data = res.data || res;
      showToast({
        title: 'Batch Registered',
        message: data.message || `Batch ${customBatchNumber.trim()} registered successfully.`,
        type: 'success',
      });
      setIsAddBatchModalOpen(false);
      await checkBatchExists(selectedFinishedProductId, customBatchNumber.trim());
    } catch (err: any) {
      console.error('Failed to create batch:', err);
      showToast({ title: 'Batch Creation Failed', message: err.message || 'Could not create batch.', type: 'error' });
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Handle finished product selection: reads commercial pack specification & loads previous recipe
  const handleFinishedProductChange = async (productId: string) => {
    setSelectedFinishedProductId(productId);

    if (productId) {
      setIsLoadingLatestRecipe(true);
      try {
        const res = await ApiClient.get<any>(`/api/v1/costing/product/${productId}/latest-recipe`);
        const data = res.data || res;
        setLatestRecipeData(data);
      } catch (err) {
        console.error('Failed to fetch latest recipe:', err);
        setLatestRecipeData(null);
      } finally {
        setIsLoadingLatestRecipe(false);
      }

      if (customBatchNumber.trim()) {
        checkBatchExists(productId, customBatchNumber.trim());
      }
    } else {
      setLatestRecipeData(null);
      setBatchCheckStatus({ checked: false, exists: false, batch: null, isChecking: false });
    }
  };

  // Apply Previous Recipe (Requirements 2, 12, 13)
  // Loads component structure BUT fetches NEW purchase/warehouse rates from real POs!
  const handleApplyPreviousRecipe = () => {
    if (!latestRecipeData || !latestRecipeData.recipeLines || latestRecipeData.recipeLines.length === 0) {
      showToast({ title: 'No Recipe Found', message: 'No prior formulation recipe available for this product.', type: 'warning' });
      return;
    }

    const updatedLines: CostingLineItem[] = latestRecipeData.recipeLines.map((line, idx) => {
      const cleanName = (line.materialName || '').toLowerCase().trim();
      const matchedPurchase = purchasedMaterials.find((p) => {
        if (line.materialId && p.materialId && line.materialId === p.materialId) return true;
        if (cleanName && p.materialName && p.materialName.toLowerCase().trim() === cleanName) return true;
        if (line.materialCode && p.materialCode && line.materialCode.toLowerCase().trim() === p.materialCode.toLowerCase().trim()) return true;
        return false;
      });

      const newRate = matchedPurchase ? (matchedPurchase.purchaseRate || 0) : 0;
      const qty = Number(line.quantity || 0);
      const newCost = Math.round(qty * newRate * 100) / 100;

      let availStock = 0;
      if (line.materialId && warehouseStockMap[line.materialId] !== undefined) {
        availStock = warehouseStockMap[line.materialId] ?? 0;
      } else if (matchedPurchase && matchedPurchase.availableStock !== undefined) {
        availStock = matchedPurchase.availableStock ?? 0;
      }

      return {
        id: `recipe-line-${Date.now()}-${idx}`,
        materialId: matchedPurchase?.materialId || line.materialId,
        materialName: matchedPurchase?.materialName || line.materialName,
        materialCode: matchedPurchase?.materialCode || line.materialCode,
        type: line.type || (matchedPurchase?.materialType === 'PACKING_MATERIAL' ? 'PM' : 'RM'),
        pack: matchedPurchase?.pack || line.pack || 'LTR',
        uom: line.uom || (matchedPurchase?.materialType === 'PACKING_MATERIAL' ? 'Nos' : 'LTR'),
        quantity: qty,
        rate: newRate, // NEW PURCHASE RATE FROM CURRENT STOCK!
        cost: newCost, // NEW CALCULATED COST!
        availableQuantity: availStock,
        sourcePoId: matchedPurchase?.purchaseOrderId,
        sourcePoNumber: matchedPurchase?.poNumber,
        purchaseDate: matchedPurchase?.purchaseDate,
        vendorName: matchedPurchase?.vendorName,
        warehouseName: matchedPurchase?.warehouseName,
      };
    });

    setLines(updatedLines);

    if (latestRecipeData.latestCosting?.actualOutput && !hasManuallyEditedActual) {
      setActualQuantity(latestRecipeData.latestCosting.actualOutput);
    }

    const updatedCount = updatedLines.filter((l) => l.rate > 0).length;
    showToast({
      title: 'Previous Recipe Loaded',
      message: `Recipe loaded with ${updatedLines.length} components (${updatedCount} updated with current PO rates). Old costing remains unchanged.`,
      type: 'success',
    });
  };

  // Add Cost to Product (Requirements 4, 5, 10, 11)
  // Updates FinishedProduct.standardCost and records historical price transition without duplicating stock
  const handleAddCostToProduct = async () => {
    if (!selectedFinishedProductId) {
      showToast({ title: 'Product Required', message: 'Please select a Finished Product first.', type: 'warning' });
      return;
    }
    if (!unitCost || unitCost <= 0) {
      showToast({ title: 'Cost Required', message: 'Unit cost must be greater than zero.', type: 'warning' });
      return;
    }

    setIsApplyingCost(true);
    try {
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);
      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const validCompanyId = activeComp && activeComp !== 'ALL' && activeComp.length > 10 ? activeComp : undefined;

      const payload = {
        companyId: validCompanyId,
        finishedProductId: selectedFinishedProductId,
        costPerUnit: unitCost,
        costingDate,
        serialNumber,
        batchNumber: customBatchNumber.trim() || undefined,
        packSize: endProductSpec.normalizedPackSize,
        packSizeUnit: endProductSpec.commercialUnit,
        batchVolume,
        batchOutputQuantity: actualQuantity || expectedOutput || 1,
        expectedOutput,
        actualOutput: actualQuantity,
        finishedQuantity: actualQuantity,
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        otherCost: otherTotal,
        totalBatchCost: totalCost,
        lines,
        action: 'APPLY_COST',
        postProduction: false, // Rule 10: DO NOT duplicate stock
        notes: `Product standard cost updated to PKR ${unitCost.toFixed(2)} via Costing Voucher ${serialNumber}`,
      };

      await ApiClient.post<any>('/api/v1/costing/save', payload);

      // Update state so UI reflects new standard cost
      setFinishedProducts((prev) =>
        prev.map((fp) => (fp.id === selectedFinishedProductId ? { ...fp, standardCost: unitCost } : fp))
      );

      showToast({
        title: 'Active Product Cost Updated',
        message: `${selectedFp?.productName || 'Product'} current cost set to PKR ${unitCost.toFixed(2)} (Previous cost preserved in history). Inventory untouched.`,
        type: 'success',
      });

      if (selectedFinishedProductId) {
        ApiClient.get<any>(`/api/v1/costing/product/${selectedFinishedProductId}/latest-recipe`).then((r) => setLatestRecipeData(r.data || r));
      }
    } catch (err: any) {
      console.error('Failed to apply cost to product:', err);
      showToast({ title: 'Update Failed', message: err.message || 'Could not update product cost.', type: 'error' });
    } finally {
      setIsApplyingCost(false);
    }
  };

  // ==========================================
  // 2. END PRODUCT COMMERCIAL PACK SPECIFICATION
  // ==========================================

  const endProductSpec = useMemo(() => {
    const chosen = finishedProducts.find((p) => p.id === selectedFinishedProductId);
    if (!chosen) {
      return {
        productName: '',
        productCode: '',
        commercialDisplay: '1000 ML',
        commercialQuantity: 1000,
        commercialUnit: 'ML',
        normalizedPackSize: 1.0, // 1000 ML = 1 LTR
        baseUnit: 'LTR' as const,
        category: 'VOLUME' as const,
      };
    }

    const rawQty = chosen.packingQuantity && Number(chosen.packingQuantity) > 0 ? Number(chosen.packingQuantity) : 1;
    const rawUnit = chosen.packingUnit || 'Liter';
    const norm = getUnitNormalization(rawUnit);
    const normalizedPackSize = rawQty * norm.factorToBase;

    return {
      productName: chosen.productName,
      productCode: chosen.productCode,
      commercialDisplay: `${rawQty} ${rawUnit}`,
      commercialQuantity: rawQty,
      commercialUnit: rawUnit,
      normalizedPackSize: normalizedPackSize > 0 ? normalizedPackSize : 1.0,
      baseUnit: norm.baseUnit,
      category: norm.category,
    };
  }, [finishedProducts, selectedFinishedProductId]);

  // ==========================================
  // 3. REAL PURCHASE ORDER PICKER
  // ==========================================

  const handleOpenPickerForLine = (lineId: string, filter: 'ALL' | ComponentType = 'ALL') => {
    setActiveLineIdForPicker(lineId);
    setPickerFilterType(filter);
    setPickerSearchQuery('');
    setIsPickerOpen(true);
  };

  const handleSelectPurchasedItem = (purchasedItem: PurchasedMaterialRecord) => {
    if (!activeLineIdForPicker) return;

    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== activeLineIdForPicker) return line;

        const qty = line.quantity && line.quantity > 0 ? line.quantity : 0;
        const rate = purchasedItem.purchaseRate || 0;
        const newCost = Math.round(qty * rate * 100) / 100;
        const poTotal = Number(purchasedItem.lineTotal) || purchasedItem.purchaseQuantity * rate;

        let compType: ComponentType = 'RM';
        if (purchasedItem.materialType === 'PACKING_MATERIAL') compType = 'PM';
        else if (purchasedItem.materialType === 'FINISHED_PRODUCT') compType = 'FP';
        else if (purchasedItem.materialType === 'OTHER') compType = 'OT';

        // Check live stock for this material in selected warehouse
        const availStock: number =
          (purchasedItem.materialId && warehouseStockMap[purchasedItem.materialId] !== undefined
            ? warehouseStockMap[purchasedItem.materialId]
            : (purchasedItem.availableStock ?? 0)) ?? 0;

        const parsedUom = purchasedItem.uom || extractUomFromPack(purchasedItem.pack, 'LTR');

        return {
          ...line,
          materialId: purchasedItem.materialId,
          materialName: purchasedItem.materialName,
          materialCode: purchasedItem.materialCode,
          type: compType,
          pack: purchasedItem.pack || '1 Nos',
          uom: parsedUom,
          availableQuantity: availStock,
          rate,
          quantity: qty,
          cost: newCost,
          sourcePoId: purchasedItem.purchaseOrderId,
          sourcePoNumber: purchasedItem.poNumber,
          purchaseDate: purchasedItem.purchaseDate,
          vendorName: purchasedItem.vendorName,
          warehouseName: purchasedItem.warehouseName,
          sourcePoTotal: poTotal,
          sourcePoQuantity: purchasedItem.purchaseQuantity,
        };
      })
    );

    setIsPickerOpen(false);
    setActiveLineIdForPicker(null);

    // Auto-sync contractor/vendor or warehouse if not selected
    if (!selectedContractorId && purchasedItem.vendorId) {
      setSelectedContractorId(purchasedItem.vendorId);
    }
    if (!selectedWarehouseId && purchasedItem.warehouseId) {
      setSelectedWarehouseId(purchasedItem.warehouseId);
      fetchPurchasedMaterials(purchasedItem.warehouseId);
    }

    showToast({
      title: 'Material Component Selected',
      message: `${purchasedItem.materialName} from ${purchasedItem.poNumber} (Rate: PKR ${purchasedItem.purchaseRate.toLocaleString()}/${purchasedItem.pack})`,
      type: 'success',
    });
  };

  const handleAddRow = (type: ComponentType = 'RM') => {
    const newLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const defaultPack = type === 'RM' ? 'LTR' : type === 'PM' ? '1 Nos' : type === 'FP' ? 'LTR' : 'Nos';
    const defaultUom = type === 'RM' ? 'LTR' : type === 'PM' ? 'Nos' : type === 'FP' ? 'LTR' : 'Nos';
    const newLine: CostingLineItem = {
      id: newLineId,
      materialName: '',
      type,
      pack: defaultPack,
      uom: defaultUom,
      availableQuantity: 0,
      quantity: 0,
      rate: 0,
      cost: 0,
    };
    setLines((prev) => [...prev, newLine]);
    handleOpenPickerForLine(newLineId, type);
  };

  const handleAddLabourRow = () => {
    const newLine: CostingLineItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      materialName: 'PM Packing Labour',
      type: 'PM',
      pack: '1 Nos',
      uom: 'Nos',
      availableQuantity: 999999, // Labour is not a physical consumable stock item
      quantity: actualQuantity > 0 ? actualQuantity : 0,
      rate: 8,
      cost: (actualQuantity > 0 ? actualQuantity : 0) * 8,
    };
    setLines((prev) => [...prev, newLine]);
  };

  const handleRemoveRow = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLineChange = (lineId: string, field: keyof CostingLineItem, val: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const updated = { ...line, [field]: val };

        if (field === 'quantity' || field === 'rate') {
          const q = field === 'quantity' ? Number(val) || 0 : line.quantity;
          const r = field === 'rate' ? Number(val) || 0 : line.rate;
          updated.cost = Math.round(q * r * 100) / 100;
        }

        return updated;
      })
    );
  };

  // Filtered list of real purchases in picker
  const filteredPickerPurchases = useMemo(() => {
    return purchasedMaterials.filter((item) => {
      if (pickerFilterType !== 'ALL') {
        if (pickerFilterType === 'RM' && item.materialType !== 'RAW_MATERIAL') return false;
        if (pickerFilterType === 'PM' && item.materialType !== 'PACKING_MATERIAL') return false;
        if (pickerFilterType === 'FP' && item.materialType !== 'FINISHED_PRODUCT') return false;
        if (pickerFilterType === 'OT' && item.materialType !== 'OTHER') return false;
      }
      if (pickerSearchQuery.trim()) {
        const q = pickerSearchQuery.toLowerCase();
        const matchesName = item.materialName.toLowerCase().includes(q);
        const matchesCode = (item.materialCode || '').toLowerCase().includes(q);
        const matchesPo = item.poNumber.toLowerCase().includes(q);
        const matchesVendor = item.vendorName.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesPo && !matchesVendor) return false;
      }
      return true;
    });
  }, [purchasedMaterials, pickerFilterType, pickerSearchQuery]);

  // ==========================================
  // 4. ARITHMETIC & PRODUCTION CALCULATIONS
  // ==========================================

  // Batch Volume = Total RM volume consumed in normalized base unit (LTR)
  // For Chlorpyrifos: Used 200 LTR => Batch Volume = 200 LTR
  // For ML input: 200,000 ML => 200 LTR
  // For Drums (e.g. 5 drums * 200 LTR): 1,000 LTR
  const batchVolume = useMemo(() => {
    const rmLines = lines.filter((l) => l.type === 'RM');
    return rmLines.reduce((acc, l) => {
      const qty = Number(l.quantity) || 0;
      if (qty <= 0) return acc;

      const cleanPack = String(l.pack || '').trim().toLowerCase();
      // Match number and unit in pack, e.g. "200ltr", "200 LTR", "25 kg", "1000 ml", "1 LTR", "1 Nos"
      const packMatch = cleanPack.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(ltr|liter|litre|kg|gm|gram|ml|nos|pcs)?/i);

      if (packMatch && packMatch[1]) {
        const capacityNum = parseFloat(packMatch[1]);
        const packUnit = packMatch[2] || l.uom;
        const norm = getUnitNormalization(packUnit);
        const capacityInBase = capacityNum * norm.factorToBase;
        return acc + (qty * capacityInBase);
      }

      const norm = getUnitNormalization(l.uom);
      return acc + (qty * norm.factorToBase);
    }, 0);
  }, [lines]);

  // Expected Output (Est. Qty) = Batch Volume ÷ Normalized Pack Size
  // Example: 200 LTR ÷ 1 LTR (from 1000 ML) = 200 Units (NOT 0!)
  const expectedOutput = useMemo(() => {
    if (batchVolume <= 0 || endProductSpec.normalizedPackSize <= 0) return 0;
    const rawOutput = batchVolume / endProductSpec.normalizedPackSize;
    return Math.floor(rawOutput);
  }, [batchVolume, endProductSpec]);

  // Auto-sync actualQuantity if the user has not manually overridden it
  useEffect(() => {
    if (!hasManuallyEditedActual && expectedOutput > 0) {
      setActualQuantity(expectedOutput);
    }
  }, [expectedOutput, hasManuallyEditedActual]);

  const totalCost = useMemo(() => {
    return lines.reduce((acc, line) => acc + (Number(line.cost) || 0), 0);
  }, [lines]);

  const unitCost = useMemo(() => {
    if (!actualQuantity || actualQuantity <= 0) return 0;
    return Math.round((totalCost / actualQuantity) * 100) / 100;
  }, [totalCost, actualQuantity]);

  const rawMaterialTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'RM').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const packagingTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'PM').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const otherTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'OT' || l.type === 'FP').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  // Check if any component exceeds available warehouse stock
  const stockShortages = useMemo(() => {
    return lines.filter((l) => {
      const used = Number(l.quantity) || 0;
      const avail = Number(l.availableQuantity) || 0;
      // Exclude labour or overhead lines
      if (l.materialName.toLowerCase().includes('labour') || l.materialName.toLowerCase().includes('overhead')) {
        return false;
      }
      return used > avail;
    });
  }, [lines]);

  // ==========================================
  // 5. SAVE DRAFT (No Stock Deduction)
  // ==========================================

  const handleSaveDraft = async () => {
    if (lines.length === 0) {
      showToast({ title: 'Validation Notice', message: 'Please add at least one component before saving draft.', type: 'warning' });
      return;
    }

    setIsSavingDraft(true);
    try {
      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const selectedVen = vendors.find((v) => v.id === selectedContractorId);
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);

      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const validCompanyId = activeComp && activeComp !== 'ALL' && activeComp.length > 10 ? activeComp : undefined;

      const payload = {
        companyId: validCompanyId,
        serialNumber,
        costingDate,
        warehouseId: selectedWarehouseId || null,
        warehouseName: selectedWh?.name || 'Standard Warehouse',
        contractorVendorId: selectedContractorId || null,
        contractorVendorName: selectedVen?.name || null,
        finishedProductId: selectedFinishedProductId || null,
        finishedProductName: selectedFp?.productName || null,
        finishedProductCode: selectedFp?.productCode || null,
        packSize: endProductSpec.commercialQuantity,
        packSizeUnit: endProductSpec.commercialUnit,
        batchVolume,
        expectedOutput,
        actualOutput: actualQuantity,
        finishedQuantity: actualQuantity,
        lines,
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        otherCost: otherTotal,
        totalBatchCost: totalCost,
        costPerUnit: unitCost,
        postProduction: false,
        action: 'DRAFT',
        notes: `Costing Draft ${serialNumber} saved without inventory deduction.`,
      };

      await ApiClient.post<any>('/api/v1/costing/save', payload);
      const savedCode = res.data?.costingCode || serialNumber;

      showToast({
        title: 'Draft Saved Successfully',
        message: `Costing Voucher ${savedCode} saved as Draft (Unit Cost: PKR ${unitCost.toFixed(2)})`,
        type: 'success',
      });

      await fetchNextSerialNumber();
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      showToast({ title: 'Draft Save Failed', message: err.message || 'Could not save draft.', type: 'error' });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // ==========================================
  // 6. CONFIRM & POST PRODUCTION (Atomic Movement)
  // ==========================================

  const handleConfirmAndPostProduction = async () => {
    if (!selectedWarehouseId) {
      showToast({ title: 'Validation Error', message: 'Please select a Production Warehouse.', type: 'error' });
      return;
    }
    if (!selectedFinishedProductId) {
      showToast({ title: 'Validation Error', message: 'Please select an End Product from the Product Master.', type: 'error' });
      return;
    }
    if (lines.length === 0) {
      showToast({ title: 'Validation Error', message: 'Please add at least one material component.', type: 'error' });
      return;
    }
    if (!actualQuantity || actualQuantity <= 0) {
      showToast({ title: 'Validation Error', message: 'Actual confirmed output quantity must be greater than zero.', type: 'error' });
      return;
    }
    if (stockShortages.length > 0) {
      const firstShort = stockShortages[0];
      showToast({
        title: 'Insufficient Inventory',
        message: `Cannot post production: ${firstShort?.materialName || 'Material'} requires ${firstShort?.quantity || 0} but only ${firstShort?.availableQuantity || 0} is available in warehouse stock.`,
        type: 'error',
      });
      return;
    }

    setIsPostingProduction(true);
    try {
      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const selectedVen = vendors.find((v) => v.id === selectedContractorId);
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);

      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const validCompanyId = activeComp && activeComp !== 'ALL' && activeComp.length > 10 ? activeComp : undefined;

      const payload = {
        companyId: validCompanyId,
        serialNumber,
        costingDate,
        warehouseId: selectedWarehouseId,
        warehouseName: selectedWh?.name || 'Warehouse',
        contractorVendorId: selectedContractorId || null,
        contractorVendorName: selectedVen?.name || null,
        finishedProductId: selectedFinishedProductId,
        finishedProductName: selectedFp?.productName || null,
        finishedProductCode: selectedFp?.productCode || null,
        batchNumber: customBatchNumber.trim() || undefined,
        packSize: endProductSpec.commercialQuantity,
        packSizeUnit: endProductSpec.commercialUnit,
        batchVolume,
        expectedOutput,
        actualOutput: actualQuantity,
        finishedQuantity: actualQuantity,
        lines,
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        otherCost: otherTotal,
        totalBatchCost: totalCost,
        costPerUnit: unitCost,
        postProduction: true,
        action: 'POST',
        notes: `Production Batch posted via Costing Voucher ${serialNumber}.`,
      };

      await ApiClient.post<any>('/api/v1/costing/save', payload);
      const postedBatch = res.data?.batchNumber || 'BATCH';
      const postedCode = res.data?.costingCode || serialNumber;

      showToast({
        title: 'Production Confirmed & Stock Deducted',
        message: `Voucher ${postedCode} posted (Batch: ${postedBatch})! Deducted components from ${selectedWh?.name || 'Warehouse'} and added ${actualQuantity} units of ${selectedFp?.productName || 'Finished Product'} at PKR ${unitCost.toFixed(2)}/unit.`,
        type: 'success',
      });

      setIsPostConfirmOpen(false);
      // Refresh inventory stock & next serial number
      await Promise.all([fetchPurchasedMaterials(selectedWarehouseId), fetchNextSerialNumber()]);
    } catch (err: any) {
      console.error('Failed to post production:', err);
      showToast({
        title: 'Posting Failed',
        message: err.message || 'Operation violates relational integrity or stock constraints.',
        type: 'error',
      });
    } finally {
      setIsPostingProduction(false);
    }
  };

  // ==========================================
  // 7. HISTORY SCREEN
  // ==========================================

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const queryParams: string[] = [];
      if (historySearch) queryParams.push(`search=${encodeURIComponent(historySearch)}`);
      if (historyStartDate) queryParams.push(`startDate=${historyStartDate}`);
      if (historyEndDate) queryParams.push(`endDate=${historyEndDate}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await ApiClient.get<any>(`/api/v1/costing/history${queryString}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setHistoryRecords(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historySearch, historyStartDate, historyEndDate]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  const selectedProduct = finishedProducts.find((p) => p.id === selectedFinishedProductId);

  // ==========================================
  // 8. RENDER ENTERPRISE UI
  // ==========================================

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
      {/* SECTION HEADER & VIEW SWITCHER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)',
            }}
          >
            <IconFlask className="w-6 h-6" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Product Costing & Production Engine
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>
              Real Purchase Order rates, automatic pack UoM conversion, live stock deduction, and confirmed batch unit cost
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadInitialData();
              showToast({ title: 'Refreshed', message: 'Purchase orders and warehouse stock refreshed.', type: 'info' });
            }}
            isLoading={isLoadingMasterData || isLoadingPurchases}
            title="Refresh Real POs & Warehouse Stock"
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '8px',
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
            }}
          >
            <IconRefresh className="w-3.5 h-3.5 mr-1.5" />
            Refresh Stock & POs
          </Button>

          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('voucher')}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'voucher' ? '#ffffff' : 'transparent',
                color: activeTab === 'voucher' ? '#0d9488' : '#64748b',
                boxShadow: activeTab === 'voucher' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Costing Voucher
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
                color: activeTab === 'history' ? '#0d9488' : '#64748b',
                boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Costing History
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* TAB 1: MAIN COSTING VOUCHER (REAL PO & PRODUCTION DRIVEN)               */}
      {/* ======================================================================= */}
      {activeTab === 'voucher' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* COMPACT VOUCHER HEADER CARD */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '16px',
                alignItems: 'flex-end',
              }}
            >
              {/* 1. Serial No */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                    Serial No.
                  </label>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#0d9488',
                      backgroundColor: '#ccfbf1',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    AUTO
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="CST-000001"
                    style={{
                      flex: 1,
                      height: '38px',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#0f766e',
                      backgroundColor: '#f0fdfa',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchNextSerialNumber()}
                    icon={<IconRefresh size={13} />}
                    style={{ height: '38px', padding: '0 10px', fontSize: '12px' }}
                    title="Auto-generate Serial Code"
                  >
                    Auto
                  </Button>
                </div>
              </div>

              {/* 2. Date */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Costing Date
                </label>
                <input
                  type="date"
                  value={costingDate}
                  onChange={(e) => setCostingDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* 3. Warehouse (Required for inventory deduction) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f766e', marginBottom: '6px' }}>
                  Production Warehouse *
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '2px solid #0d9488',
                    backgroundColor: '#f0fdfa',
                    color: '#0f766e',
                    outline: 'none',
                  }}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code ? `${wh.code} - ${wh.name}` : wh.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Contractor / Vendor */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Contractor / Source Vendor
                </label>
                <select
                  value={selectedContractorId}
                  onChange={(e) => setSelectedContractorId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                >
                  <option value="">Select Contractor / Vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code ? `${v.code} — ${v.name}` : v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Production Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '38px' }}>
                {stockShortages.length > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                    STOCK SHORTAGE ({stockShortages.length})
                  </span>
                ) : lines.length > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
                    READY TO POST
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }}></span>
                    DRAFT ENTRY
                  </span>
                )}
              </div>
            </div>

            {/* End Product Master Bar & Commercial Pack Specification */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: '1 1 500px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>
                  End Product * :
                </label>
                <div style={{ flex: 1 }}>
                  <SearchableCombobox
                    label=""
                    options={finishedProducts.map((p) => ({
                      id: p.id,
                      label: `${p.productCode} — ${p.productName} (${p.packingQuantity || 1} ${p.packingUnit || 'Liter'})`,
                      value: p.id,
                    }))}
                    value={selectedFinishedProductId}
                    onChange={(id) => handleFinishedProductChange(id)}
                    placeholder="Select End Product (from Finished Goods Master)..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* Commercial Pack Size Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Commercial Pack Size:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#0f766e',
                        backgroundColor: '#ccfbf1',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #99f6e4',
                        fontFamily: 'monospace',
                      }}
                    >
                      {endProductSpec.commercialDisplay}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#475569',
                        backgroundColor: '#f1f5f9',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontFamily: 'monospace',
                      }}
                      title="Normalized Pack Size in Base Calculation Unit"
                    >
                      = {endProductSpec.normalizedPackSize} {endProductSpec.baseUnit}
                    </span>
                  </div>
                </div>

                {/* Batch Number & Live Verification (Requirements 6, 7, 8) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Batch Number:</span>
                    <input
                      type="text"
                      value={customBatchNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomBatchNumber(val);
                        if (selectedFinishedProductId && val.trim()) {
                          checkBatchExists(selectedFinishedProductId, val.trim());
                        } else {
                          setBatchCheckStatus({ checked: false, exists: false, batch: null, isChecking: false });
                        }
                      }}
                      placeholder="e.g. B-2026-001"
                      style={{
                        height: '32px',
                        width: '180px',
                        padding: '0 8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: batchCheckStatus.checked && !batchCheckStatus.exists ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                      }}
                    />
                  </div>

                  {/* Batch validation feedback & Add New Batch trigger */}
                  {selectedFinishedProductId && customBatchNumber.trim() && batchCheckStatus.checked && (
                    <div style={{ fontSize: '11px', paddingLeft: '84px' }}>
                      {batchCheckStatus.exists ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>
                          ✓ Existing Batch ({Number(batchCheckStatus.batch?.availableQuantity || 0)} Units in stock).
                          {actualQuantity > 0 && ` +${actualQuantity} output → Total: ${Number(batchCheckStatus.batch?.availableQuantity || 0) + actualQuantity} Units.`}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
                          <span>Batch not found.</span>
                          <button
                            type="button"
                            onClick={() => setIsAddBatchModalOpen(true)}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#2563eb',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0,
                              fontSize: '11px',
                            }}
                          >
                            [ + Add New Batch ]
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PREVIOUS COSTING & RECIPE REUSE BANNER (Requirements 2, 12, 13) */}
            {selectedFinishedProductId && latestRecipeData?.hasPreviousCosting && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                      Previous Costing Available:
                    </span>
                  </div>
                  {latestRecipeData.latestCosting && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#14532d' }}>
                      <span style={{ fontWeight: 700, backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                        Latest ({new Date(latestRecipeData.latestCosting.date).toLocaleDateString()}):
                      </span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        PKR {latestRecipeData.latestCosting.unitCost.toFixed(2)}/unit
                      </strong>
                      {latestRecipeData.latestCosting.batchNumber && (
                        <span style={{ color: '#15803d', fontSize: '11px', fontWeight: 600 }}>
                          (Batch: {latestRecipeData.latestCosting.batchNumber})
                        </span>
                      )}
                    </div>
                  )}
                  {latestRecipeData.previousCosting && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4b5563' }}>
                      <span style={{ fontWeight: 600, backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '4px' }}>
                        Previous ({new Date(latestRecipeData.previousCosting.date).toLocaleDateString()}):
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        PKR {latestRecipeData.previousCosting.unitCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyPreviousRecipe}
                  style={{
                    backgroundColor: '#16a34a',
                    borderColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                  }}
                >
                  [ Use Previous Recipe ]
                </Button>
              </div>
            )}
          </div>

          {/* MAIN COSTING TABLE (REAL DATABASE PURCHASE ORDERS & LIVE WAREHOUSE STOCK) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      #
                    </th>
                    <th style={{ padding: '12px 14px', minWidth: '300px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Product / Material & Real PO Source
                    </th>
                    <th style={{ padding: '12px 14px', width: '75px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Type
                    </th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Pack
                    </th>
                    <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0f766e' }}>
                      Available Stock
                    </th>
                    <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8' }}>
                      Used Qty *
                    </th>
                    <th style={{ padding: '12px 14px', width: '85px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                      UoM
                    </th>
                    <th style={{ padding: '12px 14px', width: '135px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Rate (PKR)
                    </th>
                    <th style={{ padding: '12px 14px', width: '145px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                      Cost (PKR)
                    </th>
                    <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Remaining Stock
                    </th>
                    <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const used = Number(line.quantity) || 0;
                    const avail = Number(line.availableQuantity) || 0;
                    const remaining = avail - used;
                    const isShortage =
                      used > avail &&
                      !line.materialName.toLowerCase().includes('labour') &&
                      !line.materialName.toLowerCase().includes('overhead');

                    return (
                      <tr
                        key={line.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Row index */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '12px' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>

                        {/* Material & Real PO Details */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                                {line.materialName || (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    Select material from real Purchase Orders...
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenPickerForLine(line.id, line.type)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  borderRadius: '5px',
                                  backgroundColor: '#f0fdfa',
                                  color: '#0f766e',
                                  border: '1px solid #99f6e4',
                                  cursor: 'pointer',
                                }}
                              >
                                Browse POs
                              </button>
                            </div>

                            {/* Purchase Order Traceability Tag */}
                            {line.sourcePoNumber ? (
                              <div style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700, fontFamily: 'monospace' }}>
                                  ✓ {line.sourcePoNumber}
                                </span>
                                {line.sourcePoQuantity !== undefined && line.sourcePoQuantity > 0 && (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontFamily: 'monospace' }}>
                                    Purchased: {formatVolume(line.sourcePoQuantity, line.pack)}
                                  </span>
                                )}
                                {line.sourcePoTotal !== undefined && (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f0fdfa', color: '#0f766e', fontWeight: 700, fontFamily: 'monospace' }}>
                                    Total PO: PKR {Number(line.sourcePoTotal).toLocaleString()}
                                  </span>
                                )}
                                <span>
                                  {line.purchaseDate ? `Date: ${line.purchaseDate.split('T')[0]}` : ''}
                                  {line.vendorName ? ` • ${line.vendorName}` : ''}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                {line.type === 'OT' ? 'Direct Labour / Overhead' : 'No Purchase Order linked'}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor:
                                line.type === 'RM'
                                  ? '#eff6ff'
                                  : line.type === 'PM'
                                  ? '#f5f3ff'
                                  : line.type === 'FP'
                                  ? '#ecfdf5'
                                  : '#fffbeb',
                              color:
                                line.type === 'RM'
                                  ? '#1d4ed8'
                                  : line.type === 'PM'
                                  ? '#6d28d9'
                                  : line.type === 'FP'
                                  ? '#047857'
                                  : '#b45309',
                              border:
                                line.type === 'RM'
                                  ? '1px solid #bfdbfe'
                                  : line.type === 'PM'
                                  ? '1px solid #ddd6fe'
                                  : line.type === 'FP'
                                  ? '1px solid #a7f3d0'
                                  : '1px solid #fde68a',
                            }}
                          >
                            {line.type}
                          </span>
                        </td>

                        {/* Pack */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={line.pack}
                            onChange={(e) => handleLineChange(line.id, 'pack', e.target.value)}
                            style={{
                              width: '100%',
                              height: '32px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0 6px',
                              backgroundColor: '#ffffff',
                              outline: 'none',
                            }}
                          />
                        </td>

                        {/* Available Stock in Warehouse */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                          {line.materialName.toLowerCase().includes('labour') ? (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          ) : (
                            `${Number(line.availableQuantity || 0).toLocaleString()} ${line.uom}`
                          )}
                        </td>

                        {/* Used Qty */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={line.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              handleLineChange(line.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                            }
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              border: isShortage ? '2px solid #ef4444' : '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0 8px',
                              backgroundColor: isShortage ? '#fff5f5' : '#ffffff',
                              color: isShortage ? '#b91c1c' : '#0f172a',
                              outline: 'none',
                            }}
                          />
                        </td>

                        {/* UoM Column */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            {line.uom || 'LTR'}
                          </span>
                        </td>

                        {/* Rate */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={line.rate}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              handleLineChange(line.id, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                            }
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0 8px',
                              backgroundColor: line.sourcePoNumber ? '#f0fdf4' : '#ffffff',
                              color: '#0f172a',
                              outline: 'none',
                            }}
                          />
                        </td>

                        {/* Cost */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                          {Number(line.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>

                        {/* Remaining Stock */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {line.materialName.toLowerCase().includes('labour') ? (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          ) : isShortage ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                fontFamily: 'monospace',
                              }}
                            >
                              Short ({remaining.toLocaleString()} {line.uom})
                            </span>
                          ) : (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                              {remaining.toLocaleString()} {line.uom}
                            </span>
                          )}
                        </td>

                        {/* Delete Action */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(line.id)}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                            title="Remove line"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <p style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: '#334155' }}>
                          No formulation components added yet
                        </p>
                        <p style={{ fontSize: '13px', margin: '0 0 20px', color: '#94a3b8' }}>
                          Add actual Raw Materials and Packaging Materials purchased through confirmed Purchase Orders.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <Button variant="primary" size="sm" onClick={() => handleAddRow('RM')} icon={<IconPlus size={14} />}>
                            Add Raw Material (RM)
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleAddRow('PM')} icon={<IconPlus size={14} />}>
                            Add Packaging Material (PM)
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Action Bar */}
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('RM')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#1d4ed8', borderColor: '#bfdbfe', backgroundColor: '#eff6ff', fontWeight: 700 }}
                >
                  Add Raw Material (RM)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('PM')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#6d28d9', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontWeight: 700 }}
                >
                  Add Packaging Material (PM)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('FP')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#047857', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', fontWeight: 700 }}
                >
                  Add Finished Product (FP)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('OT')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#b45309', borderColor: '#fde68a', backgroundColor: '#fffbeb', fontWeight: 700 }}
                >
                  Add Other / Material (OT)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLabourRow}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#475569', borderColor: '#cbd5e1', fontWeight: 600 }}
                >
                  Packing Labour (PM)
                </Button>
              </div>

              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Formula: <strong style={{ color: '#0f172a' }}>Cost = Used Qty × Rate</strong>
              </span>
            </div>
          </div>

          {/* BOTTOM BATCH PRODUCTION SUMMARY & EXECUTION ACTIONS */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #99f6e4',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.08), 0 2px 4px -2px rgba(13, 148, 136, 0.04)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '20px',
                alignItems: 'center',
              }}
            >
              {/* 1. Batch Volume */}
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Raw Material Batch Volume
                </span>
                <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                  {batchVolume.toLocaleString()} {endProductSpec.baseUnit}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#0f766e', fontWeight: 600, marginTop: '2px' }}>
                  Pack Size: {endProductSpec.commercialDisplay} ({endProductSpec.normalizedPackSize} {endProductSpec.baseUnit})
                </span>
              </div>

              {/* 2. Expected Output */}
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Est. Expected Output
                </span>
                <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: '#0f766e' }}>
                  {expectedOutput.toLocaleString()} Units
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {batchVolume} {endProductSpec.baseUnit} ÷ {endProductSpec.normalizedPackSize} {endProductSpec.baseUnit}
                </span>
              </div>

              {/* 3. Actual Confirmed Output */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#0f766e', marginBottom: '6px' }}>
                  Actual Output Quantity *
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={actualQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setHasManuallyEditedActual(true);
                      setActualQuantity(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0);
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      textAlign: 'right',
                      fontSize: '17px',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      border: '2px solid #0d9488',
                      borderRadius: '8px 0 0 8px',
                      padding: '0 12px',
                      backgroundColor: '#ffffff',
                      color: '#0f766e',
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      height: '42px',
                      padding: '0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#f0fdfa',
                      border: '2px solid #0d9488',
                      borderLeft: 'none',
                      borderRadius: '0 8px 8px 0',
                      color: '#0f766e',
                    }}
                  >
                    Units
                  </span>
                </div>
              </div>

              {/* 4. Total Batch Cost */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Total Production Cost
                </span>
                <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
                  PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                  RM: {rawMaterialTotal.toLocaleString()} • PM: {packagingTotal.toLocaleString()}
                </span>
              </div>

              {/* 5. Unit Cost (Per Bottle / Pack) */}
              <div
                style={{
                  textAlign: 'right',
                  backgroundColor: '#f0fdfa',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #5eead4',
                }}
              >
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e' }}>
                  Unit Cost (Per {endProductSpec.commercialDisplay})
                </span>
                <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace', color: '#0f766e' }}>
                  PKR {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                  Total Cost ÷ Actual Qty
                </span>
              </div>
            </div>

            {/* Save Draft vs Confirm & Post Production */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '18px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLines([]);
                  setHasManuallyEditedActual(false);
                  setActualQuantity(0);
                  showToast({ title: 'Voucher Cleared', message: 'Ready for new production entry.', type: 'info' });
                }}
                style={{ color: '#64748b' }}
              >
                Clear Voucher
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  isLoading={isSavingDraft}
                  style={{
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                  title="Saves complete formulation recipe snapshot without deducting inventory"
                >
                  Save Costing / Recipe Draft
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleAddCostToProduct}
                  isLoading={isApplyingCost}
                  style={{
                    backgroundColor: '#eef2ff',
                    borderColor: '#c7d2fe',
                    color: '#4338ca',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                  title="Updates Finished Product active standard cost and creates historical cost record without inventory deduction (Rule 4 & 10)"
                >
                  Add Cost to Product
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    if (!selectedWarehouseId) {
                      showToast({ title: 'Warehouse Required', message: 'Please select a production warehouse.', type: 'error' });
                      return;
                    }
                    if (!selectedFinishedProductId) {
                      showToast({ title: 'End Product Required', message: 'Please select an end product.', type: 'error' });
                      return;
                    }
                    if (lines.length === 0) {
                      showToast({ title: 'Components Required', message: 'Please add at least one material component.', type: 'error' });
                      return;
                    }
                    setIsPostConfirmOpen(true);
                  }}
                  style={{
                    backgroundColor: '#0d9488',
                    color: '#ffffff',
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)',
                  }}
                >
                  <IconCheck className="w-4 h-4 mr-1.5" />
                  Confirm & Post Production
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* REAL PURCHASE ORDER MATERIAL SELECTOR MODAL                             */}
      {/* ======================================================================= */}
      {isPickerOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsPickerOpen(false);
            setActiveLineIdForPicker(null);
          }}
          title="Select Material Component From Real Purchase Orders"
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'RM', 'PM', 'FP', 'OT'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPickerFilterType(t)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: pickerFilterType === t ? '1px solid #0d9488' : '1px solid #cbd5e1',
                      backgroundColor: pickerFilterType === t ? '#f0fdfa' : '#ffffff',
                      color: pickerFilterType === t ? '#0f766e' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'ALL'
                      ? 'All'
                      : t === 'RM'
                      ? 'Raw Material (RM)'
                      : t === 'PM'
                      ? 'Packaging (PM)'
                      : t === 'FP'
                      ? 'Finished Product (FP)'
                      : 'Other (OT)'}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', minWidth: '260px' }}>
                <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search material, PO#, vendor..."
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 32px 0 34px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                />
                {pickerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPickerSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* List of Real Purchased Items */}
            <div
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
              }}
            >
              {filteredPickerPurchases.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>No matching purchase order items found</p>
                  <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>
                    Verify that confirmed Purchase Orders exist in the Procurement module.
                  </p>
                </div>
              ) : (
                filteredPickerPurchases.map((item, idx) => {
                  const itemAvail: number =
                    (item.materialId && warehouseStockMap[item.materialId] !== undefined
                      ? warehouseStockMap[item.materialId]
                      : (item.availableStock ?? 0)) ?? 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectPurchasedItem(item)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: idx === filteredPickerPurchases.length - 1 ? 'none' : '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdfa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            {item.materialName}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: item.materialType === 'RAW_MATERIAL' ? '#eff6ff' : '#f5f3ff',
                              color: item.materialType === 'RAW_MATERIAL' ? '#1d4ed8' : '#6d28d9',
                            }}
                          >
                            {item.materialType === 'RAW_MATERIAL' ? 'RM' : item.materialType === 'PACKING_MATERIAL' ? 'PM' : 'FP'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          PO: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{item.poNumber}</strong>
                          {' • '}Date: <strong>{item.purchaseDate ? item.purchaseDate.split('T')[0] : ''}</strong>
                          {' • '}Vendor: <strong>{item.vendorName}</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {/* Total Price */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Total Price:
                          </span>
                          <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#0f766e' }}>
                            PKR {(Number(item.lineTotal) || Number(item.purchaseQuantity) * Number(item.purchaseRate)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Volume, Rate & Live Stock */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe', fontFamily: 'monospace' }}>
                            Purchased: {formatVolume(item.purchaseQuantity, item.pack)}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                            • Rate: PKR {Number(item.purchaseRate).toLocaleString()} / {formatUom(item.pack)}
                          </span>
                          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0', fontFamily: 'monospace' }}>
                            Stock: {itemAvail.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPickerOpen(false);
                  setActiveLineIdForPicker(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================================= */}
      {/* CONFIRM & POST PRODUCTION MODAL (ATOMIC TRANSACTION PREVIEW)           */}
      {/* ======================================================================= */}
      {isPostConfirmOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPostConfirmOpen(false)}
          title="Confirm & Post Production Batch"
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div
              style={{
                backgroundColor: '#f0fdfa',
                border: '1px solid #99f6e4',
                padding: '16px',
                borderRadius: '8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>End Product</span>
                <p style={{ fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>{selectedProduct?.productName || 'Finished Product'}</p>
                <span style={{ fontSize: '11px', color: '#0f766e', fontWeight: 700 }}>{endProductSpec.commercialDisplay}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Warehouse</span>
                <p style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>{selectedWarehouse?.name || 'Selected Warehouse'}</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Confirmed Output</span>
                <p style={{ fontWeight: 800, color: '#0f766e', margin: '2px 0 0', fontFamily: 'monospace' }}>{actualQuantity.toLocaleString()} Units</p>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unit Cost</span>
                <p style={{ fontWeight: 800, color: '#0f766e', margin: '2px 0 0', fontFamily: 'monospace' }}>PKR {unitCost.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <p style={{ fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>
                Inventory Deduction Preview (Deducted from {selectedWarehouse?.name}):
              </p>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Component</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Type</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Available</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>To Consume</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const avail = Number(l.availableQuantity) || 0;
                      const used = Number(l.quantity) || 0;
                      const rem = avail - used;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{l.materialName}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.type}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {l.materialName.toLowerCase().includes('labour') ? '-' : `${avail.toLocaleString()} ${l.uom}`}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#b91c1c' }}>
                            -{used.toLocaleString()} {l.uom}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: rem < 0 ? '#b91c1c' : '#059669' }}>
                            {l.materialName.toLowerCase().includes('labour') ? '-' : `${rem.toLocaleString()} ${l.uom}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              This will execute an atomic database transaction: consuming the required materials from the warehouse, generating batch <strong>{customBatchNumber.trim() || 'auto-generated'}</strong>, and crediting {actualQuantity.toLocaleString()} units of {selectedProduct?.productName} into finished goods stock.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px' }}>
              <Button variant="outline" size="sm" onClick={() => setIsPostConfirmOpen(false)} disabled={isPostingProduction}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmAndPostProduction}
                isLoading={isPostingProduction}
                style={{ backgroundColor: '#0d9488', color: '#ffffff', fontWeight: 700 }}
              >
                Confirm & Post Production Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: SEPARATE COSTING HISTORY SCREEN                                 */}
      {/* ======================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {/* Sub-Tab Navigation: Formulation & Recipe History vs Price & Cost History */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setHistorySubTab('RECIPES')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: historySubTab === 'RECIPES' ? '1.5px solid #0f766e' : '1.5px solid #cbd5e1',
                    backgroundColor: historySubTab === 'RECIPES' ? '#f0fdfa' : '#ffffff',
                    color: historySubTab === 'RECIPES' ? '#0f766e' : '#64748b',
                  }}
                >
                  📜 Formulation &amp; Recipe History
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubTab('PRICE_HISTORY')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: historySubTab === 'PRICE_HISTORY' ? '1.5px solid #2563eb' : '1.5px solid #cbd5e1',
                    backgroundColor: historySubTab === 'PRICE_HISTORY' ? '#eff6ff' : '#ffffff',
                    color: historySubTab === 'PRICE_HISTORY' ? '#1d4ed8' : '#64748b',
                  }}
                >
                  📈 Price &amp; Cost History (Prev → New)
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search product, serial, batch..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    style={{
                      height: '34px',
                      padding: '0 10px 0 28px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      minWidth: '220px',
                    }}
                  />
                </div>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  style={{ height: '34px', padding: '0 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  style={{ height: '34px', padding: '0 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <Button variant="outline" size="sm" onClick={loadHistory}>
                  <IconFilter className="w-3.5 h-3.5 mr-1" />
                  Filter
                </Button>
              </div>
            </div>

            {/* TAB CONTENT: RECIPES */}
            {historySubTab === 'RECIPES' && (
              <>
                {isLoadingHistory ? (
                  <TableSkeleton rows={5} columns={9} />
                ) : historyRecords.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>No costing records found</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>Saved costing vouchers and posted production batches will appear here.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Serial / Code</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Batch #</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>End Product</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Warehouse</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Batch Vol</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Actual Out</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Cost</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unit Cost</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Recipe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((rec, idx) => {
                          let snap: any = {};
                          try {
                            if (rec.notes && rec.notes.startsWith('{')) snap = JSON.parse(rec.notes);
                          } catch {}

                          const productName = snap.productName || rec.finishedProduct?.productName || 'Finished Product';
                          const code = snap.serialNumber || snap.costingCode || rec.costingCode || `CST-v${rec.version}`;
                          const batchNum = snap.batchNumber || rec.batchNumber || '-';
                          const dateStr = snap.costingDate ? snap.costingDate.split('T')[0] : rec.createdAt ? rec.createdAt.split('T')[0] : '';
                          const whName = snap.warehouseName || rec.warehouseName || 'Standard WH';
                          const bVol = snap.batchVolume || rec.batchVolume || Number(rec.packSize || 1) * Number(rec.batchOutputQuantity || 0);
                          const actOut = snap.actualOutput || rec.actualOutput || Number(rec.batchOutputQuantity);
                          const statusVal = snap.status || rec.status || 'DRAFT';

                          return (
                            <tr
                              key={rec.id}
                              onDoubleClick={() => setSelectedHistoryModalRecord(rec)}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                                cursor: 'pointer',
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>{dateStr}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: '#0f766e' }}>{code}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{batchNum}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{productName}</td>
                              <td style={{ padding: '10px 12px', color: '#475569' }}>{whName}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {Number(bVol).toLocaleString()} LTR
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                {Number(actOut).toLocaleString()}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                PKR {Number(rec.totalBatchCost).toLocaleString()}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f766e' }}>
                                PKR {Number(rec.costPerUnit).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    backgroundColor: statusVal === 'POSTED' ? '#ecfdf5' : '#fef3c7',
                                    color: statusVal === 'POSTED' ? '#047857' : '#b45309',
                                    border: statusVal === 'POSTED' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                                  }}
                                >
                                  {statusVal}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <Button variant="outline" size="sm" onClick={() => setSelectedHistoryModalRecord(rec)}>
                                  <IconEye className="w-3.5 h-3.5 mr-1" />
                                  View Recipe
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* TAB CONTENT: PRICE HISTORY (PREVIOUS -> NEW) */}
            {historySubTab === 'PRICE_HISTORY' && (
              <>
                {isLoadingHistory ? (
                  <TableSkeleton rows={5} columns={8} />
                ) : historyRecords.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>No price transition records found</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>Every time Add Cost to Product is clicked, cost history will be tracked here.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Finished Product</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Batch #</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Previous Cost</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>New Unit Cost</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cost Difference</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Costing Ref</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((rec, idx) => {
                          let snap: any = {};
                          try {
                            if (rec.notes && rec.notes.startsWith('{')) snap = JSON.parse(rec.notes);
                          } catch {}

                          const productName = snap.productName || rec.finishedProduct?.productName || 'Finished Product';
                          const code = snap.serialNumber || snap.costingCode || rec.costingCode || `CST-v${rec.version}`;
                          const batchNum = snap.batchNumber || rec.batchNumber || '-';
                          const dateStr = snap.costingDate ? snap.costingDate.split('T')[0] : rec.createdAt ? rec.createdAt.split('T')[0] : '';
                          const prevCost = snap.previousCost !== undefined && snap.previousCost !== null ? Number(snap.previousCost) : (rec.previousCost !== undefined && rec.previousCost !== null ? Number(rec.previousCost) : null);
                          const newCost = Number(rec.costPerUnit);
                          const diff = prevCost !== null ? newCost - prevCost : null;
                          const diffPct = prevCost !== null && prevCost > 0 ? (diff! / prevCost) * 100 : null;
                          const statusVal = snap.status || rec.status || 'DRAFT';

                          return (
                            <tr
                              key={`price-${rec.id}`}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>{dateStr}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{productName}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{batchNum}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                                {prevCost !== null ? `PKR ${prevCost.toFixed(2)}` : '— (Initial)'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f766e' }}>
                                PKR {newCost.toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                {diff !== null ? (
                                  <span style={{ color: diff > 0 ? '#dc2626' : diff < 0 ? '#16a34a' : '#64748b' }}>
                                    {diff > 0 ? `+PKR ${diff.toFixed(2)}` : `PKR ${diff.toFixed(2)}`}
                                    {diffPct !== null && ` (${diffPct.toFixed(1)}%)`}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    backgroundColor: statusVal === 'POSTED' ? '#ecfdf5' : '#fef3c7',
                                    color: statusVal === 'POSTED' ? '#047857' : '#b45309',
                                    border: statusVal === 'POSTED' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                                  }}
                                >
                                  {statusVal}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                                {code}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <Button variant="outline" size="sm" onClick={() => setSelectedHistoryModalRecord(rec)}>
                                  <IconEye className="w-3.5 h-3.5 mr-1" />
                                  View Recipe
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* HISTORICAL VOUCHER REVIEW MODAL (DOUBLE CLICK ACTION)                  */}
      {/* ======================================================================= */}
      {selectedHistoryModalRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedHistoryModalRecord(null)}
          title={`Costing Voucher Snapshot — ${(() => {
            try {
              const s = JSON.parse(selectedHistoryModalRecord.notes || '{}');
              return s.serialNumber || s.costingCode || 'Voucher';
            } catch {
              return 'Voucher';
            }
          })()}`}
          size="xl"
        >
          {(() => {
            let snap: any = {};
            try {
              if (selectedHistoryModalRecord.notes) snap = JSON.parse(selectedHistoryModalRecord.notes);
            } catch {}

            const savedLines: CostingLineItem[] = snap.lines || [];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
                {/* Header Information */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    padding: '14px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>End Product</span>
                    <p style={{ fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                      {snap.productName || selectedHistoryModalRecord.finishedProduct?.productName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Warehouse</span>
                    <p style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>{snap.warehouseName || 'Standard Warehouse'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Batch Number</span>
                    <p style={{ fontWeight: 800, color: '#1d4ed8', margin: '2px 0 0', fontFamily: 'monospace' }}>
                      {snap.batchNumber || 'DRAFT (No Batch)'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Costing Date</span>
                    <p style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 0', fontFamily: 'monospace' }}>
                      {snap.costingDate ? snap.costingDate.split('T')[0] : selectedHistoryModalRecord.createdAt.split('T')[0]}
                    </p>
                  </div>
                </div>

                {/* Table Breakdown */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '35px' }}>#</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Component & PO Source</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Type</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Pack</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '80px' }}>Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>UoM</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Rate (PKR)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '120px' }}>Cost (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedLines.map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{l.materialName}</div>
                            {l.sourcePoNumber && (
                              <div style={{ fontSize: '11px', color: '#059669', fontFamily: 'monospace' }}>
                                PO: {l.sourcePoNumber} ({l.purchaseDate ? l.purchaseDate.split('T')[0] : ''}) • {l.vendorName || ''}
                                {l.sourcePoQuantity ? ` • Vol: ${formatVolume(l.sourcePoQuantity, l.pack)}` : ''}
                                {l.sourcePoTotal ? ` • Total: PKR ${Number(l.sourcePoTotal).toLocaleString()}` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9' }}>
                              {l.type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.pack}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(l.quantity).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{l.uom || 'LTR'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(l.rate).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                            {Number(l.cost).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Arithmetic Summary */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f0fdfa',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #99f6e4',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>TOTAL BATCH COST:</span>
                    <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', margin: '2px 0 0' }}>
                      PKR {Number(selectedHistoryModalRecord.totalBatchCost).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>ACTUAL OUTPUT:</span>
                    <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', margin: '2px 0 0' }}>
                      {Number(selectedHistoryModalRecord.batchOutputQuantity).toLocaleString()} units
                    </p>
                  </div>
                  {snap.previousCost !== undefined && snap.previousCost !== null && (
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>PREVIOUS COST:</span>
                      <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', margin: '2px 0 0', color: '#64748b' }}>
                        PKR {Number(snap.previousCost).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {snap.costDifference !== undefined && snap.costDifference !== null && (
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>COST CHANGE:</span>
                      <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', margin: '2px 0 0', color: Number(snap.costDifference) >= 0 ? '#dc2626' : '#16a34a' }}>
                        {Number(snap.costDifference) >= 0 ? '+' : ''}PKR {Number(snap.costDifference).toFixed(2)}
                        {snap.costDifferencePct !== undefined ? ` (${snap.costDifferencePct}%)` : ''}
                      </p>
                    </div>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e' }}>FINAL UNIT COST:</span>
                    <p style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#0f766e', margin: '2px 0 0' }}>
                      PKR {Number(selectedHistoryModalRecord.costPerUnit).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedHistoryModalRecord(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ======================================================================= */}
      {/* ADD / REGISTER NEW BATCH MODAL (Requirements 6 & 7)                    */}
      {/* ======================================================================= */}
      {isAddBatchModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddBatchModalOpen(false)}
          title="Register New Finished Product Batch"
          description="Create a new batch record for this Finished Product. Finalized costing quantity will be assigned automatically."
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Finished Product:</span>
              <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>
                {endProductSpec.productName || 'Selected Finished Product'} ({endProductSpec.commercialDisplay})
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Batch Number *
              </label>
              <input
                type="text"
                value={customBatchNumber}
                onChange={(e) => setCustomBatchNumber(e.target.value)}
                placeholder="e.g. B-2026-001"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1.5px solid #cbd5e1',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Manufacturing Date *
                </label>
                <input
                  type="date"
                  value={newBatchMfgDate}
                  onChange={(e) => setNewBatchMfgDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={newBatchExpDate}
                  onChange={(e) => setNewBatchExpDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>Production Output Quantity:</span>
              <strong style={{ fontSize: '14px', fontFamily: 'monospace', color: '#1d4ed8' }}>
                {Number(actualQuantity || batchVolumeCalc.actualOutputBottles).toLocaleString()} Units
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsAddBatchModalOpen(false)} disabled={isCreatingBatch}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateNewBatch}
                isLoading={isCreatingBatch}
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', fontWeight: 700 }}
              >
                Register Batch
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ProductCostingView;
