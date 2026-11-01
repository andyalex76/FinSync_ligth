import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, PiggyBank, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { ApiError, createTransaction, getCategories, getGoals, getMembers, rejectTransaction } from '../api';
import { buildTransaction, localDateIso, type EntryFormState, type EntryTab } from '../entry';
import type { Category, Goal, Member } from '../types';
import { getCurrentMemberId } from '../utils/auth';
import { formatMoney } from '../utils/money';
import { colorStyle } from './colors';
import { iconByName } from './icons';
import { Notice } from './ui';

interface Reference {
  categories: Category[];
  members: Member[];
  goals: Goal[];
  meId: string | null;
}

const TABS: { id: EntryTab; label: string; Icon: LucideIcon }[] = [
  { id: 'expense', label: 'Расход', Icon: TrendingDown },
  { id: 'income', label: 'Доход', Icon: TrendingUp },
  { id: 'transfer', label: 'Перевод', Icon: ArrowLeftRight },
  { id: 'savings', label: 'Копилка', Icon: PiggyBank },
];

const FIELD =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900';

const hapticDone = (type: 'success' | 'error') => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);

function emptyForm(ref: Reference | null): EntryFormState {
  const others = ref?.members.filter((m) => m.id !== ref.meId) ?? [];
  return {
    tab: 'expense',
    savingsMode: 'saving',
    amount: '',
    description: '',
    categoryId: '',
    fromMemberId: ref?.meId ?? '',
    toMemberId: others.length === 1 ? others[0].id : '',
    goalId: ref?.goals.length === 1 ? ref.goals[0].id : '',
  };
}

