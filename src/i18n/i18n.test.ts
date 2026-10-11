import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { resources } from './index';

describe('i18n configuration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('provides Russian translation keys by default', () => {
    expect(i18n.t('app.title')).toBe('Семейный Бюджет');
    expect(i18n.t('nav.overview')).toBe('Сводка');
    expect(i18n.t('nav.budgets')).toBe('Бюджеты');
    expect(i18n.t('nav.transactions')).toBe('Операции');
  });

  it('switches to English and returns correct translations', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('app.title')).toBe('Family Budget');
    expect(i18n.t('nav.overview')).toBe('Overview');
    expect(i18n.t('nav.budgets')).toBe('Budgets');
    expect(i18n.t('nav.transactions')).toBe('Transactions');
  });

  it('interpolates count parameter correctly in transactions count', () => {
    const textRu = i18n.t('transactions.totalCount', { count: 42, lng: 'ru' });
    expect(textRu).toBe('Отображено операций: 42');

    const textEn = i18n.t('transactions.totalCount', { count: 42, lng: 'en' });
    expect(textEn).toBe('Showing transactions: 42');
  });

  it('has matching key structures between Russian and English resources', () => {
    const ruKeys = Object.keys(resources.ru.translation).sort();
    const enKeys = Object.keys(resources.en.translation).sort();
    expect(ruKeys).toEqual(enKeys);
  });
});
