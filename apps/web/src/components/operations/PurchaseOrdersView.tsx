'use client';

/**
 * SHEHSWAR ONE360 - Purchase Order Management
 *
 * Implements Canonical Flow:
 * - [Upload Purchase Order] (Primary simple OCR option)
 * - [Create Manually]
 * - OCR reads PO -> Extract fields -> Review Screen -> Save structured DB record
 * - Statuses: DRAFT, CONFIRMED, CONVERTED_TO_PURCHASE, CANCELLED
 * - Action: "Create Purchase" -> Seamlessly transfers data into Purchase Form
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  StatusBadge,
  KpiCard,
  TableSkeleton,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../ui';
import { IconPlus, IconRefresh, IconCheck, IconClose, IconTrash, IconEye, IconFileText, IconArrowLeft } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface PurchaseOrderItemRow {
  materialId?: string;
  materialType?: string;
  itemName: string;
  packing?: string;
  unit?: string;
  quantity: number;
  unitRate: number;
  taxAmount?: number;
  discountAmount?: number;
  lineTotal?: number;
  warehouseId?: string;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  poDate?: string;
  createdAt: string;
  vendorId: string;
  vendor?: { id: string; name: string; code: string };
  companyId: string;
  warehouseId?: string;
  warehouse?: { id: string; name: string; code: string };
  expectedDeliveryDate?: string;
  totalAmount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'CONVERTED_TO_PURCHASE' | 'CANCELLED';
  notes?: string;
  items: PurchaseOrderItemRow[];
}

interface PurchaseOrdersViewProps {
  onConvertToPurchase?: (poData: any) => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ onConvertToPurchase: _onConvertToPurchase }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mode: 'list' | 'create_manual' | 'ocr_review' | 'detail'
  const [mode, setMode] = useState<'list' | 'create_manual' | 'ocr_review' | 'detail'>('list');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);

  // Form State
  const [formPoNumber, setFormPoNumber] = useState<string>('');
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formWarehouseId, setFormWarehouseId] = useState<string>('');
  const [formExpectedDate, setFormExpectedDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<PurchaseOrderItemRow[]>([
    { itemName: '', materialType: 'RAW_MATERIAL', packing: 'Bulk', unit: 'KG', quantity: 1, unitRate: 0, lineTotal: 0 },
  ]);

  // Multi-Warehouse Split Modal State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitSource, setSplitSource] = useState<'form' | 'verify'>('form');
  const [splitItemIndex, setSplitItemIndex] = useState<number>(-1);
  const [splitAllocations, setSplitAllocations] = useState<Array<{ warehouseId: string; quantity: number }>>([]);

  // Verify & Create Purchase Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [verifyVendorId, setVerifyVendorId] = useState<string>('');
  const [verifyWarehouseId, setVerifyWarehouseId] = useState<string>('');
  const [verifyPoNumber, setVerifyPoNumber] = useState<string>('');
  const [verifyItems, setVerifyItems] = useState<PurchaseOrderItemRow[]>([]);
  const [isCreatingPurchase, setIsCreatingPurchase] = useState<boolean>(false);

  // OCR Uploading State
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [ocrFileName, setOcrFileName] = useState<string>('');
  const [extractedVendorRaw, setExtractedVendorRaw] = useState<string>('');
  const [extractedExtraFields, setExtractedExtraFields] = useState<Record<string, any>>({});
  const [isMultiDateSheet, setIsMultiDateSheet] = useState<boolean>(false);
  const [datedVouchers, setDatedVouchers] = useState<Array<{
    date: string;
    voucherNumber?: string;
    items: any[];
    totalAmount: number;
  }>>([]);
  const [selectedDatedVoucherIdx, setSelectedDatedVoucherIdx] = useState<number>(-1);
  const [isPostingBatchPos, setIsPostingBatchPos] = useState<boolean>(false);

  // Quick Add Vendor Modal State
  const [isQuickVendorModalOpen, setIsQuickVendorModalOpen] = useState<boolean>(false);
  const [newVendorName, setNewVendorName] = useState<string>('');
  const [newVendorType, setNewVendorType] = useState<string>('RAW_MATERIAL');
  const [newVendorPhone, setNewVendorPhone] = useState<string>('');
  const [newVendorEmail, setNewVendorEmail] = useState<string>('');
  const [newVendorAddress, setNewVendorAddress] = useState<string>('');
  const [isSubmittingVendor, setIsSubmittingVendor] = useState<boolean>(false);

  // Quick Add Material / Product Modal State
  const [isQuickMaterialModalOpen, setIsQuickMaterialModalOpen] = useState<boolean>(false);
  const [targetItemIndexForMat, setTargetItemIndexForMat] = useState<number>(-1);
  const [newMatName, setNewMatName] = useState<string>('');
  const [newMatType, setNewMatType] = useState<'RAW_MATERIAL' | 'PACKING_MATERIAL'>('RAW_MATERIAL');
  const [newMatUnit, setNewMatUnit] = useState<string>('KG');
  const [newMatPacking, setNewMatPacking] = useState<string>('Bulk');
  const [newMatRate, setNewMatRate] = useState<number>(0);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState<boolean>(false);

  // Auto-generate next sequential PO Number
  const fetchNextPoNumber = useCallback(async (): Promise<string> => {
    try {
      const res = await ApiClient.get<{ nextNumber: string }>('/api/v1/operations/purchase-orders/next-number');
      const num = res.data?.nextNumber;
      if (num && typeof num === 'string') {
        setFormPoNumber(num);
        return num;
      }
    } catch (e) {
      console.error('Failed to get sequential PO number', e);
    }
    const fallback = `PO-${new Date().getFullYear()}-000001`;
    setFormPoNumber(fallback);
    return fallback;
  }, []);

  // Quick create and immediately select vendor
  const handleQuickCreateVendor = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newVendorName.trim()) {
      showToast({ title: 'Validation', message: 'Vendor name is required', type: 'warning' });
      return;
    }
    setIsSubmittingVendor(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/operations/purchase-orders/quick-create-vendor', {
        name: newVendorName.trim(),
        vendorType: newVendorType,
        phone: newVendorPhone.trim() || undefined,
        email: newVendorEmail.trim() || undefined,
        address: newVendorAddress.trim() || undefined,
      });
      const created = res.data?.data || res.data;
      if (created && created.id) {
        setVendors((prev) => {
          if (prev.some((v) => v.id === created.id)) return prev;
          return [created, ...prev];
        });
        setFormVendorId(created.id);
        setVerifyVendorId(created.id);
        showToast({
          title: 'Vendor Created',
          message: `"${created.name}" saved in Vendor Master and selected!`,
          type: 'success',
        });
        setIsQuickVendorModalOpen(false);
        setNewVendorName('');
        setNewVendorPhone('');
        setNewVendorEmail('');
        setNewVendorAddress('');
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to create vendor', type: 'error' });
    } finally {
      setIsSubmittingVendor(false);
    }
  };

  // Quick create product/material and link to line item
  const handleQuickCreateMaterial = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newMatName.trim()) {
      showToast({ title: 'Validation', message: 'Product / Material name is required', type: 'warning' });
      return;
    }
    setIsSubmittingMaterial(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/operations/purchase-orders/quick-create-material', {
        itemName: newMatName.trim(),
        materialType: newMatType,
        unit: newMatUnit,
        packing: newMatPacking,
        purchaseRate: Number(newMatRate) || 0,
      });
      const created = res.data?.data || res.data;
      if (created && created.id) {
        if (newMatType === 'PACKING_MATERIAL') {
          setPackingMaterials((prev) => [created, ...prev]);
        } else {
          setRawMaterials((prev) => [created, ...prev]);
        }

        if (targetItemIndexForMat >= 0 && targetItemIndexForMat < formItems.length) {
          const updated = [...formItems];
          const cur = updated[targetItemIndexForMat];
          if (cur) {
            const qty = Number(cur.quantity) || 1;
            const rate = Number(newMatRate) || cur.unitRate || 0;
            updated[targetItemIndexForMat] = {
              ...cur,
              quantity: qty,
              materialId: created.id,
              materialType: newMatType,
              itemName: created.materialName,
              unit: newMatUnit,
              packing: newMatPacking,
              unitRate: rate,
              lineTotal: qty * rate,
            };
            setFormItems(updated);
          }
        } else {
          setFormItems([
            ...formItems,
            {
              materialId: created.id,
              materialType: newMatType,
              itemName: created.materialName,
              unit: newMatUnit,
              packing: newMatPacking,
              quantity: 1,
              unitRate: Number(newMatRate) || 0,
              lineTotal: Number(newMatRate) || 0,
            },
          ]);
        }

        showToast({
          title: 'Product Saved to Master',
          message: `"${created.materialName}" successfully registered in Master Data & added to PO!`,
          type: 'success',
        });
        setIsQuickMaterialModalOpen(false);
        setNewMatName('');
        setNewMatRate(0);
        setTargetItemIndexForMat(-1);
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save product', type: 'error' });
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  // Robust normalizers for vendors and materials
  const normalizeVendor = (v: any) => ({
    id: v.id,
    code: v.code || '',
    name: v.name || v.legalName || 'Unnamed Vendor',
    vendorType: v.vendorType || 'RAW_MATERIAL',
    category: v.category || '',
    phone: v.phone || '',
    email: v.email || '',
  });

  const normalizeMaterial = (m: any) => ({
    id: m.id,
    materialCode: m.materialCode || m.code || '',
    materialName: m.materialName || m.name || 'Unnamed Material',
    standardCost: Number(m.standardCost) || 0,
    lastPurchaseCost: Number(m.lastPurchaseCost) || 0,
    specifications: m.specifications || m.description || m.bulkPacking || '',
    unit: m.baseUom?.symbol || m.baseUom?.code || m.uom?.symbol || m.uom?.code || m.unit || '',
  });

  // Robust array unpacker for API responses
  const unpackArray = (res: any): any[] => {
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

  // Load Master Data & Orders with independent resilience (Promise.allSettled)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        ApiClient.get<any>('/api/v1/operations/purchase-orders'),
        ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000'),
        ApiClient.get<any>('/api/v1/master-data/warehouses'),
        ApiClient.get<any>('/api/v1/master-data/raw-materials?all=true'),
        ApiClient.get<any>('/api/v1/master-data/packing-materials?all=true'),
      ]);

      const poList = results[0].status === 'fulfilled' ? unpackArray(results[0].value) : [];
      const vList = results[1].status === 'fulfilled' ? unpackArray(results[1].value).map(normalizeVendor) : [];
      const whList = results[2].status === 'fulfilled' ? unpackArray(results[2].value) : [];
      const rmList = results[3].status === 'fulfilled' ? unpackArray(results[3].value).map(normalizeMaterial) : [];
      const pmList = results[4].status === 'fulfilled' ? unpackArray(results[4].value).map(normalizeMaterial) : [];

      setOrders(poList);
      setVendors(vList);
      setWarehouses(whList);
      setRawMaterials(rmList);
      setPackingMaterials(pmList);

      setFormVendorId((current) => current || (vList.length > 0 ? (vList[0]?.id || '') : ''));
      setFormWarehouseId((current) => current || (whList.length > 0 ? (whList[0]?.id || '') : ''));
    } catch (err: any) {
      console.error('Failed to load purchase orders & master data:', err);
      showToast({ title: 'Error', message: 'Failed to load purchase orders & master data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle OCR File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrFileName(file.name);
    setIsOcrProcessing(true);
    showToast({ title: 'Processing Document', message: `Reading and extracting ${file.name}...`, type: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'PURCHASE_ORDER');

      // If text/csv file, also supply rawTextHint
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        try {
          const text = await file.text();
          formData.append('rawTextHint', text);
        } catch {
          // ignore
        }
      }

      const res = await ApiClient.uploadFile<any>('/api/v1/operations/ocr/upload', formData);

      const extracted = res.data?.extractedFields || {};
      const matchedVendor = res.data?.matchedVendor;
      const matchedWarehouse = res.data?.matchedWarehouse;
      const matchedItems = res.data?.matchedItems || [];
      const extra = extracted.extraFields || {};
      setExtractedExtraFields(extra);

      const isMulti = !!res.data?.isMultiDateSheet;
      const dVouchers = res.data?.datedVouchers || [];
      setIsMultiDateSheet(isMulti);
      setDatedVouchers(dVouchers);
      setSelectedDatedVoucherIdx(-1);

      if (extracted.vendor) {
        setExtractedVendorRaw(extracted.vendor);
      } else if (matchedVendor?.name) {
        setExtractedVendorRaw(matchedVendor.name);
      }

      // Populate form state for review screen (Auto-sequential fallback if doc has no explicit PO)
      let extractedPo = extracted.poNumber || extracted.docNumber;
      if (!extractedPo || extractedPo.startsWith('PO-TEMP') || extractedPo === 'AUTO') {
        extractedPo = await fetchNextPoNumber();
      }
      setFormPoNumber(extractedPo);

      if (matchedVendor?.id) {
        setVendors((prev: any[]) => {
          if (!prev.some((v: any) => v.id === matchedVendor.id)) {
            return [matchedVendor, ...prev];
          }
          return prev;
        });
        setFormVendorId(matchedVendor.id);
      } else if (extracted.vendorId) {
        setFormVendorId(extracted.vendorId);
      } else if (extracted.vendor && vendors.length > 0) {
        const norm = String(extracted.vendor).toLowerCase();
        const vMatch = vendors.find((v: any) => v.name.toLowerCase().includes(norm) || norm.includes(v.name.toLowerCase()));
        if (vMatch) setFormVendorId(vMatch.id);
        else setFormVendorId(vendors[0].id);
      } else if (vendors.length > 0) {
        setFormVendorId(vendors[0].id);
      }

      // Re-sync master data in background so dropdowns contain newly auto-registered vendor and materials
      ApiClient.get<any>('/api/v1/procurement/vendors?limit=1000').then((vRes) => {
        const list = unpackArray(vRes).map(normalizeVendor);
        if (list.length > 0) setVendors(list);
      }).catch(() => null);

      ApiClient.get<any>('/api/v1/master-data/raw-materials?all=true').then((rmRes) => {
        const list = unpackArray(rmRes).map(normalizeMaterial);
        if (list.length > 0) setRawMaterials(list);
      }).catch(() => null);

      ApiClient.get<any>('/api/v1/master-data/packing-materials?all=true').then((pmRes) => {
        const list = unpackArray(pmRes).map(normalizeMaterial);
        if (list.length > 0) setPackingMaterials(list);
      }).catch(() => null);

      if (matchedWarehouse?.id) {
        setWarehouses((prev: any[]) => {
          if (!prev.some((w: any) => w.id === matchedWarehouse.id)) {
            return [matchedWarehouse, ...prev];
          }
          return prev;
        });
        setFormWarehouseId(matchedWarehouse.id);
      } else if (warehouses.length > 0) {
        setFormWarehouseId(warehouses[0].id);
      }

      setFormExpectedDate(extracted.expectedDeliveryDate || '');
      setFormNotes(extracted.notes || `Extracted from ${file.name}`);

      // Sanitize items: exclude PostScript structure tokens like /Parent, /F1, /Contents
      const validItems = (matchedItems || []).filter((m: any) => {
        const name = (m.itemName || '').trim();
        if (!name) return false;
        if (name.startsWith('/') || /^(?:obj|endobj|stream|trailer|xref)/i.test(name)) return false;
        return true;
      });

      if (validItems.length > 0) {
        setFormItems(
          validItems.map((m: any) => ({
            materialId: m.matchedId,
            materialType: m.materialType || 'RAW_MATERIAL',
            itemName: m.itemName,
            packing: m.packing || 'Bulk',
            unit: m.uom || 'KG',
            quantity: Number(m.quantity) || 1,
            unitRate: Number(m.rate) || 0,
            lineTotal: (Number(m.quantity) || 1) * (Number(m.rate) || 0),
          })),
        );
      } else {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setFormItems([
          { itemName: cleanName || 'Purchased Material', materialType: 'RAW_MATERIAL', packing: 'Bulk', unit: 'KG', quantity: 1, unitRate: 0, lineTotal: 0 }
        ]);
      }

      setMode('ocr_review');
      showToast({ title: 'Extraction Complete', message: `Extracted data from ${file.name}. Review and verify below.`, type: 'success' });
    } catch (err: any) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const nextSeq = await fetchNextPoNumber();
      setFormPoNumber(nextSeq);
      setFormNotes(`Uploaded: ${file.name}`);
      setFormItems([
        { itemName: cleanName || 'Purchased Material', materialType: 'RAW_MATERIAL', packing: 'Bulk', unit: 'KG', quantity: 1, unitRate: 0, lineTotal: 0 }
      ]);
      setMode('ocr_review');
      showToast({
        title: 'Review Screen Opened',
        message: err?.message ? `${err.message}. Opened review screen to verify items.` : 'Opened review screen to verify items.',
        type: 'warning',
      });
    } finally {
      setIsOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Switch view between All Items (-1) or specific dated voucher (idx)
  const handleSelectDatedVoucher = (idx: number) => {
    setSelectedDatedVoucherIdx(idx);
    if (idx === -1) {
      const allItems: PurchaseOrderItemRow[] = [];
      datedVouchers.forEach((dv) => {
        dv.items.forEach((it: any) => {
          allItems.push({
            materialId: it.matchedId,
            materialType: it.materialType || 'RAW_MATERIAL',
            itemName: it.itemName,
            packing: it.packing || 'Bulk',
            unit: it.uom || 'KG',
            quantity: Number(it.quantity) || 1,
            unitRate: Number(it.rate) || 0,
            lineTotal: Number(it.lineAmount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0),
          });
        });
      });
      if (allItems.length > 0) setFormItems(allItems);
    } else {
      const selectedV = datedVouchers[idx];
      if (selectedV) {
        setFormExpectedDate(selectedV.date);
        if (selectedV.voucherNumber) setFormPoNumber(selectedV.voucherNumber);
        setFormItems(
          selectedV.items.map((it: any) => ({
            materialId: it.matchedId,
            materialType: it.materialType || 'RAW_MATERIAL',
            itemName: it.itemName,
            packing: it.packing || 'Bulk',
            unit: it.uom || 'KG',
            quantity: Number(it.quantity) || 1,
            unitRate: Number(it.rate) || 0,
            lineTotal: Number(it.lineAmount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0),
          })),
        );
      }
    }
  };

  // 1-Click batch creation of all dated purchase orders
  const handleCreateAllDatedOrders = async () => {
    if (!formVendorId) {
      showToast({ title: 'Validation', message: 'Please select a vendor before batch posting', type: 'warning' });
      return;
    }
    if (datedVouchers.length === 0) return;

    setIsPostingBatchPos(true);
    showToast({
      title: 'Generating Batch Orders',
      message: `Creating ${datedVouchers.length} individual Purchase Orders for each date...`,
      type: 'info',
    });

    try {
      const payload = datedVouchers.map((dv) => ({
        poDate: dv.date,
        expectedDeliveryDate: dv.date,
        vendorId: formVendorId,
        warehouseId: formWarehouseId || undefined,
        notes: `Extracted from Multi-Date Sheet: ${ocrFileName} (Delivery Date: ${dv.date})`,
        items: dv.items.map((it: any) => ({
          materialId: it.matchedId || undefined,
          materialType: it.materialType || 'RAW_MATERIAL',
          itemName: it.itemName,
          packing: it.packing || 'Bulk',
          unit: it.uom || 'KG',
          quantity: Number(it.quantity) || 1,
          unitRate: Number(it.rate) || 0,
          lineTotal: Number(it.lineAmount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0),
        })),
      }));

      const res = await ApiClient.post<any>('/api/v1/operations/purchase-orders/batch', {
        purchaseOrders: payload,
      });

      const count = res.data?.count || datedVouchers.length;
      showToast({
        title: 'Batch POs Created',
        message: `Successfully created ${count} individual Purchase Orders across each delivery date!`,
        type: 'success',
      });
      setIsMultiDateSheet(false);
      setDatedVouchers([]);
      setMode('list');
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Batch Creation Failed',
        message: err?.message || 'Failed to create batch Purchase Orders',
        type: 'error',
      });
    } finally {
      setIsPostingBatchPos(false);
    }
  };

  // Form item update
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value } as PurchaseOrderItemRow;

    if (field === 'materialId') {
      const rm = rawMaterials.find((m) => m.id === value);
      if (rm) {
        item.itemName = rm.materialName;
        item.materialType = 'RAW_MATERIAL';
        item.unitRate = Number(rm.lastPurchaseCost || rm.standardCost || 0);
        if (rm.specifications) item.packing = rm.specifications;
        if (rm.baseUom?.code) item.unit = rm.baseUom.code;
        else if (rm.purchaseUom?.code) item.unit = rm.purchaseUom.code;
      } else {
        const pm = packingMaterials.find((m) => m.id === value);
        if (pm) {
          item.itemName = pm.materialName;
          item.materialType = 'PACKING_MATERIAL';
          item.unitRate = Number(pm.lastPurchaseCost || pm.standardCost || 0);
          if (pm.description) item.packing = pm.description;
          if (pm.baseUom?.code) item.unit = pm.baseUom.code;
          else if (pm.purchaseUom?.code) item.unit = pm.purchaseUom.code;
        }
      }
    }

    if (field === 'materialType') {
      if (value === 'PACKING_MATERIAL' && item.materialType !== 'PACKING_MATERIAL') {
        const pmMatch = packingMaterials.find((m) => m.id === item.materialId);
        if (!pmMatch) item.materialId = undefined;
        if (!item.unit || item.unit === 'KG') item.unit = 'PCS';
      } else if (value === 'RAW_MATERIAL' && item.materialType !== 'RAW_MATERIAL') {
        const rmMatch = rawMaterials.find((m) => m.id === item.materialId);
        if (!rmMatch) item.materialId = undefined;
        if (!item.unit || item.unit === 'PCS') item.unit = 'KG';
      }
    }

    const qty = Number(item.quantity) || 0;
    const rate = Number(item.unitRate) || 0;
    item.lineTotal = qty * rate;

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    setFormItems([
      ...formItems,
      { itemName: '', materialType: 'RAW_MATERIAL', packing: 'Bulk', unit: 'KG', quantity: 1, unitRate: 0, lineTotal: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Save Purchase Order into Structured Database
  const handleSavePo = async () => {
    if (!formVendorId) {
      showToast({ title: 'Validation', message: 'Please select a vendor', type: 'warning' });
      return;
    }

    try {
      await ApiClient.post('/api/v1/operations/purchase-orders', {
        poNumber: formPoNumber,
        vendorId: formVendorId,
        warehouseId: formWarehouseId || undefined,
        deliveryLocation: extractedExtraFields.address || undefined,
        paymentTerms: extractedExtraFields.paymentTerms || undefined,
        expectedDeliveryDate: formExpectedDate || undefined,
        notes: formNotes,
        extraFields: extractedExtraFields,
        items: formItems.map((it) => ({
          ...it,
          warehouseId: it.warehouseId || formWarehouseId || undefined,
        })),
        status: 'CONFIRMED',
      });

      showToast({ title: 'Success', message: 'Purchase Order saved structurally in database!', type: 'success' });
      setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save purchase order', type: 'error' });
    }
  };

  // Open Verification Modal from Current Form
  const openVerifyModalFromCurrentForm = () => {
    if (!formVendorId) {
      showToast({ title: 'Validation', message: 'Please select a vendor', type: 'warning' });
      return;
    }
    setVerifyVendorId(formVendorId);
    setVerifyWarehouseId(formWarehouseId || (warehouses[0]?.id ?? ''));
    setVerifyPoNumber(formPoNumber);
    setVerifyItems([...formItems]);
    setIsVerifyModalOpen(true);
  };

  // Multi-Warehouse Split Allocation Handlers
  const openSplitModal = (source: 'form' | 'verify', index: number) => {
    const list = source === 'form' ? formItems : verifyItems;
    const item = list[index];
    if (!item) return;

    setSplitSource(source);
    setSplitItemIndex(index);

    const defaultWh = (source === 'form' ? formWarehouseId : verifyWarehouseId) || warehouses[0]?.id || '';
    setSplitAllocations([
      { warehouseId: item.warehouseId || defaultWh, quantity: Number(item.quantity) || 0 },
      { warehouseId: warehouses.find((w) => w.id !== (item.warehouseId || defaultWh))?.id || warehouses[0]?.id || '', quantity: 0 },
    ]);
    setIsSplitModalOpen(true);
  };

  const addSplitRow = () => {
    setSplitAllocations([
      ...splitAllocations,
      { warehouseId: warehouses[0]?.id || '', quantity: 0 },
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
      updated[idx] = { warehouseId: prev.warehouseId, quantity: Math.max(0, parseFloat(val) || 0) };
    } else {
      updated[idx] = { warehouseId: String(val || ''), quantity: prev.quantity };
    }
    setSplitAllocations(updated);
  };

  const handleApplySplit = () => {
    if (splitItemIndex < 0) return;
    const isForm = splitSource === 'form';
    const list = isForm ? [...formItems] : [...verifyItems];
    const originalItem = list[splitItemIndex];
    if (!originalItem) return;

    const validSplits = splitAllocations.filter((s) => s.quantity > 0 && s.warehouseId);
    if (validSplits.length === 0) {
      showToast({ title: 'Validation', message: 'Please allocate quantity greater than 0 to at least one warehouse', type: 'warning' });
      return;
    }

    // Expand original item into multiple items for each destination warehouse
    const newItems: PurchaseOrderItemRow[] = validSplits.map((split) => {
      const qty = Number(split.quantity);
      const rate = Number(originalItem.unitRate) || 0;
      return {
        ...originalItem,
        quantity: qty,
        warehouseId: split.warehouseId,
        lineTotal: qty * rate,
      };
    });

    list.splice(splitItemIndex, 1, ...newItems);

    if (isForm) {
      setFormItems(list);
    } else {
      setVerifyItems(list);
    }

    setIsSplitModalOpen(false);
    showToast({
      title: 'Warehouse Split Applied',
      message: `Item allocated across ${newItems.length} destination warehouses!`,
      type: 'success',
    });
  };

  // Open Verification Modal from Existing Saved Order
  const openVerifyModalFromOrder = (order: PurchaseOrderRecord) => {
    setVerifyVendorId(order.vendorId);
    setVerifyWarehouseId(order.warehouseId || (warehouses[0]?.id ?? ''));
    setVerifyPoNumber(order.poNumber);
    setVerifyItems(
      (order.items || []).map((it) => ({
        materialType: it.materialType || 'RAW_MATERIAL',
        itemName: it.itemName,
        packing: it.packing || 'Bulk',
        unit: it.unit || 'KG',
        quantity: Number(it.quantity) || 1,
        unitRate: Number(it.unitRate) || 0,
        warehouseId: it.warehouseId || order.warehouseId || (warehouses[0]?.id ?? ''),
        lineTotal: (Number(it.quantity) || 1) * (Number(it.unitRate) || 0),
      })),
    );
    setIsVerifyModalOpen(true);
  };

  // Update item in verification modal
  const updateVerifyItem = (index: number, field: string, value: any) => {
    const updated = [...verifyItems];
    const item = { ...updated[index], [field]: value } as PurchaseOrderItemRow;
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.unitRate) || 0;
    item.lineTotal = qty * rate;
    updated[index] = item;
    setVerifyItems(updated);
  };

  // Confirm and Create Purchase directly
  const handleConfirmCreatePurchase = async () => {
    if (!verifyVendorId) {
      showToast({ title: 'Validation', message: 'Please select a vendor', type: 'warning' });
      return;
    }
    if (!verifyWarehouseId) {
      showToast({ title: 'Validation', message: 'Please select a target warehouse', type: 'warning' });
      return;
    }
    setIsCreatingPurchase(true);
    try {
      // 1. If PO does not exist yet (direct from upload review), ensure PO is saved
      const existingPo = orders.find((o) => o.poNumber === verifyPoNumber);
      if (!existingPo) {
        await ApiClient.post('/api/v1/operations/purchase-orders', {
          poNumber: verifyPoNumber,
          vendorId: verifyVendorId,
          warehouseId: verifyWarehouseId,
          deliveryLocation: extractedExtraFields.address || undefined,
          paymentTerms: extractedExtraFields.paymentTerms || undefined,
          expectedDeliveryDate: formExpectedDate || undefined,
          notes: formNotes,
          extraFields: extractedExtraFields,
          items: verifyItems,
          status: 'CONVERTED_TO_PURCHASE',
        }).catch(() => null);
      }

      // 2. Create Purchase with immediate auto-posting and automatic master registration
      const purchasePayload = {
        vendorId: verifyVendorId,
        warehouseId: verifyWarehouseId,
        date: new Date().toISOString().split('T')[0],
        vendorInvoiceNo: `INV-${verifyPoNumber.replace(/^PO-/, '')}`,
        reference: verifyPoNumber,
        notes: `Direct Purchase from PO ${verifyPoNumber}`,
        autoPost: true,
        items: verifyItems.map((it) => ({
          materialType: it.materialType || 'RAW_MATERIAL',
          itemName: it.itemName,
          packing: it.packing || 'Bulk',
          unit: it.unit || (it.materialType === 'PACKING_MATERIAL' ? 'PCS' : 'KG'),
          quantity: Number(it.quantity) || 1,
          rate: Number(it.unitRate) || 0,
          grossAmount: (Number(it.quantity) || 1) * (Number(it.unitRate) || 0),
          netAmount: (Number(it.quantity) || 1) * (Number(it.unitRate) || 0),
          warehouseId: it.warehouseId || verifyWarehouseId,
        })),
      };

      await ApiClient.post('/api/v1/purchases', purchasePayload);

      showToast({
        title: 'Purchase Created Successfully',
        message: 'Materials received and allocated into designated warehouses with updated inventory!',
        type: 'success',
      });

      setIsVerifyModalOpen(false);
      setMode('list');
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Purchase Creation Failed',
        message: err.message || 'Failed to create purchase',
        type: 'error',
      });
    } finally {
      setIsCreatingPurchase(false);
    }
  };

  // Delete Purchase Order
  const handleDeletePo = async (order: PurchaseOrderRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Purchase Order "${order.poNumber}"?\n\nThis will remove the PO and its line items from the database.`
    );
    if (!confirmed) return;

    try {
      await ApiClient.delete(`/api/v1/operations/purchase-orders/${order.id}`);
      showToast({
        title: 'PO Deleted',
        message: `Purchase Order ${order.poNumber} deleted successfully`,
        type: 'success',
      });
      if (selectedOrder?.id === order.id) {
        setMode('list');
        setSelectedOrder(null);
      }
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err?.message || 'Failed to delete purchase order',
        type: 'error',
      });
    }
  };

  const filteredOrders = orders.filter((po) => {
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const confirmedCount = orders.filter((o) => o.status === 'CONFIRMED').length;
  const convertedCount = orders.filter((o) => o.status === 'CONVERTED_TO_PURCHASE').length;
  const totalPoValue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const columns: ColumnDef<PurchaseOrderRecord>[] = [
    { key: 'poNumber', header: 'PO Number', render: (o) => <span style={{ fontWeight: 600 }}>{o.poNumber}</span> },
    { key: 'createdAt', header: 'Date', render: (o) => new Date(o.createdAt).toLocaleDateString() },
    { key: 'vendor', header: 'Vendor', render: (o) => o.vendor?.name || 'Unknown' },
    { key: 'warehouse', header: 'Warehouse', render: (o) => o.warehouse?.name || '-' },
    {
      key: 'items',
      header: 'Products / Items',
      render: (o) => (
        <div style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.items?.map((it) => `${it.itemName} (${it.quantity} ${it.unit || ''})`).join(', ')}>
          {o.items && o.items.length > 0 ? (
            o.items.map((it, idx) => (
              <span key={idx} style={{ display: 'inline-block', marginRight: '6px', fontSize: '12px' }}>
                <strong style={{ color: '#0f172a' }}>{it.itemName}</strong>
                <span style={{ color: '#64748b', marginLeft: '2px' }}>({Number(it.quantity)} {it.unit || ''})</span>
                {idx < o.items.length - 1 && <span style={{ color: '#cbd5e1', marginLeft: '4px' }}>&bull;</span>}
              </span>
            ))
          ) : (
            <span style={{ color: '#94a3b8' }}>-</span>
          )}
        </div>
      ),
    },
    { key: 'totalAmount', header: 'Total Value', render: (o) => `PKR ${Number(o.totalAmount || 0).toLocaleString()}` },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <StatusBadge
          status={o.status}
          variant={
            o.status === 'CONVERTED_TO_PURCHASE'
              ? 'success'
              : o.status === 'CONFIRMED'
                ? 'primary'
                : o.status === 'CANCELLED'
                  ? 'error'
                  : 'neutral'
          }
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (o) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedOrder(o);
              setMode('detail');
            }}
          >
            <IconEye size={15} /> View
          </Button>
          {o.status !== 'CONVERTED_TO_PURCHASE' && o.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => openVerifyModalFromOrder(o)}
            >
              Create Purchase
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeletePo(o)}
            style={{ color: '#ef4444' }}
            title="Delete Purchase Order"
          >
            <IconTrash size={15} /> Delete
          </Button>
        </div>
      ),
    },
  ];

  // Render Quick Add Vendor Modal
  const renderQuickVendorModal = () => {
    if (!isQuickVendorModalOpen) return null;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Add New Vendor
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Save vendor directly in Vendor Master section &amp; select in Purchase Order.
              </p>
            </div>
            <button
              onClick={() => setIsQuickVendorModalOpen(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
            >
              <IconClose size={18} />
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Vendor / Supplier Name *
              </label>
              <Input
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateVendor(e); } }}
                placeholder="e.g. Acme Chemical Suppliers Pvt Ltd"
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Vendor Type
                </label>
                <Select
                  value={newVendorType}
                  onChange={(e) => setNewVendorType(e.target.value)}
                  options={[
                    { label: 'Raw Material Supplier', value: 'RAW_MATERIAL' },
                    { label: 'Packaging Material Supplier', value: 'PACKING_MATERIAL' },
                    { label: 'General / Services', value: 'SERVICE' },
                  ]}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Phone Number
                </label>
                <Input
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateVendor(e); } }}
                  placeholder="+92 300 1234567"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Email Address
              </label>
              <Input
                type="email"
                value={newVendorEmail}
                onChange={(e) => setNewVendorEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateVendor(e); } }}
                placeholder="sales@vendor.com"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Address / City
              </label>
              <Input
                value={newVendorAddress}
                onChange={(e) => setNewVendorAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateVendor(e); } }}
                placeholder="Plot 42, Industrial Area, Karachi"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsQuickVendorModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleQuickCreateVendor} disabled={isSubmittingVendor}>
                {isSubmittingVendor ? 'Saving Vendor...' : 'Save & Select Vendor'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Quick Add Product/Material Modal
  const renderQuickMaterialModal = () => {
    if (!isQuickMaterialModalOpen) return null;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Add Product to Master Catalog
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Register this material in Product Master section &amp; link directly to PO.
              </p>
            </div>
            <button
              onClick={() => setIsQuickMaterialModalOpen(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
            >
              <IconClose size={18} />
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Product / Material Name *
              </label>
              <Input
                value={newMatName}
                onChange={(e) => setNewMatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateMaterial(e); } }}
                placeholder="e.g. Caustic Soda Flakes / PET Preform 28mm"
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Classification *
                </label>
                <Select
                  value={newMatType}
                  onChange={(e) => setNewMatType(e.target.value as any)}
                  options={[
                    { label: 'Raw Material', value: 'RAW_MATERIAL' },
                    { label: 'Packaging Material', value: 'PACKING_MATERIAL' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Standard Unit
                </label>
                <Select
                  value={newMatUnit}
                  onChange={(e) => setNewMatUnit(e.target.value)}
                  options={[
                    { label: 'KG (Kilogram)', value: 'KG' },
                    { label: 'L (Liters)', value: 'L' },
                    { label: 'PCS (Pieces)', value: 'PCS' },
                    { label: 'BAG (Bags)', value: 'BAG' },
                    { label: 'DRUM (Drums)', value: 'DRUM' },
                    { label: 'TON (Metric Ton)', value: 'TON' },
                  ]}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Packing Specification
                </label>
                <Input
                  value={newMatPacking}
                  onChange={(e) => setNewMatPacking(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateMaterial(e); } }}
                  placeholder="e.g. 50 KG Bag / Bulk / 200L Drum"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Estimated Rate (PKR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={newMatRate.toString()}
                  onChange={(e) => setNewMatRate(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleQuickCreateMaterial(e); } }}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsQuickMaterialModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleQuickCreateMaterial} disabled={isSubmittingMaterial}>
                {isSubmittingMaterial ? 'Saving Product...' : 'Save & Link Product'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Verification & Create Purchase Modal
  const renderVerifyModal = () => {
    if (!isVerifyModalOpen) return null;
    const modalTotal = verifyItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const modalRawItems = verifyItems.filter((i) => (i.materialType || 'RAW_MATERIAL') === 'RAW_MATERIAL');
    const modalRawTotal = modalRawItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const modalPackItems = verifyItems.filter((i) => i.materialType === 'PACKING_MATERIAL');
    const modalPackTotal = modalPackItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const verifyWarehouseObj = warehouses.find((w) => w.id === verifyWarehouseId);

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '940px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Verify Material Routing &amp; Confirm Purchase
              </h2>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '3px 0 0 0' }}>
                Confirm material classification before creating direct purchase and receiving warehouse inventory.
              </p>
            </div>
            <button
              onClick={() => setIsVerifyModalOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '6px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              <IconClose size={18} />
            </button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Routing Category Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Raw Materials Catalog
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {modalRawItems.length} {modalRawItems.length === 1 ? 'item' : 'items'} routing to Raw Materials
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  PKR {modalRawTotal.toLocaleString()}
                </div>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Packaging Materials Catalog
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {modalPackItems.length} {modalPackItems.length === 1 ? 'item' : 'items'} routing to Packaging
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  PKR {modalPackTotal.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Inputs: Vendor and Target Warehouse */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Supplier / Vendor *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      value={verifyVendorId}
                      onChange={(e) => setVerifyVendorId(e?.target?.value !== undefined ? e.target.value : (typeof e === 'string' ? e : ''))}
                      placeholder="-- Select Vendor --"
                      options={[
                        { label: '-- Select Vendor --', value: '' },
                        ...vendors.map((v) => ({
                          label: v.code ? `${v.code} - ${v.name}` : v.name,
                          value: v.id,
                          subtext: v.vendorType || undefined,
                        })),
                      ]}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsQuickVendorModalOpen(true)}
                    style={{ whiteSpace: 'nowrap', height: '38px', padding: '0 10px' }}
                    title="Add new vendor to master data"
                  >
                    <IconPlus size={14} /> Add
                  </Button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Receiving Warehouse Destination *
                </label>
                <Select
                  value={verifyWarehouseId}
                  onChange={(e) => setVerifyWarehouseId(e?.target?.value !== undefined ? e.target.value : (typeof e === 'string' ? e : ''))}
                  placeholder="-- Select Warehouse --"
                  options={[
                    { label: '-- Select Warehouse --', value: '' },
                    ...warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id })),
                  ]}
                />
              </div>
            </div>

            {/* Items Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '150px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Material Type *
                      </th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Material Description
                      </th>
                      <th style={{ padding: '10px 12px', width: '160px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Destination WH
                      </th>
                      <th style={{ padding: '10px 12px', width: '100px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Packing Spec
                      </th>
                      <th style={{ padding: '10px 12px', width: '85px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Qty
                      </th>
                      <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Rate (PKR)
                      </th>
                      <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Total (PKR)
                      </th>
                      <th style={{ padding: '10px 12px', width: '70px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Split
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifyItems.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                        }}
                      >
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <select
                            value={item.materialType || 'RAW_MATERIAL'}
                            onChange={(e) => updateVerifyItem(idx, 'materialType', e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="RAW_MATERIAL">Raw Material</option>
                            <option value="PACKING_MATERIAL">Packaging Material</option>
                            <option value="FINISHED_PRODUCT">Finished Good</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <input
                            value={item.itemName}
                            onChange={(e) => updateVerifyItem(idx, 'itemName', e.target.value)}
                            placeholder="Material name"
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <select
                            value={item.warehouseId || verifyWarehouseId}
                            onChange={(e) => updateVerifyItem(idx, 'warehouseId', e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.code} - {w.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <input
                            value={item.packing || ''}
                            onChange={(e) => updateVerifyItem(idx, 'packing', e.target.value)}
                            placeholder="Bulk / Drum"
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateVerifyItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitRate}
                            onChange={(e) => updateVerifyItem(idx, 'unitRate', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0f172a', verticalAlign: 'middle', fontSize: '13px' }}>
                          PKR {Number(item.lineTotal || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => openSplitModal('verify', idx)}
                            title="Split item across warehouses (e.g. WH A: 50, WH B: 100, WH C: 50)"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              border: '1px solid #3b82f6',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ⚡ Split
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
                Total Commitment:
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                PKR {modalTotal.toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                ({verifyItems.length} items &bull; {verifyWarehouseObj?.name || 'Warehouse'})
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setIsVerifyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCreatePurchase}
                disabled={isCreatingPurchase}
                icon={<IconCheck size={16} />}
              >
                {isCreatingPurchase ? 'Creating Purchase...' : 'Confirm & Create Purchase'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Multi-Warehouse Split Modal
  const renderSplitModal = () => {
    if (!isSplitModalOpen || splitItemIndex < 0) return null;
    const list = splitSource === 'form' ? formItems : verifyItems;
    const targetItem = list[splitItemIndex];
    if (!targetItem) return null;

    const totalAllocated = splitAllocations.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const targetQty = Number(targetItem.quantity) || 0;
    const isBalanced = totalAllocated === targetQty;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '620px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                ⚡ Multi-Warehouse Split Allocation
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                Split &apos;{targetItem.itemName || 'Item'}&apos; across multiple destination warehouses (e.g. 50 in WH A, 100 in WH B, 50 in WH C).
              </p>
            </div>
            <button
              onClick={() => setIsSplitModalOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <IconClose size={18} />
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: isBalanced ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${isBalanced ? '#a7f3d0' : '#fde68a'}`,
              }}
            >
              <div>
                <span style={{ fontSize: '13px', color: '#475569' }}>Target Quantity to Allocate:</span>{' '}
                <strong style={{ fontSize: '15px', color: '#0f172a' }}>{targetQty} {targetItem.unit || 'units'}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Currently Allocated:</span>{' '}
                <strong style={{ fontSize: '15px', color: isBalanced ? '#047857' : '#b45309' }}>
                  {totalAllocated} / {targetQty}
                </strong>
                {isBalanced ? (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#047857', fontWeight: 700 }}>✅ Balanced</span>
                ) : (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
                    ({targetQty - totalAllocated > 0 ? `${targetQty - totalAllocated} remaining` : `${totalAllocated - targetQty} over`})
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {splitAllocations.map((alloc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 36px',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <Select
                    value={alloc.warehouseId}
                    onChange={(e) => updateSplitRow(idx, 'warehouseId', e.target.value)}
                    options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Quantity"
                    value={alloc.quantity || ''}
                    onChange={(e) => updateSplitRow(idx, 'quantity', e.target.value)}
                  />
                  <button
                    onClick={() => removeSplitRow(idx)}
                    disabled={splitAllocations.length <= 1}
                    style={{
                      height: '36px',
                      background: 'none',
                      border: 'none',
                      color: splitAllocations.length <= 1 ? '#cbd5e1' : '#ef4444',
                      cursor: splitAllocations.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
            </div>

            <Button size="sm" variant="secondary" onClick={addSplitRow}>
              <IconPlus size={14} /> Add Another Warehouse
            </Button>
          </div>

          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <Button variant="ghost" onClick={() => setIsSplitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApplySplit}
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', fontWeight: 600 }}
            >
              Apply Multi-Warehouse Split
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── Mode: Review or Manual Entry ──────────────────────────────────────
  if (mode === 'create_manual' || mode === 'ocr_review') {
    const totalCalc = formItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const rawMaterialItems = formItems.filter((i) => (i.materialType || 'RAW_MATERIAL') === 'RAW_MATERIAL');
    const rawMaterialTotal = rawMaterialItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const packingItems = formItems.filter((i) => i.materialType === 'PACKING_MATERIAL');
    const packingTotal = packingItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    const selectedVendorObj = vendors.find((v) => v.id === formVendorId);

    return (
      <>
        <FormPageTemplate
          title={mode === 'ocr_review' ? `Review Extracted PO: ${ocrFileName || 'Uploaded Document'}` : 'Create Purchase Order'}
          subtitle="Review extracted fields, adjust quantities or rates if necessary, then save structured PO into database."
          breadcrumbs={[{ label: 'Purchase Orders', onClick: () => setMode('list') }, { label: mode === 'ocr_review' ? 'OCR Review' : 'New PO' }]}
          onCancel={() => setMode('list')}
          onSubmit={openVerifyModalFromCurrentForm}
          submitLabel="Verify & Create Purchase"
          onSaveDraft={handleSavePo}
          draftLabel="Save PO Only"
        >
          {/* Compact Document Context Banner */}
          {mode === 'ocr_review' && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 18px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconFileText size={16} />
                </div>
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  Document: <strong style={{ color: '#0f172a' }}>{ocrFileName || 'Uploaded Document'}</strong>
                  {selectedVendorObj?.name && (
                    <>
                      <span style={{ color: '#cbd5e1', margin: '0 8px' }}>&bull;</span>
                      Supplier: <strong style={{ color: '#0f172a' }}>{selectedVendorObj.name}</strong>
                    </>
                  )}
                </div>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #bbf7d0',
                }}
              >
                <IconCheck size={12} /> AI Extracted
              </span>
            </div>
          )}

          {/* Multi-Date Procurement Sheet Detected Banner & Interactive Segmentation */}
          {mode === 'ocr_review' && isMultiDateSheet && datedVouchers.length > 0 && (
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
                    This supplier statement contains deliveries across multiple dates. You can create separate POs for each date with 1 click or inspect individual date vouchers below.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateAllDatedOrders}
                  disabled={isPostingBatchPos}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    fontWeight: 700,
                  }}
                >
                  {isPostingBatchPos ? 'Creating Batch Orders...' : `⚡ 1-Click Create All (${datedVouchers.length}) Dated POs`}
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

          {/* Dynamic File Properties Detected */}
          {mode === 'ocr_review' && Object.keys(extractedExtraFields).length > 0 && (
            <div
              style={{
                backgroundColor: '#f0fdfa',
                border: '1px solid #ccfbf1',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚡ Dynamic Vendor Document Properties
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ({Object.keys(extractedExtraFields).length} properties detected &amp; saved)
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(extractedExtraFields).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #99f6e4',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span style={{ color: '#0f766e', fontWeight: 600, textTransform: 'capitalize' }}>
                      {k.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span style={{ color: '#0f172a', fontWeight: 500, fontFamily: typeof v === 'number' || /^[0-9\-]+$/.test(String(v)) ? 'var(--font-mono)' : 'inherit' }}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: PO Document Information Card */}
          <Card padding="none" style={{ marginBottom: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <CardHeader
              style={{
                padding: '16px 20px',
                margin: 0,
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>1. PO Document Information</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    PO Number * (Auto Sequential)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Input
                      value={formPoNumber}
                      onChange={(e) => setFormPoNumber(e.target.value)}
                      placeholder="PO-2026-000001"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, flex: 1 }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fetchNextPoNumber()}
                      title="Auto-generate next sequential PO Number"
                      style={{ height: '38px', padding: '0 10px', whiteSpace: 'nowrap' }}
                    >
                      <IconRefresh size={14} /> Auto
                    </Button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Supplier / Vendor *
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Select
                        value={formVendorId}
                        onChange={(e) => setFormVendorId(e?.target?.value !== undefined ? e.target.value : (typeof e === 'string' ? e : ''))}
                        placeholder="-- Select Vendor --"
                        options={[
                          { label: '-- Select Vendor --', value: '' },
                          ...vendors.map((v) => ({
                            label: v.code ? `${v.code} - ${v.name}` : v.name,
                            value: v.id,
                            subtext: v.vendorType || undefined,
                          })),
                        ]}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsQuickVendorModalOpen(true)}
                      title="Add new vendor into Master Records"
                      style={{ height: '38px', padding: '0 10px', whiteSpace: 'nowrap' }}
                    >
                      <IconPlus size={14} /> New Vendor
                    </Button>
                  </div>
                  {extractedVendorRaw && (
                    <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px', fontWeight: 500 }}>
                      Extracted from document: &ldquo;{extractedVendorRaw}&rdquo;
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Receiving Warehouse *
                  </label>
                  <Select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value)}
                    options={[
                      { label: 'Select Warehouse', value: '' },
                      ...warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id })),
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Expected Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={formExpectedDate}
                    onChange={(e) => setFormExpectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Delivery Remarks / Notes
                </label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional reference notes or delivery comments..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Structured Line Items Table Card */}
          <Card padding="none" style={{ marginBottom: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <CardHeader
              style={{
                padding: '16px 20px',
                margin: 0,
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  2. Line Items &amp; Material Classification
                </CardTitle>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    backgroundColor: '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {formItems.length} {formItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setTargetItemIndexForMat(-1);
                    setNewMatName('');
                    setNewMatRate(0);
                    setIsQuickMaterialModalOpen(true);
                  }}
                  icon={<IconPlus size={14} />}
                >
                  Quick Add Product
                </Button>
                <Button size="sm" variant="secondary" onClick={addItemRow} icon={<IconPlus size={14} />}>
                  Add Line Item
                </Button>
              </div>
            </CardHeader>
            <CardContent style={{ padding: '0' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)', background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', width: '44px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        #
                      </th>
                      <th style={{ padding: '12px 14px', width: '150px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Material Type *
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Item Description *
                      </th>
                      <th style={{ padding: '12px 14px', width: '160px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Destination WH
                      </th>
                      <th style={{ padding: '12px 14px', width: '120px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Packing Spec
                      </th>
                      <th style={{ padding: '12px 14px', width: '80px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Unit
                      </th>
                      <th style={{ padding: '12px 14px', width: '90px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Qty
                      </th>
                      <th style={{ padding: '12px 14px', width: '120px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Rate (PKR)
                      </th>
                      <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Total (PKR)
                      </th>
                      <th style={{ padding: '12px 14px', width: '90px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                        }}
                      >
                        {/* Index */}
                        <td style={{ padding: '8px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '12px', verticalAlign: 'middle' }}>
                          {idx + 1}
                        </td>

                        {/* Material Type */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <select
                            value={item.materialType || 'RAW_MATERIAL'}
                            onChange={(e) => updateItem(idx, 'materialType', e.target.value)}
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="RAW_MATERIAL">Raw Material</option>
                            <option value="PACKING_MATERIAL">Packaging Material</option>
                            <option value="FINISHED_PRODUCT">Finished Good</option>
                          </select>
                        </td>

                        {/* Item Name / Product Selection */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle', minWidth: '240px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {/* Product Selection Dropdown */}
                            <select
                              value={item.materialId || (item.itemName ? '__custom__' : '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  updateItem(idx, 'materialId', '');
                                } else if (val) {
                                  updateItem(idx, 'materialId', val);
                                } else {
                                  updateItem(idx, 'materialId', '');
                                  updateItem(idx, 'itemName', '');
                                }
                              }}
                              style={{
                                width: '100%',
                                height: '34px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">
                                {item.materialType === 'PACKING_MATERIAL'
                                  ? '-- Select Packaging Material --'
                                  : '-- Select Raw Material --'}
                              </option>
                              {(item.materialType === 'PACKING_MATERIAL' ? packingMaterials : rawMaterials).map((m) => (
                                <option key={m.id} value={m.id}>
                                  [{m.materialCode}] {m.materialName} {m.standardCost ? `(PKR ${Number(m.standardCost).toLocaleString()})` : ''}
                                </option>
                              ))}
                              <option value="__custom__">✎ Custom / Non-Catalog Item...</option>
                            </select>

                            {/* Item Description / Custom Name input & quick master button */}
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              <input
                                value={item.itemName || ''}
                                onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                                placeholder={item.materialId ? 'Product description / specs' : 'Enter product name...'}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  padding: '0 8px',
                                  borderRadius: '5px',
                                  fontSize: '12px',
                                  border: '1px solid #e2e8f0',
                                  backgroundColor: item.materialId ? '#f8fafc' : '#ffffff',
                                  color: '#0f172a',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetItemIndexForMat(idx);
                                  setNewMatName(item.itemName || '');
                                  setNewMatType(item.materialType === 'PACKING_MATERIAL' ? 'PACKING_MATERIAL' : 'RAW_MATERIAL');
                                  setNewMatRate(item.unitRate || 0);
                                  setNewMatUnit(item.unit || (item.materialType === 'PACKING_MATERIAL' ? 'PCS' : 'KG'));
                                  setNewMatPacking(item.packing || 'Bulk');
                                  setIsQuickMaterialModalOpen(true);
                                }}
                                title="Register this product directly into Master Catalog"
                                style={{
                                  padding: '0 8px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f1f5f9',
                                  cursor: 'pointer',
                                  color: '#334155',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <IconPlus size={11} /> Master
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Destination WH */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <select
                            value={item.warehouseId || formWarehouseId}
                            onChange={(e) => updateItem(idx, 'warehouseId', e.target.value)}
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                            }}
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.code} - {w.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Packing */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <input
                            value={item.packing || ''}
                            onChange={(e) => updateItem(idx, 'packing', e.target.value)}
                            placeholder="Bulk / Drum / Box"
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>

                        {/* Unit */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <input
                            value={item.unit || (item.materialType === 'PACKING_MATERIAL' ? 'PCS' : 'KG')}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                            placeholder="KG / PCS"
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>

                        {/* Quantity */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>

                        {/* Rate */}
                        <td style={{ padding: '8px 14px', verticalAlign: 'middle' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitRate}
                            onChange={(e) => updateItem(idx, 'unitRate', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              boxSizing: 'border-box',
                            }}
                          />
                        </td>

                        {/* Total */}
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0f172a', verticalAlign: 'middle', fontSize: '13px' }}>
                          PKR {Number(item.lineTotal || 0).toLocaleString()}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '8px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openSplitModal('form', idx)}
                              title="Split item across warehouses (e.g. WH A: 50, WH B: 100, WH C: 50)"
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: '1px solid #3b82f6',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ⚡ Split
                            </button>
                            <button
                              onClick={() => removeItemRow(idx)}
                              disabled={formItems.length === 1}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: formItems.length === 1 ? '#cbd5e1' : '#94a3b8',
                                cursor: formItems.length === 1 ? 'not-allowed' : 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (formItems.length > 1) e.currentTarget.style.color = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                if (formItems.length > 1) e.currentTarget.style.color = '#94a3b8';
                              }}
                              title="Remove row"
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Clean Table Summary Footer - ONLY totals, NO duplicate buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '14px 20px',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#475569' }}>
                  <span>
                    Raw Materials: <strong style={{ color: '#0f172a' }}>PKR {rawMaterialTotal.toLocaleString()}</strong> ({rawMaterialItems.length})
                  </span>
                  <span style={{ color: '#cbd5e1' }}>&bull;</span>
                  <span>
                    Packaging: <strong style={{ color: '#0f172a' }}>PKR {packingTotal.toLocaleString()}</strong> ({packingItems.length})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Total Order Value:
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                    PKR {totalCalc.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          {renderVerifyModal()}
          {renderSplitModal()}
        </FormPageTemplate>
        {renderQuickVendorModal()}
        {renderQuickMaterialModal()}
      </>
    );
  }

  // ── Mode: Detail View ─────────────────────────────────────────────────
  if (mode === 'detail' && selectedOrder) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setMode('list')} icon={<IconArrowLeft size={15} />}>
              Back to Purchase Orders
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Purchase Order {selectedOrder.poNumber}
              </h1>
              <StatusBadge status={selectedOrder.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Supplier: <strong style={{ color: '#0f172a' }}>{selectedOrder.vendor?.name}</strong>
              <span style={{ color: '#cbd5e1', margin: '0 8px' }}>&bull;</span>
              Warehouse: <strong style={{ color: '#0f172a' }}>{selectedOrder.warehouse?.name || 'Factory'}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {selectedOrder.status !== 'CONVERTED_TO_PURCHASE' && selectedOrder.status !== 'CANCELLED' && (
              <Button variant="primary" onClick={() => openVerifyModalFromOrder(selectedOrder)} icon={<IconCheck size={16} />}>
                Verify &amp; Create Purchase
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => handleDeletePo(selectedOrder)}
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
              icon={<IconTrash size={16} />}
            >
              Delete PO
            </Button>
          </div>
        </div>


        <Card padding="none" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <CardHeader
            style={{
              padding: '16px 20px',
              margin: 0,
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <CardTitle style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>PO Line Items</CardTitle>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
              {selectedOrder.items.length} {selectedOrder.items.length === 1 ? 'item' : 'items'}
            </span>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-default)', background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', width: '44px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>#</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Material Description</th>
                  <th style={{ padding: '10px 14px', width: '160px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Type</th>
                  <th style={{ padding: '10px 14px', width: '120px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Packing Spec</th>
                  <th style={{ padding: '10px 14px', width: '100px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Qty</th>
                  <th style={{ padding: '10px 14px', width: '130px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Rate (PKR)</th>
                  <th style={{ padding: '10px 14px', width: '140px', textAlign: 'right', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((i, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfd' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{i.itemName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: i.materialType === 'PACKING_MATERIAL' ? '#f5f3ff' : '#eff6ff', color: i.materialType === 'PACKING_MATERIAL' ? '#6b21a8' : '#1e40af' }}>
                        {i.materialType === 'PACKING_MATERIAL' ? 'Packaging' : i.materialType === 'FINISHED_PRODUCT' ? 'Finished Good' : 'Raw Material'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{i.packing || '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(i.quantity).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>PKR {Number(i.unitRate).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                      PKR {Number(i.lineTotal).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '10px', padding: '14px 20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Total PO Value:</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                PKR {Number(selectedOrder.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {selectedOrder.notes && (
          <Card padding="md" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Extracted Document Metadata &amp; Remarks
            </h4>
            <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {selectedOrder.notes}
            </div>
          </Card>
        )}

        {renderVerifyModal()}
        {renderSplitModal()}
      </div>
    );
  }

  // ── Mode: List ────────────────────────────────────────────────────────
  return (
    <ListPageTemplate
      title="Purchase Orders"
      subtitle="Frictionless PO intake. Upload vendor document for instant OCR extraction or create manually."
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
          />
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isOcrProcessing}
          >
            <IconPlus size={16} /> {isOcrProcessing ? 'Reading Document...' : 'Upload Purchase Order (OCR)'}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const nextSeq = await fetchNextPoNumber();
              setFormPoNumber(nextSeq || `PO-${new Date().getFullYear()}-000001`);
              if (vendors.length > 0 && !formVendorId && vendors[0]?.id) {
                setFormVendorId(vendors[0].id);
              }
              if (warehouses.length > 0 && !formWarehouseId && warehouses[0]?.id) {
                setFormWarehouseId(warehouses[0].id);
              }
              setFormItems([
                { itemName: '', materialType: 'RAW_MATERIAL', packing: 'Bulk', unit: 'KG', quantity: 1, unitRate: 0, lineTotal: 0 },
              ]);
              setMode('create_manual');
            }}
          >
            Create Manually
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <IconRefresh size={16} />
          </Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <KpiCard title="Total PO Commitment" value={`PKR ${(totalPoValue / 1000000).toFixed(2)}M`} subtitle="Total purchase orders value" />
        <KpiCard title="Confirmed POs" value={confirmedCount.toString()} subtitle="Awaiting delivery / purchase" />
        <KpiCard title="Converted to Purchase" value={convertedCount.toString()} subtitle="Stock & ledger updated" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Input placeholder="Search by PO number or vendor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div style={{ width: '200px' }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Confirmed', value: 'CONFIRMED' },
              { label: 'Converted to Purchase', value: 'CONVERTED_TO_PURCHASE' },
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Cancelled', value: 'CANCELLED' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No purchase orders found"
          description="Upload a PO PDF/image or create one manually to begin tracking purchase commitments."
          actionLabel="Upload PO (OCR)"
          onAction={() => fileInputRef.current?.click()}
        />
      ) : (
        <DataTable columns={columns} data={filteredOrders} keyExtractor={(o) => o.id} />
      )}
      {renderVerifyModal()}
      {renderSplitModal()}
      {renderQuickVendorModal()}
      {renderQuickMaterialModal()}
    </ListPageTemplate>
  );
};
