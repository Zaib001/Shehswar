'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconBox, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck, IconTrash } from '../icons';

interface PackingMaterial {
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
  packagingType: string;
  printingRequired: boolean;
  standardCost?: number;
  minStock?: number;
  leadTimeDays?: number;
  isActive: boolean;
}

const PACKAGING_TYPES = ['BAG', 'DRUM', 'BOX', 'LINER', 'PALLET', 'CAN', 'BOTTLE', 'SACK', 'OTHER'];

export const PackingMaterialsView: React.FC = () => {
  const [materials, setMaterials] = useState<PackingMaterial[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedMaterial, setSelectedMaterial] = useState<PackingMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<PackingMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    uomId: '',
    purchaseUomId: '',
    packagingType: 'BAG',
    printingRequired: false,
    standardCost: '',
    minStock: '',
    leadTimeDays: '',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [matRes, catRes, uomRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/material-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
      ]);
      const normalized = (matRes.data || []).map((m: any) => ({
        ...m,
        code: m.code || m.materialCode || '',
        name: m.name || m.materialName || '',
        categoryId: m.categoryId || m.category?.id || '',
        uomId: m.uomId || m.baseUomId || '',
        purchaseUomId: m.purchaseUomId || '',
        packagingType: m.packagingType || m.packCompatibility || 'OTHER',
        printingRequired: !!m.printingRequired,
        standardCost: m.standardCost !== undefined && m.standardCost !== null && Number(m.standardCost) > 0
          ? Number(m.standardCost)
          : (m.lastPurchaseCost !== undefined && m.lastPurchaseCost !== null && Number(m.lastPurchaseCost) > 0
            ? Number(m.lastPurchaseCost)
            : undefined),
        isActive: m.isActive !== undefined ? m.isActive : m.status === 'ACTIVE',
      }));
      setMaterials(normalized);
      setCategories(catRes.data || []);
      setUoms(uomRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load packing materials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const packingCategories = categories.filter(
    (c) => c.categoryType === 'PACKING_MATERIAL' || c.categoryType === 'BOTH' || c.type === 'PACKING_MATERIAL' || c.type === 'BOTH' || (!c.categoryType && !c.type)
  );

  const filtered = materials.filter((m: any) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      String(m.code || '').toLowerCase().includes(q) ||
      String(m.name || '').toLowerCase().includes(q);
    const matchesType = typeFilter === 'ALL' || m.packagingType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.categoryId || !formData.uomId) {
      showToast({ title: 'Validation Error', message: 'Code, name, category, and UOM are required', type: 'error' });
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
        packCompatibility: formData.packagingType,
        packagingType: formData.packagingType,
        printingRequired: formData.printingRequired,
        standardCost: formData.standardCost !== '' ? Number(formData.standardCost) : undefined,
        minStock: formData.minStock ? Number(formData.minStock) : undefined,
        leadTimeDays: formData.leadTimeDays ? Number(formData.leadTimeDays) : undefined,
        isActive: formData.isActive,
      };

      if (mode === 'edit' && selectedMaterial) {
        await ApiClient.patch(`/api/v1/master-data/packing-materials/${selectedMaterial.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} has been updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/packing-materials', payload);
        showToast({ title: 'Created', message: `${formData.name} registered`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterial) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/packing-materials/${deletingMaterial.id}`);
      showToast({ title: 'Material Deleted', message: `Packing material "${deletingMaterial.name}" has been removed`, type: 'success' });
      setDeletingMaterial(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete packing material', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: PackingMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)', fontSize: '0.85rem' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Packing Material',
      render: (row: PackingMaterial) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'packagingType',
      label: 'Type',
      render: (row: PackingMaterial) => (
        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: 'var(--color-purple-50)', color: 'var(--color-purple-700)', border: '1px solid var(--color-purple-200)' }}>
          {row.packagingType || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: PackingMaterial) => {
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
      label: 'UOM',
      render: (row: PackingMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.78rem' }}>
          {row.uom?.symbol || uoms.find((u) => u.id === row.uomId)?.symbol || '—'}
        </span>
      ),
    },
    {
      key: 'standardCost',
      label: 'Standard Cost',
      render: (row: PackingMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#047857' }}>
          {row.standardCost !== undefined
            ? `${row.standardCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`
            : '—'}
        </span>
      ),
    },
    {
      key: 'printingRequired',
      label: 'Printing',
      render: (row: PackingMaterial) =>
        row.printingRequired ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED' }}>✓ Required</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: PackingMaterial) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: PackingMaterial) => (
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
                packagingType: row.packagingType || 'BAG',
                printingRequired: row.printingRequired,
                standardCost: row.standardCost !== undefined ? row.standardCost.toString() : '',
                minStock: row.minStock?.toString() || '',
                leadTimeDays: row.leadTimeDays?.toString() || '',
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
        title={mode === 'create' ? 'Register Packing Material' : `Edit — ${selectedMaterial?.name}`}
        subtitle="Bags, drums, cartons, labels, and other packaging materials"
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Packing Materials', href: '#' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Identity',
            fields: [
              { label: 'Material Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. PM-BAG-50KG" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Material Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. BOPP Woven Bag 50kg" /> },
              { label: 'Description', field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" /> },
            ],
          },
          {
            title: 'Classification & Units',
            fields: [
              {
                label: 'Category *',
                required: true,
                field: (
                  <Select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Category' },
                      ...packingCategories.map((c) => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name })),
                    ]}
                  />
                ),
              },
              { label: 'Packaging Type', field: <Select value={formData.packagingType} onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })} options={PACKAGING_TYPES.map((t) => ({ value: t, label: t }))} /> },
              { label: 'Base UOM *', required: true, field: <Select value={formData.uomId} onChange={(e) => setFormData({ ...formData, uomId: e.target.value, purchaseUomId: formData.purchaseUomId || e.target.value })} options={[{ value: '', label: 'Select UOM' }, ...uoms.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))]} /> },
              { label: 'Purchase UOM', field: <Select value={formData.purchaseUomId || formData.uomId} onChange={(e) => setFormData({ ...formData, purchaseUomId: e.target.value })} options={[{ value: '', label: 'Same as Base UOM' }, ...uoms.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))]} /> },
              {
                label: 'Printing Required',
                field: (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                    <input type="checkbox" checked={formData.printingRequired} onChange={(e) => setFormData({ ...formData, printingRequired: e.target.checked })} />
                    <span style={{ fontSize: '0.875rem' }}>This material requires custom printing / artwork</span>
                  </label>
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
                    placeholder="e.g. 85.00"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
            ],
          },
          {
            title: 'Inventory Rules',
            fields: [
              { label: 'Minimum Stock', field: <Input type="number" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} placeholder="Minimum stock level" /> },
              { label: 'Lead Time (days)', field: <Input type="number" value={formData.leadTimeDays} onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })} placeholder="Procurement lead time" /> },
              { label: 'Status', field: <Select value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /> },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Packing Material Master"
      subtitle="Bags, drums, labels, cartons, and packaging consumables used in finished goods production."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Packing Materials' }]}
      primaryAction={{
        label: 'Register Material',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            description: '',
            categoryId: packingCategories[0]?.id || '',
            uomId: uoms[0]?.id || '',
            purchaseUomId: uoms[0]?.id || '',
            packagingType: 'BAG',
            printingRequired: false,
            standardCost: '',
            minStock: '',
            leadTimeDays: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        { label: 'Export', icon: <IconDownload size={16} />, onClick: () => showToast({ title: 'Export Ready', message: 'Packing materials exported', type: 'info' }) },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Packing Materials" value={materials.length} icon={<IconBox size={20} />} />
        <KpiCard title="Active" value={materials.filter((m) => m.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Printing Required" value={materials.filter((m) => m.printingRequired).length} icon={<IconBox size={20} />} />
        <KpiCard title="Categories" value={packingCategories.length} icon={<IconBox size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All Types' }, ...PACKAGING_TYPES.map((t) => ({ value: t, label: t }))]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : error ? (
        <ErrorState title="Failed to Load Packing Materials" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Packing Materials Found" description={searchQuery ? 'No materials match your search.' : 'No packing materials registered yet.'} actionLabel={searchQuery ? 'Clear Search' : undefined} onAction={searchQuery ? () => { setSearchQuery(''); setTypeFilter('ALL'); } : undefined} />
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
              Delete Packing Material
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deletingMaterial.name} ({deletingMaterial.code})</strong>?
              This action will remove the packing material from active records.
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
