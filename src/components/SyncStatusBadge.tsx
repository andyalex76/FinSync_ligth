import React, { useState, useEffect } from 'react';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { Wifi, WifiOff, RefreshCw, CloudUpload } from 'lucide-react';

export const SyncStatusBadge: React.FC = () => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncNow,
    queue,
  } = useBackgroundSync();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPopoverOpen]);

  const formattedLastSync = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Только что';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        id="bg-sync-status-badge"
        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        title="Статус фоновой синхронизации PWA"
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
          !isOnline
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
            : isSyncing
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
            : pendingCount > 0
            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="font-mono font-bold">Офлайн</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded text-[10px] font-bold">
                +{pendingCount}
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
            <span>Синхронизация...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <CloudUpload className="w-3 h-3 text-purple-500 shrink-0 animate-bounce" />
            <span>В буфере: {pendingCount}</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Синхронизировано</span>
          </>
        )}
      </button>

      {/* Popover Details */}
      {isPopoverOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsPopoverOpen(false)}
          />
          <div
            id="bg-sync-popover"
            className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl dark:bg-slate-900 bg-white p-4 shadow-2xl border dark:border-slate-800 border-slate-200 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b dark:border-slate-800 border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold dark:text-white text-slate-900">
                  {isOnline ? 'Сеть активна (Online)' : 'Офлайн режим (Offline)'}
                </span>
              </div>
              <span className="text-[10px] font-mono dark:text-slate-400 text-slate-500">
                PWA Sync
              </span>
            </div>

            <div className="py-3 space-y-2 text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Буфер операций:</span>
                <span className="font-mono font-bold dark:text-white text-slate-900">
                  {pendingCount} {pendingCount === 1 ? 'запись' : pendingCount < 5 ? 'записи' : 'записей'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Последняя синхронизация:</span>
                <span className="font-mono font-medium dark:text-slate-300 text-slate-700">
                  {formattedLastSync}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed dark:text-slate-400 text-slate-500 pt-1">
                Все расходы и доходы, внесенные без интернета, сохраняются в защищенном локальном
                хранилище. При появлении интернета сервис автоматически отправит их на сервер без
                участия пользователя.
              </p>

              {queue.length > 0 && (
                <div className="pt-2 border-t dark:border-slate-800 border-slate-100 max-h-32 overflow-y-auto space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Очередь отправки:
                  </span>
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="p-1.5 rounded-lg dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 flex items-center justify-between text-[11px]"
                    >
                      <span className="truncate max-w-[140px] font-medium dark:text-slate-200 text-slate-700">
                        {item.payload.description}
                      </span>
                      <span className="font-mono font-bold shrink-0 text-slate-900 dark:text-white">
                        {(item.payload.amountKopecks / 100).toFixed(2)} ₽
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Автопуш: Включен</span>
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={async () => {
                  await syncNow();
                  setIsPopoverOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all active:scale-95 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
