import React, { useState } from 'react';
import { X, PiggyBank, Shield, Plane, Car } from 'lucide-react';
import { SavingsGoal, SavingsAccountType } from '../types';
import { rublesToKopecks } from '../utils/money';
import { useModalA11y } from '../hooks/useModalA11y';

interface AddSavingGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  onAddGoal: (goal: SavingsGoal) => void;
}

const AVAILABLE_ICONS = [
  { id: 'PiggyBank', label: 'Копилка', icon: PiggyBank },
  { id: 'Shield', label: 'Безопасность', icon: Shield },
  { id: 'Plane', label: 'Отпуск', icon: Plane },
  { id: 'Car', label: 'Авто', icon: Car },
];

const ACCOUNT_TYPES: { id: SavingsAccountType; label: string }[] = [
  { id: 'deposit', label: 'Срочный вклад' },
  { id: 'savings_account', label: 'Накопительный счет' },
  { id: 'investment', label: 'Инвестиции / Брокер' },
  { id: 'cash', label: 'Наличные' },
];

export const AddSavingGoalModal: React.FC<AddSavingGoalModalProps> = ({
  isOpen,
  onClose,
  familyId,
  onAddGoal,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetRubles, setTargetRubles] = useState('300000');
  const [initialRubles, setInitialRubles] = useState('0');
  const [monthlyPlanRubles, setMonthlyPlanRubles] = useState('15000');
  const [bankName, setBankName] = useState('Т-Банк');
  const [interestRate, setInterestRate] = useState('18.5');
  const [accountType, setAccountType] = useState<SavingsAccountType>('savings_account');
  const [selectedIcon, setSelectedIcon] = useState('PiggyBank');

  const { modalRef } = useModalA11y({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const targetKopecks = rublesToKopecks(parseFloat(targetRubles) || 0);
    const initialKopecks = rublesToKopecks(parseFloat(initialRubles) || 0);
    const monthlyPlanKopecks = rublesToKopecks(parseFloat(monthlyPlanRubles) || 0);
    const parsedInterest = parseFloat(interestRate);

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      familyId,
      name: name.trim(),
      description: description.trim() || undefined,
      targetKopecks: Math.max(100000, targetKopecks),
      currentKopecks: initialKopecks,
      currency: 'RUB',
      accountType,
      bankName: bankName.trim() || 'Банк',
      interestRate: !isNaN(parsedInterest) && parsedInterest > 0 ? parsedInterest : undefined,
      monthlyPlanKopecks: monthlyPlanKopecks > 0 ? monthlyPlanKopecks : undefined,
      icon: selectedIcon,
      color: '#8b5cf6',
      createdAt: new Date().toISOString(),
    };

    onAddGoal(newGoal);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-saving-goal-title"
        tabIndex={-1}
        className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] dark:text-white text-slate-900 outline-none"
      >
        {/* Header */}
        <div className="p-5 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between dark:bg-slate-950/50 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 dark:bg-purple-500/15 bg-purple-100 text-purple-600 dark:text-purple-400 rounded-2xl border dark:border-purple-500/30 border-purple-200">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-saving-goal-title" className="text-base font-bold dark:text-white text-slate-900">Новая цель или вклад</h2>
              <p className="text-xs dark:text-slate-400 text-slate-500">Добавление накопительного счета в семейную копилку</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления цели"
            className="p-2 dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name & Icon */}
          <div>
            <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
              Название цели
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Подушка безопасности, Отпуск в Сочи, Ремонт"
              required
              className="w-full px-3.5 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-sm dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
              Иконка
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                      isSelected
                        ? 'dark:bg-purple-600/20 bg-purple-50 border-purple-500 dark:text-purple-300 text-purple-700 shadow-xs'
                        : 'dark:bg-slate-950 bg-slate-50 dark:border-slate-800 border-slate-200 dark:text-slate-400 text-slate-600 dark:hover:border-slate-700 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-[10px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Type & Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Тип счета
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as SavingsAccountType)}
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 focus:outline-none focus:border-purple-500"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Банк / Платформа
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Т-Банк, Сбер, ВТБ..."
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Financials: Target, Initial, Interest */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Цель (₽)
              </label>
              <input
                type="number"
                value={targetRubles}
                onChange={(e) => setTargetRubles(e.target.value)}
                placeholder="500000"
                required
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Уже накоплено (₽)
              </label>
              <input
                type="number"
                value={initialRubles}
                onChange={(e) => setInitialRubles(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Ставка (% годовых)
              </label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="19.0"
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Monthly Plan & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                План в месяц (₽)
              </label>
              <input
                type="number"
                value={monthlyPlanRubles}
                onChange={(e) => setMonthlyPlanRubles(e.target.value)}
                placeholder="15000"
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wider mb-2">
                Примечание (опционально)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Не снимать до декабря..."
                className="w-full px-3 py-2.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t dark:border-slate-800 border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-800 hover:bg-slate-100 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition active:scale-95"
            >
              Создать цель
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
