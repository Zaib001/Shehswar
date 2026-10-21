'use client';

/**
 * SHEHSWAR ONE360 - Attractive, Animated, Modern Enterprise Sidebar
 *
 * Designed to delight and guide the user:
 * - Vibrant jewel-tone icon containers for instant visual recognition
 * - Clean, unified single-section menu with zero duplicates
 * - Scrollbar COMPLETELY HIDDEN across all browsers (scrollbar-width: none, -ms-overflow-style: none, ::-webkit-scrollbar: display none)
 * - Animated micro-interactions, smooth hover transitions, and active glowing indicators
 * - Clean expandable submenus with rotating chevrons
 * - Responsive collapse toggle with premium user status footer
 */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/auth-context';
import {
  IconDashboard,
  IconShield,
  IconBuilding,
  IconChevronDown,
  IconSearch,
  IconProcurement,
  IconInventory,
  IconPackage,
  IconFlask,
  IconCreditCard,
  IconFinance,
  IconReports,
} from '../icons';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  badge?: string;
  badgeColor?: string;
  children?: { id: string; label: string; badge?: string }[];
}

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeRoute: string;
  onNavigate: (routeId: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function isRoutePermitted(routeId: string, user: any): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const permissions: string[] = user.permissions || [];

  switch (routeId) {
    case 'organizations':
    case 'companies':
    case 'plants':
    case 'branches':
    case 'departments':
    case 'warehouses':
    case 'employees':
    case 'uoms':
    case 'material-categories':
    case 'raw-materials':
    case 'packing-materials':
    case 'product-categories':
    case 'pack-sizes':
    case 'finished-products':
    case 'intercompany-pricing':
      return permissions.includes('company:view') || permissions.includes('organization:view') || user.isSuperAdmin;
    case 'users':
    case 'roles':
    case 'permissions':
      return permissions.includes('user:view') || permissions.includes('role:view');
    case 'document-numbering':
    case 'settings':
      return permissions.includes('setting:view') || permissions.includes('document_sequence:view');
    case 'audit-logs':
      return permissions.includes('audit_log:view');
    case 'approvals':
      return permissions.includes('approval_workflow:view') || permissions.includes('approval_workflow:approve');
    case 'dashboard':
    case 'purchases':
    case 'purchase-orders':
    case 'purchase-returns':
    case 'dealers':
    case 'rate-lists':
    case 'sales-orders':
    case 'sales-invoices':
    case 'sales-returns':
    case 'dealer-payments':
    case 'market-management':
    case 'market-performance':
    case 'intercompany-transfers':
    case 'warehouse-stock':
    case 'gate-passes':
    case 'notifications':
      return true;
    default:
      return true;
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  activeRoute,
  onNavigate,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const { user } = useAuth();
  const [navSearch, setNavSearch] = useState('');

  // Expandable groups state - auto-open active module
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'products-master': true,
    'inventory-mgmt': true,
    'purchases-mgmt': true,
    'sales-mgmt': true,
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * ATTRACTIVE, INTUITIVE SINGLE-SECTION NAVIGATION
   * Each module has distinct vibrant jewel-tone styling so clients immediately recognize features
   */
  const navItems: NavItemConfig[] = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <IconDashboard size={18} />,
        color: '#06B6D4',
        gradient: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
      },
      {
        id: 'master-data',
        label: 'Enterprise Structure',
        icon: <IconBuilding size={18} />,
        color: '#6366F1',
        gradient: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
        children: [
          { id: 'organizations', label: 'Organizations' },
          { id: 'companies', label: 'Companies' },
          { id: 'plants', label: 'Plants' },
          { id: 'branches', label: 'Branches' },
          { id: 'departments', label: 'Departments' },
          { id: 'employees', label: 'Employees & Cost Control', badge: '13% Cost' },
          { id: 'vehicles', label: 'Vehicles & Fleet Management', badge: 'Fleet' },
        ],
      },
      {
        id: 'materials-master',
        label: 'Materials Master',
        icon: <IconPackage size={18} />,
        color: '#F59E0B',
        gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
        children: [
          { id: 'raw-materials', label: 'Raw Materials' },
          { id: 'packing-materials', label: 'Packing Materials' },
          { id: 'uoms', label: 'Units of Measure' },
          { id: 'material-categories', label: 'Material Categories' },
        ],
      },
      {
        id: 'products-master',
        label: 'Finished Products',
        icon: <IconFlask size={18} />,
        color: '#10B981',
        gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
        badge: 'Costing',
        badgeColor: '#10B981',
        children: [
          { id: 'finished-products', label: 'Finished Products Catalog' },
          { id: 'product-categories', label: 'Product Categories' },
          { id: 'pack-sizes', label: 'Pack Sizes' },
        ],
      },
      {
        id: 'purchases-mgmt',
        label: 'Purchases',
        icon: <IconProcurement size={18} />,
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
        children: [
          { id: 'procurement-vendors', label: 'Vendors / Suppliers' },
          { id: 'purchase-orders', label: 'Purchase Orders' },
          { id: 'purchases', label: 'Purchase Invoices' },
          { id: 'purchase-returns', label: 'Purchase Returns' },
        ],
      },
      {
        id: 'sales-mgmt',
        label: 'Sales & Distribution',
        icon: <IconCreditCard size={18} />,
        color: '#3B82F6',
        gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
        children: [
          { id: 'rate-lists', label: 'Pricing & Rate Lists', badge: 'Dynamic' },
          { id: 'market-management', label: 'Market Hierarchy & Assignments', badge: 'Hierarchy' },
          { id: 'sales-orders', label: 'Sales Orders' },
          { id: 'sales-invoices', label: 'Sales Invoices' },
          { id: 'dealers', label: 'Dealers & Balances' },
          { id: 'market-performance', label: 'Market Performance (4-Tier)', badge: '4-Tier' },
          { id: 'sales-returns', label: 'Sales Returns' },
          { id: 'dealer-payments', label: 'Bank & Cash Receipts' },
        ],
      },
      {
        id: 'finance-mgmt',
        label: 'Finance & Accounting',
        icon: <IconFinance size={18} />,
        color: '#059669',
        gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
        badge: 'GL',
        badgeColor: '#059669',
        children: [
          { id: 'finance', label: 'Financial Control & P&L / BS' },
          { id: 'financial-transactions', label: 'Cash & Bank Vouchers', badge: '5-Types' },
          { id: 'provisional-receipts', label: 'Provisional Receipts (PR)', badge: 'PR' },
        ],
      },
      {
        id: 'credit-control-mgmt',
        label: 'Credit Control & Risk Limits',
        icon: <IconCreditCard size={18} />,
        color: '#DC2626',
        gradient: 'linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)',
        badge: '5-Tier',
        badgeColor: '#DC2626',
        children: [
          { id: 'credit-control', label: 'Credit Dashboard, Limits & Percentage Lock' },
        ],
      },
      {
        id: 'control-audit-mgmt',
        label: 'Control & Audit',
        icon: <IconShield size={18} />,
        color: '#7C3AED',
        gradient: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
        badge: 'Audit',
        badgeColor: '#7C3AED',
        children: [
          { id: 'control-audit', label: 'Order Control & Traceability' },
        ],
      },
      {
        id: 'reporting-mgmt',
        label: 'Consolidated Reporting',
        icon: <IconReports size={18} />,
        color: '#2563EB',
        gradient: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
        badge: '7-Tier',
        badgeColor: '#2563EB',
        children: [
          { id: 'consolidated-reporting', label: 'Group & Regional Drill-Down' },
        ],
      },
      {
        id: 'inventory-mgmt',
        label: 'Warehouse & Stock',
        icon: <IconInventory size={18} />,
        color: '#EA580C',
        gradient: 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)',
        badge: 'Live',
        badgeColor: '#EA580C',
        children: [
          { id: 'warehouses', label: 'Warehouses Master' },
          { id: 'warehouse-stock', label: 'Stock On Hand & Valuation' },
          { id: 'gate-passes', label: 'Gate Passes (In/Out)' },
        ],
      },
      {
        id: 'security-rbac',
        label: 'Administration & Security',
        icon: <IconShield size={18} />,
        color: '#64748B',
        gradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
        children: [
          { id: 'users', label: 'User Accounts' },
          { id: 'roles', label: 'Role & Permissions' },
          { id: 'document-numbering', label: 'Document Numbering' },
          { id: 'audit-logs', label: 'Audit Trail Viewer' },
          { id: 'approvals', label: 'Approval Rules' },
          { id: 'notifications', label: 'Notification Center' },
          { id: 'settings', label: 'System Settings' },
        ],
      },
    ],
    []
  );

  // Filter items based on navigation search
  const filteredNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        if (item.children) {
          const permittedChildren = item.children.filter((c) => isRoutePermitted(c.id, user));
          if (permittedChildren.length === 0) return null;

          if (!navSearch) return { ...item, children: permittedChildren };

          const q = navSearch.toLowerCase();
          const matchesParent = item.label.toLowerCase().includes(q);
          const matchedChildren = permittedChildren.filter((c) => c.label.toLowerCase().includes(q));

          if (matchesParent) return { ...item, children: permittedChildren };
          if (matchedChildren.length > 0) return { ...item, children: matchedChildren };
          return null;
        }

        if (!isRoutePermitted(item.id, user)) return null;
        if (!navSearch) return item;
        return item.label.toLowerCase().includes(navSearch.toLowerCase()) ? item : null;
      })
      .filter(Boolean) as NavItemConfig[];
  }, [navItems, user, navSearch]);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 999,
          }}
        />
      )}

      {/* Main Animated Sidebar */}
      <aside
        style={{
          width: isCollapsed ? '76px' : '272px',
          minWidth: isCollapsed ? '76px' : '272px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          transition: 'width 240ms cubic-bezier(0.4, 0, 0.2, 1), min-width 240ms cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
          overflow: 'hidden',
          userSelect: 'none',
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '68px',
            padding: isCollapsed ? '0 18px' : '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          }}
        >
          {/* Logo Badge with attractive animated emerald glow */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #059669 0%, #0D9488 50%, #06B6D4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#FFFFFF',
              fontSize: '1.3rem',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
              transition: 'transform 200ms ease',
            }}
          >
            S
          </div>

          {!isCollapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>SHEHSWAR</span>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #0D9488 0%, #059669 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 900,
                  }}
                >
                  ONE360
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    letterSpacing: '0.04em',
                  }}
                >
                  PRO
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                Chemical ERP & Formulation
              </div>
            </div>
          )}
        </div>

        {/* Search Navigation Input (Expanded only) */}
        {!isCollapsed && (
          <div style={{ padding: '12px 14px 6px 14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 11px',
                backgroundColor: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                borderRadius: '9px',
                color: '#64748B',
                transition: 'all 180ms ease',
              }}
            >
              <IconSearch size={14} />
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Quick find menu..."
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12.5px',
                  color: '#0F172A',
                  width: '100%',
                }}
              />
              {navSearch && (
                <button
                  type="button"
                  onClick={() => setNavSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* UNIFIED SINGLE-SECTION NAVIGATION (NO SCROLLBAR) */}
        <nav
          className="sidebar-scroll-hide"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {filteredNavItems.map((item) => {
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const isChildActive = hasChildren && item.children!.some((c) => c.id === activeRoute);
            const isDirectActive = activeRoute === item.id;
            const isExpanded = expandedGroups[item.id] || Boolean(navSearch);
            const isActive = isDirectActive || isChildActive;

            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Main Nav Item Capsule */}
                <div
                  onClick={() => {
                    if (hasChildren) {
                      toggleGroup(item.id);
                    } else {
                      onNavigate(item.id);
                      onMobileClose?.();
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '10px 0' : '9px 12px',
                    borderRadius: '10px',
                    backgroundColor: isActive
                      ? `${item.color}14`
                      : 'transparent',
                    border: isActive
                      ? `1px solid ${item.color}35`
                      : '1px solid transparent',
                    color: isActive ? '#0F172A' : '#334155',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.transform = isCollapsed ? 'none' : 'translateX(3px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {/* Left Active Glow Indicator */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '-1px',
                        top: '8px',
                        bottom: '8px',
                        width: '4px',
                        backgroundColor: item.color,
                        borderRadius: '0 4px 4px 0',
                        boxShadow: `0 0 10px ${item.color}90`,
                      }}
                    />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                    {/* Vibrant Jewel-Tone Icon Box */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isActive ? item.gradient : `${item.color}15`,
                        color: isActive ? '#FFFFFF' : item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: isActive ? `0 4px 10px ${item.color}40` : 'none',
                        transition: 'all 200ms ease',
                      }}
                    >
                      {item.icon}
                    </div>

                    {!isCollapsed && (
                      <span style={{ fontSize: '13px', letterSpacing: '-0.01em' }}>
                        {item.label}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: item.badgeColor ? `${item.badgeColor}18` : '#F1F5F9',
                            color: item.badgeColor || '#475569',
                            fontWeight: 700,
                            border: `1px solid ${item.badgeColor || '#CBD5E1'}40`,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      {hasChildren && (
                        <span
                          style={{
                            color: isActive ? item.color : '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'transform 220ms ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          <IconChevronDown size={14} />
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Animated Nested Submenu */}
                {hasChildren && !isCollapsed && isExpanded && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      paddingLeft: '32px',
                      margin: '3px 0 6px 18px',
                      borderLeft: `1.5px solid ${item.color}35`,
                      animation: 'slideDownSubmenu 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    }}
                  >
                    {item.children!.map((child) => {
                      const isCurrentChildActive = activeRoute === child.id;
                      return (
                        <div
                          key={child.id}
                          onClick={() => {
                            onNavigate(child.id);
                            onMobileClose?.();
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '7px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            color: isCurrentChildActive ? item.color : '#475569',
                            fontWeight: isCurrentChildActive ? 700 : 500,
                            backgroundColor: isCurrentChildActive ? `${item.color}12` : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 150ms ease',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrentChildActive) {
                              e.currentTarget.style.backgroundColor = '#F8FAFC';
                              e.currentTarget.style.color = '#0F172A';
                              e.currentTarget.style.paddingLeft = '15px';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrentChildActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#475569';
                              e.currentTarget.style.paddingLeft = '12px';
                            }
                          }}
                        >
                          {/* Active Dot */}
                          {isCurrentChildActive && (
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor: item.color,
                                marginRight: '8px',
                                display: 'inline-block',
                                flexShrink: 0,
                                boxShadow: `0 0 6px ${item.color}`,
                              }}
                            />
                          )}
                          <span style={{ flex: 1 }}>{child.label}</span>
                          {child.badge && (
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '1px 6px',
                                borderRadius: '999px',
                                backgroundColor: '#F1F5F9',
                                color: '#64748B',
                                fontWeight: 700,
                              }}
                            >
                              {child.badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile Card & Collapse Toggle Footer */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '10px',
          }}
        >
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(13, 148, 136, 0.3)',
                }}
              >
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                  {user?.firstName ? `${user.firstName} ${user?.lastName || ''}` : 'Administrator'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10B981',
                      boxShadow: '0 0 6px #10B981',
                    }}
                  />
                  Active Workspace
                </div>
              </div>
            </div>
          ) : null}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
                fontSize: '13px',
                fontWeight: 700,
                transition: 'all 150ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {isCollapsed ? '→' : '←'}
            </button>
          )}
        </div>
      </aside>

      {/* Global CSS for zero-scrollbar and smooth transitions */}
      <style jsx global>{`
        .sidebar-scroll-hide::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
        .sidebar-scroll-hide {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        @keyframes slideDownSubmenu {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};
