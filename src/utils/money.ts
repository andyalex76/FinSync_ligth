import { Currency } from '../types';

/**
 * All monetary amounts are exact integers in minor units (kopecks, cents).
 * Floating point arithmetic is never used for balances and totals.
 */

export function kopecksToRubles(kopecks: number): number {
  return kopecks / 100;
}

export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

export function formatMoney(kopecks: number, currency: Currency = 'RUB', includeSign: boolean = false): string {
  const rubles = Math.abs(kopecks) / 100;
  const isNegative = kopecks < 0;

  let currencySymbol = '₽';
  if (currency === 'USD') currencySymbol = '$';
  if (currency === 'EUR') currencySymbol = '€';

  const formattedNumber = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rubles);

  const sign = isNegative ? '-' : includeSign && kopecks > 0 ? '+' : '';

  if (currency === 'USD' || currency === 'EUR') {
    return `${sign}${currencySymbol}${formattedNumber}`;
  }
  return `${sign}${formattedNumber} ${currencySymbol}`;
}

export function formatMoneyCompact(kopecks: number, currency: Currency = 'RUB'): string {
  const rubles = Math.abs(kopecks) / 100;
  const isNegative = kopecks < 0;
  const sign = isNegative ? '-' : '';
  const currencySymbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : '€';

  if (rubles >= 1_000_000) {
    return `${sign}${(rubles / 1_000_000).toFixed(1)} млн ${currencySymbol}`;
  }
  if (rubles >= 1_000) {
    return `${sign}${(rubles / 1_000).toFixed(0)}k ${currencySymbol}`;
  }
  return formatMoney(kopecks, currency);
}

/**
 * Parse an amount typed by a person ("540", "1 250,50", "45.9", "1500 ₽") into integer kopecks.
 * Strict: digits with at most two decimals. Garbage ("12abc", "1e3", "-5", "1,234") gives null.
 * The arithmetic is done on integers, no float rounding.
 */
export function parseAmountToKopecks(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s\u00a0\u202f]+/g, '').replace(/[₽$€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const kopecks = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(kopecks) ? kopecks : null;
}
