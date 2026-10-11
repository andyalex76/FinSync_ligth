import React, { useState } from 'react';
import { X, Check, Trash2, PiggyBank } from 'lucide-react';
import { Transaction, Category, FamilyMember, SavingsGoal } from '../types';
import { rublesToKopecks, kopecksToRubles } from '../utils/money';
import { CategoryIconSelector } from './CategoryIcon';
import { useModalA11y } from '../hooks/useModalA11y';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  categories: Category[];
  members: FamilyMember[];
  savingsGoals?: SavingsGoal[];
  onUpdateTransaction?: (updated: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onSave?: (updated: Transaction) => void;
  onDelete?: (id: string) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  categories,
  members,
  savingsGoals = [],
  onUpdateTransaction,
  onDeleteTransaction,
  onSave,
  onDelete,
}) => {
  const handleUpdate = onUpdateTransaction || onSave;
  const handleDeleteAction = onDeleteTransaction || onDelete;

  const [type, setType] = useState<'expense' | 'income' | 'transfer' | 'saving'>(transaction?.type || 'expense');
  const [amountStr, setAmountStr] = useState<string>(
    transaction ? kopecksToRubles(transaction.amountKopecks).toFixed(2) : '0'
  );
  const [categoryId, setCategoryId] = useState<string>(transaction?.categoryId || '');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => {
    const found = savingsGoals.find((g) => g.name === transaction?.subCategory);
    return found?.id || savingsGoals[0]?.id || '';
  });
  const [paidByMemberId, setPaidByMemberId] = useState<string>(transaction?.paidByMemberId || '');
  const [description, setDescription] = useState<string>(transaction?.description || '');
  const [date, setDate] = useState<string>(transaction?.date || '');
  const [tagInput, setTagInput] = useState<string>((transaction?.tags || []).join(', '));
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  const { modalRef } = useModalA11y({
    isOpen: isOpen && !!transaction,
    onClose,
  });

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rubles = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(rubles) || rubles <= 0) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    const chosenGoal = savingsGoals.find((g) => g.id === selectedGoalId);

    const updated: Transaction = {
      ...transaction,
      type,
      amountKopecks: rublesToKopecks(rubles),
      categoryId: type === 'transfer' ? 'cat-transfer' : type === 'saving' ? 'cat-savings' : categoryId,
      subCategory: type === 'saving' && chosenGoal ? chosenGoal.name : transaction.subCategory,
      paidByMemberId,
      description: description.trim() || (type === 'expense' ? 'Расход' : type === 'income' ? 'Доход' : type === 'saving' ? (chosenGoal ? `В копилку: ${chosenGoal.name}` : 'Отчисление в накопления') : 'Перевод'),
      date,
      tags: type === 'saving' ? Array.from(new Set([...tags, 'копилка', 'накопления'])) : tags,
    };

    handleUpdate?.(updated);
    onClose();
  };

  const handleDelete = () => {
    handleDeleteAction?.(transaction.id);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-transaction-modal-title"
        tabIndex={-1}
        className="dark:bg-[#020617] bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-3xl border-t sm:border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200 dark:text-white text-slate-900 outline-none"
      >
        {/* iOS Pull indicator */}
        <div className="w-12 h-1.5 dark:bg-slate-700/80 bg-slate-300 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-4 py-3 sm:p-5 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 id="edit-transaction-modal-title" className="font-bold text-base sm:text-lg dark:text-white text-slate-900">Редактирование операции</h3>
            <span className="text-[10px] dark:text-slate-400 text-slate-500 font-mono">ID: {transaction.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно редактирования операции"
            className="w-8 h-8 flex items-center justify-center dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
        >
          {/* Type Selector */}
          <div className="grid grid-cols-4 gap-1 p-1 dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 rounded-lg transition-colors ${
                type === 'expense' ? 'bg-rose-600 text-white shadow-xs' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 rounded-lg transition-colors ${
                type === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              Доход
            </button>
            <button
              type="button"
              onClick={() => setType('saving')}
              className={`py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 ${
                type === 'saving' ? 'bg-purple-600 text-white shadow-xs' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Копилка</span>
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`py-2 rounded-lg transition-colors ${
                type === 'transfer' ? 'bg-sky-600 text-white shadow-xs' : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              Перевод
            </button>
          </div>

          {/* Savings Notice & Goal Chooser */}
          {type === 'saving' && (
            <div className="p-3 dark:bg-purple-950/40 bg-purple-50 border dark:border-purple-500/30 border-purple-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs dark:text-purple-300 text-purple-800 font-medium">
                <span className="flex items-center space-x-1.5">
                  <PiggyBank className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Цель накопления:</span>
                </span>
              </div>

              {savingsGoals.length > 0 && (
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full p-2 dark:bg-slate-950 bg-white border dark:border-purple-500/40 border-purple-200 rounded-xl text-sm dark:text-white text-slate-900 focus:outline-none dark:focus:border-purple-400 focus:border-purple-500"
                >
                  {savingsGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — {g.bankName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 mb-1.5">
              Сумма в рублях:
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                className="w-full text-2xl sm:text-3xl font-bold font-mono py-2.5 px-3.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl dark:text-white text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold dark:text-slate-500 text-slate-400">
                ₽
              </span>
            </div>
          </div>

          {/* Category Selector */}
          {(type === 'expense' || type === 'income') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">
                  Категория:
                </label>
                <span className="text-[11px] dark:text-blue-400 text-blue-600 font-mono font-medium">
                  {categories.find((c) => c.id === categoryId)?.name}
                </span>
              </div>
              <CategoryIconSelector
                categories={categories}
                selectedCategoryId={categoryId}
                onSelect={(id) => setCategoryId(id)}
              />
            </div>
          )}

          {/* Paid by Member */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 mb-1.5">
              {type === 'income' ? 'Кто получил:' : type === 'saving' ? 'Кто отложил:' : 'Кто оплатил:'}
            </label>
            <select
              value={paidByMemberId}
              onChange={(e) => setPaidByMemberId(e.target.value)}
              className="w-full p-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-base sm:text-sm dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.avatar} {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 mb-1.5">
              Назначение / Описание:
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-base sm:text-sm dark:text-white text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Date & Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 mb-1.5">
                Дата:
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-base sm:text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 mb-1.5">
                Теги:
              </label>
              <input
                type="text"
                placeholder="#еда, #авто"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full p-2 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-base sm:text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 dark:placeholder:text-slate-600 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center gap-2.5">
            {!showConfirmDelete ? (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="p-3 dark:bg-rose-950/40 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border dark:border-rose-800/60 border-rose-200 text-rose-600 dark:text-rose-300 rounded-xl transition active:scale-95 flex items-center justify-center"
                title="Удалить операцию"
              >
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shrink-0"
              >
                <span>Точно удалить?</span>
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition text-sm flex items-center justify-center space-x-2 active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить изменения</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;
