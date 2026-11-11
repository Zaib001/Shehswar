'use client';

/**
 * SHEHSWAR ONE360 - Product Costing Engine
 *
 * Core Principles:
 * 1. Product Creation and Product Costing are completely separate.
 *    Products already exist in All Products / Finished Products.
 *    Costing calculates the real manufacturing cost of an existing product using
 *    real Raw Material and Packaging Material purchase costs from Purchase Orders.
 * 2. Date-Wise Purchase Cost:
 *    Materials get their rates from actual historical Purchase Orders.
 *    Different purchase prices on different dates are preserved.
 *    User selects which purchase/date should be used for the costing.
 *    No arbitrary manual rate entry.
 * 3. Costing History:
 *    Every confirmed costing is saved permanently as an immutable record.
 *    Previous costings are never overwritten.
 * 4. Add to Product (Optional):
 *    Calculated unit cost can be saved against the existing Finished Product.
 *    Rate Lists are NOT automatically modified.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Modal,
  TableSkeleton,
  SearchableCombobox,
} from '../ui';
import {
  IconFlask,
  IconPlus,
  IconCheck,
  IconTrash,
  IconFileText,
  IconEye,
  IconFilter,
} from '../icons';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface RawMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  availableQuantity?: number;
  stockOnHand?: number;
  totalBulkVolume?: number;
  maximumStock?: number;
  costPerBaseUnit?: number;
  unitRate?: number;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol?: string; code?: string };
  purchaseUom?: { name: string; symbol?: string; code?: string };
}

export interface PackingMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol?: string; code?: string };
}

export interface FinishedProductItem {
  id: string;
  productCode: string;
  productName: string;
  packSize?: any;
  packingQuantity?: number;
  packingUnit?: string;
  standardCost?: number;
  status?: string;
}

export interface PurchaseTransaction {
  id: string;
  sourceType: 'PURCHASE_ORDER' | 'PURCHASE_INVOICE';
  documentId: string;
  documentNumber: string;
  purchaseDate: string;
  vendorId?: string;
  vendorName: string;
  vendorCode?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalAmount: number;
  specification?: string;
  numberOfPacks?: number;
  costPerPack?: number;
  packSize?: string;
  status?: string;
}

export interface RawMaterialCostLine {
  id: string;
  rawMaterialId: string;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  sourceVendorName?: string;
  availableQuantity: number;
  requiredQuantity: number;
  unitCost: number;
  totalCost: number;
  unit: string;
  purchaseHistory: PurchaseTransaction[];
  isLoadingPurchases: boolean;
}

export interface PackagingMaterialCostLine {
  id: string;
  packingMaterialId: string;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  sourceVendorName?: string;
  requiredQuantity: number;
  unitCost: number;
  totalCost: number;
  unit: string;
  purchaseHistory: PurchaseTransaction[];
  isLoadingPurchases: boolean;
}

export interface CostingHistoryRecord {
  id: string;
  costingCode?: string;
  costingDate?: string;
  createdAt: string;
  version?: number;
  packSize: number;
  packSizeUnit?: string;
  batchOutputQuantity: number;
  totalRawMaterialCost: number;
  totalPackagingCost: number;
  totalBatchCost: number;
  costPerUnit: number;
  status?: string;
  notes?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  vendorName?: string;
  rawMaterialName?: string;
  rawMaterialCostPerUnit?: number;
  snapshotMetadata?: any;
  materialLines?: {
    rawMaterial?: { materialCode: string; materialName: string };
    quantity: number;
    unitCost: number;
    totalCost: number;
    uomName?: string;
  }[];
  packagingLines?: {
    packingMaterial?: { materialCode: string; materialName: string };
    quantity: number;
    unitCost: number;
    totalCost: number;
    uomName?: string;
  }[];
  finishedProduct?: {
    id?: string;
    productCode: string;
    productName: string;
  };
}

// Helper to parse pack size string (e.g. "2 Liters", "500 ML", "25 KG")
function parsePackSize(packSizeStr: any, defaultUnit = 'Liter'): { size: number; unit: string } {
  if (!packSizeStr) return { size: 1, unit: defaultUnit };
  const str = typeof packSizeStr === 'string' ? packSizeStr : packSizeStr?.name || '';
  const match = String(str).match(/^([\d.]+)\s*([a-zA-Z%]+)?$/);
  if (match && match[1]) {
    return {
      size: parseFloat(match[1]) || 1,
      unit: match[2] || defaultUnit,
    };
  }
  return { size: 1, unit: defaultUnit };
}

export const ProductCostingView: React.FC = () => {
  const { showToast } = useToast();

  // Navigation Tab: 'calculator' | 'history'
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');

  // Master Catalogs
  const [finishedProducts, setFinishedProducts] = useState<FinishedProductItem[]>([]);
  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterialItem[]>([]);
  const [packingMaterialsList, setPackingMaterialsList] = useState<PackingMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Section 0: Header - Finished Product & Production Target
  const [selectedFinishedProductId, setSelectedFinishedProductId] = useState<string>('');
  const [costingDate, setCostingDate] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '');
  const [packSize, setPackSize] = useState<number>(1);
  const [packSizeUnit, setPackSizeUnit] = useState<string>('Liter');
  const [outputQuantity, setOutputQuantity] = useState<number>(100);

  // Section 1: Raw Material Lines
  const [rawMaterialLines, setRawMaterialLines] = useState<RawMaterialCostLine[]>([]);

  // Section 2: Packaging Material Lines
  const [packagingLines, setPackagingLines] = useState<PackagingMaterialCostLine[]>([]);

  // Section 3: Other Production Costs (Optional)
  const [otherCost, setOtherCost] = useState<number | ''>('');
  const [otherCostDescription, setOtherCostDescription] = useState<string>('');

  // Costing History State & Filters
  const [costingHistory, setCostingHistory] = useState<CostingHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterStart, setHistoryFilterStart] = useState<string>('');
  const [historyFilterEnd, setHistoryFilterEnd] = useState<string>('');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CostingHistoryRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Saving / Applying States
  const [isSavingCosting, setIsSavingCosting] = useState(false);
  const [isApplyingCost, setIsApplyingCost] = useState(false);

  // Cache for purchase history by material ID to avoid redundant network queries
  const [purchaseHistoryCache, setPurchaseHistoryCache] = useState<Record<string, PurchaseTransaction[]>>({});

  // ==========================================
  // 1. DATA INITIALIZATION
  // ==========================================

  const loadMasterData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fpRes, rmRes, pmRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/finished-products?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/raw-materials?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials?all=true').catch(() => ({ data: [] })),
      ]);

      const fps = Array.isArray(fpRes.data?.data)
        ? fpRes.data.data
        : Array.isArray(fpRes.data)
        ? fpRes.data
        : [];
      const rms = Array.isArray(rmRes.data?.data)
        ? rmRes.data.data
        : Array.isArray(rmRes.data)
        ? rmRes.data
        : [];
      const pms = Array.isArray(pmRes.data?.data)
        ? pmRes.data.data
        : Array.isArray(pmRes.data)
        ? pmRes.data
        : [];

      setFinishedProducts(fps);
      setRawMaterialsList(rms);
      setPackingMaterialsList(pms);

      // Select first Finished Product if none chosen yet
      if (fps.length > 0 && !selectedFinishedProductId) {
        const firstFp = fps[0];
        setSelectedFinishedProductId(firstFp.id);
        const parsed = parsePackSize(firstFp.packSize || firstFp.packingQuantity);
        setPackSize(parsed.size);
        setPackSizeUnit(parsed.unit);
      }

      // Initialize 1 default Raw Material row if none
      if (rms.length > 0 && rawMaterialLines.length === 0) {
        const firstRm = rms[0];
        const unit = firstRm.baseUom?.name || firstRm.purchaseUom?.name || 'KG';
        const avail = Number(firstRm.availableQuantity ?? firstRm.stockOnHand ?? firstRm.totalBulkVolume ?? 100);
        setRawMaterialLines([
          {
            id: `rm-${Date.now()}-0`,
            rawMaterialId: firstRm.id,
            availableQuantity: avail,
            requiredQuantity: 100,
            unitCost: Number(firstRm.lastPurchaseCost || firstRm.standardCost || 0),
            totalCost: 100 * Number(firstRm.lastPurchaseCost || firstRm.standardCost || 0),
            unit,
            purchaseHistory: [],
            isLoadingPurchases: false,
          },
        ]);
        // Trigger purchase history fetch for first RM
        fetchPurchasesForLine('rm', `rm-${Date.now()}-0`, firstRm.id);
      }

      // Initialize default Packaging rows (Bottle, Label, Carton, Caps)
      if (pms.length > 0 && packagingLines.length === 0) {
        const defaultLines: PackagingMaterialCostLine[] = [];
        const bottle = pms.find((p: any) => /bottle/i.test(p.materialName)) || pms[0];
        const cap = pms.find((p: any) => /cap/i.test(p.materialName));
        const label = pms.find((p: any) => /label/i.test(p.materialName));
        const carton = pms.find((p: any) => /carton|box/i.test(p.materialName));

        if (bottle) {
          const cost = Number(bottle.lastPurchaseCost || bottle.standardCost || 42);
          defaultLines.push({
            id: `pm-${Date.now()}-1`,
            packingMaterialId: bottle.id,
            requiredQuantity: 100,
            unitCost: cost,
            totalCost: 100 * cost,
            unit: bottle.baseUom?.name || 'Nos',
            purchaseHistory: [],
            isLoadingPurchases: false,
          });
        }
        if (label) {
          const cost = Number(label.lastPurchaseCost || label.standardCost || 7);
          defaultLines.push({
            id: `pm-${Date.now()}-2`,
            packingMaterialId: label.id,
            requiredQuantity: 100,
            unitCost: cost,
            totalCost: 100 * cost,
            unit: label.baseUom?.name || 'Nos',
            purchaseHistory: [],
            isLoadingPurchases: false,
          });
        }
        if (carton) {
          const cost = Number(carton.lastPurchaseCost || carton.standardCost || 104);
          defaultLines.push({
            id: `pm-${Date.now()}-3`,
            packingMaterialId: carton.id,
            requiredQuantity: 10,
            unitCost: cost,
            totalCost: 10 * cost,
            unit: carton.baseUom?.name || 'Nos',
            purchaseHistory: [],
            isLoadingPurchases: false,
          });
        }
        if (cap) {
          const cost = Number(cap.lastPurchaseCost || cap.standardCost || 8);
          defaultLines.push({
            id: `pm-${Date.now()}-4`,
            packingMaterialId: cap.id,
            requiredQuantity: 100,
            unitCost: cost,
            totalCost: 100 * cost,
            unit: cap.baseUom?.name || 'Nos',
            purchaseHistory: [],
            isLoadingPurchases: false,
          });
        }
        setPackagingLines(defaultLines);
      }
    } catch (err: any) {
      showToast({
        title: 'Error Loading Master Catalogs',
        message: err.message || 'Failed to load products and materials',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Load Date-Wise Purchase History for a Material Line
  const fetchPurchasesForLine = useCallback(
    async (type: 'rm' | 'pm', lineId: string, materialId: string) => {
      if (!materialId) return;

      // Check Cache
      if (purchaseHistoryCache[materialId]) {
        const cached = purchaseHistoryCache[materialId] || [];
        updateLinePurchases(type, lineId, cached);
        return;
      }

      // Mark line as loading purchases
      if (type === 'rm') {
        setRawMaterialLines((prev) =>
          prev.map((l) => (l.id === lineId ? { ...l, isLoadingPurchases: true } : l))
        );
      } else {
        setPackagingLines((prev) =>
          prev.map((l) => (l.id === lineId ? { ...l, isLoadingPurchases: true } : l))
        );
      }

      try {
        const res = await ApiClient.get<any>(`/api/v1/costing/materials/${materialId}/purchase-history`);
        const list: PurchaseTransaction[] = Array.isArray(res.data?.history) ? res.data.history : [];

        // Save to cache
        setPurchaseHistoryCache((prev) => ({ ...prev, [materialId]: list }));
        updateLinePurchases(type, lineId, list);
      } catch (err) {
        console.warn(`Failed to fetch purchases for material ${materialId}:`, err);
        updateLinePurchases(type, lineId, []);
      }
    },
    [purchaseHistoryCache]
  );

  const updateLinePurchases = (type: 'rm' | 'pm', lineId: string, list: PurchaseTransaction[]) => {
    if (type === 'rm') {
      setRawMaterialLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const latestPo = list.length > 0 ? list[0] : null;
          const cost = latestPo ? latestPo.unitCost : l.unitCost;
          return {
            ...l,
            purchaseHistory: list,
            isLoadingPurchases: false,
            sourcePoId: latestPo?.documentId || l.sourcePoId,
            sourcePoNumber: latestPo?.documentNumber || l.sourcePoNumber,
            purchaseDate: latestPo?.purchaseDate || l.purchaseDate,
            sourceVendorName: latestPo?.vendorName || l.sourceVendorName,
            unitCost: cost,
            totalCost: l.requiredQuantity * cost,
          };
        })
      );
    } else {
      setPackagingLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const latestPo = list.length > 0 ? list[0] : null;
          const cost = latestPo ? latestPo.unitCost : l.unitCost;
          return {
            ...l,
            purchaseHistory: list,
            isLoadingPurchases: false,
            sourcePoId: latestPo?.documentId || l.sourcePoId,
            sourcePoNumber: latestPo?.documentNumber || l.sourcePoNumber,
            purchaseDate: latestPo?.purchaseDate || l.purchaseDate,
            sourceVendorName: latestPo?.vendorName || l.sourceVendorName,
            unitCost: cost,
            totalCost: l.requiredQuantity * cost,
          };
        })
      );
    }
  };

  // Load Costing History Records
  const loadCostingHistory = useCallback(async (start?: string, end?: string, search?: string) => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      if (search) params.set('search', search);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await ApiClient.get<any>(`/api/v1/costing/history${queryString}`);
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setCostingHistory(list);
    } catch (err: any) {
      console.warn('Costing history load error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery);
    }
  }, [activeTab, loadCostingHistory, historyFilterStart, historyFilterEnd, historySearchQuery]);

  // ==========================================
  // 2. FINISHED PRODUCT CHANGE HANDLER
  // ==========================================

  const selectedFinishedProduct = useMemo(() => {
    return finishedProducts.find((p) => p.id === selectedFinishedProductId) || null;
  }, [finishedProducts, selectedFinishedProductId]);

  const handleSelectFinishedProduct = (fpId: string) => {
    setSelectedFinishedProductId(fpId);
    const fp = finishedProducts.find((p) => p.id === fpId);
    if (fp) {
      const parsed = parsePackSize(fp.packSize || fp.packingQuantity);
      setPackSize(parsed.size);
      setPackSizeUnit(parsed.unit);

      // Recalculate raw material required quantity based on Output Quantity × Pack Size
      const totalVol = outputQuantity * parsed.size;
      setRawMaterialLines((prev) =>
        prev.map((l, idx) => {
          if (idx === 0) {
            return {
              ...l,
              requiredQuantity: totalVol,
              totalCost: totalVol * l.unitCost,
            };
          }
          return l;
        })
      );
    }
  };

  const handleOutputQuantityChange = (qty: number) => {
    const safeQty = Math.max(1, Number(qty) || 0);
    setOutputQuantity(safeQty);

    // Auto-update raw material volume for primary raw material line
    const totalVol = safeQty * packSize;
    setRawMaterialLines((prev) =>
      prev.map((l, idx) => {
        if (idx === 0) {
          return {
            ...l,
            requiredQuantity: totalVol,
            totalCost: totalVol * l.unitCost,
          };
        }
        return l;
      })
    );

    // Auto-update packaging quantities based on output
    setPackagingLines((prev) =>
      prev.map((l) => {
        const pm = packingMaterialsList.find((p) => p.id === l.packingMaterialId);
        const isCarton = pm && /carton|box/i.test(pm.materialName);
        const updatedQty = isCarton ? Math.ceil(safeQty / 12) : safeQty;
        return {
          ...l,
          requiredQuantity: updatedQty,
          totalCost: updatedQty * l.unitCost,
        };
      })
    );
  };

  // ==========================================
  // 3. RAW MATERIAL ROW ACTIONS
  // ==========================================

  const handleAddRawMaterialLine = () => {
    if (rawMaterialsList.length === 0) {
      showToast({ title: 'Catalog Empty', message: 'No raw materials found in catalog', type: 'warning' });
      return;
    }
    const usedIds = new Set(rawMaterialLines.map((l) => l.rawMaterialId));
    const nextRm = rawMaterialsList.find((rm) => !usedIds.has(rm.id)) || rawMaterialsList[0];
    if (!nextRm) return;

    const unit = nextRm.baseUom?.name || nextRm.purchaseUom?.name || 'KG';
    const avail = Number(nextRm.availableQuantity ?? nextRm.stockOnHand ?? nextRm.totalBulkVolume ?? 100);
    const cost = Number(nextRm.lastPurchaseCost || nextRm.standardCost || 0);
    const newLineId = `rm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newLine: RawMaterialCostLine = {
      id: newLineId,
      rawMaterialId: nextRm.id,
      availableQuantity: avail,
      requiredQuantity: 10,
      unitCost: cost,
      totalCost: 10 * cost,
      unit,
      purchaseHistory: [],
      isLoadingPurchases: false,
    };

    setRawMaterialLines((prev) => [...prev, newLine]);
    fetchPurchasesForLine('rm', newLineId, nextRm.id);
  };

  const handleRawMaterialChange = (lineId: string, newRmId: string) => {
    const rm = rawMaterialsList.find((r) => r.id === newRmId);
    if (!rm) return;
    const unit = rm.baseUom?.name || rm.purchaseUom?.name || 'KG';
    const avail = Number(rm.availableQuantity ?? rm.stockOnHand ?? rm.totalBulkVolume ?? 100);
    const cost = Number(rm.lastPurchaseCost || rm.standardCost || 0);

    setRawMaterialLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          rawMaterialId: newRmId,
          availableQuantity: avail,
          unit,
          unitCost: cost,
          totalCost: l.requiredQuantity * cost,
          purchaseHistory: [],
          sourcePoId: undefined,
          sourcePoNumber: undefined,
          purchaseDate: undefined,
          sourceVendorName: undefined,
        };
      })
    );

    fetchPurchasesForLine('rm', lineId, newRmId);
  };

  const handleRawMaterialPurchaseSelect = (lineId: string, purchaseId: string) => {
    setRawMaterialLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (purchaseId === 'baseline') {
          const rm = rawMaterialsList.find((r) => r.id === l.rawMaterialId);
          const baseCost = Number(rm?.lastPurchaseCost || rm?.standardCost || 0);
          return {
            ...l,
            sourcePoId: undefined,
            sourcePoNumber: undefined,
            purchaseDate: undefined,
            sourceVendorName: undefined,
            unitCost: baseCost,
            totalCost: l.requiredQuantity * baseCost,
          };
        }
        const tx = l.purchaseHistory.find((p) => p.id === purchaseId);
        if (!tx) return l;
        return {
          ...l,
          sourcePoId: tx.documentId,
          sourcePoNumber: tx.documentNumber,
          purchaseDate: tx.purchaseDate,
          sourceVendorName: tx.vendorName,
          unitCost: tx.unitCost,
          totalCost: l.requiredQuantity * tx.unitCost,
        };
      })
    );
  };

  const handleRawMaterialQtyChange = (lineId: string, qty: number) => {
    const safeQty = Math.max(0, Number(qty) || 0);
    setRawMaterialLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              requiredQuantity: safeQty,
              totalCost: safeQty * l.unitCost,
            }
          : l
      )
    );
  };

  const handleRemoveRawMaterialLine = (lineId: string) => {
    if (rawMaterialLines.length <= 1) {
      showToast({ title: 'Validation', message: 'At least one Raw Material line is required for costing', type: 'warning' });
      return;
    }
    setRawMaterialLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // ==========================================
  // 4. PACKAGING ROW ACTIONS
  // ==========================================

  const handleAddPackagingLine = () => {
    if (packingMaterialsList.length === 0) {
      showToast({ title: 'Catalog Empty', message: 'No packaging materials found in catalog', type: 'warning' });
      return;
    }
    const usedIds = new Set(packagingLines.map((l) => l.packingMaterialId));
    const nextPm = packingMaterialsList.find((pm) => !usedIds.has(pm.id)) || packingMaterialsList[0];
    if (!nextPm) return;

    const unit = nextPm.baseUom?.name || 'Nos';
    const cost = Number(nextPm.lastPurchaseCost || nextPm.standardCost || 0);
    const newLineId = `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newLine: PackagingMaterialCostLine = {
      id: newLineId,
      packingMaterialId: nextPm.id,
      requiredQuantity: outputQuantity,
      unitCost: cost,
      totalCost: outputQuantity * cost,
      unit,
      purchaseHistory: [],
      isLoadingPurchases: false,
    };

    setPackagingLines((prev) => [...prev, newLine]);
    fetchPurchasesForLine('pm', newLineId, nextPm.id);
  };

  const handlePackagingMaterialChange = (lineId: string, newPmId: string) => {
    const pm = packingMaterialsList.find((p) => p.id === newPmId);
    if (!pm) return;
    const unit = pm.baseUom?.name || 'Nos';
    const cost = Number(pm.lastPurchaseCost || pm.standardCost || 0);

    setPackagingLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          packingMaterialId: newPmId,
          unit,
          unitCost: cost,
          totalCost: l.requiredQuantity * cost,
          purchaseHistory: [],
          sourcePoId: undefined,
          sourcePoNumber: undefined,
          purchaseDate: undefined,
          sourceVendorName: undefined,
        };
      })
    );

    fetchPurchasesForLine('pm', lineId, newPmId);
  };

  const handlePackagingPurchaseSelect = (lineId: string, purchaseId: string) => {
    setPackagingLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (purchaseId === 'baseline') {
          const pm = packingMaterialsList.find((p) => p.id === l.packingMaterialId);
          const baseCost = Number(pm?.lastPurchaseCost || pm?.standardCost || 0);
          return {
            ...l,
            sourcePoId: undefined,
            sourcePoNumber: undefined,
            purchaseDate: undefined,
            sourceVendorName: undefined,
            unitCost: baseCost,
            totalCost: l.requiredQuantity * baseCost,
          };
        }
        const tx = l.purchaseHistory.find((p) => p.id === purchaseId);
        if (!tx) return l;
        return {
          ...l,
          sourcePoId: tx.documentId,
          sourcePoNumber: tx.documentNumber,
          purchaseDate: tx.purchaseDate,
          sourceVendorName: tx.vendorName,
          unitCost: tx.unitCost,
          totalCost: l.requiredQuantity * tx.unitCost,
        };
      })
    );
  };

  const handlePackagingQuantityChange = (lineId: string, qty: number) => {
    const safeQty = Math.max(0, Number(qty) || 0);
    setPackagingLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              requiredQuantity: safeQty,
              totalCost: safeQty * l.unitCost,
            }
          : l
      )
    );
  };

  const handleRemovePackagingLine = (lineId: string) => {
    setPackagingLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // ==========================================
  // 5. COST SUMMARY & ARITHMETIC
  // ==========================================

  const totalRawMaterialCost = useMemo(() => {
    return rawMaterialLines.reduce((sum, line) => sum + (Number(line.totalCost) || 0), 0);
  }, [rawMaterialLines]);

  const totalPackagingCost = useMemo(() => {
    return packagingLines.reduce((sum, line) => sum + (Number(line.totalCost) || 0), 0);
  }, [packagingLines]);

  const otherCostNum = useMemo(() => {
    return otherCost !== '' ? Math.max(0, Number(otherCost) || 0) : 0;
  }, [otherCost]);

  const totalProductionCost = useMemo(() => {
    return totalRawMaterialCost + totalPackagingCost + otherCostNum;
  }, [totalRawMaterialCost, totalPackagingCost, otherCostNum]);

  const costPerUnit = useMemo(() => {
    const qty = Number(outputQuantity) || 0;
    if (qty <= 0) return 0;
    return Math.round(((totalProductionCost / qty) + Number.EPSILON) * 100) / 100;
  }, [totalProductionCost, outputQuantity]);

  // ==========================================
  // 6. ACTION: CONFIRM COSTING SNAPSHOT
  // ==========================================

  const handleConfirmCosting = async () => {
    if (!selectedFinishedProductId) {
      showToast({ title: 'Validation Error', message: 'Please select a Finished Product.', type: 'error' });
      return;
    }
    if (outputQuantity <= 0 || packSize <= 0) {
      showToast({ title: 'Validation Error', message: 'Output quantity and pack size must be greater than zero.', type: 'error' });
      return;
    }
    if (rawMaterialLines.length === 0 || rawMaterialLines.some((l) => l.requiredQuantity <= 0)) {
      showToast({ title: 'Validation Error', message: 'Please enter valid required quantities for all raw materials.', type: 'error' });
      return;
    }

    setIsSavingCosting(true);
    try {
      const primaryRm = rawMaterialLines[0];
      const payload = {
        finishedProductId: selectedFinishedProductId,
        costingDate,
        packSize,
        packSizeUnit,
        finishedQuantity: outputQuantity,
        rawMaterialId: primaryRm?.rawMaterialId,
        rawMaterialQuantity: primaryRm?.requiredQuantity,
        rawMaterialCost: primaryRm?.totalCost,
        rawMaterials: rawMaterialLines.map((rm) => ({
          rawMaterialId: rm.rawMaterialId,
          rawMaterialName: rawMaterialsList.find((r) => r.id === rm.rawMaterialId)?.materialName || 'Raw Material',
          rawMaterialCode: rawMaterialsList.find((r) => r.id === rm.rawMaterialId)?.materialCode || '',
          sourcePoId: rm.sourcePoId,
          sourcePoNumber: rm.sourcePoNumber,
          purchaseDate: rm.purchaseDate,
          quantity: rm.requiredQuantity,
          unitCost: rm.unitCost,
          totalCost: rm.totalCost,
          uomName: rm.unit,
        })),
        packagingMaterials: packagingLines.map((pm) => ({
          packingMaterialId: pm.packingMaterialId,
          quantity: pm.requiredQuantity,
          unitCost: pm.unitCost,
          totalCost: pm.totalCost,
          uomName: pm.unit,
          sourcePoNumber: pm.sourcePoNumber,
          purchaseDate: pm.purchaseDate,
        })),
        otherCost: otherCostNum,
        otherCostNotes: otherCostDescription || undefined,
        totalRawMaterialCost,
        totalPackagingCost,
        totalBatchCost: totalProductionCost,
        costPerUnit,
        notes: `Costing calculated for ${outputQuantity} units of ${selectedFinishedProduct?.productName || 'Finished Product'} (${packSize} ${packSizeUnit}) on ${costingDate}`,
      };

      const res = await ApiClient.post<any>('/api/v1/costing/save', payload);
      const generatedCode = res.data?.costingCode || 'CST-CONFIRMED';

      showToast({
        title: 'Costing Saved Permanently',
        message: `Calculation record ${generatedCode} saved: PKR ${costPerUnit.toLocaleString()} / unit. Previous records remain intact.`,
        type: 'success',
      });

      // Refresh costing history
      loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery);
    } catch (err: any) {
      showToast({
        title: 'Error Saving Costing',
        message: err.message || 'Failed to save costing record',
        type: 'error',
      });
    } finally {
      setIsSavingCosting(false);
    }
  };

  // ==========================================
  // 7. ACTION: ADD TO FINISHED PRODUCT
  // ==========================================

  const handleApplyToProduct = async (overrideFpId?: string, overrideCost?: number) => {
    const targetFpId = overrideFpId || selectedFinishedProductId;
    const targetCost = overrideCost !== undefined ? overrideCost : costPerUnit;

    if (!targetFpId) {
      showToast({ title: 'Validation Error', message: 'Please select a Finished Product.', type: 'error' });
      return;
    }
    if (targetCost <= 0) {
      showToast({ title: 'Validation Error', message: 'Calculated unit cost must be greater than zero.', type: 'error' });
      return;
    }

    setIsApplyingCost(true);
    try {
      const payload = {
        finishedProductId: targetFpId,
        costingDate,
        batchOutputQuantity: outputQuantity,
        packSize,
        packSizeUnitName: packSizeUnit,
        totalRawMaterialCost,
        totalPackagingCost,
        totalBatchCost: totalProductionCost,
        costPerUnit: targetCost,
        notes: `Costing applied to Finished Product on ${costingDate}: PKR ${targetCost.toLocaleString()} per unit`,
        rawMaterials: rawMaterialLines.map((rm) => ({
          rawMaterialId: rm.rawMaterialId,
          quantity: rm.requiredQuantity,
          unitCost: rm.unitCost,
          totalCost: rm.totalCost,
          uomName: rm.unit,
        })),
        packagingMaterials: packagingLines.map((pm) => ({
          packingMaterialId: pm.packingMaterialId,
          quantity: pm.requiredQuantity,
          unitCost: pm.unitCost,
          totalCost: pm.totalCost,
          uomName: pm.unit,
        })),
      };

      await ApiClient.post('/api/v1/costing/apply-to-product', payload);

      const targetProduct = finishedProducts.find((p) => p.id === targetFpId);
      showToast({
        title: 'Product Master Cost Updated',
        message: `Assigned PKR ${targetCost.toLocaleString()} standard cost to "${targetProduct?.productName || 'Product'}". Rate list remains untouched.`,
        type: 'success',
      });

      // Update in local state
      setFinishedProducts((prev) =>
        prev.map((p) => (p.id === targetFpId ? { ...p, standardCost: targetCost } : p))
      );
    } catch (err: any) {
      showToast({
        title: 'Failed to Update Product Cost',
        message: err.message || 'Error updating product master',
        type: 'error',
      });
    } finally {
      setIsApplyingCost(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header & Navigation Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Product Costing Engine
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Calculate real manufacturing costs for existing products using actual Purchase Order rates. Immutable date-wise costing history.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveTab('calculator')}
              style={{
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: activeTab === 'calculator' ? '#ffffff' : 'transparent',
                color: activeTab === 'calculator' ? '#0f172a' : 'var(--text-secondary)',
                boxShadow: activeTab === 'calculator' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <IconFlask size={15} /> Costing Calculator
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
                color: activeTab === 'history' ? '#0f172a' : 'var(--text-secondary)',
                boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <IconFileText size={15} /> Costing History ({costingHistory.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'history' ? (
        // ==========================================
        // TAB: COSTING HISTORY
        // ==========================================
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <Card style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Calculations Recorded</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {costingHistory.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Immutable Historical Snapshots</div>
            </Card>

            <Card style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Production Costings</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                {costingHistory.filter((c) => c.status === 'ACTIVE').length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Currently Active Records</div>
            </Card>

            <Card style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Latest Costing Reference</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {costingHistory[0]?.costingCode || (costingHistory.length > 0 && costingHistory[0] ? `CST-${String(costingHistory[0].version || 1).padStart(6, '0')}` : 'None')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {costingHistory[0]?.costingDate ? new Date(costingHistory[0].costingDate).toLocaleDateString('en-GB') : 'N/A'}
              </div>
            </Card>
          </div>

          <Card padding="none" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <CardTitle style={{ fontSize: '16px', fontWeight: 700 }}>Date-Wise Product Costing History</CardTitle>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Double-click any costing record to inspect complete raw material &amp; packaging calculations.
                  </p>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>From:</span>
                    <Input
                      type="date"
                      value={historyFilterStart}
                      onChange={(e) => setHistoryFilterStart(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', width: '130px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>To:</span>
                    <Input
                      type="date"
                      value={historyFilterEnd}
                      onChange={(e) => setHistoryFilterEnd(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', width: '130px' }}
                    />
                  </div>

                  <div style={{ width: '220px' }}>
                    <Input
                      placeholder="Search Code, Product, RM, PO#..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery)}
                    isLoading={isLoadingHistory}
                  >
                    <IconFilter size={12} /> Filter
                  </Button>

                  {(historyFilterStart || historyFilterEnd || historySearchQuery) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setHistoryFilterStart('');
                        setHistoryFilterEnd('');
                        setHistorySearchQuery('');
                        loadCostingHistory('', '', '');
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent style={{ padding: 0 }}>
              {costingHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
                  <IconFileText size={40} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#334155' }}>No costing records match criteria</p>
                  <p style={{ fontSize: '12px', marginTop: '4px', color: '#64748b' }}>
                    Calculate and click &ldquo;Confirm Costing&rdquo; to permanently register a dated manufacturing cost.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Costing Ref</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Costing Date</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Finished Product</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Primary Material</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Source PO</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Output &amp; Pack</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Total Batch Cost</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>Unit Cost</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costingHistory.map((item, idx) => {
                        const code = item.costingCode || `CST-${String(item.version || 1).padStart(6, '0')}`;
                        const cDate = item.costingDate || item.createdAt;
                        const rmLine = item.materialLines?.[0];

                        return (
                          <tr
                            key={item.id}
                            onDoubleClick={() => {
                              setSelectedHistoryItem(item);
                              setIsDetailModalOpen(true);
                            }}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            title="Double-click to open full costing calculation breakdown"
                          >
                            <td style={{ padding: '12px 14px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                              {code}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#334155' }}>
                              {new Date(cDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                              {item.finishedProduct?.productName || item.snapshotMetadata?.productName || 'Finished Product'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                {item.rawMaterialName || rmLine?.rawMaterial?.materialName || 'Raw Material'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                @ PKR {Number(item.rawMaterialCostPerUnit || rmLine?.unitCost || 0).toLocaleString()} / {rmLine?.uomName || 'KG'}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '11.5px' }}>
                              {item.sourcePoNumber ? (
                                <div>
                                  <span style={{ fontWeight: 700, color: '#0284c7' }}>PO: {item.sourcePoNumber}</span>
                                  {item.purchaseDate && (
                                    <span style={{ color: '#64748b', marginLeft: '4px' }}>
                                      ({new Date(item.purchaseDate).toLocaleDateString('en-GB')})
                                    </span>
                                  )}
                                  {item.vendorName && <div style={{ color: '#475569' }}>Vendor: {item.vendorName}</div>}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Baseline Rate</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              {item.batchOutputQuantity} Units × {item.packSize} {item.packSizeUnit || 'L'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              PKR {Number(item.totalBatchCost || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '13.5px', fontFamily: 'var(--font-mono)' }}>
                              PKR {Number(item.costPerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  backgroundColor: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                {item.status || 'CONFIRMED'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedHistoryItem(item);
                                    setIsDetailModalOpen(true);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                >
                                  <IconEye size={12} /> View Breakdown
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // ==========================================
        // TAB: COSTING CALCULATOR
        // ==========================================
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Sections 0, 1, 2, 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* SECTION 0: FINISHED PRODUCT & PRODUCTION TARGET (HEADER) */}
            <Card padding="none" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>
                    1
                  </div>
                  <div>
                    <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Finished Product &amp; Output Target
                    </CardTitle>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Select existing Finished Product to calculate its unit cost. Product creation remains separate.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {/* Finished Product Selector */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '5px' }}>
                      Finished Product * (From Product Master)
                    </label>
                    <SearchableCombobox
                      id="costing-finished-product"
                      value={selectedFinishedProductId}
                      onChange={(val) => handleSelectFinishedProduct(val)}
                      options={finishedProducts.map((fp) => ({
                        value: fp.id,
                        label: `[${fp.productCode || 'FP'}] ${fp.productName}`,
                        subtext: fp.standardCost ? `Standard Cost: PKR ${Number(fp.standardCost).toLocaleString()}` : undefined,
                      }))}
                      placeholder="Type to search finished product..."
                    />
                    {selectedFinishedProduct && (
                      <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', fontWeight: 600 }}>
                        Current Standard Manufacturing Cost: PKR {Number(selectedFinishedProduct.standardCost || 0).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Costing Date */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '5px' }}>
                      Costing Date *
                    </label>
                    <Input
                      type="date"
                      value={costingDate}
                      onChange={(e) => setCostingDate(e.target.value)}
                      style={{ height: '40px', borderRadius: '8px' }}
                    />
                  </div>

                  {/* Commercial Pack Size */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '5px' }}>
                      Commercial Pack Size *
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        type="number"
                        min={0.01}
                        step="any"
                        value={packSize}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPackSize(val);
                          handleOutputQuantityChange(outputQuantity);
                        }}
                        style={{ height: '40px', borderRadius: '8px', flex: 1, fontWeight: 700 }}
                      />
                      <div style={{ width: '110px' }}>
                        <Select
                          value={packSizeUnit}
                          onChange={(e) => setPackSizeUnit(e.target.value)}
                          options={[
                            { value: 'Liter', label: 'Liter' },
                            { value: 'ml', label: 'ml' },
                            { value: 'KG', label: 'KG' },
                            { value: 'Gram', label: 'Gram' },
                            { value: 'Nos', label: 'Nos' },
                            { value: 'Units', label: 'Units' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Output Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '5px' }}>
                      Output Quantity (Units/Bottles) *
                    </label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={outputQuantity}
                      onChange={(e) => handleOutputQuantityChange(Number(e.target.value))}
                      style={{ height: '40px', borderRadius: '8px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  {/* Total Batch Bulk Output Indicator */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '5px' }}>
                      Total Bulk Volume Required
                    </label>
                    <div
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#e0f2fe',
                        borderRadius: '8px',
                        border: '1.5px solid #bae6fd',
                        fontWeight: 800,
                        color: '#0369a1',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span>{outputQuantity * packSize} {packSizeUnit}</span>
                      <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>
                        {outputQuantity} × {packSize} {packSizeUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 1: RAW MATERIALS WITH DATE-WISE PURCHASE HISTORY */}
            <Card padding="none" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>
                    2
                  </div>
                  <div>
                    <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Raw Materials (Date-Wise Purchase History)
                    </CardTitle>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Rates are locked to actual Purchase Orders. Select the historical purchase date/PO for each material.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleAddRawMaterialLine} icon={<IconPlus size={14} />}>
                  Add Raw Material
                </Button>
              </CardHeader>
              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 10px', width: '36px', textAlign: 'center', color: '#475569' }}>#</th>
                        <th style={{ padding: '10px 12px', minWidth: '240px', color: '#475569' }}>Raw Material *</th>
                        <th style={{ padding: '10px 12px', minWidth: '260px', color: '#475569' }}>Purchase Date / PO Reference *</th>
                        <th style={{ padding: '10px 10px', width: '110px', textAlign: 'right', color: '#475569' }}>Available Qty</th>
                        <th style={{ padding: '10px 10px', width: '120px', textAlign: 'right', color: '#475569' }}>Required Qty *</th>
                        <th style={{ padding: '10px 12px', width: '130px', textAlign: 'right', color: '#475569' }}>Unit Cost (PKR)</th>
                        <th style={{ padding: '10px 12px', width: '140px', textAlign: 'right', color: '#475569' }}>Total Cost (PKR)</th>
                        <th style={{ padding: '10px 8px', width: '44px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterialLines.map((line, idx) => {
                        const selectedTx = line.purchaseHistory.find((p) => p.documentId === line.sourcePoId);

                        return (
                          <tr key={line.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '10px 6px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                              {idx + 1}
                            </td>

                            {/* Raw Material Select */}
                            <td style={{ padding: '10px 12px' }}>
                              <select
                                value={line.rawMaterialId}
                                onChange={(e) => handleRawMaterialChange(line.id, e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '38px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  border: '1.5px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  outline: 'none',
                                }}
                              >
                                {rawMaterialsList.map((rm) => (
                                  <option key={rm.id} value={rm.id}>
                                    [{rm.materialCode}] {rm.materialName}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Purchase Date / PO Transaction Selector */}
                            <td style={{ padding: '10px 12px' }}>
                              {line.isLoadingPurchases ? (
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Loading PO history...</div>
                              ) : line.purchaseHistory.length > 0 ? (
                                <select
                                  value={line.sourcePoId || line.purchaseHistory[0]?.id || ''}
                                  onChange={(e) => handleRawMaterialPurchaseSelect(line.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '38px',
                                    padding: '0 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: '1.5px solid #059669',
                                    backgroundColor: '#ecfdf5',
                                    color: '#047857',
                                    outline: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {line.purchaseHistory.map((tx) => (
                                    <option key={tx.id} value={tx.documentId || tx.id}>
                                      {new Date(tx.purchaseDate).toLocaleDateString('en-GB')} • PO: {tx.documentNumber} ({tx.vendorName}) • PKR {tx.unitCost.toLocaleString()}/{tx.unit}
                                    </option>
                                  ))}
                                  <option value="baseline">Default Master Baseline Rate</option>
                                </select>
                              ) : (
                                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontWeight: 600 }}>
                                    Master Rate (No PO Recorded)
                                  </span>
                                </div>
                              )}
                              {selectedTx && (
                                <div style={{ fontSize: '10.5px', color: '#047857', marginTop: '3px', fontWeight: 600 }}>
                                  Vendor: {selectedTx.vendorName} • Qty: {selectedTx.quantity} {selectedTx.unit}
                                </div>
                              )}
                            </td>

                            {/* Available Stock */}
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                              {line.availableQuantity} {line.unit}
                            </td>

                            {/* Required Quantity */}
                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                              <Input
                                type="number"
                                min={0.01}
                                step="any"
                                value={line.requiredQuantity}
                                onChange={(e) => handleRawMaterialQtyChange(line.id, Number(e.target.value))}
                                style={{
                                  height: '38px',
                                  width: '100px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  borderRadius: '6px',
                                }}
                              />
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                {line.unit}
                              </div>
                            </td>

                            {/* Unit Cost (Read-Only) */}
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div
                                style={{
                                  height: '38px',
                                  padding: '0 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  backgroundColor: '#f1f5f9',
                                  borderRadius: '6px',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  fontSize: '12.5px',
                                }}
                              >
                                {line.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                PKR / {line.unit}
                              </div>
                            </td>

                            {/* Total Cost */}
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div
                                style={{
                                  height: '38px',
                                  padding: '0 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  backgroundColor: '#ecfdf5',
                                  borderRadius: '6px',
                                  border: '1px solid #a7f3d0',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 800,
                                  color: '#047857',
                                  fontSize: '13px',
                                }}
                              >
                                PKR {line.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </td>

                            {/* Action: Remove */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveRawMaterialLine(line.id)}
                                disabled={rawMaterialLines.length === 1}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: rawMaterialLines.length === 1 ? '#cbd5e1' : '#ef4444',
                                  cursor: rawMaterialLines.length === 1 ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                }}
                                title="Remove line"
                              >
                                <IconTrash size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: '#334155' }}>
                          Total Raw Material Cost:
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#047857', fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                          PKR {totalRawMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 2: PACKAGING MATERIALS */}
            <Card padding="none" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>
                    3
                  </div>
                  <div>
                    <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Packaging Materials (Bottles, Caps, Labels, Cartons)
                    </CardTitle>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Packaging costs also pull from real Purchase Orders. Enter the quantity required for this batch.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleAddPackagingLine} icon={<IconPlus size={14} />}>
                  Add Packaging Material
                </Button>
              </CardHeader>
              <CardContent style={{ padding: 0 }}>
                {packagingLines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>No packaging materials added yet.</p>
                    <p style={{ fontSize: '11px', marginTop: '4px' }}>Click &ldquo;+ Add Packaging Material&rdquo; to include bottles, caps, labels, cartons, etc.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '10px 10px', width: '36px', textAlign: 'center', color: '#475569' }}>#</th>
                          <th style={{ padding: '10px 12px', minWidth: '240px', color: '#475569' }}>Packaging Material *</th>
                          <th style={{ padding: '10px 12px', minWidth: '260px', color: '#475569' }}>Purchase Date / PO Reference</th>
                          <th style={{ padding: '10px 10px', width: '120px', textAlign: 'right', color: '#475569' }}>Required Qty *</th>
                          <th style={{ padding: '10px 12px', width: '130px', textAlign: 'right', color: '#475569' }}>Unit Cost (PKR)</th>
                          <th style={{ padding: '10px 12px', width: '140px', textAlign: 'right', color: '#475569' }}>Total Cost (PKR)</th>
                          <th style={{ padding: '10px 8px', width: '44px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {packagingLines.map((line, idx) => {
                          const selectedTx = line.purchaseHistory.find((p) => p.documentId === line.sourcePoId);

                          return (
                            <tr key={line.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '10px 6px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                                {idx + 1}
                              </td>

                              {/* Packaging Material Select */}
                              <td style={{ padding: '10px 12px' }}>
                                <select
                                  value={line.packingMaterialId}
                                  onChange={(e) => handlePackagingMaterialChange(line.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '38px',
                                    padding: '0 8px',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    border: '1.5px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    outline: 'none',
                                  }}
                                >
                                  {packingMaterialsList.map((pm) => (
                                    <option key={pm.id} value={pm.id}>
                                      [{pm.materialCode}] {pm.materialName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Purchase Date / PO Transaction Selector */}
                              <td style={{ padding: '10px 12px' }}>
                                {line.isLoadingPurchases ? (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Loading PO history...</div>
                                ) : line.purchaseHistory.length > 0 ? (
                                  <select
                                    value={line.sourcePoId || line.purchaseHistory[0]?.id || ''}
                                    onChange={(e) => handlePackagingPurchaseSelect(line.id, e.target.value)}
                                    style={{
                                      width: '100%',
                                      height: '38px',
                                      padding: '0 8px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      border: '1.5px solid #7c3aed',
                                      backgroundColor: '#f5f3ff',
                                      color: '#6d28d9',
                                      outline: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {line.purchaseHistory.map((tx) => (
                                      <option key={tx.id} value={tx.documentId || tx.id}>
                                        {new Date(tx.purchaseDate).toLocaleDateString('en-GB')} • PO: {tx.documentNumber} • PKR {tx.unitCost.toLocaleString()}/{tx.unit}
                                      </option>
                                    ))}
                                    <option value="baseline">Default Master Baseline Rate</option>
                                  </select>
                                ) : (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontWeight: 600 }}>
                                      Master Baseline Rate
                                    </span>
                                  </div>
                                )}
                                {selectedTx && (
                                  <div style={{ fontSize: '10.5px', color: '#6d28d9', marginTop: '3px', fontWeight: 600 }}>
                                    Vendor: {selectedTx.vendorName}
                                  </div>
                                )}
                              </td>

                              {/* Required Quantity */}
                              <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                                <Input
                                  type="number"
                                  min={0.01}
                                  step="any"
                                  value={line.requiredQuantity}
                                  onChange={(e) => handlePackagingQuantityChange(line.id, Number(e.target.value))}
                                  style={{
                                    height: '38px',
                                    width: '100px',
                                    textAlign: 'right',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-mono)',
                                    borderRadius: '6px',
                                  }}
                                />
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  {line.unit}
                                </div>
                              </td>

                              {/* Unit Cost */}
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div
                                  style={{
                                    height: '38px',
                                    padding: '0 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '6px',
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    fontSize: '12.5px',
                                  }}
                                >
                                  {line.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  PKR / {line.unit}
                                </div>
                              </td>

                              {/* Total Cost */}
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div
                                  style={{
                                    height: '38px',
                                    padding: '0 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    backgroundColor: '#f5f3ff',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd6fe',
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 800,
                                    color: '#6d28d9',
                                    fontSize: '13px',
                                  }}
                                >
                                  PKR {line.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </td>

                              {/* Action: Remove */}
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePackagingLine(line.id)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                  title="Remove line"
                                >
                                  <IconTrash size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                          <td colSpan={5} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: '#334155' }}>
                            Total Packaging Cost:
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#6d28d9', fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                            PKR {totalPackagingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 3: OTHER PRODUCTION / LABOUR COSTS (OPTIONAL) */}
            <Card padding="none" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <CardHeader style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#fffbeb', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                    4
                  </div>
                  <CardTitle style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    Other Included Costs (Optional Labour / Filling / Overhead)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent style={{ padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      Additional Cost (PKR)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={otherCost}
                      onChange={(e) => setOtherCost(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 4000"
                      style={{ height: '38px', borderRadius: '6px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      Cost Description / Notes
                    </label>
                    <Input
                      value={otherCostDescription}
                      onChange={(e) => setOtherCostDescription(e.target.value)}
                      placeholder="e.g. Filling &amp; packing labour, contract packing, electricity"
                      style={{ height: '38px', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Section 4 — Cost Summary & Execution Card */}
          <div style={{ position: 'sticky', top: '24px' }}>
            <Card padding="none" style={{ borderRadius: '12px', border: '2px solid #059669', boxShadow: '0 8px 24px rgba(5, 150, 105, 0.12)', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#059669', color: '#ffffff', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9, fontWeight: 700 }}>
                  Manufacturing Cost Summary
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }}>
                  {selectedFinishedProduct?.productName || 'PRODUCT COSTING'}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  Pack Size: {packSize} {packSizeUnit} • Target: {outputQuantity} Units
                </div>
              </div>

              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Costing Date:</span>
                    <strong style={{ color: '#0f172a' }}>
                      {costingDate ? new Date(costingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Raw Material Cost:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      PKR {totalRawMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Packaging Cost:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      PKR {totalPackagingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {otherCostNum > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Other Cost:</span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                        PKR {otherCostNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px', fontWeight: 800 }}>
                    <span style={{ color: '#0f172a' }}>TOTAL PRODUCTION COST:</span>
                    <span style={{ color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                      PKR {totalProductionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px' }}>
                    <span>Output Quantity:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{outputQuantity} Units</span>
                  </div>

                  {/* High Visibility Unit Cost Display */}
                  <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '10px', padding: '16px', textAlign: 'center', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#065f46', fontWeight: 800, letterSpacing: '0.05em' }}>
                      MANUFACTURING COST PER UNIT / BOTTLE
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: 900, color: '#047857', margin: '6px 0', fontFamily: 'var(--font-mono)' }}>
                      PKR {costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: '#065f46', opacity: 0.85 }}>
                      ({totalProductionCost.toLocaleString()} ÷ {outputQuantity} units)
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    <Button
                      variant="primary"
                      onClick={handleConfirmCosting}
                      disabled={isSavingCosting || !selectedFinishedProductId || costPerUnit <= 0}
                      isLoading={isSavingCosting}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        backgroundColor: '#059669',
                        borderColor: '#059669',
                        height: '42px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                      }}
                    >
                      <IconCheck size={16} /> Confirm &amp; Save Costing Permanently
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => handleApplyToProduct()}
                      disabled={isApplyingCost || !selectedFinishedProductId || costPerUnit <= 0}
                      isLoading={isApplyingCost}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        borderColor: '#0284c7',
                        color: '#0284c7',
                        height: '40px',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                      title="Update the existing Finished Product's standard cost in Product Master"
                    >
                      <IconFileText size={15} /> Add to Product (Update Standard Cost)
                    </Button>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                    Confirming records an immutable costing snapshot. Rate lists are NOT modified.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==========================================
          DETAIL / BREAKDOWN MODAL (FOR AUDIT & INSPECTION)
          ========================================== */}
      {isDetailModalOpen && selectedHistoryItem && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Costing Breakdown: ${selectedHistoryItem.costingCode || 'CST-RECORD'}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Identity Bar */}
            <div style={{ padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {selectedHistoryItem.finishedProduct?.productName || selectedHistoryItem.snapshotMetadata?.productName || 'Finished Product'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Costing Date: <strong>{new Date(selectedHistoryItem.costingDate || selectedHistoryItem.createdAt).toLocaleDateString('en-GB')}</strong>
                  <span style={{ margin: '0 8px', color: '#cbd5e1' }}>&bull;</span>
                  Output: <strong>{selectedHistoryItem.batchOutputQuantity} Units</strong> ({selectedHistoryItem.packSize} {selectedHistoryItem.packSizeUnit || 'L'})
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Unit Cost</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                  PKR {Number(selectedHistoryItem.costPerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Raw Materials Breakdown */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                Raw Materials Used
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Material</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Source PO / Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Qty Used</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Unit Cost</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedHistoryItem.snapshotMetadata?.rawMaterials || selectedHistoryItem.materialLines || []).map((rm: any, idx: number) => {
                      const name = rm.rawMaterialName || rm.rawMaterial?.materialName || 'Raw Material';
                      const po = rm.sourcePoNumber ? `PO: ${rm.sourcePoNumber}` : 'Baseline Rate';
                      const pDate = rm.purchaseDate ? ` (${new Date(rm.purchaseDate).toLocaleDateString('en-GB')})` : '';
                      const qty = Number(rm.quantity || 0);
                      const unitRate = Number(rm.unitCost || 0);
                      const total = Number(rm.totalCost || qty * unitRate);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{name}</td>
                          <td style={{ padding: '8px 10px', color: '#0284c7' }}>{po}{pDate}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{qty} {rm.uomName || 'KG'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>PKR {unitRate.toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PKR {total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Packaging Materials Breakdown */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                Packaging Materials Used
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Material</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Qty Used</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Unit Cost</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedHistoryItem.snapshotMetadata?.packagingMaterials || selectedHistoryItem.packagingLines || []).map((pm: any, idx: number) => {
                      const name = pm.packingMaterial?.materialName || `Packaging #${idx + 1}`;
                      const qty = Number(pm.quantity || 0);
                      const unitRate = Number(pm.unitCost || 0);
                      const total = Number(pm.totalCost || qty * unitRate);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{qty} {pm.uomName || 'Nos'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>PKR {unitRate.toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PKR {total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Box */}
            <div style={{ padding: '14px 18px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>Total Raw Material Cost:</span>
                <strong>PKR {Number(selectedHistoryItem.totalRawMaterialCost || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>Total Packaging Cost:</span>
                <strong>PKR {Number(selectedHistoryItem.totalPackagingCost || 0).toLocaleString()}</strong>
              </div>
              {selectedHistoryItem.snapshotMetadata?.otherCost && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span>Other Cost ({selectedHistoryItem.snapshotMetadata.otherCostNotes || 'Overhead'}):</span>
                  <strong>PKR {Number(selectedHistoryItem.snapshotMetadata.otherCost).toLocaleString()}</strong>
                </div>
              )}
              <div style={{ height: '1px', backgroundColor: '#a7f3d0', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#065f46' }}>
                <span>TOTAL PRODUCTION BATCH COST:</span>
                <span>PKR {Number(selectedHistoryItem.totalBatchCost || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                <span>CALCULATED COST PER UNIT:</span>
                <span>PKR {Number(selectedHistoryItem.costPerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Unit</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
              {selectedHistoryItem.finishedProduct?.id && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleApplyToProduct(
                      selectedHistoryItem.finishedProduct?.id,
                      selectedHistoryItem.costPerUnit
                    );
                    setIsDetailModalOpen(false);
                  }}
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  <IconFileText size={14} /> Assign Cost to {selectedHistoryItem.finishedProduct.productName}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
