'use client';

import React, { useState } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'flat' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  children,
  style,
  className = '',
  onMouseEnter,
  onMouseLeave,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const paddingMap = {
    none: '0',
    sm: '12px',
    md: '18px',
    lg: '24px',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--bg-surface, #FFFFFF)',
      border: '1px solid var(--border-default, #E2E8F0)',
      boxShadow: isHovered && interactive
        ? '0 12px 28px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)'
        : '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
      transform: isHovered && interactive ? 'translateY(-2px)' : 'none',
    },
    raised: {
      backgroundColor: 'var(--bg-surface-raised, #F8FAFC)',
      border: '1px solid var(--border-subtle, #E2E8F0)',
      boxShadow: isHovered && interactive
        ? '0 16px 32px -4px rgba(0, 0, 0, 0.1)'
        : '0 4px 12px -2px rgba(0, 0, 0, 0.05)',
      transform: isHovered && interactive ? 'translateY(-2px)' : 'none',
    },
    flat: {
      backgroundColor: 'var(--bg-canvas, #F8FAFC)',
      border: '1px solid var(--border-subtle, #E2E8F0)',
      boxShadow: 'none',
    },
    glass: {
      backgroundColor: 'var(--glass-bg, rgba(255, 255, 255, 0.85))',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--glass-border, rgba(226, 232, 240, 0.8))',
      boxShadow: isHovered && interactive
        ? '0 20px 40px -8px rgba(0, 0, 0, 0.12)'
        : '0 8px 24px -4px rgba(0, 0, 0, 0.06)',
      transform: isHovered && interactive ? 'translateY(-2px)' : 'none',
    },
  };

  return (
    <div
      className={`${interactive ? 'modern-hover-card' : ''} ${className}`}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        onMouseLeave?.(e);
      }}
      style={{
        borderRadius: '14px',
        padding: paddingMap[padding],
        transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...props
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  style,
  ...props
}) => (
  <h3
    style={{
      fontSize: '15px',
      fontWeight: 700,
      color: 'var(--text-primary, #0F172A)',
      letterSpacing: '-0.015em',
      margin: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  style,
  ...props
}) => (
  <p
    style={{
      fontSize: '12.5px',
      color: 'var(--text-muted, #64748B)',
      margin: '3px 0 0 0',
      lineHeight: 1.4,
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...props
}) => (
  <div style={{ ...style }} {...props}>
    {children}
  </div>
);
