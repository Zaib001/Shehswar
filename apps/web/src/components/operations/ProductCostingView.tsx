'use client';

/**
 * SHEHSWAR ONE360 - Product Costing Engine
 *
 * One purpose only:
 * Calculate the actual cost of producing one finished unit/bottle
 * from a selected Raw Material and selected Packaging Materials.
 *
 * Rules:
 * 1. Raw Material cost is automatically fetched from real Procurement/Stock records.
 * 2. Packaging Material costs are automatically fetched from Packing Material Master.
 * 3. User enters: Raw Material, Pack Size, Number of Bottles, and selects Packaging Materials.
 * 4. Formula: (Raw Material Cost + Total Packaging Cost) ÷ Number of Bottles = Cost Per Bottle.
 * 5. Validates raw material stock availability before allowing confirmation.
 * 6. Product Creation and Product Costing remain completely separate.
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
  IconRefresh,
  IconCheck,
  IconTrash,
  IconFileText,
  IconEye,
  IconAlertTriangle,
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

interface PackagingLine {
  id: string;
  packingMaterialId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface CostingHistoryRecord {
  id: string;
  createdAt: string;
  packSize: number;
  packSizeUnit?: string;
  batchOutputQuantity: number;
  totalRawMaterialCost: number;
  totalPackagingCost: number;
  totalBatchCost: number;
  costPerUnit: number;
  notes?: string;
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
  const [costMode, setCostMode] = useState<'BATCH_TOTAL' | 'PER_UNIT'>('BATCH_TOTAL');
  const [customRawMaterialCost, setCustomRawMaterialCost] = useState<number | ''>('');

  // Section 2: Production Output
  const [packSize, setPackSize] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState<string>('Liter');
  const [outputBottles, setOutputBottles] = useState<number>(50);

  // Section 3: Packaging Materials
  const [packagingLines, setPackagingLines] = useState<PackagingLine[]>([]);

  // Section 4: History & Modals
  const [costingHistory, setCostingHistory] = useState<CostingHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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

  const loadCostingHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await ApiClient.get<any>('/api/v1/costing/history');
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setCostingHistory(list);
    } catch (err: any) {
      // Fallback
      console.warn('Costing history load error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadCostingHistory();
    }
  }, [activeTab, loadCostingHistory]);

  // ==========================================
  // 2. RAW MATERIAL RETRIEVAL & AVAILABILITY
  // ==========================================

  const selectedRawMaterial = useMemo(() => {
    return rawMaterialsList.find((rm) => rm.id === selectedRawMaterialId) || null;
  }, [rawMaterialsList, selectedRawMaterialId]);

  // Available Quantity: real stock on hand from inventory / goods receipts
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

  // Actual Unit Cost (PKR per base unit, e.g. per Liter or per KG)
  const defaultRawMaterialCost = useMemo(() => {
    if (!selectedRawMaterial) return 0;
    // Prefer costPerBaseUnit (per Liter or per KG) first!
    const cost = Number(
      selectedRawMaterial.costPerBaseUnit ??
      selectedRawMaterial.standardCost ??
      selectedRawMaterial.lastPurchaseCost ??
      selectedRawMaterial.unitRate ??
      0
    );
    return cost;
  }, [selectedRawMaterial]);

  useEffect(() => {
    if (selectedRawMaterial) {
      if (costMode === 'BATCH_TOTAL') {
        const batchVal = Number(
          selectedRawMaterial.totalPurchasedValue ||
          ((selectedRawMaterial as any).customFields?.totalPurchaseValue) ||
          selectedRawMaterial.standardCost ||
          0
        );
        setCustomRawMaterialCost(batchVal > 0 ? batchVal : defaultRawMaterialCost);
      } else {
        const val = defaultRawMaterialCost > 0 ? defaultRawMaterialCost : 0;
        setCustomRawMaterialCost(val);
      }
    }
  }, [selectedRawMaterialId, selectedRawMaterial, defaultRawMaterialCost, costMode]);

  const rawMaterialUnitCost = useMemo(() => {
    if (customRawMaterialCost !== '' && Number(customRawMaterialCost) >= 0) {
      return Number(customRawMaterialCost);
    }
    return defaultRawMaterialCost;
  }, [customRawMaterialCost, defaultRawMaterialCost]);

  const rawMaterialUnitName = useMemo(() => {
    return (
      selectedRawMaterial?.baseUom?.name ||
      selectedRawMaterial?.purchaseUom?.name ||
      packSizeUnit ||
      'Liter'
    );
  }, [selectedRawMaterial, packSizeUnit]);

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
    if (availableQuantity <= 0) return true; // Don't block calculation if stock hasn't been posted yet
    return availableQuantity >= requiredRawMaterial;
  }, [availableQuantity, requiredRawMaterial]);

  // Raw Material Batch Cost:
  // If BATCH_TOTAL mode: user entered or fetched the total RM value for the batch (e.g. 4,000,000 PKR).
  // If PER_UNIT mode: user entered rate per Liter/Kg, so total = requiredRawMaterial * rate.
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

  // Total Packaging Cost = Sum of all packaging lines
  const totalPackagingCost = useMemo(() => {
    return packagingLines.reduce((sum, line) => sum + (Number(line.totalCost) || 0), 0);
  }, [packagingLines]);

  // Total Production Cost = Raw Material Cost + Total Packaging Cost
  const totalProductionCost = useMemo(() => {
    return rawMaterialTotalCost + totalPackagingCost;
  }, [rawMaterialTotalCost, totalPackagingCost]);

  // MANDATORY FORMULA:
  // Cost Per Bottle = (Raw Material Cost + Total Packaging Cost) ÷ Number of Finished Units
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
    // Select first unused PM or default to first
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

  // Keep bottle/cap packaging quantities synced if user changes output bottles
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
  // 5. SAVE / CONFIRM COSTING (Requirement 19)
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
        notes: `Cost calculated for ${outputBottles} bottles (${packSize} ${packSizeUnit}) of ${selectedRawMaterial?.materialName}`,
      };

      await ApiClient.post('/api/v1/costing/save', payload);

      showToast({
        title: 'Cost Confirmed & Saved',
        message: `Official manufacturing cost of PKR ${costPerBottle.toLocaleString()} / bottle recorded in Costing History.`,
        type: 'success',
      });

      // Reload history if on history tab
      loadCostingHistory();
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
  // 6. OPTIONAL: ADD TO FINISHED PRODUCT (Req 21)
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
        batchOutputQuantity: outputBottles,
        packSize,
        packSizeUnitName: packSizeUnit,
        totalRawMaterialCost: rawMaterialTotalCost,
        totalPackagingCost,
        totalBatchCost: totalProductionCost,
        costPerUnit: costPerBottle,
        notes: `Costing applied: PKR ${costPerBottle}/unit from ${selectedRawMaterial?.materialName}`,
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
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Product Costing
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Calculate the actual cost of producing one finished unit/bottle from real Raw Material and Packaging procurement records.
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
              <IconFileText size={14} /> Costing History
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'history' ? (
        // ==========================================
        // COSTING HISTORY TAB
        // ==========================================
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Historical Costing Calculations</CardTitle>
              <Button size="sm" variant="secondary" onClick={loadCostingHistory} isLoading={isLoadingHistory}>
                <IconRefresh size={14} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {costingHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <IconFileText size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No costing records saved yet</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Use the Costing Calculator to calculate and confirm batch manufacturing costs.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Raw Material</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pack Size</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Output Units</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>RM Cost</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Packaging Cost</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Batch Cost</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#047857' }}>Cost Per Bottle</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costingHistory.map((item) => {
                      const rmLine = item.materialLines?.[0];
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            {rmLine?.rawMaterial?.materialName || 'Raw Material'}
                            {rmLine?.rawMaterial?.materialCode && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                                ({rmLine.rawMaterial.materialCode})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {item.packSize} {item.packSizeUnit || 'L'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                            {item.batchOutputQuantity}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            PKR {Number(item.totalRawMaterialCost || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            PKR {Number(item.totalPackagingCost || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            PKR {Number(item.totalBatchCost || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '13px' }}>
                            PKR {Number(item.costPerUnit || 0).toLocaleString()}
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
                              <IconEye size={12} /> View
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
      ) : (
        // ==========================================
        // COSTING CALCULATOR TAB (THE SIMPLE 4-SECTION FORM)
        // ==========================================
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Sections 1, 2, 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* SECTION 1: RAW MATERIAL */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    1
                  </div>
                  <CardTitle>Raw Material Selection</CardTitle>
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
                      { value: '', label: '-- Choose Raw Material from Procurement Master --' },
                      ...rawMaterialsList.map((rm) => ({
                        value: rm.id,
                        label: `${rm.materialCode} - ${rm.materialName}`,
                      })),
                    ]}
                  />
                </div>

                {selectedRawMaterial && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Procurement & Packaging Insight */}
                    <div style={{ background: '#f0f9ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>
                          📦 Procurement Master Data:
                        </span>
                        <span style={{ fontSize: '12.5px', color: '#0c4a6e' }}>
                          {selectedRawMaterial.bulkPacking || (selectedRawMaterial as any).customFields?.containerType ? `${(selectedRawMaterial as any).customFields?.packageCount ? `${(selectedRawMaterial as any).customFields.packageCount} × ` : ''}${(selectedRawMaterial as any).customFields?.containerType || selectedRawMaterial.bulkPacking} · ` : ''}
                          Total Volume: <strong>{Number(selectedRawMaterial.totalBulkVolume || (selectedRawMaterial as any).customFields?.totalPurchasedVolume || availableQuantity || 0).toLocaleString()} {rawMaterialUnitName}</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#0369a1' }}>
                          Base Rate: <strong style={{ color: '#047857', fontFamily: 'var(--font-mono)' }}>PKR {Number(defaultRawMaterialCost).toLocaleString()}/{rawMaterialUnitName}</strong>
                        </span>
                        {Number(selectedRawMaterial.totalPurchasedValue || (selectedRawMaterial as any).customFields?.totalPurchaseValue || 0) > 0 && (
                          <span style={{ fontSize: '12px', color: '#475569' }}>
                            Total Paid: <strong style={{ fontFamily: 'var(--font-mono)' }}>PKR {Number(selectedRawMaterial.totalPurchasedValue || (selectedRawMaterial as any).customFields?.totalPurchaseValue).toLocaleString()}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Valuation / Pricing Mode Selector */}
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                        Raw Material Cost Valuation Method:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                              Total invoice / consumed bulk amount (e.g. 4,000,000 PKR). Single bottle RM = Total Value ÷ Output Bottles.
                            </div>
                          </div>
                        </label>

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
                              Specific rate per Liter or Kg. Total RM = Required Volume × Rate.
                            </div>
                          </div>
                        </label>
                      </div>

                      {/* Cost Input Field */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            {costMode === 'BATCH_TOTAL'
                              ? 'Enter Total Batch RM Value (PKR) *'
                              : `Enter Rate Per ${rawMaterialUnitName} (PKR) *`}
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step={costMode === 'BATCH_TOTAL' ? 1000 : 1}
                            value={customRawMaterialCost}
                            onChange={(e) => setCustomRawMaterialCost(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={costMode === 'BATCH_TOTAL' ? 'e.g. 4000000' : 'e.g. 2000'}
                          />
                        </div>

                        <div style={{ fontSize: '11px', color: '#047857', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px' }}>
                          {costMode === 'BATCH_TOTAL' ? (
                            <span>
                              <strong>Arithmetic:</strong> PKR {Number(rawMaterialTotalCost).toLocaleString()} total bulk ÷ {outputBottles} units = <strong>PKR {Math.round(rawMaterialCostPerBottle).toLocaleString()}</strong> RM per bottle.
                            </span>
                          ) : (
                            <span>
                              <strong>Arithmetic:</strong> {requiredRawMaterial} {rawMaterialUnitName} × PKR {rawMaterialUnitCost.toLocaleString()} = <strong>PKR {rawMaterialTotalCost.toLocaleString()}</strong> total RM.
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

            {/* SECTION 2: PRODUCTION OUTPUT & AVAILABILITY CHECK */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    2
                  </div>
                  <CardTitle>Production Output Parameters</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
                      <div style={{ width: '110px' }}>
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

                {/* Stock Availability Indicator (Requirement 6) */}
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
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Auto-fetched</div>
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

          {/* Right Column: Section 4 — Result Card (Requirement 14) */}
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

                  {/* Prominent Cost Per Bottle Metric (Requirement 14) */}
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
                      <IconCheck size={16} /> Confirm & Save Costing
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
          title={`Costing Record Details`}
        >
          <div style={{ padding: '8px 0', fontSize: '13px' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div><strong>Date:</strong> {new Date(selectedHistoryItem.createdAt).toLocaleString()}</div>
                <div><strong>Pack Size:</strong> {selectedHistoryItem.packSize} {selectedHistoryItem.packSizeUnit || 'L'}</div>
                <div><strong>Finished Quantity:</strong> {selectedHistoryItem.batchOutputQuantity} bottles</div>
                <div><strong>Cost Per Bottle:</strong> <span style={{ color: '#047857', fontWeight: 800 }}>PKR {Number(selectedHistoryItem.costPerUnit).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Raw Material Line */}
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0' }}>Raw Material</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Material</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
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
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#ecfdf5', borderRadius: '6px', fontWeight: 700, color: '#065f46' }}>
              <span>Total Batch Cost: PKR {Number(selectedHistoryItem.totalBatchCost).toLocaleString()}</span>
              <span>Cost Per Bottle: PKR {Number(selectedHistoryItem.costPerUnit).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Optional: Add to Finished Product Modal (Requirement 21) */}
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
