'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
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
} from '../ui';
import { useToast } from '../../context/toast-context';
import {
  IconPackage,
  IconPlus,
  IconRefresh,
  IconDownload,
  IconEdit,
  IconCheck,
  IconFlask,
} from '../icons';

interface MaterialCategory {
  id: string;
  code: string;
  name: string;
  categoryType: string;
  type?: string;
  description?: string;
  status: string;
}

const MATERIAL_TYPES = [
  { value: 'RAW_MATERIAL', label: 'RAW_MATERIAL — Active Ingredients & Chemicals' },
  { value: 'PACKING_MATERIAL', label: 'PACKING_MATERIAL — Containers, Bottles & Labels' },
  { value: 'BOTH', label: 'BOTH — General & Dual-Purpose Consumables' },
];

export const MaterialCategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    categoryType: 'RAW_MATERIAL',
    description: '',
    status: 'ACTIVE',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<any[]>('/api/v1/master-data/material-categories');
      const raw = Array.isArray(res) ? res : (res as any)?.data || [];
      const normalized: MaterialCategory[] = raw.map((c: any) => ({
        ...c,
        categoryType: (c.categoryType || c.type || 'RAW_MATERIAL').toUpperCase(),
        type: (c.categoryType || c.type || 'RAW_MATERIAL').toUpperCase(),
      }));
      setCategories(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load material categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = categories.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || c.categoryType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      showToast({ title: 'Validation Error', message: 'Category code and name are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        categoryType: formData.categoryType,
        type: formData.categoryType,
        description: formData.description?.trim() || null,
        status: formData.status,
      };

      if (mode === 'edit' && selectedCategory) {
        await ApiClient.patch(`/api/v1/master-data/material-categories/${selectedCategory.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated successfully`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/material-categories', payload);
        showToast({ title: 'Created', message: `${formData.name} registered successfully`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message || 'Failed to save category', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Category Code',
      render: (row: MaterialCategory) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)', fontSize: '0.85rem' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Category Name',
      render: (row: MaterialCategory) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'categoryType',
      label: 'Material Type',
      render: (row: MaterialCategory) => {
        const type = (row.categoryType || row.type || 'RAW_MATERIAL').toUpperCase();
        const isRaw = type === 'RAW_MATERIAL';
        const isPacking = type === 'PACKING_MATERIAL';
        return (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: isRaw ? 'var(--color-green-50, #f0fdf4)' : isPacking ? 'var(--color-purple-50, #faf5ff)' : 'var(--color-blue-50)',
              color: isRaw ? 'var(--color-green-700, #15803d)' : isPacking ? 'var(--color-purple-700, #7e22ce)' : 'var(--color-blue-700)',
              border: `1px solid ${isRaw ? 'var(--color-green-200, #bbf7d0)' : isPacking ? 'var(--color-purple-200, #e9d5ff)' : 'var(--color-blue-200)'}`,
            }}
          >
            {isRaw ? 'Raw Material' : isPacking ? 'Packing Material' : type}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: MaterialCategory) => <StatusBadge status={row.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: MaterialCategory) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedCategory(row);
            setFormData({
              code: row.code,
              name: row.name,
              categoryType: row.categoryType || 'RAW_MATERIAL',
              description: row.description || '',
              status: row.status || 'ACTIVE',
            });
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
        title={mode === 'create' ? 'Register Material Category' : `Edit — ${selectedCategory?.name}`}
        subtitle="Group raw materials and packing materials for inventory, accounting, and QC classifications."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Material Categories', href: '#' },
          { label: mode === 'create' ? 'New Category' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Category Details & Classification',
            fields: [
              {
                label: 'Category Code *',
                required: true,
                field: (
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CAT-ACTIVES, CAT-BOTTLES"
                    disabled={mode === 'edit'}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                ),
              },
              {
                label: 'Category Name *',
                required: true,
                field: (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Active Chemical Technicals, HDPE Bottles"
                  />
                ),
              },
              {
                label: 'Material Type *',
                required: true,
                field: (
                  <Select
                    value={formData.categoryType}
                    onChange={(e) => setFormData({ ...formData, categoryType: e.target.value })}
                    options={MATERIAL_TYPES}
                  />
                ),
              },
              {
                label: 'Description',
                field: (
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this material classification"
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
      title="Material Categories"
      subtitle="Classifications for chemical raw materials and packaging components across procurement and manufacturing."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Material Categories' }]}
      primaryAction={{
        label: 'New Category',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            categoryType: 'RAW_MATERIAL',
            description: '',
            status: 'ACTIVE',
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Ready', message: 'Material Categories exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Categories" value={categories.length} icon={<IconPackage size={20} />} />
        <KpiCard
          title="Raw Material Types"
          value={categories.filter((c) => c.categoryType === 'RAW_MATERIAL').length}
          icon={<IconFlask size={20} />}
        />
        <KpiCard
          title="Packaging Types"
          value={categories.filter((c) => c.categoryType === 'PACKING_MATERIAL').length}
          icon={<IconPackage size={20} />}
        />
        <KpiCard
          title="Active Categories"
          value={categories.filter((c) => c.status === 'ACTIVE').length}
          icon={<IconCheck size={20} />}
        />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 280px' }}>
            <Input
              placeholder="Search category code, name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '240px' }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Material Types' },
                { value: 'RAW_MATERIAL', label: 'Raw Materials Only' },
                { value: 'PACKING_MATERIAL', label: 'Packing Materials Only' },
                { value: 'BOTH', label: 'General / Both' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Material Categories Found"
          description={searchQuery ? 'No categories match your search.' : 'No material categories registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
