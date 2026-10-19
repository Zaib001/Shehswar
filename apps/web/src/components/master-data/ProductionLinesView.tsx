'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconFactory, IconPlus, IconRefresh, IconEdit, IconCheck } from '../icons';

interface ProductionLine {
  id: string;
  code: string;
  name: string;
  description?: string;
  plantId: string;
  plant?: { id: string; name: string };
  lineType: string;
  capacity?: number;
  capacityUom?: string;
  isActive: boolean;
}

const LINE_TYPES = ['BLENDING', 'GRANULATION', 'BAGGING', 'LIQUID_FERTILIZER', 'PACKAGING', 'GENERAL'];

export const ProductionLinesView: React.FC = () => {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    plantId: '',
    lineType: 'BLENDING',
    capacity: '',
    capacityUom: 'MT/Day',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [lineRes, plantRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/production-lines'),
        ApiClient.get<any[]>('/api/v1/master-data/plants'),
      ]);
      const normalized = (lineRes.data || []).map((l: any) => ({
        ...l,
        code: l.code || l.lineCode || '',
        name: l.name || l.lineName || '',
        isActive: l.isActive !== undefined ? l.isActive : l.status === 'ACTIVE',
      }));
      setLines(normalized);
      setPlants(plantRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load production lines');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = lines.filter((l: any) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      String(l.code || '').toLowerCase().includes(q) ||
      String(l.name || '').toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.plantId) {
      showToast({ title: 'Validation Error', message: 'Code, name, and plant are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
      };
      if (mode === 'edit' && selectedLine) {
        await ApiClient.patch(`/api/v1/master-data/production-lines/${selectedLine.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/production-lines', payload);
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

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: ProductionLine) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Production Line',
      render: (row: ProductionLine) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'lineType',
      label: 'Type',
      render: (row: ProductionLine) => (
        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
          {row.lineType}
        </span>
      ),
    },
    {
      key: 'plant',
      label: 'Plant',
      render: (row: ProductionLine) => (
        <span style={{ fontSize: '0.82rem' }}>{row.plant?.name || plants.find((p) => p.id === row.plantId)?.name || '—'}</span>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (row: ProductionLine) =>
        row.capacity ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {row.capacity} {row.capacityUom || ''}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: ProductionLine) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: ProductionLine) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedLine(row);
            setFormData({ code: row.code, name: row.name, description: row.description || '', plantId: row.plantId, lineType: row.lineType, capacity: row.capacity?.toString() || '', capacityUom: row.capacityUom || 'MT/Day', isActive: row.isActive });
            setMode('edit');
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Production Line' : `Edit — ${selectedLine?.name}`}
        subtitle="Blending, granulation, bagging and packaging lines registered to a plant"
        breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Production Lines', href: '#' }, { label: mode === 'create' ? 'New Line' : 'Edit' }]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Line Identity',
            fields: [
              { label: 'Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. BL-001, GR-001" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Blending Line 1" /> },
              { label: 'Description', field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" /> },
            ],
          },
          {
            title: 'Classification',
            fields: [
              { label: 'Plant *', required: true, field: <Select value={formData.plantId} onChange={(e) => setFormData({ ...formData, plantId: e.target.value })} options={[{ value: '', label: 'Select Plant' }, ...plants.map((p) => ({ value: p.id, label: p.name }))]} /> },
              { label: 'Line Type', field: <Select value={formData.lineType} onChange={(e) => setFormData({ ...formData, lineType: e.target.value })} options={LINE_TYPES.map((t) => ({ value: t, label: t }))} /> },
              { label: 'Design Capacity', field: <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} placeholder="e.g. 200" /> },
              { label: 'Capacity UOM', field: <Input value={formData.capacityUom} onChange={(e) => setFormData({ ...formData, capacityUom: e.target.value })} placeholder="e.g. MT/Day, Bags/Hour" /> },
              { label: 'Status', field: <Select value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /> },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Production Lines"
      subtitle="Manufacturing lines including blending, granulation, bagging, and packaging operations."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Production Lines' }]}
      primaryAction={{
        label: 'Register Line',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', description: '', plantId: plants[0]?.id || '', lineType: 'BLENDING', capacity: '', capacityUom: 'MT/Day', isActive: true });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Production Lines" value={lines.length} icon={<IconFactory size={20} />} />
        <KpiCard title="Active" value={lines.filter((l) => l.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Plants Covered" value={new Set(lines.map((l) => l.plantId)).size} icon={<IconFactory size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ padding: '1rem' }}>
          <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState title="Failed to Load Production Lines" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Production Lines Found" description={searchQuery ? 'No lines match your search.' : 'No production lines registered yet.'} />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
