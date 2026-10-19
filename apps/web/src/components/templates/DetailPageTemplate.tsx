'use client';

import React, { useState } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { Tabs, TabItem } from '../ui/Tabs';
import { KpiCard, KpiCardProps } from '../ui/KpiCard';
import { WorkflowTracker, WorkflowStep } from '../ui/WorkflowTracker';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

export interface DetailPageTemplateProps {
  title: string;
  subtitle?: string;
  recordCode?: string;
  statusBadge?: React.ReactNode;
  status?: string;
  breadcrumbs: { label: string; href?: string; onClick?: () => void }[];
  actions?: React.ReactNode;
  workflowSteps?: WorkflowStep[];
  summaryKpis?: KpiCardProps[];
  tabs?: (TabItem & { content: React.ReactNode })[];
  defaultTabId?: string;
  children?: React.ReactNode;
}

export const DetailPageTemplate: React.FC<DetailPageTemplateProps> = ({
  title,
  subtitle,
  recordCode,
  statusBadge,
  status,
  breadcrumbs,
  actions,
  workflowSteps,
  summaryKpis,
  tabs,
  defaultTabId,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    defaultTabId || (tabs && tabs[0]?.id ? tabs[0].id : ''),
  );

  const currentTabContent = tabs?.find((t) => t.id === activeTab)?.content;
  const resolvedBadge =
    statusBadge || (status ? <StatusBadge status={status as any} /> : undefined);
  const resolvedTitle = recordCode ? `${title} (${recordCode})` : title;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
      {/* Page Header */}
      <PageHeader
        title={resolvedTitle}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        badge={resolvedBadge}
        actions={actions}
      />

      {/* Workflow Tracker Stepper (if applicable) */}
      {workflowSteps && workflowSteps.length > 0 && (
        <Card variant="default" padding="md">
          <CardHeader style={{ marginBottom: '8px' }}>
            <CardTitle style={{ fontSize: 'var(--font-size-sm)' }}>
              Operational Lifecycle & Approval Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowTracker steps={workflowSteps} />
          </CardContent>
        </Card>
      )}

      {/* Summary KPI metrics row */}
      {summaryKpis && summaryKpis.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {summaryKpis.map((kpi, idx) => (
            <KpiCard key={idx} {...kpi} />
          ))}
        </div>
      )}

      {/* Children or Tabs */}
      {children}

      {/* Tabs and Tab Content */}
      {tabs && tabs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Tabs
            items={tabs.map(({ id, label, icon, count, disabled }) => ({
              id,
              label,
              icon,
              count,
              disabled,
            }))}
            activeId={activeTab}
            onChange={setActiveTab}
          />

          <div className="animate-fade-in" style={{ width: '100%' }}>
            {currentTabContent}
          </div>
        </div>
      )}
    </div>
  );
};
