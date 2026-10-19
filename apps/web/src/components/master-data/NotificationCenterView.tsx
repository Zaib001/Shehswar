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
  Badge,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '../ui';
import {
  IconCheck,
  IconShield,
  IconAlertTriangle,
  IconClock,
  IconRefresh,
} from '../icons';
import { useToast } from '../../context/toast-context';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'APPROVAL' | 'SYSTEM' | 'SECURITY' | 'WARNING' | string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | string;
  isRead: boolean;
  timestamp: string;
  createdAt?: string;
  linkUrl?: string;
}

export const NotificationCenterView: React.FC = () => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'APPROVAL' | 'SECURITY' | 'WARNING' | 'SYSTEM'>('ALL');

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await ApiClient.get<any>('/api/v1/notifications');
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data?.items || (res as any)?.data || [];
      setNotifications(items);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err?.message || 'Failed to fetch notifications from backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filtered = notifications.filter((n) => {
    if (activeTab === 'UNREAD') return !n.isRead;
    if (activeTab === 'ALL') return true;
    return n.category === activeTab;
  });

  const markAsRead = async (id: string) => {
    try {
      await ApiClient.patch(`/api/v1/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      showToast({ title: 'Marked as Read', message: 'Notification state updated', type: 'info' });
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to update notification', type: 'error' });
    }
  };

  const markAllRead = async () => {
    try {
      await ApiClient.post('/api/v1/notifications/mark-all-read', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast({ title: 'All Read', message: 'All active notifications cleared', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to mark all notifications as read', type: 'error' });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge variant="danger">URGENT</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'NORMAL':
        return <Badge variant="info">NORMAL</Badge>;
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'SECURITY':
        return <IconShield size={18} style={{ color: 'var(--color-danger)' }} />;
      case 'APPROVAL':
        return <IconCheck size={18} style={{ color: 'var(--color-primary)' }} />;
      case 'WARNING':
        return <IconAlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />;
      default:
        return <IconClock size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Enterprise Notification Center
                {unreadCount > 0 && <Badge variant="primary">{unreadCount} Unread</Badge>}
              </CardTitle>
              <CardDescription>
                Decoupled multi-channel notification dispatcher routing approvals, security events, system alerts, and operational warnings.
              </CardDescription>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="outline" icon={<IconRefresh size={16} />} onClick={fetchNotifications}>
                Refresh
              </Button>
              <Button variant="outline" icon={<IconCheck size={16} />} onClick={markAllRead} disabled={unreadCount === 0}>
                Mark All as Read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {[
              { id: 'ALL', label: `All (${notifications.length})` },
              { id: 'UNREAD', label: `Unread (${unreadCount})` },
              { id: 'APPROVAL', label: 'Approvals' },
              { id: 'SECURITY', label: 'Security' },
              { id: 'WARNING', label: 'Warnings' },
              { id: 'SYSTEM', label: 'System' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  background: activeTab === tab.id ? 'var(--color-primary)' : 'var(--bg-card-subtle)',
                  color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {isLoading ? (
              <TableSkeleton rows={4} columns={3} />
            ) : error ? (
              <ErrorState
                title="Failed to Load Notifications"
                message={error}
                onRetry={fetchNotifications}
              />
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: item.isRead ? 'var(--bg-card)' : 'var(--bg-card-subtle)',
                    border: item.isRead ? '1px solid var(--border-subtle)' : '1px solid var(--color-primary)',
                    boxShadow: item.isRead ? 'none' : '0 2px 8px rgba(0, 168, 143, 0.1)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ marginTop: '0.2rem' }}>{getCategoryIcon(item.category)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: item.isRead ? 500 : 700, color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : item.timestamp}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                      {item.body}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Category: {item.category}
                      </span>
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 0.5rem',
                            fontWeight: 600,
                          }}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No Notifications"
                description={activeTab !== 'ALL' ? `No ${activeTab.toLowerCase()} notifications found.` : 'You have no system notifications.'}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
