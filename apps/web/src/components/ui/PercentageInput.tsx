'use client';

import React from 'react';
import { Input, InputProps } from './Input';

export interface PercentageInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value?: number | string;
  onChange?: (val: number | string) => void;
  max?: number;
}

export const PercentageInput: React.FC<PercentageInputProps> = ({
  value,
  onChange,
  max = 100,
  placeholder = '0.0',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      const num = parseFloat(val);
      if (isNaN(num) || num <= max) {
        onChange?.(val);
      }
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      endIcon={
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-muted)',
            padding: '2px 4px',
          }}
        >
          %
        </span>
      }
      {...props}
    />
  );
};
