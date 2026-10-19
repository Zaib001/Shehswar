'use client';

import React, { useState } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  maxLength?: number;
  showCount?: boolean;
  required?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      maxLength,
      showCount = false,
      required,
      id,
      disabled,
      value,
      onChange,
      rows = 3,
      style,
      className,
      ...props
    },
    ref,
  ) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const [isFocused, setIsFocused] = useState(false);

    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2xs)',
          width: '100%',
        }}
      >
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: error ? 'var(--danger-500)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {label}
            {required && <span style={{ color: 'var(--danger-500)' }}>*</span>}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            backgroundColor: disabled ? 'var(--bg-canvas)' : 'var(--bg-surface-raised)',
            border: `1px solid ${
              error
                ? 'var(--danger-500)'
                : isFocused
                  ? 'var(--color-primary)'
                  : 'var(--border-default)'
            }`,
            borderRadius: 'var(--radius-md)',
            boxShadow: isFocused ? '0 0 0 2px var(--color-primary-glow)' : 'none',
            transition: 'all var(--transition-fast)',
            opacity: disabled ? 0.6 : 1,
            overflow: 'hidden',
          }}
        >
          <textarea
            ref={ref}
            id={textareaId}
            disabled={disabled}
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            rows={rows}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            style={{
              width: '100%',
              padding: 'var(--space-sm)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              ...style,
            }}
            className={className}
            {...props}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-2xs)',
          }}
        >
          <span style={{ color: error ? 'var(--danger-500)' : 'var(--text-muted)' }}>
            {error || helperText}
          </span>
          {showCount && maxLength && (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
