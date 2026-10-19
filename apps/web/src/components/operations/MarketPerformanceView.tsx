'use client';

/**
 * SHEHSWAR ONE360 - Interactive Market Performance & Hierarchical Drill-Down Dashboard
 *
 * Implements the complete 8-tier top-down and bottom-up drill-down path:
 * Group (Punjab Total) -> Region -> Zone -> Territory -> Sales Officer -> Dealer -> Invoices -> Product
 *
 * Consistent with Enterprise Design System:
 * - Theme tokens: var(--bg-surface), var(--text-primary), var(--border-subtle), var(--brand-primary)
 * - Zero hardcoded icons / emojis -> Standardized Lucide-based Icon components
 * - Instant View & Download PDF reports across all 6 tiers with official executive formatting
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';
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
} from '../icons';

interface BreadcrumbItem {
  level: 'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'OFFICER' | 'DEALER';
  id?: string;
  name: string;
}

export const MarketPerformanceView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Period state (default current month and year)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Navigation hierarchy state
  const [currentLevel, setCurrentLevel] = useState<'GROUP' | 'REGION' | 'ZONE' | 'TERRITORY' | 'OFFICER' | 'DEALER'>('GROUP');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { level: 'GROUP', name: 'Punjab Group Total' },
  ]);

  // Data payload for currently active level
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Invoice modal preview state
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoiceExportData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  // Fetch performance data depending on current level
  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = `/api/v1/market-performance/group?month=${selectedMonth}&year=${selectedYear}`;

      if (currentLevel === 'REGION' && selectedRegionId) {
        endpoint = `/api/v1/market-performance/region/${selectedRegionId}?month=${selectedMonth}&year=${selectedYear}`;
      } else if (currentLevel === 'ZONE' && selectedZoneId) {
        endpoint = `/api/v1/market-performance/zone/${selectedZoneId}?month=${selectedMonth}&year=${selectedYear}`;
      } else if (currentLevel === 'TERRITORY' && selectedTerritoryId) {
        endpoint = `/api/v1/market-performance/territory/${selectedTerritoryId}?month=${selectedMonth}&year=${selectedYear}`;
      } else if (currentLevel === 'OFFICER' && selectedOfficerId) {
        endpoint = `/api/v1/market-performance/officer/${selectedOfficerId}?month=${selectedMonth}&year=${selectedYear}`;
      } else if (currentLevel === 'DEALER' && selectedDealerId) {
        endpoint = `/api/v1/market-performance/dealer/${selectedDealerId}?month=${selectedMonth}&year=${selectedYear}`;
      }

      const res = await ApiClient.get<any>(endpoint);
      if (res.data) {
        setPerformanceData(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  }, [currentLevel, selectedRegionId, selectedZoneId, selectedTerritoryId, selectedOfficerId, selectedDealerId, selectedMonth, selectedYear]);

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
    setBreadcrumbs([{ level: 'GROUP', name: 'Punjab Group Total' }]);
  };

  const navigateToRegion = (regionId: string, regionName: string) => {
    setSelectedRegionId(regionId);
    setCurrentLevel('REGION');
    setBreadcrumbs([
      { level: 'GROUP', name: 'Punjab Group Total' },
      { level: 'REGION', id: regionId, name: `${regionName} Region` },
    ]);
  };

  const navigateToZone = (zoneId: string, zoneName: string) => {
    setSelectedZoneId(zoneId);
    setCurrentLevel('ZONE');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 2),
      { level: 'ZONE', id: zoneId, name: `${zoneName} Zone` },
    ]);
  };

  const navigateToTerritory = (territoryId: string, territoryName: string) => {
    setSelectedTerritoryId(territoryId);
    setCurrentLevel('TERRITORY');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 3),
      { level: 'TERRITORY', id: territoryId, name: territoryName },
    ]);
  };

  const navigateToOfficer = (officerId: string, officerName: string) => {
    setSelectedOfficerId(officerId);
    setCurrentLevel('OFFICER');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 4),
      { level: 'OFFICER', id: officerId, name: `SO: ${officerName}` },
    ]);
  };

  const navigateToDealer = (dealerId: string, dealerName: string) => {
    setSelectedDealerId(dealerId);
    setCurrentLevel('DEALER');
    setBreadcrumbs((prev) => [
      ...prev.slice(0, 5),
      { level: 'DEALER', id: dealerId, name: dealerName },
    ]);
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem, index: number) => {
    if (index === breadcrumbs.length - 1) return;
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

  // Tier PDF Export Handler
  const handleExportCurrentTierPdf = () => {
    if (!performanceData) return;
    const periodLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;

    if (currentLevel === 'GROUP') {
      exportMarketPerformancePdf({
        tierName: 'Executive Provincial Total',
        scopeTitle: 'Punjab Provincial Total — Operating Regions',
        periodLabel,
        kpis: [
          { label: 'Total Net Revenue', value: `PKR ${Number(metrics.totalRevenue || 0).toLocaleString()}`, sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of assigned target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Total Quantity Sold', value: `${Number(metrics.totalQuantity || 0).toLocaleString()} units`, sub: 'Finished Goods' },
          { label: 'Posted Invoices', value: `${Number(metrics.totalOrders || 0).toLocaleString()}`, sub: 'Zero draft leakage' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Purchased in period', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: `PKR ${Number(metrics.averageDealerSales || 0).toLocaleString()}`, sub: 'Revenue / Active Dealers' },
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
          { text: r.regionName, bold: true },
          { text: r.businessManager || 'Unassigned' },
          { text: r.zonesCount, align: 'center' },
          { text: `PKR ${Number(r.target).toLocaleString()}`, align: 'right' },
          { text: `PKR ${Number(r.actualSales).toLocaleString()}`, align: 'right', bold: true },
          {
            text: `${r.achievementPercent}%`,
            align: 'center',
            isBadge: true,
            badgeBg: r.achievementPercent >= 100 ? '#dcfce7' : '#e0f2fe',
            badgeColor: r.achievementPercent >= 100 ? '#166534' : '#0369a1',
          },
          { text: r.activeDealers, align: 'center' },
          { text: `PKR ${Number(r.averageDealerSales).toLocaleString()}`, align: 'right' },
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
          { label: 'Regional Revenue', value: `PKR ${Number(metrics.totalRevenue || 0).toLocaleString()}`, sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Regional Target', value: `PKR ${Number(metrics.target || 0).toLocaleString()}`, sub: 'Monthly Quota' },
          { label: 'Quota Achievement', value: `${metrics.achievementPercent || 0}%`, sub: 'of regional target', color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Active Dealers', value: `${Number(metrics.activeDealers || 0).toLocaleString()}`, sub: 'Regional Accounts', color: '#10b981' },
          { label: 'Avg Dealer Sales', value: `PKR ${Number(metrics.averageDealerSales || 0).toLocaleString()}`, sub: 'Average Order Size' },
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
          { text: z.zoneName, bold: true },
          { text: z.areaManager || 'Unassigned' },
          { text: z.territoriesCount, align: 'center' },
          { text: `PKR ${Number(z.target).toLocaleString()}`, align: 'right' },
          { text: `PKR ${Number(z.actualSales).toLocaleString()}`, align: 'right', bold: true },
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
          { label: 'Zone Revenue', value: `PKR ${Number(metrics.totalRevenue || 0).toLocaleString()}`, sub: 'Posted Net Sales Only', color: 'var(--brand-primary)' },
          { label: 'Zone Target', value: `PKR ${Number(metrics.target || 0).toLocaleString()}`, sub: 'Monthly Quota' },
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
          { text: t.territoryName, bold: true },
          { text: t.primaryOfficer || 'Direct' },
          { text: `PKR ${Number(t.target).toLocaleString()}`, align: 'right' },
          { text: `PKR ${Number(t.actualSales).toLocaleString()}`, align: 'right', bold: true },
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
          { label: 'Territory Revenue', value: `PKR ${Number(metrics.totalRevenue || 0).toLocaleString()}`, color: 'var(--brand-primary)' },
          { label: 'Territory Target', value: `PKR ${Number(metrics.target || 0).toLocaleString()}` },
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
          { text: `PKR ${Number(o.target).toLocaleString()}`, align: 'right' },
          { text: `PKR ${Number(o.actualSales).toLocaleString()}`, align: 'right', bold: true },
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
          { label: 'Total Posted Sales', value: `PKR ${Number(metrics.totalRevenue || 0).toLocaleString()}`, color: 'var(--brand-primary)' },
          { label: 'Monthly Quota', value: `PKR ${Number(metrics.target || 0).toLocaleString()}` },
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
          { text: `PKR ${Number(d.monthlyTarget).toLocaleString()}`, align: 'right' },
          { text: `PKR ${Number(d.actualSales).toLocaleString()}`, align: 'right', bold: true },
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
      exportMarketPerformancePdf({
        tierName: 'Dealer Target & Performance Card',
        scopeTitle: `${dlr.name} (${dlr.code})`,
        periodLabel,
        metaFields: [
          { label: 'Territory', value: dlr.territory || '—' },
          { label: 'Zone', value: dlr.zone || '—' },
          { label: 'Region', value: dlr.region || '—' },
          { label: 'Field Officer', value: dlr.assignedOfficer || '—' },
        ],
        kpis: [
          { label: 'Month Actual Sales', value: `PKR ${Number(tg.monthlyActualSales || 0).toLocaleString()}`, color: 'var(--brand-primary)' },
          { label: 'Month Target', value: `PKR ${Number(tg.monthlyTarget || 0).toLocaleString()}` },
          { label: 'Month Achievement', value: `${tg.monthlyAchievementPercent || 0}%`, color: Number(tg.monthlyAchievementPercent) >= 100 ? '#10b981' : '#0284c7' },
          { label: 'Annual Agreement Target', value: `PKR ${Number(tg.annualAgreementTarget || 0).toLocaleString()}` },
          { label: 'YTD Actual Sales', value: `PKR ${Number(tg.ytdActualSales || 0).toLocaleString()}`, sub: `${tg.ytdAchievementPercent || 0}% Annual Achieved`, color: '#0284c7' },
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
          { text: `PKR ${Number(p.salesAmount).toLocaleString()}`, align: 'right', bold: true },
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
              { text: `PKR ${Number(inv.netAmount).toLocaleString()}`, align: 'right', bold: true },
            ]),
          },
        ],
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Header Bar */}
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
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Market Structure & Sales Performance Engine
            </h1>
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              4-Tier Hierarchy Live
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Provincial Top-Down Rollup & Interactive Drill-Down • Strict Posted-Only Financial Engine
          </div>
        </div>

        {/* Action Controls & Date Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <IconShield size={14} color="#10b981" />
            <span>Posted Sales Only</span>
          </div>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              fontSize: '13px',
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

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>

          <Button variant="secondary" onClick={fetchPerformance}>
            <IconRefresh size={14} /> Refresh
          </Button>

          {/* Download & View PDF Report Button for Current Tier */}
          <Button
            variant="primary"
            onClick={handleExportCurrentTierPdf}
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconPrinter size={15} />
            <span>Download PDF Report</span>
          </Button>
        </div>
      </div>

      {/* Interactive Breadcrumbs Trail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          overflowX: 'auto',
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Hierarchy Scope:</span>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(crumb, idx)}
                style={{
                  background: isLast ? 'var(--brand-primary)' : 'transparent',
                  color: isLast ? '#ffffff' : 'var(--brand-primary)',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: isLast ? 700 : 600,
                  cursor: isLast ? 'default' : 'pointer',
                  textDecoration: isLast ? 'none' : 'underline',
                  fontSize: '12.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {crumb.name}
              </button>
              {!isLast && <IconChevronRight size={13} color="var(--text-muted)" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* 6 Core KPI Cards Ribbon (Shown on Non-Dealer screens) */}
      {currentLevel !== 'DEALER' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Revenue */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconTrendingUp size={14} color="var(--brand-primary)" />
              <span>Total Net Revenue</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
              PKR {Number(metrics.totalRevenue || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
              Posted Net Sales Only
            </div>
          </div>

          {/* Target & Achievement % */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconSparkles size={14} color="#0284c7" />
              <span>Quota Achievement</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7' }}>
                {metrics.achievementPercent || 0}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>of target</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--bg-subtle)', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Number(metrics.achievementPercent || 0))}%`,
                  height: '100%',
                  background: Number(metrics.achievementPercent) >= 100 ? '#10b981' : '#0284c7',
                }}
              />
            </div>
          </div>

          {/* Sold Quantity */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconPackage size={14} color="var(--text-secondary)" />
              <span>Total Quantity Sold</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
              {Number(metrics.totalQuantity || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>All finished products</div>
          </div>

          {/* Orders Count */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconFileText size={14} color="var(--text-secondary)" />
              <span>Posted Sales Invoices</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
              {Number(metrics.totalOrders || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Zero draft/challan leakage</div>
          </div>

          {/* Active Selling Dealers */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconBuilding size={14} color="var(--brand-primary)" />
              <span>Active Dealers</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
              {Number(metrics.activeDealers || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>Purchased in period</div>
          </div>

          {/* Average Sales Per Dealer */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <IconTrendingUp size={14} color="var(--text-secondary)" />
              <span>Average Dealer Sales</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'monospace' }}>
              PKR {Number(metrics.averageDealerSales || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Revenue ÷ Active Dealers</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Calculating market rollup aggregates across all hierarchies...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. GROUP VIEW: REGIONS BREAKDOWN                          */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'GROUP' && performanceData?.regions && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Regional Performance (Tier 1: Regions)
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Managed by Business Managers • Click any Region to drill down into its Zones
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
              <IconPrinter size={14} /> Download PDF
            </Button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px' }}>Region</th>
                <th style={{ padding: '10px 14px' }}>Business Manager</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Zones</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Sales (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.regions.map((r: any, idx: number) => (
                <tr
                  key={r.regionId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {r.regionName}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {r.businessManager || 'Unassigned'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace' }}>
                    {r.zonesCount}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PKR {Number(r.target).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                    PKR {Number(r.actualSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.achievementPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                        color: r.achievementPercent >= 100 ? '#10b981' : '#0284c7',
                      }}
                    >
                      {r.achievementPercent}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                    {r.activeDealers}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    PKR {Number(r.averageDealerSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      onClick={() => navigateToRegion(r.regionId, r.regionName)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Drill Down</span>
                      <IconArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 2. REGION VIEW: ZONES BREAKDOWN                           */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'REGION' && performanceData?.zones && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {performanceData.region.name} — Zones Breakdown (Tier 2: Zones)
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Responsible Business Manager: <strong>{performanceData.region.businessManager}</strong> • Click any Zone to drill into Territories
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
                <IconPrinter size={14} /> Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={navigateToGroup}>
                <IconArrowLeft size={14} /> Back to Punjab Group
              </Button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px' }}>Zone</th>
                <th style={{ padding: '10px 14px' }}>Area Manager</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Territories</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Sales (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.zones.map((z: any, idx: number) => (
                <tr
                  key={z.zoneId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {z.zoneName}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {z.areaManager || 'Unassigned'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace' }}>
                    {z.territoriesCount}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PKR {Number(z.target).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                    PKR {Number(z.actualSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: z.achievementPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                        color: z.achievementPercent >= 100 ? '#10b981' : '#0284c7',
                      }}
                    >
                      {z.achievementPercent}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                    {z.activeDealers}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    PKR {Number(z.averageDealerSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      onClick={() => navigateToZone(z.zoneId, z.zoneName)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Drill Down</span>
                      <IconArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 3. ZONE VIEW: TERRITORIES BREAKDOWN                       */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'ZONE' && performanceData?.territories && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {performanceData.zone.name} — Territories Breakdown (Tier 3: Territories)
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Responsible Area Manager: <strong>{performanceData.zone.areaManager}</strong> • Click any Territory to inspect Sales Officers
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
                <IconPrinter size={14} /> Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigateToRegion(selectedRegionId!, breadcrumbs[1]?.name || 'Region')}>
                <IconArrowLeft size={14} /> Back to Region
              </Button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px' }}>Territory</th>
                <th style={{ padding: '10px 14px' }}>Primary Sales Officer</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Sales (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Dealers</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Dealer Sales</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.territories.map((t: any, idx: number) => (
                <tr
                  key={t.territoryId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t.territoryName}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t.primaryOfficer || 'Direct'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PKR {Number(t.target).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                    PKR {Number(t.actualSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: t.achievementPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                        color: t.achievementPercent >= 100 ? '#10b981' : '#0284c7',
                      }}
                    >
                      {t.achievementPercent}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                    {t.activeDealers}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    PKR {Number(t.averageDealerSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      onClick={() => navigateToTerritory(t.territoryId, t.territoryName)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>View Officers</span>
                      <IconArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 4. TERRITORY VIEW: SALES OFFICERS BREAKDOWN               */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'TERRITORY' && performanceData?.officers && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {performanceData.territory.name} — Sales Officers Roster
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Zone: <strong>{performanceData.territory.zoneName}</strong> • Click any Sales Officer to inspect assigned dealers
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
                <IconPrinter size={14} /> Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigateToZone(selectedZoneId!, breadcrumbs[2]?.name || 'Zone')}>
                <IconArrowLeft size={14} /> Back to Zone
              </Button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px' }}>Sales Officer</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Target (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Posted Sales (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Achievement</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Active Selling Dealers</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Sales / Dealer</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.officers.map((o: any, idx: number) => (
                <tr
                  key={o.officerId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {o.officerName}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PKR {Number(o.target).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                    PKR {Number(o.actualSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: o.achievementPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                        color: o.achievementPercent >= 100 ? '#10b981' : '#0284c7',
                      }}
                    >
                      {o.achievementPercent}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                    {o.activeDealers} Dealers
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    PKR {Number(o.averageDealerSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      onClick={() => navigateToOfficer(o.officerId, o.officerName)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>View Dealers</span>
                      <IconArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 5. SALES OFFICER VIEW: DEALERS NETWORK                    */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'OFFICER' && performanceData?.dealers && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Sales Officer: {performanceData.officer.name} — Dealer Accounts
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                FO Salary Justification Return: <strong style={{ color: '#10b981' }}>{performanceData.metrics.salaryJustificationRatio}</strong> • Click any Dealer to open detailed dealer card
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
                <IconPrinter size={14} /> Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigateToTerritory(selectedTerritoryId!, breadcrumbs[3]?.name || 'Territory')}>
                <IconArrowLeft size={14} /> Back to Territory
              </Button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px' }}>Dealer Account</th>
                <th style={{ padding: '10px 14px' }}>City</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Monthly Target (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actual Sales (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Monthly Achievement</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Orders Count</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.dealers.map((d: any, idx: number) => (
                <tr
                  key={d.dealerId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div>{d.dealerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{d.dealerCode}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                    {d.city}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    PKR {Number(d.monthlyTarget).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                    PKR {Number(d.actualSales).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: d.achievementPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : d.actualSales > 0 ? 'rgba(2, 132, 199, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: d.achievementPercent >= 100 ? '#10b981' : d.actualSales > 0 ? '#0284c7' : '#ef4444',
                      }}
                    >
                      {d.achievementPercent}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace' }}>
                    {d.ordersCount}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      onClick={() => navigateToDealer(d.dealerId, d.dealerName)}
                      style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Open Card</span>
                      <IconArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 6. DEALER CARD VIEW: TARGETS, PRODUCTS & INVOICES         */}
      {/* ───────────────────────────────────────────────────────── */}
      {!loading && currentLevel === 'DEALER' && performanceData?.targets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Dealer Header */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {performanceData.dealer.name}
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  ({performanceData.dealer.code})
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Territory: <strong>{performanceData.dealer.territory}</strong> • Zone: <strong>{performanceData.dealer.zone}</strong> • Region: <strong>{performanceData.dealer.region}</strong> • Officer: <strong>{performanceData.dealer.assignedOfficer}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportCurrentTierPdf}>
                <IconPrinter size={14} /> Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigateToOfficer(selectedOfficerId!, breadcrumbs[4]?.name || 'Sales Officer')}>
                <IconArrowLeft size={14} /> Back to Sales Officer
              </Button>
            </div>
          </div>

          {/* Dealer Targets Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Annual Agreement Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Annual Agreement Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                PKR {Number(performanceData.targets.annualAgreementTarget).toLocaleString()}
              </div>
            </div>

            {/* Monthly Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Month Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                PKR {Number(performanceData.targets.monthlyTarget).toLocaleString()}
              </div>
            </div>

            {/* Monthly Actual Sales */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Month Actual Sales</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px', fontFamily: 'monospace' }}>
                PKR {Number(performanceData.targets.monthlyActualSales).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {performanceData.targets.monthlyAchievementPercent}% Monthly Achieved
              </div>
            </div>

            {/* YTD Sales */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>YTD Actual Sales</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                PKR {Number(performanceData.targets.ytdActualSales).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                {performanceData.targets.ytdAchievementPercent}% Annual Achieved
              </div>
            </div>

            {/* Remaining Target */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Remaining Annual Target</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c', marginTop: '4px', fontFamily: 'monospace' }}>
                PKR {Number(performanceData.targets.remainingAnnualTarget).toLocaleString()}
              </div>
            </div>

            {/* FO Salary Return Ratio */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>FO Salary Return</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px', fontFamily: 'monospace' }}>
                {performanceData.salaryJustification.returnMultiple} Return
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>vs PKR 50k FO Monthly Cost</div>
            </div>
          </div>

          {/* Product Breakdown Table & Invoices Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            {/* Product-Level Breakdown */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Product-Level Sales Breakdown (This Month)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '8px 10px' }}>Product</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Pack</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Sales Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.products.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No product sales recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    performanceData.products.map((p: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: idx % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.productName}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{p.packing}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{p.quantitySold.toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>PKR {p.salesAmount.toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {p.shareOfTotalPercent}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Invoices List */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Posted Sales Invoices (This Month)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {performanceData.invoices.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No posted invoices in this period.
                  </div>
                ) : (
                  performanceData.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
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
                          {new Date(inv.invoiceDate).toLocaleDateString()} • {inv.itemsCount} Items
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '14px' }}>
                          PKR {Number(inv.netAmount).toLocaleString()}
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => openInvoicePreview(inv.id)}
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <IconEye size={13} />
                          <span>View Invoice</span>
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
