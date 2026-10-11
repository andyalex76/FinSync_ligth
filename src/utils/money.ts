import { Currency } from '../types';

/**
 * Money utility conforming to Firefly-iii and Beancount patterns:
 * All monetary amounts are stored as exact integers in minor units (kopecks, cents).
 * Floating point operations are strictly prohibited for balances and totals.
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
 * Parse user entered string (e.g., "540", "1 250,50", "45.90") into minor units (integer kopecks)
 */
export function parseAmountToKopecks(input: string): number | null {
  if (!input) return null;
  // Clean spaces and currency symbols
  const cleaned = input.replace(/\s+/g, '').replace(/[₽$€]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/**
 * Fair split of minor units among N participants with zero penny loss (Beancount pattern).
 * Example: 100 kopecks split 3 ways yields [34, 33, 33].
 */
export function splitKopecksFairly(totalKopecks: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalKopecks / count);
  const remainder = totalKopecks % count;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}
