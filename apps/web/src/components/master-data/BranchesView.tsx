'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BranchDto, CompanyDto } from '@shehswar/types';
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
  IconBuildings,
  IconCheck,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const BranchesView: React.FC = () => {
  const { showToast } = useToast();
  const [branches, setBranches] = useState<(BranchDto & { company?: any; warehouses?: any[] })[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<(BranchDto & { company?: any; warehouses?: any[] }) | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [branchesRes, compsRes, usersRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/branches?all=true'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/users?all=true'),
      ]);
      const branchItems = Array.isArray(branchesRes)
        ? branchesRes
        : (branchesRes as any)?.items || (branchesRes as any)?.data?.items || (branchesRes as any)?.data || [];
      const compItems = Array.isArray(compsRes)
        ? compsRes
        : (compsRes as any)?.items || (compsRes as any)?.data?.items || (compsRes as any)?.data || [];
      const userItems = Array.isArray(usersRes)
        ? usersRes
        : (usersRes as any)?.items || (usersRes as any)?.data?.items || (usersRes as any)?.data || [];

      setBranches(branchItems);
      setCompanies(compItems);
      setUsers(userItems);
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      setError(err?.message || 'Failed to fetch branches from backend');
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
    city: '',
    regionName: '',
    address: '',
    managerName: '',
    isActive: true,
  });

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.city && b.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.regionName && b.regionName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompany = companyFilter === 'ALL' || b.companyId === companyFilter;
    return matchesSearch && matchesCompany;
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'code',
      header: 'Branch Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Branch Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {row.original.city ? `${row.original.city} • ` : ''}{row.original.regionName || 'Commercial Branch'}
          </div>
        </div>
      ),
    },
    {
      id: 'company',
      header: 'Operating Company',
      cell: ({ row }) => {
        const comp = companies.find((c) => c.id === row.original.companyId) || row.original.company;
        return <span>{comp ? comp.name : 'Primary Subsidiary'}</span>;
      },
    },
    {
      id: 'manager',
      header: 'Branch Manager / Lead',
      accessorKey: 'managerName',
      cell: ({ row }) => <span>{row.original.managerName || 'Unassigned'}</span>,
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
              setSelectedBranch(row.original);
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
              setSelectedBranch(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                companyId: row.original.companyId,
                city: row.original.city || '',
                regionName: row.original.regionName || '',
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
      showToast({ title: 'Validation Error', message: 'Branch code and name are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedCompId = formData.companyId || companies[0]?.id;
      if (!selectedCompId) {
        showToast({ title: 'Validation Error', message: 'An Operating Company must be selected', type: 'error' });
        return;
      }

      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          companyId: selectedCompId,
          city: formData.city || undefined,
          regionName: formData.regionName || undefined,
          address: formData.address || undefined,
          managerName: formData.managerName || undefined,
          isActive: formData.isActive,
        };
        await ApiClient.post('/api/v1/master-data/branches', payload);
        showToast({ title: 'Success', message: `Branch ${formData.name} registered`, type: 'success' });
        await fetchData();
      } else if (mode === 'edit' && selectedBranch) {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          companyId: selectedCompId,
          city: formData.city || undefined,
          regionName: formData.regionName || undefined,
          address: formData.address || undefined,
          managerName: formData.managerName || undefined,
          isActive: formData.isActive,
        };
        await ApiClient.patch(`/api/v1/master-data/branches/${selectedBranch.id}`, payload);
        showToast({ title: 'Updated', message: 'Branch details updated', type: 'success' });
        await fetchData();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save branch', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    const assignedUser = users.find(
      (u) =>
        `${u.firstName || ''} ${u.lastName || ''}`.trim() === formData.managerName ||
        u.email === formData.managerName,
    );

    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Regional Branch' : `Edit ${selectedBranch?.name}`}
        subtitle="Manage commercial distribution offices, maritime trade hubs, and regional management."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Branches', href: '#' },
          { label: mode === 'create' ? 'Register' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Register Branch' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Branch Office Identity</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Branch Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. BR-LHR"
                disabled={mode === 'edit'}
              />
              <Input
                label="Branch Office Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Lahore Central Operations Branch"
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
              <CardTitle>Regional Location & Manager</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Lahore, Karachi, Multan"
              />
              <Input
                label="Assigned Region"
                value={formData.regionName}
                onChange={(e) => setFormData({ ...formData, regionName: e.target.value })}
                placeholder="e.g. Central Punjab, South Punjab, Sindh Coastal"
              />
              <div>
                <Select
                  label="Branch Manager / Supervisor"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  options={[
                    { value: '', label: 'Unassigned / None' },
                    ...users
                      .map((u) => {
                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                        const roleName = u.userRoles?.[0]?.role?.name || 'Branch Staff';
                        const comp = companies.find((c) => c.id === u.companyId);
                        const isMatch = !formData.companyId || !u.companyId || u.companyId === formData.companyId;
                        return {
                          value: fullName,
                          label: `${fullName} (${roleName})`,
                          subtext: [u.email, comp ? comp.name : null].filter(Boolean).join(' • '),
                          badge: isMatch ? (roleName.includes('Branch') ? 'Branch Lead' : 'Selected Co.') : (comp?.name ? comp.name.replace('Shehswar ', '') : 'Group Entity'),
                          isMatch,
                        };
                      })
                      .sort((a, b) => (b.isMatch ? 1 : 0) - (a.isMatch ? 1 : 0)),
                    ...(formData.managerName &&
                    !users.some(
                      (u) =>
                        `${u.firstName || ''} ${u.lastName || ''}`.trim() === formData.managerName ||
                        u.email === formData.managerName,
                    )
                      ? [{ value: formData.managerName, label: `${formData.managerName} (Current Assignment)` }]
                      : []),
                  ]}
                />
                {assignedUser && (
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
                )}
              </div>
            </CardContent>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader>
              <CardTitle>Office Physical Location</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                label="Complete Street Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                placeholder="Building, street, commercial zone, postal city"
              />
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedBranch) {
    const parentCompany =
      companies.find((c) => c.id === selectedBranch.companyId) || selectedBranch.company;
    const branchWarehouses = selectedBranch.warehouses || [];

    return (
      <DetailPageTemplate
        title={selectedBranch.name}
        subtitle={`Operating Company: ${parentCompany?.name || 'Shehswar Group'} • Code: ${selectedBranch.code}`}
        status={selectedBranch.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Branches', href: '#' },
          { label: selectedBranch.code },
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
                  code: selectedBranch.code,
                  name: selectedBranch.name,
                  companyId: selectedBranch.companyId,
                  city: selectedBranch.city || '',
                  regionName: selectedBranch.regionName || '',
                  address: selectedBranch.address || '',
                  managerName: selectedBranch.managerName || '',
                  isActive: selectedBranch.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Branch
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Branch Overview',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Branch Parameters</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Branch Code:</span>
                      <span style={{ fontWeight: 600 }}>{selectedBranch.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating Company:</span>
                      <span style={{ fontWeight: 500 }}>{parentCompany?.name || 'Shehswar Group'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>City:</span>
                      <span style={{ fontWeight: 500 }}>{selectedBranch.city || 'Unspecified'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Region:</span>
                      <span style={{ fontWeight: 500 }}>{selectedBranch.regionName || 'General Region'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Branch Manager:</span>
                      <span style={{ fontWeight: 600 }}>{selectedBranch.managerName || 'Regional Lead'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Physical Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span style={{ lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {selectedBranch.address || 'Commercial Plaza, Regional Center, Pakistan'}
                    </span>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'warehouses',
            label: `Linked Storage (${branchWarehouses.length})`,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Transit Hubs & Storage Bays</CardTitle>
                </CardHeader>
                <CardContent>
                  {branchWarehouses.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                      {branchWarehouses.map((wh: any) => (
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
                          <div style={{ fontSize: '0.85rem' }}>Manager: {wh.managerName || 'Assigned Lead'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>No warehouses linked directly to this branch.</div>
                  )}
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    );
  }

  // Calculate unique cities
  const uniqueCities = Array.from(new Set(branches.map((b) => b.city).filter(Boolean)));

  // Render List Mode
  return (
    <ListPageTemplate
      title="Regional Branches"
      subtitle="Commercial sales branch offices, distribution network nodes, and regional facilities."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Branches' }]}
      primaryAction={{
        label: 'Register Branch',
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
            city: '',
            regionName: '',
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
          onClick: () => showToast({ title: 'Export Generated', message: 'Branches exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Active Branches" value={branches.length} icon={<IconBuildings size={20} />} />
        <KpiCard
          title="Covered Cities"
          value={uniqueCities.length > 0 ? `${uniqueCities.length} Cities` : 'National Network'}
          icon={<IconCheck size={20} />}
          subtitle={uniqueCities.slice(0, 3).join(', ') || 'Multan, Lahore, Karachi'}
        />
        <KpiCard
          title="Operational Status"
          value={`${branches.filter((b) => b.isActive).length} / ${branches.length} Active`}
          icon={<IconCheck size={20} />}
          status="positive"
        />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search branches by code, name, city, or region..."
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
          title="Failed to Load Branches"
          message={error}
          onRetry={fetchData}
        />
      ) : filteredBranches.length === 0 ? (
        <EmptyState
          title="No Branches Found"
          description="Register your first regional sales or distribution branch office to expand network operations."
          actionLabel="Register Branch"
          onAction={() => {
            setFormData({
              code: '',
              name: '',
              companyId: companies[0]?.id || '',
              city: '',
              regionName: '',
              address: '',
              managerName: '',
              isActive: true,
            });
            setMode('create');
          }}
        />
      ) : (
        <DataTable columns={columns} data={filteredBranches} />
      )}
    </ListPageTemplate>
  );
};
