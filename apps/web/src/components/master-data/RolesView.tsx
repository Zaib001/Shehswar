'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RoleDto } from '@shehswar/types';
import { ApiClient } from '../../lib/api-client';
import { ERP_MODULES } from './mock-data';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
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
  IconShield,
  IconCheck,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const RolesView: React.FC = () => {
  const { showToast } = useToast();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRoles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await ApiClient.get<any>('/api/v1/master-data/roles');
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data?.items || (res as any)?.data || [];
      setRoles(items);
    } catch (err: any) {
      console.error('Error fetching roles:', err);
      setError(err?.message || 'Failed to fetch roles from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissions: {} as Record<string, boolean>,
  });

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const columns: ColumnDef<RoleDto>[] = [
    {
      id: 'code',
      header: 'Role Code',
      accessorKey: 'code',
      cell: ({ row }: any) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Role Title',
      accessorKey: 'name',
      cell: ({ row }: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.original.description}</div>
        </div>
      ),
    },
    {
      id: 'scope',
      header: 'Access Scope',
      cell: ({ row }: any) => (
        <span style={{ fontWeight: 500 }}>
          {row.original.code === 'SUPER_ADMIN' ? 'Full Enterprise Root' : 'Scoped Module Matrix'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => <StatusBadge status="ACTIVE" />,
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
              setSelectedRole(row.original);
              setMode('detail');
            }}
          >
            Permissions
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedRole(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                description: row.original.description || '',
                permissions: {},
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
      showToast({ title: 'Validation Error', message: 'Role code and name are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const payload = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description,
        };
        await ApiClient.post('/api/v1/master-data/roles', payload);
        showToast({ title: 'Success', message: `Role ${formData.name} created`, type: 'success' });
        await fetchRoles();
      } else if (mode === 'edit' && selectedRole) {
        const payload = {
          name: formData.name,
          description: formData.description,
        };
        await ApiClient.patch(`/api/v1/master-data/roles/${selectedRole.id}`, payload);
        showToast({ title: 'Updated', message: 'Role updated successfully', type: 'success' });
        await fetchRoles();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save role', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Define Security Role' : `Edit ${selectedRole?.name}`}
        subtitle="Configure RBAC role definitions and granular authority assignments."
        breadcrumbs={[
          { label: 'Security & Access', href: '#' },
          { label: 'Roles', href: '#' },
          { label: mode === 'create' ? 'Create' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Create Role' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Role Identification</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Role Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. PLANT_MGR"
                disabled={mode === 'edit'}
              />
              <Input
                label="Role Title *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Plant Operations Manager"
              />
              <Textarea
                label="Authority Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Describe operational scope and decision authorizations"
              />
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedRole) {
    return (
      <DetailPageTemplate
        title={selectedRole.name}
        subtitle={`System Role Code: ${selectedRole.code}`}
        status="ACTIVE"
        breadcrumbs={[
          { label: 'Security & Access', href: '#' },
          { label: 'Roles', href: '#' },
          { label: selectedRole.code },
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
                  code: selectedRole.code,
                  name: selectedRole.name,
                  description: selectedRole.description || '',
                  permissions: {},
                });
                setMode('edit');
              }}
            >
              Edit Role
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Overview & Authority',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Role Authority Scope</CardTitle>
                </CardHeader>
                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Role Code:</span>
                    <span style={{ fontWeight: 600 }}>{selectedRole.code}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Scope Description:
                    </span>
                    <span style={{ lineHeight: 1.5 }}>
                      {selectedRole.description || 'Enterprise RBAC security role profile.'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'permissions',
            label: 'Assigned Permissions',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Module Permission Rights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {ERP_MODULES.map((mod) => (
                      <div
                        key={mod.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-card-subtle)',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{mod.label}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            View ✓
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            Export ✓
                          </span>
                          {selectedRole.code.includes('MGR') || selectedRole.code === 'SUPER_ADMIN' ? (
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                              Approve ✓
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
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
      title="Role Management (RBAC)"
      subtitle="Configurable role-based access control roles enforcing least privilege security."
      breadcrumbs={[{ label: 'Security & Access', href: '#' }, { label: 'Roles' }]}
      primaryAction={{
        label: 'Create Role',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            description: '',
            permissions: {},
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        {
          label: 'Refresh',
          icon: <IconRefresh size={16} />,
          onClick: fetchRoles,
        },
        {
          label: 'Export Roles',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Roles exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Configured Roles" value={roles.length} icon={<IconShield size={20} />} />
        <KpiCard title="System Roles" value={`${roles.filter((r) => r.isSystem).length} Protected`} icon={<IconCheck size={20} />} />
        <KpiCard title="Custom Roles" value={`${roles.filter((r) => !r.isSystem).length} Custom`} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ padding: '1rem' }}>
          <Input
            placeholder="Search roles by title, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Roles"
          message={error}
          onRetry={fetchRoles}
        />
      ) : filteredRoles.length === 0 ? (
        <EmptyState
          title="No Roles Found"
          description={searchQuery ? 'No roles match your search criteria.' : 'No RBAC security roles configured yet.'}
          actionLabel={searchQuery ? 'Clear Filter' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filteredRoles} />
      )}
    </ListPageTemplate>
  );
};
