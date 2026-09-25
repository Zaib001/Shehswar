/**
 * SHEHSWAR ONE360 - Financial Precision & Math Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { Money } from './money.js';
import { Quantity } from './quantity.js';
import { UnitOfMeasure } from '@shehswar/types';

describe('Money Value Object', () => {
  it('should prevent standard IEEE-754 floating point arithmetic inaccuracies', () => {
    // In standard JS: 0.1 + 0.2 === 0.30000000000000004
    const a = Money.from('0.10', 'PKR');
    const b = Money.from('0.20', 'PKR');
    const sum = a.plus(b);

    expect(sum.toDbString(4)).toBe('0.3000');
    expect(sum.equals(Money.from('0.30', 'PKR'))).toBe(true);
  });

  it('should accurately calculate markup percentage', () => {
    const cost = Money.from('100.00', 'PKR');
    // 15% parent company markup on manufacturing cost
    const sellingPrice = cost.applyMarkup(15);

    expect(sellingPrice.toDbString(4)).toBe('115.0000');
    expect(sellingPrice.format()).toBe('PKR 115.00');
  });

  it('should forbid arithmetic between mismatched currencies', () => {
    const pkr = Money.from('1000.00', 'PKR');
    const usd = Money.from('10.00', 'USD');

    expect(() => pkr.plus(usd)).toThrow(/Currency mismatch/);
  });
});

describe('Quantity Value Object', () => {
  it('should accurately convert units of measure using conversion factor', () => {
    // 1 Bag = 50 KG
    const bagCount = Quantity.from('20', UnitOfMeasure.BAG);
    const inKg = bagCount.convertTo(UnitOfMeasure.KG, 50);

    expect(inKg.toDbString(4)).toBe('1000.0000');
    expect(inKg.uom).toBe(UnitOfMeasure.KG);
  });

  it('should forbid direct addition between different UOMs without conversion', () => {
    const bags = Quantity.from('5', UnitOfMeasure.BAG);
    const kgs = Quantity.from('50', UnitOfMeasure.KG);

    expect(() => bags.plus(kgs)).toThrow(/UOM mismatch/);
  });
});
