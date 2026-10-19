'use client';

import React, { useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  isClearable?: boolean;
  onClear?: () => void;
  fullWidth?: boolean;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      isClearable = false,
      onClear,
      fullWidth = true,
      required,
      id,
      disabled,
      value,
      onChange,
      style,
      className,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const [isFocused, setIsFocused] = useState(false);

    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          width: fullWidth ? '100%' : 'auto',
        }}
      >
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '12.5px',
              fontWeight: 600,
              color: error ? '#EF4444' : '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {label}
            {required && <span style={{ color: '#EF4444', fontWeight: 700 }}>*</span>}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: disabled ? '#F1F5F9' : isFocused ? '#FFFFFF' : '#F8FAFC',
            border: `1.5px solid ${
              error
                ? '#EF4444'
                : isFocused
                  ? '#2563EB'
                  : '#E2E8F0'
            }`,
            borderRadius: '10px',
            boxShadow: isFocused ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
            transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: disabled ? 0.65 : 1,
            overflow: 'hidden',
          }}
        >
          {startIcon && (
            <span
              style={{
                paddingLeft: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                color: '#64748B',
              }}
            >
              {startIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            style={{
              flex: 1,
              height: '40px',
              padding: startIcon ? '0 12px 0 8px' : '0 12px',
              fontSize: '13px',
              fontFamily: 'inherit',
              color: '#0F172A',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              ...style,
            }}
            className={className}
            {...props}
          />

          {isClearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear field"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0 8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
              }}
            >
              ✕
            </button>
          )}

          {endIcon && (
            <span
              style={{
                paddingRight: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                color: '#64748B',
              }}
            >
              {endIcon}
            </span>
          )}
        </div>

        {(error || helperText) && (
          <span
            style={{
              fontSize: '11px',
              color: error ? '#EF4444' : '#64748B',
              lineHeight: 1.3,
            }}
          >
            {error || helperText}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
