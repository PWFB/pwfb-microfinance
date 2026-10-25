import { addMoney, compareMoney, moneyToNumber, subtractMoney, toMoney } from './money';

describe('money helpers', () => {
  it('rounds half-up explicitly to two decimal places', () => {
    expect(toMoney('1.005').toFixed(2)).toBe('1.01');
    expect(toMoney('10.004').toFixed(2)).toBe('10.00');
  });

  it('adds and subtracts in decimal arithmetic rather than binary floating point', () => {
    expect(addMoney('0.10', '0.20').toFixed(2)).toBe('0.30');
    expect(subtractMoney('10.00', '0.10').toFixed(2)).toBe('9.90');
  });

  it('compares amounts after the shared rounding policy', () => {
    expect(compareMoney('1.00', '1.004')).toBe(0);
    expect(compareMoney('1.00', '1.01')).toBeLessThan(0);
  });

  it('preserves the existing numeric API shape for safe values', () => {
    expect(moneyToNumber(toMoney('123.45'))).toBe(123.45);
  });

  it('rejects invalid values and values unsafe for the numeric API contract', () => {
    expect(() => toMoney('not-money')).toThrow('Invalid monetary value');
    expect(() => moneyToNumber('90000000000000.00')).toThrow('safe numeric API range');
  });
});
