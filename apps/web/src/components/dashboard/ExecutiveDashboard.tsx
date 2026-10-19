'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/auth-context';
import { ApiClient } from '../../lib/api-client';
import {
  KpiCard,
  Button,
  Badge,
  StatusBadge,
  TableSkeleton,
  ErrorState,
  DataTable,
  ColumnDef,
} from '../ui';
import {
  IconDashboard,
  IconInventory,
  IconRefresh,
  IconClock,
  IconSales,
  IconProcurement,
  IconDealers,
  IconIntercompany,
  IconProducts,
  IconChevronRight,
  IconPackage,
} from '../icons';
import { useToast } from '../../context/toast-context';

interface ExecutiveDashboardProps {
  onNavigate: (routeId: string) => void;
}

interface MonthlySpendBucket {
  key: string;
  month: string;
  year: number;
  spend: number;
  count: number;
  current: boolean;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pos' | 'sales' | 'prs' | 'audits'>('pos');

  // Live Metrics State - 100% Real PostgreSQL Data
  const [counts, setCounts] = useState({
    companies: 0,
    plants: 0,
    warehouses: 0,
    vendors: 0,
    dealers: 0,
    rawMaterials: 0,
    packingMaterials: 0,
    finishedProducts: 0,
    prs: 0,
    pos: 0,
    salesOrders: 0,
    salesInvoices: 0,
    grns: 0,
    notifications: 0,
    totalPoSpend: 0,
    totalSalesRevenue: 0,
    totalStockOnHand: 0,
  });

  const [recentPos, setRecentPos] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [recentPrs, setRecentPrs] = useState<any[]>([]);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [monthlySpendBuckets, setMonthlySpendBuckets] = useState<MonthlySpendBucket[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        compsRes,
        plantsRes,
        whsRes,
        vndsRes,
        dealersRes,
        rawMatsRes,
        packMatsRes,
        productsRes,
        prsRes,
        posRes,
        salesOrdersRes,
        salesInvoicesRes,
        grnsRes,
        stockRes,
        auditsRes,
        notifsRes,
      ] = await Promise.allSettled([
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/plants'),
        ApiClient.get<any>('/api/v1/master-data/warehouses'),
        ApiClient.get<any>('/api/v1/procurement/vendors'),
        ApiClient.get<any>('/api/v1/dealers'),
        ApiClient.get<any>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any>('/api/v1/master-data/finished-products'),
        ApiClient.get<any>('/api/v1/procurement/purchase-requisitions'),
        ApiClient.get<any>('/api/v1/procurement/purchase-orders'),
        ApiClient.get<any>('/api/v1/sales-orders'),
        ApiClient.get<any>('/api/v1/sales-invoices'),
        ApiClient.get<any>('/api/v1/procurement/goods-receipts'),
        ApiClient.get<any>('/api/v1/warehouse-stock/report'),
        ApiClient.get<any>('/api/v1/audit/logs?limit=8'),
        ApiClient.get<any>('/api/v1/notifications'),
      ]);

      const unwrap = (res: PromiseSettledResult<any>): any[] => {
        if (res.status !== 'fulfilled' || !res.value) return [];
        const val = res.value;
        if (Array.isArray(val)) return val;
        if (Array.isArray(val.data)) return val.data;
        if (Array.isArray(val.items)) return val.items;
        if (Array.isArray(val.data?.items)) return val.data.items;
        if (Array.isArray(val.data?.data)) return val.data.data;
        if (Array.isArray(val.result)) return val.result;
        if (Array.isArray(val.records)) return val.records;
        return [];
      };

      const companies = unwrap(compsRes);
      const plants = unwrap(plantsRes);
      const warehouses = unwrap(whsRes);
      const vendors = unwrap(vndsRes);
      const dealers = unwrap(dealersRes);
      const rawMaterials = unwrap(rawMatsRes);
      const packingMaterials = unwrap(packMatsRes);
      const products = unwrap(productsRes);
      const prs = unwrap(prsRes);
      const pos = unwrap(posRes);
      const salesOrders = unwrap(salesOrdersRes);
      const salesInvoices = unwrap(salesInvoicesRes);
      const grns = unwrap(grnsRes);
      const stock = unwrap(stockRes);
      const audits = unwrap(auditsRes);
      const notifs = unwrap(notifsRes);

