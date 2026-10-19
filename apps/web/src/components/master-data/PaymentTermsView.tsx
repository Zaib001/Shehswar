'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconCreditCard, IconPlus, IconRefresh, IconEdit, IconCheck } from '../icons';

interface PaymentTerm {
  id: string;
  code: string;
  name: string;
  description?: string;
  dueDays: number;
  discountDays?: number;
  discountPercent?: number;
  isActive: boolean;
}

export const PaymentTermsView: React.FC = () => {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedTerm, setSelectedTerm] = useState<PaymentTerm | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    dueDays: '',
    discountDays: '',
    discountPercent: '',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<PaymentTerm[]>('/api/v1/master-data/payment-terms');
      setTerms(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment terms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = terms.filter((t) =>
    t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.dueDays) {
      showToast({ title: 'Validation Error', message: 'Code, name, and due days are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        dueDays: Number(formData.dueDays),
        discountDays: formData.discountDays ? Number(formData.discountDays) : undefined,
        discountPercent: formData.discountPercent ? Number(formData.discountPercent) : undefined,
      };
      if (mode === 'edit' && selectedTerm) {
        await ApiClient.patch(`/api/v1/master-data/payment-terms/${selectedTerm.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/payment-terms', payload);
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
      render: (row: PaymentTerm) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Payment Term',
      render: (row: PaymentTerm) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          {row.description && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'dueDays',
      label: 'Net Due',
      render: (row: PaymentTerm) => <span style={{ fontWeight: 600 }}>Net {row.dueDays}</span>,
    },
    {
      key: 'discount',
      label: 'Early Pay Discount',
      render: (row: PaymentTerm) =>
        row.discountPercent ? (
          <span style={{ color: 'var(--color-green-700)', fontWeight: 600, fontSize: '0.82rem' }}>
            {row.discountPercent}% in {row.discountDays} days
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: PaymentTerm) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: PaymentTerm) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedTerm(row);
            setFormData({
              code: row.code,
              name: row.name,
              description: row.description || '',
              dueDays: row.dueDays.toString(),
              discountDays: row.discountDays?.toString() || '',
              discountPercent: row.discountPercent?.toString() || '',
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
        title={mode === 'create' ? 'Register Payment Term' : `Edit — ${selectedTerm?.name}`}
        subtitle="Standard payment conditions used in purchase orders and vendor contracts"
        breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Payment Terms', href: '#' }, { label: mode === 'create' ? 'New Term' : 'Edit' }]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Term Definition',
            fields: [
              { label: 'Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. NET30, COD, NET60" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Net 30 Days" /> },
              { label: 'Description', field: <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" /> },
              { label: 'Due Days *', required: true, field: <Input type="number" value={formData.dueDays} onChange={(e) => setFormData({ ...formData, dueDays: e.target.value })} placeholder="e.g. 30" /> },
            ],
          },
          {
            title: 'Early Payment Discount',
            fields: [
              { label: 'Discount % (optional)', field: <Input type="number" step="0.01" value={formData.discountPercent} onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })} placeholder="e.g. 2" /> },
              { label: 'Discount Window (days)', field: <Input type="number" value={formData.discountDays} onChange={(e) => setFormData({ ...formData, discountDays: e.target.value })} placeholder="e.g. 10" /> },
              { label: 'Status', field: <Select value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /> },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Payment Terms Master"
      subtitle="Standard payment conditions applied to vendor purchase orders and procurement contracts."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Payment Terms' }]}
      primaryAction={{
        label: 'Add Payment Term',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', description: '', dueDays: '', discountDays: '', discountPercent: '', isActive: true });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Payment Terms" value={terms.length} icon={<IconCreditCard size={20} />} />
        <KpiCard title="Active" value={terms.filter((t) => t.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="With Discount" value={terms.filter((t) => t.discountPercent).length} icon={<IconCreditCard size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ padding: '1rem' }}>
          <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState title="Failed to Load Payment Terms" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Payment Terms Found" description={searchQuery ? 'No terms match your search.' : 'No payment terms registered yet.'} />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
