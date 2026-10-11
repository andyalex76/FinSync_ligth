import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Receipt,
  ArrowRight, 
  Check, 
  X, 
  Zap, 
  PiggyBank, 
  Shield, 
  Plane, 
  Car, 
  Wallet 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { Transaction, Category, FamilyMember, Budget, MonthlyForecast, SavingsGoal, Family } from '../types';
import { formatMoney, formatMoneyCompact, kopecksToRubles } from '../utils/money';
import { CategoryIcon } from './CategoryIcon';
import { TelegramConnectCard } from './TelegramConnectCard';

interface OverviewTabProps {
  family: Family;
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
  budgets: Budget[];
  forecast: MonthlyForecast;
  savingsGoals?: SavingsGoal[];
  isDark?: boolean;
  onConfirmDraft: (draftId: string) => void;
  onRejectDraft: (draftId: string) => void;
  onViewAllTransactions: () => void;
  onOpenConnectModal?: () => void;
  onOpenMiniAppPreview?: () => void;
  onNavigateToSavings?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'cat-groceries': '#3b82f6',
  'cat-housing': '#6366f1',
  'cat-auto': '#06b6d4',
  'cat-cafes': '#f59e0b',
  'cat-health': '#ec4899',
  'cat-leisure': '#8b5cf6',
  'cat-clothes': '#10b981',
  'cat-savings': '#10b981',
  'cat-loans': '#ef4444',
  'cat-other': '#64748b',
};

