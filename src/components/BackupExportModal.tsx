import React, { useRef, useState } from 'react';
import { 
  X, 
  Download, 
  UploadCloud, 
  FileSpreadsheet, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  Database, 
  ChevronRight,
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Transaction, Category, FamilyMember, Budget, Family, MerchantRule, SavingsGoal } from '../types';
import { exportTransactionsToCSV, exportFullBackupJSON, parseImportBackupJSON } from '../utils/exportImport';
import confetti from 'canvas-confetti';
import { useModalA11y } from '../hooks/useModalA11y';

interface BackupExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: Family;
  members: FamilyMember[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  merchantRules: MerchantRule[];
  savingsGoals?: SavingsGoal[];
  onRestoreData: (restored: {
    family?: Family;
    members?: FamilyMember[];
    categories?: Category[];
    budgets?: Budget[];
    transactions?: Transaction[];
    merchantRules?: MerchantRule[];
    savingsGoals?: SavingsGoal[];
  }) => void;
  onResetData: (mode: 'clean' | 'demo') => Promise<void> | void;
  onOpenArchModal?: () => void;
  onOpenSetupWizard?: () => void;
}

export const BackupExportModal: React.FC<BackupExportModalProps> = ({
  isOpen,
  onClose,
  family,
  members,
  categories,
  budgets,
  transactions,
  merchantRules,
  savingsGoals = [],
  onRestoreData,
  onResetData,
  onOpenArchModal,
  onOpenSetupWizard,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<'clean' | 'demo' | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const { modalRef } = useModalA11y({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleExportCSV = () => {
    exportTransactionsToCSV(transactions, categories, members);
    setSuccessMsg('Файл CSV успешно скачан');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleExportJSON = () => {
    exportFullBackupJSON({
      family,
      members,
      categories,
      budgets,
      transactions,
      merchantRules,
      savingsGoals,
    });
    setSuccessMsg('Полный JSON-бэкап успешно выгружен');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      const parsed = await parseImportBackupJSON(file);
      onRestoreData(parsed);
      confetti({ particleCount: 50, spread: 60 });
      setSuccessMsg(`Успешно восстановлено ${parsed.transactions?.length || 0} операций и ${parsed.members?.length || 0} участников!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при чтении файла');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteReset = async () => {
    try {
      setIsResetting(true);
      setErrorMsg(null);
      await onResetData('clean');
      confetti({ particleCount: 50, spread: 60 });
      setSuccessMsg('База данных и хранилище успешно очищены. Список операций пуст.');
      setConfirmMode(null);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при сбросе данных');
    } finally {
      setIsResetting(false);
    }
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
        aria-labelledby="backup-export-title"
        tabIndex={-1}
        className="dark:bg-[#020617] bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-3xl border-t sm:border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200 dark:text-white text-slate-900 outline-none"
      >
        {/* iOS Pull indicator */}
        <div className="w-12 h-1.5 dark:bg-slate-700/80 bg-slate-300 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-4 py-3 sm:p-5 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 id="backup-export-title" className="font-bold text-sm sm:text-base dark:text-white text-slate-900">Экспорт & Резервное копирование</h3>
              <p className="text-[10px] sm:text-xs dark:text-slate-400 text-slate-500">Локальный бэкап данных без передачи на сторону</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно резервного копирования"
            className="w-8 h-8 flex items-center justify-center dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {successMsg && (
            <div className="flex items-center gap-2 p-3 dark:bg-emerald-950/60 bg-emerald-50 border dark:border-emerald-800 border-emerald-200 dark:text-emerald-300 text-emerald-800 rounded-xl text-xs animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 dark:bg-rose-950/60 bg-rose-50 border dark:border-rose-800 border-rose-200 dark:text-rose-300 text-rose-800 rounded-xl text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Export section */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">1. Выгрузка данных</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleExportCSV}
                className="p-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 active:scale-98 transition flex items-center space-x-3 text-left shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl dark:bg-emerald-500/10 bg-emerald-100 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs dark:text-white text-slate-900">Выгрузить в Excel / CSV</p>
                  <p className="text-[10px] dark:text-slate-400 text-slate-500">Все операции с русскими названиями</p>
                </div>
              </button>

              <button
                onClick={handleExportJSON}
                className="p-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 active:scale-98 transition flex items-center space-x-3 text-left shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl dark:bg-blue-500/10 bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs dark:text-white text-slate-900">Полный JSON-бэкап</p>
                  <p className="text-[10px] dark:text-slate-400 text-slate-500">Бюджеты, участники, правила</p>
                </div>
              </button>
            </div>
          </div>

          {/* Import section */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">2. Восстановление из копии</h4>
            <label className="p-4 rounded-2xl border-2 border-dashed dark:border-slate-700/80 border-slate-300 hover:border-blue-500 dark:bg-slate-950/60 bg-slate-50/80 transition flex flex-col items-center justify-center cursor-pointer text-center">
              <UploadCloud className="w-7 h-7 text-blue-500 dark:text-blue-400 mb-1.5" />
              <p className="text-xs font-bold dark:text-white text-slate-900">Выберите или перетащите файл JSON</p>
              <p className="text-[10px] dark:text-slate-400 text-slate-500 mt-0.5">Данные восстановятся без потери формата</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Architecture & Backend Source Code Section */}
          {onOpenArchModal && (
            <div className="space-y-2.5 pt-2 border-t dark:border-slate-800/80 border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">3. Серверная архитектура и бэкенд</h4>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono dark:bg-emerald-500/10 bg-emerald-50 px-2 py-0.5 rounded-md border dark:border-emerald-500/20 border-emerald-200">Self-Hosted</span>
              </div>
              
              <button
                onClick={() => {
                  onClose();
                  onOpenArchModal();
                }}
                className="w-full p-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 dark:hover:border-slate-700 hover:border-slate-300 active:scale-98 transition flex items-center justify-between text-left group shadow-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl dark:bg-purple-500/10 bg-purple-100 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs dark:text-white text-slate-900 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      Архитектура БД & Исходный код бэкенда
                    </p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500">
                      16 таблиц PostgreSQL, FastAPI, aiogram 3 Bot, Celery OCR & Docker
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>
            </div>
          )}

          {/* Family Setup Wizard Launcher */}
          {onOpenSetupWizard && (
            <div className="space-y-2 pt-2 border-t dark:border-slate-800/80 border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">
                  4. Параметры семьи & Onboarding
                </h4>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono dark:bg-blue-500/10 bg-blue-50 px-2 py-0.5 rounded-md border dark:border-blue-500/20 border-blue-200">
                  ID: {family.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSetupWizard();
                }}
                className="w-full p-3.5 rounded-2xl border dark:border-blue-500/30 border-blue-200 dark:bg-blue-950/20 bg-blue-50/60 dark:hover:bg-blue-950/40 hover:bg-blue-50 transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-blue-700 dark:text-blue-300">
                      Мастер настройки семьи (Family Setup Wizard)
                    </p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500 truncate">
                      Перенастроить Family ID, состав участников, роли и инвайт-код
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>
            </div>
          )}

          {/* Reset section */}
          <div className="space-y-2.5 pt-2 border-t dark:border-slate-800/80 border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500">
                5. Сброс базы данных & LocalStorage
              </h4>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono dark:bg-rose-500/10 bg-rose-50 px-2 py-0.5 rounded-md border dark:border-rose-500/20 border-rose-200">
                Управление данными
              </span>
            </div>

            {confirmMode ? (
              /* High-visibility inline confirmation dialog (Bypasses iframe alert/confirm blockage) */
              <div className="p-4 rounded-2xl border dark:border-rose-800/80 border-rose-200 dark:bg-rose-950/30 bg-rose-50/70 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl dark:bg-rose-500/20 bg-rose-100 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs dark:text-rose-200 text-rose-900">
                      {confirmMode === 'clean'
                        ? 'Подтверждение: Очистить базу данных и LocalStorage?'
                        : 'Подтверждение: Восстановить демо-данные 2026?'}
                    </h5>
                    <p className="text-[11px] dark:text-rose-300/80 text-rose-800/80 mt-1 leading-relaxed">
                      {confirmMode === 'clean' ? (
                        <>
                          Будут удалены все текущие операции, чеки и черновики OCR (список станет чистым: 0 операций). Балансы участников обнулятся. Буфер фоновой синхронизации и LocalStorage браузера будут очищены. Вы сможете протестировать ввод с нуля.
                        </>
                      ) : (
                        <>
                          Текущие записи будут заменены исходным демонстрационным набором операций за сентябрь 2026 года.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => handleExecuteReset(confirmMode)}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition active:scale-98 shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Сброс данных...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Да, выполнить сброс</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setConfirmMode(null)}
                    className="py-2 px-3 rounded-xl border dark:border-slate-700 border-slate-300 dark:hover:bg-slate-800 hover:bg-slate-100 text-xs font-semibold dark:text-slate-300 text-slate-700 transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Clean Slate Button for Testing */}
                <button
                  type="button"
                  onClick={() => setConfirmMode('clean')}
                  className="p-3.5 rounded-2xl border dark:border-rose-900/50 border-rose-200 dark:bg-rose-950/20 bg-rose-50/50 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 active:scale-98 transition flex items-center space-x-3 text-left shadow-xs group"
                >
                  <div className="w-9 h-9 rounded-xl dark:bg-rose-500/20 bg-rose-100 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-rose-600 dark:text-rose-400">
                      Очистить всё (Чистый лист)
                    </p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500">
                      Удалить заглушки для честных тестов
                    </p>
                  </div>
                </button>

                {/* Restore Demo Data Button */}
                <button
                  type="button"
                  onClick={() => setConfirmMode('demo')}
                  className="p-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 active:scale-98 transition flex items-center space-x-3 text-left shadow-xs group"
                >
                  <div className="w-9 h-9 rounded-xl dark:bg-slate-800 bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs dark:text-white text-slate-900">
                      Демо-данные (2026)
                    </p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500">
                      Восстановить исходные примеры
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupExportModal;
