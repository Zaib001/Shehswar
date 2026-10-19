'use client';

import React from 'react';

export interface QuantityInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  label,
  value,
  onChange,
  unit = 'Units',
  min = 0,
  max,
  step = 1,
  disabled = false,
  error,
  helperText,
  required,
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, (value || 0) - step);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = max !== undefined ? Math.min(max, (value || 0) + step) : (value || 0) + step;
    onChange(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (isNaN(parsed)) {
      onChange(min);
    } else {
      if (max !== undefined && parsed > max) {
        onChange(max);
      } else if (parsed < min) {
        onChange(min);
      } else {
        onChange(parsed);
      }
    }
  };

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
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? 'var(--bg-canvas)' : 'var(--bg-surface-raised)',
          border: `1px solid ${error ? 'var(--danger-500)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          height: '40px',
        }}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label="Decrease quantity"
          style={{
            width: '38px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'var(--bg-surface)',
            color: disabled || value <= min ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: disabled || value <= min ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem',
            borderRight: '1px solid var(--border-subtle)',
            transition: 'background var(--transition-fast)',
          }}
        >
          −
        </button>

        <input
          type="number"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          style={{
            flex: 1,
            height: '100%',
            textAlign: 'center',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            outline: 'none',
            MozAppearance: 'textfield',
          }}
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || (max !== undefined && value >= max)}
          aria-label="Increase quantity"
          style={{
            width: '38px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'var(--bg-surface)',
            color:
              disabled || (max !== undefined && value >= max)
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
            cursor:
              disabled || (max !== undefined && value >= max) ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem',
            borderLeft: '1px solid var(--border-subtle)',
            transition: 'background var(--transition-fast)',
          }}
        >
          +
        </button>

        {unit && (
          <span
            style={{
              padding: '0 var(--space-sm)',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-canvas)',
              borderLeft: '1px solid var(--border-default)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {(error || helperText) && (
        <span
          style={{
            fontSize: 'var(--font-size-2xs)',
            color: error ? 'var(--danger-500)' : 'var(--text-muted)',
            lineHeight: 1.3,
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
};
