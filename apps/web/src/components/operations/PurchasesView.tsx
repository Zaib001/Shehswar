'use client';

/**
 * SHEHSWAR ONE360 - Purchase Invoices & Direct Purchases Management
 * 
 * Follows Canonical Flow:
 * - Direct Purchase Invoice entry (Raw Material, Packing Material, Finished Product)
 * - Auto-calculate Gross, Tax, Discount, Net
 * - Status lifecycle: DRAFT -> REVIEWED -> POSTED (Atomic: Stock +, Vendor Ledger credit, Costing updated)
 * - Auto-create Raw/Packing material on purchase if new
 * - Purchase Returns (Stock -, Vendor Ledger debit)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  KpiCard,
  TableSkeleton,
  EmptyState,
  Modal,
} from '../ui';
import {
  IconPlus,
  IconEye,
  IconTrash,
  IconRotateCcw,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface PurchaseItemRow {
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
  itemName: string;
  rawMaterialId?: string;
  packingMaterialId?: string;
  packing?: string;
  quantity: number;
  rate: number;
  grossAmount: number;
  taxPercent: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  warehouseId?: string;
}

export interface PurchaseReturnItemRow {
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
  rawMaterialId?: string | null;
  packingMaterialId?: string | null;
  finishedProductId?: string | null;
  warehouseId?: string | null;
  itemName: string;
  quantity: number;
  purchasedQuantity?: number;
  returnedQuantity?: number;
  maxQuantity: number;
  rate: number;
  netAmount: number;
}

export interface PurchaseInvoiceRecord {
  id: string;
  voucherNumber: string;
  date: string;
  vendorId: string;
  warehouseId: string;
  vendor?: { id: string; name: string; code: string };
  warehouse?: { id: string; name: string; code: string };
  grossAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  originalNetAmount?: number;
  totalReturnedAmount?: number;
  activeNetAmount?: number;
  postingStatus: 'DRAFT' | 'REVIEWED' | 'POSTED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';
  notes?: string;
  items?: PurchaseItemRow[];
  purchaseReturns?: Array<{
    id: string;
    voucherNumber: string;
    date: string;
    netAmount: number;
    reason?: string;
    warehouse?: { id: string; name: string };
    items?: Array<{ itemName: string; quantity: number; rate: number; netAmount: number }>;
  }>;
  createdAt: string;
}

export interface PurchasesViewProps {
  initialPoData?: any;
  onClearPoData?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ initialPoData, onClearPoData: _onClearPoData }) => {
  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [invoices, setInvoices] = useState<PurchaseInvoiceRecord[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'returns'>('purchases');
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoiceRecord | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Inline Warehouse Modal State
  const [isAddWhModalOpen, setIsAddWhModalOpen] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [newWhLocation, setNewWhLocation] = useState('');
  const [isCreatingWh, setIsCreatingWh] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrFileName, setOcrFileName] = useState('');
  const [isMultiDateSheet, setIsMultiDateSheet] = useState(false);
  const [datedVouchers, setDatedVouchers] = useState<Array<{
    date: string;
    voucherNumber?: string;
    items: any[];
    totalAmount: number;
  }>>([]);
  const [selectedDatedVoucherIdx, setSelectedDatedVoucherIdx] = useState(-1);
  const [isPostingBatchPurchases, setIsPostingBatchPurchases] = useState(false);

  // Purchase Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState<PurchaseInvoiceRecord | null>(null);
  const [returnReason, setReturnReason] = useState('Damaged / Quality specification return');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<PurchaseReturnItemRow[]>([]);

  // Multi-Warehouse Split Allocation State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitItemIndex, setSplitItemIndex] = useState<number | null>(null);
  const [splitAllocations, setSplitAllocations] = useState<Array<{ warehouseId: string; quantity: number }>>([]);

  // Form State
  const [formData, setFormData] = useState({
    vendorId: '',
    warehouseId: '',
    date: new Date().toISOString().split('T')[0],
    vendorInvoiceNo: '',
    reference: '',
    notes: '',
  });

  const [formItems, setFormItems] = useState<PurchaseItemRow[]>([
    {
      materialType: 'RAW_MATERIAL',
      itemName: '',
      quantity: 1,
      rate: 0,
      grossAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      discountAmount: 0,
      netAmount: 0,
    },
  ]);

  // Handle PO conversion transfer
  useEffect(() => {
    if (initialPoData) {
      setFormData({
        vendorId: initialPoData.vendorId || '',
        warehouseId: initialPoData.warehouseId || '',
        date: new Date().toISOString().split('T')[0],
        vendorInvoiceNo: '',
        reference: initialPoData.poNumber || '',
        notes: `Converted from Purchase Order ${initialPoData.poNumber}`,
      });
      if (Array.isArray(initialPoData.items) && initialPoData.items.length > 0) {
        setFormItems(
          initialPoData.items.map((i: any) => ({
            materialType: i.materialType || 'RAW_MATERIAL',
            itemName: i.itemName,
            rawMaterialId: i.materialType === 'RAW_MATERIAL' ? i.materialId : undefined,
            packingMaterialId: i.materialType === 'PACKING_MATERIAL' ? i.materialId : undefined,
            quantity: Number(i.quantity) || 1,
            rate: Number(i.unitRate) || 0,
            grossAmount: (Number(i.quantity) || 1) * (Number(i.unitRate) || 0),
            taxPercent: 0,
            taxAmount: 0,
            discountAmount: 0,
            netAmount: (Number(i.quantity) || 1) * (Number(i.unitRate) || 0),
          })),
        );
      }
      setMode('create');
    }
  }, [initialPoData]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, venRes, whRes, rmRes, pmRes, retRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/purchases').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/raw-materials').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/purchases/returns').catch(() => ({ data: [] })),
      ]);

      setInvoices(Array.isArray(invRes.data) ? invRes.data : invRes.data?.data || []);
      setVendors(Array.isArray(venRes.data) ? venRes.data : venRes.data?.data || []);
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || []);
      setRawMaterials(Array.isArray(rmRes.data) ? rmRes.data : rmRes.data?.data || []);
      setPackingMaterials(Array.isArray(pmRes.data) ? pmRes.data : pmRes.data?.data || []);
      setReturnsList(Array.isArray(retRes.data) ? retRes.data : retRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load purchase invoices', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quick Warehouse Creation Modal Handler
  const handleQuickCreateWh = async () => {
    if (!newWhName.trim()) {
      showToast({ title: 'Validation', message: 'Warehouse name is required', type: 'warning' });
      return;
    }
    setIsCreatingWh(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/purchases/warehouses/quick-create', {
        name: newWhName,
        location: newWhLocation,
      });
      showToast({ title: 'Warehouse Created', message: `${res.data.name} is now available`, type: 'success' });
      setWarehouses((prev) => [...prev, res.data]);
      setFormData((prev) => ({ ...prev, warehouseId: res.data.id }));
      setIsAddWhModalOpen(false);
      setNewWhName('');
      setNewWhLocation('');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to create warehouse', type: 'error' });
    } finally {
      setIsCreatingWh(false);
    }
  };

  // OCR Upload Handler for Vendor Invoice
  const handleUploadInvoiceOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    showToast({ title: 'Document OCR', message: `Reading and extracting ${file.name}...`, type: 'info' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'VENDOR_INVOICE');

      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        try {
          const text = await file.text();
          formData.append('rawTextHint', text);
        } catch {
          // ignore
        }
      }

      const res = await ApiClient.uploadFile<any>('/api/v1/operations/ocr/upload', formData);
      const ext = res.data?.extractedFields || {};
      const matchedVendor = res.data?.matchedVendor;
      const matchedWh = res.data?.matchedWarehouse;
      const matchedItems = res.data?.matchedItems || [];
      const isMulti = !!res.data?.isMultiDateSheet;
      const dVouchers = res.data?.datedVouchers || [];
      setIsMultiDateSheet(isMulti);
      setDatedVouchers(dVouchers);
      setSelectedDatedVoucherIdx(-1);
      setOcrFileName(file.name);

      if (matchedVendor) {
        setVendors((prev: any[]) => {
          if (!prev.some((v: any) => v.id === matchedVendor.id)) {
            return [matchedVendor, ...prev];
          }
          return prev;
        });
      }
      if (matchedWh) {
        setWarehouses((prev: any[]) => {
          if (!prev.some((w: any) => w.id === matchedWh.id)) {
            return [matchedWh, ...prev];
          }
          return prev;
        });
      }

      setFormData((prev) => ({
        ...prev,
        vendorInvoiceNo: ext.vendorInvoiceNo || ext.docNumber || ext.poNumber || prev.vendorInvoiceNo,
        reference: ext.vendorReference || ext.gatePassNo || ext.docNumber || prev.reference,
        vendorId: matchedVendor?.id || prev.vendorId,
        warehouseId: matchedWh?.id || prev.warehouseId,
        date: ext.poDate || ext.docDate || ext.date || prev.date,
      }));

      if (matchedItems.length > 0) {
        setFormItems(
          matchedItems.map((m: any) => ({
            materialType: m.materialType || 'RAW_MATERIAL',
            itemName: m.itemName,
            rawMaterialId: m.materialType === 'RAW_MATERIAL' ? m.matchedId : undefined,
            packingMaterialId: m.materialType === 'PACKING_MATERIAL' ? m.matchedId : undefined,
            quantity: Number(m.quantity) || 1,
            rate: Number(m.rate) || 0,
            grossAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
            taxPercent: Number(m.tax) || 0,
            taxAmount: ((Number(m.quantity) || 1) * (Number(m.rate) || 0) * (Number(m.tax) || 0)) / 100,
            discountAmount: Number(m.discount) || 0,
            netAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
          })),
        );
      }
      setMode('create');
      if (isMulti && dVouchers.length > 0) {
        showToast({
          title: 'Multi-Date Sheet Detected',
          message: `Found ${dVouchers.length} distinct delivery dates in ${file.name}. Review vouchers below.`,
          type: 'success',
        });
      } else {
        showToast({ title: 'OCR Complete', message: `Extracted data from ${file.name}. Review and post.`, type: 'success' });
      }
    } catch (err: any) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFormData((prev) => ({
        ...prev,
        vendorInvoiceNo: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        reference: `File: ${file.name}`,
      }));
      setFormItems([
        {
          materialType: 'RAW_MATERIAL',
          itemName: cleanName || 'Purchased Material',
          quantity: 1,
          rate: 0,
          grossAmount: 0,
          taxPercent: 0,
          taxAmount: 0,
          discountAmount: 0,
          netAmount: 0,
        },
      ]);
      setMode('create');
      showToast({
        title: 'Form Opened',
        message: err?.message ? `${err.message}. Opened form for manual entry.` : 'Opened form for manual entry.',
        type: 'warning',
      });
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectDatedVoucher = (idx: number) => {
    setSelectedDatedVoucherIdx(idx);
    if (idx === -1) {
      const allItems: PurchaseItemRow[] = [];
      datedVouchers.forEach((dv) => {
        dv.items.forEach((m: any) => {
          allItems.push({
            materialType: m.materialType || 'RAW_MATERIAL',
            itemName: m.itemName,
            rawMaterialId: m.materialType === 'RAW_MATERIAL' ? m.matchedId : undefined,
            packingMaterialId: m.materialType === 'PACKING_MATERIAL' ? m.matchedId : undefined,
            quantity: Number(m.quantity) || 1,
            rate: Number(m.rate) || 0,
            grossAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
            taxPercent: Number(m.tax) || 0,
            taxAmount: ((Number(m.quantity) || 1) * (Number(m.rate) || 0) * (Number(m.tax) || 0)) / 100,
            discountAmount: Number(m.discount) || 0,
            netAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
          });
        });
      });
      if (allItems.length > 0) setFormItems(allItems);
    } else {
      const selectedV = datedVouchers[idx];
      if (selectedV) {
        setFormData((prev) => ({
          ...prev,
          date: selectedV.date,
          vendorInvoiceNo: selectedV.voucherNumber || prev.vendorInvoiceNo,
        }));
        setFormItems(
          selectedV.items.map((m: any) => ({
            materialType: m.materialType || 'RAW_MATERIAL',
            itemName: m.itemName,
            rawMaterialId: m.materialType === 'RAW_MATERIAL' ? m.matchedId : undefined,
            packingMaterialId: m.materialType === 'PACKING_MATERIAL' ? m.matchedId : undefined,
            quantity: Number(m.quantity) || 1,
            rate: Number(m.rate) || 0,
            grossAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
            taxPercent: Number(m.tax) || 0,
            taxAmount: ((Number(m.quantity) || 1) * (Number(m.rate) || 0) * (Number(m.tax) || 0)) / 100,
            discountAmount: Number(m.discount) || 0,
            netAmount: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
          })),
        );
      }
    }
  };

  const handleCreateAllDatedPurchases = async () => {
    if (!formData.vendorId) {
      showToast({ title: 'Validation', message: 'Please select a vendor before batch posting', type: 'warning' });
      return;
    }
    if (datedVouchers.length === 0) return;

    setIsPostingBatchPurchases(true);
    showToast({
      title: 'Generating Purchases',
      message: `Creating ${datedVouchers.length} individual Purchase Invoices by date...`,
      type: 'info',
    });

    try {
      const payload = datedVouchers.map((dv) => ({
        date: dv.date,
        vendorId: formData.vendorId,
        warehouseId: formData.warehouseId || warehouses[0]?.id,
        vendorInvoiceNo: dv.voucherNumber || `INV-${dv.date}`,
        reference: `Multi-Date Sheet: ${ocrFileName} (Date: ${dv.date})`,
        notes: `Extracted from Multi-Date Sheet: ${ocrFileName} (Delivery Date: ${dv.date})`,
        items: dv.items.map((it: any) => ({
          materialType: it.materialType || 'RAW_MATERIAL',
          itemName: it.itemName,
          rawMaterialId: it.materialType === 'RAW_MATERIAL' ? it.matchedId : undefined,
          packingMaterialId: it.materialType === 'PACKING_MATERIAL' ? it.matchedId : undefined,
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          grossAmount: (Number(it.quantity) || 1) * (Number(it.rate) || 0),
          taxPercent: Number(it.tax) || 0,
          taxAmount: ((Number(it.quantity) || 1) * (Number(it.rate) || 0) * (Number(it.tax) || 0)) / 100,
          discountAmount: Number(it.discount) || 0,
          netAmount: (Number(it.quantity) || 1) * (Number(it.rate) || 0),
        })),
      }));

      const res = await ApiClient.post<any>('/api/v1/purchases/batch', { purchases: payload });
      const count = res.data?.count || datedVouchers.length;
      showToast({
        title: 'Batch Purchases Created',
        message: `Successfully created ${count} individual Purchase Invoices across each delivery date!`,
        type: 'success',
      });
      setIsMultiDateSheet(false);
      setDatedVouchers([]);
      setMode('list');
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Batch Creation Failed',
        message: err?.message || 'Failed to create batch purchases',
        type: 'error',
      });
    } finally {
      setIsPostingBatchPurchases(false);
    }
  };

  // One-Click Auto-Create Master Material from Line Item
  const handleAutoCreateMaterial = async (itemIdx: number) => {
    const item = formItems[itemIdx];
    if (!item || !item.itemName) {
      showToast({ title: 'Validation', message: 'Item name is required', type: 'warning' });
      return;
    }
    try {
      const res = await ApiClient.post<any>('/api/v1/purchases/auto-create-material', {
        materialType: item.materialType === 'PACKING_MATERIAL' ? 'PACKING_MATERIAL' : 'RAW_MATERIAL',
        itemName: item.itemName,
        purchaseRate: item.rate,
      });
      showToast({ title: 'Master Created', message: `${res.data.materialName} added to master data!`, type: 'success' });
      if (item.materialType === 'PACKING_MATERIAL') {
        setPackingMaterials((prev) => [...prev, res.data]);
        updateItem(itemIdx, 'packingMaterialId', res.data.id);
      } else {
        setRawMaterials((prev) => [...prev, res.data]);
        updateItem(itemIdx, 'rawMaterialId', res.data.id);
      }
    } catch (err: any) {
      showToast({ title: 'Creation Error', message: err?.message || 'Failed to auto-create material', type: 'error' });
    }
  };

  // Handle Item Row Calculations
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value } as PurchaseItemRow;

    // Auto fill material name if selected
    if (field === 'rawMaterialId') {
      const rm = rawMaterials.find((m) => m.id === value);
      if (rm) {
        item.itemName = rm.materialName;
        item.rate = Number(rm.lastPurchaseCost || rm.standardCost || 0);
      }
    } else if (field === 'packingMaterialId') {
      const pm = packingMaterials.find((m) => m.id === value);
      if (pm) {
        item.itemName = pm.materialName;
        item.rate = Number(pm.lastPurchaseCost || pm.standardCost || 0);
      }
    }

    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const gross = qty * rate;
    const taxPct = Number(item.taxPercent) || 0;
    const taxAmt = (gross * taxPct) / 100;
    const disc = Number(item.discountAmount) || 0;
    const net = gross + taxAmt - disc;

    item.grossAmount = gross;
    item.taxAmount = taxAmt;
    item.netAmount = net;

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    setFormItems([
      ...formItems,
      {
        materialType: 'RAW_MATERIAL',
        itemName: '',
        quantity: 1,
        rate: 0,
        grossAmount: 0,
        taxPercent: 0,
        taxAmount: 0,
        discountAmount: 0,
        netAmount: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Multi-Warehouse Split Handlers
  const openSplitModal = (index: number) => {
    const item = formItems[index];
    if (!item) return;
    setSplitItemIndex(index);
    const itemQty = Number(item.quantity) || 1;
    const defaultWh = item.warehouseId || formData.warehouseId || warehouses[0]?.id || '';
    setSplitAllocations([
      { warehouseId: defaultWh, quantity: itemQty },
    ]);
    setIsSplitModalOpen(true);
  };

  const addSplitRow = () => {
    const remainingWh = warehouses.find((w) => !splitAllocations.some((a) => a.warehouseId === w.id)) || warehouses[0];
    setSplitAllocations([
      ...splitAllocations,
      { warehouseId: remainingWh?.id || '', quantity: 0 },
    ]);
  };

  const removeSplitRow = (idx: number) => {
    if (splitAllocations.length <= 1) return;
    setSplitAllocations(splitAllocations.filter((_, i) => i !== idx));
  };

  const updateSplitRow = (idx: number, field: 'warehouseId' | 'quantity', val: any) => {
    const updated = [...splitAllocations];
    const prev = updated[idx];
    if (!prev) return;
    if (field === 'quantity') {
      updated[idx] = { warehouseId: prev.warehouseId, quantity: Math.max(0, Number(val) || 0) };
    } else {
      updated[idx] = { warehouseId: String(val || ''), quantity: prev.quantity };
    }
    setSplitAllocations(updated);
  };

  const handleApplySplit = () => {
    if (splitItemIndex === null) return;
    const baseItem = formItems[splitItemIndex];
    if (!baseItem) return;

    const totalAlloc = splitAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
    const targetQty = Number(baseItem.quantity) || 0;
    if (Math.abs(totalAlloc - targetQty) > 0.001) {
      showToast({
        title: 'Allocation Mismatch',
        message: `Total allocated quantity (${totalAlloc}) must match item total (${targetQty})`,
        type: 'warning',
      });
      return;
    }

    const newRows: PurchaseItemRow[] = splitAllocations.map((alloc) => {
      const q = Number(alloc.quantity) || 0;
      const rate = Number(baseItem.rate) || 0;
      const gross = q * rate;
      const taxAmt = (gross * (Number(baseItem.taxPercent) || 0)) / 100;
      const disc = Number(baseItem.discountAmount) || 0;
      return {
        ...baseItem,
        warehouseId: alloc.warehouseId,
        quantity: q,
        grossAmount: gross,
        taxAmount: taxAmt,
        netAmount: gross + taxAmt - disc,
      };
    });

    const updated = [...formItems];
    updated.splice(splitItemIndex, 1, ...newRows);
    setFormItems(updated);
    setIsSplitModalOpen(false);
    setSplitItemIndex(null);
    showToast({
      title: 'Warehouse Split Applied',
      message: `Item split into ${newRows.length} warehouse allocations successfully.`,
      type: 'success',
    });
  };

  // Submit Draft Purchase
  const handleCreatePurchase = async () => {
    if (!formData.vendorId || !formData.warehouseId) {
      showToast({ title: 'Validation Error', message: 'Please select Vendor and Warehouse', type: 'error' });
      return;
    }
    if (formItems.some((i) => !i.itemName || i.quantity <= 0 || i.rate <= 0)) {
      showToast({ title: 'Validation Error', message: 'All items must have valid name, quantity, and rate', type: 'error' });
      return;
    }

    try {
      const payload = {
        ...formData,
        items: formItems.map((i) => ({
          ...i,
          warehouseId: i.warehouseId || formData.warehouseId,
        })),
      };

      await ApiClient.post('/api/v1/purchases', payload);
      showToast({ title: 'Success', message: 'Purchase Invoice created in DRAFT', type: 'success' });
      setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to save purchase', type: 'error' });
    }
  };

  // Open Return Modal with customizable partial return quantities & warehouse routing
  const openReturnModal = (inv: PurchaseInvoiceRecord) => {
    setReturnPurchase(inv);
    setReturnReason('Damaged / Quality specification return');
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      setReturnItems(
        inv.items.map((it: any) => {
          const purchasedQty = Number(it.originalQuantity ?? it.quantity) || 1;
          const returnedQty = Number(it.returnedQuantity) || 0;
          const maxQty = it.remainingQuantity !== undefined ? Number(it.remainingQuantity) : Math.max(0, purchasedQty - returnedQty);
          return {
            materialType: it.materialType === 'PACKING_MATERIAL' ? 'PACKING_MATERIAL' : 'RAW_MATERIAL',
            rawMaterialId: it.rawMaterialId || null,
            packingMaterialId: it.packingMaterialId || null,
            finishedProductId: it.finishedProductId || null,
            warehouseId: it.warehouseId || inv.warehouseId || (warehouses[0]?.id || null),
            itemName: it.itemName,
            quantity: maxQty, // Editable return qty defaults to maximum available
            purchasedQuantity: purchasedQty,
            returnedQuantity: returnedQty,
            maxQuantity: maxQty,
            rate: Number(it.rate) || 0,
            netAmount: maxQty * (Number(it.rate) || 0),
          };
        }),
      );
    } else {
      setReturnItems([
        {
          materialType: 'RAW_MATERIAL',
          itemName: 'Purchased Item',
          quantity: 1,
          purchasedQuantity: 1,
          returnedQuantity: 0,
          maxQuantity: 1,
          warehouseId: inv.warehouseId || (warehouses[0]?.id || null),
          rate: Number(inv.netAmount) || 0,
          netAmount: Number(inv.netAmount) || 0,
        },
      ]);
    }
    setIsReturnModalOpen(true);
  };

  // Update item quantity in return modal
  const updateReturnItemQty = (index: number, qty: number) => {
    const updated = [...returnItems];
    const current = updated[index];
    if (!current) return;
    const max = Number(current.maxQuantity ?? 0);
    const validQty = Math.max(0, Math.min(qty, max));
    const nextItem: PurchaseReturnItemRow = {
      ...current,
      quantity: validQty,
      netAmount: validQty * Number(current.rate || 0),
    };
    updated[index] = nextItem;
    setReturnItems(updated);
  };

  // Update item warehouse in return modal
  const updateReturnItemWarehouse = (index: number, warehouseId: string) => {
    const updated = [...returnItems];
    if (!updated[index]) return;
    updated[index] = { ...updated[index], warehouseId };
    setReturnItems(updated);
  };

  // Confirm and submit Purchase Return
  const handleConfirmReturn = async () => {
    if (!returnPurchase) return;
    const itemsToReturn = returnItems.filter((i) => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      showToast({ title: 'Validation', message: 'Return quantity must be greater than 0', type: 'warning' });
      return;
    }

    setIsSubmittingReturn(true);
    try {
      await ApiClient.post('/api/v1/purchases/returns', {
        purchaseInvoiceId: returnPurchase.id,
        vendorId: returnPurchase.vendorId,
        warehouseId: itemsToReturn[0]?.warehouseId || returnPurchase.warehouseId,
        date: new Date().toISOString(),
        reason: returnReason,
        items: itemsToReturn.map((i) => ({
          materialType: i.materialType,
          rawMaterialId: i.rawMaterialId || undefined,
          packingMaterialId: i.packingMaterialId || undefined,
          finishedProductId: i.finishedProductId || undefined,
          warehouseId: i.warehouseId || undefined,
          itemName: i.itemName,
          quantity: i.quantity,
          rate: i.rate,
          grossAmount: i.netAmount,
          netAmount: i.netAmount,
        })),
      });

      showToast({
        title: 'Return Processed',
        message: `Return recorded for ${returnPurchase.voucherNumber}. Stock decreased from selected warehouse and invoice adjusted.`,
        type: 'success',
      });
      setIsReturnModalOpen(false);
      setReturnPurchase(null);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Return Failed', message: err?.message || 'Failed to submit return', type: 'error' });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Delete Purchase (Atomic reversal of stock movements and vendor ledger credits)
  const handleDeletePurchase = async (inv: PurchaseInvoiceRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete purchase voucher "${inv.voucherNumber}"?\n\nThis will automatically reverse warehouse stock movements and vendor ledger credits, and delete the purchase record.`
    );
    if (!confirmed) return;

    try {
      await ApiClient.delete(`/api/v1/purchases/${inv.id}`);
      showToast({
        title: 'Purchase Deleted',
        message: `Purchase ${inv.voucherNumber} has been deleted and its stock & ledger entries reversed.`,
        type: 'success',
      });
      if (selectedInvoice?.id === inv.id) {
        setMode('list');
        setSelectedInvoice(null);
      }
      loadData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err?.message || 'Failed to delete purchase', type: 'error' });
    }
  };

  const renderReturnModal = () => (
    <Modal
      isOpen={isReturnModalOpen}
      onClose={() => setIsReturnModalOpen(false)}
      title={`Return Purchase — ${returnPurchase?.voucherNumber || ''}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Vendor: </span>
            <strong>{returnPurchase?.vendor?.name || 'Vendor'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Invoice Warehouse: </span>
            <strong>{returnPurchase?.warehouse?.name || 'Warehouse'}</strong>
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', color: '#1e40af' }}>
          💡 <strong>Warehouse Stock Deduction & Quantity:</strong> Select the warehouse from which each item is returned. Stock will be deducted from that warehouse and the purchase invoice value updated.
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Return Reason
          </label>
          <Input
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="e.g. Damaged packing / Quality rejection / Excess supply"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            Items to Return & Source Warehouse
          </label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle, #e2e8f0)', textAlign: 'left', background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '8px' }}>Item Name</th>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px', minWidth: '160px' }}>Return From Warehouse</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Purchased</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Already Ret.</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Available</th>
                  <th style={{ padding: '8px', width: '150px', textAlign: 'center' }}>Return Qty</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Unit Rate</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Credit Total</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{item.itemName}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>{item.materialType}</td>
                    <td style={{ padding: '8px' }}>
                      <select
                        value={item.warehouseId || ''}
                        onChange={(e) => updateReturnItemWarehouse(idx, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle, #cbd5e1)',
                          background: 'var(--bg-surface, #fff)',
                        }}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.code ? `(${w.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{item.purchasedQuantity ?? item.maxQuantity}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#e11d48' }}>{item.returnedQuantity ?? 0}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>{item.maxQuantity}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <Input
                          type="number"
                          min="0"
                          max={item.maxQuantity}
                          value={item.quantity}
                          onChange={(e) => updateReturnItemQty(idx, Number(e.target.value))}
                          style={{ width: '70px', padding: '4px 6px', textAlign: 'right' }}
                        />
                        <button
                          type="button"
                          onClick={() => updateReturnItemQty(idx, item.maxQuantity)}
                          style={{ padding: '2px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                          title="Return all available"
                        >
                          ALL
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReturnItemQty(idx, 0)}
                          style={{ padding: '2px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                          title="Return zero"
                        >
                          0
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>PKR {item.rate.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: item.quantity > 0 ? '#0284c7' : 'inherit' }}>
                      PKR {item.netAmount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            Total Return Credit: <span style={{ color: 'var(--brand-primary, #0284c7)' }}>PKR {returnItems.reduce((s, i) => s + i.netAmount, 0).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setIsReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReturn}
              disabled={isSubmittingReturn || returnItems.every((i) => i.quantity <= 0)}
            >
              {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );

  // Multi-Warehouse Split Modal
  const renderSplitModal = () => {
    if (!isSplitModalOpen || splitItemIndex === null) return null;
    const item = formItems[splitItemIndex];
    if (!item) return null;

    const targetQty = Number(item.quantity) || 0;
    const totalAllocated = splitAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
    const diff = targetQty - totalAllocated;
    const isBalanced = Math.abs(diff) < 0.001;

    return (
      <Modal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        title={`Split Item Across Warehouses: ${item.itemName || 'Material'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e3a8a' }}>
            Allocate the total <strong>{targetQty}</strong> units into multiple target warehouses (e.g. 50 in WH-A, 100 in WH-B, 50 in WH-C). Each portion will be saved into its respective warehouse stock ledger.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Warehouse Allocations</span>
            <Button size="sm" variant="secondary" onClick={addSplitRow}>
              + Add Warehouse
            </Button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Destination Warehouse</th>
                <th style={{ padding: '8px', width: '140px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '8px', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {splitAllocations.map((alloc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px' }}>
                    <Select
                      value={alloc.warehouseId}
                      onChange={(e) => updateSplitRow(idx, 'warehouseId', e.target.value)}
                      options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <Input
                      type="number"
                      min="1"
                      value={alloc.quantity}
                      onChange={(e) => updateSplitRow(idx, 'quantity', Number(e.target.value))}
                      style={{ textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {splitAllocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <IconTrash size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Allocation balance banner */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: isBalanced ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${isBalanced ? '#bbf7d0' : '#fde68a'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 600,
              color: isBalanced ? '#166534' : '#92400e',
            }}
          >
            <span>Allocated: {totalAllocated} / {targetQty} units</span>
            <span>{isBalanced ? '✅ Perfectly Balanced' : `⚠️ ${diff > 0 ? `Need +${diff} more` : `Exceeds by ${-diff}`}`}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setIsSplitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApplySplit} disabled={!isBalanced || totalAllocated <= 0}>
              Apply Warehouse Split
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  // Filtered list
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.voucherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.postingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalPurchases = invoices.length;
  const postedPurchases = invoices.filter((i) => i.postingStatus === 'POSTED').length;
  const draftPurchases = invoices.filter((i) => i.postingStatus === 'DRAFT').length;
  const totalSpend = invoices
    .filter((i) => i.postingStatus === 'POSTED')
    .reduce((sum, i) => sum + Number(i.netAmount || 0), 0);

  // Table Columns
  const columns: ColumnDef<PurchaseInvoiceRecord>[] = [
    {
      key: 'voucherNumber',
      header: 'Voucher #',
      render: (inv) => (
        <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{inv.voucherNumber}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (inv) => new Date(inv.date).toLocaleDateString(),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (inv) => inv.vendor?.name || 'Unknown',
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (inv) => inv.warehouse?.name || 'General',
    },
    {
      key: 'netAmount',
      header: 'Net Total',
      render: (inv: any) => {
        const hasReturns = Number(inv.totalReturnedAmount || 0) > 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>
              PKR {Number(inv.netAmount || 0).toLocaleString()}
            </span>
            {hasReturns && (
              <span style={{ fontSize: '11px', color: '#e11d48', fontWeight: 500 }}>
                -PKR {Number(inv.totalReturnedAmount).toLocaleString()} returned
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'postingStatus',
      header: 'Status',
      render: (inv) => {
        const variant =
          inv.postingStatus === 'POSTED'
            ? 'success'
            : inv.postingStatus === 'PARTIALLY_RETURNED'
            ? 'warning'
            : inv.postingStatus === 'RETURNED'
            ? 'danger'
            : inv.postingStatus === 'REVIEWED'
            ? 'info'
            : 'default';
        return <StatusBadge status={inv.postingStatus} variant={variant as any} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (inv) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedInvoice(inv);
              setMode('detail');
            }}
          >
            <IconEye size={15} /> View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openReturnModal(inv)}
            title="Return items from this purchase"
          >
            <IconRotateCcw size={15} /> Return
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePurchase(inv)}
            title="Delete purchase voucher"
            style={{ color: '#ef4444' }}
          >
            <IconTrash size={15} /> Delete
          </Button>
        </div>
      ),
    },
  ];

  // Return Invoices (Debit Notes) Table Columns
  const returnColumns: ColumnDef<any>[] = [
    {
      key: 'voucherNumber',
      header: 'Return Voucher #',
      render: (ret) => (
        <span style={{ fontWeight: 600, color: '#e11d48' }}>{ret.voucherNumber}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (ret) => new Date(ret.date || ret.createdAt).toLocaleDateString(),
    },
    {
      key: 'purchaseInvoice',
      header: 'Original Purchase',
      render: (ret) => (
        ret.purchaseInvoice?.voucherNumber ? (
          <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
            {ret.purchaseInvoice.voucherNumber}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Direct Return</span>
        )
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (ret) => ret.vendor?.name || 'Unknown',
    },
    {
      key: 'warehouse',
      header: 'Source Warehouse',
      render: (ret) => ret.warehouse?.name || 'Unknown',
    },
    {
      key: 'items',
      header: 'Items Returned',
      render: (ret) => (
        <span style={{ fontSize: '12px' }}>
          {(ret.items || []).map((i: any) => `${i.itemName} (${i.quantity})`).join(', ') || 'Items'}
        </span>
      ),
    },
    {
      key: 'netAmount',
      header: 'Credit Refund',
      render: (ret) => (
        <span style={{ fontWeight: 700, color: '#e11d48' }}>
          -PKR {Number(ret.netAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (ret) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {ret.reason || 'Damaged / Quality Return'}
        </span>
      ),
    },
    {
      key: 'postingStatus',
      header: 'Status',
      render: (ret) => <StatusBadge status={ret.postingStatus || 'POSTED'} variant="danger" />,
    },
  ];

  if (mode === 'create') {
    const totalGross = formItems.reduce((sum, i) => sum + i.grossAmount, 0);
    const totalTax = formItems.reduce((sum, i) => sum + i.taxAmount, 0);
    const totalNet = formItems.reduce((sum, i) => sum + i.netAmount, 0);

    return (
      <FormPageTemplate
        title="Direct Purchase Invoice"
        subtitle="Record raw materials, packing supplies, or finished goods received into warehouse."
        breadcrumbs={[{ label: 'Purchases', onClick: () => setMode('list') }, { label: 'New Invoice' }]}
        onCancel={() => setMode('list')}
        onSubmit={handleCreatePurchase}
        submitLabel="Save Purchase Draft"
      >
        {/* Multi-Date Weekly Procurement Sheet Detected Banner */}
        {isMultiDateSheet && datedVouchers.length > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '18px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#047857',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    📅 Multi-Date Weekly Procurement Sheet Detected
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                    }}
                  >
                    {datedVouchers.length} Distinct Delivery Dates
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>
                  This supplier statement contains deliveries across multiple dates. You can post separate purchase invoices for each date with 1 click or inspect individual date vouchers below.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateAllDatedPurchases}
                disabled={isPostingBatchPurchases}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  fontWeight: 700,
                }}
              >
                {isPostingBatchPurchases ? 'Posting Batch Purchases...' : `⚡ 1-Click Post All (${datedVouchers.length}) Dated Invoices`}
              </Button>
            </div>

            {/* Segmented Date Voucher Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleSelectDatedVoucher(-1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: selectedDatedVoucherIdx === -1 ? '1px solid #059669' : '1px solid #cbd5e1',
                  backgroundColor: selectedDatedVoucherIdx === -1 ? '#059669' : '#ffffff',
                  color: selectedDatedVoucherIdx === -1 ? '#ffffff' : '#334155',
                }}
              >
                All Items Combined ({datedVouchers.reduce((s, v) => s + v.items.length, 0)})
              </button>

              {datedVouchers.map((dv, idx) => {
                const isSelected = selectedDatedVoucherIdx === idx;
                return (
                  <button
                    key={dv.date + idx}
                    type="button"
                    onClick={() => handleSelectDatedVoucher(idx)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                      color: isSelected ? '#065f46' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <strong style={{ color: isSelected ? '#047857' : '#0f172a' }}>{dv.date}</strong>
                    <span style={{ fontSize: '11px', color: isSelected ? '#059669' : '#64748b' }}>
                      ({dv.items.length} items &bull; PKR {Number(dv.totalAmount || 0).toLocaleString()})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>Invoice Header</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Select
                label="Vendor *"
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                options={[
                  { label: 'Select Vendor...', value: '' },
                  ...vendors.map((v) => ({ label: `${v.code} - ${v.name}`, value: v.id })),
                ]}
              />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500 }}>Receiving Warehouse *</label>
                  <button
                    type="button"
                    onClick={() => setIsAddWhModalOpen(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    + Add Warehouse
                  </button>
                </div>
                <Select
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  options={[
                    { label: 'Select Warehouse...', value: '' },
                    ...warehouses.map((w) => ({ label: w.name, value: w.id })),
                  ]}
                />
              </div>
              <Input
                label="Invoice Date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              <Input
                label="Vendor Invoice Ref"
                placeholder="e.g. INV-9042"
                value={formData.vendorInvoiceNo}
                onChange={(e) => setFormData({ ...formData, vendorInvoiceNo: e.target.value })}
              />
              <Input
                label="Delivery / Gate Pass Ref"
                placeholder="e.g. GP-2026-081"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
              <Input
                label="Notes / Bilty #"
                placeholder="Optional delivery notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Purchased Items</CardTitle>
              <Button variant="secondary" size="sm" onClick={addItemRow}>
                <IconPlus size={16} /> Add Material Row
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {formItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 180px 150px 75px 85px 70px 100px 90px',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Select
                    label={idx === 0 ? 'Type' : ''}
                    value={item.materialType}
                    onChange={(e) => updateItem(idx, 'materialType', e.target.value)}
                    options={[
                      { label: 'Raw Material', value: 'RAW_MATERIAL' },
                      { label: 'Packing Material', value: 'PACKING_MATERIAL' },
                    ]}
                  />

                  <div>
                    {item.materialType === 'RAW_MATERIAL' ? (
                      <Select
                        label={idx === 0 ? 'Material' : ''}
                        value={item.rawMaterialId || ''}
                        onChange={(e) => updateItem(idx, 'rawMaterialId', e.target.value)}
                        options={[
                          { label: item.itemName ? `${item.itemName} (Custom/Unlinked)` : 'Select Material...', value: '' },
                          ...rawMaterials.map((m) => ({ label: m.materialName, value: m.id })),
                        ]}
                      />
                    ) : (
                      <Select
                        label={idx === 0 ? 'Material' : ''}
                        value={item.packingMaterialId || ''}
                        onChange={(e) => updateItem(idx, 'packingMaterialId', e.target.value)}
                        options={[
                          { label: item.itemName ? `${item.itemName} (Custom/Unlinked)` : 'Select Packing...', value: '' },
                          ...packingMaterials.map((m) => ({ label: m.materialName, value: m.id })),
                        ]}
                      />
                    )}
                    {!item.rawMaterialId && !item.packingMaterialId && item.itemName && (
                      <button
                        type="button"
                        onClick={() => handleAutoCreateMaterial(idx)}
                        style={{
                          marginTop: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + Auto-Create in Master Data
                      </button>
                    )}
                  </div>

                  <Select
                    label={idx === 0 ? 'Destination WH' : ''}
                    value={item.warehouseId || formData.warehouseId}
                    onChange={(e) => updateItem(idx, 'warehouseId', e.target.value)}
                    options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
                  />

                  <Input
                    label={idx === 0 ? 'Qty' : ''}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />

                  <Input
                    label={idx === 0 ? 'Rate (PKR)' : ''}
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                  />

                  <Input
                    label={idx === 0 ? 'Tax %' : ''}
                    type="number"
                    min="0"
                    value={item.taxPercent}
                    onChange={(e) => updateItem(idx, 'taxPercent', e.target.value)}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {idx === 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Amount</span>}
                    <span style={{ fontWeight: 600, marginTop: idx === 0 ? '4px' : '0', fontSize: '13px' }}>
                      PKR {item.netAmount.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: idx === 0 ? '18px' : '0' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openSplitModal(idx)}
                      title="Split this quantity across multiple warehouses (e.g. 50 in WH-A, 100 in WH-B, 50 in WH-C)"
                      style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#0284c7' }}
                    >
                      ⚡ Split
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItemRow(idx)}
                      style={{ padding: '4px' }}
                    >
                      <IconTrash size={16} color="var(--color-danger)" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gross Amount:</span>
                  <span>PKR {totalGross.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sales Tax:</span>
                  <span>PKR {totalTax.toLocaleString()}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: 'var(--brand-primary)',
                    paddingTop: '8px',
                    borderTop: '2px solid var(--border-subtle)',
                  }}
                >
                  <span>Net Payable:</span>
                  <span>PKR {totalNet.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {renderSplitModal()}
      </FormPageTemplate>
    );
  }

  if (mode === 'detail' && selectedInvoice) {
    return (
      <DetailPageTemplate
        title={`Purchase Voucher ${selectedInvoice.voucherNumber}`}
        subtitle={`Vendor: ${selectedInvoice.vendor?.name} | Warehouse: ${selectedInvoice.warehouse?.name}`}
        breadcrumbs={[{ label: 'Purchases', onClick: () => setMode('list') }, { label: selectedInvoice.voucherNumber }]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setMode('list')}>
              Back to List
            </Button>
            <Button
              variant="secondary"
              onClick={() => openReturnModal(selectedInvoice)}
            >
              <IconRotateCcw size={15} /> Return Purchase
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDeletePurchase(selectedInvoice)}
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
            >
              <IconTrash size={15} /> Delete Purchase
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <Card>
            <CardHeader>
              <CardTitle>Line Items Received</CardTitle>
            </CardHeader>
            <CardContent>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Item</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Purchased</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Returned</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Active Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Active Net Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items || []).map((item: any, idx) => {
                    const origQty = item.originalQuantity ?? item.quantity;
                    const retQty = item.returnedQuantity ?? 0;
                    const actQty = item.quantity;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 500 }}>{item.itemName}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {item.materialType}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>{origQty}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#e11d48' }}>{retQty}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{actQty}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>PKR {Number(item.rate).toLocaleString()}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>
                          PKR {Number(item.netAmount).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gross Total:</span>
                    <span>PKR {Number(selectedInvoice.grossAmount || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sales Tax:</span>
                    <span>PKR {Number(selectedInvoice.taxAmount || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>PKR {Number(selectedInvoice.discountAmount || 0).toLocaleString()}</span>
                  </div>
                  {Number(selectedInvoice.totalReturnedAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 600 }}>
                      <span>Deducted Returns:</span>
                      <span>-PKR {Number(selectedInvoice.totalReturnedAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: '18px',
                      color: 'var(--brand-primary)',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span>Net Active Value:</span>
                    <span>PKR {Number(selectedInvoice.netAmount || 0).toLocaleString()}</span>
                  </div>

                  <div
                    style={{
                      marginTop: '20px',
                      padding: '12px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                    }}
                  >
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>Canonical Ledger State</p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Stock adjusted in warehouse inventory and vendor ledger debit/credit synced.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {Array.isArray(selectedInvoice.purchaseReturns) && selectedInvoice.purchaseReturns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: '#e11d48' }}>Linked Return Invoices (Debit Notes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedInvoice.purchaseReturns.map((ret: any) => (
                      <div
                        key={ret.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          backgroundColor: '#fff1f2',
                          borderRadius: '8px',
                          border: '1px solid #fecdd3',
                          fontSize: '13px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#be123c' }}>{ret.voucherNumber}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {new Date(ret.date || ret.createdAt).toLocaleDateString()} — {ret.reason || 'Return'}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#be123c' }}>
                          -PKR {Number(ret.netAmount).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        {renderReturnModal()}
      </DetailPageTemplate>
    );
  }

  return (
    <ListPageTemplate
      title="Purchase Invoices (Direct Buy)"
      subtitle="The authoritative single source of truth for vendor material receipts and payables."
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUploadInvoiceOcr}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isOcrLoading}
          >
            <IconPlus size={16} /> {isOcrLoading ? 'Reading Invoice...' : 'Upload Invoice / Gate Pass (OCR)'}
          </Button>
          <Button variant="primary" onClick={() => setMode('create')}>
            <IconPlus size={16} /> New Purchase Invoice
          </Button>
        </div>
      }
    >
      {/* Spend KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Purchases"
          value={totalPurchases}
          subtitle="All recorded vouchers"
        />
        <KpiCard
          title="Posted & In Stock"
          value={postedPurchases}
          subtitle="Stock & ledger updated"
        />
        <KpiCard
          title="Pending Drafts"
          value={draftPurchases}
          subtitle="Awaiting warehouse check"
        />
        <KpiCard
          title="Total Material Spend"
          value={`PKR ${(totalSpend / 1000000).toFixed(2)}M`}
          subtitle="Authoritative posted spend"
        />
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by voucher # or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'POSTED', value: 'POSTED' },
            { label: 'PARTIALLY_RETURNED', value: 'PARTIALLY_RETURNED' },
            { label: 'RETURNED', value: 'RETURNED' },
            { label: 'DRAFT', value: 'DRAFT' },
            { label: 'REVIEWED', value: 'REVIEWED' },
          ]}
        />
      </div>

      {/* Tabs Switcher: Purchase Invoices vs Return Invoices */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          style={{
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            borderBottom: activeTab === 'purchases' ? '2px solid var(--brand-primary, #0284c7)' : '2px solid transparent',
            color: activeTab === 'purchases' ? 'var(--brand-primary, #0284c7)' : 'var(--text-secondary, #64748b)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Purchase Invoices ({filteredInvoices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          style={{
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            borderBottom: activeTab === 'returns' ? '2px solid #e11d48' : '2px solid transparent',
            color: activeTab === 'returns' ? '#e11d48' : 'var(--text-secondary, #64748b)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Return Invoices / Debit Notes ({returnsList.length})
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : activeTab === 'purchases' ? (
        filteredInvoices.length === 0 ? (
          <EmptyState
            title="No Purchase Invoices Found"
            description="Create your first purchase invoice to record materials and update warehouse stock."
            actionLabel="Create Purchase Invoice"
            onAction={() => setMode('create')}
          />
        ) : (
          <DataTable columns={columns} data={filteredInvoices} />
        )
      ) : (
        returnsList.length === 0 ? (
          <EmptyState
            title="No Return Invoices Found"
            description="No purchase returns have been processed yet. You can return items from any posted purchase invoice."
          />
        ) : (
          <DataTable
            columns={returnColumns}
            data={returnsList.filter(
              (r) =>
                !searchQuery ||
                r.voucherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.purchaseInvoice?.voucherNumber?.toLowerCase().includes(searchQuery.toLowerCase()),
            )}
          />
        )
      )}

      {/* Inline Quick Add Warehouse Modal */}
      <Modal
        isOpen={isAddWhModalOpen}
        onClose={() => setIsAddWhModalOpen(false)}
        title="Quick Add Warehouse"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Create a warehouse on the fly without losing any entered invoice items or OCR document data.
          </p>
          <Input
            label="Warehouse Name *"
            placeholder="e.g. Raw Material Storage Bay 4"
            value={newWhName}
            onChange={(e) => setNewWhName(e.target.value)}
          />
          <Input
            label="Location / Address"
            placeholder="e.g. Factory Site North Gate"
            value={newWhLocation}
            onChange={(e) => setNewWhLocation(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setIsAddWhModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleQuickCreateWh} disabled={isCreatingWh}>
              {isCreatingWh ? 'Creating...' : 'Create & Select Warehouse'}
            </Button>
          </div>
        </div>
      </Modal>

      {renderReturnModal()}
    </ListPageTemplate>
  );
};
