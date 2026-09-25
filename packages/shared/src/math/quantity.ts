/**
 * SHEHSWAR ONE360 - Precision Quantity & UOM Conversion Value Object
 */
import { Decimal } from 'decimal.js';
import { UnitOfMeasure } from '@shehswar/types';

export class Quantity {
  private readonly _amount: Decimal;
  private readonly _uom: UnitOfMeasure;

  constructor(amount: number | string | Decimal, uom: UnitOfMeasure = UnitOfMeasure.KG) {
    this._amount = new Decimal(amount);
    this._uom = uom;
  }

  get amount(): Decimal {
    return this._amount;
  }

  get uom(): UnitOfMeasure {
    return this._uom;
  }

  static from(amount: number | string | Decimal, uom: UnitOfMeasure = UnitOfMeasure.KG): Quantity {
    return new Quantity(amount, uom);
  }

  static zero(uom: UnitOfMeasure = UnitOfMeasure.KG): Quantity {
    return new Quantity(0, uom);
  }

  private assertSameUom(other: Quantity): void {
    if (this._uom !== other._uom) {
      throw new Error(
        `UOM mismatch: cannot directly operate between ${this._uom} and ${other._uom}. Convert first.`,
      );
    }
  }

  plus(other: Quantity): Quantity {
    this.assertSameUom(other);
    return new Quantity(this._amount.plus(other._amount), this._uom);
  }

  minus(other: Quantity): Quantity {
    this.assertSameUom(other);
    return new Quantity(this._amount.minus(other._amount), this._uom);
  }

  times(factor: number | string | Decimal): Quantity {
    return new Quantity(this._amount.times(new Decimal(factor)), this._uom);
  }

  dividedBy(divisor: number | string | Decimal): Quantity {
    const div = new Decimal(divisor);
    if (div.isZero()) {
      throw new Error('Division by zero in Quantity calculation.');
    }
    return new Quantity(this._amount.dividedBy(div), this._uom);
  }

  greaterThan(other: Quantity): boolean {
    this.assertSameUom(other);
    return this._amount.greaterThan(other._amount);
  }

  greaterThanOrEqual(other: Quantity): boolean {
    this.assertSameUom(other);
    return this._amount.greaterThanOrEqualTo(other._amount);
  }

  lessThan(other: Quantity): boolean {
    this.assertSameUom(other);
    return this._amount.lessThan(other._amount);
  }

  isZero(): boolean {
    return this._amount.isZero();
  }

  isPositive(): boolean {
    return this._amount.isPositive() && !this._amount.isZero();
  }

  /**
   * Convert quantity using an explicit conversion factor.
   * e.g. 1 Bag of standard feed = 50 KG (factor: 50)
   */
  convertTo(targetUom: UnitOfMeasure, conversionFactor: number | string | Decimal): Quantity {
    const factor = new Decimal(conversionFactor);
    if (factor.isZero()) {
      throw new Error('Conversion factor cannot be zero.');
    }
    // New amount = current amount * factor
    return new Quantity(this._amount.times(factor), targetUom);
  }

  toDbString(decimalPlaces = 4): string {
    return this._amount.toFixed(decimalPlaces);
  }

  format(decimalPlaces = 2): string {
    return `${this._amount.toFixed(decimalPlaces)} ${this._uom}`;
  }

  toJSON(): { amount: string; uom: string } {
    return {
      amount: this.toDbString(4),
      uom: this._uom,
    };
  }
}
