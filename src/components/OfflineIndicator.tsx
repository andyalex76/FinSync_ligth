import React from 'react';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload, X } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    recentNotification,
    clearNotification,
    syncNow,
  } = useBackgroundSync();

  // If online, not syncing, no pending items and no notification, don't show floating pill
  if (isOnline && !isSyncing && pendingCount === 0 && !recentNotification) {
    return null;
  }

  // 1. Reconnection / Sync in progress notification
  if (isSyncing) {
    return (
      <div
        id="bg-sync-in-progress"
        className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom duration-200 border border-blue-400/30 backdrop-blur-md"
      >
        <RefreshCw className="w-4 h-4 text-white shrink-0 animate-spin" />
        <div className="flex flex-col">
          <span>Автоматическая фоновая синхронизация...</span>
          {pendingCount > 0 && (
            <span className="text-[10px] font-normal text-blue-100">
              Отправка {pendingCount} {pendingCount === 1 ? 'операции' : 'операций'} на сервер
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. Success toast after reconnection sync
  if (recentNotification?.type === 'success') {
    return (
      <div
        id="bg-sync-success-toast"
        className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom duration-200 border border-emerald-400/30"
      >
        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
        <span>{recentNotification.message}</span>
        <button
          type="button"
          onClick={clearNotification}
          className="ml-2 text-emerald-200 hover:text-white p-0.5 rounded transition-colors"
          title="Закрыть"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 3. Offline indicator with local buffer details
  if (!isOnline) {
    return (
      <div
        id="bg-sync-offline-banner"
        className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-3 rounded-xl bg-amber-600 px-3.5 py-2.5 text-xs font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom duration-200 border border-amber-400/40"
      >
        <WifiOff className="w-4 h-4 text-white shrink-0 animate-pulse" />
        <div className="flex flex-col">
          <span className="font-semibold">Офлайн-режим</span>
          <span className="text-[11px] text-amber-100">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? 'операция' : pendingCount < 5 ? 'операции' : 'операций'} в буфере • отправятся при подключении`
              : 'Данные сохраняются в локальный кэш'}
          </span>
        </div>
      </div>
    );
  }

  // 4. Online but there are pending items waiting for sync
  if (isOnline && pendingCount > 0) {
    return (
      <div
        id="bg-sync-pending-banner"
        className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-3 rounded-xl bg-slate-800 text-white px-3.5 py-2.5 text-xs font-medium shadow-2xl border border-slate-700 animate-in fade-in"
      >
        <CloudUpload className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
        <div className="flex flex-col">
          <span>В буфере: {pendingCount} {pendingCount === 1 ? 'операция' : 'операций'}</span>
          <span className="text-[10px] text-slate-300">Ожидание отправки на сервер...</span>
        </div>
        <button
          type="button"
          onClick={() => syncNow()}
          className="ml-2 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold tracking-wide uppercase transition-colors"
        >
          Отправить
        </button>
      </div>
    );
  }

  return null;
};

