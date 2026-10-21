'use client';

/**
 * SHEHSWAR ONE360 - Hierarchical Credit Control Dashboard & Management
 *
 * Implements authoritative 5-Tier Credit Control:
 *   DEALER → SALES OFFICER → TERRITORY → ZONE → REGION
 *
 * Core Capabilities:
 * - Real-time Credit Exposure vs Limits Dashboard
 * - Sales Target vs Credit Limit Separation Viewer
 * - Configurable Limit Rules (Dealer, SO, Territory, Zone, Region)
 * - Automatic Credit Hold Monitoring
 * - Credit Override Management Approval Workflow
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useAuth } from '../../context/auth-context';
import { useToast } from '../../context/toast-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  TableSkeleton,
  EmptyState,
  Modal,
} from '../ui';
import {
  IconRefresh,
  IconPlus,
  IconDownload,
  IconFileText,
} from '../icons';
import { PercentageCreditView } from './PercentageCreditView';
import {
  exportCreditDashboardReportPdf,
  exportCreditDashboardReportCsv,
  exportConfiguredLimitsReportPdf,
  exportConfiguredLimitsReportCsv,
  exportCreditOverridesReportPdf,
  exportCreditOverridesReportCsv,
} from '../../lib/executive-reports-export';

export interface CreditControlViewProps {
  defaultTab?: 'dashboard' | 'limits' | 'targets' | 'overrides' | 'percentage-credit';
}

export const CreditControlView: React.FC<CreditControlViewProps> = ({ defaultTab = 'dashboard' }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'limits' | 'targets' | 'overrides' | 'percentage-credit'>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);

  // Data States
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [limitsList, setLimitsList] = useState<any[]>([]);
  const [overrideRequests, setOverrideRequests] = useState<any[]>([]);

  // Config Limit Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [limitForm, setLimitForm] = useState({
    level: 'DEALER',
    entityId: '',
    creditLimit: '',
    warningThresholdPct: '85',
    notes: '',
  });

  // Dealers & Officers for selection dropdown
  const [dealers, setDealers] = useState<any[]>([]);

  // Load Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await ApiClient.get<any>('/api/v1/master-data/companies?all=true');
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        setCompanies(list);
        if (list.length > 0 && !companyId) {
          const userCompany = list.find((c: any) => c.id === user?.companyId);
          setCompanyId(userCompany ? userCompany.id : list[0].id);
        }
      } catch {
        if (user?.companyId) setCompanyId(user.companyId);
      }
    };
    fetchCompanies();
  }, [user]);

  // Fetch Dashboard & Limits
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await ApiClient.get<any>(`/api/v1/credit/dashboard?companyId=${companyId}`);
        setDashboardData((res as any)?.data || res);
      } else if (activeTab === 'limits') {
        const res = await ApiClient.get<any[]>(`/api/v1/credit/limits?companyId=${companyId}`);
        setLimitsList((res as any)?.data || res || []);
      } else if (activeTab === 'overrides') {
        const res = await ApiClient.get<any[]>(`/api/v1/credit/overrides?companyId=${companyId}`);
        setOverrideRequests((res as any)?.data || res || []);
      }

      // Also fetch dealers for dropdowns
      const dealerRes = await ApiClient.get<any>(`/api/v1/dealers?companyId=${companyId}`);
      setDealers((dealerRes as any)?.data || (dealerRes as any) || []);
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to load credit control data' });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitForm.entityId || !limitForm.creditLimit || Number(limitForm.creditLimit) < 0) {
      showToast({ type: 'warning', title: 'Please provide a valid entity and credit limit' });
      return;
    }
    try {
      await ApiClient.post('/api/v1/credit/limits', {
        ...limitForm,
        companyId,
        creditLimit: Number(limitForm.creditLimit),
        warningThresholdPct: Number(limitForm.warningThresholdPct || 85),
      });
      showToast({ type: 'success', title: 'Credit limit updated successfully!' });
      setIsConfigModalOpen(false);
      setLimitForm({
        level: 'DEALER',
        entityId: '',
        creditLimit: '',
        warningThresholdPct: '85',
        notes: '',
      });
      fetchData();
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to update credit limit' });
    }
  };

  const handleOverrideDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      if (decision === 'APPROVED') {
        await ApiClient.post(`/api/v1/credit/overrides/${id}/approve`, {});
        showToast({ type: 'success', title: 'Credit override approved!' });
      } else {
        await ApiClient.post(`/api/v1/credit/overrides/${id}/reject`, { reason: 'Credit limit cannot be overridden.' });
        showToast({ type: 'info', title: 'Credit override rejected.' });
      }
      fetchData();
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Action failed' });
    }
  };

  const formatPKR = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `PKR ${num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Hierarchical Credit Control & Risk Management
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            5-Tier exposure enforcement (Dealer → Sales Officer → Territory → Zone → Region) with dynamic payment release
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {companies.length > 0 && (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}

          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <IconRefresh size={14} /> Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const compName = companies.find((c) => c.id === companyId)?.name || 'Shehswar Group';
              if (activeTab === 'limits') {
                exportConfiguredLimitsReportPdf({
                  companyName: compName,
                  limits: limitsList,
                });
              } else if (activeTab === 'overrides') {
                exportCreditOverridesReportPdf({
                  companyName: compName,
                  overrides: overrideRequests,
                });
              } else {
                const dealers = dashboardData?.dealers || dashboardData?.items || [];
                exportCreditDashboardReportPdf({
                  companyName: compName,
                  dealers,
                  summary: dashboardData?.summary || dashboardData?.kpis || {},
                });
              }
            }}
          >
            <IconDownload size={14} /> PDF Report
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (activeTab === 'limits') {
                exportConfiguredLimitsReportCsv(limitsList, 'Shehswar_Configured_Credit_Limits');
              } else if (activeTab === 'overrides') {
                exportCreditOverridesReportCsv(overrideRequests, 'Shehswar_Credit_Overrides_Audit');
              } else {
                const dealers = dashboardData?.dealers || dashboardData?.items || [];
                exportCreditDashboardReportCsv(dealers, 'Shehswar_Credit_Limits_and_Exposure');
              }
            }}
          >
            <IconFileText size={14} /> Export CSV
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsConfigModalOpen(true)}>
            <IconPlus size={14} /> Configure Limit
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px', overflowX: 'auto' }}>
        {[
          { id: 'dashboard', label: 'Credit Dashboard' },
          { id: 'percentage-credit', label: 'Percentage Credit & Lock' },
          { id: 'limits', label: 'Configured Limits' },
          { id: 'targets', label: 'Target vs Limit' },
          { id: 'overrides', label: 'Override Requests' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. CREDIT DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            <Card>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  TOTAL CREDIT LIMIT
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {formatPKR(dashboardData?.summary?.totalCreditLimit ?? dashboardData?.kpis?.totalLimit)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  CURRENT EXPOSURE
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#EA580C', marginTop: '4px' }}>
                  {formatPKR(dashboardData?.summary?.totalCreditExposure ?? dashboardData?.kpis?.totalExposure)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  AVAILABLE CREDIT
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
                  {formatPKR(dashboardData?.summary?.availableCredit ?? dashboardData?.kpis?.availableCredit)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  UTILIZATION %
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                  {dashboardData?.summary?.utilizationPercent ?? dashboardData?.kpis?.overallUtilization ?? 0}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent style={{ padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  CREDIT HOLD ACCOUNTS
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                  {dashboardData?.summary?.creditHoldAccountsCount ?? dashboardData?.kpis?.creditHoldCount ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hierarchy Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>5-TIER HIERARCHICAL EXPOSURE BREAKDOWN</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : !dashboardData?.dealers || dashboardData.dealers.length === 0 ? (
                <EmptyState title="No Dealers" description="No active dealer accounts found for this company." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                        <th style={{ padding: '10px 12px' }}>Dealer</th>
                        <th style={{ padding: '10px 12px' }}>Market Path</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit Limit</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Exposure</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Available Credit</th>
                        <th style={{ padding: '10px 12px', width: '140px' }}>Utilization</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dealers.map((d: any) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.code} • SO: {d.officerName}</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {d.regionName} → {d.zoneName} → {d.territoryName}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatPKR(d.limit)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#EA580C' }}>
                            {formatPKR(d.exposure)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                            {formatPKR(d.available)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '8px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-subtle)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${Math.min(100, d.utilization || 0)}%`,
                                    backgroundColor:
                                      d.utilization >= 100 ? '#DC2626' : d.utilization >= 85 ? '#EA580C' : '#16A34A',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{d.utilization}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <Badge
                              variant={
                                d.status === 'CREDIT_HOLD'
                                  ? 'danger'
                                  : d.status === 'NEAR_LIMIT'
                                  ? 'warning'
                                  : 'success'
                              }
                            >
                              {d.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CONFIG RULES TAB */}
      {activeTab === 'limits' && (
        <Card>
          <CardHeader>
            <CardTitle>CONFIGURED LIMITS ACROSS HIERARCHY LEVELS</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={6} rows={6} />
            ) : limitsList.length === 0 ? (
              <EmptyState title="No Configured Limits" description="Click 'Configure Limit' to set limits for Dealer, SO, Territory, Zone, or Region." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Level</th>
                      <th style={{ padding: '10px 12px' }}>Entity ID / Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit Limit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Warning Threshold</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Effective Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitsList.map((lim) => (
                      <tr key={lim.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="primary">{lim.level}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lim.entityName || lim.entityId}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatPKR(lim.creditLimit)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                          {lim.nearLimitThresholdPercent}%
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant={lim.status === 'ACTIVE' ? 'success' : 'secondary'}>{lim.status}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {new Date(lim.effectiveFrom).toLocaleDateString()}
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

      {/* 3. TARGET VS LIMIT TAB (Requirement 16) */}
      {activeTab === 'targets' && (
        <Card>
          <CardHeader>
            <CardTitle>SALES TARGET VS CREDIT LIMIT INDEPENDENCE AUDIT</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>
                Core Enterprise Policy (Requirement 16):
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <strong>Sales Target</strong> represents business ambition (&quot;How much revenue should this entity generate?&quot;).
                <br />
                <strong>Credit Limit</strong> represents strict risk tolerance (&quot;What maximum outstanding exposure is allowed at any moment?&quot;).
                These are stored, calculated, and tracked completely independently.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              <Card>
                <CardHeader>
                  <CardTitle>Sales Targets (Ambition)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    Monitored against gross sales invoices posted during active target period.
                  </p>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sample Sales Officer Target:</div>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                      PKR 25,000,000 (2.5 Crore)
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Credit Limits (Risk Exposure)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    Monitored against current unpaid receivables and unposted pending credit exposure.
                  </p>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sample Sales Officer Credit Limit:</div>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                      PKR 3,000,000 (30 Lakh)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. OVERRIDE REQUESTS TAB */}
      {activeTab === 'overrides' && (
        <Card>
          <CardHeader>
            <CardTitle>CREDIT OVERRIDE REQUESTS</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={7} rows={4} />
            ) : overrideRequests.length === 0 ? (
              <EmptyState title="No Override Requests" description="No pending credit limit override requests at this time." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Order / Entity</th>
                      <th style={{ padding: '10px 12px' }}>Level</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Limit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Exposure</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Order Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Exceeded By</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrideRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700 }}>{req.entityName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{req.reason}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="warning">{req.level}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatPKR(req.currentLimit)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#EA580C' }}>{formatPKR(req.currentExposure)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatPKR(req.orderAmount)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                          +{formatPKR(req.exceededAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {req.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOverrideDecision(req.id, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleOverrideDecision(req.id, 'REJECTED')}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Badge variant={req.status === 'APPROVED' ? 'success' : 'danger'}>{req.status}</Badge>
                          )}
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

      {/* 5. PERCENTAGE CREDIT CONTROL & DYNAMIC LOCK EMBEDDED TAB */}
      {activeTab === 'percentage-credit' && (
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <PercentageCreditView />
        </div>
      )}

      {/* CONFIGURE LIMIT MODAL */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configure Hierarchical Credit Limit"
      >
        <form onSubmit={handleSaveLimit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Hierarchy Tier Level *</label>
            <select
              value={limitForm.level}
              onChange={(e) => setLimitForm({ ...limitForm, level: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}
            >
              <option value="DEALER">Dealer Level</option>
              <option value="SALES_OFFICER">Sales Officer Level</option>
              <option value="TERRITORY">Territory Level</option>
              <option value="ZONE">Zone Level</option>
              <option value="REGION">Region Level</option>
              <option value="COMPANY">Company Level</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Entity ID or Select Dealer *</label>
            {limitForm.level === 'DEALER' && dealers.length > 0 ? (
              <select
                value={limitForm.entityId}
                onChange={(e) => setLimitForm({ ...limitForm, entityId: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}
                required
              >
                <option value="">Select a dealer...</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Enter UUID of Sales Officer, Territory, Zone, or Region"
                value={limitForm.entityId}
                onChange={(e) => setLimitForm({ ...limitForm, entityId: e.target.value })}
                required
              />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Credit Limit (PKR) *</label>
              <Input
                type="number"
                placeholder="e.g. 10000000"
                value={limitForm.creditLimit}
                onChange={(e) => setLimitForm({ ...limitForm, creditLimit: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Near Limit Warning (%)</label>
              <Input
                type="number"
                placeholder="85"
                value={limitForm.warningThresholdPct}
                onChange={(e) => setLimitForm({ ...limitForm, warningThresholdPct: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Notes / Approval Authority</label>
            <Input
              placeholder="e.g. Authorized by CFO for Q4 season"
              value={limitForm.notes}
              onChange={(e) => setLimitForm({ ...limitForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Credit Limit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
