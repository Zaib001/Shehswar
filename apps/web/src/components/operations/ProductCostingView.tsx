'use client';

/**
 * SHEHSWAR ONE360 - Enterprise Product Costing Engine
 *
 * Real Data Production Architecture:
 * - Direct integration with real database Purchase Orders (PurchaseOrderItem)
 * - Zero hardcoded or static sample products
 * - Non-silent, date-wise purchase cost selection
 * - Unified component costing table: RM, PM, and Direct Labour
 * - Real-time calculation: Cost = Qty * Rate
 * - Immutable costing history snapshots in PostgreSQL
 * - Optional "Add Cost to Product" (updates FinishedProduct.standardCost only)
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
// TYPE DEFINITIONS
// ==========================================

export type ComponentType = 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'OTHER';

export function formatVolume(qty?: number, unitOrPack?: string): string {
  const safeQty = Number(qty || 0);
  if (!unitOrPack) return safeQty.toLocaleString();
  const clean = String(unitOrPack).trim();
  const match = clean.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match && match[1]) {
    const packQty = parseFloat(match[1]);
    const uom = (match[2] || '').trim() || 'Unit';
    if (packQty === 1) return `${safeQty.toLocaleString()} ${uom}`;
    if (Math.abs(packQty - safeQty) < 0.001) return `${safeQty.toLocaleString()} ${uom}`;
    const totalVolume = safeQty * packQty;
    return `${safeQty.toLocaleString()} × ${clean} (${totalVolume.toLocaleString()} ${uom})`;
  }
  return `${safeQty.toLocaleString()} ${clean}`;
}

export function formatUom(unitOrPack?: string): string {
  if (!unitOrPack) return 'Unit';
  const clean = String(unitOrPack).trim();
  const match = clean.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match && match[1]) {
    const packQty = parseFloat(match[1]);
    const uom = (match[2] || '').trim() || 'Unit';
    if (packQty === 1) return uom;
    return clean;
  }
  return clean;
}

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
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
  materialCode: string;
  materialName: string;
  pack: string;
  purchaseQuantity: number;
  purchaseRate: number;
  lineTotal: number;
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
  warehouseName?: string;
  availablePurchases?: PurchasedMaterialRecord[];
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

  // Real Purchased Materials from DB Purchase Orders
  const [purchasedMaterials, setPurchasedMaterials] = useState<PurchasedMaterialRecord[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState<boolean>(false);

  // Costing Voucher Header
  const [serialNumber, setSerialNumber] = useState<string>('CST-000001');
  const [costingDate, setCostingDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '2026-11-11');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [selectedFinishedProductId, setSelectedFinishedProductId] = useState<string>('');
  const [packSize, setPackSize] = useState<string>('0');
  const [estimatedQuantity, setEstimatedQuantity] = useState<number>(0);
  const [actualQuantity, setActualQuantity] = useState<number>(0);

  // Costing Table Lines (Driven 100% by real POs)
  const [lines, setLines] = useState<CostingLineItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApplyingCost, setIsApplyingCost] = useState<boolean>(false);

  // Material Selector Modal / Picker State
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [activeLineIdForPicker, setActiveLineIdForPicker] = useState<string | null>(null);
  const [pickerFilterType, setPickerFilterType] = useState<'ALL' | 'RAW_MATERIAL' | 'PACKING_MATERIAL'>('ALL');
  const [pickerSearchQuery, setPickerSearchQuery] = useState<string>('');

  // Costing History State
  const [historyRecords, setHistoryRecords] = useState<SavedCostingRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [selectedHistoryModalRecord, setSelectedHistoryModalRecord] = useState<SavedCostingRecord | null>(null);

  // ==========================================
  // 1. DATA INITIALIZATION & REAL PO QUERY
  // ==========================================

  const loadInitialData = useCallback(async () => {
    setIsLoadingMasterData(true);
    setIsLoadingPurchases(true);
    try {
      const [whRes, venRes, fpRes, nextCodeRes, purchasedRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/warehouses?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products?all=true').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/next-code?entityType=COSTING').catch(() => ({ data: { code: 'CST-000001' } })),
        ApiClient.get<any>('/api/v1/costing/purchased-materials').catch(() => ({ data: { purchases: [] } })),
      ]);

      const normalizeList = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data?.items)) return res.data.items;
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data?.purchases)) return res.data.purchases;
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
      const poItemsList: PurchasedMaterialRecord[] = normalizeList(purchasedRes);

      setWarehouses(whList);
      setVendors(venList);
      setFinishedProducts(fpList);
      setPurchasedMaterials(poItemsList);

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
        const preferredVen = venList.find((v) => v.name.toLowerCase().includes('v agrics')) ||
          venList.find((v) => v.name.toLowerCase().includes('al nasar')) ||
          venList[0];
        if (preferredVen) setSelectedContractorId(preferredVen.id);
      }

      // Keep finished product unselected by default so all quantities and values remain 0
      // User selects their desired finished product from the combobox
    } catch (err: any) {
      console.error('Failed to load costing initial data:', err);
      showToast({
        title: 'Data Load Notice',
        message: 'Could not load complete master data.',
        type: 'error',
      });
    } finally {
      setIsLoadingMasterData(false);
      setIsLoadingPurchases(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
  // 2. REAL PURCHASE ORDER MATERIAL SELECTION
  // ==========================================

  const handleOpenPickerForLine = (lineId: string, filter: 'ALL' | 'RAW_MATERIAL' | 'PACKING_MATERIAL' = 'ALL') => {
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

        // "all value will be 0 by default" -> quantity is 0 unless user already entered a quantity
        const qty = line.quantity && line.quantity > 0 ? line.quantity : 0;
        const rate = purchasedItem.purchaseRate || 0;
        const newCost = Math.round(qty * rate * 100) / 100;
        const poTotal = Number(purchasedItem.lineTotal) || (purchasedItem.purchaseQuantity * rate);

        return {
          ...line,
          materialId: purchasedItem.materialId,
          materialName: purchasedItem.materialName,
          materialCode: purchasedItem.materialCode,
          type: purchasedItem.materialType === 'PACKING_MATERIAL' ? 'PACKING_MATERIAL' : 'RAW_MATERIAL',
          pack: purchasedItem.pack || '1 Nos',
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

    // If contractor/vendor or warehouse not explicitly chosen yet, auto-sync from the selected real PO
    if (!selectedContractorId && purchasedItem.vendorId) {
      setSelectedContractorId(purchasedItem.vendorId);
    }
    if (!selectedWarehouseId && purchasedItem.warehouseId) {
      setSelectedWarehouseId(purchasedItem.warehouseId);
    }

    const totalPoAmt = Number(purchasedItem.lineTotal) || (purchasedItem.purchaseQuantity * (purchasedItem.purchaseRate || 0));
    showToast({
      title: 'Real Purchase Order Selected',
      message: `${purchasedItem.materialName} from ${purchasedItem.poNumber} (Total PO: PKR ${totalPoAmt.toLocaleString()} @ PKR ${purchasedItem.purchaseRate.toLocaleString()}/${purchasedItem.pack})`,
      type: 'success',
    });
  };

  const handleAddRow = (type: ComponentType = 'RAW_MATERIAL') => {
    const newLineId = `line-${Date.now()}`;
    const newLine: CostingLineItem = {
      id: newLineId,
      materialName: '',
      type,
      pack: type === 'RAW_MATERIAL' ? 'LTR' : '1 Nos',
      quantity: 0,
      rate: 0,
      cost: 0,
    };
    setLines((prev) => [...prev, newLine]);
    // Automatically open the real purchase order selector for this line
    handleOpenPickerForLine(newLineId, type === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : 'PACKING_MATERIAL');
  };

  const handleAddLabourRow = () => {
    const newLine: CostingLineItem = {
      id: `line-${Date.now()}`,
      materialName: 'PM Packing Labour',
      type: 'OTHER',
      pack: '1 Nos',
      quantity: 0,
      rate: 0,
      cost: 0,
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
      if (pickerFilterType !== 'ALL' && item.materialType !== pickerFilterType) {
        return false;
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
  // 3. ARITHMETIC CALCULATION
  // ==========================================

  const totalCost = useMemo(() => {
    return lines.reduce((acc, line) => acc + (Number(line.cost) || 0), 0);
  }, [lines]);

  const unitCost = useMemo(() => {
    if (!actualQuantity || actualQuantity <= 0) return 0;
    return Math.round((totalCost / actualQuantity) * 100) / 100;
  }, [totalCost, actualQuantity]);

  const rawMaterialTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'RAW_MATERIAL').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const packagingTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'PACKING_MATERIAL').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  const otherTotal = useMemo(() => {
    return lines.filter((l) => l.type === 'OTHER').reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  }, [lines]);

  // ==========================================
  // 4. SAVE COSTING (POST /api/v1/costing/save)
  // ==========================================

  const handleSaveCosting = async () => {
    if (lines.length === 0) {
      showToast({ title: 'Validation Error', message: 'Please add at least one material component.', type: 'error' });
      return;
    }
    if (!actualQuantity || actualQuantity <= 0) {
      showToast({ title: 'Validation Error', message: 'Please enter valid actual production quantity.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const selectedVen = vendors.find((v) => v.id === selectedContractorId);
      const selectedFp = finishedProducts.find((f) => f.id === selectedFinishedProductId);

      const parsedPackSize = parseFloat(packSize) || 1;

      // Extract RM and PM lines with real PO links
      const rmLines = lines
        .filter((l) => l.type === 'RAW_MATERIAL' && l.materialId)
        .map((l) => ({
          rawMaterialId: l.materialId!,
          rawMaterialName: l.materialName,
          rawMaterialCode: l.materialCode,
          quantity: l.quantity,
          unitCost: l.rate,
          totalCost: l.cost,
          uomName: l.pack,
          sourcePoNumber: l.sourcePoNumber,
          sourcePoId: l.sourcePoId,
          purchaseDate: l.purchaseDate,
        }));

      const pmLines = lines
        .filter((l) => l.type === 'PACKING_MATERIAL' && l.materialId)
        .map((l) => ({
          packingMaterialId: l.materialId!,
          quantity: l.quantity,
          unitCost: l.rate,
          totalCost: l.cost,
          uomName: l.pack,
          sourcePoNumber: l.sourcePoNumber,
          sourcePoId: l.sourcePoId,
          purchaseDate: l.purchaseDate,
        }));

      const primaryRm = rmLines[0];

      const activeComp = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      const validActiveCompanyId = activeComp && activeComp !== 'ALL' && activeComp.length > 10 ? activeComp : undefined;

      const payload = {
        companyId: validActiveCompanyId,
        serialNumber,
        costingDate,
        warehouseId: selectedWarehouseId || null,
        warehouseName: selectedWh?.name || 'Warehouse',
        contractorVendorId: selectedContractorId || null,
        contractorVendorName: selectedVen?.name || 'Contractor',
        finishedProductId: selectedFinishedProductId ? selectedFinishedProductId : null,
        finishedProductName: selectedFp?.productName || null,
        finishedProductCode: selectedFp?.productCode || null,
        packSize: parsedPackSize,
        packSizeUnit: packSize.includes('Liter') ? 'Liter' : packSize.includes('KG') ? 'KG' : 'Unit',
        estimatedQuantity,
        actualQuantity,
        finishedQuantity: actualQuantity,
        lines, // Full line snapshot with PO numbers, dates, and vendors
        rawMaterialId: primaryRm?.rawMaterialId,
        rawMaterials: rmLines,
        packagingMaterials: pmLines,
        otherCost: otherTotal,
        totalRawMaterialCost: rawMaterialTotal,
        totalPackagingCost: packagingTotal,
        totalBatchCost: totalCost,
        costPerUnit: unitCost,
        notes: `Product Costing Voucher ${serialNumber} confirmed with ${lines.length} components.`,
      };

      const res = await ApiClient.post<any>('/api/v1/costing/save', payload);
      const savedCode = res.data?.costingCode || serialNumber;

      showToast({
        title: 'Costing Saved Permanently',
        message: `Voucher ${savedCode} saved in database with Unit Cost PKR ${unitCost.toFixed(2)}`,
        type: 'success',
      });

      // Refresh next serial code
      const nextRes = await ApiClient.get<any>('/api/v1/master-data/next-code?entityType=COSTING').catch(() => null);
      if (nextRes?.data?.code) setSerialNumber(nextRes.data.code);
    } catch (err: any) {
      console.error('Save failed:', err);
      showToast({
        title: 'Save Failed',
        message: err.message || 'Could not save costing record.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // 5. ADD COST TO PRODUCT (OPTIONAL ACTION)
  // ==========================================

  const handleApplyCostToProduct = async () => {
    if (!selectedFinishedProductId) {
      showToast({ title: 'Validation Error', message: 'Please select an End Product.', type: 'error' });
      return;
    }
    if (!unitCost || unitCost <= 0) {
      showToast({ title: 'Validation Error', message: 'Unit cost must be greater than zero.', type: 'error' });
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
        notes: `Standard cost updated to PKR ${unitCost.toFixed(2)} from Costing Voucher ${serialNumber}`,
      };

      await ApiClient.post('/api/v1/costing/apply-to-product', payload);

      showToast({
        title: 'Product Standard Cost Updated',
        message: `Standard cost of ${selectedFp?.productName || 'Product'} updated to PKR ${unitCost.toFixed(2)}. Rate lists remain untouched.`,
        type: 'success',
      });

      setFinishedProducts((prev) =>
        prev.map((p) => (p.id === selectedFinishedProductId ? { ...p, standardCost: unitCost } : p))
      );
    } catch (err: any) {
      console.error('Failed to update product cost:', err);
      showToast({ title: 'Update Failed', message: err.message, type: 'error' });
    } finally {
      setIsApplyingCost(false);
    }
  };

  // ==========================================
  // 6. HISTORY SCREEN
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

  // ==========================================
  // 7. RENDER ENTERPRISE UI
  // ==========================================

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary, #0f172a)' }}>
      {/* SECTION TABS & HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Product Costing Engine
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
              Real Purchase Order driven formulation and unit cost calculation
            </p>
          </div>
        </div>

        {/* Actions & View Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInitialData()}
            isLoading={isLoadingMasterData || isLoadingPurchases}
            title="Refresh Purchase Orders & Master Data"
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '8px',
              borderColor: 'var(--border-default, #cbd5e1)',
              backgroundColor: '#ffffff',
            }}
          >
            <IconRefresh className="w-3.5 h-3.5 mr-1.5" />
            Refresh POs
          </Button>

          {/* View Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface-raised, #f1f5f9)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-default, #e2e8f0)',
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
                color: activeTab === 'voucher' ? '#0d9488' : 'var(--text-secondary, #64748b)',
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
                color: activeTab === 'history' ? '#0d9488' : 'var(--text-secondary, #64748b)',
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
      {/* TAB 1: MAIN COSTING VOUCHER (REAL PO DRIVEN)                             */}
      {/* ======================================================================= */}
      {activeTab === 'voucher' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* COMPACT VOUCHER HEADER CARD */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                alignItems: 'flex-end',
              }}
            >
              {/* 1. Serial No */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Serial No.
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      color: '#475569',
                    }}
                  >
                    A
                  </span>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f766e',
                      backgroundColor: '#f0fdfa',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0 8px 8px 0',
                      outline: 'none',
                    }}
                  />
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

              {/* 3. Warehouse */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Production Warehouse
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
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

              {/* 5. Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '38px' }}>
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
                  ACTIVE / READY
                </span>
              </div>
            </div>

            {/* End Product Master Bar */}
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
              <div style={{ flex: '1 1 450px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                  End Product (From Product Master):
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
                    onChange={handleFinishedProductChange}
                    placeholder="Search existing Finished Products..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Pack Specification:</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {packSize}
                </span>
              </div>
            </div>
          </div>

          {/* MAIN COSTING TABLE (DRIVEN BY REAL DATABASE PURCHASE ORDERS) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      #
                    </th>
                    <th style={{ padding: '12px 14px', minWidth: '320px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Product / Material Component & Real PO Source
                    </th>
                    <th style={{ padding: '12px 14px', width: '90px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Type
                    </th>
                    <th style={{ padding: '12px 14px', width: '130px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Pack Size
                    </th>
                    <th style={{ padding: '12px 14px', width: '120px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Required Qty
                    </th>
                    <th style={{ padding: '12px 14px', width: '150px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Purchase Rate (PKR)
                    </th>
                    <th style={{ padding: '12px 14px', width: '160px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      Component Cost (PKR)
                    </th>
                    <th style={{ padding: '12px 14px', width: '50px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
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
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                              {line.materialName || (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Click to select material from Purchase Orders...</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForLine(line.id, line.type === 'PACKING_MATERIAL' ? 'PACKING_MATERIAL' : 'RAW_MATERIAL')}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
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
                            <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                ✓ {line.sourcePoNumber}
                              </span>
                              {line.sourcePoQuantity !== undefined && line.sourcePoQuantity > 0 && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontWeight: 800,
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11.5px',
                                    border: '1px solid #bfdbfe',
                                  }}
                                >
                                  Purchased Volume: {formatVolume(line.sourcePoQuantity, line.pack)}
                                </span>
                              )}
                              {line.sourcePoTotal !== undefined && (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f0fdfa', color: '#0f766e', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                  Total PO Price: PKR {Number(line.sourcePoTotal).toLocaleString()}
                                </span>
                              )}
                              <span>
                                {line.purchaseDate ? `Date: ${line.purchaseDate.split('T')[0]}` : ''}
                                {line.vendorName ? ` • Vendor: ${line.vendorName}` : ''}
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                              {line.type === 'OTHER' ? 'Direct Labour / Overhead' : 'No Purchase Order attached'}
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
                            fontWeight: 700,
                            backgroundColor:
                              line.type === 'RAW_MATERIAL'
                                ? '#eff6ff'
                                : line.type === 'PACKING_MATERIAL'
                                ? '#f5f3ff'
                                : '#fdf4ff',
                            color:
                              line.type === 'RAW_MATERIAL'
                                ? '#1d4ed8'
                                : line.type === 'PACKING_MATERIAL'
                                ? '#6d28d9'
                                : '#a21caf',
                            border:
                              line.type === 'RAW_MATERIAL'
                                ? '1px solid #bfdbfe'
                                : line.type === 'PACKING_MATERIAL'
                                ? '1px solid #ddd6fe'
                                : '1px solid #fbcfe8',
                          }}
                        >
                          {line.type === 'RAW_MATERIAL' ? 'RM' : line.type === 'PACKING_MATERIAL' ? 'PM' : 'OTHER'}
                        </span>
                      </td>

                      {/* Pack Size */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="text"
                          value={line.pack}
                          onChange={(e) => handleLineChange(line.id, 'pack', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            textAlign: 'center',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0 6px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                      </td>

                      {/* Required Qty */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="any"
                          value={line.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            height: '34px',
                            textAlign: 'right',
                            fontSize: '13px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0 8px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                        {line.sourcePoQuantity !== undefined && line.sourcePoQuantity > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#1d4ed8', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
                            Volume: {formatVolume(line.sourcePoQuantity, line.pack)}
                          </div>
                        )}
                      </td>

                      {/* Purchase Rate (Auto-populated from real PO) */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <input
                            type="number"
                            step="any"
                            value={line.rate}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleLineChange(line.id, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0 8px',
                              backgroundColor: line.sourcePoNumber ? '#f0fdf4' : '#ffffff',
                              color: '#0f172a',
                              outline: 'none',
                            }}
                          />
                          {line.sourcePoNumber && (
                            <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                              From {line.sourcePoNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Component Cost (Qty * Rate) */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        {Number(line.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          title="Remove line"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 6px' }}>No materials added yet</p>
                        <p style={{ fontSize: '12px', margin: '0 0 16px', color: '#94a3b8' }}>
                          Add actual purchased Raw Materials and Packaging Materials from real database Purchase Orders.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <Button variant="primary" size="sm" onClick={() => handleAddRow('RAW_MATERIAL')} icon={<IconPlus size={14} />}>
                            Add Raw Material (from POs)
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleAddRow('PACKING_MATERIAL')} icon={<IconPlus size={14} />}>
                            Add Packaging Material (from POs)
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
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('RAW_MATERIAL')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#1d4ed8', borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
                >
                  Raw Material (PO)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow('PACKING_MATERIAL')}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#6d28d9', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' }}
                >
                  Packaging Material (PO)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLabourRow}
                  icon={<IconPlus size={14} />}
                  style={{ color: '#475569', borderColor: '#cbd5e1' }}
                >
                  Packing Labour / Overhead
                </Button>
              </div>

              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Calculation formula: <strong style={{ color: '#0f172a' }}>Cost = Qty × Rate</strong>
              </span>
            </div>
          </div>

          {/* BOTTOM CALCULATION SUMMARY & SAVE ACTIONS */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid #99f6e4',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.08), 0 2px 4px -2px rgba(13, 148, 136, 0.04)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                alignItems: 'center',
              }}
            >
              {/* Est. Qty */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Est. Batch Quantity
                </label>
                <input
                  type="number"
                  value={estimatedQuantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEstimatedQuantity(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    height: '42px',
                    textAlign: 'right',
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0 12px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Actual Production Output Qty */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f766e', marginBottom: '6px' }}>
                  Actual Output Quantity *
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={actualQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setActualQuantity(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      height: '42px',
                      textAlign: 'right',
                      fontSize: '17px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      border: '2px solid #0d9488',
                      borderRadius: '8px 0 0 8px',
                      padding: '0 12px',
                      backgroundColor: '#ffffff',
                      color: '#0f766e',
                      outline: 'none',
                      boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.1)',
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

              {/* Total Batch Cost */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  Total Batch Production Cost
                </span>
                <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                  PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                  RM: {rawMaterialTotal.toLocaleString()} • PM: {packagingTotal.toLocaleString()}
                </span>
              </div>

              {/* Manufacturing Cost Per Unit */}
              <div
                style={{
                  textAlign: 'right',
                  backgroundColor: '#f0fdfa',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #5eead4',
                }}
              >
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.05em' }}>
                  Unit Cost (Per Bottle / Pack)
                </span>
                <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#0f766e' }}>
                  PKR {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                  Total Cost ÷ Actual Qty
                </span>
              </div>
            </div>

            {/* Save & Action Buttons */}
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
                  showToast({ title: 'Voucher Cleared', message: 'Ready for new costing entry.', type: 'info' });
                }}
                style={{ color: '#64748b' }}
              >
                Clear Voucher
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button
                  variant="primary"
                  onClick={handleSaveCosting}
                  isLoading={isSaving}
                  style={{
                    backgroundColor: '#0d9488',
                    color: '#ffffff',
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)',
                  }}
                >
                  <IconCheck className="w-4 h-4 mr-1.5" />
                  Save Costing Voucher
                </Button>

                <Button
                  variant="outline"
                  onClick={handleApplyCostToProduct}
                  isLoading={isApplyingCost}
                  style={{
                    borderColor: '#0d9488',
                    color: '#0f766e',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                >
                  Add Cost to Product (PKR {unitCost.toFixed(2)})
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
          title="Select Component From Real Purchase Orders"
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'RAW_MATERIAL', 'PACKING_MATERIAL'] as const).map((t) => (
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
                    {t === 'ALL' ? 'All Purchases' : t === 'RAW_MATERIAL' ? 'Raw Materials' : 'Packaging'}
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
                maxHeight: '380px',
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
                filteredPickerPurchases.map((item, idx) => (
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
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: item.materialType === 'RAW_MATERIAL' ? '#eff6ff' : '#f5f3ff',
                            color: item.materialType === 'RAW_MATERIAL' ? '#1d4ed8' : '#6d28d9',
                          }}
                        >
                          {item.materialType === 'RAW_MATERIAL' ? 'RM' : 'PM'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        PO: <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{item.poNumber}</strong>
                        {' • '}Date: <strong>{item.purchaseDate ? item.purchaseDate.split('T')[0] : ''}</strong>
                        {' • '}Vendor: <strong>{item.vendorName}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {/* Prominently Show Total Price */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Total Price:
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0f766e' }}>
                          PKR {(Number(item.lineTotal) || (Number(item.purchaseQuantity) * Number(item.purchaseRate))).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Prominently Show Purchased Volume & Rate */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe', fontFamily: 'var(--font-mono)' }}>
                          Purchased Volume: {formatVolume(item.purchaseQuantity, item.pack)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', fontFamily: 'var(--font-mono)' }}>
                          • Rate: PKR {Number(item.purchaseRate).toLocaleString()} / {formatUom(item.pack)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
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
      {/* TAB 2: SEPARATE COSTING HISTORY SCREEN                                 */}
      {/* ======================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
            }}
          >
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Confirmed Costing History Records
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search product, serial..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    style={{
                      height: '34px',
                      padding: '0 10px 0 28px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      minWidth: '200px',
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

            {/* History Table */}
            {isLoadingHistory ? (
              <TableSkeleton rows={5} columns={6} />
            ) : historyRecords.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>No costing records found</p>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Saved costing vouchers will appear here permanently.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Serial / Code</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>End Product</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Output Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Batch Cost</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unit Cost</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((rec, idx) => {
                      let snap: any = {};
                      try {
                        if (rec.notes && rec.notes.startsWith('{')) snap = JSON.parse(rec.notes);
                      } catch {}

                      const productName = snap.productName || rec.finishedProduct?.productName || 'Finished Product';
                      const code = snap.serialNumber || snap.costingCode || `CST-v${rec.version}`;
                      const dateStr = rec.createdAt ? rec.createdAt.split('T')[0] : '';

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
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{dateStr}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0f766e' }}>{code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{productName}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {Number(rec.batchOutputQuantity).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            PKR {Number(rec.totalBatchCost).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0f766e' }}>
                            PKR {Number(rec.costPerUnit).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: rec.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                                color: rec.status === 'ACTIVE' ? '#047857' : '#64748b',
                              }}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <Button variant="outline" size="sm" onClick={() => setSelectedHistoryModalRecord(rec)}>
                              <IconEye className="w-3.5 h-3.5 mr-1" />
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
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Contractor / Vendor</span>
                    <p style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>{snap.contractorVendorName || snap.vendorName || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Costing Date</span>
                    <p style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
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
                              <div style={{ fontSize: '11px', color: '#059669', fontFamily: 'var(--font-mono)' }}>
                                PO: {l.sourcePoNumber} ({l.purchaseDate ? l.purchaseDate.split('T')[0] : ''}) • {l.vendorName || ''}
                                {l.sourcePoQuantity ? ` • Vol: ${formatVolume(l.sourcePoQuantity, l.pack)}` : ''}
                                {l.sourcePoTotal ? ` • Total: PKR ${Number(l.sourcePoTotal).toLocaleString()}` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9' }}>
                              {l.type === 'RAW_MATERIAL' ? 'RM' : l.type === 'PACKING_MATERIAL' ? 'PM' : 'OTHER'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.pack}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(l.quantity).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(l.rate).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
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
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f0fdfa',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #99f6e4',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>TOTAL BATCH COST:</span>
                    <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                      PKR {Number(selectedHistoryModalRecord.totalBatchCost).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>ACTUAL OUTPUT:</span>
                    <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                      {Number(selectedHistoryModalRecord.batchOutputQuantity).toLocaleString()} units
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e' }}>UNIT COST:</span>
                    <p style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#0f766e', margin: '2px 0 0' }}>
                      PKR {Number(selectedHistoryModalRecord.costPerUnit).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
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
