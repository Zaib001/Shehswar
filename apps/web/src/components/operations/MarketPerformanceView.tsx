'use client';

/**
 * SHEHSWAR ONE360 - Interactive Market Performance & Hierarchical Drill-Down Dashboard
 *
 * Implements the complete 6-tier top-down and bottom-up drill-down path:
 * Tier 1: Group (Punjab Total)
 *   ↓
 * Tier 2: Region (Business Manager)
 *   ↓
 * Tier 3: Zone (Area Manager)
 *   ↓
 * Tier 4: Territory (Sales Officer)
 *   ↓
 * Tier 5: Sales Officer Network
 *   ↓
 * Tier 6: Dealer Performance Card (Targets, Credit Snapshot, Products & Invoices)
 *
 * Consistent with Enterprise Design System:
 * - Theme tokens: var(--bg-surface), var(--text-primary), var(--border-subtle), var(--brand-primary)
 * - Zero hardcoded icons / emojis -> Standardized Lucide-based Icon components
 * - Instant View & Download PDF reports across all 6 tiers with official executive formatting
 * - 100% Live DB querying with hierarchy fallback and multi-period presets (This Month, Last Month, YTD, All Time, Custom)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import { SalesInvoiceExportData, exportMarketPerformancePdf } from '../../lib/pdf-export';
import {
  IconTrendingUp,
  IconBuilding,
  IconPackage,
  IconFileText,
  IconRefresh,
  IconPrinter,
  IconShield,
  IconSparkles,
  IconChevronRight,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconSearch,
  IconAlertTriangle,
  IconMapPin,
  IconUser,
} from '../icons';

interface BreadcrumbItem {
  level: 'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'OFFICER' | 'DEALER';
  id?: string;
  name: string;
  code?: string;
}

type PeriodPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'YTD' | 'ALL_TIME' | 'CUSTOM';

export const MarketPerformanceView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Period state
  const now = new Date();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('THIS_MONTH');
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Search filter inside active tier table
  const [tableSearch, setTableSearch] = useState<string>('');

  // Navigation hierarchy state
  const [currentLevel, setCurrentLevel] = useState<'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'OFFICER' | 'DEALER'>('GROUP');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { level: 'GROUP', name: 'Punjab Provincial Total' },
  ]);

  // Data payload for currently active level
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Invoice modal preview state
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoiceExportData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  // Build query string based on active period preset
  const buildPeriodParams = useCallback(() => {
    if (periodPreset === 'THIS_MONTH') {
      return `month=${now.getMonth() + 1}&year=${now.getFullYear()}&period=THIS_MONTH`;
    }
    if (periodPreset === 'LAST_MONTH') {
      return `period=LAST_MONTH&year=${now.getFullYear()}`;
    }
    if (periodPreset === 'YTD') {
      return `period=YTD&year=${selectedYear}`;
    }
    if (periodPreset === 'ALL_TIME') {
      return `period=ALL_TIME&allTime=true`;
    }
    return `month=${selectedMonth}&year=${selectedYear}`;
  }, [periodPreset, selectedMonth, selectedYear]);

  // Fetch performance data depending on current level
  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodQuery = buildPeriodParams();
      let endpoint = `/api/v1/market-performance/group?${periodQuery}`;

      if (currentLevel === 'REGION' && selectedRegionId) {
        endpoint = `/api/v1/market-performance/region/${selectedRegionId}?${periodQuery}`;
      } else if (currentLevel === 'ZONE' && selectedZoneId) {
        endpoint = `/api/v1/market-performance/zone/${selectedZoneId}?${periodQuery}`;
      } else if (currentLevel === 'TERRITORY' && selectedTerritoryId) {
        endpoint = `/api/v1/market-performance/territory/${selectedTerritoryId}?${periodQuery}`;
      } else if (currentLevel === 'OFFICER' && selectedOfficerId) {
        endpoint = `/api/v1/market-performance/officer/${selectedOfficerId}?${periodQuery}`;
      } else if (currentLevel === 'DEALER' && selectedDealerId) {
        endpoint = `/api/v1/market-performance/dealer/${selectedDealerId}?${periodQuery}`;
      }

      const res = await ApiClient.get<any>(endpoint);
      if (res.data) {
        setPerformanceData(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load performance metrics from server');
    } finally {
      setLoading(false);
    }
  }, [currentLevel, selectedRegionId, selectedZoneId, selectedTerritoryId, selectedOfficerId, selectedDealerId, buildPeriodParams]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Navigation Handlers
  const navigateToGroup = () => {
    setCurrentLevel('GROUP');
    setSelectedRegionId(null);
    setSelectedZoneId(null);
    setSelectedTerritoryId(null);
    setSelectedOfficerId(null);
    setSelectedDealerId(null);
    setTableSearch('');
    setBreadcrumbs([{ level: 'GROUP', name: 'Punjab Provincial Total' }]);
  };

  const navigateToRegion = (regionId: string, regionName: string, regionCode?: string) => {
    setSelectedRegionId(regionId);
    setCurrentLevel('REGION');
    setTableSearch('');
    setBreadcrumbs([
      { level: 'GROUP', name: 'Punjab Provincial Total' },
      { level: 'REGION', id: regionId, name: regionName, code: regionCode },
    ]);
  };

  const navigateToZone = (zoneId: string, zoneName: string, zoneCode?: string) => {
    setSelectedZoneId(zoneId);
    setCurrentLevel('ZONE');
    setTableSearch('');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 2),
      { level: 'ZONE', id: zoneId, name: zoneName, code: zoneCode },
    ]);
  };

  const navigateToTerritory = (territoryId: string, territoryName: string, territoryCode?: string) => {
    setSelectedTerritoryId(territoryId);
    setCurrentLevel('TERRITORY');
    setTableSearch('');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 3),
      { level: 'TERRITORY', id: territoryId, name: territoryName, code: territoryCode },
    ]);
  };

  const navigateToOfficer = (officerId: string, officerName: string) => {
    setSelectedOfficerId(officerId);
    setCurrentLevel('OFFICER');
    setTableSearch('');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 4),
      { level: 'OFFICER', id: officerId, name: officerName },
    ]);
  };

  const navigateToDealer = (dealerId: string, dealerName: string, dealerCode?: string) => {
    setSelectedDealerId(dealerId);
    setCurrentLevel('DEALER');
    setTableSearch('');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 5),
      { level: 'DEALER', id: dealerId, name: dealerName, code: dealerCode },
    ]);
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem, index: number) => {
    if (index === breadcrumbs.length - 1) return;
    setTableSearch('');
    if (item.level === 'GROUP') navigateToGroup();
    else if (item.level === 'REGION' && item.id) {
      setSelectedRegionId(item.id);
      setCurrentLevel('REGION');
      setBreadcrumbs(breadcrumbs.slice(0, 2));
    } else if (item.level === 'ZONE' && item.id) {
      setSelectedZoneId(item.id);
      setCurrentLevel('ZONE');
      setBreadcrumbs(breadcrumbs.slice(0, 3));
    } else if (item.level === 'TERRITORY' && item.id) {
      setSelectedTerritoryId(item.id);
      setCurrentLevel('TERRITORY');
      setBreadcrumbs(breadcrumbs.slice(0, 4));
    } else if (item.level === 'OFFICER' && item.id) {
      setSelectedOfficerId(item.id);
      setCurrentLevel('OFFICER');
      setBreadcrumbs(breadcrumbs.slice(0, 5));
    }
  };

  // Preview an individual invoice
  const openInvoicePreview = async (invoiceId: string) => {
    try {
      const res = await ApiClient.get<any>(`/api/v1/sales-invoices/${invoiceId}`);
      if (res.data) {
        setActiveInvoice(res.data);
        setIsInvoiceModalOpen(true);
      }
    } catch {
      alert('Could not fetch invoice details.');
    }
  };

  const metrics = performanceData?.metrics || {};
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Helper: Format currency
  const fmtPKR = (amount: number | string | undefined | null) => {
    const val = Number(amount || 0);
    return `PKR ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // Helper: Achievement Badge
  const renderAchievementBadge = (pct: number) => {
    let bg = 'rgba(239, 68, 68, 0.12)';
    let color = '#ef4444';
    let text = 'Needs Focus';

    if (pct >= 100) {
      bg = 'rgba(16, 185, 129, 0.15)';
      color = '#10b981';
      text = 'Target Met';
    } else if (pct >= 75) {
      bg = 'rgba(2, 132, 199, 0.15)';
      color = '#0284c7';
      text = 'On Track';
    } else if (pct >= 40) {
      bg = 'rgba(234, 88, 12, 0.15)';
      color = '#ea580c';
      text = 'Moderate';
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11.5px',
            fontWeight: 800,
            background: bg,
            color,
            fontFamily: 'monospace',
          }}
        >
          {pct}%
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{text}</span>
      </div>
    );
  };

  // Filtered rows for Tier 1: Regions
  const filteredRegions = useMemo(() => {
    if (!performanceData?.regions) return [];
    if (!tableSearch.trim()) return performanceData.regions;
    const q = tableSearch.toLowerCase();
    return performanceData.regions.filter(
      (r: any) =>
        r.regionName?.toLowerCase().includes(q) ||
        r.regionCode?.toLowerCase().includes(q) ||
        r.businessManager?.toLowerCase().includes(q)
    );
  }, [performanceData?.regions, tableSearch]);

  // Filtered rows for Tier 2: Zones
  const filteredZones = useMemo(() => {
    if (!performanceData?.zones) return [];
    if (!tableSearch.trim()) return performanceData.zones;
    const q = tableSearch.toLowerCase();
    return performanceData.zones.filter(
      (z: any) =>
        z.zoneName?.toLowerCase().includes(q) ||
        z.zoneCode?.toLowerCase().includes(q) ||
        z.areaManager?.toLowerCase().includes(q)
    );
  }, [performanceData?.zones, tableSearch]);

  // Filtered rows for Tier 3: Territories
  const filteredTerritories = useMemo(() => {
    if (!performanceData?.territories) return [];
    if (!tableSearch.trim()) return performanceData.territories;
    const q = tableSearch.toLowerCase();
    return performanceData.territories.filter(
      (t: any) =>
        t.territoryName?.toLowerCase().includes(q) ||
        t.territoryCode?.toLowerCase().includes(q) ||
        t.primaryOfficer?.toLowerCase().includes(q)
    );
  }, [performanceData?.territories, tableSearch]);

  // Filtered rows for Tier 4: Officers
  const filteredOfficers = useMemo(() => {
    if (!performanceData?.officers) return [];
    if (!tableSearch.trim()) return performanceData.officers;
    const q = tableSearch.toLowerCase();
    return performanceData.officers.filter(
      (o: any) => o.officerName?.toLowerCase().includes(q)
    );
  }, [performanceData?.officers, tableSearch]);

  // Filtered rows for Tier 5: Dealers
  const filteredDealers = useMemo(() => {
    if (!performanceData?.dealers) return [];
    if (!tableSearch.trim()) return performanceData.dealers;
    const q = tableSearch.toLowerCase();
    return performanceData.dealers.filter(
      (d: any) =>
        d.dealerName?.toLowerCase().includes(q) ||
        d.dealerCode?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q)
    );
  }, [performanceData?.dealers, tableSearch]);

  // Filtered products for Tier 6 and provincial formulation drill-down
  const filteredProducts = useMemo(() => {
    if (!performanceData?.products) return [];
    if (!tableSearch.trim()) return performanceData.products;
    const q = tableSearch.toLowerCase();
    return performanceData.products.filter(
      (p: any) =>
        p.productName?.toLowerCase().includes(q) ||
        p.packing?.toLowerCase().includes(q)
    );
  }, [performanceData?.products, tableSearch]);

  // Dynamic chart entities based on active drill-down tier
  const chartEntities = useMemo(() => {
    if (!performanceData) return [];
    if (currentLevel === 'GROUP') {
      return (performanceData.regions || []).map((r: any) => ({
        id: r.regionId,
        name: r.regionName,
        code: r.regionCode,
        target: Number(r.target || 0),
        actual: Number(r.actualSales || 0),
        achievement: Number(r.achievementPercent || 0),
        subtitle: r.businessManager || 'Business Manager',
        onClick: () => navigateToRegion(r.regionId, r.regionName, r.regionCode),
      }));
    }
    if (currentLevel === 'REGION') {
      return (performanceData.zones || []).map((z: any) => ({
        id: z.zoneId,
        name: z.zoneName,
        code: z.zoneCode,
        target: Number(z.target || 0),
        actual: Number(z.actualSales || 0),
        achievement: Number(z.achievementPercent || 0),
        subtitle: z.areaManager || 'Area Manager',
        onClick: () => navigateToZone(z.zoneId, z.zoneName, z.zoneCode),
      }));
    }
    if (currentLevel === 'ZONE') {
      return (performanceData.territories || []).map((t: any) => ({
        id: t.territoryId,
        name: t.territoryName,
        code: t.territoryCode,
        target: Number(t.target || 0),
        actual: Number(t.actualSales || 0),
        achievement: Number(t.achievementPercent || 0),
        subtitle: t.primaryOfficer || 'Sales Officer',
        onClick: () => navigateToTerritory(t.territoryId, t.territoryName, t.territoryCode),
      }));
    }
    if (currentLevel === 'TERRITORY' || currentLevel === 'OFFICER') {
      return (performanceData.dealers || []).slice(0, 10).map((d: any) => ({
        id: d.dealerId,
        name: d.dealerName,
        code: d.dealerCode,
        target: Number(d.monthlyTarget || 0),
        actual: Number(d.actualSales || 0),
        achievement: Number(d.achievementPercent || 0),
        subtitle: d.city || 'Dealer Account',
        onClick: () => navigateToDealer(d.dealerId, d.dealerName, d.dealerCode),
      }));
    }
    return [];
  }, [performanceData, currentLevel]);

  // Distribution metrics for health meter
  const healthStats = useMemo(() => {
    if (!chartEntities.length) return { met: 0, track: 0, moderate: 0, focus: 0, total: 0 };
    let met = 0;
    let track = 0;
    let moderate = 0;
    let focus = 0;
    for (const e of chartEntities) {
      if (e.achievement >= 100) met++;
      else if (e.achievement >= 75) track++;
      else if (e.achievement >= 40) moderate++;
      else focus++;
    }
    return { met, track, moderate, focus, total: chartEntities.length };
  }, [chartEntities]);

  // Max value for bar scaling
  const maxChartValue = useMemo(() => {
    if (!chartEntities.length) return 1;
    return Math.max(...chartEntities.map((e: any) => Math.max(e.target, e.actual)), 1);
  }, [chartEntities]);

  // Tier PDF Export Handler
  const handleExportCurrentTierPdf = () => {
    if (!performanceData) return;
    const periodLabel = performanceData?.period?.periodLabel || `${monthNames[selectedMonth - 1]} ${selectedYear}`;

    if (currentLevel === 'GROUP') {
      exportMarketPerformancePdf({
        tierName: 'Executive Provincial Total',
        scopeTitle: 'Punjab Provincial Total — Operating Regions',
        periodLabel,
        kpis: [
          { label: 'Total Net Revenue', value: fmtPKR(metrics.totalRevenue), sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of assigned target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Total Quantity Sold', value: `${Number(metrics.totalQuantity || 0).toLocaleString()} units`, sub: 'Finished Goods' },
          { label: 'Posted Invoices', value: `${Number(metrics.totalOrders || 0).toLocaleString()}`, sub: 'Zero draft leakage' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Purchased in period', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: fmtPKR(metrics.averageDealerSales), sub: 'Revenue / Active Dealers' },
        ],
        tableTitle: 'Regional Sales Roster (Tier 1: Regions)',
        tableSubtitle: 'Provincial geographic rollup across Business Manager regions',
        headers: [
          { label: 'Region', align: 'left', width: '18%' },
          { label: 'Business Manager', align: 'left', width: '18%' },
          { label: 'Zones', align: 'center', width: '8%' },
          { label: 'Target (PKR)', align: 'right', width: '14%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '14%' },
          { label: 'Achievement', align: 'center', width: '10%' },
          { label: 'Active Dealers', align: 'center', width: '8%' },
          { label: 'Avg Dealer Sales', align: 'right', width: '10%' },
        ],
        rows: (performanceData.regions || []).map((r: any) => [
          { text: `${r.regionName} (${r.regionCode || ''})`, bold: true },
          { text: r.businessManager || 'Unassigned' },
          { text: r.zonesCount, align: 'center' },
          { text: fmtPKR(r.target), align: 'right' },
          { text: fmtPKR(r.actualSales), align: 'right', bold: true },
          {
            text: `${r.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: r.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: r.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: r.activeDealers, align: 'center' },
          { text: fmtPKR(r.averageDealerSales), align: 'right' },
        ]),
      });
    } else if (currentLevel === 'REGION') {
      const reg = performanceData.region || {};
      exportMarketPerformancePdf({
        tierName: 'Regional Scope',
        scopeTitle: `${reg.name} Region`,
        periodLabel,
        metaFields: [
          { label: 'Business Manager', value: reg.businessManager || 'Unassigned' },
          { label: 'Total Zones', value: `${(performanceData.zones || []).length}` },
        ],
        kpis: [
          { label: 'Regional Revenue', value: fmtPKR(metrics.totalRevenue), sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Regional Target', value: fmtPKR(metrics.target), sub: 'Monthly Quota' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of regional target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Regional Accounts', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: fmtPKR(metrics.averageDealerSales), sub: 'Average Order Size' },
        ],
        tableTitle: 'Zonal Breakdown (Tier 2: Zones)',
        tableSubtitle: `Supervised by Business Manager: ${reg.businessManager}`,
        headers: [
          { label: 'Zone', align: 'left', width: '20%' },
          { label: 'Area Manager', align: 'left', width: '20%' },
          { label: 'Territories', align: 'center', width: '10%' },
          { label: 'Target (PKR)', align: 'right', width: '14%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '14%' },
          { label: 'Achievement', align: 'center', width: '10%' },
          { label: 'Active Dealers', align: 'center', width: '12%' },
        ],
        rows: (performanceData.zones || []).map((z: any) => [
          { text: `${z.zoneName} (${z.zoneCode || ''})`, bold: true },
          { text: z.areaManager || 'Unassigned' },
          { text: z.territoriesCount, align: 'center' },
          { text: fmtPKR(z.target), align: 'right' },
          { text: fmtPKR(z.actualSales), align: 'right', bold: true },
          {
            text: `${z.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: z.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: z.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: z.activeDealers, align: 'center' },
        ]),
      });
    } else if (currentLevel === 'ZONE') {
      const zone = performanceData.zone || {};
      exportMarketPerformancePdf({
        tierName: 'Zonal Scope',
        scopeTitle: `${zone.name} Zone`,
        periodLabel,
        metaFields: [
          { label: 'Area Manager', value: zone.areaManager || 'Unassigned' },
          { label: 'Parent Region', value: zone.regionName || '—' },
        ],
        kpis: [
          { label: 'Zone Revenue', value: fmtPKR(metrics.totalRevenue), sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Zone Target', value: fmtPKR(metrics.target), sub: 'Monthly Quota' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of zonal target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Zone Network', color: '#10b981' },
        ],
        tableTitle: 'Territories Breakdown (Tier 3: Territories)',
        tableSubtitle: `Managed by Area Manager: ${zone.areaManager}`,
        headers: [
          { label: 'Territory', align: 'left', width: '22%' },
          { label: 'Primary Sales Officer', align: 'left', width: '22%' },
          { label: 'Target (PKR)', align: 'right', width: '16%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '16%' },
          { label: 'Achievement', align: 'center', width: '12%' },
          { label: 'Active Dealers', align: 'center', width: '12%' },
        ],
        rows: (performanceData.territories || []).map((t: any) => [
          { text: `${t.territoryName} (${t.territoryCode || ''})`, bold: true },
          { text: t.primaryOfficer || 'Direct' },
          { text: fmtPKR(t.target), align: 'right' },
          { text: fmtPKR(t.actualSales), align: 'right', bold: true },
          {
            text: `${t.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: t.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: t.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: t.activeDealers, align: 'center' },
        ]),
      });
    } else if (currentLevel === 'TERRITORY') {
      const terr = performanceData.territory || {};
      exportMarketPerformancePdf({
        tierName: 'Territory Scope',
        scopeTitle: `${terr.name} Territory`,
        periodLabel,
        metaFields: [
          { label: 'Parent Zone', value: terr.zoneName || '—' },
          { label: 'Primary Officer', value: terr.primaryOfficer || 'Unassigned' },
        ],
        kpis: [
          { label: 'Territory Revenue', value: fmtPKR(metrics.totalRevenue), color: 'var(--brand-primary)' },
          { label: 'Territory Target', value: fmtPKR(metrics.target) },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, color: '#10b981' },
        ],
        tableTitle: 'Sales Officers Roster',
        tableSubtitle: `Direct field officers deployed in ${terr.name}`,
        headers: [
          { label: 'Sales Officer', align: 'left', width: '25%' },
          { label: 'Target (PKR)', align: 'right', width: '18%' },
          { label: 'Actual Posted Sales (PKR)', align: 'right', width: '20%' },
          { label: 'Achievement', align: 'center', width: '15%' },
          { label: 'Active Selling Dealers', align: 'center', width: '22%' },
        ],
        rows: (performanceData.officers || []).map((o: any) => [
          { text: o.officerName, bold: true },
          { text: fmtPKR(o.target), align: 'right' },
          { text: fmtPKR(o.actualSales), align: 'right', bold: true },
          {
            text: `${o.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: o.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: o.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: `${o.activeDealers} Dealers`, align: 'center' },
        ]),
      });
    } else if (currentLevel === 'OFFICER') {
      const off = performanceData.officer || {};
      exportMarketPerformancePdf({
        tierName: 'Sales Officer Portfolio',
        scopeTitle: `Sales Officer: ${off.name}`,
        periodLabel,
        metaFields: [
          { label: 'Salary Return Multiple', value: `${performanceData.metrics?.salaryJustificationRatio || 'N/A'}` },
          { label: 'Monthly Base Cost', value: 'PKR 50,000' },
        ],
        kpis: [
          { label: 'Total Posted Sales', value: fmtPKR(metrics.totalRevenue), color: 'var(--brand-primary)' },
          { label: 'Monthly Quota', value: fmtPKR(metrics.target) },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'FO Salary Return', value: `${performanceData.metrics?.salaryJustificationRatio || 'N/A'}`, color: '#10b981' },
        ],
        tableTitle: 'Assigned Dealer Network Accounts',
        tableSubtitle: `Commercial dealer portfolio managed by ${off.name}`,
        headers: [
          { label: 'Dealer Account', align: 'left', width: '28%' },
          { label: 'City', align: 'left', width: '16%' },
          { label: 'Monthly Target (PKR)', align: 'right', width: '18%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '18%' },
          { label: 'Monthly Achievement', align: 'center', width: '12%' },
          { label: 'Orders', align: 'center', width: '8%' },
        ],
        rows: (performanceData.dealers || []).map((d: any) => [
          { text: `${d.dealerName} (${d.dealerCode})`, bold: true },
          { text: d.city },
          { text: fmtPKR(d.monthlyTarget), align: 'right' },
          { text: fmtPKR(d.actualSales), align: 'right', bold: true },
          {
            text: `${d.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: d.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: d.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: d.ordersCount, align: 'center' },
        ]),
      });
    } else if (currentLevel === 'DEALER') {
      const dlr = performanceData.dealer || {};
      const tg = performanceData.targets || {};
      const cc = performanceData.creditControl || {};
      exportMarketPerformancePdf({
        tierName: 'Dealer Target & Performance Card',
        scopeTitle: `${dlr.name} (${dlr.code})`,
        periodLabel,
        metaFields: [
          { label: 'Territory', value: dlr.territory || '—' },
          { label: 'Zone', value: dlr.zone || '—' },
          { label: 'Region', value: dlr.region || '—' },
          { label: 'Field Officer', value: dlr.assignedOfficer || '—' },
          { label: 'Credit Limit', value: fmtPKR(cc.creditLimit) },
          { label: 'Current Exposure', value: fmtPKR(cc.currentBalance) },
        ],
        kpis: [
          { label: 'Period Actual Sales', value: fmtPKR(tg.monthlyActualSales), color: 'var(--brand-primary)' },
          { label: 'Period Target', value: fmtPKR(tg.monthlyTarget) },
          { label: 'Period Achievement', value: `${tg.monthlyAchievementPercent || 0}%`, color: Number(tg.monthlyAchievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Annual Agreement Target', value: fmtPKR(tg.annualAgreementTarget) },
          { label: 'YTD Actual Sales', value: fmtPKR(tg.ytdActualSales), sub: `${tg.ytdAchievementPercent || 0}% Annual Achieved`, color: '#0284c7' },
          { label: 'FO Salary Return', value: `${performanceData.salaryJustification?.returnMultiple || 'N/A'} Return`, color: '#10b981' },
        ],
        tableTitle: 'Product-Level Sales Breakdown',
        tableSubtitle: 'Commercial volume and revenue per agricultural chemical formulation',
        headers: [
          { label: 'Product Name', align: 'left', width: '38%' },
          { label: 'Pack Size', align: 'center', width: '14%' },
          { label: 'Quantity Sold', align: 'right', width: '16%' },
          { label: 'Sales Amount (PKR)', align: 'right', width: '20%' },
          { label: 'Share %', align: 'center', width: '12%' },
        ],
        rows: (performanceData.products || []).map((p: any) => [
          { text: p.productName, bold: true },
          { text: p.packing, align: 'center' },
          { text: Number(p.quantitySold).toLocaleString(), align: 'right' },
          { text: fmtPKR(p.salesAmount), align: 'right', bold: true },
          {
            text: `${p.shareOfTotalPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: '#e0f2fe',
            badgeColor: '#0369a1',
          },
        ]),
        extraSections: [
          {
            title: 'Posted Sales Invoices in Period',
            subtitle: 'Commercial tax invoices with legal warehouse dispatch',
            headers: [
              { label: 'Invoice #', align: 'left', width: '30%' },
              { label: 'Date', align: 'center', width: '25%' },
              { label: 'Items Count', align: 'center', width: '20%' },
              { label: 'Net Amount (PKR)', align: 'right', width: '25%' },
            ],
            rows: (performanceData.invoices || []).map((inv: any) => [
              { text: inv.invoiceNumber, bold: true },
              { text: new Date(inv.invoiceDate).toLocaleDateString(), align: 'center' },
              { text: `${inv.itemsCount} Items`, align: 'center' },
              { text: fmtPKR(inv.netAmount), align: 'right', bold: true },
            ]),
          },
        ],
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px' }}>
      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE HEADER & CONTROLS                            */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Market Structure & Sales Performance Engine
            </h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              <span>100% Live DB Sync</span>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Authoritative 6-Tier Hierarchical Rollup: Province → Region → Zone → Territory → Field Officer → Dealer
          </div>
        </div>

        {/* Action Controls & Date Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Strict Posted Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <IconShield size={13} color="#10b981" />
            <span>Strict Posted Sales</span>
          </div>

          {/* Quick Period Presets */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '3px',
              gap: '2px',
            }}
          >
            {(
              [
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'LAST_MONTH', label: 'Last Month' },
                { id: 'YTD', label: 'YTD' },
                { id: 'ALL_TIME', label: 'All Time' },
                { id: 'CUSTOM', label: 'Custom' },
              ] as const
            ).map((preset) => {
              const active = periodPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPeriodPreset(preset.id)}
                  style={{
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 500,
                    background: active ? 'var(--brand-primary)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Month / Year picker if CUSTOM or quick jump */}
          {periodPreset === 'CUSTOM' && (
            <div style={{ display: 'inline-flex', gap: '6px' }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>
          )}

          <Button variant="secondary" onClick={fetchPerformance} disabled={loading} style={{ padding: '6px 12px' }}>
            <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>

          {/* Download & View PDF Report Button for Current Tier */}
          <Button
            variant="primary"
            onClick={handleExportCurrentTierPdf}
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              border: 'none',
            }}
          >
            <IconPrinter size={15} />
            <span>Download PDF</span>
          </Button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 2. BREADCRUMBS STEPPER & BACK BUTTON                      */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flex: 1 }}>
          {/* Back button if drilled down */}
          {currentLevel !== 'GROUP' && (
            <button
              type="button"
              onClick={() => {
                if (breadcrumbs.length > 1) {
                  const targetCrumb = breadcrumbs[breadcrumbs.length - 2];
                  if (targetCrumb) {
                    handleBreadcrumbClick(targetCrumb, breadcrumbs.length - 2);
                  }
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: '6px',
              }}
            >
              <IconArrowLeft size={13} />
              <span>Back</span>
            </button>
          )}

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const tierLabels: Record<string, string> = {
              GROUP: 'PROVINCE',
              REGION: 'REGION',
              ZONE: 'ZONE',
              TERRITORY: 'TERRITORY',
              OFFICER: 'FIELD OFFICER',
              DEALER: 'DEALER',
            };

            return (
              <React.Fragment key={idx}>
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(crumb, idx)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isLast ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                    color: isLast ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid ' + (isLast ? 'transparent' : 'var(--border-subtle)'),
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: isLast ? 700 : 500,
                    cursor: isLast ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isLast ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      opacity: isLast ? 0.85 : 0.6,
                      fontWeight: 700,
                    }}
                  >
                    {tierLabels[crumb.level] || crumb.level}:
                  </span>
                  <span>{crumb.name}</span>
                </button>
                {!isLast && <IconChevronRight size={13} color="var(--text-muted)" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Period Label from API */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            background: 'var(--bg-subtle)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Active Period:</span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {performanceData?.period?.periodLabel || 'Current Period'}
          </strong>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 3. EXECUTIVE KPI RIBBON (Shown for Tiers 1-5)             */}
      {/* ───────────────────────────────────────────────────────── */}
      {currentLevel !== 'DEALER' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Revenue */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Total Net Revenue
              </span>
              <div style={{ padding: '4px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                <IconTrendingUp size={15} color="#10b981" />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', fontFamily: 'monospace' }}>
              {fmtPKR(metrics.totalRevenue)}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
              Strict posted sales only
            </div>
          </div>

          {/* Quota & Target */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Quota Achievement
              </span>
              <div style={{ padding: '4px', background: 'rgba(2, 132, 199, 0.1)', borderRadius: '6px' }}>
                <IconSparkles size={15} color="#0284c7" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : Number(metrics.achievementPercent) >= 70 ? '#0284c7' : '#ea580c',
                }}
              >
                {metrics.achievementPercent || 0}%
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                of {fmtPKR(metrics.target)}
              </span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'var(--bg-subtle)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Number(metrics.achievementPercent || 0))}%`,
                  height: '100%',
                  background: Number(metrics.achievementPercent) >= 100 ? '#10b981' : Number(metrics.achievementPercent) >= 70 ? '#0284c7' : '#ea580c',
                }}
              />
            </div>
          </div>

          {/* Volume Sold */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Finished Units Sold
              </span>
              <div style={{ padding: '4px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <IconPackage size={15} color="var(--text-secondary)" />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', fontFamily: 'monospace' }}>
              {Number(metrics.totalQuantity || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              All formulation lines
            </div>
          </div>

          {/* Posted Invoices */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Posted Invoices
              </span>
              <div style={{ padding: '4px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <IconFileText size={15} color="var(--text-secondary)" />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', fontFamily: 'monospace' }}>
              {Number(metrics.totalOrders || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Legally dispatched invoices
            </div>
          </div>

          {/* Active Selling Accounts */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Active Dealers
              </span>
              <div style={{ padding: '4px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                <IconBuilding size={15} color="#10b981" />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', fontFamily: 'monospace' }}>
              {Number(metrics.activeDealers || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
              Purchased in period
            </div>
          </div>

          {/* Avg Dealer Sales */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Avg Dealer Sales
              </span>
              <div style={{ padding: '4px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <IconTrendingUp size={15} color="var(--text-secondary)" />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', fontFamily: 'monospace' }}>
              {fmtPKR(metrics.averageDealerSales)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Revenue ÷ Active Dealers
            </div>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {loading && (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
          Querying live hierarchical aggregates across active database records...
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* VISUAL PERFORMANCE GRAPHS & LEADERBOARD                   */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && performanceData && chartEntities.length > 0 && currentLevel !== 'DEALER' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)', gap: '16px' }}>
          {/* Visual Graph 1: Comparative Target vs Actual Bar Chart */}
          <Card>
            <CardHeader style={{ paddingBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <IconTrendingUp size={16} color="var(--brand-primary)" />
                    Target vs. Actual Sales Performance
                  </CardTitle>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Comparative revenue breakdown for {breadcrumbs[breadcrumbs.length - 1]?.name} • Click bar to drill down
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '2px', border: '1px dashed #94a3b8' }} />
                    <span>Target</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', borderRadius: '2px' }} />
                    <span>Actual Sales</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '190px', padding: '16px 0 10px 0', overflowX: 'auto' }}>
                {chartEntities.map((ent: any, i: number) => {
                  const targetHeight = Math.max(8, Math.min(100, Math.round((ent.target / maxChartValue) * 100)));
                  const actualHeight = Math.max(8, Math.min(100, Math.round((ent.actual / maxChartValue) * 100)));
                  const isTopAchiever = ent.achievement >= 100;
                  const isGood = ent.achievement >= 75;
                  const barGradient = isTopAchiever
                    ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                    : isGood
                    ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                    : ent.achievement >= 40
                    ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)';

                  return (
                    <div
                      key={ent.id || i}
                      onClick={ent.onClick}
                      title={`${ent.name} (${ent.code})\nActual: ${fmtPKR(ent.actual)}\nTarget: ${fmtPKR(ent.target)}\nAchievement: ${ent.achievement}% (Click to drill down)`}
                      style={{
                        flex: 1,
                        minWidth: '60px',
                        maxWidth: '90px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        height: '100%',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isTopAchiever ? '#dcfce7' : isGood ? '#e0f2fe' : '#fef3c7',
                          color: isTopAchiever ? '#166534' : isGood ? '#0369a1' : '#92400e',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ent.achievement}%
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', height: '100%', justifyContent: 'center' }}>
                        {/* Target Bar */}
                        <div
                          style={{
                            width: '40%',
                            height: `${targetHeight}%`,
                            background: '#f1f5f9',
                            border: '1px dashed #94a3b8',
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                        {/* Actual Sales Bar */}
                        <div
                          style={{
                            width: '50%',
                            height: `${actualHeight}%`,
                            background: barGradient,
                            borderRadius: '4px 4px 0 0',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '80px',
                        }}
                      >
                        {ent.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Side Performance Cards: Health & Leaderboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Quota Health Spectrum */}
            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <CardTitle style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconSparkles size={14} color="#059669" />
                  Portfolio Quota Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* 4-part health bar */}
                <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '999px', display: 'flex', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${(healthStats.met / (healthStats.total || 1)) * 100}%`, background: '#10b981' }} title={`Target Met: ${healthStats.met}`} />
                  <div style={{ width: `${(healthStats.track / (healthStats.total || 1)) * 100}%`, background: '#3b82f6' }} title={`On Track: ${healthStats.track}`} />
                  <div style={{ width: `${(healthStats.moderate / (healthStats.total || 1)) * 100}%`, background: '#f59e0b' }} title={`Moderate: ${healthStats.moderate}`} />
                  <div style={{ width: `${(healthStats.focus / (healthStats.total || 1)) * 100}%`, background: '#ef4444' }} title={`Needs Focus: ${healthStats.focus}`} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <span>Target Met (≥100%): <strong>{healthStats.met}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span>On Track (75-99%): <strong>{healthStats.track}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                    <span>Moderate (40-74%): <strong>{healthStats.moderate}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991b1b' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    <span>Needs Focus (&lt;40%): <strong>{healthStats.focus}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers Leaderboard */}
            <Card>
              <CardHeader style={{ paddingBottom: '6px' }}>
                <CardTitle style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconShield size={14} color="#1d4ed8" />
                  Top Ranked Performance Contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...chartEntities]
                    .sort((a, b) => b.actual - a.actual)
                    .slice(0, 3)
                    .map((item, idx) => {
                      const share = Number(metrics.totalRevenue) > 0
                        ? Math.round((item.actual / Number(metrics.totalRevenue)) * 100)
                        : 0;
                      return (
                        <div
                          key={item.id || idx}
                          onClick={item.onClick}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: idx === 0 ? '#fef08a' : idx === 1 ? '#e2e8f0' : '#fed7aa',
                                color: '#1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '10px',
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>{item.name}</strong>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#047857' }}>{fmtPKR(item.actual)}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{share}% provincial share</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* COMMERCIAL ITEMS & PRODUCT FORMULATION PERFORMANCE        */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && performanceData?.products && performanceData.products.length > 0 && currentLevel !== 'DEALER' && (
        <Card style={{ marginBottom: '4px' }}>
          <CardHeader style={{ paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <IconPackage size={17} color="#2563eb" />
                  Commercial SKU & Chemical Formulation Sales Performance
                </CardTitle>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Real product-level volume, pack sizes, and revenue posted in {performanceData?.period?.periodLabel || 'period'}
                </p>
              </div>
              <Badge variant="primary">
                {performanceData.products.length} Formulations Tracked
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Product Formulation</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pack Size</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity Sold</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sales Revenue (PKR)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '22%' }}>Revenue Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice(0, 10).map((prod: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {prod.productName}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                          {prod.packing}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {Number(prod.quantitySold || 0).toLocaleString()} <span style={{ fontSize: '10px', color: '#64748b' }}>units</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                        {fmtPKR(prod.salesAmount)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '7px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, prod.shareOfTotalPercent || 0)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #2563eb 0%, #10b981 100%)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', minWidth: '36px', textAlign: 'right' }}>
                            {prod.shareOfTotalPercent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 4. TIER 1 TABLE: OPERATING REGIONS BREAKDOWN              */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'GROUP' && performanceData?.regions && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tier 1: Operating Regions Breakdown
                </h2>
                <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {filteredRegions.length} Regions
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Regional rollups led by Business Managers • Click any Region to inspect its Zones
              </div>
            </div>

            {/* Quick in-table search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 10px',
                  minWidth: '220px',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter regions..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '10px 14px' }}>Region</th>
                  <th style={{ padding: '10px 14px' }}>Business Manager</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Zones</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No regions match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRegions.map((r: any, idx: number) => (
                    <tr
                      key={r.regionId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconMapPin size={14} color="var(--brand-primary)" />
                          <span>{r.regionName}</span>
                          {r.regionCode && (
                            <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {r.regionCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconUser size={13} color="var(--text-muted)" />
                          <span>{r.businessManager || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                        {r.zonesCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {fmtPKR(r.target)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtPKR(r.actualSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderAchievementBadge(r.achievementPercent)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                        {r.activeDealers}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtPKR(r.averageDealerSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => navigateToRegion(r.regionId, r.regionName, r.regionCode)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--brand-primary)',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Drill Down</span>
                          <IconArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 5. TIER 2 TABLE: REGIONAL ZONES BREAKDOWN                 */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'REGION' && performanceData?.zones && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tier 2: {performanceData.region.name} — Zones Breakdown
                </h2>
                <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {filteredZones.length} Zones
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Responsible Business Manager: <strong>{performanceData.region.businessManager}</strong> • Click any Zone to inspect Territories
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 10px',
                  minWidth: '220px',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter zones..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '10px 14px' }}>Zone</th>
                  <th style={{ padding: '10px 14px' }}>Area Manager</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Territories</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No zones match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredZones.map((z: any, idx: number) => (
                    <tr
                      key={z.zoneId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconMapPin size={14} color="var(--brand-primary)" />
                          <span>{z.zoneName}</span>
                          {z.zoneCode && (
                            <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {z.zoneCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconUser size={13} color="var(--text-muted)" />
                          <span>{z.areaManager || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                        {z.territoriesCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {fmtPKR(z.target)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtPKR(z.actualSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderAchievementBadge(z.achievementPercent)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                        {z.activeDealers}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtPKR(z.averageDealerSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => navigateToZone(z.zoneId, z.zoneName, z.zoneCode)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--brand-primary)',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Drill Down</span>
                          <IconArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 6. TIER 3 TABLE: ZONE TERRITORIES BREAKDOWN               */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'ZONE' && performanceData?.territories && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tier 3: {performanceData.zone.name} — Territories Breakdown
                </h2>
                <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {filteredTerritories.length} Territories
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Responsible Area Manager: <strong>{performanceData.zone.areaManager}</strong> • Click any Territory to inspect Sales Officers
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 10px',
                  minWidth: '220px',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter territories..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '10px 14px' }}>Territory</th>
                  <th style={{ padding: '10px 14px' }}>Primary Sales Officer</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active / Assigned</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTerritories.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No territories match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTerritories.map((t: any, idx: number) => (
                    <tr
                      key={t.territoryId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconMapPin size={14} color="var(--brand-primary)" />
                          <span>{t.territoryName}</span>
                          {t.territoryCode && (
                            <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {t.territoryCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconUser size={13} color="var(--text-muted)" />
                          <span>{t.primaryOfficer || 'Direct'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {fmtPKR(t.target)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtPKR(t.actualSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderAchievementBadge(t.achievementPercent)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t.activeDealers}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {t.assignedDealers || t.activeDealers}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtPKR(t.averageDealerSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => navigateToTerritory(t.territoryId, t.territoryName, t.territoryCode)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--brand-primary)',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>View Officers</span>
                          <IconArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 7. TIER 4 TABLE: TERRITORY SALES OFFICERS ROSTER          */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'TERRITORY' && performanceData?.officers && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tier 4: {performanceData.territory.name} — Sales Officers Roster
                </h2>
                <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {filteredOfficers.length} Officers
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Zone: <strong>{performanceData.territory.zoneName}</strong> • Click any Sales Officer to inspect assigned dealers
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 10px',
                  minWidth: '220px',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter officers..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '10px 14px' }}>Sales Officer</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Sales / Dealer</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No sales officers match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOfficers.map((o: any, idx: number) => (
                    <tr
                      key={o.officerId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconUser size={14} color="var(--brand-primary)" />
                          <span>{o.officerName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {fmtPKR(o.target)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtPKR(o.actualSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderAchievementBadge(o.achievementPercent)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                        {o.activeDealers} Dealers
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtPKR(o.averageDealerSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => navigateToOfficer(o.officerId, o.officerName)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--brand-primary)',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>View Dealers</span>
                          <IconArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 8. TIER 5 TABLE: OFFICER ASSIGNED DEALERS NETWORK         */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'OFFICER' && performanceData?.dealers && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tier 5: {performanceData.officer.name} — Dealer Network
                </h2>
                <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {filteredDealers.length} Accounts
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  FO Salary Return: {performanceData.metrics?.salaryJustificationRatio || 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Click any Dealer to open the full Dealer Target, Credit & Formulation Performance Card
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 10px',
                  minWidth: '220px',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter dealers..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '10px 14px' }}>Dealer Account</th>
                  <th style={{ padding: '10px 14px' }}>City</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Units Sold</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Orders</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDealers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No dealer accounts match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDealers.map((d: any, idx: number) => (
                    <tr
                      key={d.dealerId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconBuilding size={14} color="var(--brand-primary)" />
                          <div>
                            <div>{d.dealerName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{d.dealerCode}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {d.city}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {fmtPKR(d.monthlyTarget)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtPKR(d.actualSales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderAchievementBadge(d.achievementPercent)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                        {Number(d.totalQuantity || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {d.ordersCount}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => navigateToDealer(d.dealerId, d.dealerName, d.dealerCode)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--brand-primary)',
                            border: 'none',
                            color: '#ffffff',
                            padding: '5px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          <span>Open Card</span>
                          <IconArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 9. TIER 6: DEALER TARGET, CREDIT & FORMULATION CARD       */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'DEALER' && performanceData?.targets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dealer Profile & Financial Banner */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {performanceData.dealer.name}
                  </h2>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '2px 8px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {performanceData.dealer.code}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 700,
                      background: performanceData.dealer.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: performanceData.dealer.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                    }}
                  >
                    {performanceData.dealer.status}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <span>City: <strong style={{ color: 'var(--text-primary)' }}>{performanceData.dealer.city}</strong></span>
                  <span>Territory: <strong style={{ color: 'var(--text-primary)' }}>{performanceData.dealer.territory}</strong></span>
                  <span>Zone: <strong style={{ color: 'var(--text-primary)' }}>{performanceData.dealer.zone}</strong></span>
                  <span>Region: <strong style={{ color: 'var(--text-primary)' }}>{performanceData.dealer.region}</strong></span>
                  <span>Field Officer: <strong style={{ color: 'var(--text-primary)' }}>{performanceData.dealer.assignedOfficer}</strong></span>
                </div>
              </div>

              {/* Credit Status Banner */}
              {performanceData.creditControl && (
                <div
                  style={{
                    background: performanceData.creditControl.isCreditLocked ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-subtle)',
                    border: '1px solid ' + (performanceData.creditControl.isCreditLocked ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'),
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Credit Limit
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {fmtPKR(performanceData.creditControl.creditLimit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Current Exposure
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: performanceData.creditControl.isCreditLocked ? '#ef4444' : 'var(--text-primary)',
                      }}
                    >
                      {fmtPKR(performanceData.creditControl.currentBalance)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Credit Utilization
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: performanceData.creditControl.creditUtilizationPercent >= 100 ? '#ef4444' : '#10b981',
                      }}
                    >
                      {performanceData.creditControl.creditUtilizationPercent}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dealer Targets Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Annual Agreement Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Annual Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                {fmtPKR(performanceData.targets.annualAgreementTarget)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Legal contract quota</div>
            </div>

            {/* Period Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Period Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                {fmtPKR(performanceData.targets.monthlyTarget)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Assigned quota</div>
            </div>

            {/* Period Actual Sales */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Period Actual Sales</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px', fontFamily: 'monospace' }}>
                {fmtPKR(performanceData.targets.monthlyActualSales)}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {performanceData.targets.monthlyAchievementPercent}% Achieved
              </div>
            </div>

            {/* YTD Sales */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>YTD Actual Sales</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                {fmtPKR(performanceData.targets.ytdActualSales)}
              </div>
              <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                {performanceData.targets.ytdAchievementPercent}% Annual Achieved
              </div>
            </div>

            {/* Remaining Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Remaining Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c', marginTop: '4px', fontFamily: 'monospace' }}>
                {fmtPKR(performanceData.targets.remainingAnnualTarget)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>To complete annual</div>
            </div>

            {/* FO Salary Return Ratio */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>FO Salary Return</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px', fontFamily: 'monospace' }}>
                {performanceData.salaryJustification?.returnMultiple || 'N/A'} Return
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>vs PKR 50k FO Cost</div>
            </div>
          </div>

          {/* Product Breakdown Table & Invoices Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            {/* Product-Level Breakdown */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Product-Level Sales Breakdown
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Finished formulation units dispatched to this account
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    maxWidth: '160px',
                  }}
                >
                  <IconSearch size={12} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '11.5px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px' }}>Product Formulation</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Pack</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty Sold</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Sales</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No product sales recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent' }}>
                          <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.productName}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{p.packing}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(p.quantitySold || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtPKR(p.salesAmount)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                              {p.shareOfTotalPercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices List */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Posted Sales Invoices in Period
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Double-entry posted and legally dispatched tax invoices
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                {performanceData.invoices.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No posted invoices found in this period.
                  </div>
                ) : (
                  performanceData.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {new Date(inv.invoiceDate).toLocaleDateString()} • {inv.itemsCount} Line Items
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '13.5px' }}>
                          {fmtPKR(inv.netAmount)}
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => openInvoicePreview(inv.id)}
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <IconEye size={13} />
                          <span>View</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal Preview */}
      <SalesInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={activeInvoice}
      />
    </div>
  );
};
