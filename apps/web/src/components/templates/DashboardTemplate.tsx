'use client';

import React from 'react';
import { PageHeader } from '../layout/PageHeader';
import { KpiCard, KpiCardProps } from '../ui/KpiCard';
import { Card } from '../ui/Card';

export interface DashboardTemplateProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  kpis: KpiCardProps[];
  mainChart: React.ReactNode;
  secondaryChart: React.ReactNode;
  tertiaryWidget?: React.ReactNode;
  alertsWidget?: React.ReactNode;
  activityWidget?: React.ReactNode;
}

export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({
  title,
  subtitle,
  badge,
  actions,
  kpis,
  mainChart,
  secondaryChart,
  tertiaryWidget,
  alertsWidget,
  activityWidget,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
      {/* Dashboard Page Header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={badge}
        actions={actions}
      />

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {kpis.map((kpi, idx) => (
          <KpiCard key={idx} {...kpi} />
        ))}
      </div>

      {/* Primary Analytics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        <Card variant="default" padding="md">
          {mainChart}
        </Card>

        <Card variant="default" padding="md">
          {secondaryChart}
        </Card>
      </div>

      {/* Secondary Row: Widgets, Alerts & Activities */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        {tertiaryWidget && (
          <Card variant="default" padding="md">
            {tertiaryWidget}
          </Card>
        )}

        {alertsWidget && (
          <Card variant="default" padding="md">
            {alertsWidget}
          </Card>
        )}

        {activityWidget && (
          <Card variant="default" padding="md">
            {activityWidget}
          </Card>
        )}
      </div>
    </div>
  );
};
