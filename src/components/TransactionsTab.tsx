import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Search, 
  Filter, 
  Receipt, 
  Check, 
  X, 
  ArrowDownRight, 
  ArrowLeftRight,
  LayoutGrid,
  FileSpreadsheet,
  PiggyBank,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { Transaction, Category, FamilyMember, PeriodFilter } from '../types';
import { formatMoney } from '../utils/money';
import { CategoryIcon, CategoryIconBadge, getCategoryIconComponent, CATEGORY_STYLE_CONFIG } from './CategoryIcon';
import { exportTransactionsToCSV } from '../utils/exportImport';

interface TransactionsTabProps {
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
  onConfirmDraft: (draftId: string) => void;
  onRejectDraft: (draftId: string) => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  categories,
  members,
  onConfirmDraft,
  onRejectDraft,
}) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'saving' | 'transfer' | 'drafts'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('current_month');

  const parentRef = useRef<HTMLDivElement>(null);

  // Period filtering logic
  const now = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(() => {
    const raw = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [now]);
  const prevMonthLabel = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const raw = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [now]);
  const currentYearLabel = useMemo(() => {
    return `${now.getFullYear()} год`;
  }, [now]);

  const periodFiltered = useMemo(() => {
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const prevMonth = (nowMonth - 1 + 12) % 12;
    const prevMonthYear = nowMonth === 0 ? nowYear - 1 : nowYear;
    const currentQuarter = Math.floor(nowMonth / 3);

    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      if (periodFilter === 'current_month') {
        return txYear === nowYear && txMonth === nowMonth;
      }
      if (periodFilter === 'prev_month') {
        return txYear === prevMonthYear && txMonth === prevMonth;
      }
      if (periodFilter === 'quarter') {
        return txYear === nowYear && Math.floor(txMonth / 3) === currentQuarter;
      }
      if (periodFilter === 'year') {
        return txYear === nowYear;
      }
      return true; // 'all'
    });
  }, [transactions, periodFilter, now]);

  // Combined filtering
  const filtered = useMemo(() => {
    return periodFiltered.filter((tx) => {
      // Status filter
      if (filterType === 'drafts') {
        if (tx.status === 'confirmed') return false;
      } else if (filterType !== 'all') {
        if (tx.type !== filterType) return false;
      }

      // Member filter
      if (selectedMemberId !== 'all' && tx.paidByMemberId !== selectedMemberId) {
        return false;
      }

      // Category filter
      if (selectedCategoryId !== 'all' && tx.categoryId !== selectedCategoryId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const cat = categories.find((c) => c.id === tx.categoryId);
        const matchCat = cat?.name.toLowerCase().includes(q);
        const matchTags = tx.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchDesc && !matchCat && !matchTags) return false;
      }

      return true;
    });
  }, [periodFiltered, filterType, selectedMemberId, selectedCategoryId, searchQuery, categories]);

  // Stats for filtered set
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((t) => {
      if (t.status === 'confirmed') {
        if (t.type === 'income') income += t.amountKopecks;
        if (t.type === 'expense') expense += t.amountKopecks;
      }
    });
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Period Selector & Quick Export Bar */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setPeriodFilter('current_month')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              periodFilter === 'current_month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {currentMonthLabel}
          </button>
          <button
            onClick={() => setPeriodFilter('prev_month')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              periodFilter === 'prev_month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {prevMonthLabel}
          </button>
          <button
            onClick={() => setPeriodFilter('quarter')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              periodFilter === 'quarter'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            Квартал
          </button>
          <button
            onClick={() => setPeriodFilter('year')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              periodFilter === 'year'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {currentYearLabel}
          </button>
          <button
            onClick={() => setPeriodFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
              periodFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            Все время
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end space-x-2">
          <div className="text-right sm:pr-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
              Траты за период:
            </span>
            <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
              -{formatMoney(stats.expense)}
            </span>
          </div>

          <button
            onClick={() => exportTransactionsToCSV(filtered, categories, members)}
            title="Экспорт отфильтрованных строк в CSV"
            className="px-2.5 py-1.5 rounded-xl border dark:border-slate-700/80 border-slate-200 dark:bg-slate-800/60 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-200 text-slate-700 text-xs font-medium flex items-center space-x-1.5 transition active:scale-95 shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('transactions.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-base sm:text-sm dark:bg-slate-950/80 bg-slate-50 border dark:border-slate-800/80 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Member Selector */}
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="px-3 py-2 text-base sm:text-sm dark:bg-slate-950/80 bg-slate-50 border dark:border-slate-800/80 border-slate-200 rounded-xl dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('common.allMembers')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {t('types.all')} ({periodFiltered.length})
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'expense'
                ? 'bg-rose-600 text-white'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {t('types.expense')}
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'income'
                ? 'bg-emerald-600 text-white'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {t('types.income')}
          </button>
          <button
            onClick={() => setFilterType('saving')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1 ${
              filterType === 'saving'
                ? 'bg-purple-600 text-white'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>{t('types.saving')} ({periodFiltered.filter((t) => t.type === 'saving').length})</span>
          </button>
          <button
            onClick={() => setFilterType('transfer')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'transfer'
                ? 'bg-sky-600 text-white'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 border dark:border-slate-800 border-slate-200'
            }`}
          >
            {t('types.transfer')}
          </button>
          <button
            onClick={() => setFilterType('drafts')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'drafts'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                : 'dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/25 border-amber-200'
            }`}
          >
            {t('types.draft')} ({periodFiltered.filter((t) => t.status !== 'confirmed').length})
          </button>
        </div>

        {/* Category Icons Quick Filter */}
        <div className="pt-2 border-t dark:border-slate-800/80 border-slate-200 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            Значки категорий:
          </span>

          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            title="Все категории"
            className={`p-2 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-500/40 ring-1 ring-blue-500 shadow-sm'
                : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:border-slate-800 border-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {categories.filter((c) => c.id !== 'cat-transfer').map((c) => {
            const IconComp = getCategoryIconComponent(c.icon, c.id);
            const isSelected = selectedCategoryId === c.id;
            const style = CATEGORY_STYLE_CONFIG[c.id] || {
              bg: 'bg-slate-100 dark:bg-slate-800',
              text: 'text-slate-700 dark:text-slate-300',
              border: 'border-slate-200 dark:border-slate-700',
            };

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(isSelected ? 'all' : c.id)}
                title={c.name}
                className={`p-2 rounded-xl border flex items-center space-x-1.5 transition-all shrink-0 ${
                  isSelected
                    ? `${style.bg} ${style.text} ${style.border} ring-2 ring-blue-500 shadow-md`
                    : 'dark:bg-slate-950/60 bg-slate-100 dark:text-slate-400 text-slate-600 dark:border-slate-800 border-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <IconComp className="w-4 h-4" />
                {isSelected && (
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {c.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transactions List with Windowing / Virtualized slicing */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Filter className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium dark:text-slate-300 text-slate-700">
              {transactions.length === 0 ? 'Список операций пуст (Чистый лист)' : 'Операции не найдены'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {transactions.length === 0 
                ? 'База данных готова к тестированию! Создайте первую операцию через «+ Добавить», отсканируйте чек или пришлите данные боту.'
                : 'Попробуйте изменить период или параметры фильтров'}
            </p>
          </div>
        ) : (
          <>
            <div
              ref={parentRef}
              className="max-h-[640px] overflow-y-auto"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const tx = filtered[virtualRow.index];
                  if (!tx) return null;

                  const member = members.find((m) => m.id === tx.paidByMemberId);
                  const category = categories.find((c) => c.id === tx.categoryId);
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isSaving = tx.type === 'saving';
                  const isTransfer = tx.type === 'transfer';
                  const isDraft = tx.status !== 'confirmed';

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className={`p-3.5 sm:p-4 transition-colors border-b dark:border-slate-800/60 border-slate-100 ${
                        isDraft 
                          ? 'dark:bg-amber-950/20 bg-amber-50/60' 
                          : 'dark:bg-slate-900/40 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 min-w-0">
                          {isDraft ? (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 border dark:bg-amber-500/20 bg-amber-100 text-amber-700 dark:text-amber-400 dark:border-amber-500/30 border-amber-200">
                              <Receipt className="w-4 h-4" />
                            </div>
                          ) : isIncome ? (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 border dark:bg-emerald-500/10 bg-emerald-50 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/20 border-emerald-200">
                              <ArrowDownRight className="w-4 h-4" />
                            </div>
                          ) : isSaving ? (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 border dark:bg-purple-500/15 bg-purple-50 text-purple-600 dark:text-purple-400 dark:border-purple-500/30 border-purple-200 shadow-xs">
                              <PiggyBank className="w-4 h-4" />
                            </div>
                          ) : isTransfer ? (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 border dark:bg-sky-500/10 bg-sky-50 text-sky-600 dark:text-sky-400 dark:border-sky-500/20 border-sky-200">
                              <ArrowLeftRight className="w-4 h-4" />
                            </div>
                          ) : (
                            <CategoryIcon category={category} size="md" className="mt-0.5" />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-sm dark:text-white text-slate-900 truncate">
                                {tx.description}
                              </h4>
                              {isDraft && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded dark:bg-amber-500/20 bg-amber-100 text-amber-700 dark:text-amber-300 border dark:border-amber-500/30 border-amber-200 uppercase tracking-wider shrink-0">
                                  Черновик OCR
                                </span>
                              )}
                              {tx.syncStatus === 'pending' && (
                                <span
                                  title="Операция сохранена локально и ожидает автоматической синхронизации с сервером"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded dark:bg-amber-500/15 bg-amber-50 text-amber-600 dark:text-amber-400 border dark:border-amber-500/30 border-amber-200 shrink-0"
                                >
                                  <CloudOff className="w-2.5 h-2.5" />
                                  В буфере
                                </span>
                              )}
                              {tx.syncStatus === 'syncing' && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded dark:bg-blue-500/15 bg-blue-50 text-blue-600 dark:text-blue-400 border dark:border-blue-500/30 border-blue-200 shrink-0"
                                >
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                  Синхронизация...
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-xs dark:text-slate-400 text-slate-500">
                              <span className="font-mono">{tx.date}</span>
                              <span className="text-slate-400 dark:text-slate-600">•</span>
                              <CategoryIconBadge category={category} showLabel={true} />
                              <span className="text-slate-400 dark:text-slate-600">•</span>
                              <span className="inline-flex items-center">
                                <span className="mr-1">{member?.avatar}</span>
                                {member?.name}
                              </span>
                            </div>

                            {tx.tags && tx.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tx.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-600 font-mono border dark:border-slate-700/60 border-slate-200"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="text-right shrink-0">
                          <p
                            className={`font-mono font-bold text-sm sm:text-base ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isExpense
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isIncome ? '+' : isExpense ? '-' : ''}
                            {formatMoney(tx.amountKopecks, tx.currency)}
                          </p>

                          {isDraft ? (
                            <div 
                              className="flex items-center justify-end space-x-1.5 mt-2" 
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => onRejectDraft(tx.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Отклонить"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onConfirmDraft(tx.id)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-500/25 transition-colors flex items-center space-x-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Принять</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* List footer */}
            <div className="px-4 py-2.5 dark:bg-slate-950/60 bg-slate-50 border-t dark:border-slate-800/80 border-slate-200 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{t('transactions.totalCount', { count: filtered.length })}</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('transactions.virtualizationActive')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
