'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-md)',
  circle = false,
  style,
  className,
  ...props
}) => {
  return (
    <div
      className={className}
      style={{
        width: circle ? height : width,
        height: height,
        borderRadius: circle ? '50%' : borderRadius,
        backgroundColor: 'var(--bg-canvas)',
        animation: 'skeleton-pulse 1.6s ease-in-out infinite',
        ...style,
      }}
      {...props}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', padding: '12px 16px' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`th-${i}`} height="16px" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`tr-${r}`}
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            padding: '16px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`td-${r}-${c}`} height="20px" width={`${100 / columns}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};
