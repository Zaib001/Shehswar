'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DepartmentDto, CompanyDto } from '@shehswar/types';
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

export const DepartmentsView: React.FC = () => {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [deptRes, compRes, usersRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/departments?all=true'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/users?all=true'),
      ]);
      const deptItems = Array.isArray(deptRes) ? deptRes : (deptRes as any)?.items || (deptRes as any)?.data?.items || (deptRes as any)?.data || [];
      const compItems = Array.isArray(compRes) ? compRes : (compRes as any)?.items || (compRes as any)?.data?.items || (compRes as any)?.data || [];
      const userItems = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.items || (usersRes as any)?.data?.items || (usersRes as any)?.data || [];
      setDepartments(deptItems);
      setCompanies(compItems);
      setUsers(userItems);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
      setError(err?.message || 'Failed to fetch departments from backend');
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
    managerName: '',
    isActive: true,
  });

  const filteredDepts = departments.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.managerName && d.managerName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompany = companyFilter === 'ALL' || d.companyId === companyFilter;
    return matchesSearch && matchesCompany;
  });

  const columns: ColumnDef<DepartmentDto>[] = [
    {
      id: 'code',
      header: 'Department Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Department Functional Name',
      accessorKey: 'name',
      cell: ({ row }) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</span>,
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
      header: 'Department Head / Manager',
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
              setSelectedDept(row.original);
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
              setSelectedDept(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                companyId: row.original.companyId,
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
      showToast({ title: 'Validation Error', message: 'Department code and name are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          companyId: formData.companyId || companies[0]?.id,
          managerName: formData.managerName,
        };
        await ApiClient.post('/api/v1/master-data/departments', payload);
        showToast({ title: 'Success', message: `Department ${formData.name} registered`, type: 'success' });
        await fetchData();
      } else if (mode === 'edit' && selectedDept) {
        const payload = {
          name: formData.name,
          companyId: formData.companyId,
          managerName: formData.managerName,
          isActive: formData.isActive,
        };
        await ApiClient.patch(`/api/v1/master-data/departments/${selectedDept.id}`, payload);
        showToast({ title: 'Updated', message: 'Department updated', type: 'success' });
        await fetchData();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save department', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Create Department Master' : `Edit ${selectedDept?.name}`}
        subtitle="Define operational divisions, cost centers, and departmental leadership."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Departments', href: '#' },
          { label: mode === 'create' ? 'Create' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Create Department' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Department Master Details</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Department Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. DEPT-PROD"
                disabled={mode === 'edit'}
              />
              <Input
                label="Department Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Chemical Production & Synthesis"
              />
              <Select
                label="Operating Company *"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
              <div>
                <Select
                  label="Department Head / Manager"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  options={[
                    { value: '', label: 'Unassigned / None' },
                    ...users
                      .map((u) => {
                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                        const roleName = u.userRoles?.[0]?.role?.name || 'Staff';
                        const comp = companies.find((c) => c.id === u.companyId);
                        const isMatch = !formData.companyId || !u.companyId || u.companyId === formData.companyId;
                        return {
                          value: fullName,
                          label: `${fullName} (${roleName})`,
                          subtext: [u.email, comp ? comp.name : null].filter(Boolean).join(' • '),
                          badge: isMatch ? (roleName.includes('Head') || roleName.includes('Manager') ? 'Lead' : 'Selected Co.') : (comp?.name ? comp.name.replace('Shehswar ', '') : 'Group Entity'),
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
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedDept) {
    const parentCompany = companies.find((c: any) => c.id === selectedDept.companyId);
    const staffMembers: any[] = [];

    return (
      <DetailPageTemplate
        title={selectedDept.name}
        subtitle={`Operating Company: ${parentCompany?.name || 'Shehswar Chemicals Ltd'} • Code: ${selectedDept.code}`}
        status={selectedDept.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Departments', href: '#' },
          { label: selectedDept.code },
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
                  code: selectedDept.code,
                  name: selectedDept.name,
                  companyId: selectedDept.companyId,
                  managerName: selectedDept.managerName || '',
                  isActive: selectedDept.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Department
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Department Overview',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Departmental Attributes</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Department Code:</span>
                      <span style={{ fontWeight: 600 }}>{selectedDept.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating Company:</span>
                      <span style={{ fontWeight: 500 }}>{parentCompany?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Department Head:</span>
                      <span style={{ fontWeight: 600 }}>{selectedDept.managerName || 'Unassigned'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Staff in this Department ({staffMembers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staffMembers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {staffMembers.map((emp: any) => (
                          <div
                            key={emp.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              borderBottom: '1px solid var(--border-subtle)',
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emp.position}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>No personnel mapped to this department yet.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ),
          },
        ]}
      />
    );
  }

  // Render List Mode
  return (
    <ListPageTemplate
      title="Configurable Departments"
      subtitle="Corporate divisions across Production, QC, Procurement, Finance, Sales, and Logistics."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Departments' }]}
      primaryAction={{
        label: 'Create Department',
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
          onClick: () => showToast({ title: 'Export Generated', message: 'Departments exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Departments" value={departments.length} icon={<IconBuildings size={20} />} />
        <KpiCard title="Active Divisions" value={`${departments.filter((d) => d.isActive).length} Operational`} icon={<IconCheck size={20} />} status="positive" />
        <KpiCard title="Affiliated Companies" value={companies.length} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search departments by code, name, or manager..."
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
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Departments"
          message={error}
          onRetry={fetchData}
        />
      ) : filteredDepts.length === 0 ? (
        <EmptyState
          title="No Departments Found"
          description={searchQuery ? 'No departments match your search criteria.' : 'No departments have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Filters' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setCompanyFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filteredDepts} />
      )}
    </ListPageTemplate>
  );
};
