'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconClock, IconPlus, IconRefresh, IconEdit, IconCheck } from '../icons';

interface Shift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  isNightShift: boolean;
  durationHours?: number;
  isActive: boolean;
}

const SHIFT_TYPES = ['MORNING', 'AFTERNOON', 'NIGHT', 'ROTATING', 'GENERAL'];

export const ShiftsView: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    startTime: '06:00',
    endTime: '14:00',
    shiftType: 'MORNING',
    isNightShift: false,
    durationHours: '',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<any[]>('/api/v1/master-data/shifts');
      const normalized = (res.data || []).map((s: any) => ({
        ...s,
        code: s.code || s.shiftCode || '',
        name: s.name || s.shiftName || '',
        isActive: s.isActive !== undefined ? s.isActive : s.status === 'ACTIVE',
      }));
      setShifts(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load shifts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = shifts.filter((s: any) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      String(s.code || '').toLowerCase().includes(q) ||
      String(s.name || '').toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.startTime || !formData.endTime) {
      showToast({ title: 'Validation Error', message: 'Code, name, start time, and end time are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        durationHours: formData.durationHours ? Number(formData.durationHours) : undefined,
      };
      if (mode === 'edit' && selectedShift) {
        await ApiClient.patch(`/api/v1/master-data/shifts/${selectedShift.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.name} updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/shifts', payload);
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

  const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    MORNING: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    AFTERNOON: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    NIGHT: { bg: '#1E1B4B', text: '#A5B4FC', border: '#3730A3' },
    ROTATING: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    GENERAL: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: Shift) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Shift Name',
      render: (row: Shift) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.isNightShift && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: '#1E1B4B', color: '#A5B4FC' }}>
              NIGHT
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'shiftType',
      label: 'Type',
      render: (row: Shift) => {
        const colors = SHIFT_COLORS[row.shiftType] || SHIFT_COLORS.GENERAL || { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' };
        return (
          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            {row.shiftType}
          </span>
        );
      },
    },
    {
      key: 'timing',
      label: 'Timing',
      render: (row: Shift) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
          {row.startTime} — {row.endTime}
        </span>
      ),
    },
    {
      key: 'durationHours',
      label: 'Duration',
      render: (row: Shift) =>
        row.durationHours ? (
          <span style={{ fontWeight: 600 }}>{row.durationHours}h</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Shift) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: Shift) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedShift(row);
            setFormData({
              code: row.code,
              name: row.name,
              startTime: row.startTime,
              endTime: row.endTime,
              shiftType: row.shiftType,
              isNightShift: row.isNightShift,
              durationHours: row.durationHours?.toString() || '',
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
        title={mode === 'create' ? 'Register Shift' : `Edit — ${selectedShift?.name}`}
        subtitle="Manufacturing shift definitions for production scheduling and attendance"
        breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Shifts', href: '#' }, { label: mode === 'create' ? 'New Shift' : 'Edit' }]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Shift Definition',
            fields: [
              { label: 'Code *', required: true, field: <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. SHIFT-A, SHIFT-N" style={{ fontFamily: 'var(--font-mono)' }} /> },
              { label: 'Name *', required: true, field: <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Morning Shift A" /> },
              { label: 'Shift Type', field: <Select value={formData.shiftType} onChange={(e) => setFormData({ ...formData, shiftType: e.target.value })} options={SHIFT_TYPES.map((t) => ({ value: t, label: t }))} /> },
              { label: 'Start Time *', required: true, field: <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /> },
              { label: 'End Time *', required: true, field: <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /> },
              { label: 'Duration (hours)', field: <Input type="number" step="0.5" value={formData.durationHours} onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })} placeholder="e.g. 8" /> },
              {
                label: 'Night Shift',
                field: (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.isNightShift} onChange={(e) => setFormData({ ...formData, isNightShift: e.target.checked })} />
                    <span style={{ fontSize: '0.875rem' }}>This shift crosses midnight / is classified as night shift</span>
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
      title="Shift Master"
      subtitle="Morning, afternoon, and night shift definitions for manufacturing and production scheduling."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Shifts' }]}
      primaryAction={{
        label: 'Register Shift',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({ code: '', name: '', startTime: '06:00', endTime: '14:00', shiftType: 'MORNING', isNightShift: false, durationHours: '8', isActive: true });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Shifts" value={shifts.length} icon={<IconClock size={20} />} />
        <KpiCard title="Active" value={shifts.filter((s) => s.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Night Shifts" value={shifts.filter((s) => s.isNightShift).length} icon={<IconClock size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ padding: '1rem' }}>
          <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : error ? (
        <ErrorState title="Failed to Load Shifts" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Shifts Found" description={searchQuery ? 'No shifts match your search.' : 'No shifts registered yet.'} />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
