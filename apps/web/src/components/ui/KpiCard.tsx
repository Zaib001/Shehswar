'use client';

import React from 'react';
import { Card } from './Card';
import { IconTrendingUp, IconTrendingDown } from '../icons';

export interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  change?: {
    value: string | number;
    trend?: string;
    isPositive?: boolean;
  };
  status?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  accentColor?: string;
  progressPercent?: number;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  delta,
  trend,
  change,
  status,
  icon,
  subtitle,
  badge,
  accentColor = '#2563EB',
  progressPercent,
  onClick,
}) => {
  const effectiveDelta = delta || trend || (change ? { value: change.value, isPositive: change.trend === 'up' || change.isPositive } : undefined);
  const effectiveBadge = badge || (status ? String(status).toUpperCase() : undefined);

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      padding="none"
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: '14px',
        border: '1px solid var(--border-default, #E2E8F0)',
        backgroundColor: 'var(--bg-surface, #FFFFFF)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        height: '100%',
        minHeight: '158px',
        maxHeight: '168px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top subtle decorative accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${accentColor} 0%, rgba(37, 99, 235, 0.3) 100%)`,
        }}
      />

      <div
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Header: Title, Badge, and Icon Avatar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary, #64748B)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={title}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
              {effectiveBadge && (
                <span
                  style={{
                    fontSize: '9.5px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563EB',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {effectiveBadge}
                </span>
              )}
            </div>
          </div>

          {icon && (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid rgba(37, 99, 235, 0.12)',
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Big Tabular Numeric Value (Guaranteed not to wrap or push card height) */}
        <div style={{ minWidth: 0, margin: '4px 0 2px 0' }}>
          <div
            title={String(value)}
            style={{
              fontFamily: 'var(--font-display, inherit)',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-primary, #0F172A)',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </div>
        </div>

        {/* Uniform Progress Bar Slot (Preserves identical vertical rhythm across all cards) */}
        <div style={{ height: '5px', width: '100%', margin: '2px 0' }}>
          {progressPercent !== undefined ? (
            <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                  height: '100%',
                  background: accentColor,
                  borderRadius: '3px',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          ) : (
            <div style={{ height: '5px' }} />
          )}
        </div>

        {/* Footer: Trend Pill / Subtitle with strict line-clamp and ellipsis */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            minHeight: '22px',
          }}
        >
          {effectiveDelta ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: effectiveDelta.isPositive ? '#ECFDF5' : '#FEF2F2',
                color: effectiveDelta.isPositive ? '#047857' : '#DC2626',
                border: effectiveDelta.isPositive ? '1px solid #A7F3D0' : '1px solid #FECACA',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {effectiveDelta.isPositive ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
              <span>{effectiveDelta.value}</span>
              {effectiveDelta.label && (
                <span style={{ color: '#64748B', fontWeight: 500, marginLeft: '2px' }}>
                  {effectiveDelta.label}
                </span>
              )}
            </div>
          ) : (
            <div style={{ flexShrink: 0 }} />
          )}

          {subtitle && (
            <span
              title={subtitle}
              style={{
                fontSize: '11.5px',
                color: 'var(--text-muted, #64748B)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'right',
                flex: 1,
                minWidth: 0,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
