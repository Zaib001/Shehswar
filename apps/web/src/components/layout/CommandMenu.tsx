'use client';

import React, { useState, useEffect } from 'react';
import {
  IconSearch,
  IconDashboard,
  IconBuilding,
  IconUser,
  IconShield,
  IconFileText,
  IconSettings,
  IconClock,
  IconCheck,
  IconAlertTriangle,
  IconProcurement,
  IconInventory,
  IconProduction,
  IconQC,
  IconPlus,
  IconDownload,
} from '../icons';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Master Data' | 'Operations' | 'Actions' | 'Enterprise Structure' | 'Security & Access' | 'Administration';
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const items: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Executive Dashboard',
      category: 'Navigation',
      icon: <IconDashboard size={16} />,
      shortcut: 'G D',
      onSelect: () => {
        onNavigate?.('dashboard');
        onClose();
      },
    },
    // Enterprise Master Data & Platform Foundation
    {
      id: 'nav-organizations',
      title: 'Go to Organizations (Holdings)',
      category: 'Enterprise Structure',
      icon: <IconBuilding size={16} />,
      shortcut: 'G O',
      onSelect: () => {
        onNavigate?.('organizations');
        onClose();
      },
    },
    {
      id: 'nav-companies',
      title: 'Go to Companies (Parent & Subsidiaries)',
      category: 'Enterprise Structure',
      icon: <IconBuilding size={16} />,
      shortcut: 'G C',
      onSelect: () => {
        onNavigate?.('companies');
        onClose();
      },
    },
    {
      id: 'nav-plants',
      title: 'Go to Manufacturing Plants',
      category: 'Enterprise Structure',
      icon: <IconProduction size={16} />,
      onSelect: () => {
        onNavigate?.('plants');
        onClose();
      },
    },
    {
      id: 'nav-branches',
      title: 'Go to Regional Branches',
      category: 'Enterprise Structure',
      icon: <IconBuilding size={16} />,
      onSelect: () => {
        onNavigate?.('branches');
        onClose();
      },
    },
    {
      id: 'nav-departments',
      title: 'Go to Departments',
      category: 'Enterprise Structure',
      icon: <IconBuilding size={16} />,
      onSelect: () => {
        onNavigate?.('departments');
        onClose();
      },
    },
    {
      id: 'nav-warehouses',
      title: 'Go to Warehouse Masters',
      category: 'Enterprise Structure',
      icon: <IconBuilding size={16} />,
      shortcut: 'G W',
      onSelect: () => {
        onNavigate?.('warehouses');
        onClose();
      },
    },
    {
      id: 'nav-employees',
      title: 'Go to Employee Master Registry',
      category: 'Enterprise Structure',
      icon: <IconUser size={16} />,
      shortcut: 'G E',
      onSelect: () => {
        onNavigate?.('employees');
        onClose();
      },
    },
    {
      id: 'nav-users',
      title: 'Go to User Administration',
      category: 'Security & Access',
      icon: <IconUser size={16} />,
      shortcut: 'G U',
      onSelect: () => {
        onNavigate?.('users');
        onClose();
      },
    },
    {
      id: 'nav-roles',
      title: 'Go to Role Management (RBAC)',
      category: 'Security & Access',
      icon: <IconShield size={16} />,
      shortcut: 'G R',
      onSelect: () => {
        onNavigate?.('roles');
        onClose();
      },
    },
    {
      id: 'nav-permissions',
      title: 'Go to Permission Matrix',
      category: 'Security & Access',
      icon: <IconShield size={16} />,
      onSelect: () => {
        onNavigate?.('permissions');
        onClose();
      },
    },
    {
      id: 'nav-doc-numbering',
      title: 'Go to Document Numbering Engine',
      category: 'Administration',
      icon: <IconFileText size={16} />,
      onSelect: () => {
        onNavigate?.('document-numbering');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Hierarchical System Settings',
      category: 'Administration',
      icon: <IconSettings size={16} />,
      shortcut: 'G S',
      onSelect: () => {
        onNavigate?.('settings');
        onClose();
      },
    },
    {
      id: 'nav-audit-logs',
      title: 'Go to Audit Trail Viewer',
      category: 'Administration',
      icon: <IconClock size={16} />,
      shortcut: 'G A',
      onSelect: () => {
        onNavigate?.('audit-logs');
        onClose();
      },
    },
    {
      id: 'nav-approvals',
      title: 'Go to Approval Foundation Rules',
      category: 'Administration',
      icon: <IconCheck size={16} />,
      onSelect: () => {
        onNavigate?.('approvals');
        onClose();
      },
    },
    {
      id: 'nav-notifications',
      title: 'Go to Notification Center',
      category: 'Administration',
      icon: <IconAlertTriangle size={16} />,
      shortcut: 'G N',
      onSelect: () => {
        onNavigate?.('notifications');
        onClose();
      },
    },
    {
      id: 'nav-procurement-vendors',
      title: 'Go to Vendor Master Management',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      shortcut: 'G V',
      onSelect: () => {
        onNavigate?.('procurement-vendors');
        onClose();
      },
    },
    {
      id: 'nav-procurement-pr',
      title: 'Go to Purchase Requisitions (PR)',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      shortcut: 'G P',
      onSelect: () => {
        onNavigate?.('procurement-pr');
        onClose();
      },
    },
    {
      id: 'nav-procurement-rfq',
      title: 'Go to Request For Quotation (RFQ)',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-rfq');
        onClose();
      },
    },
    {
      id: 'nav-procurement-quotations',
      title: 'Go to Vendor Quotations',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-quotations');
        onClose();
      },
    },
    {
      id: 'nav-procurement-comparison',
      title: 'Go to Quotation Comparison Matrix',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-comparison');
        onClose();
      },
    },
    {
      id: 'nav-procurement-po',
      title: 'Go to Purchase Orders (PO)',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-po');
        onClose();
      },
    },
    {
      id: 'nav-procurement-grn',
      title: 'Go to Goods Receipt Notes (GRN)',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-grn');
        onClose();
      },
    },
    {
      id: 'nav-procurement-performance',
      title: 'Go to Vendor Performance Scorecards',
      category: 'Operations',
      icon: <IconProcurement size={16} />,
      onSelect: () => {
        onNavigate?.('procurement-performance');
        onClose();
      },
    },
    {
      id: 'nav-inventory',
      title: 'Go to Inventory & Warehouses',
      category: 'Operations',
      icon: <IconInventory size={16} />,
      onSelect: () => {
        onNavigate?.('inventory');
        onClose();
      },
    },
    {
      id: 'nav-production',
      title: 'Go to Chemical Production & Batch Formulas',
      category: 'Operations',
      icon: <IconProduction size={16} />,
      onSelect: () => {
        onNavigate?.('production');
        onClose();
      },
    },
    {
      id: 'nav-qc',
      title: 'Go to Quality Control (QC) Lab Testing',
      category: 'Operations',
      icon: <IconQC size={16} />,
      onSelect: () => {
        onNavigate?.('qc');
        onClose();
      },
    },
    // Quick Actions
    {
      id: 'act-new-po',
      title: 'Create New Purchase Requisition',
      category: 'Actions',
      icon: <IconPlus size={16} />,
      shortcut: 'N P',
      onSelect: () => {
        alert('Action: Create New Purchase Requisition');
        onClose();
      },
    },
    {
      id: 'act-new-batch',
      title: 'Issue Chemical Batch Work Order',
      category: 'Actions',
      icon: <IconPlus size={16} />,
      shortcut: 'N B',
      onSelect: () => {
        alert('Action: Issue Chemical Batch Work Order');
        onClose();
      },
    },
    {
      id: 'act-export-inventory',
      title: 'Export Stock Valuation Report (Excel)',
      category: 'Actions',
      icon: <IconDownload size={16} />,
      onSelect: () => {
        alert('Action: Export Stock Valuation Report');
        onClose();
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()),
  );

  // Keyboard navigation up / down / enter
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        paddingLeft: 'var(--space-md)',
        paddingRight: 'var(--space-md)',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Palette Card */}
      <div
        className="animate-scale-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '620px',
          backgroundColor: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10001,
          overflow: 'hidden',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '12px',
          }}
        >
          <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}>
            <IconSearch size={20} />
          </span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page name, or batch number..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-2xs)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px' }}>
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              No commands or pages matching "{query}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: isSelected ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                          color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {item.title}
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--font-size-2xs)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {item.shortcut && (
                    <kbd
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: 'var(--font-size-2xs)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-canvas)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)' }}>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)' }}>↵</kbd> Select
            </span>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)' }}>esc</kbd> Close
            </span>
          </div>
          <span>SHEHSWAR Spotlight</span>
        </div>
      </div>
    </div>
  );
};
