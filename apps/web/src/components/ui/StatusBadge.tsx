'use client';

import React from 'react';
import { Badge, BadgeProps, BadgeVariant } from './Badge';

export type WorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'quarantine'
  | 'in_production'
  | 'released'
  | 'completed'
  | 'cancelled';

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: WorkflowStatus | string;
  variant?: BadgeVariant | string;
}

const statusConfig: Record<string, { label: string; variant: BadgeVariant; pulse?: boolean }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  submitted: { label: 'Submitted', variant: 'info', pulse: true },
  pending_approval: { label: 'Pending Approval', variant: 'warning', pulse: true },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  quarantine: { label: 'Quarantine (QC)', variant: 'danger', pulse: true },
  in_production: { label: 'In Production', variant: 'primary', pulse: true },
  released: { label: 'Released to Stock', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, dot = true, children, ...props }) => {
  const normalizedKey = status.toLowerCase().replace(/[-\s]/g, '_');
  const config = statusConfig[normalizedKey] || {
    label: status.replace(/_/g, ' '),
    variant: 'neutral',
  };

  const resolvedVariant = (variant === 'default' ? 'neutral' : variant) as BadgeVariant | undefined;

  return (
    <Badge
      variant={resolvedVariant || config.variant}
      dot={dot}
      pulse={config.pulse}
      {...props}
    >
      {children || config.label}
    </Badge>
  );
};
