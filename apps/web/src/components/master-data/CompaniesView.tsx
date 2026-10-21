'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CompanyDto } from '@shehswar/types';
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
  Modal,
} from '../ui';
import {
  IconPlus,
  IconDownload,
  IconEye,
  IconEdit,
  IconBuildings,
  IconCheck,
  IconProduction,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const CompaniesView: React.FC = () => {
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDto | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const fetchCompanies = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [compRes, plantRes, branchRes, whRes, empRes, userRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies?all=true'),
        ApiClient.get<any>('/api/v1/master-data/plants'),
        ApiClient.get<any>('/api/v1/master-data/branches'),
        ApiClient.get<any>('/api/v1/master-data/warehouses'),
        ApiClient.get<any>('/api/v1/master-data/employees'),
        ApiClient.get<any>('/api/v1/master-data/users'),
      ]);
      const compItems = Array.isArray(compRes) ? compRes : (compRes as any)?.items || (compRes as any)?.data?.items || (compRes as any)?.data || [];
      const plantItems = Array.isArray(plantRes) ? plantRes : (plantRes as any)?.items || (plantRes as any)?.data?.items || (plantRes as any)?.data || [];
      const branchItems = Array.isArray(branchRes) ? branchRes : (branchRes as any)?.items || (branchRes as any)?.data?.items || (branchRes as any)?.data || [];
      const whItems = Array.isArray(whRes) ? whRes : (whRes as any)?.items || (whRes as any)?.data?.items || (whRes as any)?.data || [];
      const empItems = Array.isArray(empRes) ? empRes : (empRes as any)?.items || (empRes as any)?.data?.items || (empRes as any)?.data || [];
      const userItems = Array.isArray(userRes) ? userRes : (userRes as any)?.items || (userRes as any)?.data?.items || (userRes as any)?.data || [];

      setCompanies(compItems);
      setPlants(plantItems);
      setBranches(branchItems);
      setWarehouses(whItems);
      setEmployees(empItems);
      setUsers(userItems);
    } catch (err: any) {
      console.error('Error fetching companies data:', err);
      setError(err?.message || 'Failed to fetch companies from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    legalName: '',
    companyType: 'PARENT_MANUFACTURING',
    isParent: true,
    parentCompanyId: '',
    taxId: '',
    currencyCode: 'PKR',
    email: '',
    phone: '',
    address: '',
    managerName: '',
    managerUserId: '',
    isActive: true,
  });

  // Create Director Modal State
  const [showDirectorModal, setShowDirectorModal] = useState(false);
  const [directorForm, setDirectorForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: 'Shehswar@2026!',
    phone: '',
  });
  const [isSubmittingDirector, setIsSubmittingDirector] = useState(false);

  const handleCreateDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directorForm.firstName || !directorForm.lastName || !directorForm.email) {
      showToast({ title: 'Validation Error', message: 'Name and email are required', type: 'error' });
      return;
    }
    try {
      setIsSubmittingDirector(true);
      const resolvedCompanyId =
        (selectedCompany?.id && selectedCompany.id.length === 36 ? selectedCompany.id : null) ||
        (formData.parentCompanyId && formData.parentCompanyId.length === 36 ? formData.parentCompanyId : null) ||
        (companies.find((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING')?.id || null);

      const userPayload: Record<string, any> = {
        firstName: directorForm.firstName.trim(),
        lastName: directorForm.lastName.trim(),
        email: directorForm.email.toLowerCase().trim(),
        password: directorForm.password || 'Shehswar@2026!',
        roleCode: 'ROLE_COMPANY_ADMIN',
      };
      if (directorForm.phone?.trim()) {
        userPayload.phone = directorForm.phone.trim();
      }
      if (resolvedCompanyId) {
        userPayload.companyId = resolvedCompanyId;
      }

      const res = await ApiClient.post<any>('/api/v1/master-data/users', userPayload);
      const newUser = res.data || res;
      showToast({
        title: 'Director Account Created',
        message: `${directorForm.firstName} ${directorForm.lastName} (${directorForm.email}) created and assigned!`,
        type: 'success',
      });

      const updatedUsersRes = await ApiClient.get<any>('/api/v1/master-data/users');
      const updatedUsers = Array.isArray(updatedUsersRes) ? updatedUsersRes : updatedUsersRes?.data || [];
      setUsers(updatedUsers);

      const fullName = `${directorForm.firstName} ${directorForm.lastName}`.trim();
      setFormData((prev) => ({
        ...prev,
        managerName: fullName,
        managerUserId: newUser.id,
      }));
      setShowDirectorModal(false);
      setDirectorForm({
        firstName: '',
        lastName: '',
        email: '',
        password: 'Shehswar@2026!',
        phone: '',
      });
    } catch (err: any) {
      showToast({ title: 'Failed to create director', message: err?.message || 'Error occurred', type: 'error' });
    } finally {
      setIsSubmittingDirector(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.legalName && c.legalName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType =
      typeFilter === 'ALL' ||
      c.companyType === typeFilter ||
      (typeFilter === 'CHILD_COMPANY' && (c.companyType === 'CHILD_COMPANY' || c.companyType === 'CHILD_DISTRIBUTION')) ||
      (typeFilter === 'CHILD_DISTRIBUTION' && (c.companyType === 'CHILD_COMPANY' || c.companyType === 'CHILD_DISTRIBUTION'));
    return matchesSearch && matchesType;
  });

  const columns: ColumnDef<CompanyDto>[] = [
    {
      id: 'code',
      header: 'Company Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Company Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {row.original.legalName || row.original.name}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Company Type',
      cell: ({ row }) => {
        const typeLabels: Record<string, { label: string; badge: 'info' | 'primary' | 'warning' }> = {
          PARENT_MANUFACTURING: { label: 'Parent Manufacturing', badge: 'primary' },
          CHILD_DISTRIBUTION: { label: 'Child Distribution', badge: 'info' },
          LOGISTICS: { label: 'Logistics & Fleet', badge: 'warning' },
        };
        const meta = typeLabels[row.original.companyType || 'PARENT_MANUFACTURING'] || {
          label: row.original.companyType,
          badge: 'info',
        };
        return <span style={{ fontWeight: 500 }}>{meta.label}</span>;
      },
    },
    {
      id: 'parentCompany',
      header: 'Parent Holding Entity',
      cell: ({ row }) => {
        if (row.original.isParent || row.original.companyType === 'PARENT_MANUFACTURING') {
          return (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              Primary Holding Entity
            </span>
          );
        }
        const parentName =
          row.original.parentCompany?.name ||
          companies.find((c) => c.id === row.original.parentCompanyId)?.name;
        return (
          <span style={{ fontSize: '0.85rem', color: parentName ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {parentName ? `Subsidiary of ${parentName}` : 'Independent / Direct'}
          </span>
        );
      },
    },
    {
      id: 'taxId',
      header: 'Tax / NTN',
      accessorKey: 'taxId',
      cell: ({ row }) => <span>{row.original.taxId || 'N/A'}</span>,
    },
    {
      id: 'manager',
      header: 'Managing Director / Lead',
      accessorKey: 'managerName',
      cell: ({ row }) => <span>{row.original.managerName || 'Corporate Head'}</span>,
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
              setSelectedCompany(row.original);
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
              setSelectedCompany(row.original);
              setFormData({
                code: row.original.code,
                name: row.original.name,
                legalName: row.original.legalName || '',
                companyType: row.original.companyType || 'PARENT_MANUFACTURING',
                isParent: row.original.isParent ?? false,
                parentCompanyId: row.original.parentCompanyId || '',
                taxId: row.original.taxId || '',
                currencyCode: row.original.currencyCode || 'PKR',
                email: row.original.email || '',
                phone: row.original.phone || '',
                address: row.original.address || '',
                managerName: row.original.managerName || '',
                managerUserId:
                  users.find(
                    (u) =>
                      `${u.firstName || ''} ${u.lastName || ''}`.trim() === row.original.managerName ||
                      u.email === row.original.managerName,
                  )?.id || '',
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
        const payload: Record<string, any> = {
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          companyType: formData.companyType,
          isParent: formData.isParent,
        };
        if (formData.legalName?.trim()) payload.legalName = formData.legalName.trim();
        if (formData.taxId?.trim()) payload.taxId = formData.taxId.trim();
        if (formData.currencyCode?.trim()) payload.currencyCode = formData.currencyCode.trim();
        if (formData.email?.trim()) payload.email = formData.email.trim();
        if (formData.phone?.trim()) payload.phone = formData.phone.trim();
        if (formData.address?.trim()) payload.address = formData.address.trim();
        if (formData.managerName?.trim()) payload.managerName = formData.managerName.trim();
        if (formData.managerUserId && formData.managerUserId.length === 36) payload.managerUserId = formData.managerUserId;
        if (!formData.isParent && formData.parentCompanyId && formData.parentCompanyId.length === 36) {
          payload.parentCompanyId = formData.parentCompanyId;
        }

        const res = await ApiClient.post<any>('/api/v1/master-data/companies', payload);
        const createdComp = (res as any)?.data || res;
        if (createdComp?.id && payload.managerUserId) {
          await ApiClient.patch(`/api/v1/master-data/users/${payload.managerUserId}`, {
            companyId: createdComp.id,
          });
        }
        showToast({ title: 'Success', message: `Company ${formData.name} registered with Company Admin Director`, type: 'success' });
        await fetchCompanies();
      } else if (mode === 'edit' && selectedCompany) {
        const payload: Record<string, any> = {
          name: formData.name.trim(),
          companyType: formData.companyType,
          isParent: formData.isParent,
          isActive: formData.isActive,
        };
        if (formData.legalName?.trim()) payload.legalName = formData.legalName.trim();
        if (formData.taxId?.trim()) payload.taxId = formData.taxId.trim();
        if (formData.currencyCode?.trim()) payload.currencyCode = formData.currencyCode.trim();
        if (formData.email?.trim()) payload.email = formData.email.trim();
        if (formData.phone?.trim()) payload.phone = formData.phone.trim();
        if (formData.address?.trim()) payload.address = formData.address.trim();
        if (formData.managerName?.trim()) payload.managerName = formData.managerName.trim();
        if (formData.managerUserId && formData.managerUserId.length === 36) payload.managerUserId = formData.managerUserId;
        if (!formData.isParent && formData.parentCompanyId && formData.parentCompanyId.length === 36) {
          payload.parentCompanyId = formData.parentCompanyId;
        } else if (formData.isParent) {
          payload.parentCompanyId = null;
        }

        await ApiClient.patch(`/api/v1/master-data/companies/${selectedCompany.id}`, payload);
        showToast({ title: 'Updated', message: 'Company record updated', type: 'success' });
        await fetchCompanies();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save company', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    return (
      <>
      <FormPageTemplate
        title={mode === 'create' ? 'Register New Operating Company' : `Edit ${selectedCompany?.name}`}
        subtitle="Manage legal statutory information, tax NTN registration, and operational scope."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Companies', href: '#' },
          { label: mode === 'create' ? 'Register' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Register Company' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Company Identity & Structure</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Company Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. SHEHSWAR-CHEM"
                disabled={mode === 'edit'}
              />
              <Input
                label="Company Operating Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Shehswar Chemicals Ltd"
              />
              <Input
                label="Statutory Legal Name"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="e.g. Shehswar Chemical Industries Pakistan Ltd"
              />
              <Select
                label="Company Operational Type *"
                value={formData.companyType}
                onChange={(val) => {
                  const newType = typeof val === 'string' ? val : val?.target?.value || '';
                  const isP = newType === 'PARENT_MANUFACTURING';
                  const defaultParent = !isP
                    ? companies.find((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING')?.id || ''
                    : '';
                  setFormData({
                    ...formData,
                    companyType: newType,
                    isParent: isP,
                    parentCompanyId: isP ? '' : formData.parentCompanyId || defaultParent,
                  });
                }}
                options={[
                  { value: 'PARENT_MANUFACTURING', label: 'Parent Manufacturing Company (Shehswar)' },
                  { value: 'CHILD_COMPANY', label: 'Child Distributor Subsidiary (e.g. conscept AG, Nectar)' },
                  { value: 'CHILD_DISTRIBUTION', label: 'Child Distribution & Sales Company' },
                  { value: 'LOGISTICS', label: 'Logistics & Fleet Transport' },
                ]}
              />

              {!formData.isParent && (
                <Select
                  label="Parent Holding / Manufacturing Company *"
                  value={formData.parentCompanyId}
                  onChange={(val) => {
                    const pid = typeof val === 'string' ? val : val?.target?.value || '';
                    setFormData({ ...formData, parentCompanyId: pid });
                  }}
                  options={[
                    { value: '', label: 'Select Parent Manufacturing Company...' },
                    ...companies
                      .filter((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING')
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.code}) — Primary Manufacturing Entity`,
                      })),
                  ]}
                  helperText="Required: Establishes parent-child relationship for intercompany transfer pricing, formulation access, and consolidated inventory."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Taxation & Executive Leadership</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="National Tax Number (NTN)"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="e.g. NTN-4892019-7"
              />
              <Input
                label="Operating Currency"
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                placeholder="PKR"
              />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Managing Director / Company Lead
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    style={{ fontSize: '0.75rem', color: 'var(--color-primary)', padding: '2px 8px' }}
                    onClick={() => setShowDirectorModal(true)}
                  >
                    + Register New Director Account
                  </Button>
                </div>
                <Select
                  value={formData.managerUserId || formData.managerName}
                  onChange={(val) => {
                    const selectedVal = typeof val === 'string' ? val : val?.target?.value || '';
                    const assigned = users.find(
                      (u) =>
                        u.id === selectedVal ||
                        `${u.firstName || ''} ${u.lastName || ''}`.trim() === selectedVal ||
                        u.email === selectedVal,
                    );
                    setFormData({
                      ...formData,
                      managerName: assigned
                        ? `${assigned.firstName || ''} ${assigned.lastName || ''}`.trim() || assigned.email
                        : selectedVal,
                      managerUserId: assigned ? assigned.id : '',
                    });
                  }}
                  options={[
                    { value: '', label: 'Unassigned / Executive Board' },
                    ...users.map((u) => {
                      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                      const roleName = u.userRoles?.[0]?.role?.name || 'Executive';
                      return {
                        value: u.id,
                        label: `${fullName} (${u.email} • ${roleName})`,
                      };
                    }),
                    ...(formData.managerName &&
                    !users.some(
                      (u) =>
                        u.id === formData.managerUserId ||
                        `${u.firstName || ''} ${u.lastName || ''}`.trim() === formData.managerName ||
                        u.email === formData.managerName,
                    )
                      ? [{ value: formData.managerName, label: `${formData.managerName} (Current Assignment)` }]
                      : []),
                  ]}
                  helperText="Assigning a Director automatically binds their login account to this company, ensuring they only see this company's data upon login."
                />
                {(() => {
                  const assignedUser = users.find(
                    (u) =>
                      (formData.managerUserId && u.id === formData.managerUserId) ||
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
                          {assignedUser.email} • Role: {assignedUser.userRoles?.[0]?.role?.name || 'Executive'}
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
              <CardTitle>Physical Address & Communications</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input
                label="Company Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="chemicals@shehswar.com"
              />
              <Input
                label="Direct Telephone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 42 3791-4400"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea
                  label="Registered Factory / Office Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  placeholder="Street, Industrial Area, City"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>

      <Modal
        isOpen={showDirectorModal}
        onClose={() => setShowDirectorModal(false)}
        title="Register New Director Account"
        description="Create an executive login account assigned directly to this company. Upon login, this director will strictly access only their company's operational and financial data."
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowDirectorModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleCreateDirector}
              disabled={isSubmittingDirector}
            >
              {isSubmittingDirector ? 'Creating Account...' : 'Create & Assign Director'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateDirector} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Input
              label="First Name *"
              placeholder="e.g. Tariq"
              value={directorForm.firstName}
              onChange={(e) => setDirectorForm({ ...directorForm, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Schneider"
              value={directorForm.lastName}
              onChange={(e) => setDirectorForm({ ...directorForm, lastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Director Work Email *"
            placeholder="e.g. director.conscept@shehswar.com"
            type="email"
            value={directorForm.email}
            onChange={(e) => setDirectorForm({ ...directorForm, email: e.target.value })}
            required
            helperText="Used to log into SHEHSWAR ONE360 ERP."
          />
          <Input
            label="Initial Password *"
            type="password"
            placeholder="Shehswar@2026!"
            value={directorForm.password}
            onChange={(e) => setDirectorForm({ ...directorForm, password: e.target.value })}
            required
          />
          <Input
            label="Mobile / Direct Phone"
            placeholder="+92 300 1234567"
            value={directorForm.phone}
            onChange={(e) => setDirectorForm({ ...directorForm, phone: e.target.value })}
          />
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(13, 148, 136, 0.08)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong>Strict Multi-Tenant Scoping:</strong> Once created, this user is tied to <strong>{formData.name || 'this company'}</strong>. When they log in, all dashboards, products, pricing, and orders will strictly reflect this company.
          </div>
        </form>
      </Modal>
      </>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedCompany) {
    const linkedPlants = plants.filter((p) => p.companyId === selectedCompany.id);
    const linkedBranches = branches.filter((b) => b.companyId === selectedCompany.id);
    const linkedWarehouses = warehouses.filter((w) => w.companyId === selectedCompany.id);
    const linkedEmployees = employees.filter((e) => e.companyId === selectedCompany.id);

    return (
      <DetailPageTemplate
        title={selectedCompany.name}
        subtitle={`${selectedCompany.companyType?.replace('_', ' ')} • Code: ${selectedCompany.code} • NTN: ${selectedCompany.taxId || 'N/A'}`}
        status={selectedCompany.isActive ? 'ACTIVE' : 'INACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Companies', href: '#' },
          { label: selectedCompany.code },
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
                const match = users.find(
                  (u) =>
                    `${u.firstName || ''} ${u.lastName || ''}`.trim() === selectedCompany.managerName ||
                    u.email === selectedCompany.managerName,
                );
                setFormData({
                  code: selectedCompany.code,
                  name: selectedCompany.name,
                  legalName: selectedCompany.legalName || '',
                  companyType: selectedCompany.companyType || 'PARENT_MANUFACTURING',
                  isParent: selectedCompany.isParent ?? false,
                  parentCompanyId: selectedCompany.parentCompanyId || '',
                  taxId: selectedCompany.taxId || '',
                  currencyCode: selectedCompany.currencyCode || 'PKR',
                  email: selectedCompany.email || '',
                  phone: selectedCompany.phone || '',
                  address: selectedCompany.address || '',
                  managerName: selectedCompany.managerName || '',
                  managerUserId: match?.id || '',
                  isActive: selectedCompany.isActive,
                });
                setMode('edit');
              }}
            >
              Edit Company
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'overview',
            label: 'Company 360° Overview',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <KpiCard title="Active Plants" value={linkedPlants.length} icon={<IconProduction size={20} />} />
                  <KpiCard title="Regional Branches" value={linkedBranches.length} icon={<IconBuildings size={20} />} />
                  <KpiCard title="Managed Warehouses" value={linkedWarehouses.length} icon={<IconCheck size={20} />} />
                  <KpiCard title="Assigned Personnel" value={linkedEmployees.length} icon={<IconBuildings size={20} />} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Statutory & Fiscal Parameters</CardTitle>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Corporate Entity Code:</span>
                        <span style={{ fontWeight: 600 }}>{selectedCompany.code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tax Registration (NTN):</span>
                        <span style={{ fontWeight: 500 }}>{selectedCompany.taxId || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Functional Currency:</span>
                        <span style={{ fontWeight: 600 }}>{selectedCompany.currencyCode}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Parent Status / Entity:</span>
                        <span style={{ fontWeight: 600 }}>
                          {selectedCompany.isParent
                            ? 'Primary Holding Entity'
                            : selectedCompany.parentCompany?.name ||
                              companies.find((c) => c.id === selectedCompany.parentCompanyId)?.name ||
                              'Operating Subsidiary'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Managing Director:</span>
                        <span style={{ fontWeight: 500 }}>{selectedCompany.managerName || 'Corporate Executive Board'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Physical Address & Contact</CardTitle>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                        <span style={{ fontWeight: 500 }}>{selectedCompany.email || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                        <span style={{ fontWeight: 500 }}>{selectedCompany.phone || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                          Registered Facility Address:
                        </span>
                        <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{selectedCompany.address || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            id: 'plants-warehouses',
            label: 'Plants & Warehouses',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Manufacturing Plants Located in this Company</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {linkedPlants.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                        {linkedPlants.map((plant) => (
                          <div
                            key={plant.id}
                            style={{
                              padding: '1rem',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-card-subtle)',
                            }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{plant.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                              Code: {plant.code} • Manager: {plant.managerName}
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>{plant.location}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No manufacturing plants registered under this company.</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Storage Warehouses & Tank Farms</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {linkedWarehouses.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                        {linkedWarehouses.map((wh) => (
                          <div
                            key={wh.id}
                            style={{
                              padding: '1rem',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-card-subtle)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wh.name}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>{wh.type}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                              Code: {wh.code} • Lead: {wh.managerName}
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>{wh.location}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No warehouses registered under this company.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'activity',
            label: 'Company Activity & Audit',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Historical Log & Modifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={[
                      {
                        title: 'Commercial Entity Registered',
                        timestamp: selectedCompany.createdAt ? new Date(selectedCompany.createdAt).toLocaleDateString() : 'Initial Creation',
                        description: `Company incorporated into Shehswar Group with NTN ${selectedCompany.taxId || 'N/A'}.`,
                        status: 'completed',
                      },
                      {
                        title: 'Manufacturing & Distribution Licenses Verified',
                        timestamp: 'Verification Approved',
                        description: 'Environmental protection and chemical safety licenses verified.',
                        status: 'completed',
                      },
                      {
                        title: 'Operational Baseline Active',
                        timestamp: 'Active',
                        description: 'Multi-plant and inter-company trading boundaries enforced.',
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
      title="Company Governance Management"
      subtitle="Parent manufacturing and child distribution subsidiaries of Shehswar Group."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Companies' }]}
      primaryAction={{
        label: 'Register Company',
        icon: <IconPlus size={16} />,
        onClick: () => {
          const parentCo = companies.find((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING');
          const isInitialParent = !parentCo;
          setFormData({
            code: '',
            name: '',
            legalName: '',
            companyType: isInitialParent ? 'PARENT_MANUFACTURING' : 'CHILD_COMPANY',
            isParent: isInitialParent,
            parentCompanyId: isInitialParent ? '' : parentCo?.id || '',
            taxId: '',
            currencyCode: 'PKR',
            email: '',
            phone: '',
            address: '',
            managerName: '',
            managerUserId: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        {
          label: 'Refresh',
          icon: <IconRefresh size={16} />,
          onClick: fetchCompanies,
        },
        {
          label: 'Export Companies',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Companies exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Operating Companies" value={companies.length} icon={<IconBuildings size={20} />} />
        <KpiCard title="Manufacturing Parent" value={companies.filter((c) => c.companyType === 'PARENT_MANUFACTURING').length} icon={<IconProduction size={20} />} />
        <KpiCard title="Distribution & Freight" value={companies.filter((c) => c.companyType !== 'PARENT_MANUFACTURING').length} icon={<IconCheck size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search by company code, name, or NTN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '220px' }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Company Types' },
                { value: 'PARENT_MANUFACTURING', label: 'Parent Manufacturing' },
                { value: 'CHILD_COMPANY', label: 'Child Distributor / Subsidiary' },
                { value: 'CHILD_DISTRIBUTION', label: 'Child Distribution' },
                { value: 'LOGISTICS', label: 'Logistics & Fleet' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Companies"
          message={error}
          onRetry={fetchCompanies}
        />
      ) : filteredCompanies.length === 0 ? (
        <EmptyState
          title="No Companies Found"
          description={searchQuery ? 'No companies match your search criteria.' : 'No operating companies have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Filters' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setTypeFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filteredCompanies} />
      )}
    </ListPageTemplate>
  );
};
