'use client';

import React from 'react';
import { Input, InputProps } from './Input';

export interface CurrencyInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value?: number | string;
  onChange?: (val: number | string) => void;
  currencyCode?: string;
  precision?: number;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  currencyCode = 'PKR',
  placeholder = '0.00',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow digits and single decimal point
    if (/^\d*\.?\d*$/.test(val)) {
      onChange?.(val);
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      startIcon={
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-primary)',
            padding: '2px 6px',
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {currencyCode}
        </span>
      }
      {...props}
    />
  );
};
