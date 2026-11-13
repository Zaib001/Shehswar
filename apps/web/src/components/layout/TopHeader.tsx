'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/theme-context';
import { useAuth } from '../../context/auth-context';
import { useCompany } from '../../context/company-context';
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

export interface TopHeaderProps {
  onToggleSidebar?: () => void;
  onOpenCommandMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleSidebar, onOpenCommandMenu }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const {
    activeCompany,
    activeCompanyId,
    activeCompanyName,
    authorizedCompanies,
    switchCompany,
  } = useCompany();

  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Keyboard navigation for Company Switcher
  const [companySearch, setCompanySearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const companyRef = useRef<HTMLDivElement>(null);
  const companySearchInputRef = useRef<HTMLInputElement>(null);
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

  // Filtered companies based on search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return authorizedCompanies;
    const q = companySearch.toLowerCase();
    return authorizedCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.companyType && c.companyType.toLowerCase().includes(q)),
    );
  }, [authorizedCompanies, companySearch]);

  // Focus search input when company menu opens
  useEffect(() => {
    if (showCompanyMenu) {
      setCompanySearch('');
      setHighlightedIndex(0);
      setTimeout(() => {
        companySearchInputRef.current?.focus();
      }, 50);
    }
  }, [showCompanyMenu]);

  // Keyboard handler for company menu
  const handleCompanyKeyDown = (e: React.KeyboardEvent) => {
    if (!showCompanyMenu) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCompanies.length > 0 ? (prev + 1) % filteredCompanies.length : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCompanies.length > 0
          ? (prev - 1 + filteredCompanies.length) % filteredCompanies.length
          : 0,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCompanies[highlightedIndex]) {
        switchCompany(filteredCompanies[highlightedIndex]);
        setShowCompanyMenu(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowCompanyMenu(false);
    }
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
  const canSwitchCompanies = authorizedCompanies.length > 1 || user?.isSuperAdmin;

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
      {/* Left: Mobile Toggle & Active Company Switcher */}
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

        {/* ACTIVE COMPANY CONTEXT INDICATOR & SWITCHER */}
        <div ref={companyRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              if (canSwitchCompanies) {
                setShowCompanyMenu(!showCompanyMenu);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 14px',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: canSwitchCompanies ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
            title={canSwitchCompanies ? 'Click or press Enter to switch active company context' : 'Active Company Context'}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: activeCompany?.isParent ? 'rgba(13, 148, 136, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeCompany?.isParent ? 'var(--color-primary, #0d9488)' : '#2563eb',
              }}
            >
              <IconBuilding size={17} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  lineHeight: 1,
                }}
              >
                ACTIVE COMPANY
              </span>
              <span
                style={{
                  maxWidth: '210px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {activeCompanyName || 'Shehswar'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  background: activeCompany?.isParent
                    ? 'rgba(13, 148, 136, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                  color: activeCompany?.isParent ? '#0d9488' : '#2563eb',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {activeCompany?.isParent ? 'PARENT' : 'CHILD'}
              </span>
              {canSwitchCompanies && (
                <IconChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
              )}
            </div>
          </button>

          {/* Searchable Keyboard-First Company Menu */}
          {showCompanyMenu && canSwitchCompanies && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '350px',
                backgroundColor: 'var(--bg-surface-raised, #ffffff)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: 'var(--radius-lg, 10px)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                padding: '8px',
                zIndex: 9999,
                maxHeight: '460px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header Label */}
              <div
                style={{
                  padding: '6px 8px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  SWITCH COMPANY CONTEXT
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-primary, #0d9488)', fontWeight: 600 }}>
                  ↑↓ Navigate • ↵ Select
                </span>
              </div>

              {/* Instant Search Field */}
              <div style={{ padding: '8px 4px 6px', position: 'relative' }}>
                <input
                  ref={companySearchInputRef}
                  type="text"
                  value={companySearch}
                  onChange={(e) => {
                    setCompanySearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleCompanyKeyDown}
                  placeholder="Type company name or code..."
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default, #cbd5e1)',
                    background: 'var(--bg-canvas, #f8fafc)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '16px',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <IconSearch size={14} />
                </div>
              </div>

              {/* List of Authorized Companies */}
              <div style={{ overflowY: 'auto', maxHeight: '320px', marginTop: '4px' }}>
                {filteredCompanies.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No matching company found.
                  </div>
                ) : (
                  filteredCompanies.map((c, idx) => {
                    const isSelected = c.id === activeCompanyId;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          switchCompany(c);
                          setShowCompanyMenu(false);
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isHighlighted
                            ? 'var(--surface-subtle, #f1f5f9)'
                            : isSelected
                            ? 'rgba(13, 148, 136, 0.08)'
                            : 'transparent',
                          color: isSelected ? 'var(--color-primary, #0d9488)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          marginBottom: '2px',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IconBuilding
                            size={16}
                            style={{
                              color: c.isParent ? 'var(--color-primary, #0d9488)' : '#2563eb',
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{c.name}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({c.code})</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {c.isParent
                                ? 'Parent Manufacturing & Actual Costing Entity'
                                : 'Child Distribution Subsidiary'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontWeight: 700,
                              background: c.isParent ? 'rgba(13, 148, 136, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                              color: c.isParent ? '#0d9488' : '#2563eb',
                            }}
                          >
                            {c.isParent ? 'PARENT' : 'CHILD'}
                          </span>
                          {isSelected && <IconCheck size={15} style={{ color: 'var(--color-primary, #0d9488)' }} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        type="button"
        onClick={onOpenCommandMenu}
        aria-label="Open Command Menu (Ctrl+K)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: '6px 14px',
          backgroundColor: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs)',
          cursor: 'pointer',
          width: '280px',
          justifyContent: 'space-between',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <IconSearch size={15} />
          <span>Quick search or jump to...</span>
        </span>
        <kbd
          style={{
            padding: '1px 5px',
            fontSize: 'var(--font-size-2xs)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right Actions: Notifications, Theme, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            aria-label={`Notifications (${unreadCount} unread)`}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconBell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--color-danger)',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-surface)',
                }}
              />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationMenu && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '320px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: 'var(--space-sm)',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-xs)',
                  paddingBottom: 'var(--space-xs)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                  }}
                >
                  System Notifications
                </span>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                  {unreadCount} unread
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: 'var(--space-xs)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: n.unread ? 'var(--bg-canvas)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {n.title}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                      {n.message}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--font-size-2xs)',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                      }}
                    >
                      {n.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        {/* User Profile */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User account menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {user ? `${user.firstName?.[0] || 'A'}${user.lastName?.[0] || 'D'}` : 'AD'}
            </div>
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '220px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: 'var(--space-xs)',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: 'var(--space-xs)',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: 'var(--space-2xs)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {user ? `${user.firstName} ${user.lastName}` : 'Administrator'}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                  {user?.email || 'admin@shehswar.com'}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    color: 'var(--color-primary)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginTop: '2px',
                  }}
                >
                  {user?.isSuperAdmin ? 'Super Administrator' : 'Assigned User'}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-xs)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-danger)',
                  background: 'none',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
