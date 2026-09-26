/**
 * SHEHSWAR ONE360 - Precision & API Serialization Tests
 */
import { describe, it, expect } from 'vitest';
import {
  NUMERIC_STANDARDS,
  serializeDecimal,
  parseDecimal,
  roundToPrecision,
} from './precision.js';
import { Decimal } from 'decimal.js';

describe('Numeric Precision Standards & Serialization', () => {
  it('should define distinct, appropriate precision and scale for all 7 business concepts', () => {
    expect(NUMERIC_STANDARDS.MONEY.decimalPlaces).toBe(2);
    expect(NUMERIC_STANDARDS.QUANTITY.decimalPlaces).toBe(4);
    expect(NUMERIC_STANDARDS.UNIT_COST_RATE.decimalPlaces).toBe(6);
    expect(NUMERIC_STANDARDS.PERCENTAGE.decimalPlaces).toBe(4);
    expect(NUMERIC_STANDARDS.CONVERSION_FACTOR.decimalPlaces).toBe(6);
    expect(NUMERIC_STANDARDS.COMPOSITION_PERCENT.decimalPlaces).toBe(4);
    expect(NUMERIC_STANDARDS.ALLOCATION_FACTOR.decimalPlaces).toBe(6);
  });

  it('should serialize high-precision unit cost rate without floating point truncation', () => {
    // e.g. Raw Material Batch purchase: 142.345678 PKR per KG
    const unitRate = new Decimal('142.345678');
    const serialized = serializeDecimal(unitRate, NUMERIC_STANDARDS.UNIT_COST_RATE.decimalPlaces);

    expect(serialized).toBe('142.345678');
    expect(typeof serialized).toBe('string');
  });

  it('should prevent standard JavaScript binary floating-point drift in composition math', () => {
    // 0.1% + 0.2% in IEEE-754 is 0.30000000000000004%
    const p1 = parseDecimal('0.1000');
    const p2 = parseDecimal('0.2000');
    const totalComposition = p1.plus(p2);

    const serialized = serializeDecimal(
      totalComposition,
      NUMERIC_STANDARDS.COMPOSITION_PERCENT.decimalPlaces,
    );
    expect(serialized).toBe('0.3000');
    expect(serialized).not.toBe('0.30000000000000004');
  });

  it('should correctly execute commercial ROUND_HALF_UP on financial allocations', () => {
    // Rounding 12.345 to 2 decimals should produce 12.35
    expect(roundToPrecision('12.3450', 'MONEY')).toBe('12.35');
    // Rounding 12.344 to 2 decimals should produce 12.34
    expect(roundToPrecision('12.3440', 'MONEY')).toBe('12.34');
  });

  it('should accurately handle overhead allocation factor (6 decimal places)', () => {
    const totalOverhead = new Decimal('150000.00'); // 150k PKR electricity
    const totalUnits = new Decimal('36000000'); // 36 million units produced
    const allocationPerUnit = totalOverhead.dividedBy(totalUnits);

    const serialized = roundToPrecision(allocationPerUnit, 'ALLOCATION_FACTOR');
    expect(serialized).toBe('0.004167');
  });
});
