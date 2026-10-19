'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconFlask, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck } from '../icons';

interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  taxClassification?: string;
  taxRate?: number;
  status: string;
}

const TAX_CLASSIFICATION_PRESETS = [
  { label: 'Standard GST (18%)', rate: 18 },
  { label: 'Reduced Rate GST (10%)', rate: 10 },
  { label: 'Special Chemical GST (15%)', rate: 15 },
  { label: 'Zero-Rated GST (0%)', rate: 0 },
  { label: 'Exempt under 6th Schedule (0%)', rate: 0 },
  { label: 'Custom Tax Classification', rate: 0 },
];

export const ProductCategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    taxClassification: 'Standard GST (18%)',
    taxRate: '18',
    status: 'ACTIVE',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<ProductCategory[]>('/api/v1/master-data/product-categories');
      setCategories(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load product categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = categories.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.taxClassification || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        description: formData.description?.trim() || undefined,
        taxClassification: formData.taxClassification?.trim() || undefined,
        taxRate: formData.taxRate !== '' ? Number(formData.taxRate) : undefined,
        status: formData.status,
      };

      if (mode === 'edit' && selectedCategory) {
        await ApiClient.patch(`/api/v1/master-data/product-categories/${selectedCategory.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated successfully`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/product-categories', payload);
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

  const columns = [
    {
      key: 'code',
      label: 'Category Code',
      render: (row: ProductCategory) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)', fontSize: '0.85rem' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Category Name',
      render: (row: ProductCategory) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'taxClassification',
      label: 'Tax Classification',
      render: (row: ProductCategory) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: '#EEF2FF',
            color: '#4338CA',
            border: '1px solid #C7D2FE',
          }}
        >
          {row.taxClassification || 'Standard GST (18%)'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ProductCategory) => <StatusBadge status={row.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: ProductCategory) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedCategory(row);
            setFormData({
              code: row.code,
              name: row.name,
              description: row.description || '',
              taxClassification: row.taxClassification || 'Standard GST (18%)',
              taxRate: row.taxRate !== undefined && row.taxRate !== null ? String(row.taxRate) : '18',
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
        title={mode === 'create' ? 'Register Product Category' : `Edit — ${selectedCategory?.name}`}
        subtitle="Classification hierarchy for manufactured and traded finished goods."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Product Categories', href: '#' },
          { label: mode === 'create' ? 'New Category' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Category Details',
            fields: [
              {
                label: 'Category Code *',
                required: true,
                field: (
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CAT-INSECT"
                    disabled={mode === 'edit'}
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
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
                    placeholder="e.g. Crop Protection — Insecticides"
                  />
                ),
              },
              {
                label: 'Description',
                field: (
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this finished goods classification"
                  />
                ),
              },
            ],
          },
          {
            title: 'Tax & Fiscal Classification',
            fields: [
              {
                label: 'Tax Classification Preset',
                field: (
                  <Select
                    value={
                      TAX_CLASSIFICATION_PRESETS.some((p) => p.label === formData.taxClassification)
                        ? formData.taxClassification
                        : 'Custom Tax Classification'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      const preset = TAX_CLASSIFICATION_PRESETS.find((p) => p.label === val);
                      if (preset && preset.label !== 'Custom Tax Classification') {
                        setFormData({
                          ...formData,
                          taxClassification: preset.label,
                          taxRate: String(preset.rate),
                        });
                      } else {
                        setFormData({
                          ...formData,
                          taxClassification: 'Custom Tax Classification',
                        });
                      }
                    }}
                    options={TAX_CLASSIFICATION_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
                  />
                ),
              },
              {
                label: 'Tax Classification Label *',
                required: true,
                field: (
                  <Input
                    value={formData.taxClassification}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/(\d+(\.\d+)?)%/);
                      setFormData({
                        ...formData,
                        taxClassification: val,
                        taxRate: match?.[1] ?? formData.taxRate,
                      });
                    }}
                    placeholder="e.g. Standard GST (18%)"
                  />
                ),
              },
              {
                label: 'Applicable Sales Tax / GST Rate (%)',
                field: (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    placeholder="e.g. 18"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
            ],
          },
          {
            title: 'Status',
            fields: [
              {
                label: 'Category Status',
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
      title="Product Categories"
      subtitle="Categorization system for all finished goods, crop nutrients, and agricultural inputs."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Product Categories' }]}
      primaryAction={{
        label: 'Create Category',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            description: '',
            taxClassification: 'Standard GST (18%)',
            taxRate: '18',
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
          onClick: () => showToast({ title: 'Export Ready', message: 'Product Categories exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Categories" value={categories.length} icon={<IconFlask size={20} />} />
        <KpiCard title="Active Categories" value={categories.filter((c) => c.status === 'ACTIVE').length} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <Input
              placeholder="Search category code, name, description, or tax classification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          title="No Product Categories Found"
          description={searchQuery ? 'No categories match your search.' : 'No product categories registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
