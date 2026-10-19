'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CompanyDto, DepartmentDto, PlantDto, BranchDto } from '@shehswar/types';
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
  IconTruck,
} from '../icons';
import { useToast } from '../../context/toast-context';

export const EmployeesView: React.FC = () => {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [plants, setPlants] = useState<PlantDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [agencyFilter, setAgencyFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [empRes, compRes, deptRes, plantRes, branchRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/employees?all=true'),
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/departments?all=true'),
        ApiClient.get<any>('/api/v1/master-data/plants?all=true'),
        ApiClient.get<any>('/api/v1/master-data/branches?all=true'),
      ]);

      const empItems = Array.isArray(empRes) ? empRes : (empRes as any)?.items || (empRes as any)?.data?.items || (empRes as any)?.data || [];
      const compItems = Array.isArray(compRes) ? compRes : (compRes as any)?.items || (compRes as any)?.data?.items || (compRes as any)?.data || [];
      const deptItems = Array.isArray(deptRes) ? deptRes : (deptRes as any)?.items || (deptRes as any)?.data?.items || (deptRes as any)?.data || [];
      const plantItems = Array.isArray(plantRes) ? plantRes : (plantRes as any)?.items || (plantRes as any)?.data?.items || (plantRes as any)?.data || [];
      const branchItems = Array.isArray(branchRes) ? branchRes : (branchRes as any)?.items || (branchRes as any)?.data?.items || (branchRes as any)?.data || [];

      setEmployees(empItems);
      setCompanies(compItems);
      setDepartments(deptItems);
      setPlants(plantItems);
      setBranches(branchItems);
    } catch (err: any) {
      console.error('Error fetching employees data:', err);
      setError(err?.message || 'Failed to load employees from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load detailed employee record with all relations (salaryPayments, vehicleExpenses, etc.)
  const loadEmployeeDetail = async (empId: string) => {
    try {
      setIsLoading(true);
      const res: any = await ApiClient.get<any>(`/api/v1/master-data/employees/${empId}`);
      const employeeData = res?.data || res;
      setSelectedEmployee(employeeData);
      setMode('detail');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to load employee details', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    fatherName: '',
    cnic: '',
    licenseNumber: '',
    address: '',
    agencyType: 'PERMANENT',
    salary: '0',
    email: '',
    phone: '',
    companyId: '',
    departmentId: '',
    plantId: '',
    branchId: '',
    position: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    resignationDate: '',
    terminationDate: '',
    status: 'ACTIVE',
    managerId: '',
  });

  const populateForm = (emp: any) => {
    setFormData({
      employeeCode: emp.employeeCode || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      fatherName: emp.fatherName || '',
      cnic: emp.cnic || '',
      licenseNumber: emp.licenseNumber || '',
      address: emp.address || emp.residentialAddress || '',
      agencyType: emp.agencyType || emp.agencyStaffType || 'PERMANENT',
      salary: String(emp.salary || emp.monthlySalary || '0'),
      email: emp.email || '',
      phone: emp.phone || '',
      companyId: emp.companyId || '',
      departmentId: emp.departmentId || '',
      plantId: emp.plantId || '',
      branchId: emp.branchId || '',
      position: emp.position || '',
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().slice(0, 10) : '',
      resignationDate: emp.resignationDate ? new Date(emp.resignationDate).toISOString().slice(0, 10) : '',
      terminationDate: emp.terminationDate ? new Date(emp.terminationDate).toISOString().slice(0, 10) : '',
      status: emp.status || 'ACTIVE',
      managerId: emp.managerId || '',
    });
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      (e.firstName && e.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.lastName && e.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.employeeCode && e.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.position && e.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.email && e.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.cnic && e.cnic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.licenseNumber && e.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = deptFilter === 'ALL' || e.departmentId === deptFilter;
    const matchesComp = companyFilter === 'ALL' || e.companyId === companyFilter;
    const matchesAgency = agencyFilter === 'ALL' || (e.agencyType || e.agencyStaffType) === agencyFilter;
    return matchesSearch && matchesDept && matchesComp && matchesAgency;
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'code',
      header: 'Employee ID',
      accessorKey: 'employeeCode',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.employeeCode}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Employee Name & Position',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.original.firstName} {row.original.lastName}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.original.position}</div>
          {row.original.cnic && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              CNIC: {row.original.cnic}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Department & Facility',
      cell: ({ row }) => {
        const dept = departments.find((d) => d.id === row.original.departmentId) || row.original.department;
        const comp = companies.find((c) => c.id === row.original.companyId) || row.original.company;
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{dept ? dept.name : 'General Corporate'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comp ? comp.name : 'Shehswar'}</div>
          </div>
        );
      },
    },
    {
      id: 'agency',
      header: 'Type & Salary',
      cell: ({ row }) => {
        const agency = row.original.agencyType || row.original.agencyStaffType || 'PERMANENT';
        const salary = Number(row.original.salary || row.original.monthlySalary || 0);
        const badgeColors: Record<string, string> = {
          PERMANENT: 'var(--color-primary)',
          CONTRACT: 'var(--color-warning)',
          THIRD_PARTY: '#8b5cf6',
          FIELD_STAFF: '#06b6d4',
        };
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  backgroundColor: `${badgeColors[agency] || 'var(--color-primary)'}18`,
                  color: badgeColors[agency] || 'var(--color-primary)',
                }}
              >
                {agency.replace('_', ' ')}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '0.2rem' }}>
              PKR {salary.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>
        );
      },
    },
    {
      id: 'vehicle',
      header: 'Assigned Vehicle',
      cell: ({ row }) => {
        const vehicle = row.original.currentVehicles?.[0];
        if (!vehicle) {
          return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Vehicle</span>;
        }
        return (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#16a34a',
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              <IconTruck size={13} style={{ marginRight: '4px' }} /> {vehicle.vehicleNumber}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {vehicle.vehicleModel}
            </div>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status || 'ACTIVE'} />,
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
            onClick={() => loadEmployeeDetail(row.original.id)}
          >
            Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedEmployee(row.original);
              populateForm(row.original);
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
    if (!formData.firstName || !formData.employeeCode || !formData.position) {
      showToast({ title: 'Validation Error', message: 'Employee code, first name, and position are required', type: 'error' });
      return;
    }

    const selectedCompId = formData.companyId || companies[0]?.id;
    if (!selectedCompId) {
      showToast({ title: 'Validation Error', message: 'Please select an Operating Company', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        employeeCode: formData.employeeCode.toUpperCase(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        fatherName: formData.fatherName || undefined,
        cnic: formData.cnic || undefined,
        licenseNumber: formData.licenseNumber || undefined,
        address: formData.address || undefined,
        agencyType: formData.agencyType || 'PERMANENT',
        salary: Number(formData.salary) || 0,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        companyId: selectedCompId,
        departmentId: formData.departmentId || undefined,
        plantId: formData.plantId || undefined,
        branchId: formData.branchId || undefined,
        position: formData.position,
        joiningDate: new Date(formData.joiningDate || Date.now()).toISOString(),
        resignationDate: formData.resignationDate ? new Date(formData.resignationDate).toISOString() : undefined,
        terminationDate: formData.terminationDate ? new Date(formData.terminationDate).toISOString() : undefined,
        status: formData.status,
        managerId: formData.managerId || undefined,
      };

      if (mode === 'create') {
        await ApiClient.post('/api/v1/master-data/employees', payload);
        showToast({ title: 'Success', message: `Employee ${formData.firstName} ${formData.lastName} registered`, type: 'success' });
      } else if (mode === 'edit' && selectedEmployee) {
        await ApiClient.patch(`/api/v1/master-data/employees/${selectedEmployee.id}`, payload);
        showToast({ title: 'Updated', message: 'Employee file updated successfully', type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save employee record', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Form Mode
  if (mode === 'create' || mode === 'edit') {
    const activeCompanyId = formData.companyId || companies.find((c) => departments.some((d) => d.companyId === c.id))?.id || companies[0]?.id || '';

    const deptOptions = [
      { value: '', label: 'None / General Corporate' },
      ...departments
        .map((d) => {
          const comp = companies.find((c) => c.id === d.companyId);
          const isCurrent = !activeCompanyId || d.companyId === activeCompanyId;
          return {
            value: d.id,
            label: `${d.code} - ${d.name}`,
            subtext: comp ? `Entity: ${comp.name}` : undefined,
            badge: isCurrent && activeCompanyId ? 'Selected Co.' : undefined,
            isCurrent,
          };
        })
        .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0)),
    ];

    const branchOptions = [
      { value: '', label: 'None (Head Office / Non-Branch)' },
      ...branches
        .map((b) => {
          const comp = companies.find((c) => c.id === b.companyId);
          const isCurrent = !activeCompanyId || b.companyId === activeCompanyId;
          return {
            value: b.id,
            label: `${b.code} - ${b.name}`,
            subtext: [b.city, comp ? comp.name : null].filter(Boolean).join(' • '),
            badge: b.city || (isCurrent && activeCompanyId ? 'Selected Co.' : undefined),
            isCurrent,
          };
        })
        .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0)),
    ];

    const plantOptions = [
      { value: '', label: 'None (Corporate HQ / Non-Plant)' },
      ...plants
        .map((p) => {
          const comp = companies.find((c) => c.id === p.companyId);
          const isCurrent = !activeCompanyId || p.companyId === activeCompanyId;
          return {
            value: p.id,
            label: `${p.code} - ${p.name}`,
            subtext: [p.location, comp ? comp.name : null].filter(Boolean).join(' • '),
            badge: isCurrent && activeCompanyId ? 'Selected Co.' : undefined,
            isCurrent,
          };
        })
        .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0)),
    ];

    const eligibleManagers = employees.filter((e) => mode === 'create' || e.id !== selectedEmployee?.id);

    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Enterprise Employee' : `Edit ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
        subtitle="Manage employee personnel profile, licensing, compensation, and organizational placement."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Employees', href: '#' },
          { label: mode === 'create' ? 'Register' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSave}
        isSubmitting={isSubmitting}
        submitLabel={mode === 'create' ? 'Register Employee' : 'Save Changes'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Personal & Identification */}
          <Card>
            <CardHeader>
              <CardTitle>Personal & Identification Profile</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Employee ID / Code *"
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                placeholder="e.g. SH-EMP-007"
                disabled={mode === 'edit'}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="First Name *"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. Tariq"
                />
                <Input
                  label="Last Name *"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Mehmood"
                />
              </div>
              <Input
                label="Father Name"
                value={formData.fatherName}
                onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                placeholder="Father's full name"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="CNIC Number"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="35201-XXXXXXX-X"
                />
                <Input
                  label="Driving License #"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  placeholder="DL-LHR-XXXXX"
                />
              </div>
              <Input
                label="Residential Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Residential street, area, city"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Corporate Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@shehswar.com"
                />
                <Input
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+92 300 0000000"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Organization & Placement */}
          <Card>
            <CardHeader>
              <CardTitle>Organization & Hierarchy</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Select
                label="Operating Company *"
                value={formData.companyId || companies[0]?.id || ''}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Department"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                options={deptOptions}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Select
                  label="Posted Plant (Optional)"
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                  options={plantOptions}
                />
                <Select
                  label="Posted Branch (Optional)"
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  options={branchOptions}
                />
              </div>
              <Select
                label="Reporting Manager (Optional)"
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                options={[
                  { value: '', label: 'None / Executive Board' },
                  ...eligibleManagers.map((e) => ({
                    value: e.id,
                    label: `${e.employeeCode} - ${e.firstName} ${e.lastName} (${e.position})`,
                  })),
                ]}
              />
            </CardContent>
          </Card>

          {/* Card 3: Employment Terms, Staff Type & Compensation */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader>
              <CardTitle>Employment Terms, Compensation & Lifecycle</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <Input
                label="Position / Designation *"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Sales Officer / Field Executive"
              />
              <Select
                label="Staff / Agency Classification"
                value={formData.agencyType}
                onChange={(e) => setFormData({ ...formData, agencyType: e.target.value })}
                options={[
                  { value: 'PERMANENT', label: 'Permanent Direct Employee' },
                  { value: 'CONTRACT', label: 'Fixed-Term Contract' },
                  { value: 'THIRD_PARTY', label: 'Third-Party Agency Staff' },
                  { value: 'FIELD_STAFF', label: 'Field Marketing / Sales Staff' },
                ]}
              />
              <Input
                label="Monthly Salary (PKR)"
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                placeholder="e.g. 85000"
              />
              <Select
                label="Employment Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'ACTIVE', label: 'Active Service' },
                  { value: 'ON_LEAVE', label: 'On Leave' },
                  { value: 'RESIGNED', label: 'Resigned' },
                  { value: 'TERMINATED', label: 'Terminated / Separated' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
              <Input
                label="Joining Date"
                type="date"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              />
              <Input
                label="Resignation Date (Optional)"
                type="date"
                value={formData.resignationDate}
                onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
              />
              <Input
                label="Termination Date (Optional)"
                type="date"
                value={formData.terminationDate}
                onChange={(e) => setFormData({ ...formData, terminationDate: e.target.value })}
              />
            </CardContent>
          </Card>
        </div>
      </FormPageTemplate>
    );
  }

  // Render Detail Mode
  if (mode === 'detail' && selectedEmployee) {
    const comp = companies.find((c) => c.id === selectedEmployee.companyId) || selectedEmployee.company;
    const dept = departments.find((d) => d.id === selectedEmployee.departmentId) || selectedEmployee.department;
    const plant = plants.find((p) => p.id === selectedEmployee.plantId) || selectedEmployee.plant;
    const branch = branches.find((b) => b.id === selectedEmployee.branchId) || selectedEmployee.branch;
    const manager = employees.find((e) => e.id === selectedEmployee.managerId) || selectedEmployee.manager;
    const currentVehicle = selectedEmployee.currentVehicles?.[0];
    const assignments = selectedEmployee.vehicleAssignments || [];
    const salaryPayments = selectedEmployee.salaryPayments || [];
    const fuelExpenses = selectedEmployee.vehicleExpenses || [];

    return (
      <DetailPageTemplate
        title={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
        subtitle={`${selectedEmployee.position} • Code: ${selectedEmployee.employeeCode} • ${comp?.name || 'Shehswar Group'}`}
        status={selectedEmployee.status || 'ACTIVE'}
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Employees', href: '#' },
          { label: selectedEmployee.employeeCode },
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
                populateForm(selectedEmployee);
                setMode('edit');
              }}
            >
              Edit Profile
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'personal',
            label: 'Personnel Profile',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Employee ID:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedEmployee.employeeCode}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Full Name:</span>
                      <span style={{ fontWeight: 600 }}>{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Father's Name:</span>
                      <span style={{ fontWeight: 500 }}>{selectedEmployee.fatherName || 'Not recorded'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>CNIC:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedEmployee.cnic || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Driving License #:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedEmployee.licenseNumber || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Residential Address:</span>
                      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{selectedEmployee.address || selectedEmployee.residentialAddress || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Communication & Contact</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Official Email:</span>
                      <span style={{ fontWeight: 500 }}>{selectedEmployee.email || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                      <span style={{ fontWeight: 500 }}>{selectedEmployee.phone || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Company:</span>
                      <span style={{ fontWeight: 600 }}>{comp?.name || 'Shehswar Group'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                      <span style={{ fontWeight: 500 }}>{dept ? dept.name : 'General Corporate'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Facility / Branch:</span>
                      <span style={{ fontWeight: 500 }}>{plant?.name || branch?.name || 'Headquarters'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Reporting Manager:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {manager ? `${manager.firstName} ${manager.lastName} (${manager.position || manager.employeeCode})` : 'Executive Leadership'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'employment',
            label: 'Employment & Compensation',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Contract & Compensation Terms</CardTitle>
                  </CardHeader>
                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Designation:</span>
                      <span style={{ fontWeight: 600 }}>{selectedEmployee.position}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Staff Classification:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {(selectedEmployee.agencyType || selectedEmployee.agencyStaffType || 'PERMANENT').replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Monthly Salary:</span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>
                        PKR {Number(selectedEmployee.salary || selectedEmployee.monthlySalary || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Joining Date:</span>
                      <span style={{ fontWeight: 500 }}>
                        {selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Resignation Date:</span>
                      <span style={{ fontWeight: 500 }}>
                        {selectedEmployee.resignationDate ? new Date(selectedEmployee.resignationDate).toLocaleDateString() : 'N/A (Active)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Termination Date:</span>
                      <span style={{ fontWeight: 500 }}>
                        {selectedEmployee.terminationDate ? new Date(selectedEmployee.terminationDate).toLocaleDateString() : 'N/A (Active)'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'vehicle',
            label: 'Assigned Vehicle & Custody',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Current Vehicle In Custody</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentVehicle ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1.25rem',
                          background: 'rgba(34, 197, 94, 0.05)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          borderRadius: '8px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                            🚗 {currentVehicle.vehicleNumber}
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                            {currentVehicle.vehicleModel} ({currentVehicle.modelYear || 'Year N/A'})
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Fuel Type: {currentVehicle.fuelType || 'PETROL'} • Status: {currentVehicle.status} • Odometer: {Number(currentVehicle.currentOdometer || 0).toLocaleString()} KM
                          </div>
                        </div>
                        <StatusBadge status="ACTIVE" />
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No vehicle currently assigned to this employee.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {assignments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Fleet Assignment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.75rem' }}>Vehicle</th>
                            <th style={{ padding: '0.75rem' }}>Type</th>
                            <th style={{ padding: '0.75rem' }}>Assigned Date</th>
                            <th style={{ padding: '0.75rem' }}>Start Odometer</th>
                            <th style={{ padding: '0.75rem' }}>Returned Date</th>
                            <th style={{ padding: '0.75rem' }}>Return Odometer</th>
                            <th style={{ padding: '0.75rem' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignments.map((a: any) => (
                            <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.75rem', fontWeight: 600, fontFamily: 'monospace' }}>
                                {a.vehicle?.vehicleNumber || 'Vehicle'}
                              </td>
                              <td style={{ padding: '0.75rem' }}>{a.assignmentType}</td>
                              <td style={{ padding: '0.75rem' }}>{new Date(a.assignmentDate).toLocaleDateString()}</td>
                              <td style={{ padding: '0.75rem' }}>{a.startOdometer ? `${Number(a.startOdometer).toLocaleString()} KM` : '-'}</td>
                              <td style={{ padding: '0.75rem' }}>{a.returnDate ? new Date(a.returnDate).toLocaleDateString() : 'Active'}</td>
                              <td style={{ padding: '0.75rem' }}>{a.endOdometer ? `${Number(a.endOdometer).toLocaleString()} KM` : '-'}</td>
                              <td style={{ padding: '0.75rem' }}><StatusBadge status={a.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </div>
            ),
          },
          {
            id: 'salaries',
            label: 'Salary Disbursements Log',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Payroll Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {salaryPayments.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No salary disbursements recorded yet for this employee.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem' }}>Voucher #</th>
                          <th style={{ padding: '0.75rem' }}>Period</th>
                          <th style={{ padding: '0.75rem' }}>Payment Date</th>
                          <th style={{ padding: '0.75rem' }}>Base Salary</th>
                          <th style={{ padding: '0.75rem' }}>Allowances</th>
                          <th style={{ padding: '0.75rem' }}>Deductions</th>
                          <th style={{ padding: '0.75rem' }}>Net Paid</th>
                          <th style={{ padding: '0.75rem' }}>Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryPayments.map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                              {p.paymentNumber}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              {p.salaryMonth}/{p.salaryYear}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                            <td style={{ padding: '0.75rem' }}>PKR {Number(p.baseSalary).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', color: '#16a34a' }}>+PKR {Number(p.allowances || 0).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', color: '#dc2626' }}>-PKR {Number(p.deductions || 0).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>PKR {Number(p.netSalary).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-card-subtle)' }}>
                                {p.paymentMethod}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'fuel',
            label: 'Fuel & Vehicle Expenses',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Fuel & Maintenance Expense Log</CardTitle>
                </CardHeader>
                <CardContent>
                  {fuelExpenses.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No vehicle expenses recorded for this employee.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem' }}>Voucher #</th>
                          <th style={{ padding: '0.75rem' }}>Date</th>
                          <th style={{ padding: '0.75rem' }}>Type</th>
                          <th style={{ padding: '0.75rem' }}>Liters / Qty</th>
                          <th style={{ padding: '0.75rem' }}>Rate (PKR)</th>
                          <th style={{ padding: '0.75rem' }}>Total Cost</th>
                          <th style={{ padding: '0.75rem' }}>Fuel Station / Vendor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fuelExpenses.map((exp: any) => (
                          <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                              {exp.expenseNumber}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                            <td style={{ padding: '0.75rem' }}>{exp.expenseType}</td>
                            <td style={{ padding: '0.75rem' }}>{exp.quantity ? `${exp.quantity} L` : '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{exp.unitPrice ? `PKR ${exp.unitPrice}` : '-'}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                              PKR {Number(exp.totalAmount).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{exp.fuelStation || exp.vendorName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      title="Employee Master Registry"
      subtitle="Corporate staff, plant chemists, warehouse personnel, commercial field executives, and fleet custodians."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Employees' }]}
      primaryAction={{
        label: 'Register Employee',
        icon: <IconPlus size={16} />,
        onClick: () => {
          const defaultCompany =
            companies.find((c) => departments.some((d) => d.companyId === c.id))?.id ||
            companies[0]?.id ||
            '';
          setFormData({
            employeeCode: '',
            firstName: '',
            lastName: '',
            fatherName: '',
            cnic: '',
            licenseNumber: '',
            address: '',
            agencyType: 'PERMANENT',
            salary: '0',
            email: '',
            phone: '',
            companyId: defaultCompany,
            departmentId: '',
            plantId: '',
            branchId: '',
            position: '',
            joiningDate: new Date().toISOString().slice(0, 10),
            resignationDate: '',
            terminationDate: '',
            status: 'ACTIVE',
            managerId: '',
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
          label: 'Export Records',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Generated', message: 'Employees exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Employees" value={employees.length} icon={<IconBuildings size={20} />} />
        <KpiCard
          title="Active Personnel"
          value={employees.filter((e) => e.status === 'ACTIVE').length}
          icon={<IconCheck size={20} />}
          status="positive"
        />
        <KpiCard
          title="Field & Commercial Staff"
          value={employees.filter((e) => (e.agencyType || e.agencyStaffType) === 'FIELD_STAFF' || (e.position || '').toLowerCase().includes('sales')).length}
          icon={<IconCheck size={20} />}
        />
        <KpiCard
          title="Vehicle Custodians"
          value={employees.filter((e) => e.currentVehicles && e.currentVehicles.length > 0).length}
          icon={<IconBuildings size={20} />}
        />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Search by ID, name, position, CNIC, or license..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Companies' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Staff Types' },
                { value: 'PERMANENT', label: 'Permanent' },
                { value: 'CONTRACT', label: 'Contract' },
                { value: 'THIRD_PARTY', label: 'Third-Party' },
                { value: 'FIELD_STAFF', label: 'Field Staff' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Employees"
          message={error}
          onRetry={fetchData}
        />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          title="No Employees Found"
          description="Register personnel records to establish organizational hierarchy, vehicle custodianship, and payroll."
          actionLabel="Register Employee"
          onAction={() => {
            const defaultCompany =
              companies.find((c) => departments.some((d) => d.companyId === c.id))?.id ||
              companies[0]?.id ||
              '';
            setFormData({
              employeeCode: '',
              firstName: '',
              lastName: '',
              fatherName: '',
              cnic: '',
              licenseNumber: '',
              address: '',
              agencyType: 'PERMANENT',
              salary: '0',
              email: '',
              phone: '',
              companyId: defaultCompany,
              departmentId: '',
              plantId: '',
              branchId: '',
              position: '',
              joiningDate: new Date().toISOString().slice(0, 10),
              resignationDate: '',
              terminationDate: '',
              status: 'ACTIVE',
              managerId: '',
            });
            setMode('create');
          }}
        />
      ) : (
        <DataTable columns={columns} data={filteredEmployees} />
      )}
    </ListPageTemplate>
  );
};
