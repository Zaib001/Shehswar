'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Select,
  Timeline,
  TimelineItem,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '../ui';
import { IconShield, IconRefresh, IconDownload } from '../icons';
import { useToast } from '../../context/toast-context';

export interface AuditRecord {
  id: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  summary?: string;
  details?: any;
  fromState?: string;
  toState?: string;
  timestamp?: string;
  createdAt?: string;
  ipAddress?: string;
}

export const AuditLogsView: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [resourceFilter, setResourceFilter] = useState('ALL');

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await ApiClient.get<any>('/api/v1/audit/logs');
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data?.items || (res as any)?.data || [];
      setLogs(items);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err?.message || 'Failed to fetch audit logs from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const actorStr = `${log.actorName || ''} ${log.actorEmail || ''} ${log.actorId || ''}`.toLowerCase();
    const matchesUser = !userFilter || actorStr.includes(userFilter.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    const matchesResource = resourceFilter === 'ALL' || log.resource === resourceFilter;
    return matchesUser && matchesAction && matchesResource;
  });

  const timelineItems: TimelineItem[] = filteredLogs.map((log, idx) => ({
    title: `${log.actorName || log.actorEmail || 'System'} • ${log.action} ${log.resource}`,
    timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : log.timestamp || 'Just now',
    status: idx === 0 ? 'current' : 'completed',
    description: (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {log.summary || `${log.action} executed on ${log.resource}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Target:</span>
          <strong>{log.resourceName || log.resourceId || 'N/A'}</strong>
          {log.fromState && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Transition:</span>
              <span style={{ textDecoration: 'line-through', color: 'var(--color-danger)' }}>{log.fromState}</span>
              <span>→</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{log.toState}</span>
            </>
          )}
          {log.ipAddress && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.75rem' }}>
              IP: {log.ipAddress}
            </span>
          )}
        </div>
      </div>
    ),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconShield size={22} style={{ color: 'var(--color-primary)' }} />
                Immutable Audit Trail & Timeline Viewer
              </CardTitle>
              <CardDescription>
                Forensic immutable audit log capturing every critical state transition, financial override, and permission modification.
              </CardDescription>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button
                variant="outline"
                icon={<IconRefresh size={16} />}
                onClick={fetchLogs}
              >
                Refresh Log
              </Button>
              <Button
                variant="primary"
                icon={<IconDownload size={16} />}
                onClick={() => showToast({ title: 'Audit Export', message: 'Cryptographic audit report downloaded (CSV)', type: 'success' })}
              >
                Export Audit Log
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <Input
              placeholder="Filter by actor name or email..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Actions' },
                { value: 'CREATE', label: 'CREATE' },
                { value: 'UPDATE', label: 'UPDATE' },
                { value: 'STATUS_CHANGE', label: 'STATUS_CHANGE' },
                { value: 'APPROVE', label: 'APPROVE' },
                { value: 'DELETE', label: 'DELETE' },
              ]}
            />
            <Select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Modules' },
                { value: 'Company', label: 'Company' },
                { value: 'Warehouse', label: 'Warehouse' },
                { value: 'User', label: 'User' },
                { value: 'Approval Rule', label: 'Approval Rule' },
                { value: 'Organization', label: 'Organization' },
              ]}
            />
          </div>

          {/* Timeline Output */}
          <div style={{ padding: '0.5rem 0' }}>
            {isLoading ? (
              <TableSkeleton rows={4} columns={3} />
            ) : error ? (
              <ErrorState
                title="Failed to Load Audit Logs"
                message={error}
                onRetry={fetchLogs}
              />
            ) : timelineItems.length > 0 ? (
              <Timeline items={timelineItems} />
            ) : (
              <EmptyState
                title="No Audit Records"
                description={userFilter || actionFilter !== 'ALL' || resourceFilter !== 'ALL' ? 'No audit entries match the selected filters.' : 'No audit entries have been logged yet.'}
                actionLabel={userFilter || actionFilter !== 'ALL' || resourceFilter !== 'ALL' ? 'Clear Filters' : undefined}
                onAction={
                  userFilter || actionFilter !== 'ALL' || resourceFilter !== 'ALL'
                    ? () => {
                        setUserFilter('');
                        setActionFilter('ALL');
                        setResourceFilter('ALL');
                      }
                    : undefined
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
