'use client';

import React from 'react';

export interface SwitchProps {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  size = 'md',
}) => {
  const isSmall = size === 'sm';
  const width = isSmall ? 36 : 44;
  const height = isSmall ? 20 : 24;
  const knobSize = isSmall ? 16 : 20;
  const knobTravel = width - knobSize - 4;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        width: '100%',
      }}
    >
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <span
              style={{
                fontSize: isSmall ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-primary)',
              }}
            >
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              {description}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: 'var(--radius-full)',
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--bg-canvas)',
          border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--border-default)'}`,
          position: 'relative',
          padding: '2px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
          flexShrink: 0,
          outline: 'none',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: 'var(--shadow-sm)',
            transform: checked ? `translateX(${knobTravel}px)` : 'translateX(0)',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>
    </label>
  );
};
