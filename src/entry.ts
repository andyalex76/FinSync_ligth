import type { Category, Goal, Member, NewTransaction } from './types';
import { formatMoney, parseAmountToKopecks } from './utils/money';

export type EntryTab = 'expense' | 'income' | 'transfer' | 'savings';
export type SavingsMode = 'saving' | 'withdrawal';

export interface EntryFormState {
  tab: EntryTab;
  savingsMode: SavingsMode;
  amount: string;
  description: string;
  categoryId: string;
  fromMemberId: string;
  toMemberId: string;
  goalId: string;
}

export interface EntryContext {
  today: string; // YYYY-MM-DD in the person's local time zone
  categories: Category[];
  members: Member[];
  goals: Goal[];
}

export type BuildResult = { ok: true; body: NewTransaction; summary: string } | { ok: false; error: string };

/** Local calendar date (the server's UTC clock can be a day off around midnight). */
export function localDateIso(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Validate the form and build the request body. All checks that the server also makes are repeated
 * here only to give an instant, readable message; the server remains the authority.
 */
export function buildTransaction(form: EntryFormState, ctx: EntryContext): BuildResult {
  const kopecks = parseAmountToKopecks(form.amount);
  if (kopecks === null) return { ok: false, error: 'Введите сумму цифрами, например 540 или 1250,50' };
  if (kopecks <= 0) return { ok: false, error: 'Сумма должна быть больше нуля' };

  const description = form.description.trim();
  const base = { amount_kopecks: kopecks, transaction_date: ctx.today, currency: 'RUB' as const };
  const money = formatMoney(kopecks);

  if (form.tab === 'expense' || form.tab === 'income') {
    const category = ctx.categories.find((c) => c.id === form.categoryId);
    const fallback = form.tab === 'expense' ? 'Расход' : 'Доход';
    const body: NewTransaction = {
      ...base,
      type: form.tab,
      description: description || category?.name || fallback,
      ...(category ? { category_id: category.id } : {}),
    };
    return { ok: true, body, summary: `${fallback}: ${money}${category ? `, ${category.name}` : ''}` };
  }

  if (form.tab === 'transfer') {
    if (!form.toMemberId) return { ok: false, error: 'Выберите, кому перевод' };
    if (form.fromMemberId && form.fromMemberId === form.toMemberId) {
      return { ok: false, error: 'Отправитель и получатель должны быть разными людьми' };
    }
    const from = ctx.members.find((m) => m.id === form.fromMemberId);
    const to = ctx.members.find((m) => m.id === form.toMemberId);
    const body: NewTransaction = {
      ...base,
      type: 'transfer',
      description: description || 'Перевод',
      to_member_id: form.toMemberId,
      ...(form.fromMemberId ? { paid_by_member_id: form.fromMemberId } : {}),
    };
    return { ok: true, body, summary: `Перевод: ${from?.name ?? 'вы'} → ${to?.name ?? '?'}, ${money}` };
  }

  // savings
  const goal = ctx.goals.find((g) => g.id === form.goalId);
  if (!goal) return { ok: false, error: 'Выберите копилку' };
  if (form.savingsMode === 'withdrawal' && kopecks > goal.saved_kopecks) {
    return { ok: false, error: `В копилке «${goal.name}» только ${formatMoney(goal.saved_kopecks)}` };
  }
  const word = form.savingsMode === 'saving' ? 'Пополнение' : 'Снятие';
  const body: NewTransaction = {
    ...base,
    type: form.savingsMode,
    description: description || `${word}: ${goal.name}`,
    goal_id: goal.id,
  };
  return { ok: true, body, summary: `${word}: ${goal.name}, ${money}` };
}
