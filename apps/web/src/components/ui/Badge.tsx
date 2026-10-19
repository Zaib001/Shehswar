'use client';

import React from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  children,
  style,
  className,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    primary: {
      bg: 'rgba(13, 148, 136, 0.12)',
      text: 'var(--color-primary)',
      border: 'rgba(13, 148, 136, 0.25)',
      dotColor: 'var(--color-primary)',
    },
    secondary: {
      bg: 'rgba(2, 132, 199, 0.12)',
      text: 'var(--accent-500)',
      border: 'rgba(2, 132, 199, 0.25)',
      dotColor: 'var(--accent-500)',
    },
    success: {
      bg: 'rgba(16, 185, 129, 0.12)',
      text: 'var(--success-500)',
      border: 'rgba(16, 185, 129, 0.25)',
      dotColor: 'var(--success-500)',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      text: 'var(--warning-500)',
      border: 'rgba(245, 158, 11, 0.25)',
      dotColor: 'var(--warning-500)',
    },
    danger: {
      bg: 'rgba(239, 68, 68, 0.12)',
      text: 'var(--danger-500)',
      border: 'rgba(239, 68, 68, 0.25)',
      dotColor: 'var(--danger-500)',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.12)',
      text: 'var(--info-500)',
      border: 'rgba(59, 130, 246, 0.25)',
      dotColor: 'var(--info-500)',
    },
    neutral: {
      bg: 'var(--bg-canvas)',
      text: 'var(--text-secondary)',
      border: 'var(--border-default)',
      dotColor: 'var(--text-muted)',
    },
    default: {
      bg: 'var(--bg-canvas)',
      text: 'var(--text-secondary)',
      border: 'var(--border-default)',
      dotColor: 'var(--text-muted)',
    },
    outline: {
      bg: 'transparent',
      text: 'var(--text-secondary)',
      border: 'var(--border-default)',
      dotColor: 'var(--text-muted)',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: size === 'sm' ? '1px 6px' : size === 'lg' ? '4px 12px' : '3px 9px',
        fontSize: size === 'sm' ? 'var(--font-size-2xs)' : size === 'lg' ? 'var(--font-size-sm)' : 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        borderRadius: 'var(--radius-full)',
        backgroundColor: currentVariant.bg,
        color: currentVariant.text,
        border: `1px solid ${currentVariant.border}`,
        lineHeight: 1.2,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: size === 'sm' ? '5px' : size === 'lg' ? '7px' : '6px',
            height: size === 'sm' ? '5px' : size === 'lg' ? '7px' : '6px',
            borderRadius: '50%',
            backgroundColor: currentVariant.dotColor,
            display: 'inline-block',
            animation: pulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
          }}
        />
      )}
      {children}
    </span>
  );
};
