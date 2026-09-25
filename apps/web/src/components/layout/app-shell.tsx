'use client';

/**
 * SHEHSWAR ONE360 - Enterprise App Shell
 */
import React from 'react';
import { useAuth } from '../../context/auth-context';

interface NavItem {
  label: string;
  icon: string;
  active: boolean;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  const navSections: NavSection[] = [
    {
      title: 'FOUNDATION (PHASE 1)',
      items: [
        { label: 'Platform Architecture', icon: '🏛️', active: true },
        { label: 'Identity & Access', icon: '🛡️', active: false },
        { label: 'Multi-Company Scope', icon: '🏢', active: false },
        { label: 'Security & Audit Logs', icon: '📜', active: false },
        { label: 'API & Health Probes', icon: '⚡', active: false },
      ],
    },
    {
      title: 'OPERATIONS (PLANNED)',
      items: [
        { label: 'Procurement (Parent)', icon: '📦', active: false, badge: 'Phase 3' },
        { label: 'Inventory & Warehouses', icon: '🏭', active: false, badge: 'Phase 4' },
        { label: 'Production & Formulas', icon: '⚙️', active: false, badge: 'Phase 5' },
        { label: 'Quality Control (QC)', icon: '🧪', active: false, badge: 'Phase 5' },
        { label: 'Intercompany Orders', icon: '🔄', active: false, badge: 'Phase 6' },
        { label: 'Sales & Dealer Network', icon: '🤝', active: false, badge: 'Phase 7' },
        { label: 'Finance & Costing', icon: '💰', active: false, badge: 'Phase 8' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '280px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: '1.2rem',
              }}
            >
              S
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                SHEHSWAR <span style={{ color: 'var(--color-primary)' }}>ONE360</span>
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enterprise ERP & CRM
              </p>
            </div>
          </div>
        </div>

        {/* Company Context Badge */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Active Entity
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Shehswar Group
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Parent Manufacturing Co
          </div>
        </div>

        {/* Navigation Sections */}
        <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
          {navSections.map((sec, idx) => (
            <div key={idx} style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  padding: '0 12px 8px 12px',
                }}
              >
                {sec.title}
              </div>
              {sec.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: item.active ? 'var(--bg-surface)' : 'transparent',
                    color: item.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: item.active ? 600 : 500,
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && <span className="badge badge-info">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer User Info */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {user?.firstName ?? 'Enterprise User'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {user?.email ?? 'admin@shehswar.com'}
            </div>
          </div>
          <button
            onClick={() => logout()}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            Exit
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header */}
        <header
          style={{
            height: '64px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="badge badge-success">Phase 1 Complete</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Architecture & Technical Foundation
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                API: Port 4000 (Live)
              </span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
};
