import React, { useState } from 'react';
import { 
  PiggyBank, 
  Plus, 
  Edit3, 
  Check, 
  Shield, 
  Plane, 
  Car, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Users, 
  Coins 
} from 'lucide-react';
import { Budget, Category, Transaction, SavingsGoal, FamilyMember } from '../types';
import { formatMoney, rublesToKopecks } from '../utils/money';
import { CategoryIcon } from './CategoryIcon';
import { AddSavingGoalModal } from './AddSavingGoalModal';

interface BudgetsTabProps {
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  savingsGoals?: SavingsGoal[];
  members?: FamilyMember[];
  familyId?: string;
  onUpdateBudgetLimit: (categoryId: string, newLimitKopecks: number) => void;
  onDepositSavingGoal?: (goalId: string, amountKopecks: number, memberId?: string, isInterest?: boolean) => void;
  onWithdrawSavingGoal?: (goalId: string, amountKopecks: number, memberId?: string) => void;
  onAddSavingGoal?: (goal: SavingsGoal) => void;
  onDeleteSavingGoal?: (goalId: string) => void;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  budgets,
  categories,
  transactions,
  savingsGoals = [],
  members = [],
  familyId = 'fam-1',
  onUpdateBudgetLimit,
  onDepositSavingGoal,
  onWithdrawSavingGoal,
  onAddSavingGoal,
  onDeleteSavingGoal,
}) => {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editValueRubles, setEditValueRubles] = useState<string>('');
  
  // Savings Modal states
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [quickTopUpGoalId, setQuickTopUpGoalId] = useState<string | null>(null);
  const [topUpAmountRubles, setTopUpAmountRubles] = useState<string>('5000');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || 'm-1');
  const [withdrawGoalId, setWithdrawGoalId] = useState<string | null>(null);
  const [withdrawAmountRubles, setWithdrawAmountRubles] = useState<string>('5000');

  // Calculate actual spent per category for the current month
  const confirmedExpenses = transactions.filter(t => t.status === 'confirmed' && t.type === 'expense');

  const totalLimitKopecks = budgets.reduce((acc, b) => acc + b.limitKopecks, 0);
  const totalSpentKopecks = budgets.reduce((acc, b) => {
    const actualSpent = confirmedExpenses
      .filter(t => t.categoryId === b.categoryId)
      .reduce((sum, t) => sum + t.amountKopecks, 0);
    return acc + actualSpent;
  }, 0);

  const totalRemainingKopecks = totalLimitKopecks - totalSpentKopecks;
  const overallPercentage = totalLimitKopecks > 0 
    ? Math.min(100, Math.round((totalSpentKopecks / totalLimitKopecks) * 100)) 
    : 0;

  const totalSavingsKopecks = savingsGoals.reduce((sum, g) => sum + g.currentKopecks, 0);
  const totalSavingsTargetKopecks = savingsGoals.reduce((sum, g) => sum + g.targetKopecks, 0);

  // Calculate savings contribution by family members
  const savingTxs = transactions.filter(t => t.type === 'saving' && t.status === 'confirmed');
  const totalSavingContributed = savingTxs.reduce((sum, t) => sum + t.amountKopecks, 0);

  const memberContributions = members.map(m => {
    const sum = savingTxs
      .filter(t => t.paidByMemberId === m.id)
      .reduce((acc, t) => acc + t.amountKopecks, 0);
    const percent = totalSavingContributed > 0 ? Math.round((sum / totalSavingContributed) * 100) : 0;
    return { ...m, contributedKopecks: sum, percent };
  });

  const handleStartEdit = (b: Budget) => {
    setEditingCategoryId(b.categoryId);
    setEditValueRubles((b.limitKopecks / 100).toString());
  };

  const handleSaveEdit = (categoryId: string) => {
    const val = parseFloat(editValueRubles.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      onUpdateBudgetLimit(categoryId, rublesToKopecks(val));
    }
    setEditingCategoryId(null);
  };

  const handleQuickTopUp = (goalId: string) => {
    const val = parseFloat(topUpAmountRubles.replace(',', '.'));
    if (!isNaN(val) && val > 0 && onDepositSavingGoal) {
      onDepositSavingGoal(goalId, rublesToKopecks(val), selectedMemberId);
      setQuickTopUpGoalId(null);
    }
  };

  const handleWithdraw = (goalId: string) => {
    const val = parseFloat(withdrawAmountRubles.replace(',', '.'));
    if (!isNaN(val) && val > 0 && onWithdrawSavingGoal) {
      onWithdrawSavingGoal(goalId, rublesToKopecks(val), selectedMemberId);
      setWithdrawGoalId(null);
    }
  };

  const handleCapitalizeInterest = (goal: SavingsGoal) => {
    if (!goal.interestRate || !onDepositSavingGoal) return;
    // Monthly interest = (current * rate / 100) / 12
    const monthlyInterestKopecks = Math.round((goal.currentKopecks * (goal.interestRate / 100)) / 12);
    if (monthlyInterestKopecks > 0) {
      onDepositSavingGoal(goal.id, monthlyInterestKopecks, undefined, true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actual Budget Header Card (Sleek Gradient Banner) */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 shadow-lg shadow-blue-900/25 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full text-blue-100">
                Actual Budget Engine
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight capitalize">
                Бюджет на {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <p className="text-xs text-blue-100/90 mt-1 max-w-xl">
              План / факт по категориям расходов семьи с автоматическим отслеживанием порогов
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-950/40 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-white/10 shrink-0">
            <div className="text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Остаток бюджета</p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-300 mt-0.5">
                {formatMoney(totalRemainingKopecks)}
              </p>
            </div>
          </div>
        </div>

        {/* Global Progress bar */}
        <div className="mt-5 sm:mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-blue-100">
            <span>
              Потрачено: <strong className="text-white">{formatMoney(totalSpentKopecks)}</strong> из{' '}
              {formatMoney(totalLimitKopecks)}
            </span>
            <span className="font-bold text-white">
              {overallPercentage}%
            </span>
          </div>

          <div className="h-2.5 w-full bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 shadow-xs ${
                overallPercentage > 100
                  ? 'bg-rose-400'
                  : overallPercentage > 80
                  ? 'bg-amber-400'
                  : 'bg-white'
              }`}
              style={{ width: `${Math.min(100, overallPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Budgets List */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Категории & Лимиты
            </h3>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-0.5">
              Нажмите иконку редактирования для изменения месячного лимита
            </p>
          </div>
          <span className="text-[11px] font-mono dark:text-slate-400 text-slate-600 dark:bg-slate-800/60 bg-slate-100 px-2.5 py-1 rounded-lg border dark:border-slate-700/60 border-slate-200">
            Категорий: {budgets.length}
          </span>
        </div>

        <div className="space-y-3">
          {budgets.map((b) => {
            const category = categories.find((c) => c.id === b.categoryId);
            if (!category) return null;

            const spentKopecks = confirmedExpenses
              .filter((t) => t.categoryId === b.categoryId)
              .reduce((sum, t) => sum + t.amountKopecks, 0);

            const remaining = b.limitKopecks - spentKopecks;
            const percent = b.limitKopecks > 0 ? Math.round((spentKopecks / b.limitKopecks) * 100) : 0;
            const isOver = remaining < 0;
            const isEditing = editingCategoryId === b.categoryId;

            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isOver
                    ? 'dark:bg-rose-950/20 bg-rose-50/70 border-rose-300 dark:border-rose-500/30'
                    : 'dark:bg-slate-950/60 bg-slate-50/90 dark:border-slate-800/80 border-slate-200/80 hover:border-slate-300 dark:hover:border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CategoryIcon category={category} size="md" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold dark:text-white text-slate-900">
                          {category.name}
                        </span>
                        {isOver && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
                            Превышен
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] dark:text-slate-400 text-slate-500 font-mono">
                        Потрачено {formatMoney(spentKopecks)} из{' '}
                        {isEditing ? (
                          <span className="inline-flex items-center space-x-1 ml-1">
                            <input
                              type="number"
                              value={editValueRubles}
                              onChange={(e) => setEditValueRubles(e.target.value)}
                              className="w-20 px-1 py-0.5 dark:bg-slate-900 bg-white border border-blue-500 rounded text-xs dark:text-white text-slate-900 font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(b.categoryId)}
                              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </span>
                        ) : (
                          <span className="dark:text-slate-300 text-slate-700 font-semibold">{formatMoney(b.limitKopecks)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isEditing && (
                      <button
                        onClick={() => handleStartEdit(b)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        title="Изменить лимит"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Progress Bar */}
                <div className="mt-2 space-y-1.5">
                  <div className="h-2 w-full dark:bg-slate-900 bg-slate-200 rounded-full overflow-hidden border dark:border-slate-800 border-slate-300/60">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOver
                          ? 'bg-rose-500'
                          : percent > 80
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] dark:text-slate-400 text-slate-500 font-mono">
                    <span>
                      Остаток:{' '}
                      <strong className={isOver ? 'text-rose-500 dark:text-rose-400' : 'dark:text-slate-300 text-slate-700'}>
                        {formatMoney(remaining)}
                      </strong>
                    </span>
                    <span>{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings Goals & High-Yield Deposits Section (Копилка) */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-purple-500/30 border-purple-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 dark:bg-purple-500/20 bg-purple-100 text-purple-600 dark:text-purple-400 rounded-xl border dark:border-purple-500/30 border-purple-200">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold dark:text-white text-slate-900 flex items-center space-x-2">
                <span>Семейные накопительные счета и Копилка</span>
                <span className="text-[10px] dark:bg-purple-500/20 bg-purple-100 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded border dark:border-purple-500/30 border-purple-200 uppercase">
                  Вклады 16–19%
                </span>
              </h3>
              <p className="text-xs dark:text-slate-400 text-slate-500">
                Всего накоплено: <strong className="dark:text-white text-slate-900 font-mono">{formatMoney(totalSavingsKopecks)}</strong> из целевых {formatMoney(totalSavingsTargetKopecks)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddGoalModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 transition self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Новая цель / вклад</span>
          </button>
        </div>

        {/* Member Contribution Breakdown Card */}
        {memberContributions.length > 0 && totalSavingContributed > 0 && (
          <div className="mb-5 p-3.5 rounded-xl dark:bg-slate-950/70 bg-purple-50/50 border dark:border-purple-500/20 border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Вклад членов семьи в накопления (Сентябрь):
              </span>
              <span className="text-xs font-mono font-bold dark:text-white text-slate-900">
                {formatMoney(totalSavingContributed)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memberContributions.map(m => (
                <div key={m.id} className="flex items-center justify-between dark:bg-slate-900/80 bg-white px-3 py-1.5 rounded-lg text-xs border dark:border-slate-800 border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <span>{m.avatar}</span>
                    <span className="font-semibold dark:text-slate-200 text-slate-800">{m.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 font-mono">
                    <span className="text-purple-600 dark:text-purple-300 font-bold">{formatMoney(m.contributedKopecks)}</span>
                    <span className="text-[10px] dark:text-slate-400 text-slate-600 dark:bg-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                      {m.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Savings Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savingsGoals.map((goal) => {
            const goalPercent = Math.min(100, Math.round((goal.currentKopecks / goal.targetKopecks) * 100));
            const isTopUpOpen = quickTopUpGoalId === goal.id;
            const isWithdrawOpen = withdrawGoalId === goal.id;
            
            // Monthly interest preview
            const monthlyInterestPreviewKopecks = goal.interestRate 
              ? Math.round((goal.currentKopecks * (goal.interestRate / 100)) / 12) 
              : 0;

            return (
              <div
                key={goal.id}
                className="p-4 rounded-2xl border dark:border-slate-800 border-slate-200/80 dark:bg-slate-950/90 bg-slate-50/80 hover:border-purple-400 dark:hover:border-purple-500/50 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-10 h-10 rounded-xl dark:bg-purple-500/15 bg-purple-100 dark:border-purple-500/30 border border-purple-200 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        {goal.icon === 'Shield' && <Shield className="w-5 h-5" />}
                        {goal.icon === 'Plane' && <Plane className="w-5 h-5" />}
                        {goal.icon === 'Car' && <Car className="w-5 h-5" />}
                        {goal.icon !== 'Shield' && goal.icon !== 'Plane' && goal.icon !== 'Car' && (
                          <PiggyBank className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm dark:text-white text-slate-900">{goal.name}</h4>
                        <p className="text-[11px] dark:text-slate-400 text-slate-500 font-mono">{goal.bankName}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-1">
                      {goal.interestRate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-emerald-500/15 bg-emerald-100 text-emerald-700 dark:text-emerald-400 border dark:border-emerald-500/20 border-emerald-300 font-mono">
                          {goal.interestRate}% APY
                        </span>
                      )}
                      {onDeleteSavingGoal && (
                        <button
                          onClick={() => onDeleteSavingGoal(goal.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded transition"
                          title="Удалить цель"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-xs dark:text-slate-400 text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                      {goal.description}
                    </p>
                  )}

                  {/* Progress & Target */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="dark:text-white text-slate-900 font-bold">{formatMoney(goal.currentKopecks)}</span>
                      <span className="dark:text-slate-400 text-slate-500">из {formatMoney(goal.targetKopecks)}</span>
                    </div>
                    <div className="h-2.5 w-full dark:bg-slate-900 bg-slate-200 rounded-full overflow-hidden border dark:border-slate-800 border-slate-300">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${goalPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] dark:text-slate-400 text-slate-500 font-mono">
                      <span>Прогресс: <strong className="dark:text-purple-300 text-purple-700">{goalPercent}%</strong></span>
                      {goal.monthlyPlanKopecks && (
                        <span>План: +{formatMoney(goal.monthlyPlanKopecks)}/мес</span>
                      )}
                    </div>
                  </div>

                  {/* High Yield Capitalization Widget */}
                  {goal.interestRate && monthlyInterestPreviewKopecks > 0 && (
                    <div className="mt-3.5 p-2.5 dark:bg-emerald-950/30 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="text-[10px]">
                        <p className="dark:text-emerald-400 text-emerald-700 font-semibold flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          Начисление %:
                        </p>
                        <p className="dark:text-white text-slate-900 font-mono font-bold">
                          +{formatMoney(monthlyInterestPreviewKopecks)} / мес
                        </p>
                      </div>
                      <button
                        onClick={() => handleCapitalizeInterest(goal)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition active:scale-95 shadow-xs flex items-center gap-1"
                        title="Начислить проценты на баланс вклада"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Начислить</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Controls Area */}
                <div className="mt-4 pt-3 border-t dark:border-slate-800/80 border-slate-200 space-y-2">
                  {/* Top up flow */}
                  {isTopUpOpen ? (
                    <div className="space-y-2 dark:bg-slate-900 bg-white p-2.5 rounded-xl border border-purple-500/40 shadow-xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[11px] dark:text-slate-300 text-slate-700 mb-1">
                        <span>Пополнение от:</span>
                        <select
                          value={selectedMemberId}
                          onChange={(e) => setSelectedMemberId(e.target.value)}
                          className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded px-2 py-0.5 text-[10px] dark:text-white text-slate-900"
                        >
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          value={topUpAmountRubles}
                          onChange={(e) => setTopUpAmountRubles(e.target.value)}
                          placeholder="Сумма (₽)"
                          className="w-full px-2.5 py-1.5 dark:bg-slate-950 bg-slate-50 border border-purple-500/50 rounded-lg text-xs dark:text-white text-slate-900 font-mono focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleQuickTopUp(goal.id)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition whitespace-nowrap shadow-xs"
                        >
                          В копилку
                        </button>
                      </div>

                      {/* Quick chips */}
                      <div className="flex items-center justify-around gap-1 pt-1">
                        {['1000', '5000', '10000', '25000'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setTopUpAmountRubles(val)}
                            className="text-[10px] px-2 py-0.5 dark:bg-slate-950 bg-slate-100 dark:text-slate-300 text-slate-700 hover:text-purple-600 dark:hover:text-purple-300 rounded border dark:border-slate-800 border-slate-200"
                          >
                            +{parseInt(val)/1000}k
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setQuickTopUpGoalId(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 block text-center w-full pt-1"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : isWithdrawOpen ? (
                    <div className="space-y-2 dark:bg-slate-900 bg-white p-2.5 rounded-xl border border-rose-500/40 shadow-xs animate-in fade-in duration-150">
                      <p className="text-[10px] text-rose-500 dark:text-rose-300 font-semibold">Снятие средств в свободный бюджет:</p>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          value={withdrawAmountRubles}
                          onChange={(e) => setWithdrawAmountRubles(e.target.value)}
                          placeholder="Сумма (₽)"
                          className="w-full px-2.5 py-1.5 dark:bg-slate-950 bg-slate-50 border border-rose-500/50 rounded-lg text-xs dark:text-white text-slate-900 font-mono focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleWithdraw(goal.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition whitespace-nowrap shadow-xs"
                        >
                          Снять
                        </button>
                      </div>
                      <button
                        onClick={() => setWithdrawGoalId(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 block text-center w-full"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setQuickTopUpGoalId(goal.id);
                          setWithdrawGoalId(null);
                          setTopUpAmountRubles('5000');
                        }}
                        className="flex-1 py-2 dark:bg-purple-950/50 bg-purple-50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border dark:border-purple-500/30 border-purple-200 text-purple-700 dark:text-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-98 shadow-xs"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Пополнить</span>
                      </button>

                      <button
                        onClick={() => {
                          setWithdrawGoalId(goal.id);
                          setQuickTopUpGoalId(null);
                          setWithdrawAmountRubles('5000');
                        }}
                        className="p-2 dark:bg-slate-900 bg-slate-100 dark:hover:bg-slate-800 hover:bg-slate-200 border dark:border-slate-800 border-slate-200 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-xl text-xs transition"
                        title="Снять средства из цели"
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Goal Modal */}
      <AddSavingGoalModal
        isOpen={isAddGoalModalOpen}
        onClose={() => setIsAddGoalModalOpen(false)}
        familyId={familyId}
        onAddGoal={(goal) => {
          if (onAddSavingGoal) onAddSavingGoal(goal);
        }}
      />
    </div>
  );
};
