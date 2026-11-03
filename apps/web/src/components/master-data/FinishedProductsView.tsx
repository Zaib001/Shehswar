'use client';

/**
 * SHEHSWAR ONE360 - Product & Item Management Workspace
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - ListPageTemplate structure with breadcrumbs and actions
 * - 4 Executive KpiCard metrics with standard SVG icons
 * - Card & CardContent filter toolbar with Input (startIcon) and Select components
 * - DataTable with monospace codes, Urdu RTL typography, packaging pills, status badges
 * - Strict separation between Product Master and Product Costing
 * - One professional "+ Add Item" modal and dynamic file import
 * - Zero hardcoded mock data; connected directly to live PostgreSQL
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
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
  Modal,
} from '../ui';
import {
  IconFlask,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconDownload,
  IconSearch,
  IconEye,
  IconEdit,
  IconTrendingUp,
  IconBuilding,
} from '../icons';
import { AddFinishedProductModal } from './AddFinishedProductModal';
import { ProductImportModal } from './ProductImportModal';

interface FinishedProductItem {
  id: string;
  productCode: string;
  productName: string;
  urduName?: string;
  categoryId?: string;
  category?: { id: string; code: string; name: string };
  packagingMaterialId?: string;
  packagingMaterial?: { id: string; materialCode: string; materialName: string; standardCost?: number; lastPurchaseCost?: number };
  packingQuantity?: number;
  packingUnit?: string;
  ppc?: number;
  mType?: string;
  productType?: string;
  defaultSellingPrice?: number;
  standardCost?: number;
  customFields?: Record<string, any>;
  status: string;
  createdAt?: string;
}

export const FinishedProductsView: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<FinishedProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [mTypeFilter, setMTypeFilter] = useState('ALL');
  const [costingFilter, setCostingFilter] = useState('ALL');

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FinishedProductItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<FinishedProductItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<FinishedProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Products
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const prodRes = await ApiClient.get<any[]>('/api/v1/master-data/finished-products');

      const prodList = Array.isArray(prodRes.data)
        ? prodRes.data
        : (prodRes.data as any)?.data || [];

      setProducts(prodList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load product catalog records');
      showToast({
        title: 'Error',
        message: err?.message || 'Failed to load catalog data from server',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/finished-products/${productToDelete.id}`);
      showToast({
        title: 'Product Deleted',
        message: `Product "${productToDelete.productName}" (${productToDelete.productCode}) was deleted`,
        type: 'success',
      });
      if (viewingProduct?.id === productToDelete.id) {
        setViewingProduct(null);
      }
      setProductToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err.response?.data?.message || err.message || 'Failed to delete product',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Executive KPI Calculations
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === 'ACTIVE' || !p.status).length;
  const costedCount = products.filter((p) => Number(p.standardCost || 0) > 0).length;
  const uncostedCount = totalCount - costedCount;
  const pricedCount = products.filter((p) => Number(p.defaultSellingPrice || 0) > 0).length;
  const coveragePct = totalCount > 0 ? Math.round((pricedCount / totalCount) * 100) : 0;

  // Filtered Products
  const availableMTypes = useMemo(() => {
    const list = products.map((p) => p.mType).filter(Boolean) as string[];
    const defaults = ['Insecticides', 'Herbicides', 'Fungicides', 'Fertilizers', 'Seeds', 'PGRs / Nutrients', 'Granules', 'Acaricides', 'Weedicides'];
    return Array.from(new Set([...list, ...defaults]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        p.productName.toLowerCase().includes(q) ||
        p.productCode.toLowerCase().includes(q) ||
        (p.urduName && p.urduName.includes(q)) ||
        (p.packagingMaterial?.materialName && p.packagingMaterial.materialName.toLowerCase().includes(q));

      const matchesMType =
        mTypeFilter === 'ALL' ||
        p.mType === mTypeFilter;

      const hasCost = Number(p.standardCost || 0) > 0;
      const matchesCosting =
        costingFilter === 'ALL' ||
        (costingFilter === 'COSTED' && hasCost) ||
        (costingFilter === 'UNCOSTED' && !hasCost);

      return matchesSearch && matchesMType && matchesCosting;
    });
  }, [products, searchQuery, mTypeFilter, costingFilter]);

  // Navigate to Product Costing Engine for a specific product
  const handleNavigateToCosting = (productId: string) => {
    window.location.hash = `#product-costing?product=${productId}`;
    showToast({
      title: 'Routing to Product Costing',
      message: 'Loading recipe and procurement rates in Costing Engine...',
      type: 'info',
    });
  };

  // Enterprise DataTable Columns
  const columns = [
    {
      key: 'productCode',
      label: 'Product Code',
      sortable: true,
      render: (row: FinishedProductItem) => (
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            color: 'var(--color-primary-600, #2563EB)',
            fontSize: '0.85rem',
            letterSpacing: '0.5px',
          }}
        >
          {row.productCode}
        </span>
      ),
    },
    {
      key: 'productName',
      label: 'Product Name / Account',
      sortable: true,
      render: (row: FinishedProductItem) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #0F172A)', fontSize: '0.88rem' }}>
            {row.productName}
          </div>
          {row.urduName && (
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #64748B)',
                marginTop: '2px',
                fontFamily: 'sans-serif',
              }}
              dir="rtl"
            >
              {row.urduName}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'mType',
      label: 'Product Category',
      render: (row: FinishedProductItem) => {
        const val = row.mType || 'Insecticides';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE',
            }}
          >
            {val}
          </span>
        );
      },
    },
    {
      key: 'packaging',
      label: 'Packaging & Pack Size',
      render: (row: FinishedProductItem) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                color: 'var(--text-primary, #0F172A)',
                padding: '2px 8px',
                background: '#F1F5F9',
                borderRadius: '6px',
                fontSize: '0.78rem',
                border: '1px solid #E2E8F0',
              }}
            >
              {row.packingQuantity ? `${row.packingQuantity} ${row.packingUnit || 'Gram'}` : '—'}
            </span>
            {row.customFields?.packagingContainer && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#475569',
                  background: '#F8FAFC',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #E2E8F0',
                }}
                title="Packaging Container Count / Size"
              >
                Cnt: {row.customFields.packagingContainer}
              </span>
            )}
          </div>
          {row.packagingMaterial && (
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted, #64748B)',
                marginTop: '3px',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {row.packagingMaterial.materialName} ({row.packagingMaterial.materialCode})
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'ppc',
      label: 'PPC',
      align: 'center' as const,
      render: (row: FinishedProductItem) => (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 600,
            fontSize: '0.78rem',
            color: '#334155',
          }}
        >
          {row.ppc || 1}
        </span>
      ),
    },
    {
      key: 'defaultSellingPrice',
      label: 'Base Selling Price',
      sortable: true,
      align: 'right' as const,
      render: (row: FinishedProductItem) => (
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            color: 'var(--text-primary, #0F172A)',
            fontSize: '0.85rem',
          }}
        >
          {row.defaultSellingPrice !== null && row.defaultSellingPrice !== undefined && Number(row.defaultSellingPrice) > 0
            ? `PKR ${Number(row.defaultSellingPrice).toLocaleString()}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'costingStatus',
      label: 'Manufacturing Cost',
      render: (row: FinishedProductItem) => {
        const hasCost = Number(row.standardCost || 0) > 0;
        if (hasCost) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                }}
              >
                PKR {Number(row.standardCost).toLocaleString()} / Pack
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigateToCosting(row.id)}
                style={{ fontSize: '0.72rem', padding: '2px 6px', height: '24px' }}
                title="Recalculate Costing in Costing Engine"
              >
                Recalculate
              </Button>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                border: '1px solid #FDE68A',
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.4px',
              }}
            >
              NOT CONFIGURED
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigateToCosting(row.id)}
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                height: '24px',
                borderColor: '#10B981',
                color: '#059669',
                backgroundColor: '#F0FDF4',
                fontWeight: 600,
              }}
            >
              Cost Now →
            </Button>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: FinishedProductItem) => (
        <StatusBadge status={row.status || 'ACTIVE'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (row: FinishedProductItem) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => setEditingProduct(row)}
            title="Edit Finished Product (or Double-Click row)"
            style={{ color: '#047857', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEye size={14} />}
            onClick={() => setViewingProduct(row)}
            title="View Product Master Details"
          >
            View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleNavigateToCosting(row.id)}
            style={{ fontSize: '0.75rem', height: '28px' }}
          >
            Cost Engine
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProductToDelete(row)}
            style={{
              color: '#DC2626',
              backgroundColor: '#FEF2F2',
              borderColor: '#FEE2E2',
              fontSize: '0.75rem',
              height: '28px',
              padding: '0 8px',
            }}
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
      title="Product & Item Master"
      subtitle="Commercial finished formulations, packaging configurations, PPC, and sales base prices. Cost calculation is segregated into Product Costing."
      breadcrumbs={[
        { label: 'Master Data', href: '#' },
        { label: 'Finished Products Catalog' },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            startIcon={<IconDownload size={14} />}
            onClick={() => setIsImportOpen(true)}
          >
            Import Products
          </Button>
          <Button
            variant="outline"
            size="sm"
            startIcon={<IconRefresh size={14} />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            startIcon={<IconPlus size={14} />}
            onClick={() => setIsAddItemOpen(true)}
            style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
          >
            + Add Product
          </Button>
        </div>
      }
    >
      {/* 4 Executive KPI Cards matching Shehswar ERP standard */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Products in Master"
          value={totalCount}
          subtitle={`${activeCount} Active in Commercial Catalog`}
          icon={<IconFlask size={20} />}
          accentColor="#10B981"
        />
        <KpiCard
          title="Costed Formulations"
          value={costedCount}
          subtitle={`${uncostedCount} Pending Batch Costing`}
          icon={<IconTrendingUp size={20} />}
          accentColor="#6366F1"
        />
        <KpiCard
          title="Packaging Types"
          value={products.filter((p) => p.packagingMaterialId).length}
          subtitle={`Linked to Material Inventory`}
          icon={<IconPackage size={20} />}
          accentColor="#F59E0B"
        />
        <KpiCard
          title="Commercial Rate Coverage"
          value={`${coveragePct}%`}
          subtitle={`${pricedCount} of ${totalCount} Have Base Rates`}
          icon={<IconBuilding size={20} />}
          accentColor="#06B6D4"
        />
      </div>

      {/* Filter Toolbar matching SalesOrdersView and RawMaterialsView */}
      <Card style={{ marginBottom: '20px' }}>
        <CardContent style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <Input
                placeholder="Search by code, product name, packaging, or Urdu..."
                startIcon={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '220px' }}>
              <Select
                value={mTypeFilter}
                onChange={(e) => setMTypeFilter(typeof e === 'string' ? e : e.target?.value || 'ALL')}
                options={[
                  { label: 'All Product Categories (MType)', value: 'ALL' },
                  ...availableMTypes.map((m) => ({
                    label: m,
                    value: m,
                  })),
                ]}
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <Select
                value={costingFilter}
                onChange={(e) => setCostingFilter(typeof e === 'string' ? e : e.target?.value || 'ALL')}
                options={[
                  { label: 'All Costing States', value: 'ALL' },
                  { label: 'Cost Configured', value: 'COSTED' },
                  { label: 'Not Configured', value: 'UNCOSTED' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table View */}
      {isLoading ? (
        <TableSkeleton rows={6} columns={9} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Product Master Records"
          message={error}
          onRetry={loadData}
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No Products Found"
          description={
            searchQuery
              ? 'No products match your current search or filter criteria.'
              : 'No finished products have been registered yet.'
          }
          actionLabel="+ Add First Item"
          onAction={() => setIsAddItemOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredProducts}
          searchable={false}
          pageSize={10}
          onRowDoubleClick={(row) => setEditingProduct(row)}
        />
      )}

      {/* Product Detail Modal matching Shehswar UI Modal */}
      {viewingProduct && (
        <Modal
          isOpen={!!viewingProduct}
          onClose={() => setViewingProduct(null)}
          title="Product Master Specification"
          description={`Identity and technical packaging details for ${viewingProduct.productCode}`}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const target = viewingProduct;
                  setViewingProduct(null);
                  setProductToDelete(target);
                }}
                style={{ color: '#DC2626', backgroundColor: '#FEF2F2', borderColor: '#FEE2E2', fontSize: '0.78rem' }}
              >
                Delete Product
              </Button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const target = viewingProduct;
                    setViewingProduct(null);
                    setEditingProduct(target);
                  }}
                  style={{ backgroundColor: '#059669', borderColor: '#059669', color: '#fff' }}
                >
                  <IconEdit size={14} /> Edit Product
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const pid = viewingProduct.id;
                    setViewingProduct(null);
                    handleNavigateToCosting(pid);
                  }}
                  style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' }}
                >
                  Open in Product Costing Engine →
                </Button>
                <Button variant="outline" size="sm" onClick={() => setViewingProduct(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Product Identity
              </div>
              <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>
                {viewingProduct.productName}
              </div>
              {viewingProduct.urduName && (
                <div style={{ color: '#475569', marginTop: '4px', fontSize: '0.9rem' }} dir="rtl">
                  {viewingProduct.urduName}
                </div>
              )}
              <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: '#2563EB' }}>
                Code: {viewingProduct.productCode}
              </div>
              <div style={{ marginTop: '4px', color: '#64748B' }}>
                Classification: <strong>{viewingProduct.mType || 'Insecticides'}</strong>
              </div>
            </div>

            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Packaging & Carton Logistics
              </div>
              <div style={{ marginTop: '8px', fontWeight: 600, color: '#0F172A' }}>
                Pack Size: {viewingProduct.packingQuantity ? `${viewingProduct.packingQuantity} ${viewingProduct.packingUnit || 'Liter'}` : 'Not Specified'}
              </div>
              <div style={{ marginTop: '4px', color: '#475569' }}>
                PPC (Pack Per Carton): <strong>{viewingProduct.ppc || 1} units/box</strong>
              </div>
              <div style={{ marginTop: '4px', color: '#475569' }}>
                Packaging Material: <strong>{viewingProduct.packagingMaterial?.materialName || 'None Assigned'}</strong>
              </div>
              {viewingProduct.packagingMaterial?.materialCode && (
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: '#64748B' }}>
                  Material Code: {viewingProduct.packagingMaterial.materialCode}
                </div>
              )}
            </div>

            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Commercial Pricing
              </div>
              <div style={{ marginTop: '8px', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
                {viewingProduct.defaultSellingPrice ? `PKR ${Number(viewingProduct.defaultSellingPrice).toLocaleString()}` : 'Not Set'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                Base commercial rate for sales orders and rate lists.
              </div>
            </div>

            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Authoritative Costing Status
              </div>
              <div style={{ marginTop: '8px', fontSize: '1.1rem', fontWeight: 700, color: Number(viewingProduct.standardCost || 0) > 0 ? '#059669' : '#D97706', fontFamily: 'var(--font-mono, monospace)' }}>
                {Number(viewingProduct.standardCost || 0) > 0
                  ? `PKR ${Number(viewingProduct.standardCost).toLocaleString()} / Pack`
                  : 'NOT CONFIGURED'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                Applied via Product Costing Engine snapshot.
              </div>
            </div>

            {viewingProduct.customFields && Object.keys(viewingProduct.customFields).length > 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Dynamic File Import Fields (customFields)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {Object.entries(viewingProduct.customFields).map(([k, v]) => (
                    <div key={k} style={{ padding: '6px 10px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.7rem' }}>{k}</span>
                      <strong style={{ color: '#0F172A' }}>{String(v)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Product Deletion Confirmation Modal */}
      {productToDelete && (
        <Modal
          isOpen={!!productToDelete}
          onClose={() => !isDeleting && setProductToDelete(null)}
          title="Delete Finished Product"
          description="Are you sure you want to delete this finished product? This action cannot be undone."
          size="sm"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
              <Button variant="secondary" size="sm" onClick={() => setProductToDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626', color: '#fff' }}
              >
                Delete Product
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '12px 14px',
                background: '#FEF2F2',
                borderRadius: '8px',
                border: '1px solid #FEE2E2',
              }}
            >
              <div style={{ fontWeight: 700, color: '#991B1B', fontSize: '0.9rem' }}>
                {productToDelete.productName}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#B91C1C',
                  marginTop: '3px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                Code: {productToDelete.productCode}
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
              This will permanently delete or deactivate this finished product from the master catalog.
            </p>
          </div>
        </Modal>
      )}

      {/* Dedicated Add Finished Product Modal */}
      <AddFinishedProductModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onProductCreated={() => {
          setIsAddItemOpen(false);
          loadData();
        }}
      />

      {/* Dedicated Edit Finished Product Modal */}
      {editingProduct && (
        <AddFinishedProductModal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          productToEdit={editingProduct}
          onProductUpdated={() => {
            setEditingProduct(null);
            loadData();
          }}
        />
      )}

      {/* Dynamic Product Import Modal */}
      <ProductImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => {
          setIsImportOpen(false);
          loadData();
        }}
      />
    </ListPageTemplate>
  );
};
