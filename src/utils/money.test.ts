import { describe, it, expect } from 'vitest';
import {
  kopecksToRubles,
  rublesToKopecks,
  formatMoney,
  formatMoneyCompact,
  parseAmountToKopecks,
  splitKopecksFairly,
} from './money';

describe('Money Utilities (Firefly-iii / Beancount integer kopeck logic)', () => {
  it('converts kopecks to rubles correctly', () => {
    expect(kopecksToRubles(100)).toBe(1);
    expect(kopecksToRubles(145050)).toBe(1450.5);
    expect(kopecksToRubles(0)).toBe(0);
    expect(kopecksToRubles(-500)).toBe(-5);
  });

  it('converts rubles to integer kopecks safely without float precision leaks', () => {
    expect(rublesToKopecks(1.0)).toBe(100);
    expect(rublesToKopecks(19.99)).toBe(1999);
    expect(rublesToKopecks(0.01)).toBe(1);
    expect(rublesToKopecks(0)).toBe(0);
  });

  it('formats money with standard locale and symbols', () => {
    const formatted = formatMoney(100000, 'RUB');
    expect(formatted).toContain('1');
    expect(formatted).toContain('000');
    expect(formatted).toContain('₽');

    const formattedUsd = formatMoney(5000, 'USD');
    expect(formattedUsd).toContain('$');
    expect(formattedUsd).toContain('50');

    const formattedNegative = formatMoney(-15000, 'RUB');
    expect(formattedNegative.startsWith('-')).toBe(true);

    const formattedWithPlus = formatMoney(25000, 'RUB', true);
    expect(formattedWithPlus.startsWith('+')).toBe(true);
  });

  it('formats money in compact notation for widgets', () => {
    expect(formatMoneyCompact(150_000_000, 'RUB')).toContain('1.5 млн ₽');
    expect(formatMoneyCompact(12_000_00, 'RUB')).toContain('12k ₽');
    expect(formatMoneyCompact(50_00, 'RUB')).toContain('50');
  });

  it('parses user input strings into integer kopecks reliably', () => {
    expect(parseAmountToKopecks('540')).toBe(54000);
    expect(parseAmountToKopecks('1 250,50')).toBe(125050);
    expect(parseAmountToKopecks('1250.50')).toBe(125050);
    expect(parseAmountToKopecks('14,99 ₽')).toBe(1499);
    expect(parseAmountToKopecks('$ 100.00')).toBe(10000);
    expect(parseAmountToKopecks('')).toBeNull();
    expect(parseAmountToKopecks('invalid')).toBeNull();
    expect(parseAmountToKopecks('-50')).toBeNull();
  });

  it('splits kopecks fairly among N participants with ZERO penny loss', () => {
    // 100 kopecks split 3 ways -> 34, 33, 33 (sum exactly 100)
    const split3 = splitKopecksFairly(100, 3);
    expect(split3).toEqual([34, 33, 33]);
    expect(split3.reduce((a, b) => a + b, 0)).toBe(100);

    // 1000 kopecks split 4 ways -> 250, 250, 250, 250
    const split4 = splitKopecksFairly(1000, 4);
    expect(split4).toEqual([250, 250, 250, 250]);
    expect(split4.reduce((a, b) => a + b, 0)).toBe(1000);

    // 1 kopeck split 3 ways -> [1, 0, 0]
    const split1 = splitKopecksFairly(1, 3);
    expect(split1).toEqual([1, 0, 0]);
    expect(split1.reduce((a, b) => a + b, 0)).toBe(1);

    // 0 or negative count
    expect(splitKopecksFairly(100, 0)).toEqual([]);
    expect(splitKopecksFairly(100, -1)).toEqual([]);
  });
});
