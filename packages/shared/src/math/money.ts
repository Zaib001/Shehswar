/**
 * SHEHSWAR ONE360 - Financial Precision Value Object (Money)
 *
 * Prevents IEEE-754 binary floating-point errors (e.g. 0.1 + 0.2 !== 0.3).
 * Uses Decimal.js under the hood with strict rounding and currency checking.
 */
import { Decimal } from 'decimal.js';

// Configure Decimal.js precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class Money {
  private readonly _amount: Decimal;
  private readonly _currency: string;

  constructor(amount: number | string | Decimal, currency = 'PKR') {
    this._amount = new Decimal(amount);
    this._currency = currency.toUpperCase();
  }

  get amount(): Decimal {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  static from(amount: number | string | Decimal, currency = 'PKR'): Money {
    return new Money(amount, currency);
  }

  static zero(currency = 'PKR'): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Currency mismatch: cannot perform operation between ${this._currency} and ${other._currency}.`,
      );
    }
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount.plus(other._amount), this._currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount.minus(other._amount), this._currency);
  }

  times(factor: number | string | Decimal): Money {
    return new Money(this._amount.times(new Decimal(factor)), this._currency);
  }

  dividedBy(divisor: number | string | Decimal): Money {
    const div = new Decimal(divisor);
    if (div.isZero()) {
      throw new Error('Division by zero in Money calculation.');
    }
    return new Money(this._amount.dividedBy(div), this._currency);
  }

  applyPercentage(percentage: number | string | Decimal): Money {
    const rate = new Decimal(percentage).dividedBy(100);
    return new Money(this._amount.times(rate), this._currency);
  }

  applyMarkup(percentage: number | string | Decimal): Money {
    const rate = new Decimal(1).plus(new Decimal(percentage).dividedBy(100));
    return new Money(this._amount.times(rate), this._currency);
  }

  isZero(): boolean {
    return this._amount.isZero();
  }

  isPositive(): boolean {
    return this._amount.isPositive() && !this._amount.isZero();
  }

  isNegative(): boolean {
    return this._amount.isNegative();
  }

  equals(other: Money): boolean {
    return this._currency === other._currency && this._amount.equals(other._amount);
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount.greaterThan(other._amount);
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount.lessThan(other._amount);
  }

  /**
   * Returns exact decimal string suitable for database storage (DECIMAL(18, 4))
   */
  toDbString(decimalPlaces = 4): string {
    return this._amount.toFixed(decimalPlaces);
  }

  /**
   * Returns formatted string for presentation (e.g. "PKR 1,250.00")
   */
  format(locale = 'en-PK'): string {
    const rounded = this._amount.toFixed(2);
    const parts = rounded.split('.');
    const integerPart = parts[0] ?? '0';
    const decimalPart = parts[1] ?? '00';
    const formattedInteger = Number(integerPart).toLocaleString(locale);
    return `${this._currency} ${formattedInteger}.${decimalPart}`;
  }

  toJSON(): { amount: string; currency: string } {
    return {
      amount: this.toDbString(4),
      currency: this._currency,
    };
  }
}
