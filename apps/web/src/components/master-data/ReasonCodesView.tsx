'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconList, IconPlus, IconRefresh, IconEdit, IconCheck } from '../icons';

interface ReasonCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
}

const REASON_CATEGORIES = ['RETURN', 'ADJUSTMENT', 'WASTAGE', 'REJECTION', 'CANCELLATION', 'OTHER'];

export const ReasonCodesView: React.FC = () => {
  const [codes, setCodes] = useState<ReasonCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedCode, setSelectedCode] = useState<ReasonCode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'RETURN',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<ReasonCode[]>('/api/v1/master-data/reason-codes');
      setCodes(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reason codes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = codes.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      showToast({ title: 'Validation Error', message: 'Code and name are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (mode === 'edit' && selectedCode) {
        await ApiClient.patch(`/api/v1/master-data/reason-codes/${selectedCode.id}`, formData);
        showToast({ title: 'Updated', message: `${formData.name} updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/reason-codes', formData);
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

  const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    RETURN: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    ADJUSTMENT: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
    WASTAGE: { bg: '#FEFCE8', text: '#CA8A04', border: '#FDE68A' },
    REJECTION: { bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8' },
    CANCELLATION: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
    OTHER: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: ReasonCode) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Reason',
      render: (row: ReasonCode) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: ReasonCode) => {
        const colors = CATEGORY_COLORS[row.category] || CATEGORY_COLORS.OTHER || { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' };
        return (
          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            {row.category}
          </span>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: ReasonCode) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: ReasonCode) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedCode(row);
            setFormData({ code: row.code, name: row.name, description: row.description || '', category: row.category, isActive: row.isActive });
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
        title={mode === 'create' ? 'Register Reason Code' : `Edit — ${selectedCode?.name}`}
        subtitle="Return, adjustment, wastage, and rejection reason codes used across inventory operations"
        breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Reason Codes', href: '#' }, { label: mode === 'create' ? 'New Code' : 'Edit' }]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Reason Definition',
            fields: [
              { label: 'Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. RET-DEFECT, WASTE-SPILLAGE" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Defective Product Return" /> },
              { label: 'Description', field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="When to use this reason code" /> },
              { label: 'Category *', required: true, field: <Select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} options={REASON_CATEGORIES.map((c) => ({ value: c, label: c }))} /> },
              { label: 'Status', field: <Select value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /> },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Reason Codes"
      subtitle="Standardized reason codes for returns, inventory adjustments, wastage, and rejection transactions."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Reason Codes' }]}
      primaryAction={{
        label: 'Add Reason Code',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', description: '', category: 'RETURN', isActive: true });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Reason Codes" value={codes.length} icon={<IconList size={20} />} />
        <KpiCard title="Active" value={codes.filter((c) => c.isActive).length} icon={<IconCheck size={20} />} />
        {REASON_CATEGORIES.slice(0, 2).map((cat) => (
          <KpiCard key={cat} title={cat} value={codes.filter((c) => c.category === cat).length} icon={<IconList size={20} />} />
        ))}
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={[{ value: 'ALL', label: 'All Categories' }, ...REASON_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : error ? (
        <ErrorState title="Failed to Load Reason Codes" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Reason Codes Found" description={searchQuery ? 'No codes match your search.' : 'No reason codes registered yet.'} />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
