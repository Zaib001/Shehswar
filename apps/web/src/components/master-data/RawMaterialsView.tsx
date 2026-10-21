'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconPackage, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck, IconTrash } from '../icons';

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id: string; name: string; code?: string };
  uomId: string;
  uom?: { id: string; name: string; symbol: string; code?: string };
  purchaseUomId?: string;
  purchaseUom?: { id: string; name: string; symbol: string; code?: string };
  alternateUomId?: string;
  grade?: string;
  specifications?: string;
  minStock?: number;
  reorderPoint?: number;
  leadTimeDays?: number;
  isHazardous: boolean;
  storageRequirements?: string;
  standardCost?: number;
  purchaseConversionFactor?: number;
  totalPurchasedQty?: number;
  totalPurchasedValue?: number;
  unitRate?: number;
  costPerBaseUnit?: number;
  totalBulkVolume?: number;
  bulkPacking?: string;
  isActive: boolean;
}

export const RawMaterialsView: React.FC = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [hazardFilter, setHazardFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    uomId: '',
    purchaseUomId: '',
    purchaseConversionFactor: '1',
    grade: '',
    specifications: '',
    minStock: '',
    reorderPoint: '',
    leadTimeDays: '',
    isHazardous: false,
    storageRequirements: '',
    standardCost: '',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [matRes, catRes, uomRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/material-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
      ]);
      const normalized = (matRes.data || []).map((m: any) => ({
        ...m,
        code: m.code || m.materialCode || '',
        name: m.name || m.materialName || '',
        categoryId: m.categoryId || m.category?.id || '',
        category: m.category || null,
        uomId: m.uomId || m.baseUomId || '',
        uom: m.uom || m.baseUom || null,
        purchaseUomId: m.purchaseUomId || m.alternateUomId || '',
        purchaseUom: m.purchaseUom || null,
        standardCost: m.standardCost !== undefined && m.standardCost !== null && Number(m.standardCost) > 0
          ? Number(m.standardCost)
          : (m.lastPurchaseCost !== undefined && m.lastPurchaseCost !== null && Number(m.lastPurchaseCost) > 0
            ? Number(m.lastPurchaseCost)
            : (m.averageCost !== undefined && m.averageCost !== null ? Number(m.averageCost) : undefined)),
        storageRequirements: m.storageRequirements || '',
        purchaseConversionFactor: m.purchaseConversionFactor ? Number(m.purchaseConversionFactor) : 1,
        totalPurchasedQty: m.totalPurchasedQty !== undefined ? Number(m.totalPurchasedQty) : undefined,
        totalPurchasedValue: m.totalPurchasedValue !== undefined ? Number(m.totalPurchasedValue) : undefined,
        unitRate: m.unitRate !== undefined ? Number(m.unitRate) : (m.lastPurchaseCost ? Number(m.lastPurchaseCost) : undefined),
        costPerBaseUnit: m.costPerBaseUnit !== undefined ? Number(m.costPerBaseUnit) : undefined,
        totalBulkVolume: m.totalBulkVolume !== undefined ? Number(m.totalBulkVolume) : undefined,
        bulkPacking: m.bulkPacking || m.specifications || '',
        minStock: m.minStock !== undefined ? m.minStock : (m.minimumStock !== undefined ? Number(m.minimumStock) : undefined),
        reorderPoint: m.reorderPoint !== undefined ? m.reorderPoint : (m.reorderLevel !== undefined ? Number(m.reorderLevel) : undefined),
        leadTimeDays: m.leadTimeDays !== undefined ? m.leadTimeDays : (m.shelfLifeDays !== undefined ? Number(m.shelfLifeDays) : undefined),
        isHazardous: !!m.isHazardous,
        isActive: m.isActive !== undefined ? m.isActive : m.status === 'ACTIVE',
      }));
      setMaterials(normalized);
      setCategories(catRes.data || []);
      setUoms(uomRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load raw materials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = materials.filter((m: any) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      String(m.code || '').toLowerCase().includes(q) ||
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.grade || '').toLowerCase().includes(q) ||
      String(m.storageRequirements || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'ALL' || m.categoryId === categoryFilter;
    const matchesHazard =
      hazardFilter === 'ALL' ||
      (hazardFilter === 'HAZARDOUS' && m.isHazardous) ||
      (hazardFilter === 'SAFE' && !m.isHazardous);
    return matchesSearch && matchesCategory && matchesHazard;
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.categoryId || !formData.uomId) {
      showToast({ title: 'Validation Error', message: 'Code, name, category, and Base UOM are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        materialCode: formData.code.trim().toUpperCase(),
        materialName: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        categoryId: formData.categoryId,
        baseUomId: formData.uomId,
        purchaseUomId: formData.purchaseUomId || formData.uomId,
        purchaseConversionFactor: formData.purchaseConversionFactor ? Number(formData.purchaseConversionFactor) : 1,
        grade: formData.grade?.trim() || undefined,
        specifications: formData.specifications?.trim() || undefined,
        storageRequirements: formData.storageRequirements?.trim() || undefined,
        standardCost: formData.standardCost !== '' ? Number(formData.standardCost) : undefined,
        minStock: formData.minStock !== '' ? Number(formData.minStock) : undefined,
        reorderPoint: formData.reorderPoint !== '' ? Number(formData.reorderPoint) : undefined,
        leadTimeDays: formData.leadTimeDays !== '' ? Number(formData.leadTimeDays) : undefined,
        isHazardous: formData.isHazardous,
        isActive: formData.isActive,
      };

      if (mode === 'edit' && selectedMaterial) {
        await ApiClient.patch(`/api/v1/master-data/raw-materials/${selectedMaterial.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} has been updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/raw-materials', payload);
        showToast({ title: 'Created', message: `${formData.name} registered in Raw Material Master`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const rawCategories = categories.filter(
    (c) => c.categoryType === 'RAW_MATERIAL' || c.categoryType === 'BOTH' || c.type === 'RAW_MATERIAL' || c.type === 'BOTH' || (!c.categoryType && !c.type)
  );

  const handleDelete = async () => {
    if (!deletingMaterial) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/raw-materials/${deletingMaterial.id}`);
      showToast({ title: 'Material Deleted', message: `Raw material "${deletingMaterial.name}" has been removed`, type: 'success' });
      setDeletingMaterial(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete raw material', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Material Code',
      render: (row: RawMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary-600)' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Material Name',
      render: (row: RawMaterial) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {row.grade && <span>Grade: <strong>{row.grade}</strong></span>}
            {row.storageRequirements && (
              <span title={row.storageRequirements} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.storageRequirements}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: RawMaterial) => {
        const cat = row.category || categories.find((c) => c.id === row.categoryId);
        return (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {cat ? (cat.code ? `${cat.code} · ${cat.name}` : cat.name) : '—'}
          </span>
        );
      },
    },
    {
      key: 'uom',
      label: 'Base UOM',
      render: (row: RawMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.78rem' }}>
          {row.uom?.symbol || row.uom?.code || uoms.find((u) => u.id === row.uomId)?.symbol || '—'}
        </span>
      ),
    },
    {
      key: 'packing',
      label: 'Packing / Bulk',
      render: (row: RawMaterial) => {
        const factor = Number(row.purchaseConversionFactor || 1);
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'Units';
        const packLabel = row.bulkPacking || row.storageRequirements || row.specifications || (factor > 1 ? `${factor} ${uomSymbol}` : 'Bulk');
        return (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {packLabel}
          </span>
        );
      },
    },
    {
      key: 'purchasedTotal',
      label: 'Purchased Qty & Value',
      render: (row: RawMaterial) => {
        const qty = row.totalPurchasedQty || 0;
        const totalVal = row.totalPurchasedValue || (qty * (row.unitRate || row.standardCost || 0));
        const factor = Number(row.purchaseConversionFactor || 1);
        const bulkVol = factor > 1 && qty > 0 ? qty * factor : null;
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'L';
        return (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              {qty > 0 ? `${qty} Qty ${bulkVol ? `(${bulkVol.toLocaleString()} ${uomSymbol})` : ''}` : '—'}
            </div>
            {totalVal > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                PKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'costing',
      label: 'Purchase Rate / Base Cost',
      render: (row: RawMaterial) => {
        const unitRate = row.unitRate || row.standardCost || 0;
        const factor = Number(row.purchaseConversionFactor || 1);
        const baseCost = row.costPerBaseUnit || (factor > 1 && unitRate > 0 ? unitRate / factor : unitRate);
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'Unit';
        return (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#047857', fontSize: '0.85rem' }}>
              PKR {baseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uomSymbol}
            </div>
            {factor > 1 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                (PKR {unitRate.toLocaleString()} / Pack)
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'isHazardous',
      label: 'Hazardous',
      render: (row: RawMaterial) =>
        row.isHazardous ? (
          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            HAZARDOUS
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Safe</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: RawMaterial) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: RawMaterial) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedMaterial(row);
              setFormData({
                code: row.code,
                name: row.name,
                description: row.description || '',
                categoryId: row.categoryId,
                uomId: row.uomId,
                purchaseUomId: row.purchaseUomId || row.uomId,
                purchaseConversionFactor: row.purchaseConversionFactor ? row.purchaseConversionFactor.toString() : '1',
                grade: row.grade || '',
                specifications: row.specifications || '',
                minStock: row.minStock !== undefined ? row.minStock.toString() : '',
                reorderPoint: row.reorderPoint !== undefined ? row.reorderPoint.toString() : '',
                leadTimeDays: row.leadTimeDays !== undefined ? row.leadTimeDays.toString() : '',
                isHazardous: row.isHazardous,
                storageRequirements: row.storageRequirements || '',
                standardCost: row.standardCost !== undefined ? row.standardCost.toString() : '',
                isActive: row.isActive,
              });
              setMode('edit');
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{ color: '#DC2626' }}
            icon={<IconTrash size={14} />}
            onClick={() => setDeletingMaterial(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Raw Material' : `Edit — ${selectedMaterial?.name}`}
        subtitle="Raw material master record: chemicals, agricultural inputs, and process materials"
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Raw Materials', href: '#' },
          { label: mode === 'create' ? 'New Material' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Identity',
            fields: [
              {
                label: 'Material Code *',
                required: true,
                field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. RM-CHL-001 or RM-SOLV-01" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }} />,
              },
              {
                label: 'Material Name *',
                required: true,
                field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Chlorpyrifos Technical 98%" />,
              },
              {
                label: 'Description',
                field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of active or solvent" />,
              },
              {
                label: 'Grade / Quality',
                field: <Input value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} placeholder="e.g. Technical Grade, Food" />,
              },
            ],
          },
          {
            title: 'Classification',
            fields: [
              {
                label: 'Material Category *',
                required: true,
                field: (
                  <Select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Category' },
                      ...rawCategories.map((c) => ({
                        value: c.id,
                        label: c.code ? `${c.code} — ${c.name}` : c.name,
                      })),
                    ]}
                  />
                ),
              },
              {
                label: 'Hazardous Material',
                field: (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                    <input type="checkbox" checked={formData.isHazardous} onChange={(e) => setFormData({ ...formData, isHazardous: e.target.checked })} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>This material is classified as hazardous / dangerous goods</span>
                  </label>
                ),
              },
            ],
          },
          {
            title: 'Units & Purchasing',
            fields: [
              {
                label: 'Base UOM *',
                required: true,
                field: (
                  <Select
                    value={formData.uomId}
                    onChange={(e) => {
                      const newBase = e.target.value;
                      setFormData({
                        ...formData,
                        uomId: newBase,
                        purchaseUomId: formData.purchaseUomId || newBase,
                      });
                    }}
                    options={[{ value: '', label: 'Select Base UOM' }, ...uoms.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol || u.code})` }))]}
                  />
                ),
              },
              {
                label: 'Purchase UOM',
                field: (
                  <Select
                    value={formData.purchaseUomId || formData.uomId}
                    onChange={(e) => setFormData({ ...formData, purchaseUomId: e.target.value })}
                    options={[{ value: '', label: 'Same as Base UOM' }, ...uoms.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol || u.code})` }))]}
                  />
                ),
              },
              {
                label: 'Purchase Conversion Factor',
                field: (
                  <Input
                    type="number"
                    step="any"
                    value={formData.purchaseConversionFactor}
                    onChange={(e) => setFormData({ ...formData, purchaseConversionFactor: e.target.value })}
                    placeholder="1 Purchase UOM = X Base UOM (e.g. 1)"
                  />
                ),
              },
            ],
          },
          {
            title: 'Costing & Valuation',
            fields: [
              {
                label: 'Standard Cost (PKR)',
                field: (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.standardCost}
                    onChange={(e) => setFormData({ ...formData, standardCost: e.target.value })}
                    placeholder="e.g. 1500.00"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
            ],
          },
          {
            title: 'Inventory & Storage Rules',
            fields: [
              {
                label: 'Storage Requirements',
                field: (
                  <Input
                    value={formData.storageRequirements}
                    onChange={(e) => setFormData({ ...formData, storageRequirements: e.target.value })}
                    placeholder="e.g. Cool, dry ventilated bay, keep below 30°C"
                  />
                ),
              },
              {
                label: 'Minimum Stock Level',
                field: <Input type="number" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} placeholder="e.g. 100" />,
              },
              {
                label: 'Reorder Point',
                field: <Input type="number" value={formData.reorderPoint} onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })} placeholder="e.g. 250" />,
              },
              {
                label: 'Procurement Lead Time (days)',
                field: <Input type="number" value={formData.leadTimeDays} onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })} placeholder="e.g. 14" />,
              },
              {
                label: 'Technical Specifications',
                field: <Input value={formData.specifications} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} placeholder="e.g. Purity ≥ 46% N, moisture <0.5%" />,
              },
            ],
          },
          {
            title: 'Status',
            fields: [
              {
                label: 'Material Status',
                field: (
                  <Select
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                    options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
                  />
                ),
              },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Raw Material Master"
      subtitle="Chemical inputs, active technical ingredients, and solvent carriers used in pesticide & fertilizer manufacturing."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Raw Materials' }]}
      primaryAction={{
        label: 'Register Material',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            description: '',
            categoryId: rawCategories[0]?.id || '',
            uomId: uoms[0]?.id || '',
            purchaseUomId: uoms[0]?.id || '',
            purchaseConversionFactor: '1',
            grade: '',
            specifications: '',
            minStock: '',
            reorderPoint: '',
            leadTimeDays: '',
            isHazardous: false,
            storageRequirements: '',
            standardCost: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        { label: 'Export', icon: <IconDownload size={16} />, onClick: () => showToast({ title: 'Export Ready', message: 'Raw materials exported', type: 'info' }) },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Materials" value={materials.length} icon={<IconPackage size={20} />} />
        <KpiCard title="Active Materials" value={materials.filter((m) => m.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Hazardous Items" value={materials.filter((m) => m.isHazardous).length} icon={<IconPackage size={20} />} status="warning" />
        <KpiCard title="Categories" value={rawCategories.length} icon={<IconPackage size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Input placeholder="Search by code, name, grade, or storage..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ width: '280px' }}>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Raw Material Categories' },
                ...rawCategories.map((c) => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name })),
              ]}
            />
          </div>
          <div style={{ width: '180px' }}>
            <Select
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All Materials' }, { value: 'HAZARDOUS', label: 'Hazardous Only' }, { value: 'SAFE', label: 'Non-Hazardous' }]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={6} columns={8} />
      ) : error ? (
        <ErrorState title="Failed to Load Raw Materials" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Raw Materials Found"
          description={searchQuery ? 'No materials match your search.' : 'No raw materials have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setCategoryFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {deletingMaterial && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
              Delete Raw Material
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deletingMaterial.name} ({deletingMaterial.code})</strong>?
              This action will remove the raw material from active records.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setDeletingMaterial(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Material'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageTemplate>
  );
};
