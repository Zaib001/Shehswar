'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconTag, IconPlus, IconRefresh, IconEdit, IconCheck } from '../icons';

interface TaxCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  taxType: string;
  rate: number;
  isCompound: boolean;
  appliesTo: string;
  isActive: boolean;
}

const TAX_TYPES = ['GST', 'WHT', 'FED', 'CUSTOMS', 'EXCISE', 'OTHER'];
const APPLIES_TO = ['SALES', 'PURCHASES', 'BOTH'];

export const TaxCategoriesView: React.FC = () => {
  const [taxes, setTaxes] = useState<TaxCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedTax, setSelectedTax] = useState<TaxCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    taxType: 'GST',
    rate: '',
    isCompound: false,
    appliesTo: 'BOTH',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<TaxCategory[]>('/api/v1/master-data/tax-categories');
      setTaxes(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tax categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = taxes.filter((t) => {
    const matchesSearch =
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || t.taxType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.rate) {
      showToast({ title: 'Validation Error', message: 'Code, name, and rate are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...formData, rate: Number(formData.rate) };
      if (mode === 'edit' && selectedTax) {
        await ApiClient.patch(`/api/v1/master-data/tax-categories/${selectedTax.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/tax-categories', payload);
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
      render: (row: TaxCategory) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Tax Category',
      render: (row: TaxCategory) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'taxType',
      label: 'Type',
      render: (row: TaxCategory) => (
        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
          {row.taxType}
        </span>
      ),
    },
    {
      key: 'rate',
      label: 'Rate',
      render: (row: TaxCategory) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem' }}>
          {row.rate}%
        </span>
      ),
    },
    {
      key: 'appliesTo',
      label: 'Applies To',
      render: (row: TaxCategory) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.appliesTo}</span>,
    },
    {
      key: 'isCompound',
      label: 'Compound',
      render: (row: TaxCategory) =>
        row.isCompound ? (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9333EA' }}>COMPOUND</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: TaxCategory) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: TaxCategory) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedTax(row);
            setFormData({
              code: row.code,
              name: row.name,
              description: row.description || '',
              taxType: row.taxType,
              rate: row.rate.toString(),
              isCompound: row.isCompound,
              appliesTo: row.appliesTo,
              isActive: row.isActive,
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
        title={mode === 'create' ? 'Register Tax Category' : `Edit — ${selectedTax?.name}`}
        subtitle="GST, sales tax, withholding tax, and customs duty definitions used in procurement"
        breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Tax Categories', href: '#' }, { label: mode === 'create' ? 'New Tax' : 'Edit' }]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Tax Definition',
            fields: [
              { label: 'Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. GST17, WHT5" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. GST @ 17%" /> },
              { label: 'Description', field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" /> },
              { label: 'Tax Type *', required: true, field: <Select value={formData.taxType} onChange={(e) => setFormData({ ...formData, taxType: e.target.value })} options={TAX_TYPES.map((t) => ({ value: t, label: t }))} /> },
              { label: 'Rate (%) *', required: true, field: <Input type="number" step="0.01" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: e.target.value })} placeholder="e.g. 17" /> },
              { label: 'Applies To', field: <Select value={formData.appliesTo} onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value })} options={APPLIES_TO.map((a) => ({ value: a, label: a }))} /> },
              {
                label: 'Compound Tax',
                field: (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.isCompound} onChange={(e) => setFormData({ ...formData, isCompound: e.target.checked })} />
                    <span style={{ fontSize: '0.875rem' }}>This is a compound/cascading tax (tax on tax)</span>
                  </label>
                ),
              },
              { label: 'Status', field: <Select value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /> },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Tax Categories"
      subtitle="GST, sales tax, withholding tax, import duties, and other tax definitions applied to procurement transactions."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Tax Categories' }]}
      primaryAction={{
        label: 'Add Tax Category',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', description: '', taxType: 'GST', rate: '', isCompound: false, appliesTo: 'BOTH', isActive: true });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Tax Categories" value={taxes.length} icon={<IconTag size={20} />} />
        <KpiCard title="Active" value={taxes.filter((t) => t.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Compound Taxes" value={taxes.filter((t) => t.isCompound).length} icon={<IconTag size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: 'ALL', label: 'All Tax Types' }, ...TAX_TYPES.map((t) => ({ value: t, label: t }))]} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState title="Failed to Load Tax Categories" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Tax Categories Found" description={searchQuery ? 'No taxes match your search.' : 'No tax categories registered yet.'} />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
