'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PlantDto, CompanyDto } from '@shehswar/types';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  KpiCard,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconDownload,
  IconEye,
  IconEdit,
  IconProduction,
  IconCheck,
  IconBuildings,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const PlantsView: React.FC = () => {
  const { showToast } = useToast();
  const [plants, setPlants] = useState<PlantDto[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<PlantDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [plantsRes, compsRes, usersRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/plants?all=true'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/users?all=true'),
      ]);
      const plantItems = Array.isArray(plantsRes) ? plantsRes : (plantsRes as any)?.items || (plantsRes as any)?.data?.items || (plantsRes as any)?.data || [];
      const compItems = Array.isArray(compsRes) ? compsRes : (compsRes as any)?.items || (compsRes as any)?.data?.items || (compsRes as any)?.data || [];
      const userItems = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.items || (usersRes as any)?.data?.items || (usersRes as any)?.data || [];
      setPlants(plantItems);
      setCompanies(compItems);
      setUsers(userItems);
    } catch (err: any) {
      console.error('Error fetching plants/companies:', err);
      setError(err?.message || 'Failed to fetch plants data from backend');
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
    location: '',
    address: '',
    managerName: '',
    isActive: true,
  });

  const filteredPlants = plants.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompany = companyFilter === 'ALL' || p.companyId === companyFilter;
    return matchesSearch && matchesCompany;
  });

  const columns: ColumnDef<PlantDto>[] = [
    {
      id: 'code',
      header: 'Plant Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Plant Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.original.location}</div>
        </div>
      ),
    },
    {
      id: 'company',
      header: 'Operating Company',
      cell: ({ row }) => {
        const comp = companies.find((c: any) => c.id === row.original.companyId);
        return <span>{comp ? comp.name : 'Primary Chemical Entity'}</span>;
      },
    },
    {
      id: 'manager',
      header: 'Plant General Manager',
      accessorKey: 'managerName',
      cell: ({ row }) => <span>{row.original.managerName || 'Operations Head'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            size="sm"
            variant="ghost"
            icon={<IconEye size={14} />}
            onClick={() => {
              setSelectedPlant(row.original);
              setMode('detail');
            }}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedPlant(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                companyId: row.original.companyId,
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
      showToast({ title: 'Validation Error', message: 'Plant code and name are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          companyId: formData.companyId || companies[0]?.id,
          location: formData.location,
          address: formData.address,
          managerName: formData.managerName,
        };
        await ApiClient.post('/api/v1/master-data/plants', payload);
        showToast({ title: 'Success', message: `Plant ${formData.name} registered`, type: 'success' });
        await fetchData();
      } else if (mode === 'edit' && selectedPlant) {
        const payload = {
          name: formData.name,
          companyId: formData.companyId,
          location: formData.location,
          address: formData.address,
          managerName: formData.managerName,
          isActive: formData.isActive,
        };
        await ApiClient.patch(`/api/v1/master-data/plants/${selectedPlant.id}`, payload);
        showToast({ title: 'Updated', message: 'Plant parameters updated', type: 'success' });
        await fetchData();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save plant', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Manufacturing Plant' : `Edit ${selectedPlant?.name}`}
        subtitle="Configure physical production facility, synthesis reactors, and site leadership."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Plants', href: '#' },
          { label: mode === 'create' ? 'Register' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Register Plant' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Plant Facility Identification</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Plant Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. PLANT-KSK"
                disabled={mode === 'edit'}
              />
              <Input
                label="Plant Facility Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Kala Shah Kaku Chemical Complex"
              />
              <Select
                label="Operating Company *"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location & Operations Leadership</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Geographical Industrial Zone"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Punjab Central Industrial Corridor"
              />
              <div>
                <Select
                  label="Plant General Manager / Operations Head"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  options={[
                    { value: '', label: 'Unassigned / None' },
                    ...users
                      .map((u) => {
                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                        const roleName = u.userRoles?.[0]?.role?.name || 'Operations Lead';
                        const comp = companies.find((c) => c.id === u.companyId);
                        const isMatch = !formData.companyId || !u.companyId || u.companyId === formData.companyId;
                        return {
                          value: fullName,
                          label: `${fullName} (${roleName})`,
                          subtext: [u.email, comp ? comp.name : null].filter(Boolean).join(' • '),
                          badge: isMatch ? (roleName.includes('Plant') ? 'Plant Lead' : 'Selected Co.') : (comp?.name ? comp.name.replace('Shehswar ', '') : 'Group Entity'),
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
                          {assignedUser.email} • Role: {assignedUser.userRoles?.[0]?.role?.name || 'Operations Lead'}
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
              <CardTitle>Physical Site Address</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                label="Factory & Site Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                placeholder="Kilometer marker, highway, industrial estate, district"
              />
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedPlant) {
    const parentCompany = companies.find((c: any) => c.id === selectedPlant.companyId);
    const plantWarehouses: any[] = [];

    return (
      <DetailPageTemplate
        title={selectedPlant.name}
        subtitle={`Operating Company: ${parentCompany?.name || 'Shehswar Chemicals Ltd'} • Code: ${selectedPlant.code}`}
        status={selectedPlant.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Plants', href: '#' },
          { label: selectedPlant.code },
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
                  code: selectedPlant.code,
                  name: selectedPlant.name,
                  companyId: selectedPlant.companyId,
                  location: selectedPlant.location || '',
                  address: selectedPlant.address || '',
                  managerName: selectedPlant.managerName || '',
                  isActive: selectedPlant.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Plant
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Plant Overview',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Plant Facility Parameters</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Plant Code:</span>
                      <span style={{ fontWeight: 600 }}>{selectedPlant.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Parent Company:</span>
                      <span style={{ fontWeight: 500 }}>{parentCompany?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Industrial Zone:</span>
                      <span style={{ fontWeight: 500 }}>{selectedPlant.location}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operations Head:</span>
                      <span style={{ fontWeight: 600 }}>{selectedPlant.managerName || 'Plant GM'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Site Physical Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span style={{ lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {selectedPlant.address || 'Kala Shah Kaku Chemical Industrial Area, GT Road, Punjab, Pakistan'}
                    </span>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'warehouses',
            label: `On-Site Warehouses (${plantWarehouses.length})`,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Storage Bays & Tank Farms at this Plant</CardTitle>
                </CardHeader>
                <CardContent>
                  {plantWarehouses.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                      {plantWarehouses.map((wh) => (
                        <div
                          key={wh.id}
                          style={{
                            padding: '1rem',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-card-subtle)',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wh.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                            Code: {wh.code} • Type: {wh.type}
                          </div>
                          <div style={{ fontSize: '0.85rem' }}>Manager: {wh.managerName}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>No dedicated warehouses linked to this plant.</div>
                  )}
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
      title="Manufacturing Plants"
      subtitle="Heavy chemical synthesis complexes, blending units, and formulation plants."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Plants' }]}
      primaryAction={{
        label: 'Register Plant',
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
          label: 'Export Plant Registry',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Plants exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Active Plants" value={plants.length} icon={<IconProduction size={20} />} />
        <KpiCard title="Industrial Complexes" value={`${plants.length} Operational Units`} icon={<IconBuildings size={20} />} subtitle="Synthetics & Blending" />
        <KpiCard title="Affiliated Companies" value={companies.length} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search plants by code, name, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '240px' }}>
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Companies' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Plants"
          message={error}
          onRetry={fetchData}
        />
      ) : filteredPlants.length === 0 ? (
        <EmptyState
          title="No Manufacturing Plants Found"
          description={searchQuery ? 'No plants match your search criteria.' : 'No plants have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Filters' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setCompanyFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filteredPlants} />
      )}
    </ListPageTemplate>
  );
};
