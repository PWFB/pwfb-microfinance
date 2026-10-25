import { Prisma } from '@prisma/client';

export type MoneyInput = Prisma.Decimal | number | string;

/**
 * Converts monetary input to NGN's two-decimal precision with an explicit
 * half-up rounding rule. Never use JavaScript arithmetic for wallet balances.
 */
export function toMoney(value: MoneyInput): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new RangeError('Invalid monetary value');
  }
  if (!decimal.isFinite()) throw new RangeError('Invalid monetary value');
  return decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function addMoney(left: MoneyInput, right: MoneyInput): Prisma.Decimal {
  return toMoney(toMoney(left).plus(toMoney(right)));
}

export function subtractMoney(left: MoneyInput, right: MoneyInput): Prisma.Decimal {
  return toMoney(toMoney(left).minus(toMoney(right)));
}

export function compareMoney(left: MoneyInput, right: MoneyInput): number {
  return toMoney(left).comparedTo(toMoney(right)) ?? 0;
}

/**
 * Keeps the current API contract (JSON numbers) for existing clients while
 * refusing values whose kobo cannot be represented safely by a JS number.
 * A future versioned API can move to fixed-point strings without ambiguity.
 */
export function moneyToNumber(value: MoneyInput): number {
  const decimal = toMoney(value);
  const minorUnits = decimal.mul(100);
  if (!minorUnits.isInteger() || minorUnits.abs().greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Monetary value exceeds the safe numeric API range');
  }
  const result = decimal.toNumber();
  if (!Number.isFinite(result)) throw new RangeError('Monetary value exceeds the safe numeric API range');
  return result;
}

export function walletToApi<T extends { balance: MoneyInput }>(
  wallet: T,
): Omit<T, 'balance'> & { balance: number } {
  return { ...wallet, balance: moneyToNumber(wallet.balance) };
}

export function walletTransactionToApi<
  T extends { amount: MoneyInput; previousBalance: MoneyInput; newBalance: MoneyInput },
>(transaction: T): Omit<T, 'amount' | 'previousBalance' | 'newBalance'> & {
  amount: number;
  previousBalance: number;
  newBalance: number;
} {
  return {
    ...transaction,
    amount: moneyToNumber(transaction.amount),
    previousBalance: moneyToNumber(transaction.previousBalance),
    newBalance: moneyToNumber(transaction.newBalance),
  };
}
