'use client';

/**
 * SHEHSWAR ONE360 - Vehicles & Fleet Management UI
 *
 * Implements enterprise fleet management matching Sales Orders design system:
 * - ListPageTemplate canonical structure
 * - KpiCard metrics with standard SVG icon components (no emojis)
 * - Clean tab navigation across Master, Custody Report, and Fuel GL Vouchers
 * - StatusBadge and DataTable design standards
 * - Production Modal components with complete form controls
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ListPageTemplate } from '../templates';
import {
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
  Modal,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconRefresh,
  IconDownload,
  IconSearch,
  IconCheck,
  IconAlertTriangle,
  IconTruck,
  IconFuel,
  IconUser,
  IconUsers,
  IconEye,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export const VehiclesView: React.FC = () => {
  const { showToast } = useToast();
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    showToast({ title: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice', message, type });
  };

  const [activeTab, setActiveTab] = useState<'fleet' | 'current-report' | 'fuel-expenses'>('fleet');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Selected vehicle for modal actions
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [vehicleDetail, setVehicleDetail] = useState<any | null>(null);

  // Form states
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    companyId: '',
    vehicleModel: '',
    registrationYear: new Date().getFullYear(),
    engineNumber: '',
    chassisNumber: '',
    status: 'AVAILABLE',
    currentLocation: 'Head Office',
    notes: '',
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    assignmentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    returnReason: 'Routine Handover',
    returnCondition: 'Good Condition / Serviced',
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    vehicleId: '',
    employeeId: '',
    expenseType: 'FUEL',
    expenseDate: new Date().toISOString().split('T')[0],
    fuelStation: '',
    quantity: 60,
    rate: 285,
    paymentMethod: 'CASH',
    remarks: '',
  });

  // Fetch Companies and Employees for dropdowns
  const fetchAuxiliaryData = async () => {
    try {
      const [compRes, empRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies?all=true'),
        ApiClient.get<any>('/api/v1/master-data/employees?all=true'),
      ]);

      const compData = Array.isArray(compRes)
        ? compRes
        : (compRes as any)?.data || (compRes as any)?.items || [];
      const empData = Array.isArray(empRes)
        ? empRes
        : (empRes as any)?.data || (empRes as any)?.items || [];

      setCompanies(compData);
      setEmployees(empData);
      if (compData.length > 0 && !vehicleForm.companyId) {
        setVehicleForm((prev) => ({ ...prev, companyId: compData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load auxiliary data', err);
    }
  };

  // Fetch Vehicles
  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId !== 'ALL') params.set('companyId', selectedCompanyId);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res: any = await ApiClient.get<any>(`/api/v1/vehicles?${params.toString()}`);
      const data = Array.isArray(res) ? res : res?.data || res?.items || [];
      setVehicles(data);
    } catch (err) {
      notify('Failed to fetch vehicles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Current Assignments Report
  const fetchCurrentAssignments = async () => {
    try {
      const params = selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res: any = await ApiClient.get<any>(`/api/v1/vehicles/reports/current-assignment${params}`);
      const data = Array.isArray(res) ? res : res?.data || res?.items || [];
      setCurrentAssignments(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Fuel & Maintenance Expenses
  const fetchExpenses = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId !== 'ALL') params.set('companyId', selectedCompanyId);
      const res: any = await ApiClient.get<any>(`/api/v1/vehicles/expenses/list?${params.toString()}`);
      const data = Array.isArray(res) ? res : res?.data || res?.items || [];
      setExpenses(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    fetchVehicles();
    fetchCurrentAssignments();
    fetchExpenses();
  }, [selectedCompanyId, statusFilter]);

  // View Vehicle Detail Drill-down
  const handleOpenDetail = async (vehicle: any) => {
    try {
      const res: any = await ApiClient.get<any>(`/api/v1/vehicles/${vehicle.id}`);
      const data = res?.data || res;
      setVehicleDetail(data);
      setIsDetailModalOpen(true);
    } catch (err) {
      notify('Failed to load vehicle details', 'error');
    }
  };

  // Handle Add Vehicle Submit
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.vehicleNumber.trim()) {
      notify('Please enter a vehicle number', 'error');
      return;
    }

    const targetCompanyId = vehicleForm.companyId || companies[0]?.id;
    if (!targetCompanyId) {
      notify('Please select an operating company', 'error');
      return;
    }

    try {
      await ApiClient.post('/api/v1/vehicles', {
        ...vehicleForm,
        companyId: targetCompanyId,
      });

      notify(`Vehicle ${vehicleForm.vehicleNumber.toUpperCase()} added successfully!`, 'success');
      setIsAddVehicleOpen(false);
      setVehicleForm({
        vehicleNumber: '',
        companyId: companies[0]?.id || '',
        vehicleModel: '',
        registrationYear: new Date().getFullYear(),
        engineNumber: '',
        chassisNumber: '',
        status: 'AVAILABLE',
        currentLocation: 'Head Office',
        notes: '',
      });
      fetchVehicles();
      fetchCurrentAssignments();
    } catch (err: any) {
      notify(err?.message || 'Failed to create vehicle', 'error');
    }
  };

  // Handle Vehicle Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !assignForm.employeeId) {
      notify('Please select an employee', 'error');
      return;
    }

    try {
      await ApiClient.post(`/api/v1/vehicles/${selectedVehicle.id}/assign`, assignForm);
      notify(`Vehicle ${selectedVehicle.vehicleNumber} successfully assigned!`, 'success');
      setIsAssignModalOpen(false);
      fetchVehicles();
      fetchCurrentAssignments();
    } catch (err: any) {
      notify(err?.message || 'Error during assignment', 'error');
    }
  };

  // Handle Vehicle Return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    try {
      await ApiClient.post(`/api/v1/vehicles/${selectedVehicle.id}/return`, returnForm);
      notify(`Vehicle ${selectedVehicle.vehicleNumber} returned to Head Office!`, 'success');
      setIsReturnModalOpen(false);
      fetchVehicles();
      fetchCurrentAssignments();
    } catch (err: any) {
      notify(err?.message || 'Error during return', 'error');
    }
  };

  // Handle Fuel/Vehicle Expense Submit
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const total = Math.round(Number(expenseForm.quantity) * Number(expenseForm.rate) * 100) / 100;

    try {
      await ApiClient.post('/api/v1/vehicles/expenses', {
        ...expenseForm,
        vehicleId: selectedVehicle.id,
        employeeId: selectedVehicle.currentEmployeeId || undefined,
        companyId: selectedVehicle.companyId,
        totalAmount: total,
      });

      notify(`Fuel expense of PKR ${total.toLocaleString()} posted to GL!`, 'success');
      setIsExpenseModalOpen(false);
      fetchExpenses();
      fetchVehicles();
    } catch (err: any) {
      notify(err?.message || 'Failed to record expense', 'error');
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = vehicles.length;
    const assigned = vehicles.filter((v) => v.status === 'ASSIGNED').length;
    const available = vehicles.filter((v) => v.status === 'AVAILABLE').length;
    const maintenance = vehicles.filter((v) => v.status === 'UNDER_MAINTENANCE').length;
    const totalFuelCost = expenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    return { total, assigned, available, maintenance, totalFuelCost };
  }, [vehicles, expenses]);

  // Helper for Status Badge Variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return 'success';
      case 'AVAILABLE':
        return 'info';
      case 'UNDER_MAINTENANCE':
        return 'warning';
      case 'SOLD':
      case 'INACTIVE':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <ListPageTemplate
      title="Vehicles & Fleet Management"
      subtitle="Enterprise fleet tracking, vehicle custody assignments, return logs, and fuel expense accounting."
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => {
              fetchVehicles();
              fetchCurrentAssignments();
              fetchExpenses();
            }}
          >
            <IconRefresh size={16} /> Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (companies.length > 0 && !vehicleForm.companyId) {
                setVehicleForm((prev) => ({ ...prev, companyId: companies[0].id }));
              }
              setIsAddVehicleOpen(true);
            }}
          >
            <IconPlus size={16} /> Add Vehicle
          </Button>
        </div>
      }
    >
      {/* 5 Executive KPI Metrics Cards matching SalesOrdersView */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Fleet Vehicles"
          value={kpis.total}
          subtitle="Across all group companies"
          icon={<IconTruck size={20} />}
        />
        <KpiCard
          title="Active Custody"
          value={kpis.assigned}
          subtitle="With field officers & staff"
          icon={<IconUsers size={20} />}
        />
        <KpiCard
          title="Available In Yard"
          value={kpis.available}
          subtitle="Ready for deployment"
          icon={<IconCheck size={20} />}
        />
        <KpiCard
          title="Under Maintenance"
          value={kpis.maintenance}
          subtitle="Service & repair depot"
          icon={<IconAlertTriangle size={20} />}
        />
        <KpiCard
          title="Total Fuel Expenses"
          value={`PKR ${kpis.totalFuelCost.toLocaleString()}`}
          subtitle="GL Account 606000"
          icon={<IconFuel size={20} />}
        />
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => setActiveTab('fleet')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'fleet' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'fleet' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconTruck size={16} /> Vehicle Master & Fleet List
        </button>

        <button
          onClick={() => setActiveTab('current-report')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'current-report' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'current-report' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconUsers size={16} /> Current Custodian Report
        </button>

        <button
          onClick={() => setActiveTab('fuel-expenses')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'fuel-expenses' ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
            color: activeTab === 'fuel-expenses' ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <IconFuel size={16} /> Fuel & Petrol Vouchers (GL)
        </button>
      </div>

      {/* Filter Toolbar matching SalesOrdersView */}
      <Card style={{ marginBottom: '20px' }}>
        <CardContent style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                placeholder="Search by Vehicle #, Model, Engine, Chassis..."
                startIcon={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVehicles()}
              />
            </div>

            <div style={{ minWidth: '200px' }}>
              <Select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                options={[
                  { label: 'All Group Companies', value: 'ALL' },
                  ...companies.map((c) => ({
                    label: `${c.name} (${c.code})`,
                    value: c.id,
                  })),
                ]}
              />
            </div>

            {activeTab === 'fleet' && (
              <div style={{ minWidth: '180px' }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { label: 'All Statuses', value: 'ALL' },
                    { label: 'AVAILABLE (Yard)', value: 'AVAILABLE' },
                    { label: 'ASSIGNED (Staff)', value: 'ASSIGNED' },
                    { label: 'UNDER MAINTENANCE', value: 'UNDER_MAINTENANCE' },
                    { label: 'INACTIVE', value: 'INACTIVE' },
                    { label: 'SOLD', value: 'SOLD' },
                  ]}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TAB 1: FLEET LIST */}
      {activeTab === 'fleet' && (
        <Card>
          <CardContent style={{ padding: 0 }}>
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : vehicles.length === 0 ? (
              <EmptyState
                title="No Vehicles Registered"
                description="No fleet vehicles found matching your criteria. Click 'Add Vehicle' to register your first vehicle."
                actionLabel="Add Vehicle"
                onAction={() => setIsAddVehicleOpen(true)}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Vehicle #</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Company</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Model / Year</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Engine & Chassis</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Custodian</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Location</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '240px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr
                        key={v.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background-color 0.1s ease' }}
                        onClick={() => handleOpenDetail(v)}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-primary, #1e40af)', fontFamily: 'monospace' }}>
                          {v.vehicleNumber}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{v.company?.name || v.companyName}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{v.vehicleModel}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reg Year: {v.registrationYear}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'monospace' }}>
                          <div>Eng: {v.engineNumber || '-'}</div>
                          <div>Chas: {v.chassisNumber || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={v.status} variant={getStatusBadgeVariant(v.status)}>
                            {v.status === 'ASSIGNED'
                              ? `ASSIGNED (${v.currentEmployee?.firstName || 'STAFF'})`
                              : v.status}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {v.currentEmployee ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {v.currentEmployee.firstName} {v.currentEmployee.lastName}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Code: {v.currentEmployee.employeeCode} | {v.currentEmployee.position}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              None (Head Office Yard)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>{v.currentLocation || 'Head Office'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenDetail(v)}
                              title="View Full History Timeline"
                            >
                              <IconEye size={14} /> Detail
                            </Button>

                            {v.status === 'AVAILABLE' ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsAssignModalOpen(true);
                                }}
                              >
                                <IconUser size={14} /> Assign
                              </Button>
                            ) : v.status === 'ASSIGNED' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsReturnModalOpen(true);
                                }}
                                style={{ color: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
                              >
                                Return
                              </Button>
                            ) : null}

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsExpenseModalOpen(true);
                              }}
                              title="Record Fuel / Maintenance Voucher"
                            >
                              <IconFuel size={14} /> + Fuel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: CURRENT CUSTODIAN REPORT */}
      {activeTab === 'current-report' && (
        <Card>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle>Vehicle Current Custodian Report</CardTitle>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Live active assignment directory answering: &quot;Which vehicle is currently with which employee?&quot;
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <IconDownload size={14} /> Print / Export
            </Button>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {currentAssignments.length === 0 ? (
              <EmptyState
                title="No Active Assignments"
                description="All fleet vehicles are currently returned and available at Head Office yard."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Vehicle Number</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Model</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Reg. Year</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Current Custodian</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Employee ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Assignment Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAssignments.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-primary, #1e40af)', fontFamily: 'monospace' }}>
                          {row.vehicleNumber}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.companyName}</td>
                        <td style={{ padding: '12px 16px' }}>{row.model}</td>
                        <td style={{ padding: '12px 16px' }}>{row.registrationYear}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.currentEmployee}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{row.employeeId}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {row.assignmentDate ? new Date(row.assignmentDate).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={row.status} variant={getStatusBadgeVariant(row.status)}>
                            {row.status}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: FUEL & EXPENSES */}
      {activeTab === 'fuel-expenses' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fuel & Maintenance Expense Log (Account 606000)</CardTitle>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Authoritative vehicle fuel vouchers with automated double-entry GL journal posting.
              </p>
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {expenses.length === 0 ? (
              <EmptyState
                title="No Fuel Expenses Logged"
                description="Select a vehicle from the fleet list and click '+ Fuel' to log fuel and maintenance vouchers."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Voucher #</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Vehicle</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Custodian / Driver</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Fuel Station</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Quantity</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Rate (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total (PKR)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px' }}>{new Date(e.expenseDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                          {e.voucherNumber}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{e.vehicle?.vehicleNumber}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{e.fuelStation || 'Local Station'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {Number(e.quantity).toLocaleString()} L
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          PKR {Number(e.rate).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-primary, #1e40af)' }}>
                          PKR {Number(e.totalAmount).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: e.paymentMethod === 'BANK' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: e.paymentMethod === 'BANK' ? '#0284c7' : '#10b981',
                            }}
                          >
                            {e.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {e.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: ADD NEW VEHICLE */}
      <Modal
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        title="Add New Vehicle to Fleet"
        description="Register a new fleet asset with ownership company, engine details, and initial custody location."
        size="lg"
      >
        <form onSubmit={handleAddVehicleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Vehicle Number *
              </label>
              <Input
                required
                placeholder="e.g. ABC-123"
                value={vehicleForm.vehicleNumber}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Company *
              </label>
              <Select
                value={vehicleForm.companyId}
                onChange={(e) => setVehicleForm({ ...vehicleForm, companyId: e.target.value })}
                options={
                  companies.length > 0
                    ? companies.map((c) => ({
                        label: `${c.name} (${c.code})`,
                        value: c.id,
                      }))
                    : [{ label: 'Loading companies...', value: '' }]
                }
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Vehicle Model *
              </label>
              <Input
                required
                placeholder="e.g. Toyota Corolla GLi / Honda Civic"
                value={vehicleForm.vehicleModel}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleModel: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Registration Year *
              </label>
              <Input
                type="number"
                required
                value={vehicleForm.registrationYear}
                onChange={(e) => setVehicleForm({ ...vehicleForm, registrationYear: Number(e.target.value) })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Engine Number
              </label>
              <Input
                placeholder="e.g. 1NR-FE-12903"
                value={vehicleForm.engineNumber}
                onChange={(e) => setVehicleForm({ ...vehicleForm, engineNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Chassis Number
              </label>
              <Input
                placeholder="e.g. NZE140-908234"
                value={vehicleForm.chassisNumber}
                onChange={(e) => setVehicleForm({ ...vehicleForm, chassisNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Initial Status
              </label>
              <Select
                value={vehicleForm.status}
                onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                options={[
                  { label: 'AVAILABLE (Head Office Yard)', value: 'AVAILABLE' },
                  { label: 'UNDER MAINTENANCE', value: 'UNDER_MAINTENANCE' },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Current Location
              </label>
              <Input
                value={vehicleForm.currentLocation}
                onChange={(e) => setVehicleForm({ ...vehicleForm, currentLocation: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Notes / Remarks
            </label>
            <Textarea
              value={vehicleForm.notes}
              onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
              rows={2}
              placeholder="Optional vehicle remarks or equipment notes..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsAddVehicleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Vehicle
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ASSIGN VEHICLE */}
      {selectedVehicle && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Assign Vehicle: ${selectedVehicle.vehicleNumber}`}
          description="Hand over vehicle custody to an active employee with timestamped tracking."
          size="md"
        >
          <form onSubmit={handleAssignSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Vehicle
                </label>
                <Input
                  disabled
                  value={`${selectedVehicle.vehicleNumber} - ${selectedVehicle.vehicleModel} (${selectedVehicle.companyName || selectedVehicle.company?.name})`}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Assign To Employee *
                </label>
                <Select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  options={[
                    { label: '-- Select Employee --', value: '' },
                    ...employees.map((emp) => ({
                      label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.position}`,
                      value: emp.id,
                    })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Assignment Date *
                </label>
                <Input
                  type="date"
                  required
                  value={assignForm.assignmentDate}
                  onChange={(e) => setAssignForm({ ...assignForm, assignmentDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Handover Notes / Reason
                </label>
                <Textarea
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Field territory allocation, documents and keys handed over."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" type="button" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Confirm Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: RETURN VEHICLE */}
      {selectedVehicle && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          title={`Return Vehicle: ${selectedVehicle.vehicleNumber}`}
          description="Log return of vehicle custody back to Head Office yard with condition inspection."
          size="md"
        >
          <form onSubmit={handleReturnSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Current Custodian
                </label>
                <Input
                  disabled
                  value={
                    selectedVehicle.currentEmployee
                      ? `${selectedVehicle.currentEmployee.firstName} ${selectedVehicle.currentEmployee.lastName} (${selectedVehicle.currentEmployee.employeeCode})`
                      : 'None (Head Office Yard)'
                  }
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Return Date *
                </label>
                <Input
                  type="date"
                  required
                  value={returnForm.returnDate}
                  onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Return Reason *
                </label>
                <Input
                  required
                  value={returnForm.returnReason}
                  onChange={(e) => setReturnForm({ ...returnForm, returnReason: e.target.value })}
                  placeholder="e.g. Role change, resignation, scheduled maintenance"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Vehicle Condition Inspection
                </label>
                <Textarea
                  value={returnForm.returnCondition}
                  onChange={(e) => setReturnForm({ ...returnForm, returnCondition: e.target.value })}
                  rows={2}
                  placeholder="Physical condition, odometer reading, fuel level..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" type="button" onClick={() => setIsReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                style={{ backgroundColor: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
              >
                Confirm Return to Head Office
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: RECORD FUEL / EXPENSE */}
      {selectedVehicle && (
        <Modal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          title={`Record Fuel / Expense: ${selectedVehicle.vehicleNumber}`}
          description="Log quantity, rate, and automatically post fuel expense journal entry to General Ledger."
          size="md"
        >
          <form onSubmit={handleExpenseSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Date *
                </label>
                <Input
                  type="date"
                  required
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Payment Method *
                </label>
                <Select
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                  options={[
                    { label: 'Cash on Hand (Account 101000)', value: 'CASH' },
                    { label: 'Operating Bank Account (Account 102000)', value: 'BANK' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Fuel Station
                </label>
                <Input
                  placeholder="e.g. PSO Main Bypass"
                  value={expenseForm.fuelStation}
                  onChange={(e) => setExpenseForm({ ...expenseForm, fuelStation: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Expense Type
                </label>
                <Select
                  value={expenseForm.expenseType}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                  options={[
                    { label: 'FUEL / PETROL / DIESEL', value: 'FUEL' },
                    { label: 'PERIODIC SERVICE', value: 'MAINTENANCE' },
                    { label: 'REPAIR & PARTS', value: 'REPAIR' },
                    { label: 'TOLL / MOTORWAY TAX', value: 'TOLL_TAX' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Quantity (Liters) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={expenseForm.quantity}
                  onChange={(e) => setExpenseForm({ ...expenseForm, quantity: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Rate per Liter (PKR) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={expenseForm.rate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, rate: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Real-time backend arithmetic total preview */}
            <div
              style={{
                padding: '14px 18px',
                background: 'var(--bg-subtle)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Voucher Amount (Qty × Rate)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--brand-primary, #1e40af)' }}>
                  PKR {(Math.round(Number(expenseForm.quantity) * Number(expenseForm.rate) * 100) / 100).toLocaleString()}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>
                <div>Debit: Fuel Expenses (606000)</div>
                <div>Credit: {expenseForm.paymentMethod === 'BANK' ? 'Bank (102000)' : 'Cash (101000)'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Remarks
              </label>
              <Input
                placeholder="e.g. Tank full for Multan territory visit"
                value={expenseForm.remarks}
                onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" type="button" onClick={() => setIsExpenseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Post Fuel Voucher to GL
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: VEHICLE DETAIL & FULL TIMELINE HISTORY */}
      {vehicleDetail && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Vehicle Profile: ${vehicleDetail.vehicleNumber}`}
          description={`${vehicleDetail.vehicleModel} | ${vehicleDetail.company?.name} | Reg Year: ${vehicleDetail.registrationYear}`}
          size="xl"
        >
          {/* Spec Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '16px',
              background: 'var(--bg-subtle)',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px' }}>
                <StatusBadge status={vehicleDetail.status} variant={getStatusBadgeVariant(vehicleDetail.status)}>
                  {vehicleDetail.status}
                </StatusBadge>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Custodian</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px' }}>
                {vehicleDetail.currentEmployee
                  ? `${vehicleDetail.currentEmployee.firstName} ${vehicleDetail.currentEmployee.lastName}`
                  : 'Head Office Yard'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Location</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px' }}>{vehicleDetail.currentLocation}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Engine Number</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', marginTop: '2px' }}>{vehicleDetail.engineNumber || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Chassis Number</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', marginTop: '2px' }}>{vehicleDetail.chassisNumber || '-'}</div>
            </div>
          </div>

          {/* Assignment History Timeline */}
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
            Assignment & Return History (Audit Log)
          </h4>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Employee</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Assignment Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Return Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Return Reason / Condition</th>
                </tr>
              </thead>
              <tbody>
                {vehicleDetail.assignments?.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No assignment history on record.
                    </td>
                  </tr>
                ) : (
                  vehicleDetail.assignments.map((a: any) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {a.employee?.firstName} {a.employee?.lastName} ({a.employee?.employeeCode})
                      </td>
                      <td style={{ padding: '8px 12px' }}>{new Date(a.assignmentDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {a.returnDate ? new Date(a.returnDate).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <StatusBadge status={a.status} variant={a.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {a.status}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <div>{a.returnReason || '-'}</div>
                        {a.returnCondition && <div style={{ fontStyle: 'italic' }}>{a.returnCondition}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Fuel & Expenses History */}
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
            Vehicle Fuel & Maintenance Expenses
          </h4>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Voucher</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Rate</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total (PKR)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Station / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {vehicleDetail.expenses?.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No fuel or maintenance expenses recorded for this vehicle.
                    </td>
                  </tr>
                ) : (
                  vehicleDetail.expenses.map((e: any) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px' }}>{new Date(e.expenseDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{e.voucherNumber}</td>
                      <td style={{ padding: '8px 12px' }}>{e.expenseType}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Number(e.quantity).toLocaleString()} L</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Number(e.rate).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                        PKR {Number(e.totalAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {e.fuelStation || e.remarks || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </ListPageTemplate>
  );
};
