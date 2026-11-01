import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyCompact, kopecksToRubles, parseAmountToKopecks, rublesToKopecks } from './money';

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('money utils (integer kopecks)', () => {
  it('converts between rubles and kopecks without float leaks', () => {
    expect(kopecksToRubles(145050)).toBe(1450.5);
    expect(rublesToKopecks(19.99)).toBe(1999);
    expect(rublesToKopecks(0.01)).toBe(1);
  });

  it('formats money with sign and currency', () => {
    expect(plain(formatMoney(100000))).toBe('1 000,00 ₽');
    expect(plain(formatMoney(-15000))).toBe('-150,00 ₽');
    expect(plain(formatMoney(25000, 'RUB', true))).toBe('+250,00 ₽');
    expect(plain(formatMoney(5000, 'USD'))).toBe('$50,00');
    expect(plain(formatMoneyCompact(150_000_000))).toBe('1.5 млн ₽');
    expect(plain(formatMoneyCompact(450_000))).toBe('5k ₽');
  });

  it('parses typed amounts into integer kopecks', () => {
    expect(parseAmountToKopecks('540')).toBe(54000);
    expect(parseAmountToKopecks('1 250,50')).toBe(125050);
    expect(parseAmountToKopecks('45.9')).toBe(4590);
    expect(parseAmountToKopecks('1500 ₽')).toBe(150000);
    expect(parseAmountToKopecks('0,05')).toBe(5);
    expect(parseAmountToKopecks('0')).toBe(0);
  });

  it('refuses garbage instead of guessing', () => {
    for (const bad of ['', 'abc', '12abc', '1e3', '-5', '1,234', '12.345', '1.2.3', ' ']) {
      expect(parseAmountToKopecks(bad), bad).toBeNull();
    }
    expect(parseAmountToKopecks('9'.repeat(30))).toBeNull();
  });
});
