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
import { useCompany } from '../../context/company-context';
import {
  Button,
  PdfViewerModal,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../ui';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import {
  SalesInvoiceExportData,
  exportMarketPerformancePdf,
  generateMarketPerformanceHtml,
  MarketPerformancePdfData,
} from '../../lib/pdf-export';
import {
  IconTrendingUp,
  IconPackage,
  IconRefresh,
  IconShield,
  IconChevronRight,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconSearch,
  IconAlertTriangle,
  IconMapPin,
  IconUser,
  IconCreditCard,
  IconDownload,
} from '../icons';

interface BreadcrumbItem {
  level: 'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'DEALER';
  id?: string;
  name: string;
  code?: string;
}

type PeriodPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'YTD' | 'ALL_TIME' | 'CUSTOM';

export const MarketPerformanceView: React.FC = () => {
  const { activeCompanyId } = useCompany();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Period state
  const now = new Date();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('THIS_MONTH');
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Search filter inside active tier table
  const [tableSearch, setTableSearch] = useState<string>('');

  // Navigation hierarchy state (Strictly 5 Tiers: Province -> Region -> Zone -> Territory -> Dealer)
  const [currentLevel, setCurrentLevel] = useState<'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'DEALER'>('GROUP');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { level: 'GROUP', name: 'Punjab Provincial Total' },
  ]);

  // Data payload for currently active level
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Invoice modal preview state
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoiceExportData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  // In-App PDF Viewer modal state
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState<boolean>(false);
  const [pdfViewerHtml, setPdfViewerHtml] = useState<string>('');
  const [pdfViewerTitle, setPdfViewerTitle] = useState<string>('Market Performance Report');

  // Build query string based on active period preset
  const buildPeriodParams = useCallback(() => {
    const compParam = activeCompanyId && activeCompanyId !== 'ALL' ? `&companyId=${encodeURIComponent(activeCompanyId)}` : '';
    if (periodPreset === 'THIS_MONTH') {
      return `month=${now.getMonth() + 1}&year=${now.getFullYear()}&period=THIS_MONTH${compParam}`;
    }
    if (periodPreset === 'LAST_MONTH') {
      return `period=LAST_MONTH&year=${now.getFullYear()}${compParam}`;
    }
    if (periodPreset === 'YTD') {
      return `period=YTD&year=${selectedYear}${compParam}`;
    }
    if (periodPreset === 'ALL_TIME') {
      return `period=ALL_TIME&allTime=true${compParam}`;
    }
    return `month=${selectedMonth}&year=${selectedYear}${compParam}`;
  }, [periodPreset, selectedMonth, selectedYear, activeCompanyId]);

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
  }, [currentLevel, selectedRegionId, selectedZoneId, selectedTerritoryId, selectedDealerId, buildPeriodParams, activeCompanyId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Navigation Handlers
  const navigateToGroup = () => {
    setCurrentLevel('GROUP');
    setSelectedRegionId(null);
    setSelectedZoneId(null);
    setSelectedTerritoryId(null);
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



  const navigateToDealer = (dealerId: string, dealerName: string, dealerCode?: string) => {
    setSelectedDealerId(dealerId);
    setCurrentLevel('DEALER');
    setTableSearch('');
    setBreadcrumbs((prev) => {
      const terrIdx = prev.findIndex((b) => b.level === 'TERRITORY');
      if (terrIdx !== -1) {
        return [
          ...prev.slice(0, terrIdx + 1),
          { level: 'DEALER', id: dealerId, name: dealerName, code: dealerCode },
        ];
      }
      return [
        ...prev.slice(0, 4),
        { level: 'DEALER', id: dealerId, name: dealerName, code: dealerCode },
      ];
    });
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
    }
  };

  const canGoBack = breadcrumbs.length > 1;
  const handleGoBack = () => {
    if (canGoBack) {
      const parentItem = breadcrumbs[breadcrumbs.length - 2];
      if (parentItem) {
        handleBreadcrumbClick(parentItem, breadcrumbs.length - 2);
      }
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
    let bg = '#fef2f2';
    let color = '#dc2626';
    let border = '#fecaca';
    let text = 'Needs Focus';

    if (pct >= 100) {
      bg = '#f0fdf4';
      color = '#16a34a';
      border = '#bbf7d0';
      text = 'Target Met';
    } else if (pct >= 75) {
      bg = '#f0f9ff';
      color = '#0284c7';
      border = '#bae6fd';
      text = 'On Track';
    } else if (pct >= 40) {
      bg = '#fffbeb';
      color = '#d97706';
      border = '#fde68a';
      text = 'Moderate';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          background: bg,
          color: color,
          border: `1px solid ${border}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{Number(pct || 0).toFixed(0)}%</span>
        <span style={{ opacity: 0.6 }}>•</span>
        <span>{text}</span>
      </span>
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



  // Filtered rows for Tier 4: Territory Dealers Network
  const filteredDealers = useMemo(() => {
    if (!performanceData?.dealers) return [];
    if (!tableSearch.trim()) return performanceData.dealers;
    const q = tableSearch.toLowerCase();
    return performanceData.dealers.filter(
      (d: any) =>
        d.dealerName?.toLowerCase().includes(q) ||
        d.dealerCode?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.assignedOfficer?.toLowerCase().includes(q)
    );
  }, [performanceData?.dealers, tableSearch]);

  // Filtered products for Tier 5 formulation drill-down
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


  // Tier PDF Data Builder
  const buildCurrentTierPdfData = (): MarketPerformancePdfData | null => {
    if (!performanceData) return null;
    const periodLabel = performanceData?.period?.periodLabel || `${monthNames[selectedMonth - 1]} ${selectedYear}`;

    if (currentLevel === 'GROUP') {
      return {
        tierName: 'Executive Provincial Total',
        scopeTitle: 'Punjab Provincial Total — Operating Regions',
        periodLabel,
        kpis: [
          { label: 'Total Net Revenue', value: fmtPKR(metrics.totalRevenue), sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Total Credit Limit', value: fmtPKR(metrics.creditLimit), sub: 'Approved Dealer Credit', color: '#059669' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of assigned target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Total Quantity Sold', value: `${Number(metrics.totalQuantity || 0).toLocaleString()} units`, sub: 'Finished Goods' },
          { label: 'Posted Invoices', value: `${Number(metrics.totalOrders || 0).toLocaleString()}`, sub: 'Zero draft leakage' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Purchased in period', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: fmtPKR(metrics.averageDealerSales), sub: 'Revenue / Active Dealers' },
        ],
        tableTitle: 'Regional Sales Roster (Tier 1: Regions)',
        tableSubtitle: 'Provincial geographic rollup across Business Manager regions',
        headers: [
          { label: 'Region', align: 'left', width: '16%' },
          { label: 'Business Manager', align: 'left', width: '16%' },
          { label: 'Zones', align: 'center', width: '6%' },
          { label: 'Target (PKR)', align: 'right', width: '13%' },
          { label: 'Credit Limit (PKR)', align: 'right', width: '13%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '13%' },
          { label: 'Achievement', align: 'center', width: '9%' },
          { label: 'Active Dealers', align: 'center', width: '6%' },
          { label: 'Avg Dealer Sales', align: 'right', width: '8%' },
        ],
        rows: (performanceData.regions || []).map((r: any) => [
          { text: `${r.regionName} (${r.regionCode || ''})`, bold: true },
          { text: r.businessManager || 'Unassigned' },
          { text: r.zonesCount, align: 'center' },
          { text: fmtPKR(r.target), align: 'right' },
          { text: fmtPKR(r.creditLimit), align: 'right' },
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
      };
    } else if (currentLevel === 'REGION') {
      const reg = performanceData.region || {};
      return {
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
          { label: 'Regional Credit Limit', value: fmtPKR(metrics.creditLimit), sub: 'Approved Credit', color: '#059669' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of regional target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Regional Accounts', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: fmtPKR(metrics.averageDealerSales), sub: 'Average Order Size' },
        ],
        tableTitle: 'Zonal Breakdown (Tier 2: Zones)',
        tableSubtitle: `Supervised by Business Manager: ${reg.businessManager}`,
        headers: [
          { label: 'Zone', align: 'left', width: '18%' },
          { label: 'Area Manager', align: 'left', width: '18%' },
          { label: 'Territories', align: 'center', width: '8%' },
          { label: 'Target (PKR)', align: 'right', width: '13%' },
          { label: 'Credit Limit (PKR)', align: 'right', width: '13%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '13%' },
          { label: 'Achievement', align: 'center', width: '9%' },
          { label: 'Active Dealers', align: 'center', width: '8%' },
        ],
        rows: (performanceData.zones || []).map((z: any) => [
          { text: `${z.zoneName} (${z.zoneCode || ''})`, bold: true },
          { text: z.areaManager || 'Unassigned' },
          { text: z.territoriesCount, align: 'center' },
          { text: fmtPKR(z.target), align: 'right' },
          { text: fmtPKR(z.creditLimit), align: 'right' },
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
      };
    } else if (currentLevel === 'ZONE') {
      const zone = performanceData.zone || {};
      return {
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
          { label: 'Zone Credit Limit', value: fmtPKR(metrics.creditLimit), sub: 'Approved Credit', color: '#059669' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of zonal target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Dealers (Active / Reg)', value: `${Number(metrics.activeDealers || 0).toLocaleString()} / ${Number(metrics.assignedDealers || metrics.activeDealers || 0).toLocaleString()}`, sub: 'Trading / Registered', color: '#10b981' },
        ],
        tableTitle: 'Territories Breakdown (Tier 3: Territories)',
        tableSubtitle: `Managed by Area Manager: ${zone.areaManager}`,
        headers: [
          { label: 'Territory', align: 'left', width: '20%' },
          { label: 'Primary Sales Officer', align: 'left', width: '18%' },
          { label: 'Target (PKR)', align: 'right', width: '14%' },
          { label: 'Credit Limit (PKR)', align: 'right', width: '14%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '14%' },
          { label: 'Achievement', align: 'center', width: '9%' },
          { label: 'Dealers (Active / Reg)', align: 'center', width: '11%' },
        ],
        rows: (performanceData.territories || []).map((t: any) => [
          { text: `${t.territoryName} (${t.territoryCode || ''})`, bold: true },
          { text: t.primaryOfficer || 'Direct' },
          { text: fmtPKR(t.target), align: 'right' },
          { text: fmtPKR(t.creditLimit), align: 'right' },
          { text: fmtPKR(t.actualSales), align: 'right', bold: true },
          {
            text: `${t.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: t.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: t.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: `${t.activeDealers ?? 0} / ${t.assignedDealers ?? 0}`, align: 'center' },
        ]),
      };
    } else if (currentLevel === 'TERRITORY') {
      const terr = performanceData.territory || {};
      return {
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
          { label: 'Territory Credit Limit', value: fmtPKR(metrics.creditLimit), color: '#059669' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, color: '#10b981' },
        ],
        tableTitle: 'Territory Dealers Network',
        tableSubtitle: `Dealers belonging directly to ${terr.name}`,
        headers: [
          { label: 'Dealer Account', align: 'left', width: '24%' },
          { label: 'City', align: 'left', width: '14%' },
          { label: 'Target (PKR)', align: 'right', width: '15%' },
          { label: 'Credit Limit (PKR)', align: 'right', width: '15%' },
          { label: 'Actual Sales (PKR)', align: 'right', width: '18%' },
          { label: 'Achievement', align: 'center', width: '14%' },
        ],
        rows: (performanceData.dealers || []).map((d: any) => [
          { text: `${d.dealerName} (${d.dealerCode})`, bold: true },
          { text: d.city || '—' },
          { text: fmtPKR(d.target || d.monthlyTarget), align: 'right' },
          { text: fmtPKR(d.creditLimit), align: 'right' },
          { text: fmtPKR(d.actualSales), align: 'right', bold: true },
          {
            text: `${d.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: d.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: d.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
        ]),
      };
    } else if (currentLevel === 'DEALER') {
      const dlr = performanceData.dealer || {};
      const tg = performanceData.targets || {};
      const cc = performanceData.creditControl || {};
      return {
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
      };
    }
    return null;
  };

  const handleExportCurrentTierPdf = () => {
    const data = buildCurrentTierPdfData();
    if (data) exportMarketPerformancePdf(data);
  };

  const handleViewCurrentTierPdf = () => {
    const data = buildCurrentTierPdfData();
    if (data) {
      const html = generateMarketPerformanceHtml(data);
      setPdfViewerHtml(html);
      setPdfViewerTitle(`${data.tierName || 'Market Performance'} - ${data.scopeTitle || ''}`);
      setIsPdfViewerOpen(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px' }}>
      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE HEADER & CONTROLS                            */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Market Structure & Sales Performance Engine
              </h1>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#10b981',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span>Live DB Synchronized</span>
              </div>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              5-Tier Canonical Structure: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Province → Region → Zone → Territory → Dealer</span>
            </p>
          </div>

          {/* Action Buttons: Refresh, View PDF, Download PDF */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={fetchPerformance}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, padding: '7px 12px' }}
            >
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleViewCurrentTierPdf}
              disabled={loading || !performanceData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, padding: '7px 12px' }}
            >
              <IconEye size={14} />
              <span>View PDF</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleExportCurrentTierPdf}
              disabled={loading || !performanceData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, padding: '7px 14px' }}
            >
              <IconDownload size={14} />
              <span>Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Period Selector Segmented Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            {(
              [
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'LAST_MONTH', label: 'Last Month' },
                { id: 'YTD', label: 'YTD' },
                { id: 'ALL_TIME', label: 'All-Time' },
                { id: 'CUSTOM', label: 'Custom' },
              ] as const
            ).map((p) => {
              const active = periodPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriodPreset(p.id)}
                  style={{
                    border: 'none',
                    background: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    fontSize: '12px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {periodPreset === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {monthNames.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Active Period: <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{performanceData?.period?.periodLabel || 'Current Period'}</span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 2. CANONICAL 5-TIER HIERARCHY STEPPER                     */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {canGoBack && (
            <button
              onClick={handleGoBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                marginRight: '6px',
              }}
              title="Return to parent level"
            >
              <IconArrowLeft size={13} />
              <span>Back</span>
            </button>
          )}

          {/* Stepper items */}
          {[
            { level: 'GROUP', label: '1. Province', title: 'Punjab Provincial Total' },
            { level: 'REGION', label: '2. Region', title: breadcrumbs.find((b) => b.level === 'REGION')?.name || 'Region' },
            { level: 'ZONE', label: '3. Zone', title: breadcrumbs.find((b) => b.level === 'ZONE')?.name || 'Zone' },
            { level: 'TERRITORY', label: '4. Territory', title: breadcrumbs.find((b) => b.level === 'TERRITORY')?.name || 'Territory' },
            { level: 'DEALER', label: '5. Dealer', title: breadcrumbs.find((b) => b.level === 'DEALER')?.name || 'Dealer' },
          ].map((step, idx) => {
            const stepOrder = ['GROUP', 'REGION', 'ZONE', 'TERRITORY', 'DEALER'];
            const currentIdx = stepOrder.indexOf(currentLevel);
            const isCurrent = step.level === currentLevel;
            const isCompleted = idx < currentIdx;
            const isClickable = idx <= currentIdx;

            const crumbItem = breadcrumbs.find((b) => b.level === step.level);

            return (
              <React.Fragment key={step.level}>
                {idx > 0 && (
                  <IconChevronRight
                    size={13}
                    style={{
                      color: isCompleted ? 'var(--brand-primary)' : 'var(--text-muted)',
                      opacity: 0.6,
                    }}
                  />
                )}
                <div
                  onClick={() => {
                    if (isCompleted && crumbItem) {
                      handleBreadcrumbClick(crumbItem, idx);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent
                      ? 'rgba(37, 99, 235, 0.08)'
                      : isCompleted
                      ? 'var(--bg-subtle)'
                      : 'transparent',
                    border: isCurrent
                      ? '1px solid rgba(37, 99, 235, 0.3)'
                      : isCompleted
                      ? '1px solid var(--border-subtle)'
                      : '1px dashed transparent',
                    cursor: isCompleted ? 'pointer' : isCurrent ? 'default' : 'not-allowed',
                    opacity: !isClickable ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isCurrent
                        ? 'var(--brand-primary)'
                        : isCompleted
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {step.label}
                  </span>
                  {crumbItem && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                        maxWidth: '140px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {crumbItem.name}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Drill-down Badge */}
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconMapPin size={13} style={{ color: 'var(--brand-primary)' }} />
          <span>Viewing: <strong style={{ color: 'var(--text-primary)' }}>{breadcrumbs[breadcrumbs.length - 1]?.name || 'Market Scope'}</strong></span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 3. EXECUTIVE KPI SCORECARDS (4 TILES)                     */}
      {/* ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Metric 1: Total Revenue */}
        <Card
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Net Revenue
            </span>
            <div style={{ padding: '7px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
              <IconTrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {fmtPKR(metrics.totalRevenue)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            <span>Posted Dispatched Sales</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>100% Tax Invoices</span>
          </div>
        </Card>

        {/* Metric 2: Quota & Target */}
        <Card
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target & Quota
            </span>
            <div style={{ padding: '7px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
              <IconShield size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {fmtPKR(metrics.target)}
          </div>
          <div style={{ marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>Achievement</span>
              {renderAchievementBadge(metrics.achievementPercent || 0)}
            </div>
            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(metrics.achievementPercent || 0, 100)}%`,
                  height: '100%',
                  background: (metrics.achievementPercent || 0) >= 100 ? '#10b981' : (metrics.achievementPercent || 0) >= 75 ? '#0284c7' : '#ea580c',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </Card>

        {/* Metric 3: Credit Limit */}
        <Card
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Credit Limit
            </span>
            <div style={{ padding: '7px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.08)', color: '#059669' }}>
              <IconCreditCard size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {fmtPKR(metrics.creditLimit)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            <span>Approved Dealer Credit</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>Monitored Exposure</span>
          </div>
        </Card>

        {/* Metric 4: Volume & Orders */}
        <Card
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sales Volume & Orders
            </span>
            <div style={{ padding: '7px', borderRadius: '8px', background: 'rgba(234, 88, 12, 0.08)', color: '#ea580c' }}>
              <IconPackage size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {Number(metrics.totalQuantity || 0).toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Units</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            <span>{metrics.totalOrders || 0} Posted Invoices</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{metrics.activeDealers || 0} Active Dealers</span>
          </div>
        </Card>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 4. LOADING & ERROR STATES                                 */}
      {/* ───────────────────────────────────────────────────────── */}
      {loading && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '60px 24px',
            textAlign: 'center',
          }}
        >
          <IconRefresh size={28} className="animate-spin" style={{ color: 'var(--brand-primary)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Loading Live Market Metrics...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Querying posted double-entry invoices & hierarchical structures</div>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconAlertTriangle size={24} style={{ color: '#ef4444' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>Error Loading Performance Data</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <Button variant="secondary" onClick={fetchPerformance}>Retry</Button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 5. ACTIVE TIER BREAKDOWN TABLES                           */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && performanceData && (
        <>
          {/* TIER 1: PROVINCIAL GROUP (REGIONS BREAKDOWN) */}
          {currentLevel === 'GROUP' && (
            <Card style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  margin: 0,
                }}
              >
                <div>
                  <CardTitle style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Tier 1: Punjab Provincial Total — Operating Regions
                  </CardTitle>
                  <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Provincial geographic rollup across Business Manager regions • Click any Region to inspect Zones
                  </CardDescription>
                </div>
                <div style={{ position: 'relative', width: '260px' }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filter regions..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>
              </CardHeader>

              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Region</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Manager</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Zones</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Target (PKR)</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Credit Limit</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actual Posted Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Achievement</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Active Dealers</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Avg Dealer Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegions.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                            No operating regions found.
                          </td>
                        </tr>
                      ) : (
                        filteredRegions.map((r: any) => (
                          <tr
                            key={r.regionId}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background-color 150ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.regionName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{r.regionCode}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                              {r.businessManager || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {r.zonesCount}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(r.target)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(r.creditLimit)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                              {fmtPKR(r.actualSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {renderAchievementBadge(r.achievementPercent)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {r.activeDealers}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(r.averageDealerSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Button
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToRegion(r.regionId, r.regionName, r.regionCode);
                                }}
                                style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              >
                                <span>View Zones</span>
                                <IconArrowRight size={13} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TIER 2: REGION SCOPE (ZONES BREAKDOWN) */}
          {currentLevel === 'REGION' && (
            <Card style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  margin: 0,
                }}
              >
                <div>
                  <CardTitle style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Tier 2: {performanceData.region?.name || 'Region'} — Zonal Breakdown
                  </CardTitle>
                  <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Supervised by Business Manager: <strong>{performanceData.region?.businessManager || 'Direct'}</strong> • Click any Zone to inspect Territories
                  </CardDescription>
                </div>
                <div style={{ position: 'relative', width: '260px' }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filter zones..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>
              </CardHeader>

              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zone</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Area Manager</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Territories</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Target (PKR)</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Credit Limit</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actual Posted Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Achievement</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Active Dealers</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Avg Dealer Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredZones.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                            No zones found in this region.
                          </td>
                        </tr>
                      ) : (
                        filteredZones.map((z: any) => (
                          <tr
                            key={z.zoneId}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background-color 150ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{z.zoneName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{z.zoneCode}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                              {z.areaManager || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {z.territoriesCount}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(z.target)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(z.creditLimit)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                              {fmtPKR(z.actualSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {renderAchievementBadge(z.achievementPercent)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {z.activeDealers}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(z.averageDealerSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Button
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToZone(z.zoneId, z.zoneName, z.zoneCode);
                                }}
                                style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              >
                                <span>View Territories</span>
                                <IconArrowRight size={13} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TIER 3: ZONE SCOPE (TERRITORIES BREAKDOWN) */}
          {currentLevel === 'ZONE' && (
            <Card style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  margin: 0,
                }}
              >
                <div>
                  <CardTitle style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Tier 3: {performanceData.zone?.name || 'Zone'} — Territories Breakdown
                  </CardTitle>
                  <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Responsible Area Manager: <strong>{performanceData.zone?.areaManager || 'Direct'}</strong> • Click any Territory to inspect Dealers Network
                  </CardDescription>
                </div>
                <div style={{ position: 'relative', width: '260px' }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filter territories..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>
              </CardHeader>

              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Territory</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Sales Officer</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Target (PKR)</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Credit Limit</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actual Posted Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Achievement</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Active / Assigned</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Avg Dealer Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTerritories.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                            No territories found in this zone.
                          </td>
                        </tr>
                      ) : (
                        filteredTerritories.map((t: any) => (
                          <tr
                            key={t.territoryId}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background-color 150ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.territoryName}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{t.territoryCode}</span>
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: t.assignedDealers > 0 ? '#ecfdf5' : '#f1f5f9',
                                    color: t.assignedDealers > 0 ? '#047857' : '#64748b',
                                    border: t.assignedDealers > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                    fontWeight: 700,
                                  }}
                                >
                                  {t.assignedDealers} Dealer account(s) registered
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                              <div style={{ fontWeight: 600 }}>{t.primaryOfficer || 'Direct / Unassigned'}</div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(t.target)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(t.creditLimit)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                              {fmtPKR(t.actualSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {renderAchievementBadge(t.achievementPercent)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {t.activeDealers} / {t.assignedDealers}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(t.averageDealerSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Button
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToTerritory(t.territoryId, t.territoryName, t.territoryCode);
                                }}
                                style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <IconEye size={13} />
                                <span>View Dealers ({t.assignedDealers})</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TIER 4: TERRITORY SCOPE (DIRECT DEALERS NETWORK) */}
          {currentLevel === 'TERRITORY' && (
            <Card style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <CardHeader
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  margin: 0,
                }}
              >
                <div>
                  <CardTitle style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Tier 4: {performanceData.territory?.name || 'Territory'} — Dealers Network
                  </CardTitle>
                  <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    Primary Sales Officer: <strong>{performanceData.territory?.primaryOfficer || 'Assigned'}</strong> • All Dealer accounts belonging to this territory
                  </CardDescription>
                </div>
                <div style={{ position: 'relative', width: '260px' }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filter dealers..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>
              </CardHeader>

              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dealer Account</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Sales Officer</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Target (PKR)</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Credit Limit</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actual Posted Sales</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Achievement</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Units Sold</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Invoices</th>
                        <th style={{ padding: '11px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDealers.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <IconPackage size={32} style={{ color: '#94a3b8', margin: '0 auto 8px', display: 'block' }} />
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>No Dealers Found</div>
                            <div style={{ fontSize: '12px', marginTop: '2px' }}>No dealer accounts mapped to this territory yet.</div>
                          </td>
                        </tr>
                      ) : (
                        filteredDealers.map((d: any) => (
                          <tr
                            key={d.dealerId}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background-color 150ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{d.dealerName}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{d.dealerCode}</span>
                                {d.phone && <span style={{ fontSize: '11px', color: '#94a3b8' }}>• {d.phone}</span>}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                              {d.city || '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                              <div style={{ fontWeight: 600 }}>{d.assignedOfficer || performanceData.territory?.primaryOfficer || 'Assigned'}</div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(d.target)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                              {fmtPKR(d.creditLimit)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                              {fmtPKR(d.actualSales)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {renderAchievementBadge(d.achievementPercent)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {Number(d.totalQuantity || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {d.ordersCount || 0}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Button
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToDealer(d.dealerId, d.dealerName, d.dealerCode);
                                }}
                                style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                              >
                                <span>Open Card</span>
                                <IconArrowRight size={13} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TIER 5: DEALER TARGET & PERFORMANCE CARD */}
          {currentLevel === 'DEALER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Dealer Profile Card */}
              <Card
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                        {performanceData.dealer?.name}
                      </h2>
                      <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                        {performanceData.dealer?.code}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                        {performanceData.dealer?.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>
                      Territory: <strong style={{ color: '#0f172a' }}>{performanceData.dealer?.territory}</strong> &bull; Zone: <strong style={{ color: '#0f172a' }}>{performanceData.dealer?.zone}</strong> &bull; Region: <strong style={{ color: '#0f172a' }}>{performanceData.dealer?.region}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right', padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Approved Credit Limit</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', marginTop: '2px' }}>
                        {fmtPKR(performanceData.creditControl?.creditLimit)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Current Exposure</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', marginTop: '2px' }}>
                        {fmtPKR(performanceData.creditControl?.currentBalance)}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginTop: '18px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Assigned Sales Officer</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <IconUser size={14} style={{ color: '#2563eb' }} />
                      <span>{performanceData.dealer?.assignedOfficer || 'Direct / Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>City & Location</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <IconMapPin size={14} style={{ color: '#64748b' }} />
                      <span>{performanceData.dealer?.city || 'Punjab'}{performanceData.dealer?.address ? ` — ${performanceData.dealer.address}` : ''}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Contact Phone</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                      {performanceData.dealer?.phone || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Available Credit</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#059669', marginTop: '2px', fontFamily: 'monospace' }}>
                      {fmtPKR(performanceData.creditControl?.availableCredit)}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 4 Financial Target Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Period Actual Sales</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', marginTop: '4px' }}>
                    {fmtPKR(performanceData.targets?.monthlyActualSales)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Target: {fmtPKR(performanceData.targets?.monthlyTarget)}</span>
                    {renderAchievementBadge(performanceData.targets?.monthlyAchievementPercent || 0)}
                  </div>
                </Card>

                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Annual Agreement Target</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: '4px' }}>
                    {fmtPKR(performanceData.targets?.annualAgreementTarget)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    Approved annual distributor agreement quota
                  </div>
                </Card>

                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>YTD Cumulative Sales</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', marginTop: '4px' }}>
                    {fmtPKR(performanceData.targets?.ytdActualSales)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    <strong style={{ color: '#0284c7' }}>{performanceData.targets?.ytdAchievementPercent || 0}%</strong> of Annual Agreement
                  </div>
                </Card>

                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Salary Return Multiple</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', marginTop: '4px' }}>
                    {performanceData.salaryJustification?.returnMultiple || 'N/A'} Return
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    Commercial return on field sales cost
                  </div>
                </Card>
              </div>

              {/* Product Formulation Breakdown & Recent Invoices Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '16px' }}>
                {/* Formulation Breakdown */}
                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <CardHeader style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff', margin: 0 }}>
                    <div>
                      <CardTitle style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        Product-Level Formulation Breakdown
                      </CardTitle>
                      <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Commercial volume & revenue per agricultural formulation
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Pack</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount (PKR)</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                No product sales recorded in this period.
                              </td>
                            </tr>
                          ) : (
                            filteredProducts.map((p: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{p.productName}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{p.packing}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a' }}>{Number(p.quantitySold).toLocaleString()}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}>{fmtPKR(p.salesAmount)}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                                    {p.shareOfTotalPercent}%
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Posted Invoices */}
                <Card style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <CardHeader style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff', margin: 0 }}>
                    <div>
                      <CardTitle style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        Posted Sales Invoices in Period
                      </CardTitle>
                      <CardDescription style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Legally dispatched commercial tax invoices
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice #</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Date</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Items</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Net Amount</th>
                            <th style={{ padding: '9px 14px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(performanceData.invoices || []).length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                No posted invoices found in this period.
                              </td>
                            </tr>
                          ) : (
                            (performanceData.invoices || []).map((inv: any) => (
                              <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                                  {inv.invoiceNumber}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>
                                  {new Date(inv.invoiceDate).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                                  {inv.itemsCount} lines
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                                  {fmtPKR(inv.netAmount)}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  <Button
                                    variant="secondary"
                                    onClick={() => openInvoicePreview(inv.id)}
                                    style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <IconEye size={12} />
                                    <span>View</span>
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invoice Modal Preview */}
      <SalesInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={activeInvoice}
      />

      {/* In-App PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        title={pdfViewerTitle}
        htmlContent={pdfViewerHtml}
      />
    </div>
  );
};