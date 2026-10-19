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
import { IconRefresh } from '../icons';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');

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
  ];

  return (
    <ListPageTemplate
      title="Warehouse Stock & Inventory"
      subtitle="The centralized live inventory ledger. Reflects stock movements from Purchases, Sales, and Returns."
      actions={
        <Button variant="secondary" onClick={loadData}>
          <IconRefresh size={16} /> Refresh Stock Levels
        </Button>
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
