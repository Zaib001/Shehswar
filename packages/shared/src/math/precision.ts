/**
 * SHEHSWAR ONE360 - Enterprise Numeric Precision Standards
 *
 * Defines explicit database precision/scale and application arithmetic rules
 * to eliminate binary floating-point drift and overflow.
 */
import { Decimal } from 'decimal.js';

export interface PrecisionSpec {
  name: string;
  totalDigits: number; // Precision
  decimalPlaces: number; // Scale
  sqlType: string;
  description: string;
  example: string;
}

export type NumericStandardKey =
  | 'MONEY'
  | 'QUANTITY'
  | 'UNIT_COST_RATE'
  | 'PERCENTAGE'
  | 'CONVERSION_FACTOR'
  | 'COMPOSITION_PERCENT'
  | 'ALLOCATION_FACTOR';

export const NUMERIC_STANDARDS: Record<NumericStandardKey, PrecisionSpec> = {
  MONEY: {
    name: 'Money',
    totalDigits: 18,
    decimalPlaces: 2,
    sqlType: 'DECIMAL(18, 2)',
    description: 'Financial transactions, invoice totals, receivables, ledger entries',
    example: '1,500,000.50 PKR',
  },
  QUANTITY: {
    name: 'Quantity',
    totalDigits: 18,
    decimalPlaces: 4,
    sqlType: 'DECIMAL(18, 4)',
    description: 'Physical inventory weights, silo stock, dispatch quantities (KG, Bags, Tons)',
    example: '24,500.2500 KG',
  },
  UNIT_COST_RATE: {
    name: 'Unit Cost / Rate',
    totalDigits: 18,
    decimalPlaces: 6,
    sqlType: 'DECIMAL(18, 6)',
    description: 'Exact unit costs, purchase rates, chemical ingredient costs per gram/KG',
    example: '142.345678 PKR/KG',
  },
  PERCENTAGE: {
    name: 'Percentage',
    totalDigits: 8,
    decimalPlaces: 4,
    sqlType: 'DECIMAL(8, 4)',
    description: 'Markup %, sales tax %, yield %, wastage %',
    example: '17.5000% (or 0.1750 rate)',
  },
  CONVERSION_FACTOR: {
    name: 'Conversion Factor',
    totalDigits: 14,
    decimalPlaces: 6,
    sqlType: 'DECIMAL(14, 6)',
    description: 'UOM conversion multiplier (e.g. 1 Bag = 50.000000 KG)',
    example: '50.000000',
  },
  COMPOSITION_PERCENT: {
    name: 'Composition %',
    totalDigits: 8,
    decimalPlaces: 4,
    sqlType: 'DECIMAL(8, 4)',
    description: 'BOM recipe ingredient percentage (micro-ingredients require 4 decimals)',
    example: '0.0250% (Vitamins/Premix)',
  },
  ALLOCATION_FACTOR: {
    name: 'Allocation Factor',
    totalDigits: 10,
    decimalPlaces: 6,
    sqlType: 'DECIMAL(10, 6)',
    description: 'Factory overhead and energy cost allocation ratios',
    example: '0.004128',
  },
};

/**
 * Validates and serializes a high-precision decimal value to a string.
 * Prevents IEEE-754 precision loss that occurs when converting to JavaScript `number`.
 */
export function serializeDecimal(
  value: Decimal | string | number,
  decimalPlaces: number,
  roundingMode: Decimal.Rounding = Decimal.ROUND_HALF_UP,
): string {
  if (value === null || value === undefined) {
    throw new Error('Cannot serialize null or undefined decimal value.');
  }

  // If a JavaScript number is passed, ensure it is safely converted
  const dec = value instanceof Decimal ? value : new Decimal(value.toString());

  if (dec.isNaN() || !dec.isFinite()) {
    throw new Error(`Invalid decimal value for serialization: ${value}`);
  }

  return dec.toFixed(decimalPlaces, roundingMode);
}

/**
 * Safely parses a string into a Decimal object without floating-point conversion.
 */
export function parseDecimal(value: string | number | Decimal): Decimal {
  if (typeof value === 'number') {
    // Flag warning/caution if number exceeds safe integer range or has precision tail
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

/**
 * Safe rounding utility conforming to enterprise standard ROUND_HALF_UP (commercial rounding)
 */
export function roundToPrecision(
  value: Decimal | string | number,
  precisionType: keyof typeof NUMERIC_STANDARDS,
): string {
  const spec = NUMERIC_STANDARDS[precisionType];
  if (!spec) {
    throw new Error(`Unknown precision type: ${String(precisionType)}`);
  }
  return serializeDecimal(value, spec.decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a decimal with standard thousands separator for UI presentation
 */
export function formatDecimal(value: Decimal | string | number, decimalPlaces: number): string {
  const dec = value instanceof Decimal ? value : new Decimal(value.toString());
  const fixed = dec.toFixed(decimalPlaces, Decimal.ROUND_HALF_UP);
  const parts = fixed.split('.');
  const intPart = parts[0]?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '0';
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}
