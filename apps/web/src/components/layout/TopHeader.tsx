'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/theme-context';
import { useAuth } from '../../context/auth-context';
import {
  IconSearch,
  IconBell,
  IconSun,
  IconMoon,
  IconBuilding,
  IconChevronDown,
  IconMenu,
  IconCheck,
} from '../icons';
import { ApiClient } from '../../lib/api-client';

export interface TopHeaderProps {
  onToggleSidebar?: () => void;
  onOpenCommandMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleSidebar, onOpenCommandMenu }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('ALL');
  const [activeCompanyName, setActiveCompanyName] = useState<string>('Consolidated Enterprise (All Entities)');
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const companyRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotificationMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch real company hierarchy for TopHeader
  useEffect(() => {
    const fetchHeaderCompanies = async () => {
      try {
        const res = await ApiClient.get<any[]>('/api/v1/master-data/companies?all=true');
        if (res.success && res.data) {
          setCompanies(res.data);
          const savedId = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;

          if (user?.isSuperAdmin) {
            if (savedId && savedId !== 'ALL') {
              const match = res.data.find((c: any) => c.id === savedId);
              if (match) {
                setActiveCompanyId(match.id);
                setActiveCompanyName(match.name);
                return;
              }
            }
            setActiveCompanyId('ALL');
            setActiveCompanyName('Consolidated Enterprise (All Entities)');
          } else {
            // Child company directors or unit employees are strictly scoped
            const targetId = user?.companyId;
            const match = res.data.find((c: any) => c.id === targetId);
            const resolvedName = match ? match.name : (user?.company?.name || 'Assigned Company');
            setActiveCompanyId(targetId || '');
            setActiveCompanyName(resolvedName);
            if (targetId && typeof window !== 'undefined') {
              localStorage.setItem('shehswar_active_company', targetId);
              localStorage.setItem('shehswar_active_company_name', resolvedName);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load header companies', err);
      }
    };

    if (user) {
      fetchHeaderCompanies();
    }
  }, [user]);

  const handleSelectCompany = (comp: any | null) => {
    if (!user?.isSuperAdmin) return;
    if (!comp || comp.id === 'ALL') {
      localStorage.setItem('shehswar_active_company', 'ALL');
      localStorage.setItem('shehswar_active_company_name', 'Consolidated Enterprise (All Entities)');
      setActiveCompanyId('ALL');
      setActiveCompanyName('Consolidated Enterprise (All Entities)');
    } else {
      localStorage.setItem('shehswar_active_company', comp.id);
      localStorage.setItem('shehswar_active_company_name', comp.name);
      setActiveCompanyId(comp.id);
      setActiveCompanyName(comp.name);
    }
    setShowCompanyMenu(false);
    window.dispatchEvent(new CustomEvent('shehswar-company-context-changed', { detail: comp }));
    window.location.reload();
  };

  const notifications = [
    {
      id: 'n1',
      title: 'QC Lab Batch Released',
      message: 'Batch #CH-2026-09 passed purity assay (99.4%) and is cleared for dispatch.',
      time: '12m ago',
      unread: true,
      category: 'QC',
    },
    {
      id: 'n2',
      title: 'Purchase Requisition Pending',
      message: 'PR-8902 for 500 Tons Sulfuric Acid requires Executive approval.',
      time: '1h ago',
      unread: true,
      category: 'Procurement',
    },
    {
      id: 'n3',
      title: 'Credit Limit Alert',
      message: 'Dealer AgroCorp Faisalabad reached 88% credit utilization.',
      time: '3h ago',
      unread: false,
      category: 'Sales',
    },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header
      style={{
        height: '60px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-md)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Mobile Toggle & Company Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Sidebar"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <IconMenu size={20} />
        </button>

        {/* Company Context Dropdown / Scoped Unit Indicator */}
        {user?.isSuperAdmin ? (
          <div ref={companyRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowCompanyMenu(!showCompanyMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <IconBuilding size={16} style={{ color: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <span
                  style={{
                    maxWidth: '190px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
                  {activeCompanyName}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontWeight: 700,
                  background:
                    activeCompanyId === 'ALL'
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(13, 148, 136, 0.12)',
                  color: activeCompanyId === 'ALL' ? '#2563eb' : 'var(--color-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {activeCompanyId === 'ALL' ? 'ENTERPRISE' : 'SCOPED'}
              </span>
              <IconChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </button>

            {showCompanyMenu && (
              <div
                className="animate-scale-in"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '320px',
                  backgroundColor: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xl)',
                  padding: '6px',
                  zIndex: 100,
                  maxHeight: '420px',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>SUPERADMIN CONTEXT</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)' }}>REAL-TIME SCOPE</span>
                </div>

                {/* Option 1: Consolidated Enterprise */}
                <div
                  onClick={() => handleSelectCompany(null)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor:
                      activeCompanyId === 'ALL' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    color: activeCompanyId === 'ALL' ? '#2563eb' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--font-size-xs)',
                    marginBottom: '4px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🌐</span> Consolidated Enterprise
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                      View all Parent and Child Distributors
                    </div>
                  </div>
                  {activeCompanyId === 'ALL' && <IconCheck size={14} style={{ color: '#2563eb' }} />}
                </div>

                {/* Parent Manufacturing Companies */}
                {companies.filter((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING').length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '6px 8px 2px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      PARENT MANUFACTURING
                    </div>
                    {companies
                      .filter((c) => c.isParent || c.companyType === 'PARENT_MANUFACTURING')
                      .map((c) => {
                        const isSelected = c.id === activeCompanyId;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCompany(c)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                              color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {c.name} ({c.code})
                              </div>
                              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                                Primary Manufacturing & Costing Entity
                              </div>
                            </div>
                            {isSelected && <IconCheck size={14} />}
                          </div>
                        );
                      })}
                  </>
                )}

                {/* Child Companies / Distributors */}
                {companies.filter((c) => !c.isParent && c.companyType !== 'PARENT_MANUFACTURING').length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 8px 2px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      CHILD DISTRIBUTORS & SUBSIDIARIES
                    </div>
                    {companies
                      .filter((c) => !c.isParent && c.companyType !== 'PARENT_MANUFACTURING')
                      .map((c) => {
                        const isSelected = c.id === activeCompanyId;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCompany(c)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                              color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {c.name} ({c.code})
                              </div>
                              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                                Child Distributor {c.managerName ? `• Lead: ${c.managerName}` : ''}
                              </div>
                            </div>
                            {isSelected && <IconCheck size={14} />}
                          </div>
                        );
                      })}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Scoped Unit Indicator for Non-Superadmin (Director / Employee) */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
            }}
            title="Your access is strictly scoped to this company entity only."
          >
            <IconBuilding size={16} style={{ color: 'var(--color-primary)' }} />
            <span
              style={{
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              {activeCompanyName}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                padding: '1px 6px',
                borderRadius: '3px',
                fontWeight: 700,
                background: 'rgba(13, 148, 136, 0.12)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              ASSIGNED UNIT
            </span>
          </div>
        )}
      </div>

      {/* Center: Command Palette Trigger (Linear/Spotlight Search) */}
      <div style={{ flex: 1, maxWidth: '420px', margin: '0 var(--space-md)' }}>
        <button
          type="button"
          onClick={onOpenCommandMenu}
          style={{
            width: '100%',
            height: '36px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSearch size={16} />
            <span>Search anything across Shehswar ONE360...</span>
          </div>
          <kbd
            style={{
              padding: '2px 6px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-2xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Actions: Notifications, Theme Switcher, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            aria-label="View notifications"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <IconBell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--danger-500)',
                  boxShadow: '0 0 0 2px var(--bg-surface)',
                }}
              />
            )}
          </button>

          {showNotificationMenu && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '340px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                  Notifications
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(13, 148, 136, 0.15)',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} Unread
                </span>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: n.unread ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: n.unread ? 600 : 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {n.title}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                        {n.time}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 'var(--font-size-2xs)',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle (Dark / Light) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color var(--transition-fast)',
          }}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        {/* User Profile Menu */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="user-details-desktop">
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user ? `${user.firstName} ${user.lastName}`.trim() : 'Administrator'}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                {user?.email || 'admin@shehswar.com'}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '220px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: '6px',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                  {user ? `${user.firstName} ${user.lastName}`.trim() : 'Enterprise Admin'}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {user?.roles?.[0] ? user.roles[0].replace('ROLE_', '').replace(/_/g, ' ') : (user?.isSuperAdmin ? 'Super Administrator' : 'Enterprise User')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {user?.company?.name || 'Shehswar Industries'}
                </div>
              </div>
              <div
                onClick={() => {
                  logout().then(() => {
                    window.location.href = '/login';
                  });
                  setShowUserMenu(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--danger-500)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
