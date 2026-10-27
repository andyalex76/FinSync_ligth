import React, { Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { BudgetsTab } from './components/BudgetsTab';
import { TransactionsTab } from './components/TransactionsTab';
import { MembersTab } from './components/MembersTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TelegramMiniAppView } from './components/TelegramMiniAppView';
import { TelegramConnectModal } from './components/TelegramConnectModal';
import { StorageService } from './utils/storage';
import { FamilyProvider, useFamily } from './context/FamilyContext';
import { useTelegramWebApp } from './hooks/useTelegramWebApp';
import { 
  LayoutDashboard, 
  PiggyBank, 
  Receipt, 
  Users, 
  Bot,
  RefreshCw,
  CloudUpload,
  Loader2
} from 'lucide-react';

// Lazy loaded modals to minimize initial bundle size
const FamilySetupWizard = React.lazy(() => import('./components/FamilySetupWizard'));

function Spinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs">
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        <span>Загрузка...</span>
      </div>
    </div>
  );
}

function FamilyAppContent() {
  const { t } = useTranslation();
  const { isInsideTelegram, forceTmaPreview, setForceTmaPreview } = useTelegramWebApp();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const {
    state,
    forecast,
    pendingDraftsCount,
    syncInfo,
    handleCompleteSetup,
    handleConfirmDraft,
    handleRejectDraft,
    handleUpdateBudgetLimit,
    handleAddMemberTransfer,
    handleAddSavingGoal,
    handleDeleteSavingGoal,
    handleDepositSavingGoal,
    handleWithdrawSavingGoal,
    openSetupWizard,
    closeSetupWizard,
    setActiveTab,
    toggleTheme,
  } = useFamily();

  const { isOnline, isSyncing, pendingCount, syncNow } = syncInfo;

  const handleManualSync = useCallback(() => {
    syncNow();
  }, [syncNow]);

  const handleViewAllTransactions = useCallback(() => {
    setActiveTab('transactions');
  }, [setActiveTab]);

  const handleNavigateToSavings = useCallback(() => {
    setActiveTab('budgets');
  }, [setActiveTab]);

  const handleSelectOverviewTab = useCallback(() => {
    setActiveTab('overview');
  }, [setActiveTab]);

  const handleSelectBudgetsTab = useCallback(() => {
    setActiveTab('budgets');
  }, [setActiveTab]);

  const handleSelectTransactionsTab = useCallback(() => {
    setActiveTab('transactions');
  }, [setActiveTab]);

  const handleSelectMembersTab = useCallback(() => {
    setActiveTab('members');
  }, [setActiveTab]);

  // If inside Telegram WebApp or previewing Mini App mode:
  if (isInsideTelegram) {
    return (
      <TelegramMiniAppView
        onBackToDashboard={forceTmaPreview ? () => setForceTmaPreview(false) : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen dark:bg-[#020617] bg-slate-50 dark:text-slate-200 text-slate-800 flex flex-col font-sans transition-colors selection:bg-blue-600/30 selection:text-blue-300">
      {/* PWA Offline Awareness Bar */}
      <OfflineIndicator />

      {/* Top App Header with Read-Only Top Bar Contract */}
      <Header
        family={state.family}
        members={state.members}
        activeTab={state.activeTab}
        setActiveTab={setActiveTab}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSetupWizard={openSetupWizard}
        isDark={state.isDark}
        onToggleTheme={toggleTheme}
        pendingDraftsCount={pendingDraftsCount}
      />

      {/* Sleek Top Status Bar with Background Sync status */}
      <div className="dark:bg-slate-900/40 bg-slate-200/50 border-b dark:border-slate-800/40 border-slate-200 px-4 py-1.5 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] dark:text-slate-400 text-slate-600">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span
              className={`font-semibold ${
                isOnline
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isOnline ? 'Статус табло: Онлайн' : 'Офлайн-режим (Кэш табло)'}
            </span>
            <span className="dark:text-slate-700 text-slate-300">•</span>
            <span className="text-slate-500 dark:text-slate-400">
              Ввод данных: Telegram-бот и Mini App • Дашборд: Мониторинг в реальном времени
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
            {isSyncing ? (
              <span className="inline-flex items-center gap-1.5 text-blue-500 dark:text-blue-400 font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Синхронизация с сервером...
              </span>
            ) : pendingCount > 0 && isOnline ? (
              <button
                type="button"
                onClick={handleManualSync}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                <CloudUpload className="w-3 h-3 animate-bounce" />
                Отправить сейчас ({pendingCount})
              </button>
            ) : (
              <span>Данные актуальны</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area (Read-Only Financial HUD) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {state.activeTab === 'overview' && (
          <OverviewTab
            family={state.family}
            transactions={state.transactions}
            categories={state.categories}
            members={state.members}
            budgets={state.budgets}
            forecast={forecast}
            savingsGoals={state.savingsGoals}
            isDark={state.isDark}
            onConfirmDraft={handleConfirmDraft}
            onRejectDraft={handleRejectDraft}
            onViewAllTransactions={handleViewAllTransactions}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenMiniAppPreview={() => setForceTmaPreview(true)}
            onNavigateToSavings={handleNavigateToSavings}
          />
        )}

        {state.activeTab === 'budgets' && (
          <BudgetsTab
            budgets={state.budgets}
            categories={state.categories}
            transactions={state.transactions}
            savingsGoals={state.savingsGoals}
            members={state.members}
            familyId={state.family.id}
            onUpdateBudgetLimit={handleUpdateBudgetLimit}
            onDepositSavingGoal={handleDepositSavingGoal}
            onWithdrawSavingGoal={handleWithdrawSavingGoal}
            onAddSavingGoal={handleAddSavingGoal}
            onDeleteSavingGoal={handleDeleteSavingGoal}
          />
        )}

        {state.activeTab === 'transactions' && (
          <TransactionsTab
            transactions={state.transactions}
            categories={state.categories}
            members={state.members}
            onConfirmDraft={handleConfirmDraft}
            onRejectDraft={handleRejectDraft}
          />
        )}

        {state.activeTab === 'members' && (
          <MembersTab
            family={state.family}
            members={state.members}
            onAddMemberTransfer={handleAddMemberTransfer}
            onOpenSetupWizard={openSetupWizard}
          />
        )}
      </main>

      {/* Mobile Floating Bottom Bar (iPhone Dock with safe areas) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 dark:bg-slate-950/90 bg-white/95 backdrop-blur-md dark:border-slate-800 border-slate-200 border-t h-16 flex items-center justify-around px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)]">
        <button
          type="button"
          onClick={handleSelectOverviewTab}
          className={`flex flex-col items-center gap-1 transition-colors ${
            state.activeTab === 'overview' ? 'text-blue-600' : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-700'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.overview')}</span>
        </button>

        <button
          type="button"
          onClick={handleSelectBudgetsTab}
          className={`flex flex-col items-center gap-1 transition-colors ${
            state.activeTab === 'budgets' ? 'text-blue-600' : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-700'
          }`}
        >
          <PiggyBank className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.budgets')}</span>
        </button>

        {/* Center Telegram Action Button for quick instructions / mobile open */}
        <button
          type="button"
          onClick={() => setIsConnectModalOpen(true)}
          className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/40 -translate-y-3.5 border-4 dark:border-slate-950 border-white active:scale-95 transition-transform"
          title="Открыть Telegram бота"
        >
          <Bot className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={handleSelectTransactionsTab}
          className={`relative flex flex-col items-center gap-1 transition-colors ${
            state.activeTab === 'transactions' ? 'text-blue-600' : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-700'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.transactions')}</span>
          {pendingDraftsCount > 0 && (
            <span className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={handleSelectMembersTab}
          className={`flex flex-col items-center gap-1 transition-colors ${
            state.activeTab === 'members' ? 'text-blue-600' : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-700'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.members')}</span>
        </button>
      </div>

      {/* Telegram Connect Modal */}
      <TelegramConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        family={state.family}
        onOpenMiniAppPreview={() => setForceTmaPreview(true)}
      />

      {/* Lazy Loaded Modals wrapped in Suspense with Spinner */}
      <Suspense fallback={<Spinner />}>
        {state.isSetupWizardOpen && (
          <FamilySetupWizard
            isOpen={state.isSetupWizardOpen}
            isInitialSetup={!StorageService.isConfigured()}
            onComplete={handleCompleteSetup}
            onClose={closeSetupWizard}
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <FamilyProvider>
      <FamilyAppContent />
    </FamilyProvider>
  );
}
