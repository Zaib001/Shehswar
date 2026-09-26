/**
 * SHEHSWAR ONE360 - Frontend Decimal Safety & Display Utilities
 *
 * CRITICAL RULE: High-precision money and quantity values must NEVER be parsed
 * as standard JavaScript floating-point numbers for business calculations.
 * UI displays formatted strings; all authoritative business calculations
 * remain strictly on the backend.
 */
import {
  formatDecimal,
  parseDecimal,
  roundToPrecision,
  NUMERIC_STANDARDS,
  NumericStandardKey,
} from '@shehswar/shared';

export function formatMoney(amount: string | number, currencyCode: string = 'PKR'): string {
  const formatted = formatDecimal(amount, NUMERIC_STANDARDS.MONEY.decimalPlaces);
  return `${formatted} ${currencyCode}`;
}

export function formatQuantity(quantity: string | number, uom: string = 'KG'): string {
  const formatted = formatDecimal(quantity, NUMERIC_STANDARDS.QUANTITY.decimalPlaces);
  return `${formatted} ${uom}`;
}

export function formatUnitCost(
  rate: string | number,
  currency: string = 'PKR',
  uom: string = 'KG',
): string {
  const formatted = formatDecimal(rate, NUMERIC_STANDARDS.UNIT_COST_RATE.decimalPlaces);
  return `${formatted} ${currency}/${uom}`;
}

export function formatPercentage(value: string | number): string {
  const formatted = formatDecimal(value, NUMERIC_STANDARDS.PERCENTAGE.decimalPlaces);
  return `${formatted}%`;
}

export function sanitizeDecimalInput(input: string, standard: NumericStandardKey): string {
  const spec = NUMERIC_STANDARDS[standard];
  // Remove non-numeric characters except single decimal point
  const sanitized = input.replace(/[^0-9.]/g, '');
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts.length === 2 && parts[1] && parts[1].length > spec.decimalPlaces) {
    return parts[0] + '.' + parts[1].substring(0, spec.decimalPlaces);
  }
  return sanitized;
}

export { parseDecimal, roundToPrecision, NUMERIC_STANDARDS };
