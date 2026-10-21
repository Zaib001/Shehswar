/**
 * SHEHSWAR ONE360 - Employee Cost vs Sales Performance & Expense Control View
 *
 * Authoritative management module answering:
 * "How much does each employee/Sales Officer cost the company compared with the sales that employee generates?"
 *
 * Formula:
 * Total Employee Cost = Posted Salary + Approved Fuel + Approved Attributable Expenses
 * Employee Cost % = (Total Employee Cost / Net Employee Sales) * 100
 *
 * Canonical Shehswar ONE360 Architecture:
 * - ListPageTemplate canonical structure
 * - KpiCard responsive metric cards
 * - Card, CardHeader, CardTitle, CardContent
 * - Canonical Badge status pills
 * - 360 Drilldown Drawer with sub-tabs
 * - Expense Pre-Check Simulator Modal
 * - Multi-Level Hierarchy Rollup Modal
 * - Policy Management Modal & Audit Trail Modal
 * - Fully responsive on Mobile, Tablet & Desktop
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate } from '../templates';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { KpiCard } from '../ui/KpiCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Drawer } from '../ui/Drawer';
import {
  IconFinance,
  IconRefresh,
  IconTrendingUp,
  IconAlertTriangle,
  IconCheck,
  IconUsers,
  IconTruck,
  IconDownload,
  IconBuilding,
  IconShield,
  IconFileText,
  IconClose,
  IconMapPin,
} from '../icons';
import {
  exportEmployeeCostReportPdf,
  exportEmployeeCostReportCsv,
  exportHierarchyRollupReportPdf,
  exportHierarchyRollupReportCsv,
} from '../../lib/executive-reports-export';

interface EmployeeCostSummary {
  totalEmployees: number;
  totalSales: number;
  totalSalaries: number;
  totalFuel: number;
  totalOtherExpenses: number;
  totalEmployeeCost: number;
  averageCostPercentage: number;
  employeesAboveLimit: number;
  employeesNearLimit: number;
  employeesWithinLimit: number;
}

interface EmployeeCostRecord {
  id: string;
  employeeCode: string;
  name: string;
  position: string;
  companyName: string;
  companyId: string;
  region: string;
  zone: string;
  territory: string;
  sales: number;
  salary: number;
  fuel: number;
  otherExpenses: number;
  totalCost: number;
  costPercentage: number | null;
  maximumCostPercentage: number;
  remainingAllowedPercentage: number;
  remainingHeadroom: number;
  status: 'WITHIN_LIMIT' | 'NEAR_LIMIT' | 'LIMIT_REACHED' | 'LIMIT_EXCEEDED' | 'NO_SALES' | 'PENDING_APPROVAL';
  salesTarget: number;
  targetAchievementPercent: number;
  creditLimit: number;
  creditExposure: number;
  availableCredit: number;
  creditStatus: string;
  creditPercentage: number;
  maxCreditPercentage: number;
  dealerCount: number;
  invoiceCount: number;
}

export const EmployeeCostView: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EmployeeCostSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeCostRecord[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 360 Drilldown Drawer State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [activeDrillTab, setActiveDrillTab] = useState<'overview' | 'sales' | 'salary' | 'fuel' | 'other' | 'credit' | 'audit'>('overview');

  // Pre-Check Simulation Modal State
  const [isPreCheckOpen, setIsPreCheckOpen] = useState(false);
  const [preCheckEmployeeId, setPreCheckEmployeeId] = useState<string>('');
  const [preCheckCategory, setPreCheckCategory] = useState<string>('FUEL');
  const [preCheckAmount, setPreCheckAmount] = useState<number>(20000);
  const [preCheckVehicleId, setPreCheckVehicleId] = useState<string>('');
  const [preCheckDescription, setPreCheckDescription] = useState<string>('');
  const [preCheckResult, setPreCheckResult] = useState<any | null>(null);
  const [preCheckLoading, setPreCheckLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [postingExpense, setPostingExpense] = useState(false);

  // Hierarchy Report Modal State
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // Policy Modal State
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [policies, setPolicies] = useState<{ costPolicies: any[]; categoryPolicies: any[] }>({
    costPolicies: [],
    categoryPolicies: [],
  });
  const [newMaxPercent, setNewMaxPercent] = useState<number>(13.0);
  const [newNearLimitThreshold, setNewNearLimitThreshold] = useState<number>(90.0);
  const [newRoleScope, setNewRoleScope] = useState<string>('SALES_OFFICER');

  // Audit Trail Modal State
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Alert Feedback Banner
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  const showAlert = (text: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    setAlertMessage({ text, type });
    setTimeout(() => setAlertMessage(null), 6000);
  };

  // 1. Fetch Companies
  useEffect(() => {
    ApiClient.get<any>('/api/v1/master-data/companies?all=true')
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setCompanies(list);
        if (list.length > 0 && !selectedCompanyId) {
          const storedCompany = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
          const matched = list.find((c: any) => c.id === storedCompany);
          setSelectedCompanyId(matched ? matched.id : list[0].id);
        }
      })
      .catch((err) => console.error('Error loading companies', err));
  }, []);

  // 2. Fetch Dashboard Data
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId) params.append('companyId', selectedCompanyId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res: any = await ApiClient.get<{ summary: EmployeeCostSummary; employees: EmployeeCostRecord[] }>(
        `/api/v1/employee-cost/dashboard?${params.toString()}`
      );

      const payload = res?.data || res;
      if (payload && payload.summary) {
        setSummary(payload.summary);
        setEmployees(payload.employees || []);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard', err);
      showAlert(err.message || 'Failed to load employee cost data', 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, startDate, endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 3. Fetch Drilldown Data
  const openDrilldown = async (empId: string) => {
    setSelectedEmployeeId(empId);
    setDrilldownLoading(true);
    try {
      const res: any = await ApiClient.get<any>(`/api/v1/employee-cost/employee/${empId}?companyId=${selectedCompanyId}`);
      const payload = res?.data || res;
      if (payload) {
        setDrilldownData(payload);
      }
    } catch (err: any) {
      showAlert(err.message || 'Error loading employee details', 'danger');
    } finally {
      setDrilldownLoading(false);
    }
  };

  // 4. Pre-check API Simulation (Requirement 35 & 36)
  const runPreCheck = async (empId = preCheckEmployeeId, cat = preCheckCategory, amt = preCheckAmount, vId = preCheckVehicleId) => {
    if (!empId) return;
    setPreCheckLoading(true);
    try {
      const res: any = await ApiClient.post<any>('/api/v1/employee-cost/check-expense', {
        companyId: selectedCompanyId,
        employeeId: empId,
        categoryKey: cat,
        expenseType: cat === 'FUEL' || cat.includes('VEHICLE') ? 'VEHICLE_EXPENSE' : 'GENERAL_EXPENSE',
        amount: Number(amt || 0),
        vehicleId: vId || undefined,
      });
      const payload = res?.data || res;
      if (payload) {
        setPreCheckResult(payload);
      }
    } catch (err: any) {
      showAlert(err.message || 'Simulation failed', 'danger');
    } finally {
      setPreCheckLoading(false);
    }
  };

  // 5. Authoritative Expense Recording with Backend Enforcement (Requirements 37 & 38)
  const handleRecordExpense = async () => {
    if (!preCheckResult) return;
    const isExceeded = preCheckResult.status === 'LIMIT_EXCEEDED';
    if (isExceeded && !overrideReason.trim()) {
      showAlert('Limit is exceeded! A management override reason is strictly mandatory.', 'warning');
      return;
    }

    setPostingExpense(true);
    try {
      await ApiClient.post('/api/v1/employee-cost/record-expense', {
        companyId: selectedCompanyId,
        employeeId: preCheckEmployeeId,
        amount: Number(preCheckAmount),
        categoryKey: preCheckCategory,
        expenseType: preCheckCategory === 'FUEL' || preCheckCategory.includes('VEHICLE') ? 'VEHICLE_EXPENSE' : 'GENERAL_EXPENSE',
        vehicleId: preCheckVehicleId || undefined,
        description: preCheckDescription || 'Employee operational expense',
        overrideApproved: isExceeded,
        overrideReason: isExceeded ? overrideReason : undefined,
      });

      showAlert('Expense successfully verified and posted to general ledger!', 'success');
      setIsPreCheckOpen(false);
      setPreCheckResult(null);
      setOverrideReason('');
      fetchDashboard();
      if (selectedEmployeeId === preCheckEmployeeId) {
        openDrilldown(preCheckEmployeeId);
      }
    } catch (err: any) {
      showAlert(err.message || 'Expense posting blocked by policy enforcement', 'danger');
    } finally {
      setPostingExpense(false);
    }
  };

  // 6. Fetch Hierarchy Report (Requirements 29, 30, 31)
  const openHierarchy = async () => {
    setIsHierarchyOpen(true);
    setHierarchyLoading(true);
    try {
      const res: any = await ApiClient.get<any>(`/api/v1/employee-cost/hierarchy-report?companyId=${selectedCompanyId}`);
      const payload = res?.data || res;
      if (payload) setHierarchyData(payload);
    } catch (err: any) {
      showAlert(err.message || 'Error fetching hierarchy report', 'danger');
    } finally {
      setHierarchyLoading(false);
    }
  };

  // 7. Fetch Policies
  const openPolicies = async () => {
    setIsPolicyOpen(true);
    try {
      const res: any = await ApiClient.get<any>(`/api/v1/employee-cost/policies?companyId=${selectedCompanyId}`);
      const payload = res?.data || res;
      if (payload) setPolicies(payload);
    } catch (err: any) {
      showAlert(err.message || 'Error loading policies', 'danger');
    }
  };

  const saveCostPolicy = async () => {
    try {
      await ApiClient.post('/api/v1/employee-cost/policies/cost', {
        companyId: selectedCompanyId,
        roleScope: newRoleScope,
        maximumCostPercentage: Number(newMaxPercent),
        nearLimitThresholdPercent: Number(newNearLimitThreshold),
        blockingAction: 'APPROVAL_REQUIRED',
      });
      showAlert('Employee Cost Policy updated successfully', 'success');
      openPolicies();
      fetchDashboard();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save policy', 'danger');
    }
  };

  // 8. Fetch Audit Logs
  const openAuditLogs = async () => {
    setIsAuditOpen(true);
    setAuditLoading(true);
    try {
      const res: any = await ApiClient.get<any>(`/api/v1/employee-cost/audit-trail?companyId=${selectedCompanyId}`);
      const payload = res?.data || res;
      if (payload) setAuditLogs(Array.isArray(payload) ? payload : payload.data || []);
    } catch (err: any) {
      showAlert(err.message || 'Error loading audit logs', 'danger');
    } finally {
      setAuditLoading(false);
    }
  };

  // Filter Employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.territory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Currency & badge formatters
  const formatPkr = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '0.00';
    return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WITHIN_LIMIT':
        return (
          <Badge variant="success" size="sm" dot>
            WITHIN LIMIT
          </Badge>
        );
      case 'NEAR_LIMIT':
        return (
          <Badge variant="warning" size="sm" dot pulse>
            NEAR LIMIT
          </Badge>
        );
      case 'LIMIT_REACHED':
        return (
          <Badge variant="secondary" size="sm" dot>
            LIMIT REACHED
          </Badge>
        );
      case 'LIMIT_EXCEEDED':
        return (
          <Badge variant="danger" size="sm" dot pulse>
            LIMIT EXCEEDED
          </Badge>
        );
      case 'NO_SALES':
        return (
          <Badge variant="neutral" size="sm">
            NO SALES / REVIEW
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {status}
          </Badge>
        );
    }
  };

  const getCreditBadge = (status: string) => {
    switch (status) {
      case 'WITHIN_LIMIT':
        return (
          <Badge variant="success" size="sm">
            OK
          </Badge>
        );
      case 'NEAR_LIMIT':
        return (
          <Badge variant="warning" size="sm">
            NEAR
          </Badge>
        );
      case 'CREDIT_LOCK':
      case 'LIMIT_EXCEEDED':
        return (
          <Badge variant="danger" size="sm">
            LOCKED
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {status}
          </Badge>
        );
    }
  };

  return (
    <ListPageTemplate
      title="Employee Cost vs Sales Performance"
      subtitle="Authoritative cost control, sales ratio monitoring & real-time expense limit enforcement"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              const firstEmp = employees[0];
              if (firstEmp) {
                setPreCheckEmployeeId(firstEmp.id);
                runPreCheck(firstEmp.id, 'FUEL', 20000, '');
              }
              setIsPreCheckOpen(true);
            }}
          >
            <IconTrendingUp size={14} /> Expense Simulator
          </Button>

          <Button variant="outline" onClick={openHierarchy}>
            <IconBuilding size={14} /> Hierarchy Rollup
          </Button>

          <Button variant="outline" onClick={openPolicies}>
            <IconShield size={14} /> Cost Policies
          </Button>

          <Button variant="outline" onClick={openAuditLogs}>
            <IconShield size={14} /> Audit Trail
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const compName = companies.find((c) => c.id === selectedCompanyId)?.name || 'Shehswar Group';
              exportEmployeeCostReportPdf({
                companyName: compName,
                period: 'Current Period',
                employees: filteredEmployees,
                summary: summary || {
                  totalEmployees: employees.length,
                  totalSales: employees.reduce((s, e) => s + (e.sales || 0), 0),
                  totalSalaries: employees.reduce((s, e) => s + (e.salary || 0), 0),
                  totalFuel: employees.reduce((s, e) => s + (e.fuel || 0), 0),
                  totalOtherExpenses: employees.reduce((s, e) => s + (e.otherExpenses || 0), 0),
                  totalEmployeeCost: employees.reduce((s, e) => s + (e.totalCost || 0), 0),
                  averageCostPercentage:
                    employees.length > 0
                      ? employees.reduce((s, e) => s + (e.costPercentage || 0), 0) / employees.length
                      : 0,
                  employeesAboveLimit: employees.filter((e) => e.status === 'LIMIT_EXCEEDED').length,
                  employeesNearLimit: employees.filter((e) => e.status === 'NEAR_LIMIT').length,
                  employeesWithinLimit: employees.filter((e) => e.status === 'WITHIN_LIMIT').length,
                },
              });
            }}
          >
            <IconDownload size={14} /> PDF Report
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              exportEmployeeCostReportCsv(filteredEmployees, 'Shehswar_Employee_Cost_vs_Sales_Report');
            }}
          >
            <IconFileText size={14} /> Export CSV
          </Button>

          <Button variant="outline" onClick={fetchDashboard}>
            <IconRefresh size={14} /> Refresh
          </Button>
        </div>
      }
    >
      {/* Alert banner */}
      {alertMessage && (
        <Card
          style={{
            padding: '12px 18px',
            backgroundColor:
              alertMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : alertMessage.type === 'danger'
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(245, 158, 11, 0.12)',
            color:
              alertMessage.type === 'success'
                ? '#10B981'
                : alertMessage.type === 'danger'
                ? '#EF4444'
                : '#F59E0B',
            border: `1px solid ${
              alertMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.3)'
                : alertMessage.type === 'danger'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(245, 158, 11, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-md, 16px)',
          }}
        >
          <span style={{ fontWeight: 500, fontSize: '13px' }}>{alertMessage.text}</span>
          <button
            onClick={() => setAlertMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            aria-label="Dismiss alert"
          >
            <IconClose size={14} />
          </button>
        </Card>
      )}

      {/* 9 KPI Executive Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-md, 16px)',
          marginBottom: 'var(--space-lg, 24px)',
        }}
      >
        <KpiCard
          title="Total Employees"
          value={summary?.totalEmployees ?? 0}
          subtitle="Active in market hierarchy"
          icon={<IconUsers size={20} />}
          accentColor="#3b82f6"
        />
        <KpiCard
          title="Total Net Sales"
          value={`PKR ${formatPkr(summary?.totalSales)}`}
          subtitle="Posted sales net credit returns"
          icon={<IconTrendingUp size={20} />}
          accentColor="#2563eb"
        />
        <KpiCard
          title="Posted Salaries"
          value={`PKR ${formatPkr(summary?.totalSalaries)}`}
          subtitle="Authoritative payroll disbursed"
          icon={<IconFinance size={20} />}
          accentColor="#8b5cf6"
        />
        <KpiCard
          title="Fuel / Petrol Expense"
          value={`PKR ${formatPkr(summary?.totalFuel)}`}
          subtitle="Approved field & vehicle fuel"
          icon={<IconTruck size={20} />}
          accentColor="#f59e0b"
        />
        <KpiCard
          title="Other Approved Exp."
          value={`PKR ${formatPkr(summary?.totalOtherExpenses)}`}
          subtitle="Travel, meals, field allowances"
          icon={<IconCheck size={20} />}
          accentColor="#06b6d4"
        />
        <KpiCard
          title="Total Employee Cost"
          value={`PKR ${formatPkr(summary?.totalEmployeeCost)}`}
          subtitle="Salary + Fuel + Other"
          icon={<IconFinance size={20} />}
          accentColor="#e11d48"
        />
        <KpiCard
          title="Average Cost %"
          value={summary?.averageCostPercentage ? `${summary.averageCostPercentage}%` : '0.00%'}
          subtitle="Target policy: 13.00%"
          badge={(summary?.averageCostPercentage || 0) > 13 ? 'EXCEEDED' : 'WITHIN'}
          accentColor={(summary?.averageCostPercentage || 0) > 13 ? '#ef4444' : '#10b981'}
        />
        <KpiCard
          title="Above Limit"
          value={summary?.employeesAboveLimit ?? 0}
          subtitle="Action: Blocked / Override req."
          badge={summary?.employeesAboveLimit ? 'ALERT' : 'NONE'}
          accentColor="#ef4444"
          icon={<IconAlertTriangle size={20} />}
        />
        <KpiCard
          title="Near Limit"
          value={summary?.employeesNearLimit ?? 0}
          subtitle="Approaching cost ceiling"
          badge={summary?.employeesNearLimit ? 'WARNING' : 'NONE'}
          accentColor="#f59e0b"
          icon={<IconAlertTriangle size={20} />}
        />
      </div>

      {/* Filter and selector toolbar */}
      <Card style={{ marginBottom: 'var(--space-md, 20px)' }}>
        <CardContent
          style={{
            padding: '16px 20px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Box */}
            <div style={{ width: '260px' }}>
              <Input
                placeholder="Search employee / code / territory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Company Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Company:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="WITHIN_LIMIT">Within Limit</option>
                <option value="NEAR_LIMIT">Near Limit</option>
                <option value="LIMIT_REACHED">Limit Reached</option>
                <option value="LIMIT_EXCEEDED">Limit Exceeded</option>
                <option value="NO_SALES">No Sales</option>
              </select>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              All Time
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] || '';
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] || '';
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}
            >
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              <IconRefresh size={14} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Master Employee Cost Table (Requirement 12) */}
      <Card style={{ overflow: 'hidden' }}>
        <CardHeader
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <CardTitle>Employee Cost & Sales Performance Register</CardTitle>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing {filteredEmployees.length} of {employees.length} field officers
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              &lt; 11.7% Within Limit
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              ≥ 11.7% Near Limit
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
              = 13.0% Limit Reached
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              &gt; 13.0% Limit Exceeded
            </span>
          </div>
        </CardHeader>

        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              minWidth: '1200px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 'var(--font-size-xs, 12px)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-canvas, #f8fafc)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 14px' }}>Employee</th>
                <th style={{ padding: '12px 14px' }}>Territory / Region</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net Sales</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Salary</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Fuel</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Other</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Cost</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Cost %</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Max %</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Headroom</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Target Achv %</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Credit Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Cost Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading employee cost and sales performance records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No employee records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      backgroundColor: emp.status === 'LIMIT_EXCEEDED' ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    {/* Employee */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {emp.employeeCode} • {emp.position}
                      </div>
                    </td>

                    {/* Hierarchy */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{emp.territory}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {emp.zone} / {emp.region}
                      </div>
                    </td>

                    {/* Net Sales */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#2563EB' }}>
                      {formatPkr(emp.sales)}
                    </td>

                    {/* Salary */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatPkr(emp.salary)}
                    </td>

                    {/* Fuel */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatPkr(emp.fuel)}
                    </td>

                    {/* Other */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatPkr(emp.otherExpenses)}
                    </td>

                    {/* Total Cost */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#E11D48' }}>
                      {formatPkr(emp.totalCost)}
                    </td>

                    {/* Cost % */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {emp.costPercentage !== null ? (
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              emp.costPercentage > emp.maximumCostPercentage
                                ? 'rgba(239, 68, 68, 0.12)'
                                : emp.costPercentage >= 11.7
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)',
                            color:
                              emp.costPercentage > emp.maximumCostPercentage
                                ? '#EF4444'
                                : emp.costPercentage >= 11.7
                                ? '#F59E0B'
                                : '#10B981',
                          }}
                        >
                          {emp.costPercentage.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>

                    {/* Max % */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {emp.maximumCostPercentage.toFixed(1)}%
                    </td>

                    {/* Headroom */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, color: emp.remainingHeadroom < 0 ? '#EF4444' : '#10B981' }}>
                        {formatPkr(emp.remainingHeadroom)}
                      </span>
                    </td>

                    {/* Sales Target & Achievement */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{emp.targetAchievementPercent.toFixed(1)}%</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tgt: {formatPkr(emp.salesTarget)}</div>
                    </td>

                    {/* Credit Status */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {getCreditBadge(emp.creditStatus)}
                    </td>

                    {/* Cost Status */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {getStatusBadge(emp.status)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Button variant="outline" size="sm" onClick={() => openDrilldown(emp.id)}>
                        360 Drill-Down
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 360 Drill-Down Drawer (Requirements 13 & 14) */}
      <Drawer
        isOpen={!!selectedEmployeeId}
        onClose={() => {
          setSelectedEmployeeId(null);
          setDrilldownData(null);
        }}
        title={`Employee 360 Performance: ${drilldownData?.employee?.fullName || 'Loading...'}`}
      >
        {drilldownLoading || !drilldownData ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving employee market transactions, salary vouchers, fuel expenses, and credit exposure...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            {/* Officer Banner Profile */}
            <Card style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{drilldownData.employee.fullName}</h3>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Code: {drilldownData.employee.employeeCode} • {drilldownData.employee.position} • {drilldownData.employee.department}
                  </div>
                  <div style={{ fontSize: '12px', color: '#38BDF8', marginTop: '4px' }}>
                    Territory: {drilldownData.employee.territory} | Zone: {drilldownData.employee.zone} | Region: {drilldownData.employee.region}
                  </div>
                </div>
                <div>{getStatusBadge(drilldownData.metrics.status)}</div>
              </div>
            </Card>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', gap: '8px', overflowX: 'auto' }}>
              {(['overview', 'sales', 'salary', 'fuel', 'other', 'credit', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDrillTab(tab)}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderBottom: activeDrillTab === tab ? '2px solid #E11D48' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeDrillTab === tab ? '#E11D48' : 'var(--text-secondary)',
                    fontWeight: activeDrillTab === tab ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab === 'fuel' ? 'Fuel & Vehicles' : tab}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {activeDrillTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <Card style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Authoritative Sales</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#3B82F6' }}>
                      PKR {formatPkr(drilldownData.metrics.sales)}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Invoices: {drilldownData.metrics.invoiceCount} | Dealers: {drilldownData.metrics.dealerCount}
                    </span>
                  </Card>

                  <Card style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Employee Cost</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#E11D48' }}>
                      PKR {formatPkr(drilldownData.metrics.totalEmployeeCost)}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Salary + Fuel + Other Expenses
                    </span>
                  </Card>

                  <Card style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Employee Cost %</span>
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: (drilldownData.metrics.costPercentage || 0) > drilldownData.metrics.maximumCostPercentage ? '#EF4444' : '#10B981',
                      }}
                    >
                      {drilldownData.metrics.costPercentage !== null ? `${drilldownData.metrics.costPercentage.toFixed(2)}%` : 'N/A'}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Max Allowed: {drilldownData.metrics.maximumCostPercentage}%
                    </span>
                  </Card>

                  <Card style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining Cost Headroom</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: drilldownData.metrics.remainingHeadroom < 0 ? '#EF4444' : '#10B981' }}>
                      PKR {formatPkr(drilldownData.metrics.remainingHeadroom)}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {drilldownData.metrics.remainingAllowedPercentage.toFixed(2)}% margin available
                    </span>
                  </Card>
                </div>

                {/* Policy Context */}
                <Card style={{ padding: '16px', backgroundColor: 'var(--bg-canvas)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Policy Decision Context</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                    {drilldownData.metrics.status === 'LIMIT_EXCEEDED' ? (
                      <span style={{ color: '#EF4444', display: 'inline-flex', alignItems: 'flex-start', gap: '6px' }}>
                        <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span><strong>Limit Exceeded:</strong> Employee operational cost exceeds the company allowable ratio of {drilldownData.metrics.maximumCostPercentage}%. Any additional expense voucher will be BLOCKED unless an authorized manager provides an override with audited justification.</span>
                      </span>
                    ) : drilldownData.metrics.status === 'NEAR_LIMIT' ? (
                      <span style={{ color: '#F59E0B', display: 'inline-flex', alignItems: 'flex-start', gap: '6px' }}>
                        <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span><strong>Near Limit:</strong> Employee is operating close to the {drilldownData.metrics.maximumCostPercentage}% cost threshold. Management review recommended for upcoming expense approvals.</span>
                      </span>
                    ) : (
                      <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'flex-start', gap: '6px' }}>
                        <IconCheck size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span><strong>Within Policy Limit:</strong> Cost to sales ratio is healthy ({drilldownData.metrics.costPercentage}%). Headroom of PKR {formatPkr(drilldownData.metrics.remainingHeadroom)} is available.</span>
                      </span>
                    )}
                  </p>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setPreCheckEmployeeId(drilldownData.employee.id);
                      runPreCheck(drilldownData.employee.id, 'FUEL', 20000, '');
                      setIsPreCheckOpen(true);
                    }}
                  >
                    Simulate Expense for this Officer
                  </Button>
                </Card>
              </div>
            )}

            {/* Tab 2: Sales Performance */}
            {activeDrillTab === 'sales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Attributed Posted Sales Invoices</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: PKR {formatPkr(drilldownData.metrics.sales)}</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px' }}>Description</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '8px' }}>Gross Posted Sales Invoices ({drilldownData.metrics.invoiceCount} invoices)</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatPkr(drilldownData.metrics.grossSales)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '8px' }}>Less: Sales Returns & Credit Notes</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#EF4444' }}>- {formatPkr(drilldownData.metrics.returns)}</td>
                      </tr>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', fontWeight: 700 }}>
                        <td style={{ padding: '8px' }}>Net Attributed Sales</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#3B82F6' }}>{formatPkr(drilldownData.metrics.sales)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Salary History */}
            {activeDrillTab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Posted Payroll Vouchers</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: PKR {formatPkr(drilldownData.metrics.salary)}</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px' }}>Voucher</th>
                        <th style={{ padding: '8px' }}>Month</th>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Net Paid</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownData.breakdown.salaryPayments.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No posted salary vouchers found.
                          </td>
                        </tr>
                      ) : (
                        drilldownData.breakdown.salaryPayments.map((sal: any) => (
                          <tr key={sal.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{sal.voucherNumber}</td>
                            <td style={{ padding: '8px' }}>{sal.salaryMonth}</td>
                            <td style={{ padding: '8px' }}>{new Date(sal.paymentDate).toLocaleDateString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatPkr(sal.netPaid)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <Badge variant="success" size="sm">POSTED</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 4: Fuel & Vehicles */}
            {activeDrillTab === 'fuel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Approved Fuel & Attributable Vehicle Expenses</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: PKR {formatPkr(drilldownData.metrics.fuel)}</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px' }}>Vehicle</th>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px' }}>Type</th>
                        <th style={{ padding: '8px' }}>Qty (Ltr)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Employee Cost?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownData.breakdown.fuelExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No approved vehicle fuel expenses recorded.
                          </td>
                        </tr>
                      ) : (
                        drilldownData.breakdown.fuelExpenses.map((exp: any) => (
                          <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{exp.vehicleNumber}</td>
                            <td style={{ padding: '8px' }}>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{exp.expenseType}</td>
                            <td style={{ padding: '8px' }}>{exp.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatPkr(exp.totalAmount)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <Badge variant={exp.isEmployeeCost ? 'danger' : 'neutral'} size="sm">
                                {exp.isEmployeeCost ? 'YES' : 'NO (ASSET)'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 5: Other Expenses */}
            {activeDrillTab === 'other' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Approved Attributable General Expenses</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: PKR {formatPkr(drilldownData.metrics.otherExpenses)}</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px' }}>Category</th>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px' }}>Description</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownData.breakdown.otherExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No other approved employee expenses recorded.
                          </td>
                        </tr>
                      ) : (
                        drilldownData.breakdown.otherExpenses.map((exp: any) => (
                          <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{exp.categoryName}</td>
                            <td style={{ padding: '8px' }}>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{exp.description}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatPkr(exp.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 6: Credit Risk */}
            {activeDrillTab === 'credit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <Card style={{ padding: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Credit Limit</span>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>PKR {formatPkr(drilldownData.metrics.creditLimit)}</div>
                  </Card>
                  <Card style={{ padding: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dealer Credit Exposure</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#EA580C' }}>
                      PKR {formatPkr(drilldownData.metrics.creditExposure)}
                    </div>
                  </Card>
                  <Card style={{ padding: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Available Credit</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981' }}>
                      PKR {formatPkr(drilldownData.metrics.availableCredit)}
                    </div>
                  </Card>
                  <Card style={{ padding: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Credit % vs Sales</span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: drilldownData.metrics.creditPercentage > drilldownData.metrics.maxCreditPercentage ? '#EF4444' : '#10B981' }}>
                      {drilldownData.metrics.creditPercentage}%
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Tab 7: Audit */}
            {activeDrillTab === 'audit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Employee Expense Audit History</span>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  All expense checks, policy violations, and manager overrides for {drilldownData.employee.fullName}.
                </p>
                <Button size="sm" variant="outline" onClick={openAuditLogs}>
                  View Full Audit Log
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Expense Pre-Check Simulator Modal (Requirements 35 & 36) */}
      <Modal
        isOpen={isPreCheckOpen}
        onClose={() => {
          setIsPreCheckOpen(false);
          setPreCheckResult(null);
          setOverrideReason('');
        }}
        title="Expense Impact Pre-Check & Simulation"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* Employee Selector */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Employee / Officer:</label>
              <select
                value={preCheckEmployeeId}
                onChange={(e) => {
                  setPreCheckEmployeeId(e.target.value);
                  runPreCheck(e.target.value, preCheckCategory, preCheckAmount, preCheckVehicleId);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas)',
                  marginTop: '4px',
                }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode} - {emp.territory})
                  </option>
                ))}
              </select>
            </div>

            {/* Expense Category */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Expense Category:</label>
              <select
                value={preCheckCategory}
                onChange={(e) => {
                  setPreCheckCategory(e.target.value);
                  runPreCheck(preCheckEmployeeId, e.target.value, preCheckAmount, preCheckVehicleId);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas)',
                  marginTop: '4px',
                }}
              >
                <option value="FUEL">Fuel / Petrol (Employee Cost = YES)</option>
                <option value="TRAVEL">Travel / Lodging (Employee Cost = YES)</option>
                <option value="MEALS">Meals & Food (Employee Cost = YES)</option>
                <option value="FIELD_ALLOWANCE">Field Allowance (Employee Cost = YES)</option>
                <option value="COMMUNICATION">Mobile / Internet (Employee Cost = YES)</option>
                <option value="VEHICLE_BEARING">Vehicle Bearing (Company Asset = NO)</option>
                <option value="VEHICLE_MAINTENANCE">Vehicle Major Repair (Company Asset = NO)</option>
                <option value="BUILDING_REPAIR">Office / Depot Repair (Company Asset = NO)</option>
              </select>
            </div>

            {/* Requested Amount */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Requested Amount (PKR):</label>
              <Input
                type="number"
                value={preCheckAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPreCheckAmount(val);
                  runPreCheck(preCheckEmployeeId, preCheckCategory, val, preCheckVehicleId);
                }}
                style={{ marginTop: '4px' }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description / Remarks:</label>
              <Input
                placeholder="e.g. Field visit fuel, dealer tour meal"
                value={preCheckDescription}
                onChange={(e) => setPreCheckDescription(e.target.value)}
                style={{ marginTop: '4px' }}
              />
            </div>

            {/* Optional Vehicle Number */}
            {(preCheckCategory === 'FUEL' || preCheckCategory.includes('VEHICLE')) && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vehicle Reg / ID (Optional):</label>
                <Input
                  placeholder="e.g. ABC-123"
                  value={preCheckVehicleId}
                  onChange={(e) => {
                    setPreCheckVehicleId(e.target.value);
                    runPreCheck(preCheckEmployeeId, preCheckCategory, preCheckAmount, e.target.value);
                  }}
                  style={{ marginTop: '4px' }}
                />
              </div>
            )}
          </div>

          {/* Simulation Output Dashboard */}
          {preCheckLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating real-time financial impact against authoritative sales and policies...
            </div>
          ) : preCheckResult ? (
            <Card
              style={{
                padding: '16px',
                backgroundColor: preCheckResult.status === 'LIMIT_EXCEEDED' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-canvas)',
                border: `1px solid ${preCheckResult.status === 'LIMIT_EXCEEDED' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-default)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Simulation Result:</span>
                <div>{getStatusBadge(preCheckResult.status)}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Sales</div>
                  <div style={{ fontWeight: 600 }}>PKR {formatPkr(preCheckResult.currentSales)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Cost</div>
                  <div style={{ fontWeight: 600 }}>PKR {formatPkr(preCheckResult.currentCost)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Cost %</div>
                  <div style={{ fontWeight: 600 }}>{preCheckResult.currentCostPercentage}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New Expense</div>
                  <div style={{ fontWeight: 600, color: '#3B82F6' }}>+ PKR {formatPkr(preCheckResult.newExpense)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projected Cost</div>
                  <div style={{ fontWeight: 700, color: '#E11D48' }}>PKR {formatPkr(preCheckResult.projectedCost)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projected Cost %</div>
                  <div style={{ fontWeight: 700, color: preCheckResult.projectedCostPercentage > preCheckResult.maximumAllowedPercentage ? '#EF4444' : '#10B981' }}>
                    {preCheckResult.projectedCostPercentage}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max Allowed %</div>
                  <div style={{ fontWeight: 600 }}>{preCheckResult.maximumAllowedPercentage}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Headroom Remaining</div>
                  <div style={{ fontWeight: 600, color: preCheckResult.remainingHeadroom < 0 ? '#EF4444' : '#10B981' }}>
                    PKR {formatPkr(preCheckResult.remainingHeadroom)}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  backgroundColor: preCheckResult.status === 'LIMIT_EXCEEDED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: preCheckResult.status === 'LIMIT_EXCEEDED' ? '#EF4444' : '#10B981',
                }}
              >
                {preCheckResult.message}
              </div>

              {/* Override Form if Exceeded */}
              {preCheckResult.status === 'LIMIT_EXCEEDED' && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444' }}>
                    Manager Approval / Override Reason (Mandatory):
                  </label>
                  <Input
                    placeholder="Provide justification for exceeding 13% allowable ratio..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              )}
            </Card>
          ) : null}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button
              variant="outline"
              onClick={() => {
                setIsPreCheckOpen(false);
                setPreCheckResult(null);
                setOverrideReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={postingExpense || !preCheckResult || (preCheckResult.status === 'LIMIT_EXCEEDED' && !overrideReason.trim())}
              onClick={handleRecordExpense}
            >
              {postingExpense ? 'Validating & Posting...' : preCheckResult?.status === 'LIMIT_EXCEEDED' ? 'Authorize Manager Override & Post' : 'Verify & Post to GL'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hierarchy Rollup Modal (Requirements 29, 30, 31) */}
      <Modal isOpen={isHierarchyOpen} onClose={() => setIsHierarchyOpen(false)} title="Multi-Level Cost & Sales Hierarchy Rollup" size="lg">
        {hierarchyLoading || !hierarchyData ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Aggregating performance across Regions, Zones, and Territories...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const compName = companies.find((c) => c.id === selectedCompanyId)?.name || 'Shehswar Group';
                  exportHierarchyRollupReportPdf({
                    companyName: compName,
                    regions: hierarchyData.regions || [],
                  });
                }}
              >
                <IconDownload size={14} /> PDF Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportHierarchyRollupReportCsv(hierarchyData.regions || [], 'Shehswar_Hierarchy_Cost_Rollup');
                }}
              >
                <IconFileText size={14} /> Export CSV
              </Button>
            </div>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '8px' }}>Region / Zone</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Net Sales</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Salaries</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Fuel</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Other</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total Cost</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Cost %</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hierarchyData.regions?.map((reg: any) => (
                    <React.Fragment key={reg.id}>
                      <tr style={{ backgroundColor: 'var(--bg-canvas)', fontWeight: 600 }}>
                        <td style={{ padding: '8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <IconMapPin size={12} /> {reg.name}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPkr(reg.sales)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPkr(reg.salary)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPkr(reg.fuel)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPkr(reg.other)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatPkr(reg.totalCost)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: reg.costPercentage > 13 ? '#EF4444' : '#10B981' }}>
                          {reg.costPercentage}%
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{getStatusBadge(reg.status)}</td>
                      </tr>
                      {reg.zones?.map((zone: any) => (
                        <tr key={zone.id} style={{ borderBottom: '1px solid var(--border-default)', fontSize: '11px' }}>
                          <td style={{ padding: '6px 8px 6px 24px' }}>↳ {zone.name}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPkr(zone.sales)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPkr(zone.salary)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPkr(zone.fuel)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPkr(zone.other)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPkr(zone.totalCost)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{zone.costPercentage}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{getStatusBadge(zone.status)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Cost Policy Configuration Modal (Requirements 5, 21, 22) */}
      <Modal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} title="Employee Cost & Expense Category Policies" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* New Policy Form */}
          <Card style={{ padding: '16px', backgroundColor: 'var(--bg-canvas)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Configure Cost Policy</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Role Scope:</label>
                <select
                  value={newRoleScope}
                  onChange={(e) => setNewRoleScope(e.target.value)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-default)', marginTop: '4px' }}
                >
                  <option value="SALES_OFFICER">Sales Officer</option>
                  <option value="TERRITORY_MANAGER">Territory Manager</option>
                  <option value="ZONAL_MANAGER">Zonal Manager</option>
                  <option value="REGIONAL_MANAGER">Regional Manager</option>
                  <option value="ALL">All Roles Default</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Maximum Cost %:</label>
                <Input
                  type="number"
                  value={newMaxPercent}
                  onChange={(e) => setNewMaxPercent(Number(e.target.value))}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Near Limit Threshold %:</label>
                <Input
                  type="number"
                  value={newNearLimitThreshold}
                  onChange={(e) => setNewNearLimitThreshold(Number(e.target.value))}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>
            <Button size="sm" variant="primary" onClick={saveCostPolicy}>
              Save & Apply Policy
            </Button>
          </Card>

          {/* Active Policies Table */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '8px' }}>Role Scope</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Max Cost %</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Near Limit %</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.costPolicies.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{p.roleScope}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{Number(p.maximumCostPercentage)}%</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{Number(p.nearLimitThresholdPercent)}%</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{p.blockingAction}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Badge variant="success" size="sm">{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Audit Trail Modal (Requirements 32 & 33) */}
      <Modal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} title="Employee Expense & Cost Audit Trail" size="lg">
        {auditLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving audit records...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '8px' }}>Timestamp</th>
                    <th style={{ padding: '8px' }}>Officer</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Projected %</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Decision</th>
                    <th style={{ padding: '8px' }}>Reason / Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No audit records found.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log: any) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{log.employee?.firstName} {log.employee?.lastName}</td>
                        <td style={{ padding: '8px' }}>{log.expenseType}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatPkr(log.requestedAmount)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{Number(log.projectedCostPercentage)}%</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <Badge variant={log.decision === 'OVERRIDDEN' ? 'danger' : 'neutral'} size="sm">
                            {log.decision}
                          </Badge>
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{log.reason || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </ListPageTemplate>
  );
};
