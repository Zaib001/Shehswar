'use client';

import React from 'react';
import { PageHeader, PageHeaderProps } from '../layout/PageHeader';
import { DataTable, DataTableProps } from '../ui/DataTable';
import { KpiCard, KpiCardProps } from '../ui/KpiCard';
import { Button } from '../ui/Button';

export interface ListPageFilter {
  id: string;
  label?: string;
  component: React.ReactNode;
}

export interface ListPageTemplateProps<T extends Record<string, any> = Record<string, any>> {
  header?: PageHeaderProps;
  title?: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string; onClick?: () => void }[];
  primaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
  secondaryActions?: { label: string; icon?: React.ReactNode; onClick: () => void }[];
  actions?: React.ReactNode;
  kpis?: KpiCardProps[];
  kpiMetrics?: { title: string; value: string | number; subtitle?: string; icon?: React.ReactNode }[];
  filters?: ListPageFilter[];
  tableProps?: DataTableProps<T>;
  children?: React.ReactNode;
}

export function ListPageTemplate<T extends Record<string, any> = Record<string, any>>({
  header,
  title,
  subtitle,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  actions,
  kpis,
  kpiMetrics,
  filters,
  tableProps,
  children,
}: ListPageTemplateProps<T>) {
  const resolvedHeader: PageHeaderProps = header || {
    title: title || '',
    subtitle,
    breadcrumbs,
    actions: actions ? (
      actions
    ) : primaryAction || (secondaryActions && secondaryActions.length > 0) ? (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {secondaryActions?.map((act, idx) => (
          <Button key={idx} variant="outline" size="sm" startIcon={act.icon} onClick={act.onClick}>
            {act.label}
          </Button>
        ))}
        {primaryAction && (
          <Button variant="primary" size="sm" startIcon={primaryAction.icon} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        )}
      </div>
    ) : undefined,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
      {/* Page Header */}
      <PageHeader {...resolvedHeader} />

      {/* KPI Summary Cards */}
      {((kpis && kpis.length > 0) || (kpiMetrics && kpiMetrics.length > 0)) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {kpis?.map((kpi, idx) => (
            <KpiCard key={idx} {...kpi} />
          ))}
          {kpiMetrics?.map((m, idx) => (
            <KpiCard key={idx} title={m.title} value={m.value.toString()} subtitle={m.subtitle} icon={m.icon} />
          ))}
        </div>
      )}

      {/* Declarative Filters Bar */}
      {filters && filters.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
          {filters.map((f) => (
            <div key={f.id} style={{ minWidth: '220px', flex: '1 1 220px' }}>
              {f.component}
            </div>
          ))}
        </div>
      )}

      {/* Flexible children content (filters, cards, custom table) */}
      {children}

      {/* Enterprise Data Table (if declarative tableProps provided) */}
      {tableProps && <DataTable {...tableProps} />}
    </div>
  );
}
