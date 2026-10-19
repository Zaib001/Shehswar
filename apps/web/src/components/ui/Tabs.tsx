'use client';

import React, { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
  disabled?: boolean;
  content?: React.ReactNode;
}

export interface TabsProps {
  items?: TabItem[];
  tabs?: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  variant?: 'line' | 'pills';
  size?: 'sm' | 'md';
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  tabs,
  activeId: controlledActiveId,
  onChange,
  variant = 'line',
  size = 'md',
}) => {
  const tabList = tabs || items || [];
  const [internalActiveId, setInternalActiveId] = useState<string>(tabList[0]?.id || '');
  const activeId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId;

  const handleTabClick = (id: string) => {
    setInternalActiveId(id);
    onChange?.(id);
  };

  const isPills = variant === 'pills';
  const activeTabItem = tabList.find((t) => t.id === activeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 'var(--space-md)' }}>
      <div
        role="tablist"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isPills ? 'var(--space-xs)' : 'var(--space-md)',
          borderBottom: isPills ? 'none' : '1px solid var(--border-subtle)',
          padding: isPills ? '4px' : '0',
          backgroundColor: isPills ? 'var(--bg-canvas)' : 'transparent',
          borderRadius: isPills ? 'var(--radius-md)' : '0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {tabList.map((tab) => {
          const isActive = tab.id === activeId;

          const buttonStyle: React.CSSProperties = isPills
            ? {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: size === 'sm' ? '4px 10px' : '6px 14px',
                fontSize: size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-surface-raised)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                opacity: tab.disabled ? 0.4 : 1,
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }
            : {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: size === 'sm' ? '8px 4px' : '12px 6px',
                fontSize: size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-1px',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                opacity: tab.disabled ? 0.4 : 1,
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              };

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              style={buttonStyle}
            >
              {tab.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 'var(--font-weight-bold)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'rgba(13, 148, 136, 0.15)' : 'var(--bg-hover)',
                    color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTabItem?.content && (
        <div className="animate-fade-in" style={{ width: '100%' }}>
          {activeTabItem.content}
        </div>
      )}
    </div>
  );
};
