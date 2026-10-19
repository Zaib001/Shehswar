'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { OrganizationDto } from '@shehswar/types';
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
  IconBuildings,
  IconCheck,
  IconClock,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const OrganizationsView: React.FC = () => {
  const { showToast } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await ApiClient.get<any>('/api/v1/master-data/organizations');
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data?.items || (res as any)?.data || [];
      setOrganizations(items);
    } catch (err: any) {
      console.error('Error fetching organizations:', err);
      setError(err?.message || 'Failed to connect to backend organizations service');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    legalName: '',
    taxId: '',
    strnId: '',
    industry: '',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    email: '',
    phone: '',
    address: '',
    isActive: true,
  });

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.legalName && org.legalName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (org.taxId && org.taxId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && org.isActive) ||
      (statusFilter === 'INACTIVE' && !org.isActive);
    return matchesSearch && matchesStatus;
  });

  const columns: ColumnDef<OrganizationDto>[] = [
    {
      id: 'code',
      header: 'Org Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Organization Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {row.original.legalName || ''}
            {row.original.taxId ? ` • NTN: ${row.original.taxId}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'industry',
      header: 'Industry',
      accessorKey: 'industry',
      cell: ({ row }) => <span>{row.original.industry || 'Multi-Industry'}</span>,
    },
    {
      id: 'country',
      header: 'Country / Currency',
      cell: ({ row }) => (
        <span>
          {row.original.country} ({row.original.currency})
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
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
              setSelectedOrg(row.original);
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
              setSelectedOrg(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                legalName: row.original.legalName || '',
                taxId: row.original.taxId || '',
                strnId: (row.original as any).strnId || '',
                industry: row.original.industry || '',
                country: row.original.country,
                currency: row.original.currency,
                timezone: row.original.timezone,
                email: row.original.email || '',
                phone: row.original.phone || '',
                address: row.original.address || '',
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
      showToast({ title: 'Validation Error', message: 'Name and Code are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const payload: any = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          legalName: formData.legalName,
          taxId: formData.taxId?.trim() || null,
          strnId: formData.strnId?.trim() || null,
          industry: formData.industry,
          country: formData.country,
          currency: formData.currency,
          timezone: formData.timezone,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        };
        await ApiClient.post('/api/v1/master-data/organizations', payload);
        showToast({ title: 'Success', message: `Organization ${formData.name} registered`, type: 'success' });
        await fetchOrganizations();
      } else if (mode === 'edit' && selectedOrg) {
        const payload: any = {
          name: formData.name,
          legalName: formData.legalName,
          taxId: formData.taxId?.trim() || null,
          strnId: formData.strnId?.trim() || null,
          industry: formData.industry,
          country: formData.country,
          currency: formData.currency,
          timezone: formData.timezone,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          isActive: formData.isActive,
        };
        await ApiClient.patch(`/api/v1/master-data/organizations/${selectedOrg.id}`, payload);
        showToast({ title: 'Updated', message: `Organization details updated`, type: 'success' });
        await fetchOrganizations();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save organization', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Create New Organization' : `Edit ${selectedOrg?.name}`}
        subtitle="Manage root enterprise entity parameters, statutory registration, and regional settings."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Organizations', href: '#' },
          { label: mode === 'create' ? 'Create' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Create Organization' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Basic Entity Information</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Organization Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. SHEHSWAR-GRP"
                disabled={mode === 'edit'}
              />
              <Input
                label="Organization Brand Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Shehswar Group"
              />
              <Input
                label="Full Statutory Legal Name"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="e.g. Shehswar Industrial Holdings (Pvt) Ltd"
              />
              <Input
                label="Tax Identification / NTN (National Tax Number)"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="e.g. 1234567-8"
              />
              <Input
                label="Sales Tax Registration Number (STRN)"
                value={formData.strnId}
                onChange={(e) => setFormData({ ...formData, strnId: e.target.value })}
                placeholder="e.g. 17-00-1234-567-89"
              />
              <Input
                label="Industry Classification"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="e.g. Chemical Manufacturing & Agro-Tech"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional & Currency Settings</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Select
                label="Domicile Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                options={[
                  { value: 'Pakistan', label: 'Pakistan' },
                  { value: 'UAE', label: 'United Arab Emirates' },
                  { value: 'Saudi Arabia', label: 'Kingdom of Saudi Arabia' },
                ]}
              />
              <Select
                label="Base Operating Currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                options={[
                  { value: 'PKR', label: 'PKR - Pakistani Rupee' },
                  { value: 'USD', label: 'USD - US Dollar' },
                  { value: 'AED', label: 'AED - UAE Dirham' },
                ]}
              />
              <Select
                label="Primary Timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                options={[
                  { value: 'Asia/Karachi', label: 'Asia/Karachi (GMT+5)' },
                  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
                ]}
              />
            </CardContent>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader>
              <CardTitle>Corporate Headquarters Contact & Address</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input
                label="Corporate Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="corporate@shehswar.com"
              />
              <Input
                label="Corporate Telephone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 42 3578-9000"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea
                  label="Registered Head Office Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  placeholder="Street address, building, city, postal code"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedOrg) {
    return (
      <DetailPageTemplate
        title={selectedOrg.name}
        subtitle={`Legal Entity: ${selectedOrg.legalName || selectedOrg.name} • Code: ${selectedOrg.code}`}
        status={selectedOrg.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Organizations', href: '#' },
          { label: selectedOrg.code },
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
                  code: selectedOrg.code,
                  name: selectedOrg.name,
                  legalName: selectedOrg.legalName || '',
                  taxId: selectedOrg.taxId || '',
                  strnId: (selectedOrg as any).strnId || '',
                  industry: selectedOrg.industry || '',
                  country: selectedOrg.country,
                  currency: selectedOrg.currency,
                  timezone: selectedOrg.timezone,
                  email: selectedOrg.email || '',
                  phone: selectedOrg.phone || '',
                  address: selectedOrg.address || '',
                  isActive: selectedOrg.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Entity
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Overview & Registration',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Statutory Attributes</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Organization Code:</span>
                      <span style={{ fontWeight: 600 }}>{selectedOrg.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tax ID / NTN:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{selectedOrg.taxId || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sales Tax (STRN):</span>
                      <span style={{ fontWeight: 500 }}>{(selectedOrg as any).strnId || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Industry:</span>
                      <span style={{ fontWeight: 500 }}>{selectedOrg.industry}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Domicile Country:</span>
                      <span style={{ fontWeight: 500 }}>{selectedOrg.country}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Functional Currency:</span>
                      <span style={{ fontWeight: 600 }}>{selectedOrg.currency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Standard Timezone:</span>
                      <span style={{ fontWeight: 500 }}>{selectedOrg.timezone}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Registered Address & Contacts</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Corporate Email:</span>
                      <span style={{ fontWeight: 500 }}>{selectedOrg.email || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Telephone:</span>
                      <span style={{ fontWeight: 500 }}>{selectedOrg.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Headquarters Address:
                      </span>
                      <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{selectedOrg.address || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'timeline',
            label: 'Audit Trail',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Entity Lifecycle & Modifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={[
                      {
                        title: 'Entity Bootstrapped',
                        timestamp: selectedOrg.createdAt ? new Date(selectedOrg.createdAt).toLocaleDateString() : 'Initial Creation',
                        description: `Root tenant organization established with ISO code ${selectedOrg.code}.`,
                        status: 'completed',
                      },
                      {
                        title: 'Statutory Verification',
                        timestamp: 'Compliance Cleared',
                        description: 'Corporate NTN and regulatory certificates verified for multi-company operations.',
                        status: 'completed',
                      },
                      {
                        title: 'Current Active State',
                        timestamp: 'Now',
                        description: 'Serving as parent holding for 3 manufacturing, agro-tech, and freight entities.',
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
      title="Enterprise Organizations"
      subtitle="Top-level multi-company governance hierarchy and holding entities."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Organizations' }]}
      primaryAction={{
        label: 'Create Organization',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            code: '',
            name: '',
            legalName: '',
            taxId: '',
            strnId: '',
            industry: '',
            country: 'Pakistan',
            currency: 'PKR',
            timezone: 'Asia/Karachi',
            email: '',
            phone: '',
            address: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        {
          label: 'Refresh',
          icon: <IconRefresh size={16} />,
          onClick: fetchOrganizations,
        },
        {
          label: 'Export Records',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Organizations exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Organizations" value={organizations.length} icon={<IconBuildings size={20} />} trend={{ value: 0, isPositive: true }} />
        <KpiCard title="Active Holdings" value={organizations.filter((o) => o.isActive).length} icon={<IconCheck size={20} />} status="positive" />
        <KpiCard title="Primary Currency" value="PKR" icon={<IconClock size={20} />} subtitle="Asia/Karachi standard" />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search by code, brand or legal name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '180px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active Only' },
                { value: 'INACTIVE', label: 'Inactive Only' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Organizations"
          message={error}
          onRetry={fetchOrganizations}
        />
      ) : filteredOrgs.length === 0 ? (
        <EmptyState
          title="No Organizations Found"
          description={searchQuery ? 'No organizations match your search criteria.' : 'No organizations have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Filters' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setStatusFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filteredOrgs} />
      )}
    </ListPageTemplate>
  );
};
