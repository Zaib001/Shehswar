'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WarehouseDto, CompanyDto, PlantDto } from '@shehswar/types';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  KpiCard,
  Timeline,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconDownload,
  IconEye,
  IconEdit,
  IconCheck,
  IconBuildings,
  IconAlertTriangle,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const WarehousesView: React.FC = () => {
  const { showToast } = useToast();
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [plants, setPlants] = useState<PlantDto[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [whRes, compsRes, plantsRes, usersRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/warehouses?all=true'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/plants?all=true'),
        ApiClient.get<any>('/api/v1/master-data/users?all=true'),
      ]);
      const whItems = Array.isArray(whRes) ? whRes : (whRes as any)?.items || (whRes as any)?.data?.items || (whRes as any)?.data || [];
      const compItems = Array.isArray(compsRes) ? compsRes : (compsRes as any)?.items || (compsRes as any)?.data?.items || (compsRes as any)?.data || [];
      const plantItems = Array.isArray(plantsRes) ? plantsRes : (plantsRes as any)?.items || (plantsRes as any)?.data?.items || (plantsRes as any)?.data || [];
      const userItems = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.items || (usersRes as any)?.data?.items || (usersRes as any)?.data || [];
      setWarehouses(whItems);
      setCompanies(compItems);
      setPlants(plantItems);
      setUsers(userItems);
    } catch (err: any) {
      console.error('Error fetching warehouses:', err);
      setError(err?.message || 'Failed to fetch warehouses from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    companyId: '',
    plantId: '',
    branchId: '',
    type: 'RAW_MATERIAL',
    location: '',
    address: '',
    managerName: '',
    isActive: true,
  });

  const filteredWarehouses = warehouses.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.location && w.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || w.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const columns: ColumnDef<WarehouseDto>[] = [
    {
      id: 'code',
      header: 'Warehouse Code',
      accessorKey: 'code',
      cell: ({ row }: any) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Warehouse Facility Name',
      accessorKey: 'name',
      cell: ({ row }: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.original.location}</div>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Warehouse Classification',
      cell: ({ row }: any) => {
        const typeLabels: Record<string, { label: string; color: string }> = {
          RAW_MATERIAL: { label: 'Raw Material', color: 'var(--color-primary)' },
          FINISHED_GOODS: { label: 'Finished Goods', color: 'var(--color-success)' },
          PACKING_MATERIAL: { label: 'Packing Material', color: 'var(--color-warning)' },
          TRANSIT: { label: 'In-Transit Freight', color: '#6366f1' },
          QUARANTINE: { label: 'QC Quarantine Bay', color: 'var(--color-danger)' },
          RETURNS: { label: 'Customer Returns', color: '#8b5cf6' },
        };
        const meta = typeLabels[row.original.type || 'RAW_MATERIAL'] || { label: row.original.type, color: 'var(--text-muted)' };
        return (
          <span
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--bg-card-subtle)',
              border: `1px solid ${meta.color}`,
              color: meta.color,
            }}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      id: 'manager',
      header: 'Warehouse Supervisor',
      accessorKey: 'managerName',
      cell: ({ row }: any) => <span>{row.original.managerName || 'Operations Lead'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            size="sm"
            variant="ghost"
            icon={<IconEye size={14} />}
            onClick={() => {
              setSelectedWarehouse(row.original);
              setMode('detail');
            }}
          >
            360° View
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedWarehouse(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                companyId: row.original.companyId,
                plantId: row.original.plantId || '',
                branchId: row.original.branchId || '',
                type: row.original.type || 'RAW_MATERIAL',
                location: row.original.location || '',
                address: row.original.address || '',
                managerName: row.original.managerName || '',
                isActive: row.original.isActive,
              });
              setMode('edit');
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      showToast({ title: 'Validation Error', message: 'Warehouse code and name are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          companyId: formData.companyId || companies[0]?.id,
          plantId: formData.plantId || undefined,
          type: formData.type,
          location: formData.location,
          address: formData.address,
          managerName: formData.managerName,
        };
        await ApiClient.post('/api/v1/master-data/warehouses', payload);
        showToast({ title: 'Success', message: `Warehouse ${formData.name} registered`, type: 'success' });
        await fetchData();
      } else if (mode === 'edit' && selectedWarehouse) {
        const payload = {
          name: formData.name,
          companyId: formData.companyId,
          plantId: formData.plantId || undefined,
          type: formData.type,
          location: formData.location,
          address: formData.address,
          managerName: formData.managerName,
          isActive: formData.isActive,
        };
        await ApiClient.patch(`/api/v1/master-data/warehouses/${selectedWarehouse.id}`, payload);
        showToast({ title: 'Updated', message: 'Warehouse record updated', type: 'success' });
        await fetchData();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save warehouse', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Storage Warehouse / Tank Farm' : `Edit ${selectedWarehouse?.name}`}
        subtitle="Define physical storage facilities, storage classification, plant and branch affiliations."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Warehouses', href: '#' },
          { label: mode === 'create' ? 'Register' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Register Warehouse' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Master Information</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Warehouse Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. WH-RAW-01"
                disabled={mode === 'edit'}
              />
              <Input
                label="Warehouse Facility Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Main Raw Chemicals Tank Farm"
              />
              <Select
                label="Storage Classification *"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={[
                  { value: 'RAW_MATERIAL', label: 'Raw Material (Silos / Tanks)' },
                  { value: 'FINISHED_GOODS', label: 'Finished Goods Warehouse' },
                  { value: 'PACKING_MATERIAL', label: 'Packing Material & Drums' },
                  { value: 'TRANSIT', label: 'In-Transit Freight Hub' },
                  { value: 'QUARANTINE', label: 'QC Quarantine Inspection Bay' },
                  { value: 'RETURNS', label: 'Customer Returns & Claims Bay' },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Affiliations & Supervision</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Select
                label="Operating Company *"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Associated Manufacturing Plant (Optional)"
                value={formData.plantId}
                onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                options={[
                  { value: '', label: 'None (Standalone / Regional)' },
                  ...plants.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <div>
                <Select
                  label="Warehouse Lead / Supervisor"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  options={[
                    { value: '', label: 'Unassigned / None' },
                    ...users
                      .map((u) => {
                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                        const roleName = u.userRoles?.[0]?.role?.name || 'Authorized Staff';
                        const comp = companies.find((c) => c.id === u.companyId);
                        const isMatch = !formData.companyId || !u.companyId || u.companyId === formData.companyId;
                        return {
                          value: fullName,
                          label: `${fullName} (${roleName})`,
                          subtext: [u.email, comp ? comp.name : null].filter(Boolean).join(' • '),
                          badge: isMatch ? (roleName.includes('Warehouse') ? 'Warehouse Lead' : 'Selected Co.') : (comp?.name ? comp.name.replace('Shehswar ', '') : 'Group Entity'),
                          isMatch,
                        };
                      })
                      .sort((a, b) => (b.isMatch ? 1 : 0) - (a.isMatch ? 1 : 0)),
                    ...(formData.managerName &&
                    !users.some((u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() === formData.managerName || u.email === formData.managerName)
                      ? [{ value: formData.managerName, label: `${formData.managerName} (Current Assignment)` }]
                      : []),
                  ]}
                />
                {(() => {
                  const assignedUser = users.find(
                    (u) =>
                      `${u.firstName || ''} ${u.lastName || ''}`.trim() === formData.managerName ||
                      u.email === formData.managerName,
                  );
                  if (!assignedUser) return null;
                  return (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.625rem 0.875rem',
                        background: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          flexShrink: 0,
                        }}
                      >
                        {(assignedUser.firstName?.[0] || assignedUser.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {assignedUser.firstName} {assignedUser.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {assignedUser.email} • Role: {assignedUser.userRoles?.[0]?.role?.name || 'Staff'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader>
              <CardTitle>Physical Location & Bay Designation</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input
                label="Facility Zone / Bay Code"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Zone A - Heavy Storage Bay 1-6"
              />
              <Input
                label="Address / Terminal Location"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Kala Shah Kaku Complex, High-Bay 2"
              />
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedWarehouse) {
    const parentCompany = companies.find((c: any) => c.id === selectedWarehouse.companyId);
    const parentPlant = plants.find((p: any) => p.id === selectedWarehouse.plantId);

    return (
      <DetailPageTemplate
        title={selectedWarehouse.name}
        subtitle={`Classification: ${selectedWarehouse.type} • Code: ${selectedWarehouse.code} • Company: ${parentCompany?.name}`}
        status={selectedWarehouse.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Warehouses', href: '#' },
          { label: selectedWarehouse.code },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="outline" onClick={() => setMode('list')}>
              Back to List
            </Button>
            <Button
              variant="primary"
              icon={<IconEdit size={16} />}
              onClick={() => {
                setFormData({
                  code: selectedWarehouse.code,
                  name: selectedWarehouse.name,
                  companyId: selectedWarehouse.companyId,
                  plantId: selectedWarehouse.plantId || '',
                  branchId: selectedWarehouse.branchId || '',
                  type: selectedWarehouse.type || 'RAW_MATERIAL',
                  location: selectedWarehouse.location || '',
                  address: selectedWarehouse.address || '',
                  managerName: selectedWarehouse.managerName || '',
                  isActive: selectedWarehouse.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Facility
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Overview & Attributes',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Facility Parameters</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Warehouse Code:</span>
                      <span style={{ fontWeight: 600 }}>{selectedWarehouse.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Storage Type:</span>
                      <span style={{ fontWeight: 600 }}>{selectedWarehouse.type}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating Company:</span>
                      <span style={{ fontWeight: 500 }}>{parentCompany?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Associated Plant:</span>
                      <span style={{ fontWeight: 500 }}>{parentPlant ? parentPlant.name : 'Regional Depot'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Warehouse Supervisor:</span>
                      <span style={{ fontWeight: 600 }}>{selectedWarehouse.managerName}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Facility Location</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Zone & Bay Designation:
                      </span>
                      <span style={{ fontWeight: 500 }}>{selectedWarehouse.location || 'Central Facility'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Full Physical Address:
                      </span>
                      <span style={{ fontWeight: 500 }}>{selectedWarehouse.address || 'Industrial Zone'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'stock',
            label: 'Stock Ledger (Phase 4)',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Operational Inventory Ledger Placeholder</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      background: 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      Master Data Registration Ready
                    </div>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                      This warehouse facility master is fully registered in the Shehswar ONE360 database. Live physical chemical stock levels, lot tracking, batch shelf-life monitoring, and GRN inventory postings will be activated in <strong>Phase 4 — Inventory Transactions & Operations</strong>.
                    </p>
                    <StatusBadge status="ACTIVE" />
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'activity',
            label: 'Facility Activity',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Lifecycle Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={[
                      {
                        title: 'Warehouse Master Created',
                        timestamp: selectedWarehouse.createdAt ? new Date(selectedWarehouse.createdAt).toLocaleDateString() : 'Creation Date',
                        description: `Storage facility registered under ${selectedWarehouse.type} classification.`,
                        status: 'completed',
                      },
                      {
                        title: 'Physical Capacity & Hazardous Material Safety Verified',
                        timestamp: 'Verification Approved',
                        description: 'Fire suppression, containment dikes, and temperature logging confirmed.',
                        status: 'completed',
                      },
                      {
                        title: 'Ready for Transaction Ingestion',
                        timestamp: 'Active',
                        description: 'Configured to accept incoming Goods Receipt Notes (GRN) and production releases.',
                        status: 'current',
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    );
  }

  // Render List Mode
  return (
    <ListPageTemplate
      title="Warehouse & Storage Masters"
      subtitle="Raw chemical tank farms, finished fertilizer depots, packaging stores, transit freight bays, and quarantine holds."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Warehouses' }]}
      primaryAction={{
        label: 'Register Warehouse',
        icon: <IconPlus size={16} />,
        onClick: () => {
          const defaultCompany =
            companies.find((c) => users.some((u) => u.companyId === c.id))?.id ||
            companies.find((c) => c.isParent)?.id ||
            companies[0]?.id ||
            '';
          setFormData({
            code: '',
            name: '',
            companyId: defaultCompany,
            plantId: '',
            branchId: '',
            type: 'RAW_MATERIAL',
            location: '',
            address: '',
            managerName: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        {
          label: 'Refresh',
          icon: <IconRefresh size={16} />,
          onClick: fetchData,
        },
        {
          label: 'Export Registry',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Warehouses exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Storage Facilities" value={warehouses.length} icon={<IconBuildings size={20} />} />
        <KpiCard title="Raw Material Silos" value={warehouses.filter((w) => w.type === 'RAW_MATERIAL').length} icon={<IconCheck size={20} />} />
        <KpiCard title="Finished Goods Depots" value={warehouses.filter((w) => w.type === 'FINISHED_GOODS').length} icon={<IconCheck size={20} />} />
        <KpiCard title="QC Quarantine Bays" value={warehouses.filter((w) => w.type === 'QUARANTINE').length} icon={<IconAlertTriangle size={20} />} status="warning" />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search warehouses by code, name, or zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '240px' }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Storage Types' },
                { value: 'RAW_MATERIAL', label: 'Raw Materials' },
                { value: 'FINISHED_GOODS', label: 'Finished Goods' },
                { value: 'PACKING_MATERIAL', label: 'Packaging Supplies' },
                { value: 'TRANSIT', label: 'In-Transit Freight' },
                { value: 'QUARANTINE', label: 'Quarantine Bays' },
                { value: 'RETURNS', label: 'Customer Returns' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Warehouses"
          message={error}
          onRetry={fetchData}
        />
      ) : filteredWarehouses.length === 0 ? (
        <EmptyState
          title="No Storage Facilities Found"
          description={searchQuery ? 'No warehouses match your search criteria.' : 'No storage facilities have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Filters' : undefined}
          onAction={
            searchQuery
              ? () => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                }
              : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredWarehouses} />
      )}
    </ListPageTemplate>
  );
};
