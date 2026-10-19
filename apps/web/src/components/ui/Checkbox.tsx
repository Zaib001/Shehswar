'use client';

import React from 'react';
import { IconCheck } from '../icons';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, checked, disabled, onChange, id, className, style, ...props }, ref) => {
    const inputId = id || (typeof label === 'string' ? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', ...style }}>
        <label
          htmlFor={inputId}
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            userSelect: 'none',
          }}
        >
          <div style={{ position: 'relative', width: '18px', height: '18px', marginTop: '2px' }}>
            <input
              ref={ref}
              type="checkbox"
              id={inputId}
              checked={checked}
              disabled={disabled}
              onChange={onChange}
              className={className}
              style={{
                position: 'absolute',
                opacity: 0,
                width: 0,
                height: 0,
              }}
              {...props}
            />
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: 'var(--radius-xs)',
                border: `1.5px solid ${
                  error
                    ? 'var(--danger-500)'
                    : checked
                      ? 'var(--color-primary)'
                      : 'var(--border-default)'
                }`,
                backgroundColor: checked ? 'var(--color-primary)' : 'var(--bg-surface-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
                color: '#ffffff',
              }}
            >
              {checked && <IconCheck size={14} />}
            </div>
          </div>

          {(label || description) && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {label && (
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {label}
                </span>
              )}
              {description && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {description}
                </span>
              )}
            </div>
          )}
        </label>
        {error && (
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--danger-500)', paddingLeft: '26px' }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
