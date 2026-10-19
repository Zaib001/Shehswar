'use client';

import React from 'react';

export interface ProgressMetricProps {
  label: string;
  value: number; // e.g. 75
  max?: number;  // default 100
  unit?: string;
  targetLabel?: string;
  color?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressMetric: React.FC<ProgressMetricProps> = ({
  label,
  value,
  max = 100,
  unit,
  targetLabel,
  color = 'var(--color-primary)',
  subtext,
  size = 'md',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const heightMap = {
    sm: '6px',
    md: '10px',
    lg: '14px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
        <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {value.toLocaleString()} / {max.toLocaleString()}{unit ? ` ${unit}` : ''}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>({percentage.toFixed(0)}%)</span>
        </div>
      </div>

      {/* Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{
          width: '100%',
          height: heightMap[size],
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            borderRadius: 'var(--radius-full)',
            backgroundColor: color,
            transition: 'width var(--transition-slow)',
          }}
        />
      </div>

      {(subtext || targetLabel) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--text-muted)',
          }}
        >
          {subtext && <span>{subtext}</span>}
          {targetLabel && <span style={{ marginLeft: 'auto' }}>{targetLabel}</span>}
        </div>
      )}
    </div>
  );
};
