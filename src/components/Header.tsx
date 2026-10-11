import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Sun, Moon, Wallet, HardDriveDownload, Settings } from 'lucide-react';
import { Family, FamilyMember } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { SyncStatusBadge } from './SyncStatusBadge';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  family: Family;
  members: FamilyMember[];
  activeTab: 'overview' | 'budgets' | 'transactions' | 'members';
  setActiveTab: (tab: 'overview' | 'budgets' | 'transactions' | 'members') => void;
  onOpenConnectModal: () => void;
  onOpenBackupModal: () => void;
  onOpenSetupWizard: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  pendingDraftsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  family,
  members,
  activeTab,
  setActiveTab,
  onOpenConnectModal,
  onOpenBackupModal,
  onOpenSetupWizard,
  isDark,
  onToggleTheme,
  pendingDraftsCount,
}) => {
  const { t } = useTranslation();

  return (
    <header className="border-b dark:border-slate-800/80 border-slate-200/90 dark:bg-[#020617]/90 bg-white/95 backdrop-blur-xl sticky top-0 z-30 transition-colors pt-[env(safe-area-inset-top,0px)] shadow-xs">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-4">
          {/* Zone 1: Logo & Family identity */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={onOpenSetupWizard}
              title="Настройки семейного пространства"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0 hover:scale-105 transition active:scale-95 group"
            >
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 group-hover:hidden" />
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 hidden group-hover:block animate-spin" style={{ animationDuration: '6s' }} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={onOpenSetupWizard}
                  className="text-left group flex items-center space-x-1 truncate"
                  title="Параметры семьи и валюта"
                >
                  <h1 className="font-bold text-sm sm:text-base dark:text-white text-slate-900 leading-tight tracking-tight truncate group-hover:text-blue-500 transition-colors">
                    FinSync <span className="font-normal dark:text-slate-400 text-slate-500">| {family.name}</span>
                  </h1>
                </button>
                <div className="hidden sm:inline-block">
                  <SyncStatusBadge />
                </div>
              </div>
              <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 truncate">
                {members.length} участников • {family.currency} • Код: <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{family.inviteCode}</span>
              </p>
            </div>
          </div>

          {/* Zone 2: Center Navigation for Desktop */}
          <nav className="hidden md:flex items-center space-x-1 dark:bg-slate-900/60 bg-slate-100 border dark:border-slate-800/80 border-slate-200 p-1 rounded-xl backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              {t('nav.overview')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('budgets')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'budgets'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              {t('nav.budgets')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'transactions'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              {t('nav.transactions')}
              {pendingDraftsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                  {pendingDraftsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'members'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
              }`}
            >
              {t('nav.members')} ({members.length})
            </button>
          </nav>

          {/* Zone 3: Actions (Telegram Bot, Backup, Theme, Language) */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* PWA In-App Install prompt button */}
            <PWAInstallButton />

            {/* Data Export / Backup Modal */}
            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Экспорт и резервное копирование"
              aria-label="Экспорт и резервное копирование"
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 dark:hover:bg-slate-800/80 hover:bg-slate-100 border dark:border-slate-800/60 border-slate-200 rounded-xl transition-all active:scale-95"
            >
              <HardDriveDownload className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
              aria-label="Переключить тему"
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center dark:text-amber-400 text-slate-700 dark:hover:bg-slate-800/80 hover:bg-slate-100 border dark:border-slate-800/60 border-slate-200 rounded-xl transition-all active:scale-95"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Telegram Bot Primary CTA Button */}
            <button
              type="button"
              onClick={onOpenConnectModal}
              title="Подключить Telegram бота"
              aria-label="Подключить Telegram бота"
              className="h-9 sm:h-10 px-3 sm:px-3.5 flex items-center justify-center rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/25 transition-all active:scale-95 whitespace-nowrap"
            >
              <Bot className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Ввод через Telegram</span>
              <span className="sm:hidden">Telegram</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
