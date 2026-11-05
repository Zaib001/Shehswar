'use client';

/**
 * SHEHSWAR ONE360 - Warehouse Stock & Inventory Valuation UI
 *
 * Follows Canonical Flow:
 * - Real-Time Stock On Hand (updated ONLY through central InventoryService)
 * - Single source of truth for Raw Materials, Packing Materials, and Finished Goods
 * - Average Costing & Total Inventory Valuation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate } from '../templates';
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
} from '../ui';
import { IconRefresh, IconTrash } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface WarehouseStockRecord {
  id: string;
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  itemType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
  rawMaterialId?: string;
  packingMaterialId?: string;
  finishedProductId?: string;
  rawMaterial?: { id: string; materialCode: string; materialName: string };
  packingMaterial?: { id: string; materialCode: string; materialName: string };
  finishedProduct?: { id: string; productCode: string; productName: string };
  quantityOnHand: number;
  averageCost: number;
  lastUpdated: string;
}

export const WarehouseStockView: React.FC = () => {
  const { showToast } = useToast();
  const [stocks, setStocks] = useState<WarehouseStockRecord[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [stockRes, whRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/warehouse-stock/report').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
      ]);

      setStocks(Array.isArray(stockRes.data) ? stockRes.data : stockRes.data?.data || []);
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load warehouse stock report', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStocks = stocks.filter((s) => {
    const itemName =
      s.rawMaterial?.materialName ||
      s.packingMaterial?.materialName ||
      s.finishedProduct?.productName ||
      '';
    const itemCode =
      s.rawMaterial?.materialCode ||
      s.packingMaterial?.materialCode ||
      s.finishedProduct?.productCode ||
      '';

    const matchesSearch =
      itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.warehouse?.name && s.warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesWh = warehouseFilter === 'ALL' || s.warehouseId === warehouseFilter;
    const matchesType = itemTypeFilter === 'ALL' || s.itemType === itemTypeFilter;

    return matchesSearch && matchesWh && matchesType;
  });

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
    const name =
      s.rawMaterial?.materialName ||
      s.packingMaterial?.materialName ||
      s.finishedProduct?.productName ||
      'Item';
    const whName = s.warehouse?.name || 'Warehouse';
    if (!window.confirm(`Are you sure you want to permanently delete/clear the stock record for "${name}" from "${whName}"? This action cannot be undone.`)) {
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
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedStockIds.length} selected stock records? This will clear stock levels for these items.`)) {
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
    const whLabel = warehouseFilter !== 'ALL'
      ? `in selected warehouse "${warehouses.find((w) => w.id === warehouseFilter)?.name || warehouseFilter}"`
      : 'across ALL warehouses';

    if (!window.confirm(`⚠️ WARNING: Are you sure you want to PURGE AND CLEAR ALL STOCK ${whLabel}? This will permanently remove all stock records and ledger movements. This action CANNOT be undone.`)) {
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

  // KPIs
  const totalItemsCount = stocks.length;
  const rawMaterialValuation = stocks
    .filter((s) => s.itemType === 'RAW_MATERIAL')
    .reduce((sum, s) => sum + Number(s.quantityOnHand) * Number(s.averageCost || 0), 0);
  const packingValuation = stocks
    .filter((s) => s.itemType === 'PACKING_MATERIAL')
    .reduce((sum, s) => sum + Number(s.quantityOnHand) * Number(s.averageCost || 0), 0);
  const finishedGoodsValuation = stocks
    .filter((s) => s.itemType === 'FINISHED_PRODUCT')
    .reduce((sum, s) => sum + Number(s.quantityOnHand) * Number(s.averageCost || 0), 0);
  const totalValuation = rawMaterialValuation + packingValuation + finishedGoodsValuation;

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
      key: 'code',
      header: 'Item Code',
      render: (s) => {
        const code =
          s.rawMaterial?.materialCode ||
          s.packingMaterial?.materialCode ||
          s.finishedProduct?.productCode ||
          'N/A';
        return <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{code}</span>;
      },
    },
    {
      key: 'name',
      header: 'Item Description',
      render: (s) => {
        const name =
          s.rawMaterial?.materialName ||
          s.packingMaterial?.materialName ||
          s.finishedProduct?.productName ||
          'Unknown';
        return <span style={{ fontWeight: 600 }}>{name}</span>;
      },
    },
    {
      key: 'itemType',
      header: 'Category',
      render: (s) => {
        const variant =
          s.itemType === 'FINISHED_PRODUCT'
            ? 'success'
            : s.itemType === 'RAW_MATERIAL'
            ? 'primary'
            : 'neutral';
        return <StatusBadge status={s.itemType} variant={variant} />;
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (s) => s.warehouse?.name || 'Main Warehouse',
    },
    {
      key: 'quantityOnHand',
      header: 'Stock On Hand',
      render: (s) => (
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          {Number(s.quantityOnHand).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'averageCost',
      header: 'Unit Cost (Avg)',
      render: (s) => `PKR ${Number(s.averageCost || 0).toLocaleString()}`,
    },
    {
      key: 'totalValuation',
      header: 'Total Valuation',
      render: (s) => {
        const val = Number(s.quantityOnHand) * Number(s.averageCost || 0);
        return (
          <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
            PKR {val.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <Button
          size="sm"
          variant="outline"
          disabled={isActionLoading}
          onClick={() => handleDeleteStockItem(s)}
          style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '4px 8px', fontSize: '11px' }}
          title="Delete Stock Record"
        >
          <IconTrash size={13} /> Delete Stock
        </Button>
      ),
    },
  ];

  return (
    <ListPageTemplate
      title="Warehouse Stock & Inventory"
      subtitle="The centralized live inventory ledger. Reflects stock movements from Purchases, Sales, and Returns."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={loadData} disabled={isActionLoading}>
            <IconRefresh size={16} /> Refresh Stock Levels
          </Button>
          <Button
            variant="outline"
            onClick={handlePurgeAllStock}
            disabled={isActionLoading || stocks.length === 0}
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
          >
            <IconTrash size={16} /> Purge All Stock
          </Button>
        </div>
      }
    >
      {/* Valuation KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Stock Valuation"
          value={`PKR ${(totalValuation / 1000000).toFixed(2)}M`}
          subtitle={`${totalItemsCount} catalog items tracked`}
        />
        <KpiCard
          title="Raw Materials"
          value={`PKR ${(rawMaterialValuation / 1000000).toFixed(2)}M`}
          subtitle="Production inputs on hand"
        />
        <KpiCard
          title="Finished Goods"
          value={`PKR ${(finishedGoodsValuation / 1000000).toFixed(2)}M`}
          subtitle="Available for dealer sale"
        />
        <KpiCard
          title="Packing Supplies"
          value={`PKR ${(packingValuation / 1000000).toFixed(2)}M`}
          subtitle="Cartons, bottles, labels"
        />
      </div>

      {/* Bulk Action Toolbar */}
      {selectedStockIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
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
              <IconTrash size={14} /> Delete Selected Stock ({selectedStockIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search by code, material name, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          options={[
            { label: 'All Warehouses', value: 'ALL' },
            ...warehouses.map((w) => ({ label: w.name, value: w.id })),
          ]}
        />
        <Select
          value={itemTypeFilter}
          onChange={(e) => setItemTypeFilter(e.target.value)}
          options={[
            { label: 'All Item Types', value: 'ALL' },
            { label: 'RAW_MATERIAL', value: 'RAW_MATERIAL' },
            { label: 'PACKING_MATERIAL', value: 'PACKING_MATERIAL' },
            { label: 'FINISHED_PRODUCT', value: 'FINISHED_PRODUCT' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : filteredStocks.length === 0 ? (
        <EmptyState
          title="No Stock Records Found"
          description="Warehouse stock is updated automatically whenever a Purchase Invoice or Sale is posted."
        />
      ) : (
        <DataTable columns={columns} data={filteredStocks} />
      )}
    </ListPageTemplate>
  );
};
