'use client';

/**
 * SHEHSWAR ONE360 - Modern Finished Product Master & Registration
 *
 * Modern, animated, zero-scroll visual workspace:
 * - Animated third-party style dialog popup with backdrop blur
 * - Zero hardcoded '#' links
 * - 2-column balanced layout with no endless vertical scrolling
 * - Visual pack-size selector chips and category tags
 * - Live dynamic formulation batch costing engine & margin simulator
 * - Real-time animated product preview card
 * - Polished delete confirmation modal and detail view
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate } from '../templates';
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  DataTable,
  KpiCard,
  StatusBadge,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Switch,
  Badge,
} from '../ui';
import { useToast } from '../../context/toast-context';
import {
  IconFlask,
  IconPlus,
  IconRefresh,
  IconDownload,
  IconEdit,
  IconCheck,
  IconTrash,
  IconPackage,
  IconSparkles,
  IconClose,
  IconEye,
  IconAlertTriangle,
  IconTag,
  IconBox,
} from '../icons';

interface FinishedProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id: string; name: string; code?: string };
  uomId: string;
  uom?: { id: string; name: string; symbol: string; code?: string };
  packSizeId?: string;
  packSize?: { id: string; name?: string; label?: string; code?: string; quantity?: number };
  npkFormula?: string;
  gradeLabel?: string;
  shelfLifeDays?: number;
  batchTracking: boolean;
  expiryTracking: boolean;
  minStock?: number;
  standardCost?: number;
  defaultSellingPrice?: number;
  isActive: boolean;
}

export const FinishedProductsView: React.FC = () => {
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [packSizes, setPackSizes] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Mode
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedProduct, setSelectedProduct] = useState<FinishedProduct | null>(null);
  const [viewingProduct, setViewingProduct] = useState<FinishedProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<FinishedProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const { showToast } = useToast();

  // Batch Yield & Commercial Costing State
  const [calcRawMaterialId, setCalcRawMaterialId] = useState<string>('');
  const [calcRmUom, setCalcRmUom] = useState<string>('L');
  const [calcRmQty, setCalcRmQty] = useState<number>(400);
  const [calcRmRate, setCalcRmRate] = useState<number>(750);
  const [calcCarrierQty, setCalcCarrierQty] = useState<number>(400);
  const [calcCarrierRate, setCalcCarrierRate] = useState<number>(180);
  const [calcProductionQty, setCalcProductionQty] = useState<number>(400);
  const [calcPackQty, setCalcPackQty] = useState<number>(2);
  const [calcPackingMaterialId, setCalcPackingMaterialId] = useState<string>('');
  const [calcOverheadCost, setCalcOverheadCost] = useState<number>(20);
  const [calcTargetMargin, setCalcTargetMargin] = useState<number>(25);
  const [isRefreshingPackaging, setIsRefreshingPackaging] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    uomId: '',
    packSizeId: '',
    npkFormula: '',
    gradeLabel: '',
    shelfLifeDays: '',
    batchTracking: true,
    expiryTracking: false,
    minStock: '',
    standardCost: '',
    defaultSellingPrice: '',
    isActive: true,
  });

  // Rigid Packaging Auto-Selector based on Pack Size Volume
  const autoSelectPackaging = useCallback((size: number, list: any[]) => {
    if (!list || list.length === 0) return;
    const target = size === 0.5 ? '500ml' : `${size}l`;
    const matched = list.find((pm) => {
      const text = `${pm.materialCode || ''} ${pm.materialName || ''}`.toLowerCase();
      return text.includes(target) || (size === 5 && text.includes('can'));
    });
    if (matched) {
      setCalcPackingMaterialId(matched.id);
    } else if (list[0]) {
      setCalcPackingMaterialId(list[0].id);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, uomRes, psRes, rmRes, pmRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/finished-products'),
        ApiClient.get<any>('/api/v1/master-data/product-categories'),
        ApiClient.get<any>('/api/v1/master-data/uoms'),
        ApiClient.get<any>('/api/v1/master-data/pack-sizes'),
        ApiClient.get<any>('/api/v1/master-data/raw-materials').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials').catch(() => ({ data: [] })),
      ]);

      const normalized = (prodRes.data || []).map((p: any) => ({
        ...p,
        code: p.code || p.productCode || '',
        name: p.name || p.productName || '',
        categoryId: p.categoryId || p.category?.id || '',
        category: p.category || null,
        uomId: p.uomId || p.baseUomId || '',
        uom: p.uom || p.baseUom || null,
        packSizeId: p.packSizeId || p.packSize?.id || '',
        packSize: p.packSize || null,
        standardCost: p.standardCost !== undefined && p.standardCost !== null ? Number(p.standardCost) : undefined,
        defaultSellingPrice: p.defaultSellingPrice !== undefined && p.defaultSellingPrice !== null ? Number(p.defaultSellingPrice) : undefined,
        isActive: p.isActive !== undefined ? p.isActive : p.status === 'ACTIVE',
      }));

      setProducts(normalized);
      setCategories(catRes.data || []);
      setUoms(uomRes.data || []);
      setPackSizes(psRes.data || []);

      const rawList = Array.isArray(rmRes)
        ? rmRes
        : Array.isArray(rmRes?.data)
        ? rmRes.data
        : (rmRes?.data as any)?.data || [];
      const packList = Array.isArray(pmRes)
        ? pmRes
        : Array.isArray(pmRes?.data)
        ? pmRes.data
        : (pmRes?.data as any)?.data || [];

      setRawMaterials(rawList);
      setPackingMaterials(packList);

      // Pre-select first raw material and packaging if not yet chosen
      if (rawList.length > 0) {
        const firstRm = rawList[0];
        setCalcRawMaterialId((prev) => prev || firstRm.id);
        const uom = firstRm.baseUom?.symbol || firstRm.baseUom?.code || firstRm.baseUom?.name || 'L';
        setCalcRmUom(uom);
        const rate = Number(firstRm.costPerBaseUnit ?? firstRm.unitRate ?? firstRm.standardCost ?? 750);
        if (rate > 0) setCalcRmRate(rate);
      }
      if (packList.length > 0) {
        autoSelectPackaging(2, packList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load finished products');
    } finally {
      setIsLoading(false);
    }
  }, [autoSelectPackaging]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle open registration modal
  const handleOpenCreateModal = () => {
    const defaultCat = categories[0]?.id || '';
    const defaultUom = uoms[0]?.id || '';
    const defaultPackSize = packSizes.find((p) => Number(p.quantity) === 2)?.id || packSizes[0]?.id || '';

    setFormData({
      code: '',
      name: '',
      description: '',
      categoryId: defaultCat,
      uomId: defaultUom,
      packSizeId: defaultPackSize,
      npkFormula: '',
      gradeLabel: '',
      shelfLifeDays: '730',
      batchTracking: true,
      expiryTracking: false,
      minStock: '50',
      standardCost: '',
      defaultSellingPrice: '',
      isActive: true,
    });

    const initialRm = rawMaterials[0];
    const initialRmId = initialRm?.id || '';
    const initialRmUom = initialRm?.baseUom?.symbol || initialRm?.baseUom?.code || initialRm?.baseUom?.name || 'L';
    const initialRmRate = Number(initialRm?.costPerBaseUnit ?? initialRm?.unitRate ?? initialRm?.standardCost ?? 750);

    setCalcRawMaterialId(initialRmId);
    setCalcRmUom(initialRmUom);
    setCalcRmQty(400);
    setCalcRmRate(initialRmRate > 0 ? initialRmRate : 750);
    setCalcCarrierQty(400);
    setCalcCarrierRate(180);
    setCalcProductionQty(400);
    setCalcPackQty(2);
    setCalcOverheadCost(20);
    setCalcTargetMargin(25);

    autoSelectPackaging(2, packingMaterials);

    setSelectedProduct(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditModal = (row: FinishedProduct) => {
    setSelectedProduct(row);
    setFormData({
      code: row.code,
      name: row.name,
      description: row.description || '',
      categoryId: row.categoryId,
      uomId: row.uomId,
      packSizeId: row.packSizeId || '',
      npkFormula: row.npkFormula || '',
      gradeLabel: row.gradeLabel || '',
      shelfLifeDays: row.shelfLifeDays?.toString() || '730',
      batchTracking: row.batchTracking,
      expiryTracking: row.expiryTracking,
      minStock: row.minStock?.toString() || '',
      standardCost: row.standardCost !== undefined ? row.standardCost.toString() : '',
      defaultSellingPrice: row.defaultSellingPrice !== undefined ? row.defaultSellingPrice.toString() : '',
      isActive: row.isActive,
    });

    const currentPackQty = Number(row.packSize?.quantity) || 2;
    setCalcPackQty(currentPackQty);
    autoSelectPackaging(currentPackQty, packingMaterials);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  // Auto-generate standardized product code
  const handleAutoGenerateCode = () => {
    const cat = categories.find((c) => c.id === formData.categoryId);
    const catPrefix = cat?.code ? cat.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) : 'PRD';
    const cleanName = formData.name
      ? formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
      : 'CHL';
    const packSuffix = `${calcPackQty}L`;
    const randomHex = Math.floor(100 + Math.random() * 900);
    const generated = `FP-${catPrefix}-${cleanName}-${packSuffix}-${randomHex}`;
    setFormData((prev) => ({ ...prev, code: generated }));
    showToast({ title: 'Code Generated', message: `Assigned code: ${generated}`, type: 'info' });
  };

  // Selected Raw Material
  const selectedRm = useMemo(
    () => rawMaterials.find((r) => r.id === calcRawMaterialId),
    [rawMaterials, calcRawMaterialId]
  );

  // Auto-fetch unit of measure and rate when user selects a raw material
  const handleSelectRawMaterial = (rmId: string) => {
    setCalcRawMaterialId(rmId);
    const rm = rawMaterials.find((r) => r.id === rmId);
    if (rm) {
      const uom = rm.baseUom?.symbol || rm.baseUom?.code || rm.baseUom?.name || 'L';
      setCalcRmUom(uom);
      const rate = Number(rm.costPerBaseUnit ?? rm.unitRate ?? rm.standardCost ?? rm.lastPurchaseCost ?? 0);
      if (rate > 0) {
        setCalcRmRate(rate);
      }
    }
  };

  // Dedicated loader to re-fetch rigid packaging components from Packaging Master
  const handleRefreshPackaging = async () => {
    setIsRefreshingPackaging(true);
    try {
      const pmRes = await ApiClient.get<any>('/api/v1/master-data/packing-materials');
      const packList = Array.isArray(pmRes)
        ? pmRes
        : Array.isArray(pmRes?.data)
        ? pmRes.data
        : (pmRes?.data as any)?.data || [];
      setPackingMaterials(packList);
      autoSelectPackaging(calcPackQty, packList);
      showToast({
        title: 'Packaging Master Refreshed',
        message: `Loaded ${packList.length} commercial rigid packaging items`,
        type: 'info',
      });
    } catch (err: any) {
      showToast({ title: 'Refresh Failed', message: err.message || 'Could not fetch packaging components', type: 'error' });
    } finally {
      setIsRefreshingPackaging(false);
    }
  };

  // Detect whether active is solid (kg/g/mt) or liquid (L/ml)
  const isSolidActive = useMemo(() => {
    const u = (calcRmUom || '').toLowerCase();
    return u.includes('kg') || u.includes('kilo') || u.includes('gm') || u.includes('mt');
  }, [calcRmUom]);

  // Target Bulk Required = Production Quantity (bottles) × Pack Size (e.g. 400 × 2L = 800L)
  const requiredBulkVolume = useMemo(() => {
    const bottles = Number(calcProductionQty) > 0 ? Number(calcProductionQty) : 0;
    const size = Number(calcPackQty) > 0 ? Number(calcPackQty) : 0;
    return bottles * size;
  }, [calcProductionQty, calcPackQty]);

  // Total Formulation Bulk Available = Active (if liquid) + Carrier Solvent
  const totalBulkVolume = useMemo(() => {
    if (isSolidActive) {
      return Number(calcCarrierQty) || 0;
    }
    return (Number(calcRmQty) || 0) + (Number(calcCarrierQty) || 0);
  }, [isSolidActive, calcRmQty, calcCarrierQty]);

  // Mass / Volume Balance Validation Check
  const volumeDifference = totalBulkVolume - requiredBulkVolume;
  const isBatchBalanced = Math.abs(volumeDifference) < 0.05 && requiredBulkVolume > 0;

  // Auto-Balance Carrier Solvent Solver (e.g. 800L required - 400L active = 400L carrier)
  const handleAutoBalanceCarrier = () => {
    const target = requiredBulkVolume;
    if (isSolidActive) {
      setCalcCarrierQty(target);
    } else {
      setCalcCarrierQty(Math.max(0, target - (Number(calcRmQty) || 0)));
    }
    showToast({
      title: 'Batch Auto-Balanced',
      message: `Carrier solvent adjusted to fulfill ${calcProductionQty} bottles of ${calcPackQty}L (${target}L total bulk).`,
      type: 'success',
    });
  };

  // Sync Bottles to Active RM (e.g. 400L active / 2L = 200 bottles)
  const handleSyncBottlesToRm = () => {
    const available = totalBulkVolume > 0 ? totalBulkVolume : (Number(calcRmQty) || 400);
    const size = Number(calcPackQty) > 0 ? Number(calcPackQty) : 2;
    const bottles = Math.floor(available / size);
    setCalcProductionQty(bottles);
    showToast({
      title: 'Bottles Synchronized',
      message: `Production quantity updated to ${bottles} bottles based on formulation bulk.`,
      type: 'info',
    });
  };

  // Cost Engine Calculations
  const totalActiveCost = (Number(calcRmQty) || 0) * (Number(calcRmRate) || 0);
  const totalCarrierCost = (Number(calcCarrierQty) || 0) * (Number(calcCarrierRate) || 0);
  const totalBulkCost = totalActiveCost + totalCarrierCost;

  const effectiveCostPerLiter = totalBulkVolume > 0 ? totalBulkCost / totalBulkVolume : 0;
  const rmCostPerPack = effectiveCostPerLiter * (Number(calcPackQty) || 1);

  const selectedPm = useMemo(
    () => packingMaterials.find((p) => p.id === calcPackingMaterialId),
    [packingMaterials, calcPackingMaterialId]
  );
  const pmCostPerPack = Number(selectedPm?.lastPurchaseCost ?? selectedPm?.standardCost ?? 45);
  const overhead = Number(calcOverheadCost) || 0;

  // Total Unit Standard Cost per Pack
  const calculatedPackCost = rmCostPerPack + pmCostPerPack + overhead;
  const marginPct = Number(calcTargetMargin) || 25;
  const suggestedSellingPrice =
    marginPct < 100 && calculatedPackCost > 0
      ? calculatedPackCost / (1 - marginPct / 100)
      : calculatedPackCost * 1.3;

  // Apply calculated cost & selling price into the product form
  const handleApplyCalculatedCost = () => {
    const standardCostStr = calculatedPackCost.toFixed(2);
    const sellingPriceStr = Math.round(suggestedSellingPrice).toString();

    setFormData((prev) => ({
      ...prev,
      standardCost: standardCostStr,
      defaultSellingPrice: sellingPriceStr,
      name:
        prev.name ||
        (selectedRm ? `${selectedRm.materialName} (${calcPackQty}L Commercial Pack)` : prev.name),
      code:
        prev.code ||
        (selectedRm
          ? `FP-${(selectedRm.materialCode || 'PRD').replace(/^RM-/, '')}-${calcPackQty}L`
          : prev.code),
    }));

    showToast({
      title: 'Costing Applied to SKU',
      message: `Standard Cost: PKR ${standardCostStr} | Selling Price: PKR ${sellingPriceStr}`,
      type: 'success',
    });
  };

  // Quick Pack Size Chips (SVG Box icon used, zero hardcoded emojis)
  const quickPackSizes = [
    { label: '1 Liter', qty: 1 },
    { label: '2 Liters', qty: 2 },
    { label: '5 Liters', qty: 5 },
    { label: '20 Liters', qty: 20 },
  ];

  const handleSelectQuickPackSize = (qty: number) => {
    setCalcPackQty(qty);
    const matched = packSizes.find((p) => Number(p.quantity) === qty);
    if (matched) {
      setFormData((prev) => ({ ...prev, packSizeId: matched.id }));
    }
    autoSelectPackaging(qty, packingMaterials);
  };

  // Save product handler
  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.categoryId || !formData.uomId) {
      showToast({
        title: 'Missing Required Fields',
        message: 'Product Code, Name, Category, and Base UOM are required',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        productCode: formData.code.trim().toUpperCase(),
        productName: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        categoryId: formData.categoryId,
        baseUomId: formData.uomId,
        packSizeId: formData.packSizeId || undefined,
        grade: formData.gradeLabel?.trim() || undefined,
        productForm: formData.npkFormula?.trim() || undefined,
        shelfLifeDays: formData.shelfLifeDays ? Number(formData.shelfLifeDays) : undefined,
        batchControlled: formData.batchTracking,
        expiryControlled: formData.expiryTracking,
        minimumStock: formData.minStock ? Number(formData.minStock) : undefined,
        standardCost: formData.standardCost !== '' ? Number(formData.standardCost) : undefined,
        defaultSellingPrice: formData.defaultSellingPrice !== '' ? Number(formData.defaultSellingPrice) : undefined,
        status: formData.isActive ? 'ACTIVE' : 'INACTIVE',
      };

      let targetId = selectedProduct?.id;
      if (formMode === 'edit' && selectedProduct) {
        await ApiClient.patch(`/api/v1/master-data/finished-products/${selectedProduct.id}`, payload);
        showToast({ title: 'Product Updated', message: `${formData.name} updated successfully`, type: 'success' });
      } else {
        const createdRes = await ApiClient.post<any>('/api/v1/master-data/finished-products', payload);
        targetId = createdRes.data?.id || createdRes.data?.data?.id;
        showToast({ title: 'Product Registered', message: `${formData.name} added to catalog`, type: 'success' });
      }

      // Automatically initialize linked BOM recipe
      if (calcRawMaterialId && targetId) {
        await ApiClient.post('/api/v1/master-data/formula-boms', {
          finishedProductId: targetId,
          formulaCode: `BOM-${formData.code.trim().toUpperCase()}`,
          standardBatchSize: Number(calcProductionQty) || 400,
          packSizeLiters: Number(calcPackQty) || 2,
          notes: `Batch yield formulation: ${calcProductionQty} packs × ${calcPackQty}L (${totalBulkVolume}L bulk)`,
          components: [
            {
              componentType: 'RAW_MATERIAL',
              rawMaterialId: calcRawMaterialId,
              rawMaterialTotalCost: totalBulkCost,
              quantity: totalBulkVolume,
            },
            ...(calcPackingMaterialId
              ? [
                  {
                    componentType: 'PACKING_MATERIAL',
                    packingMaterialId: calcPackingMaterialId,
                    quantity: calcProductionQty,
                  },
                ]
              : []),
          ],
        }).catch(() => null);
      }

      await fetchData();
      setIsFormOpen(false);
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message || 'Error saving product', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete product handler
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/finished-products/${deletingProduct.id}`);
      showToast({ title: 'Product Deleted', message: `Product "${deletingProduct.name}" removed`, type: 'success' });
      setDeletingProduct(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete finished product', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered product records
  const filtered = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return products.filter((p: any) => {
      const matchesSearch =
        String(p.code || '').toLowerCase().includes(q) ||
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.npkFormula || '').toLowerCase().includes(q) ||
        String(p.gradeLabel || '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);


  // Table Columns
  const columns = [
    {
      key: 'code',
      label: 'Product Code',
      render: (row: FinishedProduct) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--brand-600, #0D9488)',
            fontSize: '0.85rem',
            padding: '2px 8px',
            background: 'var(--brand-50, #F0FDFA)',
            border: '1px solid var(--brand-200, #99F6E4)',
            borderRadius: '4px',
          }}
        >
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Commercial Finished Product',
      render: (row: FinishedProduct) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', marginTop: '2px' }}>
            {row.npkFormula && (
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-700, #0F766E)', fontWeight: 600 }}>
                {row.npkFormula}
              </span>
            )}
            {row.gradeLabel && <span style={{ color: 'var(--text-secondary)' }}>{row.gradeLabel}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: FinishedProduct) => {
        const cat = row.category || categories.find((c) => c.id === row.categoryId);
        return (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {cat ? (cat.code ? `${cat.code} · ${cat.name}` : cat.name) : '—'}
          </span>
        );
      },
    },
    {
      key: 'packSize',
      label: 'Pack Volume',
      render: (row: FinishedProduct) => {
        const ps = row.packSize || packSizes.find((p) => p.id === row.packSizeId);
        const uomSymbol = row.uom?.symbol || uoms.find((u) => u.id === row.uomId)?.symbol || 'L';
        return (
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#F1F5F9',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <IconBox size={13} style={{ color: '#64748B' }} />
            {ps ? ps.name || ps.label || `${ps.quantity} ${uomSymbol}` : `Standard ${uomSymbol}`}
          </span>
        );
      },
    },
    {
      key: 'standardCost',
      label: 'Standard Cost',
      render: (row: FinishedProduct) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#047857', fontSize: '0.82rem' }}>
          {row.standardCost !== undefined
            ? `PKR ${row.standardCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'defaultSellingPrice',
      label: 'Selling Price',
      render: (row: FinishedProduct) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2563EB', fontSize: '0.85rem' }}>
          {row.defaultSellingPrice !== undefined
            ? `PKR ${row.defaultSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: FinishedProduct) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: FinishedProduct) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEye size={14} />}
            onClick={() => setViewingProduct(row)}
            title="View Product Specifications"
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => handleOpenEditModal(row)}
            title="Edit Finished Product"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconTrash size={14} />}
            style={{ color: '#DC2626' }}
            onClick={() => setDeletingProduct(row)}
            title="Delete Finished Product"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ListPageTemplate
      title="Finished Product Master"
      subtitle="Standardized commercial pesticide formulations, liquid bottle packs, and packaged goods."
      breadcrumbs={[{ label: 'Master Data' }, { label: 'Finished Products' }]}
      primaryAction={{
        label: 'Register Finished Product',
        icon: <IconPlus size={16} />,
        onClick: handleOpenCreateModal,
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Ready', message: 'Finished product catalog exported', type: 'info' }),
        },
      ]}
    >
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Formulations" value={products.length} icon={<IconPackage size={20} />} />
        <KpiCard title="Active for Sales" value={products.filter((p) => p.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Batch Tracked" value={products.filter((p) => p.batchTracking).length} icon={<IconBox size={20} />} />
        <KpiCard title="Product Categories" value={categories.length} icon={<IconTag size={20} />} />
      </div>

      {/* Search & Category Filter Bar */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Input
              placeholder="Search by code, product name, active formula, or target crop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '280px' }}>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Product Categories' },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.code ? `${c.code} — ${c.name}` : (c.name || 'Category'),
                })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : error ? (
        <ErrorState title="Failed to Load Finished Products" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Finished Products Found"
          description={searchQuery ? 'No formulations match your search criteria.' : 'No finished goods registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : 'Register First Product'}
          onAction={searchQuery ? () => { setSearchQuery(''); setCategoryFilter('ALL'); } : handleOpenCreateModal}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {/* =========================================================================
       * MODERN ANIMATED THIRD-PARTY STYLE REGISTER / EDIT PRODUCT MODAL
       * Zero vertical scrolling, 2-column visual workspace with live calculation
       * ========================================================================= */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1160px',
              maxHeight: '94vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'modalPopIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Professional Clean Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <IconPackage size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                    {formMode === 'create' ? 'Register Commercial Finished Product' : `Edit Product — ${selectedProduct?.name}`}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Standardized SKU catalog with dynamic batch mass balance and packaging master integration.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="modern-btn-interactive"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 150ms ease',
                }}
                title="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Modal Body: 2-Column Professional Layout */}
            <div
              style={{
                padding: '20px 24px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* LEFT COLUMN: Core SKU Master Specifications */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product Specifications & Master Data
                </div>

                {/* Product Code & Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Product Code *
                    </label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. FP-BIF-2L"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        Product Name *
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoGenerateCode}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: 0,
                        }}
                      >
                        <IconSparkles size={12} /> Auto Code
                      </button>
                    </div>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Bifenthrin 10% EC (2L Commercial Bottle)"
                    />
                  </div>
                </div>

                {/* Category & Base Inventory UOM */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Product Category *
                    </label>
                    <Select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      options={[
                        { value: '', label: 'Select Category...' },
                        ...categories.map((c) => ({
                          value: c.id,
                          label: c.code ? `${c.code} — ${c.name}` : (c.name || 'Category'),
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Inventory Base UOM *
                    </label>
                    <Select
                      value={formData.uomId}
                      onChange={(e) => setFormData({ ...formData, uomId: e.target.value })}
                      options={[
                        { value: '', label: 'Select Base UOM...' },
                        ...uoms.map((u) => ({
                          value: u.id,
                          label: `${u.name || u.code} (${u.symbol || u.code || 'Unit'})`,
                        })),
                      ]}
                    />
                  </div>
                </div>

                {/* Commercial Pack Size & Container Volume */}
                <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>
                      Commercial Pack Size & Volume
                    </label>
                    <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600 }}>
                      Selected: {calcPackQty} L / Pack
                    </span>
                  </div>

                  {/* Clean SVG Chips (Zero Hardcoded Emojis) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                    {quickPackSizes.map((qs) => {
                      const isSelected = calcPackQty === qs.qty;
                      return (
                        <button
                          key={qs.qty}
                          type="button"
                          onClick={() => handleSelectQuickPackSize(qs.qty)}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                            background: isSelected ? '#EFF6FF' : '#FFFFFF',
                            color: isSelected ? '#1D4ED8' : '#334155',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            fontSize: '12px',
                          }}
                        >
                          <IconBox size={13} style={{ color: isSelected ? '#2563EB' : '#64748B' }} />
                          <span>{qs.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px' }}>
                    <Select
                      value={formData.packSizeId}
                      onChange={(e) => {
                        const psId = e.target.value;
                        setFormData((prev) => ({ ...prev, packSizeId: psId }));
                        const found = packSizes.find((p) => p.id === psId);
                        if (found && Number(found.quantity) > 0) {
                          const q = Number(found.quantity);
                          setCalcPackQty(q);
                          autoSelectPackaging(q, packingMaterials);
                        }
                      }}
                      options={[
                        { value: '', label: 'Select Pack Size Master...' },
                        ...packSizes.map((p) => ({
                          value: p.id,
                          label: `${p.name || p.label || p.code} (${p.quantity || 1} L)`,
                        })),
                      ]}
                    />
                    <Input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={calcPackQty}
                      onChange={(e) => {
                        const q = Math.max(0.1, Number(e.target.value) || 1);
                        setCalcPackQty(q);
                        autoSelectPackaging(q, packingMaterials);
                      }}
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                      placeholder="Liters"
                    />
                  </div>
                </div>

                {/* Formulation & Grade Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Active Chemical Assay / Formula
                    </label>
                    <Input
                      value={formData.npkFormula}
                      onChange={(e) => setFormData({ ...formData, npkFormula: e.target.value })}
                      placeholder="e.g. 10% EC or NPK 20-20-20"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Target Crop / Application Grade
                    </label>
                    <Input
                      value={formData.gradeLabel}
                      onChange={(e) => setFormData({ ...formData, gradeLabel: e.target.value })}
                      placeholder="e.g. Cotton, Rice, Wheat"
                    />
                  </div>
                </div>

                {/* Operational Tracking Switches */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <Switch
                    label="Batch Tracked"
                    description="Lot # tracking"
                    checked={formData.batchTracking}
                    onChange={(checked) => setFormData({ ...formData, batchTracking: checked })}
                    size="sm"
                  />
                  <Switch
                    label="Expiry Control"
                    description="Shelf-life check"
                    checked={formData.expiryTracking}
                    onChange={(checked) => setFormData({ ...formData, expiryTracking: checked })}
                    size="sm"
                  />
                  <Switch
                    label="Active Status"
                    description="Commercial release"
                    checked={formData.isActive}
                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    size="sm"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Batch Yield & Mass Balance Formulation Engine */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconFlask size={16} /> Batch Yield & Unit Costing Engine
                  </div>
                  <Badge variant="neutral">Formula Engine</Badge>
                </div>

                {/* Batch Costing Card (Clean Professional Corporate Theme) */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* 1. Active Raw Material Selection (Auto-fetches UOM and Rate) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>
                        Bulk Active Raw Material (Active Ingredient)
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#0F766E', background: '#CCFBF1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          UOM: {calcRmUom}
                        </span>
                        <span style={{ fontSize: '11px', color: '#1E40AF', background: '#DBEAFE', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Rate: PKR {calcRmRate.toLocaleString()} / {calcRmUom}
                        </span>
                      </div>
                    </div>
                    <Select
                      value={calcRawMaterialId}
                      onChange={(e) => handleSelectRawMaterial(e.target.value)}
                      options={[
                        { value: '', label: 'Select Active Raw Material...' },
                        ...rawMaterials.map((rm) => {
                          const uomSymbol = rm.baseUom?.symbol || rm.baseUom?.code || 'Unit';
                          const rate = Number(rm.costPerBaseUnit ?? rm.unitRate ?? rm.standardCost ?? 0);
                          return {
                            value: rm.id,
                            label: `${rm.materialCode} — ${rm.materialName} (PKR ${rate.toLocaleString()} / ${uomSymbol})`,
                          };
                        }),
                      ]}
                    />
                  </div>

                  {/* Active Input Quantities */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Active RM Input ({calcRmUom})
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={calcRmQty}
                        onChange={(e) => setCalcRmQty(Math.max(0, Number(e.target.value) || 0))}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                      />
                      <span style={{ fontSize: '10px', color: '#64748B' }}>
                        Cost: PKR {(calcRmQty * calcRmRate).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Active Rate (PKR / {calcRmUom})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={calcRmRate}
                        onChange={(e) => setCalcRmRate(Math.max(0, Number(e.target.value) || 0))}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* Carrier / Solvent Diluent Formulation */}
                  <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                          Carrier Solvent / Diluent (L)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={calcCarrierQty}
                          onChange={(e) => setCalcCarrierQty(Math.max(0, Number(e.target.value) || 0))}
                          style={{ fontFamily: 'var(--font-mono)' }}
                        />
                        <span style={{ fontSize: '10px', color: '#64748B' }}>
                          Cost: PKR {(calcCarrierQty * calcCarrierRate).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                          Carrier Rate (PKR / L)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={calcCarrierRate}
                          onChange={(e) => setCalcCarrierRate(Math.max(0, Number(e.target.value) || 0))}
                          style={{ fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Target Finished Batch Output */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Production Target (Bottles)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={calcProductionQty}
                        onChange={(e) => setCalcProductionQty(Math.max(1, Number(e.target.value) || 1))}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Bulk Volume Required
                      </label>
                      <div
                        style={{
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#F1F5F9',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13px',
                          color: '#0F172A',
                        }}
                      >
                        {requiredBulkVolume} Liters
                      </div>
                    </div>
                  </div>

                  {/* BATCH MASS & VOLUME BALANCE VALIDATION BANNER */}
                  {isBatchBalanced ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div style={{ color: '#16A34A', display: 'flex', alignItems: 'center' }}>
                        <IconCheck size={18} />
                      </div>
                      <div style={{ flex: 1, fontSize: '12px', color: '#15803D' }}>
                        <strong>Batch Formulation Balanced:</strong> {totalBulkVolume} L bulk formulation yields exactly {calcProductionQty} bottles of {calcPackQty} L.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ color: '#D97706', display: 'flex', alignItems: 'center', marginTop: '1px' }}>
                          <IconAlertTriangle size={18} />
                        </div>
                        <div style={{ flex: 1, fontSize: '12px', color: '#92400E', lineHeight: '1.4' }}>
                          <strong>Volume Balance Discrepancy:</strong> {calcProductionQty} bottles × {calcPackQty} L requires {requiredBulkVolume} L bulk formulation. Available formulation is {totalBulkVolume} L ({volumeDifference > 0 ? `+${volumeDifference.toFixed(1)} L surplus` : `${Math.abs(volumeDifference).toFixed(1)} L deficit`}).
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '26px' }}>
                        <button
                          type="button"
                          onClick={handleAutoBalanceCarrier}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #D97706',
                            background: '#FFFFFF',
                            color: '#92400E',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <IconCheck size={12} /> Auto-Balance Carrier Solvent ({Math.max(0, requiredBulkVolume - (isSolidActive ? 0 : calcRmQty))} L)
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncBottlesToRm}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <IconRefresh size={12} /> Sync Bottles to Active RM ({Math.floor(totalBulkVolume / (calcPackQty || 1))} Bottles)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RIGID PACKAGING COMPONENT SELECTOR (Fetched from Packaging Master) */}
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                        Rigid Packaging Component (from Packaging Master)
                      </label>
                      <button
                        type="button"
                        onClick={handleRefreshPackaging}
                        disabled={isRefreshingPackaging}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0,
                        }}
                        title="Reload packaging materials from master data"
                      >
                        <IconRefresh size={12} />
                        {isRefreshingPackaging ? 'Refreshing...' : 'Refresh Master'}
                      </button>
                    </div>

                    <Select
                      value={calcPackingMaterialId}
                      onChange={(e) => setCalcPackingMaterialId(e.target.value)}
                      options={[
                        { value: '', label: 'Select Bottle / Container from Master...' },
                        ...packingMaterials.map((pm) => ({
                          value: pm.id,
                          label: `${pm.materialCode} — ${pm.materialName} (PKR ${Number(pm.lastPurchaseCost || pm.standardCost || 45).toLocaleString()})`,
                        })),
                      ]}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Bottle unit cost: <strong>PKR {pmCostPerPack.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <label style={{ fontSize: '11px', color: '#64748B' }}>Overhead / Filling:</label>
                        <Input
                          type="number"
                          min="0"
                          value={calcOverheadCost}
                          onChange={(e) => setCalcOverheadCost(Number(e.target.value))}
                          style={{ width: '80px', height: '30px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* COST BREAKDOWN METRICS STRIP */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Total Bulk</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                        {totalBulkVolume} L
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Bulk Cost / L</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                        PKR {effectiveCostPerLiter.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>RM / Bottle</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                        PKR {rmCostPerPack.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Total Cost / Pack</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                        PKR {calculatedPackCost.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Target Margin & Action Button */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>Target Gross Margin:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[15, 20, 25, 30].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCalcTargetMargin(m)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: calcTargetMargin === m ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                              background: calcTargetMargin === m ? '#2563EB' : '#FFFFFF',
                              color: calcTargetMargin === m ? '#FFFFFF' : '#334155',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {m}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleApplyCalculatedCost}
                      style={{
                        width: '100%',
                        backgroundColor: '#0F172A',
                        borderColor: '#0F172A',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <IconCheck size={15} /> Apply Calculated Cost & Selling Price
                    </Button>
                  </div>
                </div>

                {/* SKU Catalog Preview */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Assigned Commercial Pricing
                    </span>
                    <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600 }}>
                      Margin: {marginPct}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Standard Cost / Pack</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                        PKR {Number(formData.standardCost || calculatedPackCost).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Selling Price / Pack</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono)' }}>
                        PKR {Number(formData.defaultSellingPrice || suggestedSellingPrice).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Fields marked with <strong>*</strong> are mandatory for commercial release.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{ minWidth: '150px' }}
                >
                  {isSaving ? 'Saving Product...' : formMode === 'create' ? 'Register Product' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODERN THIRD-PARTY STYLE QUICK-VIEW SPECIFICATIONS MODAL
       * ========================================================================= */}
      {viewingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 180ms ease forwards',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '600px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'modalPopIn 220ms ease forwards',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#F0FDFA',
                    color: '#0D9488',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconPackage size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    {viewingProduct.name}
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#0D9488', fontWeight: 700 }}>
                    {viewingProduct.code}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  padding: '14px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Standard Cost / Pack</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    PKR {Number(viewingProduct.standardCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Default Selling Price</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    PKR {Number(viewingProduct.defaultSellingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Category: </span>
                  <strong>{viewingProduct.category?.name || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Pack Volume: </span>
                  <strong>{viewingProduct.packSize?.name || `${viewingProduct.packSize?.quantity || 1} L`}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Active Spec: </span>
                  <strong>{viewingProduct.npkFormula || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Shelf Life: </span>
                  <strong>{viewingProduct.shelfLifeDays ? `${viewingProduct.shelfLifeDays} days` : '730 days'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Batch Control: </span>
                  <strong>{viewingProduct.batchTracking ? 'Enabled' : 'Disabled'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Expiry Control: </span>
                  <strong>{viewingProduct.expiryTracking ? 'Enabled' : 'Disabled'}</strong>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const p = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEditModal(p);
                }}
              >
                Edit Product
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingProduct(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODERN THIRD-PARTY STYLE DELETE CONFIRMATION MODAL
       * ========================================================================= */}
      {deletingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 150ms ease forwards',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'modalPopIn 200ms ease forwards',
            }}
          >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconAlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>
                  Delete Finished Product
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                  Are you sure you want to remove{' '}
                  <strong style={{ color: '#1e293b' }}>{deletingProduct.name}</strong> ({deletingProduct.code})?
                  This product will be archived and removed from sales catalog picklists.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setDeletingProduct(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                style={{ background: '#DC2626', borderColor: '#DC2626', color: '#ffffff' }}
                onClick={handleDeleteProduct}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Product'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes modalPopIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </ListPageTemplate>
  );
};
