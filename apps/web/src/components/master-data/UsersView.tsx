'use client';

/**
 * SHEHSWAR ONE360 - Enterprise User Management & Multi-Step Creation Wizard
 *
 * Requirements:
 * 1. Employee and User are separate entities.
 * 2. 5-Step Creation Wizard:
 *    Step 1: Employee Selection (Link existing or Create new employee)
 *    Step 2: User Account Credentials (Email, Name, Phone, Password)
 *    Step 3: Role & Organizational Scope (Company, Role, Department)
 *    Step 4: Market Assignments (Role-driven dynamic assignments, Multi-Assignment support)
 *    Step 5: Review & Confirm
 * 3. Support multiple market assignments per user (e.g. Ali in Territory 01 & Territory 02).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { CompanyDto, RoleDto, EmployeeDto } from '@shehswar/types';
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
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconEye,
  IconEdit,
  IconTrash,
} from '../icons';
import { useToast } from '../../context/toast-context';

export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  companyId: string;
  roleId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
  marketAssignments?: any[];
  employee?: any;
  role?: any;
  company?: any;
  creditLimit?: number;
  targetAmount?: number;
  lastLoginAt?: Date;
  createdAt: Date;
}

const formatPKR = (amount: number | string | undefined | null) => {
  const val = Number(amount || 0);
  if (!val) return 'PKR 0';
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2).replace(/\.00$/, '');
    return `PKR ${val.toLocaleString()} (${cr} Cr)`;
  }
  if (val >= 100000) {
    const lakh = (val / 100000).toFixed(2).replace(/\.00$/, '');
    return `PKR ${val.toLocaleString()} (${lakh} Lakh)`;
  }
  return `PKR ${val.toLocaleString()}`;
};

export const UsersView: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Wizard Step state: 1 to 5
  const [wizardStep, setWizardStep] = useState<number>(1);

interface MarketAssignmentItem {
  roleScope: string;
  regionId: string;
  zoneId: string;
  territoryId: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  tempId?: string;
}

  // Form State
  const [formData, setFormData] = useState({
    // Employee
    employeeOption: 'existing' as 'existing' | 'new',
    employeeId: '',
    newEmployeeCode: '',
    newEmployeeFirstName: '',
    newEmployeeLastName: '',
    newEmployeePosition: 'Sales Officer',
    newEmployeeDepartment: 'Sales & Distribution',
    // User credentials
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    // Role & Scope
    companyId: '',
    roleId: '',
    status: 'ACTIVE' as UserRecord['status'],
    // Financial Target & Credit Limit
    creditLimit: '',
    targetAmount: '',
    // Market Assignments (Multiple support)
    marketAssignments: [] as MarketAssignmentItem[],
  });

  // Current assignment being drafted in Step 4
  const [draftAssignment, setDraftAssignment] = useState({
    regionId: '',
    zoneId: '',
    territoryId: '',
    isPrimary: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, compRes, roleRes, empRes, regRes, zoneRes, terrRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/users'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/roles'),
        ApiClient.get<any>('/api/v1/master-data/employees').catch(() => []),
        ApiClient.get<any>('/api/v1/master-data/regions').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/zones').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/territories').catch(() => ({ data: [] })),
      ]);

      const userItems = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.items || (usersRes as any)?.data?.items || (usersRes as any)?.data || [];
      const compItems = Array.isArray(compRes) ? compRes : (compRes as any)?.items || (compRes as any)?.data?.items || (compRes as any)?.data || [];
      const roleItems = Array.isArray(roleRes) ? roleRes : (roleRes as any)?.items || (roleRes as any)?.data?.items || (roleRes as any)?.data || [];
      const empItems = Array.isArray(empRes) ? empRes : (empRes as any)?.items || (empRes as any)?.data?.items || (empRes as any)?.data || [];
      const regItems = Array.isArray(regRes.data) ? regRes.data : regRes.data?.data || [];
      const zItems = Array.isArray(zoneRes.data) ? zoneRes.data : zoneRes.data?.data || [];
      const tItems = Array.isArray(terrRes.data) ? terrRes.data : terrRes.data?.data || [];

      setUsers(userItems);
      setCompanies(compItems);
      setRoles(roleItems);
      setEmployees(empItems);
      setRegions(regItems);
      setZones(zItems);
      setTerritories(tItems);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine active role type
  const selectedRole = roles.find((r) => r.id === formData.roleId);
  const roleName = selectedRole?.name?.toLowerCase() || '';
  const isBusinessManagerRole = roleName.includes('business') || roleName.includes('bm');
  const isAreaManagerRole = roleName.includes('area') || roleName.includes('am');
  const isSalesOfficerRole = roleName.includes('sales') || roleName.includes('field') || roleName.includes('officer') || roleName.includes('so');
  const isSalesRole = isBusinessManagerRole || isAreaManagerRole || isSalesOfficerRole;

  const currentRoleScope = isBusinessManagerRole ? 'REGION' : isAreaManagerRole ? 'ZONE' : 'TERRITORY';

  // Add draft assignment to formData.marketAssignments
  const handleAddAssignment = () => {
    if (isBusinessManagerRole && !draftAssignment.regionId) {
      showToast({ title: 'Validation Error', message: 'Please select a Region', type: 'error' });
      return;
    }
    if (isAreaManagerRole && (!draftAssignment.regionId || !draftAssignment.zoneId)) {
      showToast({ title: 'Validation Error', message: 'Please select Region and Zone', type: 'error' });
      return;
    }
    if (isSalesOfficerRole && (!draftAssignment.regionId || !draftAssignment.zoneId || !draftAssignment.territoryId)) {
      showToast({ title: 'Validation Error', message: 'Please select Region, Zone, and Territory', type: 'error' });
      return;
    }

    const newAssignment: MarketAssignmentItem = {
      roleScope: currentRoleScope,
      regionId: draftAssignment.regionId,
      zoneId: draftAssignment.zoneId,
      territoryId: draftAssignment.territoryId,
      isPrimary: formData.marketAssignments.length === 0 ? true : draftAssignment.isPrimary,
      effectiveFrom: draftAssignment.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: draftAssignment.effectiveTo || undefined,
      tempId: Math.random().toString(),
    };

    setFormData({
      ...formData,
      marketAssignments: [...formData.marketAssignments, newAssignment],
    });

    setDraftAssignment({
      regionId: '',
      zoneId: '',
      territoryId: '',
      isPrimary: false,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
    });

    showToast({ title: 'Assignment Added', message: 'Market assignment added to queue', type: 'success' });
  };

  const handleRemoveAssignment = (index: number) => {
    const updated = formData.marketAssignments.filter((_, i) => i !== index);
    setFormData({ ...formData, marketAssignments: updated });
  };

  // Submit Handler
  const handleSave = async () => {
    if (!formData.firstName || !formData.email) {
      showToast({ title: 'Validation Error', message: 'First name and email are required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);

      const validAssignments = formData.marketAssignments
        .filter((a) => Boolean(a.regionId || a.zoneId || a.territoryId))
        .map((a) => ({
          roleScope: a.roleScope,
          regionId: a.regionId || null,
          zoneId: a.zoneId || null,
          territoryId: a.territoryId || null,
          isPrimary: a.isPrimary,
          effectiveFrom: a.effectiveFrom ? new Date(a.effectiveFrom) : new Date(),
          effectiveTo: a.effectiveTo ? new Date(a.effectiveTo) : null,
        }));

      if (mode === 'create') {
        let finalEmployeeId = formData.employeeId;

        // If creating new employee first (auto-generate code if left blank)
        if (formData.employeeOption === 'new') {
          const empPayload: any = {
            employeeCode: (formData.newEmployeeCode || 'AUTO').trim().toUpperCase(),
            firstName: formData.newEmployeeFirstName || formData.firstName,
            lastName: formData.newEmployeeLastName || formData.lastName || '',
            position: formData.newEmployeePosition || 'Sales Officer',
            status: 'ACTIVE',
          };
          const resolvedCompId = formData.companyId || companies[0]?.id;
          if (resolvedCompId) {
            empPayload.companyId = resolvedCompId;
          }
          if (formData.newEmployeeDepartment) {
            empPayload.department = formData.newEmployeeDepartment;
          }

          const empRes = await ApiClient.post<any>('/api/v1/master-data/employees', empPayload);
          const createdEmp = empRes.data?.data || empRes.data;
          if (createdEmp?.id) {
            finalEmployeeId = createdEmp.id;
          }
        }

        const payload: any = {
          firstName: formData.firstName,
          lastName: formData.lastName || '',
          email: formData.email,
          password: formData.password || 'Shehswar@2026!',
          marketAssignments: validAssignments,
        };
        if (formData.phone) payload.phone = formData.phone;
        const compId = formData.companyId || companies[0]?.id;
        if (compId) payload.companyId = compId;
        const rId = formData.roleId || roles[0]?.id;
        if (rId) payload.roleId = rId;
        if (finalEmployeeId) payload.employeeId = finalEmployeeId;
        if (formData.creditLimit !== '') payload.creditLimit = Number(formData.creditLimit);
        if (formData.targetAmount !== '') payload.targetAmount = Number(formData.targetAmount);

        await ApiClient.post('/api/v1/master-data/users', payload);
        showToast({ title: 'Success', message: `User ${formData.email} registered successfully`, type: 'success' });
        await fetchData();
      } else if (mode === 'edit' && selectedUser) {
        const payload: any = {
          firstName: formData.firstName,
          lastName: formData.lastName || '',
          phone: formData.phone,
          companyId: formData.companyId,
          roleId: formData.roleId,
          status: formData.status,
          creditLimit: formData.creditLimit !== '' ? Number(formData.creditLimit) : undefined,
          targetAmount: formData.targetAmount !== '' ? Number(formData.targetAmount) : undefined,
          marketAssignments: validAssignments,
        };
        await ApiClient.patch(`/api/v1/master-data/users/${selectedUser.id}`, payload);
        showToast({ title: 'Updated', message: 'User account updated', type: 'success' });
        await fetchData();
      }
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save user', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserRecord) => {
    const confirmName = `${user.firstName} ${user.lastName} (${user.email})`;
    if (!window.confirm(`Are you sure you want to permanently delete user account:\n"${confirmName}"?\nThis action will immediately revoke all access and remove assigned credentials.`)) {
      return;
    }

    try {
      await ApiClient.delete(`/api/v1/master-data/users/${user.id}`);
      showToast({
        title: 'User Deleted',
        message: `User account "${confirmName}" has been permanently deleted.`,
        type: 'success',
      });
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
        setMode('list');
      }
      await fetchData();
    } catch (err: any) {
      showToast({
        title: 'Deletion Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to delete user account',
        type: 'error',
      });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesRole = roleFilter === 'ALL' || u.roleId === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const columns: ColumnDef<UserRecord>[] = [
    {
      id: 'name',
      header: 'User Identity',
      cell: ({ row }: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.original.firstName} {row.original.lastName}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.original.email}</div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Assigned Role',
      cell: ({ row }: any) => {
        const role = roles.find((r) => r.id === row.original.roleId);
        return <span style={{ fontWeight: 600, color: '#2563eb' }}>{role ? role.name : 'Standard'}</span>;
      },
    },
    {
      id: 'company',
      header: 'Operating Company',
      cell: ({ row }: any) => {
        const comp = companies.find((c) => c.id === row.original.companyId);
        return <span>{comp ? comp.name : 'Holding'}</span>;
      },
    },
    {
      id: 'employeeLink',
      header: 'Employee Profile',
      cell: ({ row }: any) => {
        const emp = employees.find((e) => e.id === row.original.employeeId);
        return <span>{emp ? `${emp.employeeCode} (${emp.position})` : 'System User'}</span>;
      },
    },
    {
      id: 'marketAssignments',
      header: 'Market Assignments',
      cell: ({ row }: any) => {
        const assigns = row.original.marketAssignments || [];
        if (assigns.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Non-sales scope</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {assigns.slice(0, 2).map((a: any, idx: number) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  backgroundColor: '#f1f5f9',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: '#334155',
                }}
              >
                {a.territory?.name || a.zone?.name || a.region?.name || a.roleScope}
                {a.isPrimary && ' ★'}
              </span>
            ))}
            {assigns.length > 2 && <span style={{ fontSize: '10px', color: '#64748b' }}>+{assigns.length - 2} more</span>}
          </div>
        );
      },
    },
    {
      id: 'targets',
      header: 'Target & Credit',
      cell: ({ row }: any) => {
        const target = row.original.targetAmount;
        const credit = row.original.creditLimit;
        if (!target && !credit) {
          return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {target ? (
              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                Tgt: {formatPKR(target)}
              </span>
            ) : null}
            {credit ? (
              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                Limit: {formatPKR(credit)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
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
              setSelectedUser(row.original);
              setMode('detail');
            }}
          >
            Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedUser(row.original);
              setFormData({
                employeeOption: 'existing',
                employeeId: row.original.employeeId || '',
                newEmployeeCode: '',
                newEmployeeFirstName: '',
                newEmployeeLastName: '',
                newEmployeePosition: 'Sales Officer',
                newEmployeeDepartment: 'Sales',
                firstName: row.original.firstName,
                lastName: row.original.lastName,
                email: row.original.email,
                phone: row.original.phone || '',
                password: '',
                companyId: row.original.companyId,
                roleId: row.original.roleId,
                status: row.original.status,
                creditLimit: row.original.creditLimit ? String(row.original.creditLimit) : '',
                targetAmount: row.original.targetAmount ? String(row.original.targetAmount) : '',
                marketAssignments: [],
              });
              setMode('edit');
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconTrash size={14} />}
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
            onClick={() => handleDeleteUser(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Render 5-Step Creation Wizard
  if (mode === 'create') {
    return (
      <FormPageTemplate
        title="Enterprise User Creation Wizard (5 Steps)"
        subtitle="Employee Profile → User Credentials → Role Scope → Dynamic Market Assignments → Review"
        breadcrumbs={[
          { label: 'Security & Access', href: '#' },
          { label: 'Users', href: '#' },
          { label: 'New User Wizard' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={(e) => {
          e?.preventDefault?.();
          if (wizardStep < 5) {
            setWizardStep(wizardStep + 1);
          } else {
            handleSave();
          }
        }}
        isSubmitting={isSubmitting}
        submitLabel={wizardStep === 5 ? 'Confirm & Create User' : `Next: Step ${wizardStep + 1} →`}
      >
        {/* Step Indicator Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            backgroundColor: 'var(--bg-surface)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            overflowX: 'auto',
            gap: '8px',
          }}
        >
          {[
            { step: 1, label: '1. Employee' },
            { step: 2, label: '2. Credentials' },
            { step: 3, label: '3. Role & Scope' },
            { step: 4, label: '4. Market Assignments' },
            { step: 5, label: '5. Review & Confirm' },
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setWizardStep(s.step)}
              style={{
                background: wizardStep === s.step ? '#2563eb' : wizardStep > s.step ? '#eff6ff' : 'transparent',
                color: wizardStep === s.step ? '#ffffff' : wizardStep > s.step ? '#1d4ed8' : 'var(--text-secondary)',
                border: wizardStep === s.step ? 'none' : '1px solid var(--border-subtle)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {s.label} {wizardStep > s.step && '✓'}
            </button>
          ))}
        </div>

        {/* STEP 1: Employee Link */}
        {wizardStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Employee Profile (Person Representation)</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                Employee represents the person (HR record). The User represents their login account. Select an existing employee or register a new one.
              </p>

              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="empOption"
                    checked={formData.employeeOption === 'existing'}
                    onChange={() => setFormData({ ...formData, employeeOption: 'existing' })}
                  />
                  <strong>Link Existing Employee</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="empOption"
                    checked={formData.employeeOption === 'new'}
                    onChange={() => setFormData({ ...formData, employeeOption: 'new' })}
                  />
                  <strong>Create New Employee Profile First</strong>
                </label>
              </div>

              {formData.employeeOption === 'existing' ? (
                <Select
                  label="Select Employee Record"
                  value={formData.employeeId}
                  onChange={(e) => {
                    const emp = employees.find((em) => em.id === e.target.value);
                    setFormData({
                      ...formData,
                      employeeId: e.target.value,
                      firstName: emp?.firstName || formData.firstName,
                      lastName: emp?.lastName || formData.lastName,
                    });
                  }}
                  options={[
                    { label: 'None (System / External User)', value: '' },
                    ...employees.map((e) => ({
                      label: `${e.employeeCode} - ${e.firstName} ${e.lastName} (${e.position})`,
                      value: e.id,
                    })),
                  ]}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                  <Input
                    label="Employee ID / Code (Auto-generated if blank)"
                    value={formData.newEmployeeCode}
                    onChange={(e) => setFormData({ ...formData, newEmployeeCode: e.target.value })}
                    placeholder="Leave blank for auto EMP-000001"
                  />
                  <Input
                    label="Designation / Position *"
                    value={formData.newEmployeePosition}
                    onChange={(e) => setFormData({ ...formData, newEmployeePosition: e.target.value })}
                    placeholder="e.g. Sales Officer / Area Manager"
                  />
                  <Input
                    label="First Name"
                    value={formData.newEmployeeFirstName}
                    onChange={(e) => setFormData({ ...formData, newEmployeeFirstName: e.target.value, firstName: e.target.value })}
                    placeholder="e.g. Ali"
                  />
                  <Input
                    label="Last Name"
                    value={formData.newEmployeeLastName}
                    onChange={(e) => setFormData({ ...formData, newEmployeeLastName: e.target.value, lastName: e.target.value })}
                    placeholder="e.g. Khan"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: User Account Credentials */}
        {wizardStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: User Account Credentials</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Input
                  label="First Name *"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. Ali"
                />
                <Input
                  label="Last Name *"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Khan"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Input
                  label="Email Address (Login Username) *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ali@consceptag.com"
                />
                <Input
                  label="Mobile Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                />
              </div>

              <Input
                label="Initial Password *"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Shehswar@2026!"
              />
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Role & Organizational Scope */}
        {wizardStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Security Role & Company Scope</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Select
                  label="Operating Company Scope *"
                  value={formData.companyId || companies[0]?.id || ''}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  options={companies.map((c) => ({ label: c.name, value: c.id }))}
                />
                <Select
                  label="Security Role (RBAC) *"
                  value={formData.roleId || roles[0]?.id || ''}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  options={roles.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                />
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: '#166534' }}>Detected Functional Level: </strong>
                <span style={{ color: '#14532d', fontWeight: 600 }}>
                  {isBusinessManagerRole
                    ? 'Business Manager (Region Scope)'
                    : isAreaManagerRole
                    ? 'Area Manager (Zone Scope)'
                    : isSalesOfficerRole
                    ? 'Sales Officer / Field Officer (Territory Scope)'
                    : 'Non-Sales Function (Company / Plant / Department Scope)'}
                </span>
              </div>

              {/* Financial Sales Target & Credit Limit */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                      Financial Target & Credit Limit Configuration
                    </strong>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Individual targets and limits automatically roll up to Territory, Zone, and Region totals.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Input
                      label="Sales Target (PKR)"
                      type="number"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                      placeholder="e.g. 20000000 (2 Crore)"
                    />
                    <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>
                      Effective: {formatPKR(formData.targetAmount)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {[
                        { label: '50 Lakh', val: 5000000 },
                        { label: '1 Crore', val: 10000000 },
                        { label: '2 Crore', val: 20000000 },
                        { label: '5 Crore', val: 50000000 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData({ ...formData, targetAmount: String(preset.val) })}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            color: '#1d4ed8',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Input
                      label="Credit Limit (PKR)"
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      placeholder="e.g. 1000000 (10 Lakh)"
                    />
                    <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      Effective: {formatPKR(formData.creditLimit)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {[
                        { label: '5 Lakh', val: 500000 },
                        { label: '10 Lakh', val: 1000000 },
                        { label: '20 Lakh', val: 2000000 },
                        { label: '50 Lakh', val: 5000000 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData({ ...formData, creditLimit: String(preset.val) })}
                          style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            color: '#15803d',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Dynamic Role-Based Market Assignments */}
        {wizardStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Market Assignments (Multi-Assignment Support)</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isSalesRole ? (
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Non-sales roles operate under organizational plant/warehouse scope and do not require sales territory assignments.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#1d4ed8',
                    }}
                  >
                    <strong>ℹ Optional Step:</strong> Market assignments are completely optional. Users can be created without market assignments and mapped later in Market Management.
                  </div>

                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    A single user can manage multiple markets (e.g. Ali operates in Territory 01 and Territory 02).
                    Add authorized assignments below if applicable:
                  </p>

                  {/* Dynamic Assignment Builder Input Panel */}
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      Add Assignment for {isBusinessManagerRole ? 'Region' : isAreaManagerRole ? 'Zone' : 'Territory'}:
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <Select
                        label="Region *"
                        value={draftAssignment.regionId}
                        onChange={(e) => setDraftAssignment({ ...draftAssignment, regionId: e.target.value, zoneId: '', territoryId: '' })}
                        options={[
                          { label: 'Select Region...', value: '' },
                          ...regions.map((r) => ({ label: `${r.code} - ${r.name}`, value: r.id })),
                        ]}
                      />

                      {(isAreaManagerRole || isSalesOfficerRole) && (
                        <Select
                          label="Zone *"
                          value={draftAssignment.zoneId}
                          onChange={(e) => setDraftAssignment({ ...draftAssignment, zoneId: e.target.value, territoryId: '' })}
                          options={[
                            { label: 'Select Zone...', value: '' },
                            ...zones
                              .filter((z) => !draftAssignment.regionId || z.regionId === draftAssignment.regionId)
                              .map((z) => ({ label: `${z.code} - ${z.name}`, value: z.id })),
                          ]}
                        />
                      )}

                      {isSalesOfficerRole && (
                        <Select
                          label="Territory *"
                          value={draftAssignment.territoryId}
                          onChange={(e) => setDraftAssignment({ ...draftAssignment, territoryId: e.target.value })}
                          options={[
                            { label: 'Select Territory...', value: '' },
                            ...territories
                              .filter((t) => !draftAssignment.zoneId || t.zoneId === draftAssignment.zoneId)
                              .map((t) => ({ label: `${t.code} - ${t.name}`, value: t.id })),
                          ]}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={draftAssignment.isPrimary}
                          onChange={(e) => setDraftAssignment({ ...draftAssignment, isPrimary: e.target.checked })}
                        />
                        <span>Primary Assignment</span>
                      </label>

                      <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={handleAddAssignment}>
                        + Add Assignment
                      </Button>
                    </div>
                  </div>

                  {/* List of Configured Assignments */}
                  <div>
                    <strong style={{ fontSize: '13px' }}>Configured Market Assignments ({formData.marketAssignments.length}):</strong>
                    {formData.marketAssignments.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        No market assignments added yet. You may proceed without assignments or add one above.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 12px' }}>Scope</th>
                            <th style={{ padding: '8px 12px' }}>Target Market</th>
                            <th style={{ padding: '8px 12px' }}>Priority</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.marketAssignments.map((a, idx) => {
                            const reg = regions.find((r) => r.id === a.regionId);
                            const z = zones.find((zn) => zn.id === a.zoneId);
                            const t = territories.find((tr) => tr.id === a.territoryId);
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.roleScope}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  {t ? `${t.name} (${t.code})` : z ? `${z.name} (${z.code})` : reg ? `${reg.name} (${reg.code})` : '—'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ color: a.isPrimary ? '#059669' : '#64748b', fontWeight: 600 }}>
                                    {a.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    style={{ color: '#ef4444' }}
                                    icon={<IconTrash size={14} />}
                                    onClick={() => handleRemoveAssignment(idx)}
                                  >
                                    Remove
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Review & Confirm */}
        {wizardStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 5: Review & Confirm Setup</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>User Identity</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
                    {formData.firstName} {formData.lastName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>{formData.email}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{formData.phone || 'No phone'}</div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Access & Role</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', color: '#2563eb' }}>
                    {selectedRole?.name || 'Standard Role'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    Company: {companies.find((c) => c.id === formData.companyId)?.name || 'Default Company'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Financial Sales Target</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#1d4ed8' }}>
                    {formatPKR(formData.targetAmount)}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Individual Credit Limit</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#15803d' }}>
                    {formatPKR(formData.creditLimit)}
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '14px' }}>Assigned Market Coverage ({formData.marketAssignments.length} Assignments):</strong>
                {formData.marketAssignments.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>No direct market assignments (Non-sales scope)</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {formData.marketAssignments.map((a, idx) => {
                      const reg = regions.find((r) => r.id === a.regionId);
                      const z = zones.find((zn) => zn.id === a.zoneId);
                      const t = territories.find((tr) => tr.id === a.territoryId);
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                          }}
                        >
                          <div>
                            <strong>Assignment {idx + 1}: </strong>
                            {reg?.name} {z && `→ ${z.name}`} {t && `→ ${t.name}`} ({a.roleScope})
                          </div>
                          <span style={{ fontWeight: 700, color: a.isPrimary ? '#059669' : '#64748b' }}>
                            {a.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </FormPageTemplate>
    );
  }

  // Render Edit Mode
  if (mode === 'edit') {
    return (
      <FormPageTemplate
        title={`Edit User ${selectedUser?.email}`}
        subtitle="Manage access credentials, multi-company scope, and RBAC security role assignments."
        breadcrumbs={[
          { label: 'Security & Access', href: '#' },
          { label: 'Users', href: '#' },
          { label: 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={(e) => {
          e?.preventDefault?.();
          handleSave();
        }}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="First Name *"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
                <Input
                  label="Last Name *"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
              <Input label="Email" value={formData.email} disabled />
              <Input
                label="Mobile Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role & Status</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Select
                label="Security Role *"
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
              <Select
                label="Operating Company *"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Status *"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Target & Credit Limit</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <Input
                  label="Sales Target (PKR)"
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  placeholder="e.g. 20000000"
                />
                <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginTop: '4px' }}>
                  Effective: {formatPKR(formData.targetAmount)}
                </div>
              </div>
              <div>
                <Input
                  label="Credit Limit (PKR)"
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  placeholder="e.g. 1000000"
                />
                <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginTop: '4px' }}>
                  Effective: {formatPKR(formData.creditLimit)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Hierarchy & Territory Assignment */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader>
              <CardTitle>Market Hierarchy & Territory Coverage</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Assign Market Coverage ({isBusinessManagerRole ? 'Regional Scope' : isAreaManagerRole ? 'Zonal Scope' : 'Territory / Field Scope'}):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <Select
                    label="Region *"
                    value={draftAssignment.regionId}
                    onChange={(e) => setDraftAssignment({ ...draftAssignment, regionId: e.target.value, zoneId: '', territoryId: '' })}
                    options={[
                      { label: 'Select Region...', value: '' },
                      ...regions.map((r) => ({ label: `${r.code} - ${r.name}`, value: r.id })),
                    ]}
                  />

                  {(isAreaManagerRole || isSalesOfficerRole) && (
                    <Select
                      label="Zone *"
                      value={draftAssignment.zoneId}
                      onChange={(e) => setDraftAssignment({ ...draftAssignment, zoneId: e.target.value, territoryId: '' })}
                      options={[
                        { label: 'Select Zone...', value: '' },
                        ...zones
                          .filter((z) => !draftAssignment.regionId || z.regionId === draftAssignment.regionId)
                          .map((z) => ({ label: `${z.code} - ${z.name}`, value: z.id })),
                      ]}
                    />
                  )}

                  {isSalesOfficerRole && (
                    <Select
                      label="Territory *"
                      value={draftAssignment.territoryId}
                      onChange={(e) => setDraftAssignment({ ...draftAssignment, territoryId: e.target.value })}
                      options={[
                        { label: 'Select Territory...', value: '' },
                        ...territories
                          .filter((t) => !draftAssignment.zoneId || t.zoneId === draftAssignment.zoneId)
                          .map((t) => ({ label: `${t.code} - ${t.name}`, value: t.id })),
                      ]}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={draftAssignment.isPrimary}
                      onChange={(e) => setDraftAssignment({ ...draftAssignment, isPrimary: e.target.checked })}
                    />
                    <span>Primary Assignment</span>
                  </label>

                  <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={handleAddAssignment}>
                    + Add Assignment
                  </Button>
                </div>
              </div>

              {/* List of Configured Assignments */}
              <div>
                <strong style={{ fontSize: '13px' }}>Configured Market Assignments ({formData.marketAssignments.length}):</strong>
                {formData.marketAssignments.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    No market assignments configured for this user.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px' }}>Scope</th>
                        <th style={{ padding: '8px 12px' }}>Target Market</th>
                        <th style={{ padding: '8px 12px' }}>Priority</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.marketAssignments.map((a, idx) => {
                        const reg = regions.find((r) => r.id === a.regionId);
                        const z = zones.find((zn) => zn.id === a.zoneId);
                        const t = territories.find((tr) => tr.id === a.territoryId);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.roleScope}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {t ? `${t.name} (${t.code})` : z ? `${z.name} (${z.code})` : reg ? `${reg.name} (${reg.code})` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ color: a.isPrimary ? '#059669' : '#64748b', fontWeight: 600 }}>
                                {a.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<IconTrash size={14} />}
                                style={{ color: '#ef4444' }}
                                onClick={() => handleRemoveAssignment(idx)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedUser) {
    const role = roles.find((r) => r.id === selectedUser.roleId);
    const company = companies.find((c) => c.id === selectedUser.companyId);
    const employee = employees.find((e) => e.id === selectedUser.employeeId);
    const assigns = selectedUser.marketAssignments || [];

    return (
      <DetailPageTemplate
        title={`${selectedUser.firstName} ${selectedUser.lastName}`}
        subtitle={selectedUser.email}
        breadcrumbs={[
          { label: 'Security & Access', href: '#' },
          { label: 'Users', onClick: () => setMode('list') },
          { label: selectedUser.email },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setMode('list')}>
              ← Back to Users
            </Button>
            <Button
              variant="outline"
              icon={<IconEdit size={16} />}
              onClick={() => {
              setFormData({
                employeeOption: 'existing',
                employeeId: selectedUser.employeeId || '',
                newEmployeeCode: '',
                newEmployeeFirstName: '',
                newEmployeeLastName: '',
                newEmployeePosition: '',
                newEmployeeDepartment: '',
                firstName: selectedUser.firstName,
                lastName: selectedUser.lastName,
                email: selectedUser.email,
                phone: selectedUser.phone || '',
                password: '',
                companyId: selectedUser.companyId,
                roleId: selectedUser.roleId,
                status: selectedUser.status,
                creditLimit: selectedUser.creditLimit ? String(selectedUser.creditLimit) : '',
                targetAmount: selectedUser.targetAmount ? String(selectedUser.targetAmount) : '',
                marketAssignments: (selectedUser.marketAssignments || []).map((ma: any) => ({
                  roleScope: ma.roleScope || 'SALES_OFFICER',
                  regionId: ma.regionId || '',
                  zoneId: ma.zoneId || '',
                  territoryId: ma.territoryId || '',
                  isPrimary: Boolean(ma.isPrimary),
                  effectiveFrom: ma.effectiveFrom ? String(ma.effectiveFrom).slice(0, 10) : new Date().toISOString().slice(0, 10),
                  effectiveTo: ma.effectiveTo ? String(ma.effectiveTo).slice(0, 10) : undefined,
                  tempId: ma.id || Math.random().toString(),
                })),
              });
              setMode('edit');
            }}
          >
            Edit User
          </Button>
          <Button
            variant="outline"
            icon={<IconTrash size={16} />}
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
            onClick={() => handleDeleteUser(selectedUser)}
          >
            Delete User
          </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role</span>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{role?.name || 'Standard'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Company Scope</span>
                <div style={{ fontWeight: 600 }}>{company?.name || 'Holding'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Linked Employee</span>
                <div style={{ fontWeight: 600 }}>{employee ? `${employee.employeeCode} - ${employee.firstName} ${employee.lastName} (${employee.position})` : 'System User (No Employee Link)'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sales Target</span>
                <div style={{ fontWeight: 600, color: '#1d4ed8' }}>{formatPKR(selectedUser.targetAmount)}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Credit Limit</span>
                <div style={{ fontWeight: 600, color: '#15803d' }}>{formatPKR(selectedUser.creditLimit)}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Account Status</span>
                <div><StatusBadge status={selectedUser.status} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Market Assignments ({assigns.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {assigns.length === 0 ? (
                <EmptyState title="No Market Assignments" description="User operates under standard organizational or administrative scope." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {assigns.map((a: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#1e40af' }}>{a.roleScope}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: a.isPrimary ? '#059669' : '#64748b' }}>
                          {a.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        {a.region?.name && <span>{a.region.name} Region </span>}
                        {a.zone?.name && <span>→ {a.zone.name} Zone </span>}
                        {a.territory?.name && <span>→ {a.territory.name} Territory</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DetailPageTemplate>
    );
  }

  // Render List Mode
  return (
    <ListPageTemplate
      title="User Accounts & Market Bindings"
      subtitle="Enterprise user access, employee binding, RBAC roles, and multi-market coverage."
      breadcrumbs={[{ label: 'Security & Access', href: '#' }, { label: 'Users' }]}
      primaryAction={{
        label: 'Create User (5-Step Wizard)',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setWizardStep(1);
          setFormData({
            employeeOption: 'existing',
            employeeId: '',
            newEmployeeCode: '',
            newEmployeeFirstName: '',
            newEmployeeLastName: '',
            newEmployeePosition: 'Sales Officer',
            newEmployeeDepartment: 'Sales & Distribution',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            password: '',
            companyId: companies[0]?.id || '',
            roleId: roles[0]?.id || '',
            status: 'ACTIVE',
            creditLimit: '',
            targetAmount: '',
            marketAssignments: [],
          });
          setMode('create');
        },
      }}
    >
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '280px' }}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Statuses' },
            { value: 'ACTIVE', label: 'Active Only' },
            { value: 'INACTIVE', label: 'Inactive Only' },
          ]}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Roles' },
            ...roles.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
      </div>

      <DataTable data={filteredUsers} columns={columns} />
    </ListPageTemplate>
  );
};