      // Real calculations
      const totalPoSpend = pos.reduce((sum: number, po: any) => sum + (Number(po.totalAmount) || 0), 0);
      const invoicesRev = salesInvoices.reduce(
        (sum: number, s: any) => sum + (Number(s.netAmount || s.totalAmount || s.grossAmount) || 0),
        0
      );
      const ordersRev = salesOrders.reduce(
        (sum: number, s: any) => sum + (Number(s.totalAmount || s.netAmount || s.grossAmount) || 0),
        0
      );
      const totalSalesRevenue = invoicesRev > 0 ? invoicesRev : ordersRev;

      const totalStockOnHand = stock.reduce(
        (sum: number, st: any) => sum + (Number(st.quantityOnHand) || 0),
        0
      );

      // Real Monthly Spend Histogram from Actual PO records
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const buckets: MonthlySpendBucket[] = [];

      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        buckets.push({
          key,
          month: monthNames[d.getMonth()] || 'M',
          year: d.getFullYear(),
          spend: 0,
          count: 0,
          current: i === 0,
        });
      }

      pos.forEach((po: any) => {
        const poDate = po.createdAt || po.orderDate;
        if (!poDate) return;
        const d = new Date(poDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const bucket = buckets.find((b) => b.key === key);
        if (bucket) {
          bucket.spend += Number(po.totalAmount) || 0;
          bucket.count += 1;
        }
      });

      setMonthlySpendBuckets(buckets);

      setCounts({
        companies: companies.length,
        plants: plants.length,
        warehouses: warehouses.length,
        vendors: vendors.length,
        dealers: dealers.length,
        rawMaterials: rawMaterials.length,
        packingMaterials: packingMaterials.length,
        finishedProducts: products.length,
        prs: prs.length,
        pos: pos.length,
        salesOrders: salesOrders.length,
        salesInvoices: salesInvoices.length,
        grns: grns.length,
        notifications: notifs.filter((n: any) => !n.isRead).length,
        totalPoSpend,
        totalSalesRevenue,
        totalStockOnHand,
      });

      setRecentPos(pos.slice(0, 6));
      setRecentSales((salesInvoices.length > 0 ? salesInvoices : salesOrders).slice(0, 6));
      setRecentPrs(prs.slice(0, 6));
      setRecentAudits(audits.slice(0, 6));
    } catch (err: any) {
      console.error('Failed to load real dashboard telemetry:', err);
      setError(err?.message || 'Failed to aggregate live dashboard telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return `PKR ${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `PKR ${(val / 1000).toFixed(1)}k`;
    }
    return `PKR ${val.toLocaleString()}`;
  };

  // Real Material Catalog Proportions
  const catalogTotal = counts.rawMaterials + counts.packingMaterials + counts.finishedProducts;
  const rawPct = catalogTotal > 0 ? Math.round((counts.rawMaterials / catalogTotal) * 100) : 0;
  const packPct = catalogTotal > 0 ? Math.round((counts.packingMaterials / catalogTotal) * 100) : 0;
  const finPct = catalogTotal > 0 ? Math.max(0, 100 - rawPct - packPct) : 0;

  // Max spend for bar chart scaling
  const maxSpend = useMemo(() => {
    const vals = monthlySpendBuckets.map((b) => b.spend);
    return Math.max(...vals, 1);
  }, [monthlySpendBuckets]);

  // PO Columns
  const poColumns: ColumnDef<any>[] = [
    {
      id: 'poNumber',
      header: 'PO Reference',
      cell: ({ row }) => (
        <span
          style={{
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#2563EB',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
          }}
        >
          {row.original.poNumber || `PO-${row.original.id?.slice(0, 8)}`}
        </span>
      ),
    },
    {
      id: 'vendor',
      header: 'Supplier / Vendor',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
            }}
          >
            {(row.original.vendor?.name || row.original.vendorName || 'V').charAt(0).toUpperCase()}
          </div>
          <span style={{ fontWeight: 600, color: '#1E293B' }}>
            {row.original.vendor?.name || row.original.vendorName || 'Commercial Supplier'}
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Order Value',
      cell: ({ row }) => (
        <span style={{ fontWeight: 700, color: '#0F172A' }}>
          PKR {Number(row.original.totalAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  // Sales Columns
  const salesColumns: ColumnDef<any>[] = [
    {
      id: 'invoiceNumber',
      header: 'Invoice / Order #',
      cell: ({ row }) => (
        <span
          style={{
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#059669',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
          }}
        >
          {row.original.invoiceNumber || row.original.orderNumber || `INV-${row.original.id?.slice(0, 8)}`}
        </span>
      ),
    },
    {
      id: 'dealer',
      header: 'Dealer Account',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#F0FDF4',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
            }}
          >
            {(row.original.dealer?.name || row.original.dealerName || 'D').charAt(0).toUpperCase()}
          </div>
          <span style={{ fontWeight: 600, color: '#1E293B' }}>
            {row.original.dealer?.name || row.original.dealerName || 'Commercial Dealer'}
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Commercial Total',
      cell: ({ row }) => (
        <span style={{ fontWeight: 700, color: '#0F172A' }}>
          PKR {Number(row.original.netAmount || row.original.totalAmount || row.original.grossAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'State',
      cell: ({ row }) => <StatusBadge status={row.original.postingStatus || row.original.status || 'APPROVED'} />,
    },
  ];

  // PR Columns
  const prColumns: ColumnDef<any>[] = [
    {
      id: 'prNumber',
      header: 'Requisition ID',
      cell: ({ row }) => (
        <span
          style={{
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#0D9488',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: '#F0FDFA',
            border: '1px solid #99F6E4',
          }}
        >
          {row.original.prNumber || `PR-${row.original.id?.slice(0, 8)}`}
        </span>
      ),
    },
    {
      id: 'department',
      header: 'Initiator / Department',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, color: '#334155' }}>
          {row.original.departmentName || row.original.department?.name || 'Production Plant'}
        </span>
      ),
    },
    {
      id: 'priority',
      header: 'Urgency',
      cell: ({ row }) => (
        <Badge variant={row.original.priority === 'URGENT' ? 'danger' : 'neutral'}>
          {row.original.priority || 'NORMAL'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Approval State',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  // 1-Click Launchpad Actions Designed for Non-Technical Clients
  const quickActions = [
    {
      title: 'New Sales Order',
      desc: 'Sell fertilizer & agrochemicals to registered dealers',
      route: 'sales-orders',
      icon: <IconSales size={22} />,
      gradient: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      glow: 'rgba(37, 99, 235, 0.25)',
      badge: 'Sales Hub',
    },
    {
      title: 'Purchase Order',
      desc: 'Create or approve orders for raw materials & bottles',
      route: 'purchase-orders',
      icon: <IconProcurement size={22} />,
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      glow: 'rgba(5, 150, 105, 0.25)',
      badge: 'Procurement',
    },
    {
      title: 'Finished Products',
      desc: 'Formulation recipes, bottle sizes & commercial pricing',
      route: 'finished-products',
      icon: <IconProducts size={22} />,
      gradient: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
      glow: 'rgba(13, 148, 136, 0.25)',
      badge: 'Formulations',
    },
    {
      title: 'Warehouse Stock',
      desc: 'Live inventory on hand, raw tanks & chemical batches',
      route: 'warehouse-stock',
      icon: <IconInventory size={22} />,
      gradient: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
      glow: 'rgba(234, 88, 12, 0.25)',
      badge: 'Live Stock',
    },
    {
      title: 'Dealers & Balances',
      desc: 'Check accounts, credit limits, invoices & bank receipts',
      route: 'dealers',
      icon: <IconDealers size={22} />,
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
      glow: 'rgba(124, 58, 237, 0.25)',
      badge: 'Accounts',
    },
    {
      title: 'Intercompany Transfer',
      desc: 'Transfer stock between Parent Company and Child Units',
      route: 'intercompany-transfers',
      icon: <IconIntercompany size={22} />,
      gradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
      glow: 'rgba(71, 85, 105, 0.25)',
      badge: 'Transfers',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      {/* 1. VISUAL EXECUTIVE HERO BANNER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #0F766E 100%)',
          borderRadius: '18px',
          padding: '1.75rem 2rem',
          color: '#FFFFFF',
          boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.35)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        {/* Subtle Decorative Ambient Rings */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-40px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ zIndex: 1, maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#34D399',
                letterSpacing: '0.04em',
              }}
            >
              <span className="pulse-glow-dot" />
              LIVE POSTGRESQL TELEMETRY
            </span>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>{currentDateFormatted}</span>
          </div>

          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 6px 0',
              lineHeight: 1.2,
            }}
          >
            {greeting},{' '}
            <span style={{ color: '#5EEAD4' }}>
              {user?.firstName || (user?.isSuperAdmin ? 'Executive Director' : 'Manager')}
            </span>
          </h1>

          <p style={{ margin: 0, fontSize: '0.92rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            {user?.isSuperAdmin
              ? 'Shehswar Group Multi-Entity ERP. Live production batches, purchase orders, dealer ledgers, and inventory telemetry.'
              : `Operating Unit: ${user?.company?.name || 'Child Company'}. All operational records, inventories, and dealer invoices are current.`}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1 }}>
          <button
            type="button"
            onClick={() => {
              fetchDashboardData();
              showToast({ title: 'Refreshed', message: 'All live telemetry reloaded from PostgreSQL', type: 'info' });
            }}
            className="modern-btn-interactive"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 180ms ease',
            }}
          >
            <IconRefresh size={16} />
            Sync Data
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales-orders')}
            className="modern-btn-interactive"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              transition: 'all 180ms ease',
            }}
          >
            <IconSales size={16} />
            + New Sale
          </button>
        </div>
      </div>

      {/* 2. NON-TECHNICAL CLIENT 1-CLICK LAUNCHPAD */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Quick Launch Operations
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
              One-click shortcuts to common daily workflows. No complicated navigation required.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gridAutoRows: '1fr', gap: '14px' }}>
          {quickActions.map((action, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate(action.route)}
              className="modern-hover-card"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                padding: '16px 18px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '11px',
                      background: action.gradient,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${action.glow}`,
                      flexShrink: 0,
                    }}
                  >
                    {action.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#64748B',
                      backgroundColor: '#F1F5F9',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {action.badge}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0F172A',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={action.title}
                >
                  {action.title}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#64748B',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: '32px',
                  }}
                  title={action.desc}
                >
                  {action.desc}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#2563EB',
                  marginTop: '12px',
                }}
              >
                <span>Launch</span>
                <IconChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. VISUAL HIGH-IMPACT KPI CARDS - 100% REAL POSTGRESQL DATA */}
      {isLoading ? (
        <TableSkeleton rows={2} columns={4} />
      ) : error ? (
        <ErrorState title="Telemetry Error" message={error} onRetry={fetchDashboardData} />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Live Key Performance Indicators
            </h2>
            <span style={{ fontSize: '12px', color: '#64748B' }}>100% Live Aggregates from Database</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gridAutoRows: '1fr', gap: '14px' }}>
            {/* Real Procurement Spend */}
            <div onClick={() => onNavigate('purchase-orders')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Procurement Spend"
                value={formatCurrency(counts.totalPoSpend)}
                icon={<IconDashboard size={22} />}
                subtitle={`${counts.pos} purchase orders in database`}
                status="positive"
                accentColor="#2563EB"
              />
            </div>

            {/* Real Sales Revenue */}
            <div onClick={() => onNavigate('sales-orders')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Commercial Sales"
                value={formatCurrency(counts.totalSalesRevenue)}
                icon={<IconSales size={22} />}
                subtitle={`${counts.salesOrders + counts.salesInvoices} commercial transactions`}
                status="positive"
                accentColor="#059669"
              />
            </div>

            {/* Real Finished Products */}
            <div onClick={() => onNavigate('finished-products')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Finished Formulations"
                value={counts.finishedProducts}
                icon={<IconProducts size={22} />}
                subtitle={`${counts.finishedProducts} registered SKUs & recipes`}
                status="positive"
                accentColor="#0D9488"
              />
            </div>

            {/* Real Raw & Packing Materials */}
            <div onClick={() => onNavigate('raw-materials')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Raw & Packing Catalog"
                value={counts.rawMaterials + counts.packingMaterials}
                icon={<IconPackage size={22} />}
                subtitle={`${counts.rawMaterials} raw · ${counts.packingMaterials} packaging`}
                status="positive"
                accentColor="#F59E0B"
              />
            </div>

            {/* Real Warehouses */}
            <div onClick={() => onNavigate('warehouse-stock')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Storage Facilities"
                value={counts.warehouses}
                icon={<IconInventory size={22} />}
                subtitle={`${counts.warehouses} active warehouse silos`}
                status="positive"
                accentColor="#EA580C"
              />
            </div>

            {/* Real Dealers */}
            <div onClick={() => onNavigate('dealers')} style={{ cursor: 'pointer', height: '100%' }}>
              <KpiCard
                title="Registered Dealers"
                value={counts.dealers}
                icon={<IconDealers size={22} />}
                subtitle={`${counts.dealers} authorized distributors`}
                status="positive"
                accentColor="#7C3AED"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. REAL CHEMICAL ENTERPRISE PIPELINE STAGES */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              End-to-End Enterprise Flow Pipeline
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              Real live transactions progressing through each canonical stage
            </p>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#0D9488',
              backgroundColor: '#F0FDFA',
              border: '1px solid #99F6E4',
              padding: '3px 9px',
              borderRadius: '999px',
            }}
          >
            Real Telemetry
          </span>
        </div>

        {/* Pipeline Visual Stepper with Actual Database Counts */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gridAutoRows: '1fr',
            gap: '10px',
          }}
        >
          {[
            { step: '01', title: 'Requisitions', desc: `${counts.prs} PRs in database`, color: '#6366F1', route: 'purchases' },
            { step: '02', title: 'Purchase Orders', desc: `${counts.pos} POs issued`, color: '#2563EB', route: 'purchase-orders' },
            { step: '03', title: 'Goods Receipts', desc: `${counts.grns} Receipts recorded`, color: '#0284C7', route: 'purchases' },
            { step: '04', title: 'Formulations', desc: `${counts.finishedProducts} Finished SKUs`, color: '#0D9488', route: 'finished-products' },
            { step: '05', title: 'Materials Catalog', desc: `${counts.rawMaterials + counts.packingMaterials} Materials`, color: '#F59E0B', route: 'warehouse-stock' },
            { step: '06', title: 'Dealer Orders', desc: `${counts.salesOrders + counts.salesInvoices} Transactions`, color: '#10B981', route: 'sales-orders' },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate(item.route)}
              className="modern-hover-card"
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                padding: '12px 14px',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                boxSizing: 'border-box',
                transition: 'all 160ms ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: item.color,
                      fontFamily: 'monospace',
                    }}
                  >
                    STAGE {item.step}
                  </span>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. VISUAL CHARTS & METRIC DISTRIBUTION - REAL DATABASE CALCULATIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gridAutoRows: '1fr', gap: '16px' }}>
        {/* Real Monthly Spend Breakdown from Actual POs */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Monthly Procurement Commitments
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Actual total PO spend grouped by month from database records
                </p>
              </div>
              <Badge variant="primary">{counts.pos} Total POs</Badge>
            </div>

            {/* Real Dynamic Bar Chart from Actual PO Data */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '140px', padding: '16px 0 10px 0' }}>
              {monthlySpendBuckets.map((bar, i) => {
                const heightPercent = maxSpend > 0 && bar.spend > 0 ? Math.max(12, Math.round((bar.spend / maxSpend) * 100)) : 6;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: bar.current ? '#2563EB' : '#64748B',
                        whiteSpace: 'nowrap',
                      }}
                      title={`${bar.month}: PKR ${bar.spend.toLocaleString()} (${bar.count} POs)`}
                    >
                      {bar.spend > 0 ? (bar.spend >= 1000000 ? `${(bar.spend / 1000000).toFixed(1)}M` : `${(bar.spend / 1000).toFixed(0)}k`) : '0'}
                    </span>
                    <div
                      title={`${bar.month}: PKR ${bar.spend.toLocaleString()} (${bar.count} POs)`}
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: `${heightPercent}%`,
                        background: bar.current
                          ? 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)'
                          : bar.spend > 0
                            ? 'linear-gradient(180deg, #93C5FD 0%, #60A5FA 100%)'
                            : '#F1F5F9',
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 200ms ease',
                      }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: bar.current ? 700 : 500, color: '#475569' }}>
                      {bar.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginTop: '10px',
            }}
          >
            <span style={{ color: '#64748B' }}>Total Aggregate PO Spend:</span>
            <span style={{ fontWeight: 700, color: '#2563EB' }}>
              PKR {counts.totalPoSpend.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Real Catalog & Material Breakdown from Database */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Product & Chemical Catalog Mix
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Live ratio of raw chemicals, bottles/packaging, and finished products
                </p>
              </div>
              <Badge variant="success">{catalogTotal} Master Items</Badge>
            </div>

            {/* Real Segmented Proportion Bar */}
            <div style={{ margin: '18px 0 20px 0' }}>
              <div
                style={{
                  height: '18px',
                  borderRadius: '999px',
                  backgroundColor: '#F1F5F9',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <div style={{ width: `${rawPct}%`, backgroundColor: '#0D9488' }} title={`Raw Chemicals: ${rawPct}% (${counts.rawMaterials} items)`} />
                <div style={{ width: `${packPct}%`, backgroundColor: '#F59E0B' }} title={`Packaging & Bottles: ${packPct}% (${counts.packingMaterials} items)`} />
                <div style={{ width: `${finPct}%`, backgroundColor: '#3B82F6' }} title={`Finished Commercial Products: ${finPct}% (${counts.finishedProducts} items)`} />
              </div>

              {/* Legend with Real Counts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#0D9488', flexShrink: 0 }} />
                  <span>Raw Materials: <strong>{counts.rawMaterials}</strong> ({rawPct}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#F59E0B', flexShrink: 0 }} />
                  <span>Packaging: <strong>{counts.packingMaterials}</strong> ({packPct}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#3B82F6', flexShrink: 0 }} />
                  <span>Finished SKUs: <strong>{counts.finishedProducts}</strong> ({finPct}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10B981', flexShrink: 0 }} />
                  <span>Stock Items: <strong>{counts.totalStockOnHand.toLocaleString()}</strong> units</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('finished-products')}
            className="modern-btn-interactive"
            style={{
              padding: '9px 14px',
              borderRadius: '9px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '10px',
            }}
          >
            <span>Open Catalog Master Data</span>
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 6. TABBED LIVE TRANSACTION STREAMS - 100% REAL POSTGRESQL DATA */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Clean Modern Tabs Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'pos' ? '#2563EB' : 'transparent',
                color: activeTab === 'pos' ? '#FFFFFF' : '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Purchase Orders ({recentPos.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'sales' ? '#2563EB' : 'transparent',
                color: activeTab === 'sales' ? '#FFFFFF' : '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Sales Transactions ({recentSales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prs')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'prs' ? '#2563EB' : 'transparent',
                color: activeTab === 'prs' ? '#FFFFFF' : '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Requisitions ({recentPrs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audits')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'audits' ? '#2563EB' : 'transparent',
                color: activeTab === 'audits' ? '#FFFFFF' : '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Audit Stream ({recentAudits.length})
            </button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (activeTab === 'pos') onNavigate('purchase-orders');
              else if (activeTab === 'sales') onNavigate('sales-orders');
              else if (activeTab === 'prs') onNavigate('purchases');
              else onNavigate('audit-logs');
            }}
          >
            Open Full Workspace →
          </Button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'pos' && (
            recentPos.length > 0 ? (
              <DataTable columns={poColumns} data={recentPos} />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                No purchase orders recorded in PostgreSQL yet.
              </div>
            )
          )}

          {activeTab === 'sales' && (
            recentSales.length > 0 ? (
              <DataTable columns={salesColumns} data={recentSales} />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                No sales invoices or orders recorded in PostgreSQL yet.
              </div>
            )
          )}

          {activeTab === 'prs' && (
            recentPrs.length > 0 ? (
              <DataTable columns={prColumns} data={recentPrs} />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                No purchase requisitions recorded in PostgreSQL yet.
              </div>
            )
          )}

          {activeTab === 'audits' && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentAudits.length > 0 ? (
                recentAudits.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '9px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconClock size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                          {item.summary || `${item.action} on ${item.resource}`}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          Actor: <strong style={{ color: '#334155' }}>{item.actorName || item.actorEmail || 'System'}</strong>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  No recent audit transactions logged.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
