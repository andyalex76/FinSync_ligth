import { ArrowLeftRight, CheckCircle2, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import type { Dashboard, DashboardTransaction } from '../types';
import { formatMoney } from '../utils/money';
import { colorStyle } from './colors';
import { iconByName } from './icons';
import { Card, Notice, ProgressBar } from './ui';

const TYPE_LABEL: Record<DashboardTransaction['type'], string> = {
  expense: 'Расход',
  income: 'Доход',
  transfer: 'Перевод',
  saving: 'Пополнение копилки',
  withdrawal: 'Снятие из копилки',
};

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return MONTHS[month - 1] ? `${MONTHS[month - 1]} ${year}` : period;
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

function Totals({ data }: { data: Dashboard }) {
  const { totals } = data;
  const items = [
    { label: 'Доходы', value: totals.income_kopecks, tone: 'text-emerald-500' },
    { label: 'Расходы', value: totals.expenses_kopecks, tone: 'text-rose-500' },
    { label: 'Отложено', value: totals.saved_kopecks, tone: 'text-sky-500' },
    { label: 'Остаток', value: totals.balance_kopecks, tone: totals.balance_kopecks < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
          <div className={`mt-1 text-lg font-semibold tabular-nums ${item.tone}`}>{formatMoney(item.value)}</div>
        </Card>
      ))}
    </div>
  );
}

function Forecast({ data }: { data: Dashboard }) {
  const f = data.forecast;
  if (!f.has_budget) {
    return (
      <Card title="Прогноз расходов">
        <p className="text-sm text-slate-500 dark:text-slate-400">Бюджет на месяц не задан, сравнивать не с чем.</p>
        <p className="mt-2 text-sm">
          Потрачено {formatMoney(f.actual_spent_kopecks)}, в среднем {formatMoney(f.daily_average_kopecks)} в день.
        </p>
      </Card>
    );
  }
  const percent = Math.round((f.projected_spent_kopecks * 100) / f.total_budget_kopecks);
  return (
    <Card title="Прогноз расходов к концу месяца">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{formatMoney(f.projected_spent_kopecks)}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">из {formatMoney(f.total_budget_kopecks)}</span>
      </div>
      <div className="mt-2">
        <ProgressBar percent={percent} barClass={f.is_over_budget ? 'bg-rose-500' : 'bg-emerald-500'} label="Прогноз к бюджету" />
      </div>
      <p className={`mt-2 text-sm ${f.is_over_budget ? 'text-rose-500' : 'text-emerald-500'}`}>
        {f.is_over_budget
          ? `Ожидаемый перерасход: ${formatMoney(f.variance_kopecks)}`
          : `В рамках бюджета, запас ${formatMoney(Math.abs(f.variance_kopecks))}`}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Прошло {f.days_passed} из {f.days_total} дн., в среднем {formatMoney(f.daily_average_kopecks)} в день
      </p>
    </Card>
  );
}

function Budgets({ data }: { data: Dashboard }) {
  return (
    <Card title="Бюджеты по категориям">
      {data.budgets.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Бюджеты на этот месяц не заданы.</p>
      ) : (
        <ul className="space-y-4">
          {data.budgets.map((b) => {
            const Icon = iconByName(b.icon);
            const style = colorStyle(b.color);
            return (
              <li key={b.category_id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.badge}`}>
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="truncate font-medium">{b.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                    {formatMoney(b.spent_kopecks)} / {formatMoney(b.limit_kopecks)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar percent={b.percent} barClass={b.is_over ? 'bg-rose-500' : style.bar} label={b.name} />
                </div>
                {b.is_over && (
                  <p className="mt-1 text-xs text-rose-500">Сверх лимита: {formatMoney(b.spent_kopecks - b.limit_kopecks)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data.unbudgeted_spent_kopecks > 0 && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Вне бюджета: {formatMoney(data.unbudgeted_spent_kopecks)}
        </p>
      )}
    </Card>
  );
}

function Goals({ data }: { data: Dashboard }) {
  return (
    <Card title="Копилки">
      {data.goals.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Копилок пока нет. Создайте в боте: /goal 150000 Отпуск</p>
      ) : (
        <ul className="space-y-4">
          {data.goals.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <PiggyBank size={16} className="shrink-0 text-sky-500" aria-hidden="true" />
                  <span className="truncate">{g.name}</span>
                  {g.is_reached && <CheckCircle2 size={15} className="shrink-0 text-emerald-500" aria-label="Цель достигнута" />}
                </span>
                <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                  {formatMoney(g.saved_kopecks)} / {formatMoney(g.target_amount_kopecks)}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar percent={g.progress_percent} barClass={g.is_reached ? 'bg-emerald-500' : 'bg-sky-500'} label={g.name} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {g.progress_percent}%
                {g.is_reached
                  ? ', цель достигнута'
                  : g.target_date
                    ? g.is_overdue
                      ? `, срок ${g.target_date} прошёл`
                      : `, до ${g.target_date}${g.required_per_month_kopecks ? `, нужно ~${formatMoney(g.required_per_month_kopecks)} в месяц` : ''}`
                    : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Settlements({ data }: { data: Dashboard }) {
  return (
    <Card title="Взаиморасчёты">
      {data.settlements.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Никто никому не должен.</p>
      ) : (
        <ul className="space-y-2">
          {data.settlements.map((s) => (
            <li key={`${s.debtor_member_id}-${s.creditor_member_id}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{s.debtor_name}</span>
                <ArrowLeftRight size={14} className="shrink-0 text-slate-400" aria-label="должен" />
                <span className="truncate font-medium">{s.creditor_name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(s.amount_kopecks)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentTransactions({ data }: { data: Dashboard }) {
  return (
    <Card title="Последние операции">
      {data.recent_transactions.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Операций пока нет.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.recent_transactions.map((t) => {
            const sign = t.type === 'expense' || t.type === 'saving' ? '-' : t.type === 'income' || t.type === 'withdrawal' ? '+' : '';
            const tone = t.type === 'income' || t.type === 'withdrawal' ? 'text-emerald-500' : t.type === 'expense' ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300';
            const Icon = t.type === 'income' ? TrendingUp : t.type === 'expense' ? TrendingDown : t.type === 'transfer' ? ArrowLeftRight : PiggyBank;
            const detail =
              t.type === 'transfer' && t.paid_by_name && t.to_name
                ? `${t.paid_by_name} → ${t.to_name}`
                : t.goal_name ?? t.category_name ?? TYPE_LABEL[t.type];
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.description || TYPE_LABEL[t.type]}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {shortDate(t.date)} · {detail}
                      {t.paid_by_name && t.type !== 'transfer' ? ` · ${t.paid_by_name}` : ''}
                    </span>
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>
                  {sign}
                  {formatMoney(t.amount_kopecks)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Read-only picture of the family budget. Everything here comes from GET /api/dashboard. */
export function DashboardView({ data, offlineMessage }: { data: Dashboard; offlineMessage?: string }) {
  return (
    <div className="space-y-4">
      {offlineMessage && <Notice tone="warning">Показаны последние полученные данные: {offlineMessage}</Notice>}
      <Totals data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Forecast data={data} />
          <Budgets data={data} />
        </div>
        <div className="space-y-4">
          <Goals data={data} />
          <Settlements data={data} />
          <RecentTransactions data={data} />
        </div>
      </div>
    </div>
  );
}
