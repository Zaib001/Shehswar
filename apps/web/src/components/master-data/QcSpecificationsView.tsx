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
  Badge,
} from '../ui';
import { useToast } from '../../context/toast-context';
import {
  IconPlus,
  IconRefresh,
  IconEdit,
  IconFileText,
} from '../icons';

interface QcParameter {
  id?: string;
  parameterName: string;
  minimumValue?: number | string;
  maximumValue?: number | string;
  targetValue?: number | string;
  uom?: string;
  testMethod?: string;
  mandatory: boolean;
}

interface QcSpecification {
  id: string;
  code: string;
  name: string;
  appliesToType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
  rawMaterialId?: string;
  finishedProductId?: string;
  version: number;
  status: string;
  approvalStatus: string;
  parameters?: QcParameter[];
  rawMaterial?: { materialCode: string; materialName: string };
  finishedProduct?: { productCode: string; productName: string };
}

export const QcSpecificationsView: React.FC = () => {
  const [specs, setSpecs] = useState<QcSpecification[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedSpec, setSelectedSpec] = useState<QcSpecification | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    appliesToType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
    rawMaterialId: string;
    finishedProductId: string;
    parameters: QcParameter[];
  }>({
    code: '',
    name: '',
    appliesToType: 'FINISHED_PRODUCT',
    rawMaterialId: '',
    finishedProductId: '',
    parameters: [
      {
        parameterName: 'Active Ingredient Concentration',
        minimumValue: '19.5',
        maximumValue: '20.5',
        targetValue: '20.0',
        uom: '%',
        testMethod: 'HPLC Chromatography',
        mandatory: true,
      },
    ],
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [specRes, rmRes, fpRes] = await Promise.all([
        ApiClient.get<QcSpecification[]>('/api/v1/master-data/qc-specifications'),
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/finished-products'),
      ]);
      setSpecs(specRes.data || []);
      setRawMaterials(rmRes.data || []);
      setFinishedProducts(fpRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load QC specifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddParam = () => {
    setFormData((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          parameterName: '',
          minimumValue: '',
          maximumValue: '',
          targetValue: '',
          uom: '',
          testMethod: '',
          mandatory: true,
        },
      ],
    }));
  };

  const handleRemoveParam = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  };

  const handleParamChange = (index: number, field: keyof QcParameter, value: any) => {
    setFormData((prev) => {
      const nextParams = [...prev.parameters];
      nextParams[index] = { ...nextParams[index], [field]: value } as QcParameter;
      return { ...prev, parameters: nextParams };
    });
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      showToast({ title: 'Validation Error', message: 'Code and Name are required', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          appliesToType: formData.appliesToType,
          rawMaterialId:
            formData.appliesToType === 'RAW_MATERIAL' ? formData.rawMaterialId || undefined : undefined,
          finishedProductId:
            formData.appliesToType === 'FINISHED_PRODUCT' ? formData.finishedProductId || undefined : undefined,
          parameters: formData.parameters.map((p) => ({
            parameterName: p.parameterName,
            minimumValue: p.minimumValue ? Number(p.minimumValue) : undefined,
            maximumValue: p.maximumValue ? Number(p.maximumValue) : undefined,
            targetValue: p.targetValue ? Number(p.targetValue) : undefined,
            uom: p.uom,
            testMethod: p.testMethod,
            mandatory: Boolean(p.mandatory),
          })),
        };
        await ApiClient.post('/api/v1/master-data/qc-specifications', payload);
        showToast({ title: 'Success', message: 'QC Specification created successfully', type: 'success' });
      } else if (mode === 'edit' && selectedSpec) {
        await ApiClient.patch(`/api/v1/master-data/qc-specifications/${selectedSpec.id}`, {
          name: formData.name,
        });
        showToast({ title: 'Updated', message: 'QC Specification updated successfully', type: 'success' });
      }
      setMode('list');
      fetchData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to save QC specification', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = specs.filter((s) => {
    const matchesSearch =
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || s.appliesToType === typeFilter;
    return matchesSearch && matchesType;
  });

  const columns = [
    {
      key: 'code',
      header: 'Spec Code',
      render: (row: QcSpecification) => (
        <div>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{row.code}</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>V{row.version}</div>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Specification Name',
      render: (row: QcSpecification) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Target:{' '}
            {row.finishedProduct
              ? `${row.finishedProduct.productCode} (${row.finishedProduct.productName})`
              : row.rawMaterial
              ? `${row.rawMaterial.materialCode} (${row.rawMaterial.materialName})`
              : 'General'}
          </div>
        </div>
      ),
    },
    {
      key: 'appliesToType',
      header: 'Target Type',
      render: (row: QcSpecification) => (
        <Badge variant={row.appliesToType === 'FINISHED_PRODUCT' ? 'primary' : 'info'}>
          {row.appliesToType.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'parameters',
      header: 'QC Parameters',
      render: (row: QcSpecification) => (
        <span style={{ fontSize: '0.85rem' }}>{row.parameters?.length || 0} Test Points</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: QcSpecification) => (
        <StatusBadge status={row.approvalStatus === 'APPROVED' ? 'APPROVED' : 'DRAFT'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: QcSpecification) => (
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedSpec(row);
              setFormData({
                code: row.code,
                name: row.name,
                appliesToType: row.appliesToType,
                rawMaterialId: row.rawMaterialId || '',
                finishedProductId: row.finishedProductId || '',
                parameters: row.parameters || [],
              });
              setMode('detail');
            }}
          >
            View Details
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedSpec(row);
              setFormData({
                code: row.code,
                name: row.name,
                appliesToType: row.appliesToType,
                rawMaterialId: row.rawMaterialId || '',
                finishedProductId: row.finishedProductId || '',
                parameters: row.parameters || [],
              });
              setMode('edit');
            }}
          >
            <IconEdit size={14} />
          </Button>
        </div>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Create QC Specification' : `Edit QC Specification: ${selectedSpec?.code}`}
        subtitle="Define quality inspection assays, physical tolerances, and chemistry assay parameters"
        onCancel={() => setMode('list')}
        breadcrumbs={[
          { label: 'Master Data' },
          { label: 'QC Specifications', onClick: () => setMode('list') },
          { label: mode === 'create' ? 'Create' : 'Edit' },
        ]}
        onSave={handleSave}
        isSaving={isSaving}
        sections={[
          {
            title: 'Specification Header',
            description: 'Core identifying code, assay name, and master entity linkage',
            fields: [
              {
                label: 'Spec Code',
                required: true,
                field: (
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. QC-SPEC-BIO-01"
                    disabled={mode === 'edit'}
                  />
                ),
              },
              {
                label: 'Specification Name',
                required: true,
                field: (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. BioGrow 1L Finished Product QC Assay"
                  />
                ),
              },
              {
                label: 'Target Material Domain',
                required: true,
                field: (
                  <Select
                    value={formData.appliesToType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appliesToType: e.target.value as 'RAW_MATERIAL' | 'FINISHED_PRODUCT',
                      })
                    }
                    options={[
                      { value: 'FINISHED_PRODUCT', label: 'Finished Product' },
                      { value: 'RAW_MATERIAL', label: 'Raw Material' },
                    ]}
                  />
                ),
              },
              {
                label: formData.appliesToType === 'FINISHED_PRODUCT' ? 'Linked Finished Product' : 'Linked Raw Material',
                field:
                  formData.appliesToType === 'FINISHED_PRODUCT' ? (
                    <Select
                      value={formData.finishedProductId}
                      onChange={(e) => setFormData({ ...formData, finishedProductId: e.target.value })}
                      options={[
                        { value: '', label: 'Select Finished Product...' },
                        ...finishedProducts.map((p) => ({
                          value: p.id,
                          label: `${p.productCode} - ${p.productName}`,
                        })),
                      ]}
                    />
                  ) : (
                    <Select
                      value={formData.rawMaterialId}
                      onChange={(e) => setFormData({ ...formData, rawMaterialId: e.target.value })}
                      options={[
                        { value: '', label: 'Select Raw Material...' },
                        ...rawMaterials.map((r) => ({
                          value: r.id,
                          label: `${r.materialCode} - ${r.materialName}`,
                        })),
                      ]}
                    />
                  ),
              },
            ],
          },
          {
            title: 'Assay Parameters & Acceptance Criteria',
            description: 'Laboratory testing points, tolerance boundaries, and standard analytical test methods',
            fields: [
              {
                label: 'Inspection Parameter Checklist',
                field: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {formData.parameters.map((p, idx) => (
                      <Card key={idx} style={{ padding: 'var(--space-md)', background: 'var(--bg-card)' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr auto',
                            gap: 'var(--space-sm)',
                            alignItems: 'center',
                          }}
                        >
                          <Input
                            placeholder="Parameter Name"
                            value={p.parameterName}
                            onChange={(e) => handleParamChange(idx, 'parameterName', e.target.value)}
                          />
                          <Input
                            placeholder="Min"
                            value={String(p.minimumValue ?? '')}
                            onChange={(e) => handleParamChange(idx, 'minimumValue', e.target.value)}
                          />
                          <Input
                            placeholder="Target"
                            value={String(p.targetValue ?? '')}
                            onChange={(e) => handleParamChange(idx, 'targetValue', e.target.value)}
                          />
                          <Input
                            placeholder="Max"
                            value={String(p.maximumValue ?? '')}
                            onChange={(e) => handleParamChange(idx, 'maximumValue', e.target.value)}
                          />
                          <Input
                            placeholder="UOM (%, g/cm3)"
                            value={p.uom || ''}
                            onChange={(e) => handleParamChange(idx, 'uom', e.target.value)}
                          />
                          <Input
                            placeholder="Test Method (e.g. HPLC)"
                            value={p.testMethod || ''}
                            onChange={(e) => handleParamChange(idx, 'testMethod', e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveParam(idx)}
                            disabled={formData.parameters.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </Card>
                    ))}
                    <div>
                      <Button variant="outline" size="sm" onClick={handleAddParam}>
                        <IconPlus size={14} /> Add Parameter
                      </Button>
                    </div>
                  </div>
                ),
              },
            ],
          },
        ]}
      />
    );
  }

  if (mode === 'detail' && selectedSpec) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{selectedSpec.name}</h1>
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Spec Code: {selectedSpec.code} | Version: {selectedSpec.version} | Status: {selectedSpec.approvalStatus}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button variant="outline" onClick={() => setMode('list')}>
              Back to List
            </Button>
            <Button variant="primary" onClick={() => setMode('edit')}>
              <IconEdit size={14} /> Edit Spec
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assay Parameter Limits & Acceptance Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-sm)' }}>#</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Test Parameter</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Minimum</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Target</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Maximum</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Unit</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Test Method</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Mandatory</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSpec.parameters || []).map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: 'var(--space-sm)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: 'var(--space-sm)', fontWeight: 600 }}>{p.parameterName}</td>
                      <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>{p.minimumValue ?? '—'}</td>
                      <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.targetValue ?? '—'}</td>
                      <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>{p.maximumValue ?? '—'}</td>
                      <td style={{ padding: 'var(--space-sm)' }}>{p.uom ?? '—'}</td>
                      <td style={{ padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>{p.testMethod ?? 'Standard'}</td>
                      <td style={{ padding: 'var(--space-sm)' }}>
                        <Badge variant={p.mandatory ? 'success' : 'neutral'}>
                          {p.mandatory ? 'YES' : 'OPTIONAL'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ListPageTemplate
      title="QC Specifications & Laboratory Assays"
      subtitle="Define chemical, physical, and quality inspection criteria for raw materials and manufactured finished goods"
      breadcrumbs={[{ label: 'Master Data' }, { label: 'QC Specifications' }]}
      primaryAction={{
        label: 'New Specification',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            appliesToType: 'FINISHED_PRODUCT',
            rawMaterialId: rawMaterials[0]?.id || '',
            finishedProductId: finishedProducts[0]?.id || '',
            parameters: [
              {
                parameterName: 'Active Technical Assay',
                minimumValue: '98.0',
                maximumValue: '100.0',
                targetValue: '99.0',
                uom: '%',
                testMethod: 'HPLC AOAC',
                mandatory: true,
              },
            ],
          });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Active Specs" value={specs.filter((s) => s.status === 'ACTIVE').length} icon={<IconFileText />} />
        <KpiCard title="Finished Product Assays" value={specs.filter((s) => s.appliesToType === 'FINISHED_PRODUCT').length} />
        <KpiCard title="Raw Material Specs" value={specs.filter((s) => s.appliesToType === 'RAW_MATERIAL').length} />
        <KpiCard title="Approved Formulations" value={specs.filter((s) => s.approvalStatus === 'APPROVED').length} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by code or specification name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Target Domains' },
            { value: 'FINISHED_PRODUCT', label: 'Finished Products' },
            { value: 'RAW_MATERIAL', label: 'Raw Materials' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No QC Specifications Found"
          description="Create your first laboratory inspection specification for raw material lot verification or production batch release."
          actionLabel="Create Specification"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable data={filtered} columns={columns} keyExtractor={(s) => s.id} />
      )}
    </ListPageTemplate>
  );
};
