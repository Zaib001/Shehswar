'use client';

/**
 * SHEHSWAR ONE360 - Hierarchical Credit Control Dashboard & Management
 *
 * Implements authoritative 5-Tier Credit Control:
 *   DEALER → SALES OFFICER → TERRITORY → ZONE → REGION → COMPANY
 *
 * Core Capabilities:
 * - Real-time Credit Exposure vs Limits Dashboard
 * - Dynamic, user-friendly Entity Selectors (No raw UUID entry!)
 * - Live Dealer Financial Summary with Dealer Master single source of truth
 * - Credit Lock alert when Used Credit >= Credit Limit
 * - Configurable Limit Rules (Dealer, SO, Territory, Zone, Region)
 * - Automatic Credit Hold Monitoring
 * - Credit Override Management Approval Workflow
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  IconSearch,
  IconChevronDown,
  IconCheck,
  IconLock,
  IconEdit,
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

// -------------------------------------------------------------
// RESPONSIVE SEARCHABLE COMBOBOX COMPONENT (NO UUIDS)
// -------------------------------------------------------------
interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  code?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (val: string) => void;
  options: ComboboxOption[];
  required?: boolean;
}

const SearchableEntitySelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder = 'Select entity...',
  searchPlaceholder = 'Search by name or code...',
  value,
  onChange,
  options,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.code && opt.code.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const fullDisplayTitle = selectedOption
    ? `${selectedOption.code ? `[${selectedOption.code}] ` : ''}${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ''}`
    : '';

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        position: 'relative',
      }}
    >
      <label
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary, #475569)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      {/* Trigger */}
      <button
        type="button"
        title={fullDisplayTitle || placeholder}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === 'Tab') {
            setIsOpen(false);
          }
        }}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: '38px',
          padding: '0 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-default, #cbd5e1)',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          fontSize: '13px',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selectedOption ? '#1e293b' : '#94a3b8',
            fontWeight: selectedOption ? 500 : 400,
          }}
        >
          {selectedOption ? (
            <>
              {selectedOption.code && (
                <span style={{ fontWeight: 600, color: 'var(--color-primary, #1e40af)', marginRight: '6px' }}>
                  [{selectedOption.code}]
                </span>
              )}
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>
                  ({selectedOption.sublabel})
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <IconChevronDown size={14} style={{ color: '#64748b', flexShrink: 0, marginLeft: '8px' }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            maxHeight: '260px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconSearch size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                color: '#1e293b',
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    title={`${opt.label} ${opt.sublabel ? `(${opt.sublabel})` : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isHighlighted ? '#f1f5f9' : isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? '#1d4ed8' : '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.code && (
                          <span style={{ fontWeight: 700, color: '#2563eb', marginRight: '6px' }}>
                            [{opt.code}]
                          </span>
                        )}
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <IconCheck size={14} style={{ color: '#2563eb', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Hierarchy Entities for Friendly Dropdowns (No UUIDs!)
  const [dealers, setDealers] = useState<any[]>([]);
  const [salesOfficers, setSalesOfficers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  // Config Limit Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [limitForm, setLimitForm] = useState({
    level: 'DEALER',
    entityId: '',
    creditLimit: '',
    warningThresholdPct: '85',
    notes: '',
  });

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

  // Fetch Dashboard, Limits & Market Hierarchy
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [
        dashRes,
        limitsRes,
        overrideRes,
        dealerRes,
        userRes,
        terrRes,
        zoneRes,
        regRes,
      ] = await Promise.all([
        activeTab === 'dashboard'
          ? ApiClient.get<any>(`/api/v1/credit/dashboard?companyId=${companyId}`).catch(() => null)
          : Promise.resolve(null),
        activeTab === 'limits'
          ? ApiClient.get<any[]>(`/api/v1/credit/limits?companyId=${companyId}`).catch(() => [])
          : Promise.resolve([]),
        activeTab === 'overrides'
          ? ApiClient.get<any[]>(`/api/v1/credit/overrides?companyId=${companyId}`).catch(() => [])
          : Promise.resolve([]),
        ApiClient.get<any>(`/api/v1/dealers?companyId=${companyId}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/users`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/territories?companyId=${companyId}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/zones?companyId=${companyId}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/regions?companyId=${companyId}`).catch(() => ({ data: [] })),
      ]);

      if (dashRes) setDashboardData((dashRes as any)?.data || dashRes);
      if (limitsRes) setLimitsList((limitsRes as any)?.data || limitsRes || []);
      if (overrideRes) setOverrideRequests((overrideRes as any)?.data || overrideRes || []);

      setDealers(Array.isArray(dealerRes.data) ? dealerRes.data : dealerRes.data?.data || []);
      setSalesOfficers(Array.isArray(userRes.data) ? userRes.data : userRes.data?.data || []);
      setTerritories(Array.isArray(terrRes.data) ? terrRes.data : terrRes.data?.data || []);
      setZones(Array.isArray(zoneRes.data) ? zoneRes.data : zoneRes.data?.data || []);
      setRegions(Array.isArray(regRes.data) ? regRes.data : regRes.data?.data || []);
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to load credit control data' });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When a dealer is selected, pre-fill its credit limit from Dealer Master single source of truth
  const handleDealerChange = (selectedDealerId: string) => {
    const selected = dealers.find((d) => d.id === selectedDealerId);
    setLimitForm((prev) => ({
      ...prev,
      entityId: selectedDealerId,
      creditLimit: selected ? String(Number(selected.creditLimit || 0)) : prev.creditLimit,
    }));
  };

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitForm.entityId) {
      showToast({ type: 'warning', title: 'Validation Error', message: 'Please select an entity from the list' });
      return;
    }
    if (!limitForm.creditLimit || Number(limitForm.creditLimit) < 0) {
      showToast({ type: 'warning', title: 'Validation Error', message: 'Credit limit cannot be negative' });
      return;
    }
    try {
      await ApiClient.post('/api/v1/credit/limits', {
        level: limitForm.level,
        entityId: limitForm.entityId,
        companyId,
        creditLimit: Number(limitForm.creditLimit),
        warningThresholdPct: Number(limitForm.warningThresholdPct || 85),
        notes: limitForm.notes || undefined,
      });

      showToast({
        type: 'success',
        title: 'Credit Limit Configured',
        message: limitForm.level === 'DEALER'
          ? 'Authoritative Dealer Master credit limit synchronized successfully'
          : `${limitForm.level} limit updated successfully`,
      });

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
      showToast({ type: 'error', title: 'Save Failed', message: err.message || 'Failed to update credit limit' });
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

  // Find selected dealer for live detail display
  const currentSelectedDealer = limitForm.level === 'DEALER' && limitForm.entityId
    ? dealers.find((d) => d.id === limitForm.entityId)
    : null;

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
            5-Tier exposure enforcement (Dealer → Sales Officer → Territory → Zone → Region) with Dealer Master synchronization
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {companies.length > 1 && (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const comp = companies.find((c) => c.id === companyId);
              const compName = comp ? comp.name : 'Shehswar Enterprise';
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
                const dlrs = dashboardData?.dealers || dashboardData?.items || [];
                exportCreditDashboardReportPdf({
                  companyName: compName,
                  dealers: dlrs,
                  summary: dashboardData?.summary || dashboardData?.kpis,
                });
              }
            }}
          >
            <IconDownload size={14} /> Export PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'limits') {
                exportConfiguredLimitsReportCsv(limitsList, 'Shehswar_Configured_Credit_Limits');
              } else if (activeTab === 'overrides') {
                exportCreditOverridesReportCsv(overrideRequests, 'Shehswar_Credit_Overrides_Audit');
              } else {
                const dlrs = dashboardData?.dealers || dashboardData?.items || [];
                exportCreditDashboardReportCsv(dlrs, 'Shehswar_Credit_Limits_and_Exposure');
              }
            }}
          >
            <IconFileText size={14} /> Export CSV
          </Button>

          <Button variant="outline" size="sm" onClick={fetchData} icon={<IconRefresh size={14} />}>
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setLimitForm({
                level: 'DEALER',
                entityId: '',
                creditLimit: '',
                warningThresholdPct: '85',
                notes: '',
              });
              setIsConfigModalOpen(true);
            }}
            icon={<IconPlus size={14} />}
          >
            Configure Limit
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '8px',
        }}
      >
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
                      {dashboardData.dealers.map((d: any) => {
                        const isOver = (d.exposure || 0) >= (d.limit || 0) && (d.limit || 0) > 0;
                        return (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>{d.code}</span>
                                {d.officerName && ` • SO: ${d.officerName}`}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {d.regionName} → {d.zoneName} → {d.territoryName}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {formatPKR(d.limit)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: isOver ? '#DC2626' : '#EA580C' }}>
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
                                  d.status === 'CREDIT_HOLD' || isOver
                                    ? 'danger'
                                    : d.status === 'NEAR_LIMIT'
                                    ? 'warning'
                                    : 'success'
                                }
                              >
                                {isOver ? 'CREDIT LOCKED' : d.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CONFIGURED LIMITS TAB */}
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
                      <th style={{ padding: '10px 12px' }}>Entity Details</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit Limit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Warning Threshold</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Effective Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitsList.map((lim) => (
                      <tr key={lim.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="primary">{lim.level}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          <div>{lim.entityName || lim.entityId}</div>
                          {lim.level === 'DEALER' && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Synchronized with Dealer Master
                            </div>
                          )}
                        </td>
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
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLimitForm({
                                level: lim.level,
                                entityId: lim.entityId,
                                creditLimit: String(lim.creditLimit),
                                warningThresholdPct: String(lim.nearLimitThresholdPercent || 85),
                                notes: lim.notes || '',
                              });
                              setIsConfigModalOpen(true);
                            }}
                          >
                            <IconEdit size={13} /> Edit
                          </Button>
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

      {/* 3. TARGET VS LIMIT TAB */}
      {activeTab === 'targets' && (
        <Card>
          <CardHeader>
            <CardTitle>SALES TARGET VS CREDIT LIMIT INDEPENDENCE AUDIT</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>
                Core Enterprise Policy:
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
                      <th style={{ padding: '10px 12px' }}>Order ID</th>
                      <th style={{ padding: '10px 12px' }}>Entity Level</th>
                      <th style={{ padding: '10px 12px' }}>Entity</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Order Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Exceeded Amount</th>
                      <th style={{ padding: '10px 12px' }}>Reason</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrideRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{req.salesOrderId?.slice(0, 8)}...</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="primary">{req.level}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{req.entityName}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {formatPKR(req.orderAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                          {formatPKR(req.exceededAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{req.reason}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {req.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOverrideDecision(req.id, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
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

      {/* ------------------------------------------------------------- */}
      {/* CONFIGURE HIERARCHICAL CREDIT LIMIT MODAL (NO RAW UUIDS!) */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configure Hierarchical Credit Limit"
        size="lg"
      >
        <form onSubmit={handleSaveLimit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Level Selector */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Hierarchy Tier Level *
            </label>
            <select
              value={limitForm.level}
              onChange={(e) => {
                const nextLevel = e.target.value;
                setLimitForm({
                  ...limitForm,
                  level: nextLevel,
                  entityId: '',
                  creditLimit: '',
                });
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                fontWeight: 500,
              }}
            >
              <option value="DEALER">Dealer Level (Syncs Dealer Master Single Source of Truth)</option>
              <option value="SALES_OFFICER">Sales Officer Level</option>
              <option value="TERRITORY">Territory Level</option>
              <option value="ZONE">Zone Level</option>
              <option value="REGION">Region Level</option>
              <option value="COMPANY">Company Level</option>
            </select>
          </div>

          {/* DYNAMIC BUSINESS ENTITY SELECTOR (REPLACES RAW UUID INPUT) */}
          <div>
            {limitForm.level === 'DEALER' && (
              <SearchableEntitySelect
                label="Select Dealer *"
                placeholder="Choose dealer from master database..."
                searchPlaceholder="Search dealer name, shop, or DLR code..."
                value={limitForm.entityId}
                onChange={handleDealerChange}
                options={dealers.map((d) => ({
                  value: d.id,
                  code: d.code,
                  label: d.name,
                  sublabel: `${d.city || ''}${d.territory?.name ? ` • Territory: ${d.territory.name}` : ''}`,
                }))}
                required
              />
            )}

            {limitForm.level === 'SALES_OFFICER' && (
              <SearchableEntitySelect
                label="Select Sales Officer *"
                placeholder="Choose sales officer..."
                searchPlaceholder="Search officer name or email..."
                value={limitForm.entityId}
                onChange={(val) => setLimitForm({ ...limitForm, entityId: val })}
                options={salesOfficers.map((u) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                  sublabel: u.email || u.phone,
                }))}
                required
              />
            )}

            {limitForm.level === 'TERRITORY' && (
              <SearchableEntitySelect
                label="Select Territory *"
                placeholder="Choose territory..."
                searchPlaceholder="Search territory name or code..."
                value={limitForm.entityId}
                onChange={(val) => setLimitForm({ ...limitForm, entityId: val })}
                options={territories.map((t) => ({
                  value: t.id,
                  code: t.code,
                  label: t.name,
                  sublabel: t.zone?.name ? `${t.zone.name} → ${t.zone.region?.name || ''}` : undefined,
                }))}
                required
              />
            )}

            {limitForm.level === 'ZONE' && (
              <SearchableEntitySelect
                label="Select Zone *"
                placeholder="Choose zone..."
                searchPlaceholder="Search zone name or code..."
                value={limitForm.entityId}
                onChange={(val) => setLimitForm({ ...limitForm, entityId: val })}
                options={zones.map((z) => ({
                  value: z.id,
                  code: z.code,
                  label: z.name,
                  sublabel: z.region?.name ? `Region: ${z.region.name}` : undefined,
                }))}
                required
              />
            )}

            {limitForm.level === 'REGION' && (
              <SearchableEntitySelect
                label="Select Region *"
                placeholder="Choose region..."
                searchPlaceholder="Search region name or code..."
                value={limitForm.entityId}
                onChange={(val) => setLimitForm({ ...limitForm, entityId: val })}
                options={regions.map((r) => ({
                  value: r.id,
                  code: r.code,
                  label: r.name,
                }))}
                required
              />
            )}

            {limitForm.level === 'COMPANY' && (
              <SearchableEntitySelect
                label="Select Company *"
                placeholder="Choose company..."
                value={limitForm.entityId}
                onChange={(val) => setLimitForm({ ...limitForm, entityId: val })}
                options={companies.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                required
              />
            )}
          </div>

          {/* DYNAMIC DEALER FINANCIAL SUMMARY CARD (SINGLE SOURCE OF TRUTH) */}
          {currentSelectedDealer && (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                backgroundColor: '#f0f9ff',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e3a8a' }}>
                    {currentSelectedDealer.name} ({currentSelectedDealer.code})
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                    📍 {currentSelectedDealer.territory?.name || 'Unassigned Territory'}
                    {currentSelectedDealer.territory?.zone?.name && (
                      <span> ({currentSelectedDealer.territory.zone.name} → {currentSelectedDealer.territory.zone.region?.name})</span>
                    )}
                  </div>
                </div>

                {/* Live Risk Status / Credit Lock */}
                {Number(currentSelectedDealer.currentBalance || 0) >= Number(currentSelectedDealer.creditLimit || 0) && Number(currentSelectedDealer.creditLimit || 0) > 0 ? (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      fontWeight: 800,
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <IconLock size={12} /> CREDIT LOCKED (Limit Exceeded)
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      fontWeight: 700,
                      fontSize: '11px',
                    }}
                  >
                    TRADING ACTIVE
                  </span>
                )}
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>DEALER MASTER LIMIT</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', marginTop: '2px' }}>
                    {formatPKR(currentSelectedDealer.creditLimit)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>USED CREDIT (BALANCE)</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ea580c', marginTop: '2px' }}>
                    {formatPKR(currentSelectedDealer.currentBalance)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>AVAILABLE CREDIT</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                    {formatPKR(Math.max(0, Number(currentSelectedDealer.creditLimit || 0) - Number(currentSelectedDealer.currentBalance || 0)))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>UTILIZATION %</div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      marginTop: '2px',
                      color:
                        Number(currentSelectedDealer.creditLimit || 0) > 0 &&
                        (Number(currentSelectedDealer.currentBalance || 0) / Number(currentSelectedDealer.creditLimit || 1)) >= 1
                          ? '#dc2626'
                          : '#1e293b',
                    }}
                  >
                    {Number(currentSelectedDealer.creditLimit || 0) > 0
                      ? `${Math.round((Number(currentSelectedDealer.currentBalance || 0) / Number(currentSelectedDealer.creditLimit || 1)) * 100)}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#1e40af' }}>
                💡 <em>Updating this limit sets the authoritative Credit Limit in the Dealer Master and synchronizes order approvals.</em>
              </div>
            </div>
          )}

          {/* Limit Form Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Input
                label="New Credit Limit (PKR) *"
                type="number"
                min="0"
                placeholder="e.g. 1000000"
                value={limitForm.creditLimit}
                onChange={(e) => setLimitForm({ ...limitForm, creditLimit: e.target.value })}
                required
              />
            </div>
            <div>
              <Input
                label="Near Limit Warning Threshold (%)"
                type="number"
                min="50"
                max="99"
                placeholder="85"
                value={limitForm.warningThresholdPct}
                onChange={(e) => setLimitForm({ ...limitForm, warningThresholdPct: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Input
              label="Notes / Approval Authority"
              placeholder="e.g. Approved by CFO for cotton harvesting season"
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
