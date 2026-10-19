'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconBox, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck, IconTrash } from '../icons';

interface PackSize {
  id: string;
  code: string;
  name: string;
  quantity: number;
  uomId?: string | null;
  uom?: { id: string; name: string; symbol: string } | null;
  status: string;
}

export const PackSizesView: React.FC = () => {
  const [packSizes, setPackSizes] = useState<PackSize[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedPackSize, setSelectedPackSize] = useState<PackSize | null>(null);
  const [deletingPackSize, setDeletingPackSize] = useState<PackSize | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    quantity: '',
    uomId: '',
    status: 'ACTIVE',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [psRes, uomRes] = await Promise.all([
        ApiClient.get<PackSize[]>('/api/v1/master-data/pack-sizes'),
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
      ]);
      setPackSizes(psRes.data || []);
      setUoms(uomRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pack sizes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = packSizes.filter(
    (p) =>
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.quantity) {
      showToast({ title: 'Validation Error', message: 'Code, name, and quantity are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        uomId: formData.uomId || undefined,
      };
      if (mode === 'edit' && selectedPackSize) {
        await ApiClient.patch(`/api/v1/master-data/pack-sizes/${selectedPackSize.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated successfully`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/pack-sizes', payload);
        showToast({ title: 'Created', message: `${formData.name} registered successfully`, type: 'success' });
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
    if (!deletingPackSize) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/pack-sizes/${deletingPackSize.id}`);
      showToast({ title: 'Deleted', message: `Pack size "${deletingPackSize.name}" has been removed`, type: 'success' });
      setDeletingPackSize(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete pack size', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Pack Code',
      render: (row: PackSize) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)', fontSize: '0.85rem' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Pack Label',
      render: (row: PackSize) => <span style={{ fontWeight: 600 }}>{row.name}</span>,
    },
    {
      key: 'quantity',
      label: 'Package Net Size',
      render: (row: PackSize) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {row.quantity} {row.uom?.symbol || uoms.find((u) => u.id === row.uomId)?.symbol || ''}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: PackSize) => <StatusBadge status={row.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: PackSize) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedPackSize(row);
              setFormData({
                code: row.code,
                name: row.name,
                quantity: String(row.quantity),
                uomId: row.uomId || '',
                status: row.status || 'ACTIVE',
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
            onClick={() => setDeletingPackSize(row)}
            title="Delete Pack Size"
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
        title={mode === 'create' ? 'Register Pack Size' : `Edit — ${selectedPackSize?.name}`}
        subtitle="Standardized packaging net capacities (e.g. 50kg Bags, 25kg Bags, 1000L IBC Totes)."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Pack Sizes', href: '#' },
          { label: mode === 'create' ? 'New Pack Size' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Pack Size Specification',
            fields: [
              {
                label: 'Pack Size Code *',
                required: true,
                field: (
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PK-50KG"
                    disabled={mode === 'edit'}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                ),
              },
              {
                label: 'Label / Name *',
                required: true,
                field: (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. 50 Kg Polypropylene Woven Bag"
                  />
                ),
              },
              {
                label: 'Net Quantity *',
                required: true,
                field: (
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g. 50"
                  />
                ),
              },
              {
                label: 'Unit of Measure',
                field: (
                  <Select
                    value={formData.uomId}
                    onChange={(e) => setFormData({ ...formData, uomId: e.target.value })}
                    options={[
                      { value: '', label: 'Select UOM' },
                      ...uoms.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` })),
                    ]}
                  />
                ),
              },
              {
                label: 'Status',
                field: (
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
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
      title="Pack Sizes"
      subtitle="Standard packaging dimensions and fill weights for finished fertilizer products."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Pack Sizes' }]}
      primaryAction={{
        label: 'New Pack Size',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', quantity: '', uomId: '', status: 'ACTIVE' });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Ready', message: 'Pack Sizes exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Pack Sizes" value={packSizes.length} icon={<IconBox size={20} />} />
        <KpiCard title="Active Pack Sizes" value={packSizes.filter((p) => p.status === 'ACTIVE').length} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <Input
              placeholder="Search pack size code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Pack Sizes Found"
          description={searchQuery ? 'No pack sizes match your search.' : 'No pack sizes registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {deletingPackSize && (
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
              Delete Pack Size
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete pack size <strong>{deletingPackSize.name} ({deletingPackSize.code})</strong>?
              This will remove this pack size specification from the catalog.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setDeletingPackSize(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Pack Size'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageTemplate>
  );
};