/** Input form of the Mini App: expense, income, transfer between members, deposit/withdrawal of a goal. */
export function EntryForm() {
  const [ref, setRef] = useState<Reference | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<EntryFormState>(() => emptyForm(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; summary: string; cancelled: boolean } | null>(null);

  const loadReference = useCallback(async () => {
    setLoadError(null);
    try {
      const [categories, members, goals, meId] = await Promise.all([
        getCategories(),
        getMembers(),
        getGoals(),
        getCurrentMemberId(),
      ]);
      const loaded = { categories, members: members.filter((m) => m.is_active), goals, meId };
      setRef(loaded);
      setForm((current) => (current.amount || current.description ? current : { ...emptyForm(loaded), tab: current.tab }));
    } catch (err) {
      setLoadError(
        err instanceof ApiError && err.isAuthError
          ? 'Нет доступа. Откройте приложение из чата с ботом.'
          : err instanceof Error
            ? err.message
            : 'Не удалось загрузить данные',
      );
    }
  }, []);

  useEffect(() => {
    void loadReference();
  }, [loadReference]);

  const refreshGoals = useCallback(async () => {
    try {
      const goals = await getGoals();
      setRef((current) => (current ? { ...current, goals } : current));
    } catch {
      // the next full reload fixes it; the entry itself was already saved
    }
  }, []);

  const patch = (changes: Partial<EntryFormState>) => {
    setForm((current) => ({ ...current, ...changes }));
    setError(null);
  };

  const categories = useMemo(
    () => (ref?.categories ?? []).filter((c) => c.is_income === (form.tab === 'income')),
    [ref, form.tab],
  );
  const recipients = useMemo(() => (ref?.members ?? []).filter((m) => m.id !== form.fromMemberId), [ref, form.fromMemberId]);
  const selectedGoal = ref?.goals.find((g) => g.id === form.goalId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ref || busy) return;

    const built = buildTransaction(form, { today: localDateIso(), ...ref });
    if (!built.ok) {
      setError(built.error);
      hapticDone('error');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const created = await createTransaction(built.body);
      hapticDone('success');
      setDone({ id: created.id, summary: built.summary, cancelled: false });
      setForm((current) => ({ ...current, amount: '', description: '', categoryId: '' }));
      if (form.tab === 'savings') await refreshGoals();
    } catch (err) {
      hapticDone('error');
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const cancelLast = async () => {
    if (!done || busy) return;
    setBusy(true);
    try {
      await rejectTransaction(done.id);
      setDone({ ...done, cancelled: true });
      await refreshGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отменить');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{loadError}</Notice>
        <button type="button" onClick={() => void loadReference()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
          Повторить
        </button>
      </div>
    );
  }
  if (!ref) {
    return (
      <div className="flex items-center gap-2 py-10 text-slate-500" role="status">
        <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Загрузка...
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div role="tablist" aria-label="Тип записи" className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-200 p-1 dark:bg-slate-800">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={form.tab === id}
            onClick={() => patch({ tab: id, categoryId: '' })}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium transition ${
              form.tab === id ? 'bg-white text-sky-600 shadow dark:bg-slate-950 dark:text-sky-400' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {form.tab === 'savings' && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Операция с копилкой">
          {(['saving', 'withdrawal'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={form.savingsMode === mode}
              onClick={() => patch({ savingsMode: mode })}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                form.savingsMode === mode ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              {mode === 'saving' ? 'Пополнить' : 'Снять'}
            </button>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="entry-amount" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Сумма, ₽
        </label>
        <input
          id="entry-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={form.amount}
          onChange={(e) => patch({ amount: e.target.value })}
          className={`${FIELD} text-2xl font-semibold tabular-nums`}
        />
      </div>

      {(form.tab === 'expense' || form.tab === 'income') && (
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Категория {form.tab === 'expense' && <span className="font-normal">(если не выбрать, подберётся по описанию)</span>}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Категория">
            {categories.map((c) => {
              const Icon = iconByName(c.icon);
              const selected = form.categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => patch({ categoryId: selected ? '' : c.id })}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                    selected ? 'border-sky-500 bg-sky-500/10' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Icon size={14} className={colorStyle(c.color).badge.split(' ')[1]} aria-hidden="true" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {form.tab === 'transfer' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="entry-from" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              От кого
            </label>
            <select id="entry-from" value={form.fromMemberId} onChange={(e) => patch({ fromMemberId: e.target.value, toMemberId: '' })} className={FIELD}>
              {ref.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === ref.meId ? ' (вы)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="entry-to" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Кому
            </label>
            <select id="entry-to" value={form.toMemberId} onChange={(e) => patch({ toMemberId: e.target.value })} className={FIELD}>
              <option value="">Выберите</option>
              {recipients.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
            Одолжили или вернули долг: «от кого» отдаёт деньги, «кому» получает. Расходами и доходами это не считается.
          </p>
        </div>
      )}

      {form.tab === 'savings' && (
        <div>
          <label htmlFor="entry-goal" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Копилка
          </label>
          {ref.goals.length === 0 ? (
            <Notice tone="warning">Копилок пока нет. Создайте в боте командой /goal 150000 Отпуск</Notice>
          ) : (
            <>
              <select id="entry-goal" value={form.goalId} onChange={(e) => patch({ goalId: e.target.value })} className={FIELD}>
                <option value="">Выберите</option>
                {ref.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {selectedGoal && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Накоплено {formatMoney(selectedGoal.saved_kopecks)} из {formatMoney(selectedGoal.target_amount_kopecks)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <label htmlFor="entry-description" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Описание
        </label>
        <input
          id="entry-description"
          autoComplete="off"
          placeholder={form.tab === 'expense' ? 'Например: кофе' : 'Необязательно'}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          className={FIELD}
        />
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {done && (
        <Notice tone="success">
          <div className="flex items-center justify-between gap-2">
            <span>{done.cancelled ? 'Запись отменена' : `Записано: ${done.summary}`}</span>
            {!done.cancelled && (
              <button type="button" onClick={() => void cancelLast()} disabled={busy} className="shrink-0 font-semibold underline">
                Отменить
              </button>
            )}
          </div>
        </Notice>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3.5 text-base font-semibold text-white shadow active:scale-[0.99] disabled:opacity-60"
      >
        {busy && <Loader2 className="animate-spin" size={18} aria-hidden="true" />}
        Записать
      </button>
    </form>
  );
}
