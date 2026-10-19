'use client';

import React, { useState } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  startIcon?: React.ReactNode;
  icon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      type = 'button',
      isLoading = false,
      startIcon,
      icon,
      endIcon,
      fullWidth = false,
      disabled,
      children,
      style,
      className = '',
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const effectiveStartIcon = startIcon || icon;
    const isDisabled = disabled || isLoading;
    const [isHovered, setIsHovered] = useState(false);

    // Modern SaaS Size Tokens
    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        height: '34px',
        padding: '0 12px',
        fontSize: '12px',
        fontWeight: 600,
        gap: '6px',
        borderRadius: '7px',
      },
      md: {
        height: '40px',
        padding: '0 16px',
        fontSize: '13.5px',
        fontWeight: 600,
        gap: '8px',
        borderRadius: '9px',
      },
      lg: {
        height: '46px',
        padding: '0 20px',
        fontSize: '15px',
        fontWeight: 600,
        gap: '10px',
        borderRadius: '11px',
      },
    };

    // Modern SaaS Variant Tokens with Luminous Gradients & Micro-interactions
    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        background: isHovered && !isDisabled
          ? 'linear-gradient(135deg, #1D4ED8 0%, #0F766E 100%)'
          : 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isHovered && !isDisabled
          ? '0 6px 18px rgba(37, 99, 235, 0.35), 0 2px 4px rgba(0, 0, 0, 0.05)'
          : '0 2px 8px rgba(37, 99, 235, 0.25), 0 1px 2px rgba(0, 0, 0, 0.05)',
        transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
      },
      secondary: {
        backgroundColor: isHovered && !isDisabled ? 'var(--bg-surface-raised, #F1F5F9)' : 'var(--bg-surface, #FFFFFF)',
        color: 'var(--text-primary, #0F172A)',
        border: '1px solid var(--border-default, #E2E8F0)',
        boxShadow: isHovered && !isDisabled ? '0 4px 12px rgba(0, 0, 0, 0.06)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
        transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
      },
      ghost: {
        backgroundColor: isHovered && !isDisabled ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
        color: 'var(--text-secondary, #475569)',
        border: '1px solid transparent',
      },
      outline: {
        backgroundColor: isHovered && !isDisabled ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
        color: 'var(--color-primary, #2563EB)',
        border: '1.5px solid var(--color-primary, #2563EB)',
        transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
      },
      danger: {
        background: isHovered && !isDisabled
          ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
          : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isHovered && !isDisabled
          ? '0 6px 18px rgba(239, 68, 68, 0.35)'
          : '0 2px 8px rgba(239, 68, 68, 0.25)',
        transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
      },
      success: {
        background: isHovered && !isDisabled
          ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
          : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isHovered && !isDisabled
          ? '0 6px 18px rgba(16, 185, 129, 0.35)'
          : '0 2px 8px rgba(16, 185, 129, 0.25)',
        transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
      },
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`modern-btn-interactive ${className}`}
        onMouseEnter={(e) => {
          setIsHovered(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          onMouseLeave?.(e);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sans)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          transition: 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)',
          width: fullWidth ? '100%' : 'auto',
          userSelect: 'none',
          outline: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
          ...sizeStyles[size],
          ...variantStyles[variant],
          ...style,
        }}
        type={type}
        {...props}
      >
        {isLoading && (
          <span
            style={{
              display: 'inline-block',
              width: size === 'sm' ? 12 : 16,
              height: size === 'sm' ? 12 : 16,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.75s linear infinite',
            }}
            aria-hidden="true"
          />
        )}
        {!isLoading && effectiveStartIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>{effectiveStartIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && endIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>{endIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
