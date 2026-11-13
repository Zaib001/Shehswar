'use client';

/**
 * SHEHSWAR ONE360 - Warehouse Stock & Inventory Management
 *
 * Real-Time Warehouse Stock:
 * - Single source of truth for Raw Materials, Packing Materials, Finished Goods & Other items
 * - Comprehensive filtering by Product Type (All, RM, PM, FP, Other + dynamic categories)
 * - Strict Warehouse-level inventory filtering
 * - Unified multi-field search (product, code, batch, pack size, category, warehouse)
 * - Clean, compact, keyboard-friendly UI consistent with the Shehswar ERP Design System
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ListPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  KpiCard,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconRefresh,
  IconTrash,
  IconSearch,
  IconClose,
  IconBox,
  IconFlask,
  IconPackage,
  IconCheck,
  IconFilter,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface WarehouseStockRecord {
  id: string;
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string; location?: string };
  itemType: string;
  rawMaterialId?: string;
  packingMaterialId?: string;
  finishedProductId?: string;
  rawMaterial?: {
    id: string;
    materialCode: string;
    materialName: string;
    urduName?: string;
    description?: string;
    grade?: string;
    customFields?: any;
    baseUom?: { id: string; name: string; code: string; symbol?: string };
    category?: { id: string; name: string; code: string };
  };
  packingMaterial?: {
    id: string;
    materialCode: string;
    materialName: string;
    urduName?: string;
    description?: string;
    packCompatibility?: string;
    customFields?: any;
    baseUom?: { id: string; name: string; code: string; symbol?: string };
    category?: { id: string; name: string; code: string };
  };
  finishedProduct?: {
    id: string;
    productCode: string;
    productName: string;
    urduName?: string;
    productType?: string;
    mType?: string;
    packingQuantity?: number;
    packingUnit?: string;
    ppc?: number;
    customFields?: any;
    baseUom?: { id: string; name: string; code: string; symbol?: string };
    packSize?: { id: string; name: string; code: string };
    category?: { id: string; name: string; code: string };
    batches?: Array<{ id: string; batchNumber: string; availableQuantity: number; isActive: boolean }>;
  };
  quantityOnHand: number | string;
  averageCost?: number | string;
  lastUpdated: string;
}

// ── Item Information Extractors ──────────────────────────────────────────

export function getItemName(s: WarehouseStockRecord): string {
  return (
    s.rawMaterial?.materialName ||
    s.packingMaterial?.materialName ||
    s.finishedProduct?.productName ||
    'Unknown Item'
  );
}

export function getItemCode(s: WarehouseStockRecord): string {
  return (
    s.rawMaterial?.materialCode ||
    s.packingMaterial?.materialCode ||
    s.finishedProduct?.productCode ||
    'N/A'
  );
}

export function getItemUrduName(s: WarehouseStockRecord): string | undefined {
  return s.rawMaterial?.urduName || s.packingMaterial?.urduName || s.finishedProduct?.urduName;
}

export function getItemCategory(s: WarehouseStockRecord): string | undefined {
  return (
    s.finishedProduct?.mType ||
    s.finishedProduct?.productType ||
    s.finishedProduct?.category?.name ||
    s.rawMaterial?.category?.name ||
    s.packingMaterial?.category?.name
  );
}

export function getItemPackSize(s: WarehouseStockRecord): string {
  if (s.itemType === 'FINISHED_PRODUCT' && s.finishedProduct) {
    const fp = s.finishedProduct;
    if (fp.packingQuantity) {
      return `${Number(fp.packingQuantity)} ${fp.packingUnit || 'LTR'}`.trim();
    }
    if (fp.packSize?.name) return fp.packSize.name;
    if (fp.customFields?.packSize) return String(fp.customFields.packSize);
    return '1 Unit';
  }

  if (s.itemType === 'PACKING_MATERIAL' && s.packingMaterial) {
    const pm = s.packingMaterial;
    if (pm.customFields?.packSize) return String(pm.customFields.packSize);
    if (pm.packCompatibility) return pm.packCompatibility;
    if (pm.description && pm.description.length <= 20) return pm.description;
    return '1 NOS';
  }

  if (s.itemType === 'RAW_MATERIAL' && s.rawMaterial) {
    const rm = s.rawMaterial;
    if (rm.customFields?.packSize) return String(rm.customFields.packSize);
    if (rm.grade) return rm.grade;
    if (rm.description && rm.description.length <= 20) return rm.description;
    return 'Bulk';
  }

  return '1 Unit';
}

export function getItemBatch(s: WarehouseStockRecord): string {
  if (s.itemType === 'FINISHED_PRODUCT' && s.finishedProduct?.batches && s.finishedProduct.batches.length > 0) {
    const activeBatch = s.finishedProduct.batches.find((b) => b.isActive) || s.finishedProduct.batches[0];
    if (activeBatch?.batchNumber) return activeBatch.batchNumber;
  }

  const customBatch =
    s.finishedProduct?.customFields?.batchNumber ||
    s.rawMaterial?.customFields?.batchNumber ||
    s.packingMaterial?.customFields?.batchNumber;

  if (customBatch) return String(customBatch);

  return '—';
}

export function getItemUom(s: WarehouseStockRecord): string {
  if (s.itemType === 'FINISHED_PRODUCT') {
    return (
      s.finishedProduct?.baseUom?.symbol ||
      s.finishedProduct?.baseUom?.code ||
      s.finishedProduct?.packingUnit ||
      'NOS'
    );
  }
  if (s.itemType === 'RAW_MATERIAL') {
    return s.rawMaterial?.baseUom?.symbol || s.rawMaterial?.baseUom?.code || 'KG';
  }
  if (s.itemType === 'PACKING_MATERIAL') {
    return s.packingMaterial?.baseUom?.symbol || s.packingMaterial?.baseUom?.code || 'NOS';
  }
  return 'NOS';
}

export function getTypeBadgeInfo(itemType: string): {
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (itemType) {
    case 'RAW_MATERIAL':
      return { label: 'Raw Material', short: 'RM', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    case 'PACKING_MATERIAL':
      return { label: 'Packaging', short: 'PM', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    case 'FINISHED_PRODUCT':
      return { label: 'Finished Product', short: 'FP', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
    default:
      return {
        label: itemType ? itemType.replace(/_/g, ' ') : 'Other',
        short: 'Other',
        color: '#b45309',
        bg: '#fffbeb',
        border: '#fde68a',
      };
  }
}

export const WarehouseStockView: React.FC = () => {
  const { showToast } = useToast();
  const [stocks, setStocks] = useState<WarehouseStockRecord[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // ── 1. Data Fetching (Live DB) ──────────────────────────────────────────
  const loadData = useCallback(
    async (targetWarehouseId?: string) => {
      setIsLoading(true);
      try {
        const activeWh = targetWarehouseId !== undefined ? targetWarehouseId : warehouseFilter;
        const whParam = activeWh && activeWh !== 'ALL' ? `?warehouseId=${encodeURIComponent(activeWh)}` : '';

        const [stockRes, whRes] = await Promise.all([
          ApiClient.get<any>(`/api/v1/warehouse-stock/report${whParam}`).catch(() => ({ data: [] })),
          ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ]);

        const stockList: WarehouseStockRecord[] = Array.isArray(stockRes.data)
          ? stockRes.data
          : stockRes.data?.data || [];
        const whList: any[] = Array.isArray(whRes.data)
          ? whRes.data
          : whRes.data?.data || [];

        setStocks(stockList);
        setWarehouses(whList);
      } catch (err: any) {
        showToast({ title: 'Error', message: 'Failed to load warehouse stock report', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    },
    [warehouseFilter, showToast]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── 2. Warehouse Change Handler ─────────────────────────────────────────
  const handleWarehouseChange = (whId: string) => {
    setWarehouseFilter(whId);
    setSelectedStockIds([]);
    loadData(whId);
  };

  // ── 3. Dynamic Future-Proof Categories Discovery ────────────────────────
  const dynamicCategories = useMemo(() => {
    const standardTypes = new Set(['RAW_MATERIAL', 'PACKING_MATERIAL', 'FINISHED_PRODUCT', 'OTHER', 'OTHER_MATERIAL']);
    const dynamicSet = new Set<string>();

    stocks.forEach((s) => {
      if (s.itemType && !standardTypes.has(s.itemType.toUpperCase())) {
        dynamicSet.add(s.itemType);
      }
      const catName = getItemCategory(s);
      if (catName && !standardTypes.has(catName.toUpperCase())) {
        dynamicSet.add(catName);
      }
    });

    return Array.from(dynamicSet);
  }, [stocks]);

  // Helper to test if a record matches a selected type tab
  const matchesTypeFilter = useCallback((s: WarehouseStockRecord, typeId: string): boolean => {
    if (typeId === 'ALL') return true;
    const catName = getItemCategory(s);
    const isOtherCategory = (catName || '').toLowerCase().includes('other');

    if (typeId === 'OTHER') {
      const isStandard = ['RAW_MATERIAL', 'PACKING_MATERIAL', 'FINISHED_PRODUCT'].includes(s.itemType);
      return !isStandard || s.itemType === 'OTHER' || s.itemType === 'OTHER_MATERIAL' || isOtherCategory;
    }
    if (typeId === 'RAW_MATERIAL') {
      return s.itemType === 'RAW_MATERIAL' && !isOtherCategory;
    }
    if (typeId === 'PACKING_MATERIAL') {
      return s.itemType === 'PACKING_MATERIAL' && !isOtherCategory;
    }
    if (typeId === 'FINISHED_PRODUCT') return s.itemType === 'FINISHED_PRODUCT';
    // Dynamic category/type match
    return s.itemType === typeId || catName === typeId;
  }, []);

  // ── 4. Type Tabs Configuration with Live Counts ─────────────────────────
  const typeTabs = useMemo(() => {
    // Counts respect the selected warehouse
    const baseStocks = stocks.filter((s) => {
      return warehouseFilter === 'ALL' || s.warehouseId === warehouseFilter;
    });

    const getCount = (typeId: string) => {
      return baseStocks.filter((s) => matchesTypeFilter(s, typeId)).length;
    };

    const tabs = [
      {
        id: 'ALL',
        label: 'All Products',
        shortLabel: 'All',
        icon: <IconBox size={14} />,
        count: baseStocks.length,
        activeColor: '#0f172a',
        activeBg: '#f8fafc',
        activeBorder: '#cbd5e1',
      },
      {
        id: 'RAW_MATERIAL',
        label: 'Raw Materials (RM)',
        shortLabel: 'RM',
        icon: <IconFlask size={14} />,
        count: getCount('RAW_MATERIAL'),
        activeColor: '#1d4ed8',
        activeBg: '#eff6ff',
        activeBorder: '#bfdbfe',
      },
      {
        id: 'PACKING_MATERIAL',
        label: 'Packing Materials (PM)',
        shortLabel: 'PM',
        icon: <IconPackage size={14} />,
        count: getCount('PACKING_MATERIAL'),
        activeColor: '#7c3aed',
        activeBg: '#f5f3ff',
        activeBorder: '#ddd6fe',
      },
      {
        id: 'FINISHED_PRODUCT',
        label: 'Finished Products (FP)',
        shortLabel: 'FP',
        icon: <IconCheck size={14} />,
        count: getCount('FINISHED_PRODUCT'),
        activeColor: '#047857',
        activeBg: '#ecfdf5',
        activeBorder: '#a7f3d0',
      },
      {
        id: 'OTHER',
        label: 'Other Products',
        shortLabel: 'Other',
        icon: <IconFilter size={14} />,
        count: getCount('OTHER'),
        activeColor: '#b45309',
        activeBg: '#fffbeb',
        activeBorder: '#fde68a',
      },
    ];

    // Automatically append any additional discovered categories without frontend redesign
    dynamicCategories.forEach((cat) => {
      tabs.push({
        id: cat,
        label: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        shortLabel: cat,
        icon: <IconBox size={14} />,
        count: getCount(cat),
        activeColor: '#0284c7',
        activeBg: '#f0f9ff',
        activeBorder: '#bae6fd',
      });
    });

    return tabs;
  }, [stocks, warehouseFilter, dynamicCategories, matchesTypeFilter]);

  // ── 5. Filtering: Warehouse + Type + Search ──────────────────────────────
  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return stocks.filter((s) => {
      // 1. Warehouse filter
      const matchesWh = warehouseFilter === 'ALL' || s.warehouseId === warehouseFilter;
      if (!matchesWh) return false;

      // 2. Type tab filter
      const matchesType = matchesTypeFilter(s, selectedType);
      if (!matchesType) return false;

      // 3. Search query filter
      if (!q) return true;

      const name = getItemName(s).toLowerCase();
      const code = getItemCode(s).toLowerCase();
      const batch = getItemBatch(s).toLowerCase();
      const pack = getItemPackSize(s).toLowerCase();
      const uom = getItemUom(s).toLowerCase();
      const category = (getItemCategory(s) || '').toLowerCase();
      const whName = (s.warehouse?.name || '').toLowerCase();
      const whCode = (s.warehouse?.code || '').toLowerCase();
      const urdu = (getItemUrduName(s) || '').toLowerCase();

      return (
        name.includes(q) ||
        code.includes(q) ||
        batch.includes(q) ||
        pack.includes(q) ||
        uom.includes(q) ||
        category.includes(q) ||
        whName.includes(q) ||
        whCode.includes(q) ||
        urdu.includes(q)
      );
    });
  }, [stocks, warehouseFilter, selectedType, searchQuery, matchesTypeFilter]);

  // ── 6. Operational Stock Quantities & Counts ─────────────────────────────
  const totalItemsCount = stocks.length;
  const filteredTotalQty = filteredStocks.reduce(
    (sum, s) => sum + Number(s.quantityOnHand || 0),
    0
  );
  const rmCount = stocks.filter((s) => s.itemType === 'RAW_MATERIAL').length;
  const pmCount = stocks.filter((s) => s.itemType === 'PACKING_MATERIAL').length;
  const fpCount = stocks.filter((s) => s.itemType === 'FINISHED_PRODUCT').length;

  // ── 7. Bulk Actions & Management Handlers ────────────────────────────────
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStockIds(filteredStocks.map((s) => s.id));
    } else {
      setSelectedStockIds([]);
    }
  };

  const handleToggleSelectStock = (id: string) => {
    setSelectedStockIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleDeleteStockItem = async (s: WarehouseStockRecord) => {
    const name = getItemName(s);
    const whName = s.warehouse?.name || 'Warehouse';
    if (
      !window.confirm(
        `Are you sure you want to permanently delete/clear the stock record for "${name}" from "${whName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setIsActionLoading(true);
      await ApiClient.delete(`/api/v1/warehouse-stock/${s.id}`);
      showToast({
        title: 'Stock Removed',
        message: `Stock entry for ${name} has been deleted.`,
        type: 'success',
      });
      setSelectedStockIds((prev) => prev.filter((id) => id !== s.id));
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Deletion Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to delete stock item',
        type: 'error',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteSelectedStock = async () => {
    if (selectedStockIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the ${selectedStockIds.length} selected stock records? This will clear stock levels for these items.`
      )
    ) {
      return;
    }

    try {
      setIsActionLoading(true);
      await ApiClient.delete('/api/v1/warehouse-stock/bulk', {
        ids: selectedStockIds,
      });
      showToast({
        title: 'Bulk Stock Delete Successful',
        message: `${selectedStockIds.length} stock records deleted.`,
        type: 'success',
      });
      setSelectedStockIds([]);
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Bulk Deletion Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to delete selected stock records',
        type: 'error',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePurgeAllStock = async () => {
    const whLabel =
      warehouseFilter !== 'ALL'
        ? `in selected warehouse "${warehouses.find((w) => w.id === warehouseFilter)?.name || warehouseFilter}"`
        : 'across ALL warehouses';

    if (
      !window.confirm(
        `⚠️ WARNING: Are you sure you want to PURGE AND CLEAR ALL STOCK ${whLabel}? This will permanently remove all stock records and ledger movements. This action CANNOT be undone.`
      )
    ) {
      return;
    }

    try {
      setIsActionLoading(true);
      const url = `/api/v1/warehouse-stock/purge/all${warehouseFilter !== 'ALL' ? `?warehouseId=${warehouseFilter}` : ''}`;
      await ApiClient.delete(url);
      showToast({
        title: 'All Stock Purged',
        message: `Inventory stock has been completely reset.`,
        type: 'success',
      });
      setSelectedStockIds([]);
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Purge Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to purge stock',
        type: 'error',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── 8. Table Columns Specification ──────────────────────────────────────
  // | Product | Code | Type | Pack Size | Batch | Available Qty | UoM | Warehouse |
  const columns: ColumnDef<WarehouseStockRecord>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={filteredStocks.length > 0 && selectedStockIds.length === filteredStocks.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          title="Select All Stock Items"
        />
      ),
      render: (s) => (
        <input
          type="checkbox"
          checked={selectedStockIds.includes(s.id)}
          onChange={() => handleToggleSelectStock(s.id)}
          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
        />
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (s) => {
        const name = getItemName(s);
        const urdu = getItemUrduName(s);
        const cat = getItemCategory(s);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '180px' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
              {name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {urdu && (
                <span style={{ fontSize: '11px', color: '#64748b' }} dir="rtl">
                  {urdu}
                </span>
              )}
              {cat && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#475569',
                    backgroundColor: '#f1f5f9',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {cat}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'code',
      header: 'Code',
      render: (s) => {
        const code = getItemCode(s);
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              fontSize: '11.5px',
              color: '#0369a1',
              backgroundColor: '#e0f2fe',
              padding: '2px 7px',
              borderRadius: '5px',
              border: '1px solid #bae6fd',
              whiteSpace: 'nowrap',
            }}
          >
            {code}
          </span>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (s) => {
        const typeInfo = getTypeBadgeInfo(s.itemType);
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: typeInfo.bg,
              color: typeInfo.color,
              border: `1px solid ${typeInfo.border}`,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{typeInfo.short}</span>
          </span>
        );
      },
    },
    {
      key: 'packSize',
      header: 'Pack Size',
      render: (s) => {
        const pack = getItemPackSize(s);
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              whiteSpace: 'nowrap',
            }}
          >
            {pack}
          </span>
        );
      },
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (s) => {
        const batch = getItemBatch(s);
        if (batch === '—') {
          return <span style={{ color: '#94a3b8', fontSize: '13px' }}>—</span>;
        }
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#1d4ed8',
              backgroundColor: '#eff6ff',
              padding: '2px 7px',
              borderRadius: '5px',
              border: '1px solid #bfdbfe',
              whiteSpace: 'nowrap',
            }}
          >
            {batch}
          </span>
        );
      },
    },
    {
      key: 'quantityOnHand',
      header: 'Available Qty',
      render: (s) => {
        const qty = Number(s.quantityOnHand || 0);
        return (
          <div style={{ textAlign: 'right', minWidth: '90px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 800,
                fontSize: '14px',
                color: qty > 0 ? '#0f172a' : '#dc2626',
              }}
            >
              {qty.toLocaleString()}
            </span>
          </div>
        );
      },
    },
    {
      key: 'uom',
      header: 'UoM',
      render: (s) => {
        const uom = getItemUom(s);
        return (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#f1f5f9',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {uom}
          </span>
        );
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (s) => {
        const whName = s.warehouse?.name || 'Main Warehouse';
        const whCode = s.warehouse?.code;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            {whCode && (
              <span
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 700,
                  color: '#0f766e',
                  backgroundColor: '#f0fdfa',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid #ccfbf1',
                }}
              >
                {whCode}
              </span>
            )}
            <span style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>
              {whName}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <button
          type="button"
          disabled={isActionLoading}
          onClick={() => handleDeleteStockItem(s)}
          style={{
            border: 'none',
            background: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          title="Delete Stock Record"
        >
          <IconTrash size={13} />
        </button>
      ),
    },
  ];

  return (
    <ListPageTemplate
      title="Warehouse Stocks"
      subtitle="Physical inventory on hand across warehouses. Filter by material classification, batch, or warehouse location."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => loadData()} disabled={isActionLoading}>
            <IconRefresh size={15} /> Refresh Stock
          </Button>
          <Button
            variant="outline"
            onClick={handlePurgeAllStock}
            disabled={isActionLoading || stocks.length === 0}
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
          >
            <IconTrash size={15} /> Purge All
          </Button>
        </div>
      }
    >
      {/* ── Operational Inventory Counts ─────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <KpiCard
          title="Total Stock Tracked"
          value={`${totalItemsCount} Items`}
          subtitle="Physical catalog items across warehouses"
        />
        <KpiCard
          title="Raw Materials (RM)"
          value={`${rmCount} Items`}
          subtitle="Production chemical inputs"
        />
        <KpiCard
          title="Packing Materials (PM)"
          value={`${pmCount} Items`}
          subtitle="Bottles, caps, labels & cartons"
        />
        <KpiCard
          title="Finished Products (FP)"
          value={`${fpCount} Items`}
          subtitle="Available for sale & dispatch"
        />
      </div>

      {/* ── Bulk Action Toolbar ──────────────────────────────────────────── */}
      {selectedStockIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>
            ✓ {selectedStockIds.length} stock {selectedStockIds.length === 1 ? 'item' : 'items'} selected
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedStockIds([])}
              style={{ fontSize: '12px' }}
            >
              Deselect All
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteSelectedStock}
              disabled={isActionLoading}
              style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c', fontSize: '12px' }}
            >
              <IconTrash size={14} /> Delete Selected ({selectedStockIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* ── Top Filtering Panel: Warehouse & Search ───────────────────────── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          padding: '16px 20px',
          marginBottom: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          {/* Warehouse Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Warehouse:
            </label>
            <Select
              value={warehouseFilter}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              options={[
                { label: 'All Warehouses', value: 'ALL' },
                ...warehouses.map((w) => ({
                  label: w.code ? `${w.code} - ${w.name}` : w.name,
                  value: w.id,
                })),
              ]}
            />
          </div>

          {/* Search Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Search:
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <IconSearch
                size={15}
                style={{
                  position: 'absolute',
                  left: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <Input
                placeholder="Search product, code, batch, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', paddingRight: searchQuery ? '32px' : '10px', height: '38px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    border: 'none',
                    background: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear search"
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Required Stock Filter Tabs / Chips ─────────────────────────── */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {typeTabs.map((tab) => {
              const isSelected = selectedType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: isSelected ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    border: isSelected
                      ? `1.5px solid ${tab.activeBorder || tab.activeColor}`
                      : '1.5px solid #e2e8f0',
                    backgroundColor: isSelected ? tab.activeBg : '#ffffff',
                    color: isSelected ? tab.activeColor : '#475569',
                    boxShadow: isSelected
                      ? '0 2px 6px rgba(0, 0, 0, 0.05)'
                      : '0 1px 2px rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '1px 7px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? '#ffffff' : '#f1f5f9',
                      color: isSelected ? tab.activeColor : '#64748b',
                      border: isSelected ? `1px solid ${tab.activeBorder || '#cbd5e1'}` : 'none',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Table Results ────────────────────────────────────────────────── */}
      {isLoading ? (
        <TableSkeleton rows={6} columns={8} />
      ) : filteredStocks.length === 0 ? (
        <EmptyState
          title="No Stock Records Found"
          description={
            searchQuery || selectedType !== 'ALL' || warehouseFilter !== 'ALL'
              ? 'No warehouse stock matches the current search and filter criteria. Try adjusting the filters or clearing the search.'
              : 'Warehouse stock is updated automatically whenever a Purchase Invoice, Production Batch, or Sale is posted.'
          }
          actionLabel={searchQuery || selectedType !== 'ALL' || warehouseFilter !== 'ALL' ? 'Reset All Filters' : undefined}
          onAction={() => {
            setSearchQuery('');
            setSelectedType('ALL');
            handleWarehouseChange('ALL');
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 4px',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <span>
              Showing <strong>{filteredStocks.length}</strong> of <strong>{stocks.length}</strong> stock items
            </span>
            <span>
              Total Available Qty: <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{filteredTotalQty.toLocaleString()}</strong>
            </span>
          </div>

          <DataTable columns={columns} data={filteredStocks} keyExtractor={(s) => s.id} />
        </div>
      )}
    </ListPageTemplate>
  );
};

export default WarehouseStockView;
