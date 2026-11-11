'use client';

/**
 * SHEHSWAR ONE360 - Product Costing Engine
 *
 * Core Mandates:
 * 1. Date-Wise Purchase Cost History:
 *    A product can be purchased multiple times on different dates at completely different rates.
 *    The system NEVER treats a product as having only one permanent purchase cost.
 *    Every purchase transaction retains its own date, quantity, amount, and calculated unit cost.
 * 2. Immutable Costing Snapshot:
 *    Every Product Costing calculation is saved permanently using the actual purchase rate selected at that time.
 *    A subsequent purchase NEVER overwrites or recalculates an existing confirmed costing record.
 * 3. Purchase Cost Selection:
 *    Selecting a material fetches and displays all date-wise PO transactions.
 *    The user selects which purchase transaction to base the costing on (e.g. 1-Nov @ 800/KG vs 1-Dec @ 1,600/KG).
 * 4. Transparent Arithmetic:
 *    (Raw Material Cost + Total Packaging Cost) ÷ Output Bottles = Cost Per Bottle.
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
} from '../ui';
import {
  IconFlask,
  IconPlus,
  IconCheck,
  IconTrash,
  IconFileText,
  IconEye,
  IconAlertTriangle,
  IconFilter,
} from '../icons';

interface RawMaterialItem {
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
  totalPurchasedValue?: number;
  bulkPacking?: string;
  baseUom?: { name: string; symbol?: string; code?: string };
  purchaseUom?: { name: string; symbol?: string; code?: string };
}

interface PackingMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  totalPurchasedValue?: number;
  bulkPacking?: string;
  baseUom?: { name: string; symbol?: string; code?: string };
  category?: { code: string; name: string };
}

interface PurchaseTransaction {
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

interface PackagingLine {
  id: string;
  packingMaterialId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface CostingHistoryRecord {
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
    productCode: string;
    productName: string;
  };
}

export const ProductCostingView: React.FC = () => {
  const { showToast } = useToast();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');

  // Master Catalogs
  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterialItem[]>([]);
  const [packingMaterialsList, setPackingMaterialsList] = useState<PackingMaterialItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Section 1: Raw Material Selection & Pricing Mode
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState<string>('');
  const [costMode, setCostMode] = useState<'PER_UNIT' | 'BATCH_TOTAL'>('PER_UNIT');
  const [customRawMaterialCost, setCustomRawMaterialCost] = useState<number | ''>('');

  // Purchase History for Selected Material
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseTransaction[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseTransaction | null>(null);
  const [isLoadingPurchaseHistory, setIsLoadingPurchaseHistory] = useState(false);
  const [purchaseFilterStart, setPurchaseFilterStart] = useState<string>('');
  const [purchaseFilterEnd, setPurchaseFilterEnd] = useState<string>('');

  // Section 2: Production Parameters & Costing Date
  const [costingDate, setCostingDate] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '');
  const [packSize, setPackSize] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState<string>('Liter');
  const [outputBottles, setOutputBottles] = useState<number>(50);

  // Section 3: Packaging Materials
  const [packagingLines, setPackagingLines] = useState<PackagingLine[]>([]);

  // Section 4: History Tab & Search/Filters
  const [costingHistory, setCostingHistory] = useState<CostingHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterStart, setHistoryFilterStart] = useState<string>('');
  const [historyFilterEnd, setHistoryFilterEnd] = useState<string>('');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CostingHistoryRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Optional: Add to Finished Product Modal
  const [isAddToProductModalOpen, setIsAddToProductModalOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [existingProductId, setExistingProductId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductSellingPrice, setNewProductSellingPrice] = useState<number>(2800);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // ==========================================
  // 1. DATA INITIALIZATION
  // ==========================================

  const loadMasterData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rmRes, pmRes, catRes, fpRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/raw-materials?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/product-categories?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products?all=true').catch(() => ({ data: [] })),
      ]);

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
      const cats = Array.isArray(catRes.data?.data)
        ? catRes.data.data
        : Array.isArray(catRes.data)
        ? catRes.data
        : [];
      const fps = Array.isArray(fpRes.data?.data)
        ? fpRes.data.data
        : Array.isArray(fpRes.data)
        ? fpRes.data
        : [];

      setRawMaterialsList(rms);
      setPackingMaterialsList(pms);
      setCategories(cats);
      setFinishedProducts(fps);

      // Auto-select first Raw Material if none selected yet
      setSelectedRawMaterialId((prev) => (prev ? prev : rms.length > 0 ? rms[0].id : ''));

      // Pre-seed default packaging if lines are empty
      setPackagingLines((currentLines) => {
        if (currentLines.length > 0 || pms.length === 0) return currentLines;
        const bottle = pms.find((p: any) => /bottle/i.test(p.materialName)) || pms[0];
        const cap = pms.find((p: any) => /cap/i.test(p.materialName));
        const label = pms.find((p: any) => /label/i.test(p.materialName));
        const carton = pms.find((p: any) => /carton|box/i.test(p.materialName));

        const initialLines: PackagingLine[] = [];
        if (bottle) {
          const cost = Number(bottle.lastPurchaseCost || bottle.standardCost || 40);
          initialLines.push({
            id: 'line-bottle',
            packingMaterialId: bottle.id,
            quantity: 50,
            unitCost: cost,
            totalCost: 50 * cost,
          });
        }
        if (cap) {
          const cost = Number(cap.lastPurchaseCost || cap.standardCost || 5);
          initialLines.push({
            id: 'line-cap',
            packingMaterialId: cap.id,
            quantity: 50,
            unitCost: cost,
            totalCost: 50 * cost,
          });
        }
        if (label) {
          const cost = Number(label.lastPurchaseCost || label.standardCost || 8);
          initialLines.push({
            id: 'line-label',
            packingMaterialId: label.id,
            quantity: 50,
            unitCost: cost,
            totalCost: 50 * cost,
          });
        }
        if (carton) {
          const cost = Number(carton.lastPurchaseCost || carton.standardCost || 60);
          initialLines.push({
            id: 'line-carton',
            packingMaterialId: carton.id,
            quantity: 10,
            unitCost: cost,
            totalCost: 10 * cost,
          });
        }
        return initialLines;
      });
    } catch (err: any) {
      showToast({
        title: 'Error Loading Catalog',
        message: err.message || 'Failed to load materials catalog',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Load Date-Wise Purchase Cost History for Selected Material
  const loadPurchaseHistory = useCallback(async (matId: string, start?: string, end?: string) => {
    if (!matId) {
      setPurchaseHistory([]);
      setSelectedPurchaseId(null);
      setSelectedPurchase(null);
      return;
    }
    setIsLoadingPurchaseHistory(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await ApiClient.get<any>(`/api/v1/costing/materials/${matId}/purchase-history${queryString}`);
      const list: PurchaseTransaction[] = Array.isArray(res.data?.history) ? res.data.history : [];
      setPurchaseHistory(list);

      // Auto-select latest purchase if available
      if (list.length > 0 && list[0]) {
        const latest = list[0];
        setSelectedPurchaseId(latest.id);
        setSelectedPurchase(latest);
        setCustomRawMaterialCost(latest.unitCost);
        setCostMode('PER_UNIT');
      } else {
        setSelectedPurchaseId(null);
        setSelectedPurchase(null);
      }
    } catch (err: any) {
      console.warn('Purchase history load warning:', err);
      setPurchaseHistory([]);
    } finally {
      setIsLoadingPurchaseHistory(false);
    }
  }, []);

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
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    if (selectedRawMaterialId) {
      loadPurchaseHistory(selectedRawMaterialId, purchaseFilterStart, purchaseFilterEnd);
    }
  }, [selectedRawMaterialId, loadPurchaseHistory, purchaseFilterStart, purchaseFilterEnd]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery);
    }
  }, [activeTab, loadCostingHistory, historyFilterStart, historyFilterEnd, historySearchQuery]);

  // ==========================================
  // 2. RAW MATERIAL RETRIEVAL & AVAILABILITY
  // ==========================================

  const selectedRawMaterial = useMemo(() => {
    return rawMaterialsList.find((rm) => rm.id === selectedRawMaterialId) || null;
  }, [rawMaterialsList, selectedRawMaterialId]);

  // Available Quantity: real stock on hand
  const availableQuantity = useMemo(() => {
    if (!selectedRawMaterial) return 0;
    if (selectedRawMaterial.availableQuantity !== undefined && selectedRawMaterial.availableQuantity !== null) {
      return Number(selectedRawMaterial.availableQuantity);
    }
    if (selectedRawMaterial.stockOnHand !== undefined && selectedRawMaterial.stockOnHand !== null) {
      return Number(selectedRawMaterial.stockOnHand);
    }
    if (selectedRawMaterial.totalBulkVolume && Number(selectedRawMaterial.totalBulkVolume) > 0) {
      return Number(selectedRawMaterial.totalBulkVolume);
    }
    return Number(selectedRawMaterial.maximumStock || 250);
  }, [selectedRawMaterial]);

  // Baseline Fallback Cost (PKR per base unit)
  const defaultRawMaterialCost = useMemo(() => {
    if (selectedPurchase && selectedPurchase.unitCost > 0) {
      return selectedPurchase.unitCost;
    }
    if (!selectedRawMaterial) return 0;
    const cost = Number(
      selectedRawMaterial.costPerBaseUnit ??
      selectedRawMaterial.lastPurchaseCost ??
      selectedRawMaterial.standardCost ??
      selectedRawMaterial.unitRate ??
      0
    );
    return cost;
  }, [selectedRawMaterial, selectedPurchase]);

  useEffect(() => {
    if (selectedPurchase) {
      setCustomRawMaterialCost(selectedPurchase.unitCost);
    } else if (selectedRawMaterial && customRawMaterialCost === '') {
      setCustomRawMaterialCost(defaultRawMaterialCost);
    }
  }, [selectedPurchase, selectedRawMaterial, defaultRawMaterialCost]);

  const rawMaterialUnitCost = useMemo(() => {
    if (customRawMaterialCost !== '' && Number(customRawMaterialCost) >= 0) {
      return Number(customRawMaterialCost);
    }
    return defaultRawMaterialCost;
  }, [customRawMaterialCost, defaultRawMaterialCost]);

  const rawMaterialUnitName = useMemo(() => {
    return (
      selectedPurchase?.unit ||
      selectedRawMaterial?.baseUom?.name ||
      selectedRawMaterial?.purchaseUom?.name ||
      packSizeUnit ||
      'KG'
    );
  }, [selectedPurchase, selectedRawMaterial, packSizeUnit]);

  // Handle User Selecting a specific Historical Purchase Record
  const handleSelectPurchase = (item: PurchaseTransaction) => {
    setSelectedPurchaseId(item.id);
    setSelectedPurchase(item);
    setCostMode('PER_UNIT');
    setCustomRawMaterialCost(item.unitCost);
    showToast({
      title: 'Purchase Rate Selected',
      message: `Selected PO ${item.documentNumber} (${new Date(item.purchaseDate).toLocaleDateString('en-GB')}) at PKR ${item.unitCost.toLocaleString()}/${item.unit}`,
      type: 'info',
    });
  };

  // ==========================================
  // 3. ARITHMETIC & FORMULA ENGINE
  // ==========================================

  // Required Raw Material = Pack Size × Number of Bottles / Units
  const requiredRawMaterial = useMemo(() => {
    const size = Number(packSize) || 0;
    const units = Number(outputBottles) || 0;
    return size * units;
  }, [packSize, outputBottles]);

  // Stock Availability Check
  const isStockSufficient = useMemo(() => {
    if (availableQuantity <= 0) return true; // Don't block calculation if inventory wasn't initialized
    return availableQuantity >= requiredRawMaterial;
  }, [availableQuantity, requiredRawMaterial]);

  // Raw Material Batch Cost
  const rawMaterialTotalCost = useMemo(() => {
    if (costMode === 'BATCH_TOTAL') {
      return rawMaterialUnitCost;
    }
    return requiredRawMaterial * rawMaterialUnitCost;
  }, [costMode, requiredRawMaterial, rawMaterialUnitCost]);

  // Raw Material Cost Per Bottle
  const rawMaterialCostPerBottle = useMemo(() => {
    const units = Number(outputBottles) || 0;
    return units > 0 ? rawMaterialTotalCost / units : 0;
  }, [rawMaterialTotalCost, outputBottles]);

  // Total Packaging Cost
  const totalPackagingCost = useMemo(() => {
    return packagingLines.reduce((sum, line) => sum + (Number(line.totalCost) || 0), 0);
  }, [packagingLines]);

  // Total Batch Cost
  const totalProductionCost = useMemo(() => {
    return rawMaterialTotalCost + totalPackagingCost;
  }, [rawMaterialTotalCost, totalPackagingCost]);

  // Cost Per Bottle
  const costPerBottle = useMemo(() => {
    const units = Number(outputBottles) || 0;
    if (units <= 0) return 0;
    return Math.round(((totalProductionCost / units) + Number.EPSILON) * 100) / 100;
  }, [totalProductionCost, outputBottles]);

  // ==========================================
  // 4. PACKAGING ROW ACTIONS
  // ==========================================

  const handleAddPackagingLine = () => {
    if (packingMaterialsList.length === 0) {
      showToast({
        title: 'Master Empty',
        message: 'No packaging materials found in packing material master.',
        type: 'warning',
      });
      return;
    }
    const usedIds = new Set(packagingLines.map((l) => l.packingMaterialId));
    const nextPm = packingMaterialsList.find((pm) => !usedIds.has(pm.id)) || packingMaterialsList[0];
    if (!nextPm) return;
    const unitCost = Number(nextPm.lastPurchaseCost || nextPm.standardCost || 0);

    const newLine: PackagingLine = {
      id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      packingMaterialId: nextPm.id,
      quantity: outputBottles > 0 ? outputBottles : 50,
      unitCost,
      totalCost: (outputBottles > 0 ? outputBottles : 50) * unitCost,
    };

    setPackagingLines((prev) => [...prev, newLine]);
  };

  const handlePackagingMaterialChange = (lineId: string, newPmId: string) => {
    const pm = packingMaterialsList.find((p) => p.id === newPmId);
    if (!pm) return;
    const unitCost = Number(pm.lastPurchaseCost || pm.standardCost || 0);

    setPackagingLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              packingMaterialId: newPmId,
              unitCost,
              totalCost: l.quantity * unitCost,
            }
          : l
      )
    );
  };

  const handlePackagingQuantityChange = (lineId: string, qty: number) => {
    const safeQty = Math.max(0, Number(qty) || 0);
    setPackagingLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              quantity: safeQty,
              totalCost: safeQty * l.unitCost,
            }
          : l
      )
    );
  };

  const handleRemovePackagingLine = (lineId: string) => {
    setPackagingLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const handleOutputBottlesChange = (val: number) => {
    const newQty = Math.max(1, Number(val) || 0);
    setOutputBottles(newQty);
    setPackagingLines((prev) =>
      prev.map((l) => {
        const pm = packingMaterialsList.find((p) => p.id === l.packingMaterialId);
        const isCarton = pm && /carton|box/i.test(pm.materialName);
        const updatedQty = isCarton ? Math.ceil(newQty / 5) : newQty;
        return {
          ...l,
          quantity: updatedQty,
          totalCost: updatedQty * l.unitCost,
        };
      })
    );
  };

  // ==========================================
  // 5. SAVE / CONFIRM COSTING (IMMUTABLE SNAPSHOT)
  // ==========================================

  const [isSavingCosting, setIsSavingCosting] = useState(false);

  const handleConfirmCosting = async () => {
    if (!selectedRawMaterialId) {
      showToast({ title: 'Validation Error', message: 'Please select a Raw Material.', type: 'error' });
      return;
    }
    if (!isStockSufficient) {
      showToast({
        title: 'Insufficient Raw Material',
        message: `Batch requires ${requiredRawMaterial} ${rawMaterialUnitName}, but only ${availableQuantity} ${rawMaterialUnitName} is in stock.`,
        type: 'error',
      });
      return;
    }
    if (outputBottles <= 0 || packSize <= 0) {
      showToast({ title: 'Validation Error', message: 'Pack size and output bottles must be greater than zero.', type: 'error' });
      return;
    }

    setIsSavingCosting(true);
    try {
      const payload = {
        costingDate,
        sourcePoId: selectedPurchase?.documentId,
        sourcePoNumber: selectedPurchase?.documentNumber,
        purchaseDate: selectedPurchase?.purchaseDate,
        sourceVendorName: selectedPurchase?.vendorName,
        sourceVendorCode: selectedPurchase?.vendorCode,
        rawMaterialId: selectedRawMaterialId,
        rawMaterialQuantity: requiredRawMaterial,
        rawMaterialCost: rawMaterialTotalCost,
        packSize,
        packSizeUnit,
        finishedQuantity: outputBottles,
        packagingMaterials: packagingLines.map((l) => {
          const pm = packingMaterialsList.find((p) => p.id === l.packingMaterialId);
          return {
            packingMaterialId: l.packingMaterialId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            totalCost: l.totalCost,
            uomName: pm?.baseUom?.name || 'Nos',
          };
        }),
        totalRawMaterialCost: rawMaterialTotalCost,
        totalPackagingCost,
        totalBatchCost: totalProductionCost,
        costPerUnit: costPerBottle,
        notes: `Costing calculated on ${costingDate} for ${outputBottles} units (${packSize} ${packSizeUnit}) of ${selectedRawMaterial?.materialName}${selectedPurchase ? ` based on PO ${selectedPurchase.documentNumber} (${new Date(selectedPurchase.purchaseDate).toLocaleDateString('en-GB')})` : ''}`,
      };

      const res = await ApiClient.post<any>('/api/v1/costing/save', payload);
      const generatedCode = res.data?.costingCode || res.data?.costing?.notes ? (() => {
        try {
          return JSON.parse(res.data.costing.notes).costingCode;
        } catch {
          return 'CST-CONFIRMED';
        }
      })() : 'CST-CONFIRMED';

      showToast({
        title: 'Costing Saved Permanently',
        message: `Snapshot ${generatedCode} recorded successfully at PKR ${costPerBottle.toLocaleString()} / bottle.`,
        type: 'success',
      });

      // Reload history if on history tab
      loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery);
    } catch (err: any) {
      showToast({
        title: 'Error Saving Costing',
        message: err.message || 'Failed to save costing snapshot',
        type: 'error',
      });
    } finally {
      setIsSavingCosting(false);
    }
  };

  // ==========================================
  // 6. OPTIONAL: ADD TO FINISHED PRODUCT
  // ==========================================

  const handleOpenAddToProductModal = () => {
    if (!isStockSufficient) {
      showToast({
        title: 'Stock Insufficient',
        message: 'Cannot link cost while raw material stock is insufficient.',
        type: 'error',
      });
      return;
    }
    setNewProductName(`${selectedRawMaterial?.materialName || 'Product'} ${packSize}${packSizeUnit}`);
    setIsAddToProductModalOpen(true);
  };

  const handleSaveToFinishedProduct = async () => {
    setIsSavingProduct(true);
    try {
      const payload: any = {
        costingDate,
        sourcePoId: selectedPurchase?.documentId,
        sourcePoNumber: selectedPurchase?.documentNumber,
        purchaseDate: selectedPurchase?.purchaseDate,
        sourceVendorName: selectedPurchase?.vendorName,
        sourceVendorCode: selectedPurchase?.vendorCode,
        batchOutputQuantity: outputBottles,
        packSize,
        packSizeUnitName: packSizeUnit,
        totalRawMaterialCost: rawMaterialTotalCost,
        totalPackagingCost,
        totalBatchCost: totalProductionCost,
        costPerUnit: costPerBottle,
        notes: `Costing applied on ${costingDate}: PKR ${costPerBottle}/unit from ${selectedRawMaterial?.materialName}${selectedPurchase ? ` (PO: ${selectedPurchase.documentNumber})` : ''}`,
        rawMaterials: [
          {
            rawMaterialId: selectedRawMaterialId,
            quantity: requiredRawMaterial,
            unitCost: rawMaterialUnitCost,
            totalCost: rawMaterialTotalCost,
            uomName: rawMaterialUnitName,
          },
        ],
        packagingMaterials: packagingLines.map((l) => {
          const pm = packingMaterialsList.find((p) => p.id === l.packingMaterialId);
          return {
            packingMaterialId: l.packingMaterialId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            totalCost: l.totalCost,
            uomName: pm?.baseUom?.name || 'Nos',
          };
        }),
      };

      if (linkMode === 'existing') {
        if (!existingProductId) {
          showToast({ title: 'Validation Error', message: 'Please select an existing product.', type: 'error' });
          setIsSavingProduct(false);
          return;
        }
        payload.finishedProductId = existingProductId;
      } else {
        if (!newProductName.trim()) {
          showToast({ title: 'Validation Error', message: 'Please enter a product name.', type: 'error' });
          setIsSavingProduct(false);
          return;
        }
        payload.newProductName = newProductName.trim();
        payload.categoryId = newProductCategory || undefined;
        payload.baseSellingPrice = newProductSellingPrice;
        payload.packSizeQuantity = packSize;
        payload.packSizeUnit = packSizeUnit;
      }

      await ApiClient.post('/api/v1/costing/apply-to-product', payload);

      showToast({
        title: 'Finished Product Cost Updated',
        message: `Standard manufacturing cost of PKR ${costPerBottle.toLocaleString()} assigned to product.`,
        type: 'success',
      });

      setIsAddToProductModalOpen(false);
      loadCostingHistory(historyFilterStart, historyFilterEnd, historySearchQuery);
    } catch (err: any) {
      showToast({
        title: 'Failed to Update Product',
        message: err.message || 'Error updating product master',
        type: 'error',
      });
    } finally {
      setIsSavingProduct(false);
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
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Product Costing Engine
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Date-wise procurement cost tracking and permanent, immutable product costing calculations.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveTab('calculator')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
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
              <IconFlask size={14} /> Costing Calculator
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
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
              <IconFileText size={14} /> Product Costing History
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'history' ? (
        // ==========================================
        // COSTING HISTORY TAB
        // ==========================================
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <Card style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Calculations Recorded</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {costingHistory.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Immutable Historical Snapshots</div>
            </Card>

            <Card style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Production Costings</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                {costingHistory.filter((c) => c.status === 'ACTIVE').length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Currently Active Formulas</div>
            </Card>

            <Card style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Latest Costing Reference</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {costingHistory[0]?.costingCode || (costingHistory.length > 0 && costingHistory[0] ? `CST-${String(costingHistory[0].version || 1).padStart(6, '0')}` : 'None')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {costingHistory[0]?.costingDate ? new Date(costingHistory[0].costingDate).toLocaleDateString('en-GB') : 'N/A'}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <CardTitle>Date-Wise Product Costing History</CardTitle>
                
                {/* Filters */}
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

                  <div style={{ width: '200px' }}>
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
            <CardContent>
              {costingHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <IconFileText size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No costing records match the selected criteria</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>
                    Confirmed product costings will appear here permanently with their exact source purchase rates.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Costing Ref</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Costing Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Target Product</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Raw Material Used & Cost</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Source Purchase</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pack Size / Output</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Batch Cost</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#047857' }}>Cost Per Bottle</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costingHistory.map((item) => {
                        const rmLine = item.materialLines?.[0];
                        const code = item.costingCode || `CST-${String(item.version || 1).padStart(6, '0')}`;
                        const cDate = item.costingDate || item.createdAt;

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                              {code}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {new Date(cDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              {item.finishedProduct?.productName || (item.snapshotMetadata?.productName) || 'Batch Recipe'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                {item.rawMaterialName || rmLine?.rawMaterial?.materialName || 'Raw Material'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#047857', fontFamily: 'var(--font-mono)' }}>
                                @ PKR {Number(item.rawMaterialCostPerUnit || rmLine?.unitCost || 0).toLocaleString()} / {rmLine?.uomName || 'KG'}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                              {item.sourcePoNumber ? (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#0369a1' }}>PO: {item.sourcePoNumber}</span>
                                  {item.purchaseDate && (
                                    <span style={{ color: '#64748b', marginLeft: '4px' }}>
                                      ({new Date(item.purchaseDate).toLocaleDateString('en-GB')})
                                    </span>
                                  )}
                                  {item.vendorName && (
                                    <div style={{ color: '#475569' }}>Vendor: {item.vendorName}</div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Baseline / Manual</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {item.batchOutputQuantity} bottles × {item.packSize} {item.packSizeUnit || 'L'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              PKR {Number(item.totalBatchCost || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '13px' }}>
                              PKR {Number(item.costPerUnit || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: item.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                                  color: item.status === 'ACTIVE' ? '#047857' : '#64748b',
                                  border: `1px solid ${item.status === 'ACTIVE' ? '#a7f3d0' : '#cbd5e1'}`,
                                }}
                              >
                                {item.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedHistoryItem(item);
                                  setIsDetailModalOpen(true);
                                }}
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                <IconEye size={12} /> Breakdown
                              </Button>
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
        // COSTING CALCULATOR TAB
        // ==========================================
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Sections 1, 2, 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* SECTION 1: RAW MATERIAL & DATE-WISE PURCHASE HISTORY */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    1
                  </div>
                  <CardTitle>Raw Material Selection & Purchase Cost History</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Select Raw Material *
                  </label>
                  <Select
                    value={selectedRawMaterialId}
                    onChange={(e) => setSelectedRawMaterialId(e.target.value)}
                    options={[
                      { value: '', label: '-- Choose Raw Material from Catalog --' },
                      ...rawMaterialsList.map((rm) => ({
                        value: rm.id,
                        label: `${rm.materialCode} - ${rm.materialName}`,
                      })),
                    ]}
                  />
                </div>

                {selectedRawMaterial && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Active Selected Purchase Indicator */}
                    {selectedPurchase ? (
                      <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#065f46', fontWeight: 800, letterSpacing: '0.04em' }}>
                            ✓ Active Purchase Cost Selected
                          </div>
                          <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                            <strong>PO #{selectedPurchase.documentNumber}</strong> (Purchased on {new Date(selectedPurchase.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} from <strong>{selectedPurchase.vendorName}</strong>)
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#065f46' }}>Procurement Unit Cost:</div>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                            PKR {selectedPurchase.unitCost.toLocaleString()} / {selectedPurchase.unit}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '10px 14px', borderRadius: '8px', color: '#64748b', fontSize: '12px' }}>
                        ℹ Using Master Default Baseline rate (PKR {Number(defaultRawMaterialCost).toLocaleString()}/{rawMaterialUnitName}). Select a historical purchase below or enter a rate manually.
                      </div>
                    )}

                    {/* SUB-SECTION: DATE-WISE PURCHASE HISTORY TABLE */}
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                            📅 Purchase Cost History for {selectedRawMaterial.materialName}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                            ({purchaseHistory.length} transaction{purchaseHistory.length === 1 ? '' : 's'} found)
                          </span>
                        </div>

                        {/* Date Filter for Purchase History */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Date Range:</span>
                          <Input
                            type="date"
                            value={purchaseFilterStart}
                            onChange={(e) => setPurchaseFilterStart(e.target.value)}
                            style={{ padding: '2px 6px', fontSize: '11px', width: '120px' }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
                          <Input
                            type="date"
                            value={purchaseFilterEnd}
                            onChange={(e) => setPurchaseFilterEnd(e.target.value)}
                            style={{ padding: '2px 6px', fontSize: '11px', width: '120px' }}
                          />
                          {(purchaseFilterStart || purchaseFilterEnd) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPurchaseFilterStart('');
                                setPurchaseFilterEnd('');
                              }}
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>

                      {isLoadingPurchaseHistory ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                          Loading procurement history...
                        </div>
                      ) : purchaseHistory.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                            No Purchase Orders recorded for <strong>{selectedRawMaterial.materialName}</strong> in this date range.
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                            When you create POs on different dates, they will automatically appear here with their exact purchase rate.
                          </p>
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Purchase Date</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>PO #</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vendor</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Purchased Qty</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Amount</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#047857' }}>Unit Cost</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchaseHistory.map((item) => {
                                const isSelected = selectedPurchaseId === item.id;
                                return (
                                  <tr
                                    key={item.id}
                                    style={{
                                      borderBottom: '1px solid #e2e8f0',
                                      backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                                    }}
                                  >
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                      {new Date(item.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                                      {item.documentNumber}
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#334155' }}>
                                      {item.vendorName}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                      {item.numberOfPacks ? `${item.numberOfPacks} Packs (${item.quantity} ${item.unit})` : `${item.quantity} ${item.unit}`}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                      PKR {item.totalAmount.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                                      PKR {item.unitCost.toLocaleString()} / {item.unit}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                      {isSelected ? (
                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#059669', color: '#ffffff' }}>
                                          ✓ Active
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleSelectPurchase(item)}
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid #059669',
                                            backgroundColor: '#ffffff',
                                            color: '#059669',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Use This Cost
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Valuation / Pricing Mode Selector */}
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                        Cost Valuation Method & Custom Rate Override:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <label
                          onClick={() => setCostMode('PER_UNIT')}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: `2px solid ${costMode === 'PER_UNIT' ? '#059669' : '#cbd5e1'}`,
                            background: costMode === 'PER_UNIT' ? '#ecfdf5' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="costMode"
                            checked={costMode === 'PER_UNIT'}
                            onChange={() => setCostMode('PER_UNIT')}
                            style={{ marginTop: '2px', accentColor: '#059669' }}
                          />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                              Rate Per Unit (PKR / {rawMaterialUnitName})
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Standard calculation: Required Volume × Unit Rate.
                            </div>
                          </div>
                        </label>

                        <label
                          onClick={() => setCostMode('BATCH_TOTAL')}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: `2px solid ${costMode === 'BATCH_TOTAL' ? '#059669' : '#cbd5e1'}`,
                            background: costMode === 'BATCH_TOTAL' ? '#ecfdf5' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="costMode"
                            checked={costMode === 'BATCH_TOTAL'}
                            onChange={() => setCostMode('BATCH_TOTAL')}
                            style={{ marginTop: '2px', accentColor: '#059669' }}
                          />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                              Total Batch Raw Material Value (PKR)
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Flat bulk amount. Single unit RM = Total Amount ÷ Output Bottles.
                            </div>
                          </div>
                        </label>
                      </div>

                      {/* Cost Input Field */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            {costMode === 'PER_UNIT'
                              ? `Applied Rate Per ${rawMaterialUnitName} (PKR) *`
                              : 'Applied Total Batch RM Value (PKR) *'}
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step={costMode === 'BATCH_TOTAL' ? 1000 : 1}
                            value={customRawMaterialCost}
                            onChange={(e) => setCustomRawMaterialCost(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={costMode === 'PER_UNIT' ? 'e.g. 800' : 'e.g. 200000'}
                          />
                        </div>

                        <div style={{ fontSize: '11px', color: '#047857', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px' }}>
                          {costMode === 'PER_UNIT' ? (
                            <span>
                              <strong>Arithmetic:</strong> {requiredRawMaterial} {rawMaterialUnitName} × PKR {rawMaterialUnitCost.toLocaleString()} = <strong>PKR {rawMaterialTotalCost.toLocaleString()}</strong> total RM.
                            </span>
                          ) : (
                            <span>
                              <strong>Arithmetic:</strong> PKR {Number(rawMaterialTotalCost).toLocaleString()} total bulk ÷ {outputBottles} units = <strong>PKR {Math.round(rawMaterialCostPerBottle).toLocaleString()}</strong> RM per bottle.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'var(--bg-subtle)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Material Name
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {selectedRawMaterial.materialName}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                          Code: {selectedRawMaterial.materialCode}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Available Quantity
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                          {availableQuantity.toLocaleString()} {rawMaterialUnitName}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                          Stock on Hand
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {costMode === 'BATCH_TOTAL' ? 'Total Batch RM Cost' : `Rate per ${rawMaterialUnitName}`}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                          PKR {rawMaterialTotalCost.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                          {costMode === 'BATCH_TOTAL' ? 'Batch Flat Amount' : `Per ${rawMaterialUnitName}`}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          RM Cost Per Bottle
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                          PKR {Math.round(rawMaterialCostPerBottle).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                          Before packaging & ops
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 2: PRODUCTION OUTPUT & COSTING DATE */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    2
                  </div>
                  <CardTitle>Production Output & Costing Date</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Costing Calculation Date *
                    </label>
                    <Input
                      type="date"
                      value={costingDate}
                      onChange={(e) => setCostingDate(e.target.value)}
                    />
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      Permanent historical timestamp
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Commercial Pack Size *
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={packSize}
                        onChange={(e) => setPackSize(Number(e.target.value) || 0)}
                        style={{ flex: 1 }}
                      />
                      <div style={{ width: '100px' }}>
                        <Select
                          value={packSizeUnit}
                          onChange={(e) => setPackSizeUnit(e.target.value)}
                          options={[
                            { value: 'Liter', label: 'Liter' },
                            { value: 'ml', label: 'ml' },
                            { value: 'Kg', label: 'Kg' },
                            { value: 'Gram', label: 'Gram' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Number of Bottles / Units *
                    </label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={outputBottles}
                      onChange={(e) => handleOutputBottlesChange(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Arithmetic Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Bulk Volume:</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {packSize} {packSizeUnit} × {outputBottles} = <strong>{requiredRawMaterial} {packSizeUnit}</strong>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Required inventory volume
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Raw Material Cost:</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      PKR {rawMaterialTotalCost.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      {costMode === 'BATCH_TOTAL' ? 'Batch Flat Amount' : `${requiredRawMaterial} ${packSizeUnit} × PKR ${rawMaterialUnitCost.toLocaleString()}`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>RM Cost per Bottle:</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>
                      PKR {Math.round(rawMaterialCostPerBottle).toLocaleString()} / bottle
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Total RM ÷ {outputBottles} bottles
                    </div>
                  </div>
                </div>

                {/* Stock Availability Indicator */}
                {isStockSufficient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#065f46', fontSize: '12px', fontWeight: 600 }}>
                    <IconCheck size={16} />
                    <span>✓ Sufficient Raw Material in Stock (Required: {requiredRawMaterial} {rawMaterialUnitName} • Available: {availableQuantity} {rawMaterialUnitName})</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                    <IconAlertTriangle size={16} />
                    <span>✕ Insufficient Raw Material (Available: {availableQuantity} {rawMaterialUnitName} • Required: {requiredRawMaterial} {rawMaterialUnitName}) — Batch requirement exceeds available stock. Costing cannot proceed.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 3: PACKAGING MATERIALS */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                      3
                    </div>
                    <CardTitle>Packaging Materials</CardTitle>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleAddPackagingLine}>
                    <IconPlus size={14} /> Add Packaging Material
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {packagingLines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>No packaging materials added yet.</p>
                    <p style={{ fontSize: '11px', marginTop: '4px' }}>Click &quot;+ Add Packaging Material&quot; to include bottles, caps, labels, cartons, etc.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Packaging Material</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Quantity</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>Unit Cost (PKR)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>Total Cost</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagingLines.map((line) => {
                        return (
                          <tr key={line.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <Select
                                value={line.packingMaterialId}
                                onChange={(e) => handlePackagingMaterialChange(line.id, e.target.value)}
                                options={packingMaterialsList.map((pm) => ({
                                  value: pm.id,
                                  label: `${pm.materialName} (${pm.materialCode})`,
                                }))}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <Input
                                type="number"
                                min={0}
                                value={line.quantity}
                                onChange={(e) => handlePackagingQuantityChange(line.id, Number(e.target.value))}
                                style={{ width: '90px', margin: '0 auto', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              PKR {line.unitCost.toLocaleString()}
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Master rate</div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                              PKR {line.totalCost.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleRemovePackagingLine(line.id)}
                                title="Remove Material"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                              >
                                <IconTrash size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: '10px', textAlign: 'right' }}>
                          Total Packaging Cost:
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#047857', fontSize: '13px' }}>
                          PKR {totalPackagingCost.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Section 4 — Result Card */}
          <div style={{ position: 'sticky', top: '24px' }}>
            <Card style={{ border: '2px solid #059669', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.1)' }}>
              <div style={{ backgroundColor: '#059669', color: '#ffffff', padding: '14px 18px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, fontWeight: 700 }}>
                  Manufacturing Cost Summary
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>
                  PRODUCT COSTING
                </div>
              </div>

              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Costing Date:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {costingDate ? new Date(costingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Selected PO:</span>
                    <span style={{ fontWeight: 600, color: '#0284c7' }}>
                      {selectedPurchase ? selectedPurchase.documentNumber : 'Baseline Catalog'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Raw Material Cost:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      PKR {rawMaterialTotalCost.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Packaging Cost:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      PKR {totalPackagingCost.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                    <span>Total Batch Cost:</span>
                    <span style={{ color: '#0f172a' }}>
                      PKR {totalProductionCost.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    <span>Finished Units:</span>
                    <span style={{ fontWeight: 600 }}>{outputBottles}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    <span>Pack Size:</span>
                    <span style={{ fontWeight: 600 }}>{packSize} {packSizeUnit}</span>
                  </div>

                  {/* Prominent Cost Per Bottle Metric */}
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '16px', textAlign: 'center', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#065f46', fontWeight: 800, letterSpacing: '0.05em' }}>
                      COST PER BOTTLE
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#047857', margin: '4px 0' }}>
                      PKR {costPerBottle.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#065f46', opacity: 0.8 }}>
                      ({totalProductionCost.toLocaleString()} ÷ {outputBottles} bottles)
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <Button
                      variant="primary"
                      onClick={handleConfirmCosting}
                      disabled={!isStockSufficient || isSavingCosting || !selectedRawMaterialId}
                      isLoading={isSavingCosting}
                      style={{ width: '100%', justifyContent: 'center', backgroundColor: '#059669', borderColor: '#059669' }}
                    >
                      <IconCheck size={16} /> Confirm & Save Costing Permanently
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={handleOpenAddToProductModal}
                      disabled={!isStockSufficient}
                      style={{ width: '100%', justifyContent: 'center' }}
                      title="Optionally link this calculated cost to a Finished Product master record"
                    >
                      <IconPlus size={16} /> Optional: Add to Finished Product
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Detail Modal for Costing History Item */}
      {selectedHistoryItem && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Costing Snapshot: ${selectedHistoryItem.costingCode || `CST-${String(selectedHistoryItem.version || 1).padStart(6, '0')}`}`}
        >
          <div style={{ padding: '8px 0', fontSize: '13px' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <strong>Costing Date:</strong> {new Date(selectedHistoryItem.costingDate || selectedHistoryItem.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div>
                  <strong>Version:</strong> V{selectedHistoryItem.version || 1} ({selectedHistoryItem.status || 'ACTIVE'})
                </div>
                <div>
                  <strong>Finished Product:</strong> {selectedHistoryItem.finishedProduct?.productName || selectedHistoryItem.snapshotMetadata?.productName || 'Batch Recipe'}
                </div>
                <div>
                  <strong>Output Quantity:</strong> {selectedHistoryItem.batchOutputQuantity} bottles × {selectedHistoryItem.packSize} {selectedHistoryItem.packSizeUnit || 'L'}
                </div>
                <div>
                  <strong>Total Batch Cost:</strong> <span style={{ fontWeight: 700 }}>PKR {Number(selectedHistoryItem.totalBatchCost).toLocaleString()}</span>
                </div>
                <div>
                  <strong>Cost Per Bottle:</strong> <span style={{ color: '#047857', fontWeight: 800 }}>PKR {Number(selectedHistoryItem.costPerUnit).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Source Purchase Order Information */}
            {selectedHistoryItem.sourcePoNumber && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0369a1', fontWeight: 700 }}>
                  📦 Source Procurement Document
                </div>
                <div style={{ fontSize: '12.5px', color: '#0c4a6e', marginTop: '2px' }}>
                  Purchase Order: <strong>{selectedHistoryItem.sourcePoNumber}</strong>
                  {selectedHistoryItem.purchaseDate && ` · Purchased on: ${new Date(selectedHistoryItem.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  {selectedHistoryItem.vendorName && ` · Vendor: ${selectedHistoryItem.vendorName}`}
                </div>
              </div>
            )}

            {/* Raw Material Lines */}
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0' }}>Raw Material</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Material</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate (PKR)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {selectedHistoryItem.materialLines?.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '6px 8px' }}>{m.rawMaterial?.materialName} ({m.rawMaterial?.materialCode})</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.quantity} {m.uomName}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>PKR {Number(m.unitCost).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>PKR {Number(m.totalCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Packaging Lines */}
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0' }}>Packaging Materials</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Packaging Material</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate (PKR)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {selectedHistoryItem.packagingLines?.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '6px 8px' }}>{p.packingMaterial?.materialName}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.quantity}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>PKR {Number(p.unitCost).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>PKR {Number(p.totalCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#ecfdf5', borderRadius: '6px', fontWeight: 700, color: '#065f46' }}>
              <span>Total Batch Cost: PKR {Number(selectedHistoryItem.totalBatchCost).toLocaleString()}</span>
              <span>Final Cost Per Bottle: PKR {Number(selectedHistoryItem.costPerUnit).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Optional: Add to Finished Product Modal */}
      <Modal
        isOpen={isAddToProductModalOpen}
        onClose={() => setIsAddToProductModalOpen(false)}
        title="Optional: Assign Cost to Finished Product"
      >
        <div style={{ fontSize: '13px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Assign the calculated manufacturing cost (<strong>PKR {costPerBottle.toLocaleString()}</strong>) to a Finished Product.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setLinkMode('new')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                backgroundColor: linkMode === 'new' ? '#ecfdf5' : 'transparent',
                color: linkMode === 'new' ? '#047857' : 'var(--text-primary)',
                fontWeight: linkMode === 'new' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              + Create New Product
            </button>
            <button
              onClick={() => setLinkMode('existing')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                backgroundColor: linkMode === 'existing' ? '#ecfdf5' : 'transparent',
                color: linkMode === 'existing' ? '#047857' : 'var(--text-primary)',
                fontWeight: linkMode === 'existing' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              Update Existing Product
            </button>
          </div>

          {linkMode === 'new' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Finished Product Name *
                </label>
                <Input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Chlorpyrifos 40% EC Max 2L"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Commercial Selling Price (PKR)
                </label>
                <Input
                  type="number"
                  value={newProductSellingPrice}
                  onChange={(e) => setNewProductSellingPrice(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Category
                </label>
                <Select
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  options={[
                    { value: '', label: '-- Finished Goods (Default) --' },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Select Existing Finished Product *
              </label>
              <Select
                value={existingProductId}
                onChange={(e) => setExistingProductId(e.target.value)}
                options={[
                  { value: '', label: '-- Select Finished Product --' },
                  ...finishedProducts.map((fp) => ({
                    value: fp.id,
                    label: `${fp.productCode} - ${fp.productName} (Current Cost: PKR ${fp.standardCost || 'N/A'})`,
                  })),
                ]}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => setIsAddToProductModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveToFinishedProduct}
              isLoading={isSavingProduct}
            >
              Assign Cost (PKR {costPerBottle.toLocaleString()})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
