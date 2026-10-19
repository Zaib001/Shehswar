'use client';

import React from 'react';

export interface TimelineEvent {
  id: string;
  actor: {
    name: string;
    role?: string;
    avatarInitials?: string;
  };
  action: string;
  target?: string;
  timestamp: string;
  category?: 'audit' | 'status' | 'approval' | 'system';
  diff?: {
    field: string;
    oldValue: string;
    newValue: string;
  };
  note?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TimelineItem {
  id?: string;
  title?: string;
  timestamp?: string;
  description?: React.ReactNode;
  status?: string;
  actor?: {
    name: string;
    role?: string;
    avatarInitials?: string;
  };
  action?: string;
  target?: string;
  category?: 'audit' | 'status' | 'approval' | 'system';
  diff?: {
    field: string;
    oldValue: string;
    newValue: string;
  };
  note?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  events?: TimelineEvent[];
  items?: TimelineItem[];
}

export const Timeline: React.FC<TimelineProps> = ({ events, items }) => {
  const resolvedEvents: TimelineEvent[] =
    events ||
    (items || []).map((it, idx) => ({
      id: it.id || `evt-${idx}`,
      actor: it.actor || { name: 'System Admin' },
      action: it.action || it.title || 'Status Updated',
      timestamp: it.timestamp || new Date().toISOString(),
      category: it.category || 'status',
      note: it.note || it.description,
      diff: it.diff,
      target: it.target,
      icon: it.icon,
    }));
  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
      }}
    >
      {/* Continuous vertical line */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          bottom: '8px',
          left: '27px',
          width: '2px',
          backgroundColor: 'var(--border-subtle)',
        }}
      />

      {resolvedEvents.map((evt) => {
        const initials =
          evt.actor.avatarInitials ||
          evt.actor.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

        return (
          <div
            key={evt.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-md)',
            }}
          >
            {/* Avatar Node */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '2px solid var(--border-default)',
                color: 'var(--color-primary)',
                fontWeight: 'bold',
                fontSize: 'var(--font-size-2xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                flexShrink: 0,
              }}
            >
              {evt.icon ? evt.icon : initials}
            </div>

            {/* Event Body */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm) var(--space-md)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {evt.actor.name}
                  </span>
                  {evt.actor.role && (
                    <span
                      style={{
                        fontSize: 'var(--font-size-2xs)',
                        color: 'var(--text-muted)',
                        marginLeft: '6px',
                      }}
                    >
                      ({evt.actor.role})
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {evt.timestamp}
                </span>
              </div>

              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                }}
              >
                <span>{evt.action}</span>
                {evt.target && (
                  <strong style={{ color: 'var(--text-primary)', marginLeft: '4px' }}>
                    {evt.target}
                  </strong>
                )}
              </div>

              {evt.diff && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--font-size-2xs)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{evt.diff.field}:</span>
                  <span style={{ color: 'var(--danger-500)', textDecoration: 'line-through' }}>
                    {evt.diff.oldValue}
                  </span>
                  <span>→</span>
                  <span style={{ color: 'var(--success-500)', fontWeight: 600 }}>
                    {evt.diff.newValue}
                  </span>
                </div>
              )}

              {evt.note && (
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    marginTop: '6px',
                    marginBottom: 0,
                  }}
                >
                  "{evt.note}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
