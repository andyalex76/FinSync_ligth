import React, { useState, useMemo } from 'react';
import { 
  Check, 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  Tag, 
  CheckCircle2
} from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { CategoryIcon } from './CategoryIcon';
import { rublesToKopecks, formatMoney } from '../utils/money';
import confetti from 'canvas-confetti';

interface TelegramMiniAppViewProps {
  onBackToDashboard?: () => void;
}

export const TelegramMiniAppView: React.FC<TelegramMiniAppViewProps> = ({
  onBackToDashboard,
}) => {
  const { state, handleAddTransaction, forecast } = useFamily();
  const { hapticImpact, hapticSuccess, hapticError, user: tgUser } = useTelegramWebApp();

  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    state.categories[0]?.id || 'cat-groceries'
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    state.members[0]?.id || 'm-1'
  );
  const [description, setDescription] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const selectedCategory = useMemo(() => {
    return state.categories.find((c) => c.id === selectedCategoryId) || state.categories[0];
  }, [state.categories, selectedCategoryId]);

  const selectedMember = useMemo(() => {
    return state.members.find((m) => m.id === selectedMemberId) || state.members[0];
  }, [state.members, selectedMemberId]);

  // Quick preset chips for description
  const quickDescriptions = txType === 'expense' 
    ? ['Обед', 'Кофе', 'Супермаркет', 'Такси', 'Аптека', 'Бензин'] 
    : ['Зарплата', 'Аванс', 'Перевод', 'Кэшбэк', 'Бонус'];

  // Add amount via preset chips
  const handleAddPreset = (val: number) => {
    hapticImpact('light');
    const current = parseFloat(amountStr.replace(',', '.')) || 0;
    const next = current + val;
    setAmountStr(next.toString());
  };

  const handleClear = () => {
    hapticImpact('medium');
    setAmountStr('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rubles = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(rubles) || rubles <= 0) {
      hapticError();
      return;
    }

    const cleanDesc = description.trim() || (txType === 'expense' ? selectedCategory.name : 'Доход');
    const tags = tagInput.trim() ? [tagInput.trim().replace(/^#/, '')] : [];

    try {
      handleAddTransaction({
        type: txType,
        amountKopecks: rublesToKopecks(rubles),
        currency: state.family.currency,
        categoryId: selectedCategoryId,
        paidByMemberId: selectedMemberId,
        description: cleanDesc,
        date: new Date().toISOString().split('T')[0],
        tags: tags,
      });

      hapticSuccess();
      try {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.8 },
        });
      } catch {
        // Confetti fallback
      }

      setSubmittedMessage(`Успешно записано: ${rubles} ₽ (${cleanDesc})`);
      setAmountStr('');
      setDescription('');
      setTagInput('');

      setTimeout(() => {
        setSubmittedMessage(null);
      }, 3500);
    } catch (err) {
      hapticError();
      console.error('Submit error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Mini App Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Перейти к полному дашборду"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm">FinSync</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold">
                Telegram Mini App
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {state.family.name} • {tgUser ? `Привет, ${tgUser.first_name}` : selectedMember.name}
            </p>
          </div>
        </div>

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Экран дашборда
          </button>
        )}
      </header>

      {/* Main Mini App Form Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* Quick summary strip */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Потрачено за месяц</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {formatMoney(forecast.actualSpentKopecks)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Остаток лимита</div>
            <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
              {formatMoney(Math.max(0, forecast.totalBudgetKopecks - forecast.actualSpentKopecks))}
            </div>
          </div>
        </div>

        {/* Success toast if recently added */}
        {submittedMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{submittedMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Segmented Control */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setTxType('expense');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                txType === 'expense'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Расход (-)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setTxType('income');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                txType === 'income'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Доход (+)</span>
            </button>
          </div>

          {/* Amount Large Input */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Сумма операции ({state.family.currency})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full text-3xl font-mono font-bold bg-transparent text-slate-900 dark:text-white outline-hidden placeholder:text-slate-300 dark:placeholder:text-slate-700"
              />
              {amountStr && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Сброс
                </button>
              )}
            </div>

            {/* Fast preset buttons */}
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              {[100, 500, 1000, 2500, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddPreset(val)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection Grid */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Категория
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {state.categories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setSelectedCategoryId(cat.id);
                    }}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all text-center ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <CategoryIcon category={cat} size="sm" />
                    <span className="text-[10px] font-semibold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member & Description */}
          <div className="grid grid-cols-1 gap-3">
            {/* Paid By Member */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Кто вносит (член семьи)
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {state.members.map((m) => {
                  const isSelected = m.id === selectedMemberId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        hapticImpact('light');
                        setSelectedMemberId(m.id);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 border transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>{m.avatar}</span>
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description & Quick chips */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Описание / Комментарий
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={txType === 'expense' ? 'Например: Кофе и выпечка' : 'Например: Зарплата'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              {/* Quick description tags */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickDescriptions.map((desc) => (
                  <button
                    key={desc}
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setDescription(desc);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    {desc}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Tag */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Тег (опционально)
              </label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="еда, авто, отпуск"
                  className="w-full pl-8 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={!amountStr || parseFloat(amountStr) <= 0}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 ${
              txType === 'expense'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {txType === 'expense' ? 'Записать расход' : 'Записать доход'}{' '}
              {amountStr && !isNaN(parseFloat(amountStr)) ? `(${amountStr} ₽)` : ''}
            </span>
          </button>
        </form>

        {/* Small Notice at bottom */}
        <div className="text-center pt-2 pb-6 text-[11px] text-slate-400">
          Запись сразу отправляется в общую базу семьи и синхронизируется с дашбордом
        </div>
      </main>
    </div>
  );
};

export default TelegramMiniAppView;
