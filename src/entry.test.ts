import { describe, expect, it } from 'vitest';
import { buildTransaction, localDateIso, type EntryContext, type EntryFormState } from './entry';

const ctx: EntryContext = {
  today: '2026-10-30',
  categories: [
    { id: 'c-food', name: 'Продукты', icon: 'ShoppingCart', color: 'emerald', is_income: false, sort_order: 1, monthly_limit_kopecks: 0 },
    { id: 'c-pay', name: 'Зарплата', icon: 'Banknote', color: 'emerald', is_income: true, sort_order: 2, monthly_limit_kopecks: 0 },
  ],
  members: [
    { id: 'm-anna', name: 'Анна', avatar: '', role: 'owner', balance_kopecks: 0, is_active: true },
    { id: 'm-boris', name: 'Борис', avatar: '', role: 'member', balance_kopecks: 0, is_active: true },
  ],
  goals: [
    {
      id: 'g-trip', name: 'Отпуск', icon: 'PiggyBank', target_amount_kopecks: 15_000_000, target_date: null,
      saved_kopecks: 300_000, remaining_kopecks: 14_700_000, progress_percent: 2, is_reached: false,
      days_left: null, is_overdue: false, required_per_month_kopecks: null,
    },
  ],
};

const form = (patch: Partial<EntryFormState>): EntryFormState => ({
  tab: 'expense', savingsMode: 'saving', amount: '540', description: '', categoryId: '',
  fromMemberId: '', toMemberId: '', goalId: '', ...patch,
});

describe('buildTransaction', () => {
  it('builds an expense; without a category the server picks one from the description', () => {
    const r = buildTransaction(form({ description: ' Кофе ' }), ctx);
    expect(r).toMatchObject({ ok: true, body: { type: 'expense', amount_kopecks: 54000, description: 'Кофе', transaction_date: '2026-10-30' } });
    expect(r.ok && 'category_id' in r.body).toBe(false);
  });

  it('attaches the chosen category and falls back to its name as description', () => {
    const r = buildTransaction(form({ categoryId: 'c-food', amount: '1 250,50' }), ctx);
    expect(r).toMatchObject({ ok: true, body: { category_id: 'c-food', amount_kopecks: 125050, description: 'Продукты' } });
  });

  it('builds income', () => {
    const r = buildTransaction(form({ tab: 'income', categoryId: 'c-pay', amount: '100000' }), ctx);
    expect(r).toMatchObject({ ok: true, body: { type: 'income', amount_kopecks: 10_000_000, description: 'Зарплата' } });
  });

  it.each(['', '0', 'abc', '-5', '12.345'])('refuses the amount "%s"', (amount) => {
    const r = buildTransaction(form({ amount }), ctx);
    expect(r.ok).toBe(false);
  });

  it('builds a transfer with a recipient and an optional different sender', () => {
    const own = buildTransaction(form({ tab: 'transfer', toMemberId: 'm-boris', amount: '5000' }), ctx);
    expect(own).toMatchObject({ ok: true, body: { type: 'transfer', to_member_id: 'm-boris', amount_kopecks: 500000 } });
    expect(own.ok && 'paid_by_member_id' in own.body).toBe(false);

    const other = buildTransaction(form({ tab: 'transfer', fromMemberId: 'm-boris', toMemberId: 'm-anna' }), ctx);
    expect(other).toMatchObject({ ok: true, body: { paid_by_member_id: 'm-boris', to_member_id: 'm-anna' }, summary: expect.stringContaining('Борис → Анна') });
  });

  it('refuses a transfer without a recipient or to oneself', () => {
    expect(buildTransaction(form({ tab: 'transfer' }), ctx)).toEqual({ ok: false, error: 'Выберите, кому перевод' });
    expect(buildTransaction(form({ tab: 'transfer', fromMemberId: 'm-anna', toMemberId: 'm-anna' }), ctx).ok).toBe(false);
  });

  it('builds a deposit and a withdrawal for a goal', () => {
    const dep = buildTransaction(form({ tab: 'savings', goalId: 'g-trip', amount: '5000' }), ctx);
    expect(dep).toMatchObject({ ok: true, body: { type: 'saving', goal_id: 'g-trip', description: 'Пополнение: Отпуск' } });
    const wd = buildTransaction(form({ tab: 'savings', savingsMode: 'withdrawal', goalId: 'g-trip', amount: '3000' }), ctx);
    expect(wd).toMatchObject({ ok: true, body: { type: 'withdrawal', amount_kopecks: 300000 } });
  });

  it('refuses savings without a goal and a withdrawal above the saved amount', () => {
    expect(buildTransaction(form({ tab: 'savings' }), ctx)).toEqual({ ok: false, error: 'Выберите копилку' });
    const r = buildTransaction(form({ tab: 'savings', savingsMode: 'withdrawal', goalId: 'g-trip', amount: '3000,01' }), ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('только');
  });
});

describe('localDateIso', () => {
  it('uses the local calendar date with zero padding', () => {
    expect(localDateIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateIso(new Date(2026, 10, 30, 0, 1))).toBe('2026-11-30');
  });
});
