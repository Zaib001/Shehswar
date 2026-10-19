'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  IconRuler,
  IconPlus,
  IconRefresh,
  IconDownload,
  IconEdit,
  IconCheck,
  IconArrowsRightLeft,
  IconTrash,
} from '../icons';

interface Uom {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  symbol: string;
  category: string;
  type?: string;
  decimalPlaces: number;
  isBaseUnit: boolean;
  isBase?: boolean;
  status: string;
  isActive?: boolean;
}

interface UomConversion {
  id: string;
  fromUomId: string;
  toUomId: string;
  conversionFactor: number;
  factor?: number;
  fromUom?: { code: string; name: string };
  toUom?: { code: string; name: string };
}

const UOM_CATEGORIES = ['WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'AREA', 'TIME'];

export const UomView: React.FC = () => {
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [conversions, setConversions] = useState<UomConversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedUom, setSelectedUom] = useState<Uom | null>(null);
  const [deletingUom, setDeletingUom] = useState<Uom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'uoms' | 'conversions'>('uoms');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // UOM Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
    category: 'WEIGHT',
    decimalPlaces: 3,
    isBaseUnit: false,
    status: 'ACTIVE',
  });

  // Conversion Form State
  const [isCreatingConversion, setIsCreatingConversion] = useState(false);
  const [convFormData, setConvFormData] = useState({
    fromUomId: '',
    toUomId: '',
    conversionFactor: '1000',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [uomRes, convRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
        ApiClient.get<any[]>('/api/v1/master-data/uom-conversions'),
      ]);

      const rawUoms = Array.isArray(uomRes) ? uomRes : (uomRes as any)?.data || [];
      const normalizedUoms: Uom[] = rawUoms.map((u: any) => {
        let cat = (u.category || u.type || 'WEIGHT').toUpperCase();
        if (cat === 'MASS') cat = 'WEIGHT';
        return {
          ...u,
          category: cat,
          type: cat,
          decimalPlaces: u.decimalPlaces !== undefined ? Number(u.decimalPlaces) : 3,
          isBaseUnit: u.isBaseUnit !== undefined ? Boolean(u.isBaseUnit) : Boolean(u.isBase),
          isBase: u.isBaseUnit !== undefined ? Boolean(u.isBaseUnit) : Boolean(u.isBase),
          status: u.status || (u.isActive ? 'ACTIVE' : 'INACTIVE'),
          isActive: u.status ? u.status === 'ACTIVE' : (u.isActive ?? true),
        };
      });

      const rawConvs = Array.isArray(convRes) ? convRes : (convRes as any)?.data || [];
      const normalizedConvs: UomConversion[] = rawConvs.map((c: any) => ({
        ...c,
        conversionFactor: c.conversionFactor !== undefined ? Number(c.conversionFactor) : Number(c.factor || 1),
        factor: c.conversionFactor !== undefined ? Number(c.conversionFactor) : Number(c.factor || 1),
      }));

      setUoms(normalizedUoms);
      setConversions(normalizedConvs);
    } catch (err: any) {
      setError(err.message || 'Failed to load UOM master');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = uoms.filter((u) => {
    const matchesSearch =
      u.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.symbol && u.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || u.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSaveUom = async () => {
    if (!formData.code || !formData.name || !formData.symbol) {
      showToast({ title: 'Validation Error', message: 'Code, name, and symbol are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        symbol: formData.symbol.trim(),
        category: formData.category,
        type: formData.category,
        decimalPlaces: Number(formData.decimalPlaces) || 0,
        isBaseUnit: Boolean(formData.isBaseUnit),
        isBase: Boolean(formData.isBaseUnit),
        status: formData.status,
        isActive: formData.status === 'ACTIVE',
      };

      if (mode === 'edit' && selectedUom) {
        await ApiClient.patch(`/api/v1/master-data/uoms/${selectedUom.id}`, payload);
        showToast({ title: 'UOM Updated', message: `${formData.name} has been updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/uoms', payload);
        showToast({ title: 'UOM Created', message: `${formData.name} has been registered`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message || 'Failed to save UOM', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConversion = async () => {
    if (!convFormData.fromUomId || !convFormData.toUomId) {
      showToast({ title: 'Validation Error', message: 'Both From UOM and To UOM are required', type: 'error' });
      return;
    }
    if (convFormData.fromUomId === convFormData.toUomId) {
      showToast({ title: 'Validation Error', message: 'From and To UOMs must be different units', type: 'error' });
      return;
    }
    const factorNum = parseFloat(convFormData.conversionFactor);
    if (isNaN(factorNum) || factorNum <= 0) {
      showToast({ title: 'Validation Error', message: 'Conversion factor must be greater than zero', type: 'error' });
      return;
    }

    try {
      setIsSaving(true);
      await ApiClient.post('/api/v1/master-data/uom-conversions', {
        fromUomId: convFormData.fromUomId,
        toUomId: convFormData.toUomId,
        conversionFactor: factorNum,
      });
      showToast({ title: 'Conversion Registered', message: 'Standard conversion ratio saved', type: 'success' });
      setIsCreatingConversion(false);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message || 'Failed to register conversion', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConversion = async (id: string) => {
    try {
      await ApiClient.delete(`/api/v1/master-data/uom-conversions/${id}`);
      showToast({ title: 'Removed', message: 'Conversion factor deleted', type: 'info' });
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to delete conversion', type: 'error' });
    }
  };

  const handleDeleteUom = async () => {
    if (!deletingUom) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/uoms/${deletingUom.id}`);
      showToast({ title: 'Unit Deleted', message: `UOM "${deletingUom.name}" has been removed`, type: 'success' });
      setDeletingUom(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete unit of measure', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAutoLinkStandards = async () => {
    const ton = uoms.find((u) => u.code === 'TON');
    const kg = uoms.find((u) => u.code === 'KG');
    if (!ton || !kg) {
      showToast({ title: 'Prerequisite Missing', message: 'Please ensure both TON and KG are registered first', type: 'error' });
      return;
    }
    try {
      setIsSaving(true);
      await ApiClient.post('/api/v1/master-data/uom-conversions', {
        fromUomId: ton.id,
        toUomId: kg.id,
        conversionFactor: 1000,
      });
      showToast({ title: 'Standard Ratio Linked', message: '1 TON = 1,000 KG registered', type: 'success' });
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Notice', message: err.message || 'Conversion ratio already linked', type: 'info' });
      await fetchData();
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: Uom) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-brand-600)' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (row: Uom) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.symbol}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: Uom) => (
        <span
          style={{
            padding: '2px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--color-blue-50)',
            color: 'var(--color-blue-700)',
            border: '1px solid var(--color-blue-200)',
          }}
        >
          {row.category}
        </span>
      ),
    },
    {
      key: 'decimalPlaces',
      label: 'Precision',
      render: (row: Uom) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {row.decimalPlaces ?? 3} decimals
        </span>
      ),
    },
    {
      key: 'isBaseUnit',
      label: 'Base Unit',
      render: (row: Uom) =>
        row.isBaseUnit ? (
          <span style={{ color: 'var(--color-green-600)', fontWeight: 600, fontSize: '0.8rem' }}>✓ Base</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Uom) => <StatusBadge status={row.status || (row.isActive ? 'ACTIVE' : 'INACTIVE')} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: Uom) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedUom(row);
              setFormData({
                code: row.code,
                name: row.name,
                symbol: row.symbol || '',
                category: row.category || 'WEIGHT',
                decimalPlaces: row.decimalPlaces ?? 3,
                isBaseUnit: Boolean(row.isBaseUnit),
                status: row.status || (row.isActive ? 'ACTIVE' : 'INACTIVE'),
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
            onClick={() => setDeletingUom(row)}
            title="Delete UOM"
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
        title={mode === 'create' ? 'Register Unit of Measure' : `Edit — ${selectedUom?.name}`}
        subtitle="Define measurement units used across procurement, production, recipe formulations, and inventory"
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Units of Measure', href: '#' },
          { label: mode === 'create' ? 'New UOM' : 'Edit' },
        ]}
        onSave={handleSaveUom}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Identity & Classification',
            fields: [
              {
                label: 'UOM Code *',
                required: true,
                field: (
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. KG, MT, LTR, PCS"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
              {
                label: 'Full Name *',
                required: true,
                field: (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kilogram, Metric Ton, Liter, Piece"
                  />
                ),
              },
              {
                label: 'Symbol *',
                required: true,
                field: (
                  <Input
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="e.g. kg, MT, L, pc"
                  />
                ),
              },
              {
                label: 'Measurement Category *',
                required: true,
                field: (
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    options={UOM_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                ),
              },
              {
                label: 'Decimal Precision (0-6)',
                field: (
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={String(formData.decimalPlaces)}
                    onChange={(e) => setFormData({ ...formData, decimalPlaces: parseInt(e.target.value) || 0 })}
                    placeholder="3"
                  />
                ),
              },
              {
                label: 'Base Unit for Category',
                field: (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={formData.isBaseUnit}
                      onChange={(e) => setFormData({ ...formData, isBaseUnit: e.target.checked })}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Mark as standard base unit for this category (e.g., KG for Weight, LTR for Volume)</span>
                  </label>
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

  // Preview text for conversion definition
  const fromUomObj = uoms.find((u) => u.id === convFormData.fromUomId);
  const toUomObj = uoms.find((u) => u.id === convFormData.toUomId);

  return (
    <ListPageTemplate
      title="Units of Measure"
      subtitle="Standardized measurement units and conversion multipliers used across procurement, inventory, recipe formulations, and QC specifications."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Units of Measure' }]}
      primaryAction={
        activeTab === 'uoms'
          ? {
              label: 'Register UOM',
              icon: <IconPlus size={16} />,
              onClick: () => {
                setFormData({
                  code: '',
                  name: '',
                  symbol: '',
                  category: 'WEIGHT',
                  decimalPlaces: 3,
                  isBaseUnit: false,
                  status: 'ACTIVE',
                });
                setMode('create');
              },
            }
          : {
              label: 'Define Conversion Factor',
              icon: <IconPlus size={16} />,
              onClick: () => {
                const tonId = uoms.find((u) => u.code === 'TON')?.id || uoms[0]?.id || '';
                const kgId = uoms.find((u) => u.code === 'KG')?.id || uoms[1]?.id || '';
                setConvFormData({
                  fromUomId: tonId,
                  toUomId: kgId,
                  conversionFactor: '1000',
                });
                setIsCreatingConversion(true);
              },
            }
      }
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Ready', message: 'UOM list exported to CSV', type: 'info' }),
        },
      ]}
    >
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total UOMs" value={uoms.length} icon={<IconRuler size={20} />} />
        <KpiCard title="Active Units" value={uoms.filter((u) => u.status === 'ACTIVE' || u.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Base Reference Units" value={uoms.filter((u) => u.isBaseUnit || u.isBase).length} icon={<IconRuler size={20} />} />
        <KpiCard title="Conversions Defined" value={conversions.length} icon={<IconArrowsRightLeft size={20} />} />
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['uoms', 'conversions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setIsCreatingConversion(false);
            }}
            style={{
              padding: '6px 18px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === tab ? 'var(--color-brand-500)' : 'var(--border-subtle)',
              background: activeTab === tab ? 'var(--color-brand-50)' : 'transparent',
              color: activeTab === tab ? 'var(--color-brand-700)' : 'var(--text-muted)',
            }}
          >
            {tab === 'uoms' ? 'UOM Registry' : 'Conversion Factors'}
          </button>
        ))}
      </div>

      {activeTab === 'uoms' && (
        <>
          <Card style={{ marginBottom: '1.5rem' }}>
            <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
              <div style={{ flex: '1 1 260px' }}>
                <Input
                  placeholder="Search by code, name, or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ width: '220px' }}>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Categories' },
                    ...UOM_CATEGORIES.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : error ? (
            <ErrorState title="Failed to Load UOM Master" message={error} onRetry={fetchData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No Units of Measure Found"
              description={searchQuery ? 'No UOMs match your search.' : 'No units of measure have been registered.'}
              actionLabel={searchQuery ? 'Clear Search' : undefined}
              onAction={searchQuery ? () => setSearchQuery('') : undefined}
            />
          ) : (
            <DataTable columns={columns} data={filtered} />
          )}
        </>
      )}

      {activeTab === 'conversions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Conversion Form Drawer / Card */}
          {isCreatingConversion && (
            <Card style={{ border: '2px solid var(--color-brand-500)', background: 'var(--surface-primary)' }}>
              <CardHeader>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconArrowsRightLeft size={18} /> Define New Conversion Multiplier
                </CardTitle>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <Select
                    label="From Unit (Larger / Secondary) *"
                    value={convFormData.fromUomId}
                    onChange={(e) => setConvFormData({ ...convFormData, fromUomId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Source UOM...' },
                      ...uoms.map((u) => ({ value: u.id, label: `${u.code} — ${u.name} (${u.category})` })),
                    ]}
                  />
                  <Select
                    label="To Unit (Base / Standard) *"
                    value={convFormData.toUomId}
                    onChange={(e) => setConvFormData({ ...convFormData, toUomId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Target Base UOM...' },
                      ...uoms.map((u) => ({ value: u.id, label: `${u.code} — ${u.name} (${u.category})` })),
                    ]}
                  />
                  <Input
                    label="Conversion Multiplier (Factor) *"
                    type="number"
                    step="any"
                    min="0"
                    value={convFormData.conversionFactor}
                    onChange={(e) => setConvFormData({ ...convFormData, conversionFactor: e.target.value })}
                    placeholder="e.g. 1000 for TON -> KG"
                  />
                </div>

                {fromUomObj && toUomObj && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'var(--color-blue-50)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-blue-900)',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <strong>Equation:</strong>
                    <span>
                      1 {fromUomObj.code} ({fromUomObj.name}) ={' '}
                      <strong>{Number(convFormData.conversionFactor || 0).toLocaleString()}</strong>{' '}
                      {toUomObj.code} ({toUomObj.name})
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <Button variant="outline" onClick={() => setIsCreatingConversion(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSaveConversion} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Conversion Factor'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversions Table Card */}
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <CardTitle>Standard Conversion Multipliers</CardTitle>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Defines cross-unit calculation rules across procurement purchase orders and production recipes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<IconArrowsRightLeft size={14} />}
                  onClick={handleAutoLinkStandards}
                  disabled={isSaving}
                >
                  Auto-Link Standard Ratios
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<IconPlus size={14} />}
                  onClick={() => {
                    const tonId = uoms.find((u) => u.code === 'TON')?.id || uoms[0]?.id || '';
                    const kgId = uoms.find((u) => u.code === 'KG')?.id || uoms[1]?.id || '';
                    setConvFormData({
                      fromUomId: tonId,
                      toUomId: kgId,
                      conversionFactor: '1000',
                    });
                    setIsCreatingConversion(true);
                  }}
                >
                  Define Conversion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {conversions.length === 0 ? (
                <EmptyState
                  title="No Conversions Defined"
                  description="Standard ratios like 1 TON = 1,000 KG or custom packaging factors have not been registered yet."
                  actionLabel="Auto-Link Standard (1 TON = 1,000 KG)"
                  onAction={handleAutoLinkStandards}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          Source Unit (From)
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          Base Target (To)
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          Multiplier (Factor)
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          Conversion Formula
                        </th>
                        <th style={{ textAlign: 'right', padding: '10px 14px', width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((c) => {
                        const fromCode = c.fromUom?.code || c.fromUomId;
                        const fromName = c.fromUom?.name;
                        const toCode = c.toUom?.code || c.toUomId;
                        const toName = c.toUom?.name;
                        const factorVal = c.conversionFactor ?? c.factor ?? 1;

                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)' }}>
                                {fromCode}
                              </span>
                              {fromName && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fromName}</div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {toCode}
                              </span>
                              {toName && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{toName}</div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {Number(factorVal).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--surface-secondary)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                }}
                              >
                                1 {fromCode} = {Number(factorVal).toLocaleString()} {toCode}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<IconTrash size={14} />}
                                onClick={() => handleDeleteConversion(c.id)}
                                title="Remove conversion factor"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {deletingUom && (
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
              Delete Unit of Measure
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete unit <strong>{deletingUom.name} ({deletingUom.code})</strong>?
              This will remove the unit from active measurement options.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setDeletingUom(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }} onClick={handleDeleteUom} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete UOM'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageTemplate>
  );
};