const SAVINGS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PiggyBank,
  Shield,
  Plane,
  Car,
  Wallet,
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  family,
  transactions,
  categories,
  members: _members,
  budgets: _budgets,
  forecast,
  savingsGoals = [],
  isDark = true,
  onConfirmDraft,
  onRejectDraft,
  onViewAllTransactions,
  onOpenConnectModal = () => {},
  onOpenMiniAppPreview,
  onNavigateToSavings,
}) => {
  const confirmedTransactions = transactions.filter((t) => t.status === 'confirmed');
  const drafts = transactions.filter((t) => t.status === 'review_needed' || t.status === 'draft');

  const totalExpensesKopecks = confirmedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountKopecks, 0);

  const totalIncomeKopecks = confirmedTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amountKopecks, 0);

  const totalSavingsContributedKopecks = confirmedTransactions
    .filter((t) => t.type === 'saving')
    .reduce((sum, t) => sum + t.amountKopecks, 0);

  const totalSavingsBalanceKopecks = savingsGoals.reduce((sum, g) => sum + g.currentKopecks, 0);
  const freeOperatingCashKopecks = totalIncomeKopecks - totalSavingsContributedKopecks - totalExpensesKopecks;

  const categoryData = categories
    .filter((c) => c.id !== 'cat-transfer')
    .map((c) => {
      const spent = confirmedTransactions
        .filter((t) => (t.type === 'expense' || t.type === 'saving') && t.categoryId === c.id)
        .reduce((sum, t) => sum + t.amountKopecks, 0);
      return {
        id: c.id,
        name: c.name,
        spentKopecks: spent,
        spentRubles: kopecksToRubles(spent),
        color: CATEGORY_COLORS[c.id] || c.color || '#94a3b8',
      };
    })
    .filter((c) => c.spentKopecks > 0)
    .sort((a, b) => b.spentKopecks - a.spentKopecks);

  const dailyData = useMemo(() => {
    const daysMap = new Map<string, number>();
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      daysMap.set(iso, 0);
    }
    confirmedTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const datePrefix = t.date.slice(0, 10);
        if (daysMap.has(datePrefix)) {
          daysMap.set(datePrefix, (daysMap.get(datePrefix) || 0) + kopecksToRubles(t.amountKopecks));
        }
      });

    return Array.from(daysMap.entries()).map(([key, value]) => {
      const parts = key.split('-');
      const dateObj = parts.length === 3 
        ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) 
        : new Date(key);
      const label = dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
      return {
        day: label,
        spentRubles: value,
      };
    });
  }, [confirmedTransactions]);

  const budgetProgressPercent = Math.min(100, Math.round((totalExpensesKopecks / Math.max(1, forecast.totalBudgetKopecks)) * 100));

  return (
    <div className="space-y-6">
      {/* Telegram Connection HUD Card */}
      <TelegramConnectCard
        family={family}
        onOpenConnectModal={onOpenConnectModal}
        onOpenMiniAppPreview={onOpenMiniAppPreview}
      />

      {/* Drafts review alert */}
      {drafts.length > 0 && (
        <div className="dark:bg-amber-950/30 bg-amber-50/80 border dark:border-amber-500/30 border-amber-200/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md transition-all shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold dark:text-amber-300 text-amber-900">
                  Требуют подтверждения ({drafts.length})
                </h4>
                <p className="text-xs dark:text-amber-400/80 text-amber-700 mt-0.5">
                  Операции из Telegram-бота и OCR ожидают вашего одобрения
                </p>
              </div>
            </div>
            <button
              onClick={onViewAllTransactions}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              <span>Проверить все</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {drafts.slice(0, 3).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2.5 rounded-xl dark:bg-slate-900/60 bg-white border dark:border-slate-800 border-amber-200/60 text-xs"
              >
                <div className="truncate mr-2">
                  <div className="font-medium dark:text-white text-slate-900 truncate">
                    {d.description || 'Чек без описания'}
                  </div>
                  <div className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {formatMoney(d.amountKopecks)}
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => onConfirmDraft(d.id)}
                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    title="Подтвердить"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRejectDraft(d.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                    title="Отклонить"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
              Доходы
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono dark:text-white text-slate-900">
              {formatMoney(totalIncomeKopecks)}
            </div>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">Поступления семьи</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
              Расходы
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono dark:text-white text-slate-900">
              {formatMoney(totalExpensesKopecks)}
            </div>
            <div className="flex items-center justify-between text-xs dark:text-slate-400 text-slate-500 mt-1">
              <span>Лимит: {formatMoney(forecast.totalBudgetKopecks)}</span>
              <span className="font-semibold text-rose-500">{budgetProgressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Savings Balance */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
              Накопления
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono dark:text-white text-slate-900">
              {formatMoney(totalSavingsBalanceKopecks)}
            </div>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">
              {savingsGoals.length} активных целей
            </p>
          </div>
        </div>

        {/* Operating Balance */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
              Свободный остаток
            </span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono dark:text-white text-slate-900">
              {formatMoney(freeOperatingCashKopecks)}
            </div>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">Доступно до конца месяца</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category breakdown (Pie Chart) */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Структура расходов
            </h3>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-0.5">
              Распределение по категориям
            </p>
          </div>

          {categoryData.length > 0 ? (
            <>
              <div className="h-56 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="spentRubles"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${Number(value ?? 0).toLocaleString('ru-RU')} ₽`, 'Расход']}
                      contentStyle={{
                        backgroundColor: isDark ? '#020617' : '#ffffff',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        borderRadius: '12px',
                        color: isDark ? '#e2e8f0' : '#0f172a',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                {categoryData.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <CategoryIcon categoryId={c.id} size="xs" />
                      <span className="dark:text-slate-300 text-slate-700 truncate max-w-[140px] font-medium">
                        {c.name}
                      </span>
                    </div>
                    <span className="font-mono font-medium dark:text-white text-slate-900">
                      {formatMoney(c.spentKopecks)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl dark:bg-slate-800/80 bg-slate-100 dark:text-slate-500 text-slate-400 flex items-center justify-center mb-2">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold dark:text-slate-300 text-slate-700">Нет расходов за период</p>
              <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-1 max-w-[220px]">
                База чиста. Добавьте первую операцию или загрузите чек через бота
              </p>
            </div>
          )}
        </div>

        {/* Daily Expenses Dynamic (Bar Chart) */}
        <div className="lg:col-span-2 dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Динамика расходов по дням
              </h3>
              <p className="text-xs dark:text-slate-400 text-slate-500 mt-0.5">
                Текущая неделя (последние 7 дней)
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg dark:bg-slate-800/80 bg-slate-100 text-blue-600 dark:text-blue-400 border dark:border-slate-700/80 border-slate-200">
              Среднее: {formatMoneyCompact(forecast.dailyAverageKopecks)}/день
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(v) => [`${Number(v ?? 0).toLocaleString('ru-RU')} ₽`, 'Расход дня']}
                  contentStyle={{
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '12px',
                    color: isDark ? '#e2e8f0' : '#0f172a',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="spentRubles" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Savings Goals preview */}
      {savingsGoals.length > 0 && (
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold dark:text-white text-slate-900">Цели и накопления</h3>
              <p className="text-xs dark:text-slate-400 text-slate-500 mt-0.5">
                Прогресс по семейным копилкам и сбережениям
              </p>
            </div>
            {onNavigateToSavings && (
              <button
                onClick={onNavigateToSavings}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Все цели</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savingsGoals.map((goal) => {
              const GoalIcon = SAVINGS_ICONS[goal.icon] || PiggyBank;
              const percent = Math.min(100, Math.round((goal.currentKopecks / Math.max(1, goal.targetKopecks)) * 100));
              return (
                <div
                  key={goal.id}
                  className="p-3.5 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/60 border-slate-200/60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <GoalIcon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs dark:text-white text-slate-900 truncate max-w-[140px]">
                        {goal.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full dark:bg-slate-700 bg-slate-200 overflow-hidden mb-2">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono dark:text-slate-400 text-slate-500">
                    <span>{formatMoney(goal.currentKopecks)}</span>
                    <span>из {formatMoney(goal.targetKopecks)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
