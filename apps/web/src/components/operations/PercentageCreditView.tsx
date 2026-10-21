/**
 * SHEHSWAR ONE360 - Percentage-Based Credit Control View
 *
 * Formula:
 * Credit % = (Outstanding Credit / Net Sales) * 100
 *
 * Canonical Shehswar ONE360 Architecture:
 * - ListPageTemplate canonical structure
 * - KpiCard responsive metric cards
 * - Card, CardHeader, CardTitle, CardContent
 * - Canonical Badge status pills
 * - Dynamic Order Simulation Modal
 * - Full multi-tier hierarchy monitoring (Dealer -> Sales Officer -> Territory -> Zone -> Region -> Company)
 * - Automatic CREDIT_LOCK when Projected Credit % > Max %
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
import {
  IconCreditCard,
  IconRefresh,
  IconTrendingUp,
  IconFinance,
  IconAlertTriangle,
  IconDealers,
  IconCheck,
  IconDownload,
  IconFileText,
} from '../icons';
import {
  exportPercentageCreditReportPdf,
  exportPercentageCreditReportCsv,
} from '../../lib/executive-reports-export';

interface PercentageCreditSummary {
  totalDealers: number;
  totalSales: number;
  totalCollections: number;
  totalOutstanding: number;
  overallCreditPercentage: number;
  defaultMaxCreditPercentage: number;
  creditLockCount: number;
  nearLimitCount: number;
  withinLimitCount: number;
}

interface PercentageCreditItem {
  id: string;
  dealerId: string;
  dealerCode: string;
  dealerName: string;
  officerName: string;
  territoryName: string;
  regionName: string;
  netSales: number;
  collections: number;
  outstandingCredit: number;
  creditPercentage: number;
  maxCreditPercentage: number;
  maxAllowedCredit: number;
  availableCredit: number;
  status: 'WITHIN_LIMIT' | 'NEAR_LIMIT' | 'LIMIT_REACHED' | 'CREDIT_LOCK' | 'PENDING_APPROVAL';
  creditLock: boolean;
}

export const PercentageCreditView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PercentageCreditSummary | null>(null);
  const [items, setItems] = useState<PercentageCreditItem[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Simulation Modal
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<PercentageCreditItem | null>(null);
  const [newOrderAmount, setNewOrderAmount] = useState<number>(60000);

  // Fetch Companies
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

  // Fetch Report
  const fetchReport = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const res: any = await ApiClient.get<{ summary: PercentageCreditSummary; items: PercentageCreditItem[] }>(
        `/api/v1/credit/percentage-report?companyId=${selectedCompanyId}`
      );
      const payload = res?.data || res;
      if (payload) {
        setSummary(payload.summary);
        setItems(payload.items || []);
      }
    } catch (err) {
      console.error('Error fetching percentage credit report', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
      case 'CREDIT_LOCK':
        return (
          <Badge variant="danger" size="sm" dot pulse>
            CREDIT LOCK
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

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.dealerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dealerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.officerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.territoryName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate simulation
  const projectedOutstanding = (selectedDealer?.outstandingCredit || 0) + Number(newOrderAmount || 0);
  const netSales = selectedDealer?.netSales || 0;
  const maxPercent = selectedDealer?.maxCreditPercentage || 20.0;
  const projectedCreditPercent = netSales > 0 ? Math.round((projectedOutstanding / netSales) * 10000) / 100 : 0;
  const isSimLock = projectedCreditPercent > maxPercent;

  return (
    <ListPageTemplate
      title="Percentage-Based Credit Control"
      subtitle="Authoritative real-time credit ratio monitoring (Credit % = Outstanding Credit / Net Sales × 100), dynamic CREDIT_LOCK & automated payment release"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              if (items.length > 0) setSelectedDealer(items[0] || null);
              setIsSimulateOpen(true);
            }}
          >
            <IconTrendingUp size={14} /> Order Credit Simulator
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const compName = companies.find((c) => c.id === selectedCompanyId)?.name || 'Shehswar Group';
              exportPercentageCreditReportPdf({
                companyName: compName,
                items: filteredItems,
                summary: summary || {
                  totalDealers: items.length,
                  totalSales: items.reduce((s, i) => s + (i.netSales || 0), 0),
                  totalCollections: items.reduce((s, i) => s + (i.collections || 0), 0),
                  totalOutstanding: items.reduce((s, i) => s + (i.outstandingCredit || 0), 0),
                  overallCreditPercentage: 0,
                  defaultMaxCreditPercentage: 20,
                  creditLockCount: items.filter((i) => i.creditLock).length,
                  nearLimitCount: items.filter((i) => i.status === 'NEAR_LIMIT').length,
                  withinLimitCount: items.filter((i) => i.status === 'WITHIN_LIMIT').length,
                },
              });
            }}
          >
            <IconDownload size={14} /> PDF Report
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              exportPercentageCreditReportCsv(filteredItems, 'Shehswar_Percentage_Credit_Report');
            }}
          >
            <IconFileText size={14} /> Export CSV
          </Button>

          <Button variant="outline" onClick={fetchReport}>
            <IconRefresh size={14} /> Refresh
          </Button>
        </div>
      }
    >
      {/* Separation Architecture Notice Banner */}
      <Card
        style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          marginBottom: 'var(--space-md, 16px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-primary)' }}>
          <IconAlertTriangle size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span>
            <strong>Architectural Separation:</strong> <em>Credit %</em> (Receivable exposure vs Sales) is strictly separated from <em>Employee Cost %</em> (Salary + Fuel + Expenses vs Sales). Dynamic credit locks prevent credit invoicing when outstanding exposure exceeds {summary?.defaultMaxCreditPercentage || 20}% of sales, and automatically unlock when dealer payments are posted.
          </span>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-md, 16px)',
          marginBottom: 'var(--space-lg, 24px)',
        }}
      >
        <KpiCard
          title="Dealers Monitored"
          value={summary?.totalDealers ?? 0}
          subtitle="Customer trading accounts"
          icon={<IconDealers size={20} />}
          accentColor="#3b82f6"
        />
        <KpiCard
          title="Total Net Sales"
          value={`PKR ${formatPkr(summary?.totalSales)}`}
          subtitle="Authoritative posted sales"
          icon={<IconTrendingUp size={20} />}
          accentColor="#2563eb"
        />
        <KpiCard
          title="Posted Collections"
          value={`PKR ${formatPkr(summary?.totalCollections)}`}
          subtitle="Authoritative credit releases"
          icon={<IconCheck size={20} />}
          accentColor="#10b981"
        />
        <KpiCard
          title="Outstanding Credit"
          value={`PKR ${formatPkr(summary?.totalOutstanding)}`}
          subtitle="Current debtor exposure"
          icon={<IconCreditCard size={20} />}
          accentColor="#ea580c"
        />
        <KpiCard
          title="Overall Credit %"
          value={`${summary?.overallCreditPercentage ?? 0}%`}
          subtitle={`Allowed Max: ${summary?.defaultMaxCreditPercentage || 20}%`}
          badge={(summary?.overallCreditPercentage || 0) > 20 ? 'OVER LIMIT' : 'HEALTHY'}
          accentColor={(summary?.overallCreditPercentage || 0) > 20 ? '#ef4444' : '#10b981'}
          icon={<IconFinance size={20} />}
        />
        <KpiCard
          title="Accounts Locked"
          value={summary?.creditLockCount ?? 0}
          subtitle="Require payment to unlock"
          badge={summary?.creditLockCount ? 'LOCKED' : 'CLEAR'}
          accentColor="#ef4444"
          icon={<IconAlertTriangle size={20} />}
        />
      </div>

      {/* Filter Toolbar */}
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
            <div style={{ width: '260px' }}>
              <Input
                placeholder="Search dealer / code / officer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

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
                <option value="CREDIT_LOCK">Credit Lock</option>
              </select>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={fetchReport}>
            <IconRefresh size={14} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Master Credit Percentage Register Table */}
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
            <CardTitle>Dealer Credit Exposure & Percentage Register</CardTitle>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing {filteredItems.length} of {items.length} accounts
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Within Limit (&lt; 18%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              Near Limit (18% - 20%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              Locked (&gt; 20%)
            </span>
          </div>
        </CardHeader>

        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              minWidth: '1100px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 'var(--font-size-xs, 12px)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-canvas, #f8fafc)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 14px' }}>Dealer</th>
                <th style={{ padding: '12px 14px' }}>Sales Officer / Territory</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net Sales</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Collections</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Outstanding Credit</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Credit %</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Max %</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Available Credit</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading percentage credit monitoring records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No dealer accounts match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      backgroundColor: item.status === 'CREDIT_LOCK' ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.dealerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.dealerCode}</div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{item.officerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.territoryName} • {item.regionName}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#2563EB' }}>
                      {formatPkr(item.netSales)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#10B981', fontWeight: 500 }}>
                      {formatPkr(item.collections)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: item.status === 'CREDIT_LOCK' ? '#EF4444' : '#EA580C' }}>
                      {formatPkr(item.outstandingCredit)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor:
                            item.creditPercentage > item.maxCreditPercentage
                              ? 'rgba(239, 68, 68, 0.12)'
                              : item.creditPercentage >= item.maxCreditPercentage * 0.9
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(16, 185, 129, 0.12)',
                          color:
                            item.creditPercentage > item.maxCreditPercentage
                              ? '#EF4444'
                              : item.creditPercentage >= item.maxCreditPercentage * 0.9
                              ? '#F59E0B'
                              : '#10B981',
                        }}
                      >
                        {item.creditPercentage.toFixed(2)}%
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {item.maxCreditPercentage.toFixed(1)}%
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: item.availableCredit > 0 ? '#10B981' : '#94A3B8' }}>
                      {formatPkr(item.availableCredit)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {getStatusBadge(item.status)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDealer(item);
                          setIsSimulateOpen(true);
                        }}
                      >
                        Simulate Order
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dynamic Order Simulator Modal */}
      <Modal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        title={`Projected Credit Simulation: ${selectedDealer?.dealerName || 'Select Account'}`}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Dealer:</label>
            <select
              value={selectedDealer?.dealerId || ''}
              onChange={(e) => {
                const found = items.find((d) => d.dealerId === e.target.value);
                if (found) setSelectedDealer(found);
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
              {items.map((d) => (
                <option key={d.dealerId} value={d.dealerId}>
                  {d.dealerName} ({d.dealerCode} - Current: {d.creditPercentage}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>New Credit Order Amount (PKR):</label>
            <Input
              type="number"
              value={newOrderAmount}
              onChange={(e) => setNewOrderAmount(Number(e.target.value))}
              style={{ marginTop: '4px' }}
            />
          </div>

          {selectedDealer && (
            <Card
              style={{
                padding: '16px',
                backgroundColor: isSimLock ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-canvas)',
                border: `1px solid ${isSimLock ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-default)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Order Impact:</span>
                <div>{isSimLock ? getStatusBadge('CREDIT_LOCK') : getStatusBadge('WITHIN_LIMIT')}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Net Sales:</div>
                  <div style={{ fontWeight: 600 }}>PKR {formatPkr(netSales)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Current Balance:</div>
                  <div style={{ fontWeight: 600 }}>PKR {formatPkr(selectedDealer.outstandingCredit)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>New Order:</div>
                  <div style={{ fontWeight: 600, color: '#2563EB' }}>+ PKR {formatPkr(newOrderAmount)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Projected Exposure:</div>
                  <div style={{ fontWeight: 700, color: '#EA580C' }}>PKR {formatPkr(projectedOutstanding)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Projected Credit %:</div>
                  <div style={{ fontWeight: 700, color: isSimLock ? '#EF4444' : '#10B981' }}>
                    {projectedCreditPercent}%
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Allowed Limit %:</div>
                  <div style={{ fontWeight: 600 }}>{maxPercent}%</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: isSimLock ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: isSimLock ? '#EF4444' : '#10B981',
                }}
              >
                {isSimLock ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconAlertTriangle size={14} />
                    <span><strong>ORDER BLOCKED:</strong> Projected credit exposure ({projectedCreditPercent}%) exceeds allowable ceiling ({maxPercent}%). An override or posted collection is required.</span>
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconCheck size={14} />
                    <span><strong>ORDER ALLOWED:</strong> Projected exposure ({projectedCreditPercent}%) is within the allowable ${maxPercent}% ceiling.</span>
                  </span>
                )}
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="outline" onClick={() => setIsSimulateOpen(false)}>
              Close Simulator
            </Button>
          </div>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};
