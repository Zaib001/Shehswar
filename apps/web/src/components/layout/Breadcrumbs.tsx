'use client';

import React from 'react';
import { IconChevronRight } from '../icons';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 'var(--font-size-xs)',
        }}
      >
        <li>
          <span style={{ color: 'var(--text-muted)' }}>Shehswar ONE360</span>
        </li>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              aria-current={isLast ? 'page' : undefined}
            >
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <IconChevronRight size={12} />
              </span>
              {isLast || (!item.href && !item.onClick) ? (
                <span
                  style={{
                    color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isLast ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
                  }}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
