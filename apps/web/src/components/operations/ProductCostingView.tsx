'use client';

/**
 * SHEHSWAR ONE360 - Product Costing Engine
 *
 * Designed according to the Supreme Accounting Filling/Costing Voucher standard:
 *
 * Core Concept:
 *   Product → Material Components → Pack → Quantity → Rate → Cost → Total Cost → Unit Cost
 *
 * Key Principles:
 * 1. Product Creation and Costing are completely separate.
 *    Finished Products are selected from the Product Master.
 * 2. Ultra-simple, high-density professional entry voucher layout.
 * 3. Unified single table for RM, PM, and Other/Labour components.
 * 4. Auto-calculation: Cost = Quantity * Rate.
 * 5. Auto-fetch: Selecting materials auto-populates Pack and Rate from real Purchase Orders.
 * 6. Bottom Summary: Total Cost, Actual Quantity, Unit Cost = Total Cost / Actual Quantity.
 * 7. Permanent Costing History with double-click voucher review modal.
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

export type ComponentType = 'RM' | 'PM' | 'Other';

export interface HistoricalPurchase {
  documentNumber: string;
  purchaseDate: string;
  unitCost: number;
  vendorName: string;
  quantity: number;
  unit: string;
}

export interface CostingLineItem {
  id: string;
  materialId?: string;
  materialName: string;
  materialCode?: string;
  type: ComponentType;
  pack: string;
  quantity: number;
  rate: number;
  cost: number;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  vendorName?: string;
  historicalPurchases?: HistoricalPurchase[];
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

export interface MasterMaterial {
  id: string;
  materialCode: string;
  materialName: string;
  type: 'RM' | 'PM';
  standardCost?: number;
  lastPurchaseCost?: number;
  baseUom?: { name: string; symbol?: string; code?: string };
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
  finishedProduct?: {
    id: string;
    productCode: string;
    productName: string;
  };
  snapshot?: {
    costingCode?: string;
    serialNumber?: string;
    costingDate?: string;
    warehouseName?: string;
    contractorVendorName?: string;
    productName?: string;
    productCode?: string;
    actualQuantity?: number;
    estimatedQuantity?: number;
    lines?: CostingLineItem[];
    totalBatchCost?: number;
    costPerUnit?: number;
  };
}

export function ProductCostingView() {
  const { showToast } = useToast();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'voucher' | 'history'>('voucher');

  // Master Data
  const [warehouses, setWarehouses] = useState<MasterWarehouse[]>([]);
  const [vendors, setVendors] = useState<MasterVendor[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<MasterFinishedProduct[]>([]);
  const [rawMaterials, setRawMaterials] = useState<MasterMaterial[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<MasterMaterial[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState<boolean>(true);

  // Voucher Header State
  const [serialNumber, setSerialNumber] = useState<string>('CST-000001');
  const [costingDate, setCostingDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '2026-11-11');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [selectedFinishedProductId, setSelectedFinishedProductId] = useState<string>('');
  const [packSize, setPackSize] = useState<string>('1 Liter');
  const [estimatedQuantity, setEstimatedQuantity] = useState<number>(1000);
  const [actualQuantity, setActualQuantity] = useState<number>(1003);

  // Voucher Lines State (Single Unified Table)
  const [lines, setLines] = useState<CostingLineItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApplyingCost, setIsApplyingCost] = useState<boolean>(false);

  // Costing History State
  const [historyRecords, setHistoryRecords] = useState<SavedCostingRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [selectedHistoryModalRecord, setSelectedHistoryModalRecord] = useState<SavedCostingRecord | null>(null);

  // ==========================================
  // 1. DATA INITIALIZATION
  // ==========================================

  const loadMasterData = useCallback(async () => {
    setIsLoadingMasterData(true);
    try {
      const [whRes, venRes, fpRes, rmRes, pmRes, nextCodeRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/raw-materials?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/next-code?entityType=COSTING').catch(() => ({ data: { code: 'CST-000001' } })),
      ]);

      const normalizeList = (res: any) => {
        if (!res) return [];
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res)) return res;
        return [];
      };

      const whList: MasterWarehouse[] = normalizeList(whRes);
      const venList: MasterVendor[] = normalizeList(venRes);
      const fpList: MasterFinishedProduct[] = normalizeList(fpRes);
      const rmListRaw = normalizeList(rmRes);
      const pmListRaw = normalizeList(pmRes);

      const rmList: MasterMaterial[] = rmListRaw.map((r: any) => ({
        id: r.id,
        materialCode: r.materialCode || '',
        materialName: r.materialName || '',
        type: 'RM',
        standardCost: Number(r.standardCost || r.lastPurchaseCost || 0),
        lastPurchaseCost: Number(r.lastPurchaseCost || r.standardCost || 0),
        baseUom: r.baseUom,
      }));

      const pmList: MasterMaterial[] = pmListRaw.map((p: any) => ({
        id: p.id,
        materialCode: p.materialCode || '',
        materialName: p.materialName || '',
        type: 'PM',
        standardCost: Number(p.standardCost || p.lastPurchaseCost || 0),
        lastPurchaseCost: Number(p.lastPurchaseCost || p.standardCost || 0),
        baseUom: p.baseUom,
      }));

      setWarehouses(whList);
      setVendors(venList);
      setFinishedProducts(fpList);
      setRawMaterials(rmList);
      setPackingMaterials(pmList);

      if (nextCodeRes?.data?.code) {
        setSerialNumber(nextCodeRes.data.code);
      }

      // Default Warehouse
      if (whList.length > 0) {
        const preferredWh = whList.find((w) => w.name.toLowerCase().includes('faisalabad')) || whList[0];
        if (preferredWh) setSelectedWarehouseId(preferredWh.id);
      }

      // Default Contractor / Vendor
      if (venList.length > 0) {
        const preferredVen = venList.find((v) => v.name.toLowerCase().includes('v agrics')) || venList[0];
        if (preferredVen) setSelectedContractorId(preferredVen.id);
      }

      // Default Finished Product
      if (fpList.length > 0) {
        const preferredFp = fpList.find((f) => f.productName.toLowerCase().includes('lambda')) || fpList[0];
        if (preferredFp) {
          setSelectedFinishedProductId(preferredFp.id);
          const pSize = preferredFp.packingQuantity
            ? `${preferredFp.packingQuantity} ${preferredFp.packingUnit || 'Liter'}`
            : '1 Liter';
          setPackSize(pSize);
        }
      }

      // Preload the Supreme Accounting reference voucher by default if lines are empty
      loadSampleVoucher(rmList, pmList);
    } catch (err: any) {
      console.error('Failed to load master data:', err);
      showToast({
        title: 'Notice',
        message: 'Loaded with available local configurations.',
        type: 'info',
      });
    } finally {
      setIsLoadingMasterData(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // When user selects a Finished Product, auto-update pack size
  const handleFinishedProductChange = (productId: string) => {
    setSelectedFinishedProductId(productId);
    const chosen = finishedProducts.find((p) => p.id === productId);
    if (chosen) {
      const pSize = chosen.packingQuantity
        ? `${chosen.packingQuantity} ${chosen.packingUnit || 'Liter'}`
        : '1 Liter';
      setPackSize(pSize);
    }
  };

  // ==========================================
  // 2. UNIFIED MATERIAL LOOKUP COMBINED LIST
  // ==========================================

  const allMaterialsOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; code: string; type: ComponentType; defaultRate: number; defaultPack: string }> = [];

    rawMaterials.forEach((rm) => {
      list.push({
        id: rm.id,
        name: rm.materialName,
        code: rm.materialCode,
        type: 'RM',
        defaultRate: rm.lastPurchaseCost || rm.standardCost || 92000,
        defaultPack: '200 LTR',
      });
    });

    packingMaterials.forEach((pm) => {
      list.push({
        id: pm.id,
        name: pm.materialName,
        code: pm.materialCode,
        type: 'PM',
        defaultRate: pm.lastPurchaseCost || pm.standardCost || 10,
        defaultPack: '1 Nos',
      });
    });

    return list;
  }, [rawMaterials, packingMaterials]);

  // ==========================================
  // 3. SAMPLE REFERENCE VOUCHER (Supreme Accounting Reference)
  // ==========================================

  const loadSampleVoucher = (rms = rawMaterials, pms = packingMaterials) => {
    const findRm = (kw: string) => rms.find((r) => r.materialName.toLowerCase().includes(kw.toLowerCase()));
    const findPm = (kw: string) => pms.find((p) => p.materialName.toLowerCase().includes(kw.toLowerCase()));

    const rmLambda = findRm('Lambda') || findRm('Chlorpyrifos') || rms[0];
    const pmLabel = findPm('Label') || pms.find((p) => p.materialCode === 'PM-000231');
    const pmBottle = findPm('Bottle') || pms.find((p) => p.materialCode === 'PM-000232');
    const pmCarton = findPm('Carton') || pms.find((p) => p.materialCode === 'PM-000233');
    const pmCaps = findPm('Cap') || pms.find((p) => p.materialCode === 'PM-000234');
    const pmLabour = findPm('Labour') || pms.find((p) => p.materialCode === 'PM-000235');

    const sampleLines: CostingLineItem[] = [
      {
        id: 'line-1',
        materialId: rmLambda?.id,
        materialName: rmLambda?.materialName || 'RA Lambda Cyhalothrin 2.5 % EC',
        materialCode: rmLambda?.materialCode || 'RM-000230',
        type: 'RM',
        pack: '200 LTR',
        quantity: 5,
        rate: 92000,
        cost: 460000,
      },
      {
        id: 'line-2',
        materialId: pmLabel?.id,
        materialName: pmLabel?.materialName || 'PM Labels Lambda Cyhalothrin',
        materialCode: pmLabel?.materialCode || 'PM-000231',
        type: 'PM',
        pack: '1 Nos',
        quantity: 1003,
        rate: 7,
        cost: 7021,
      },
      {
        id: 'line-3',
        materialId: pmBottle?.id,
        materialName: pmBottle?.materialName || 'PM Pet Bottle 1 Liter',
        materialCode: pmBottle?.materialCode || 'PM-000232',
        type: 'PM',
        pack: '1 Nos',
        quantity: 1003,
        rate: 42,
        cost: 42126,
      },
      {
        id: 'line-4',
        materialId: pmCarton?.id,
        materialName: pmCarton?.materialName || 'PM Carton 1 x 12 (Bromoxnal 1Ltr)',
        materialCode: pmCarton?.materialCode || 'PM-000233',
        type: 'PM',
        pack: '1 Nos',
        quantity: 84,
        rate: 104,
        cost: 8736,
      },
      {
        id: 'line-5',
        materialId: pmLabour?.id,
        materialName: pmLabour?.materialName || 'PM Packing Labour',
        materialCode: pmLabour?.materialCode || 'PM-000235',
        type: 'PM',
        pack: '1 Nos',
        quantity: 1003,
        rate: 7,
        cost: 7021,
      },
      {
        id: 'line-6',
        materialId: pmCaps?.id,
        materialName: pmCaps?.materialName || 'PM Caps',
        materialCode: pmCaps?.materialCode || 'PM-000234',
        type: 'PM',
        pack: '1 Nos',
        quantity: 1003,
        rate: 8,
        cost: 8024,
      },
    ];

    setLines(sampleLines);
    setEstimatedQuantity(1000);
    setActualQuantity(1003);
  };

  // ==========================================
  // 4. DYNAMIC ROW ACTIONS & PURCHASE RATE FETCH
  // ==========================================

  const handleAddRow = () => {
    const newLine: CostingLineItem = {
      id: `line-${Date.now()}`,
      materialName: '',
      type: 'PM',
      pack: '1 Nos',
      quantity: 1,
      rate: 0,
      cost: 0,
    };
    setLines((prev) => [...prev, newLine]);
  };

  const handleRemoveRow = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleMaterialSelected = async (lineId: string, materialName: string) => {
    const matched = allMaterialsOptions.find(
      (m) => m.name.toLowerCase() === materialName.toLowerCase() || m.code.toLowerCase() === materialName.toLowerCase()
    );

    let defaultType: ComponentType = 'Other';
    let defaultPack = '1 Nos';
    let defaultRate = 0;
    let materialId = undefined;
    let materialCode = undefined;

    if (matched) {
      defaultType = matched.type;
      defaultPack = matched.defaultPack;
      defaultRate = matched.defaultRate;
      materialId = matched.id;
      materialCode = matched.code;
    } else if (materialName.toLowerCase().includes('labour') || materialName.toLowerCase().includes('labor')) {
      defaultType = 'Other';
      defaultPack = '1 Nos';
      defaultRate = 7;
    }

    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const qty = line.quantity || actualQuantity || 1;
        const newCost = Math.round(qty * defaultRate * 100) / 100;
        return {
          ...line,
          materialId,
          materialCode,
          materialName,
          type: defaultType,
          pack: defaultPack,
          rate: defaultRate,
          quantity: qty,
          cost: newCost,
        };
      })
    );

    // If real material ID exists, fetch real purchase orders in background
    if (materialId) {
      try {
        const res = await ApiClient.get<any>(`/api/v1/costing/materials/${materialId}/purchase-history`);
        const purchases = Array.isArray(res.data) ? res.data : [];
        if (purchases.length > 0) {
          const latest = purchases[0];
          setLines((prev) =>
            prev.map((line) => {
              if (line.id !== lineId) return line;
              const rate = Number(latest.unitCost || line.rate);
              return {
                ...line,
                rate,
                cost: Math.round(line.quantity * rate * 100) / 100,
                sourcePoId: latest.documentId,
                sourcePoNumber: latest.documentNumber,
                purchaseDate: latest.purchaseDate,
                vendorName: latest.vendorName,
                historicalPurchases: purchases,
              };
            })
          );
        }
      } catch (err) {
        console.warn('Could not fetch historical POs for material:', materialId);
      }
    }
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

  // Switch historical PO rate for a line
  const handleSelectHistoricalPo = (lineId: string, purchase: HistoricalPurchase) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const rate = Number(purchase.unitCost);
        return {
          ...line,
          rate,
          cost: Math.round(line.quantity * rate * 100) / 100,
          sourcePoNumber: purchase.documentNumber,
          purchaseDate: purchase.purchaseDate,
          vendorName: purchase.vendorName,
        };
      })
    );
    showToast({
      title: 'PO Rate Applied',
      message: `Applied ${purchase.documentNumber} rate of PKR ${Number(purchase.unitCost).toLocaleString()}`,
      type: 'success',
    });
  };

  // ==========================================
  // 5. TOTALS & ARITHMETIC CALCULATION
  // ==========================================

  const totalCost = useMemo(() => {
    return lines.reduce((acc, line) => acc + (Number(line.cost) || 0), 0);
  }, [lines]);

  const unitCost = useMemo(() => {
    if (!actualQuantity || actualQuantity <= 0) return 0;
    return Math.round((totalCost / actualQuantity) * 100) / 100;
  }, [totalCost, actualQuantity]);

  // Breakdown for backend audit snapshot
  const rawMaterialTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'RM').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const packagingTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'PM').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const otherTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'Other').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  // ==========================================
  // 6. SAVE COSTING VOUCHER (POST /api/v1/costing/save)
  // ==========================================

  const handleSaveCosting = async () => {
    if (lines.length === 0) {
      showToast({ title: 'Error', message: 'Please add at least one material line.', type: 'error' });
      return;
    }
    if (!actualQuantity || actualQuantity <= 0) {
      showToast({ title: 'Error', message: 'Please enter valid actual production quantity.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const selectedVen = vendors.find((v) => v.id === selectedContractorId);
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);

      const parsedPackSize = parseFloat(packSize) || 1;

      // Extract RM and PM lines for relational DB storage
      const rmLines = lines
        .filter((l) => l.type === 'RM' && l.materialId)
        .map((l) => ({
          rawMaterialId: l.materialId!,
          rawMaterialName: l.materialName,
          rawMaterialCode: l.materialCode,
          quantity: l.quantity,
          unitCost: l.rate,
          totalCost: l.cost,
          uomName: l.pack,
          sourcePoNumber: l.sourcePoNumber,
          purchaseDate: l.purchaseDate,
        }));

      const pmLines = lines
        .filter((l) => l.type === 'PM' && l.materialId)
        .map((l) => ({
          packingMaterialId: l.materialId!,
          quantity: l.quantity,
          unitCost: l.rate,
          totalCost: l.cost,
          uomName: l.pack,
          sourcePoNumber: l.sourcePoNumber,
          purchaseDate: l.purchaseDate,
        }));

      const primaryRm = rmLines[0];

      const payload = {
        serialNumber,
        costingDate,
        warehouseId: selectedWarehouseId,
        warehouseName: selectedWh?.name || 'Warehouse',
        contractorVendorId: selectedContractorId,
        contractorVendorName: selectedVen?.name || 'Contractor',
        finishedProductId: selectedFinishedProductId || undefined,
        finishedProductName: selectedFp?.productName,
        finishedProductCode: selectedFp?.productCode,
        packSize: parsedPackSize,
        packSizeUnit: packSize.includes('Liter') ? 'Liter' : packSize.includes('KG') ? 'KG' : 'Unit',
        estimatedQuantity,
        actualQuantity,
        finishedQuantity: actualQuantity,
        lines, // Full unified table preserved in snapshot
        rawMaterialId: primaryRm?.rawMaterialId,
        rawMaterials: rmLines,
        packagingMaterials: pmLines,
        otherCost: otherTotal,
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        totalBatchCost: totalCost,
        costPerUnit: unitCost,
        notes: `Filling Entry Voucher ${serialNumber} - ${lines.length} lines costed.`,
      };

      const res = await ApiClient.post<any>('/api/v1/costing/save', payload);

      const savedCode = res.data?.costingCode || serialNumber;
      showToast({
        title: 'Costing Saved Permanently',
        message: `Voucher ${savedCode} saved with Unit Cost PKR ${unitCost.toLocaleString()}`,
        type: 'success',
      });

      // Refresh next code
      const nextRes = await ApiClient.get<any>('/api/v1/master-data/next-code?entityType=COSTING').catch(() => null);
      if (nextRes?.data?.code) setSerialNumber(nextRes.data.code);
    } catch (err: any) {
      console.error('Save failed:', err);
      showToast({
        title: 'Save Failed',
        message: err.message || 'Could not save costing voucher.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // 7. ADD TO PRODUCT (UPDATE STANDARD COST)
  // ==========================================

  const handleApplyCostToProduct = async () => {
    if (!selectedFinishedProductId) {
      showToast({ title: 'Error', message: 'Please select an End Product first.', type: 'error' });
      return;
    }
    if (!unitCost || unitCost <= 0) {
      showToast({ title: 'Error', message: 'Calculated Unit Cost must be greater than zero.', type: 'error' });
      return;
    }

    setIsApplyingCost(true);
    try {
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);
      const parsedPackSize = parseFloat(packSize) || 1;

      const payload = {
        finishedProductId: selectedFinishedProductId,
        batchOutputQuantity: actualQuantity,
        packSize: parsedPackSize,
        packSizeUnitName: packSize.includes('Liter') ? 'Liter' : packSize.includes('KG') ? 'KG' : 'Unit',
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        totalBatchCost: totalCost,
        costPerUnit: unitCost,
        notes: `Standard cost updated to PKR ${unitCost.toLocaleString()} from Costing Voucher ${serialNumber}`,
      };

      await ApiClient.post('/api/v1/costing/apply-to-product', payload);

      showToast({
        title: 'Product Cost Updated',
        message: `Standard cost of ${selectedFp?.productName || 'Product'} set to PKR ${unitCost.toLocaleString()}`,
        type: 'success',
      });

      // Update local master item
      setFinishedProducts((prev) =>
        prev.map((p) => (p.id === selectedFinishedProductId ? { ...p, standardCost: unitCost } : p))
      );
    } catch (err: any) {
      console.error('Failed to apply cost:', err);
      showToast({
        title: 'Update Failed',
        message: err.message || 'Could not update product standard cost.',
        type: 'error',
      });
    } finally {
      setIsApplyingCost(false);
    }
  };

  // ==========================================
  // 8. LOAD HISTORY TAB
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

  // Open modal for historical record
  const handleOpenVoucherModal = (rec: SavedCostingRecord) => {
    setSelectedHistoryModalRecord(rec);
  };

  // ==========================================
  // 9. RENDER UI
  // ==========================================

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* SECTION TABS */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
            <IconFlask className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              Product Costing Engine
              {isLoadingMasterData && (
                <span className="ml-2 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded animate-pulse font-normal">
                  Loading...
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500">Simple component-based manufacturing & packaging cost entry</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('voucher')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'voucher'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Costing Voucher
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Costing History
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* TAB 1: MAIN COSTING VOUCHER (SUPREME ACCOUNTING STYLE)                   */}
      {/* ======================================================================= */}
      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {/* COMPACT TOP HEADER */}
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                {/* 1. Serial No */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Serial No.</label>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-2 py-1.5 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-bold">
                      A
                    </span>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full text-xs font-semibold text-emerald-800 bg-emerald-50/40 border border-gray-300 rounded-r-md px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
                      placeholder="CST-000001"
                    />
                  </div>
                </div>

                {/* 2. Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={costingDate}
                    onChange={(e) => setCostingDate(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 3. Warehouse */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Warehouse</label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name}
                      </option>
                    ))}
                    {warehouses.length === 0 && <option value="">01 - Faisalabad Warehouse</option>}
                  </select>
                </div>

                {/* 4. Contractor / Vendor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Contractor / Vendor</label>
                  <select
                    value={selectedContractorId}
                    onChange={(e) => setSelectedContractorId(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                    {vendors.length === 0 && <option value="">V Agrics International (Pvt) Ltd.</option>}
                  </select>
                </div>

                {/* 5. Status / Actions */}
                <div className="flex items-center justify-between md:justify-end space-x-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse"></span>
                    ACTIVE / READY
                  </span>
                  <button
                    type="button"
                    onClick={() => loadSampleVoucher()}
                    className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                    title="Load standard Lambda 2.5% EC 1L test voucher"
                  >
                    Reference Sample
                  </button>
                </div>
              </div>

              {/* End Product Bar */}
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <div className="md:col-span-3 flex items-center space-x-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">End Product:</label>
                  <div className="flex-1">
                    <SearchableCombobox
                      label=""
                      options={finishedProducts.map((p) => ({
                        id: p.id,
                        label: `${p.productCode} - ${p.productName} (${p.packingQuantity || 1} ${p.packingUnit || 'Liter'})`,
                        value: p.id,
                      }))}
                      value={selectedFinishedProductId}
                      onChange={handleFinishedProductChange}
                      placeholder="Search and select End Product from Product Master..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 uppercase font-semibold">Pack Size:</span>
                    <span className="ml-1.5 text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      {packSize}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MAIN COSTING TABLE (SINGLE TABLE FOR ALL COMPONENTS) */}
          <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-900 text-white font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">N</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Product / Material</th>
                    <th className="py-2.5 px-2 w-20 text-center">Type</th>
                    <th className="py-2.5 px-3 w-28 text-center">Pack</th>
                    <th className="py-2.5 px-3 w-28 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-32 text-right">Rate (PKR)</th>
                    <th className="py-2.5 px-4 w-36 text-right">Cost (PKR)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={idx % 2 === 0 ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'bg-white hover:bg-emerald-50/30'}
                    >
                      {/* N (Row number) */}
                      <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* Product / Material Searchable Input */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col space-y-1">
                          <input
                            type="text"
                            value={line.materialName}
                            onChange={(e) => handleLineChange(line.id, 'materialName', e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== line.materialName) {
                                handleMaterialSelected(line.id, e.target.value);
                              }
                            }}
                            list={`materials-list-${line.id}`}
                            className="w-full text-xs font-semibold text-gray-900 bg-transparent border border-gray-200 rounded px-2 py-1 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                            placeholder="Type or select material component..."
                          />
                          <datalist id={`materials-list-${line.id}`}>
                            {allMaterialsOptions.map((opt) => (
                              <option key={opt.id} value={opt.name}>
                                [{opt.type}] {opt.code} - {opt.name}
                              </option>
                            ))}
                          </datalist>

                          {/* Subtle PO History Rate Switcher if available */}
                          {line.historicalPurchases && line.historicalPurchases.length > 1 && (
                            <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
                              <span>PO History:</span>
                              <select
                                onChange={(e) => {
                                  const po = line.historicalPurchases?.find((p) => p.documentNumber === e.target.value);
                                  if (po) handleSelectHistoricalPo(line.id, po);
                                }}
                                className="text-[10px] py-0 px-1 border border-gray-200 rounded bg-white text-emerald-800 font-semibold"
                                value={line.sourcePoNumber || ''}
                              >
                                {line.historicalPurchases.map((p) => (
                                  <option key={p.documentNumber} value={p.documentNumber}>
                                    {p.documentNumber} ({p.purchaseDate ? p.purchaseDate.split('T')[0] : ''} @ PKR{' '}
                                    {Number(p.unitCost).toLocaleString()})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Type (RM / PM / Other) */}
                      <td className="py-2 px-2 text-center">
                        <select
                          value={line.type}
                          onChange={(e) => handleLineChange(line.id, 'type', e.target.value as ComponentType)}
                          className={`text-[11px] font-bold rounded px-1.5 py-1 border text-center ${
                            line.type === 'RM'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : line.type === 'PM'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-purple-100 text-purple-800 border-purple-300'
                          }`}
                        >
                          <option value="RM">RM</option>
                          <option value="PM">PM</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>

                      {/* Pack */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="text"
                          value={line.pack}
                          onChange={(e) => handleLineChange(line.id, 'pack', e.target.value)}
                          className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          placeholder="200 LTR"
                        />
                      </td>

                      {/* Qty */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-xs font-mono font-semibold border border-gray-200 rounded px-2 py-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Rate */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.rate}
                          onChange={(e) => handleLineChange(line.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-xs font-mono border border-gray-200 rounded px-2 py-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Cost (Quantity * Rate) */}
                      <td className="py-2 px-4 text-right font-mono font-bold text-gray-900 text-xs">
                        {Number(line.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(line.id)}
                          className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                          title="Remove row"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400 text-xs">
                        No materials added yet. Click &quot;+ Add Material&quot; or &quot;Reference Sample&quot; to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Add Line Button */}
            <div className="p-3 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <IconPlus className="w-3.5 h-3.5 mr-1" />
                Add Material
              </Button>

              <span className="text-[11px] text-gray-500">
                Formula: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">Cost = Quantity × Rate</code>
              </span>
            </div>
          </Card>

          {/* BOTTOM SUMMARY & ACTIONS (MATCHING SCREENSHOT BOTTOM BAR) */}
          <Card className="border border-emerald-200 shadow-md bg-emerald-50/40">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                {/* 1. Est. Qty (Optional Informational) */}
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Est. Qty:</label>
                  <input
                    type="number"
                    value={estimatedQuantity}
                    onChange={(e) => setEstimatedQuantity(parseFloat(e.target.value) || 0)}
                    className="w-28 text-xs font-mono font-semibold border border-gray-300 rounded px-2 py-1 bg-white text-right"
                  />
                </div>

                {/* 2. Actual Production Qty */}
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-bold text-gray-800 whitespace-nowrap">Actual Qty:</label>
                  <input
                    type="number"
                    value={actualQuantity}
                    onChange={(e) => setActualQuantity(parseFloat(e.target.value) || 0)}
                    className="w-28 text-xs font-mono font-bold border-2 border-emerald-500 rounded px-2 py-1 bg-white text-right text-emerald-900 shadow-sm"
                  />
                  <span className="text-xs text-gray-500 font-medium">units</span>
                </div>

                {/* 3. Total Cost */}
                <div className="text-right">
                  <span className="block text-[11px] font-semibold text-gray-500 uppercase">Total Batch Cost</span>
                  <span className="text-lg font-bold font-mono text-gray-900">
                    PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 4. Unit Cost */}
                <div className="text-right bg-white p-2.5 rounded-lg border border-emerald-300 shadow-sm">
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Unit Cost</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-800">
                    PKR {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[10px] text-gray-400">Total Cost ÷ Actual Qty</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLines([]);
                    showToast({ title: 'Voucher Cleared', message: 'Ready for new entry.', type: 'info' });
                  }}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Clear Table
                </Button>

                <div className="flex items-center space-x-3">
                  <Button
                    variant="primary"
                    onClick={handleSaveCosting}
                    isLoading={isSaving}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-5 py-2 font-bold shadow-sm"
                  >
                    <IconCheck className="w-4 h-4 mr-1.5" />
                    Save Costing Voucher
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleApplyCostToProduct}
                    isLoading={isApplyingCost}
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-100 text-xs px-4 py-2 font-semibold"
                  >
                    Add Cost to Product (PKR {unitCost.toFixed(2)})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: SEPARATE COSTING HISTORY SCREEN                                 */}
      {/* ======================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center">
                  <IconFileText className="w-4 h-4 mr-2 text-emerald-600" />
                  Product Costing History Records
                </CardTitle>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Search product, serial..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-48 text-xs py-1"
                  />
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <Button variant="outline" size="sm" onClick={loadHistory} className="text-xs">
                    <IconFilter className="w-3.5 h-3.5 mr-1" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingHistory ? (
                <div className="p-6">
                  <TableSkeleton rows={5} columns={6} />
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No historical costing records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Serial / Code</th>
                        <th className="py-2.5 px-3">End Product</th>
                        <th className="py-2.5 px-3 text-right">Output Qty</th>
                        <th className="py-2.5 px-4 text-right">Total Cost (PKR)</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost (PKR)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyRecords.map((rec) => {
                        let snap: any = {};
                        try {
                          if (rec.notes && rec.notes.startsWith('{')) snap = JSON.parse(rec.notes);
                        } catch {}

                        const productName =
                          snap.productName || rec.finishedProduct?.productName || 'Finished Product';
                        const code = snap.serialNumber || snap.costingCode || `CST-v${rec.version}`;
                        const dateFormatted = rec.createdAt ? rec.createdAt.split('T')[0] : '';

                        return (
                          <tr
                            key={rec.id}
                            onDoubleClick={() => handleOpenVoucherModal(rec)}
                            className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-gray-600">{dateFormatted}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{code}</td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{productName}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold">
                              {Number(rec.batchOutputQuantity).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              {Number(rec.totalBatchCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                              {Number(rec.costPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rec.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenVoucherModal(rec)}
                                className="text-[11px] py-1 px-2.5"
                              >
                                <IconEye className="w-3 h-3 mr-1" />
                                View
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
      )}

      {/* ======================================================================= */}
      {/* HISTORICAL VOUCHER REVIEW MODAL                                         */}
      {/* ======================================================================= */}
      {selectedHistoryModalRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedHistoryModalRecord(null)}
          title={`Costing Voucher Snapshot — ${
            (() => {
              try {
                const s = JSON.parse(selectedHistoryModalRecord.notes || '{}');
                return s.serialNumber || s.costingCode || 'Voucher';
              } catch {
                return 'Voucher';
              }
            })()
          }`}
          size="xl"
        >
          {(() => {
            let snap: any = {};
            try {
              if (selectedHistoryModalRecord.notes) snap = JSON.parse(selectedHistoryModalRecord.notes);
            } catch {}

            const savedLines: CostingLineItem[] = snap.lines || [];

            return (
              <div className="space-y-4 text-xs">
                {/* Header Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">End Product:</span>
                    <p className="font-bold text-gray-900 mt-0.5">
                      {snap.productName || selectedHistoryModalRecord.finishedProduct?.productName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Warehouse:</span>
                    <p className="font-bold text-gray-900 mt-0.5">{snap.warehouseName || 'Standard Warehouse'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Contractor:</span>
                    <p className="font-bold text-gray-900 mt-0.5">{snap.contractorVendorName || snap.vendorName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Costing Date:</span>
                    <p className="font-bold text-gray-900 mt-0.5 font-mono">
                      {snap.costingDate ? snap.costingDate.split('T')[0] : selectedHistoryModalRecord.createdAt.split('T')[0]}
                    </p>
                  </div>
                </div>

                {/* Table Breakdown */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-900 text-white font-semibold">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product / Material</th>
                        <th className="py-2 px-2 text-center">Type</th>
                        <th className="py-2 px-3 text-center">Pack</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate (PKR)</th>
                        <th className="py-2 px-4 text-right">Cost (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {savedLines.map((l, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-emerald-50/20' : 'bg-white'}>
                          <td className="py-2 px-3 font-mono text-gray-400">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-gray-900">{l.materialName}</td>
                          <td className="py-2 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                              {l.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">{l.pack}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(l.quantity).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(l.rate).toLocaleString()}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-gray-900">
                            {Number(l.cost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}

                      {savedLines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-gray-400">
                            Line snapshot not preserved for this legacy record.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Arithmetic Summary */}
                <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Cost:</span>
                    <p className="text-base font-bold font-mono text-gray-900">
                      PKR {Number(selectedHistoryModalRecord.totalBatchCost).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 uppercase font-semibold">Actual Output Qty:</span>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {Number(selectedHistoryModalRecord.batchOutputQuantity).toLocaleString()} units
                    </p>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-md border border-emerald-300">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Unit Cost:</span>
                    <p className="text-lg font-extrabold font-mono text-emerald-800">
                      PKR {Number(selectedHistoryModalRecord.costPerUnit).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Footer Modal Actions */}
                <div className="flex justify-end space-x-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedHistoryModalRecord(null)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      const targetFpId =
                        selectedHistoryModalRecord.finishedProductId ||
                        selectedHistoryModalRecord.finishedProduct?.id ||
                        snap.finishedProductId;
                      if (!targetFpId) {
                        showToast({ title: 'Error', message: 'No finished product linked to this record.', type: 'error' });
                        return;
                      }
                      try {
                        await ApiClient.post('/api/v1/costing/apply-to-product', {
                          finishedProductId: targetFpId,
                          costPerUnit: selectedHistoryModalRecord.costPerUnit,
                          notes: `Re-applied cost from historical record v${selectedHistoryModalRecord.version}`,
                        });
                        showToast({
                          title: 'Standard Cost Applied',
                          message: `Product standard cost set to PKR ${Number(selectedHistoryModalRecord.costPerUnit).toFixed(2)}`,
                          type: 'success',
                        });
                      } catch (err: any) {
                        showToast({ title: 'Error', message: err.message, type: 'error' });
                      }
                    }}
                    className="bg-emerald-700 text-white font-bold"
                  >
                    Apply Cost to Product
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

export default ProductCostingView;
