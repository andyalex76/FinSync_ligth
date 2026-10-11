import { useState, useEffect, useCallback } from 'react';
import { backgroundSyncService, SyncEventPayload } from '../utils/backgroundSync';
import { StorageService } from '../utils/storage';
import { SyncQueueItem } from '../types';

export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(() => {
    return StorageService.getSyncQueue().length;
  });
  const [queue, setQueue] = useState<SyncQueueItem[]>(() => {
    return StorageService.getSyncQueue();
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return StorageService.getLastSyncTime();
  });
  const [recentNotification, setRecentNotification] = useState<{
    type: 'success' | 'reconnected' | 'offline';
    message: string;
    count?: number;
  } | null>(null);

  useEffect(() => {
    const updateQueueState = () => {
      const currentQueue = StorageService.getSyncQueue();
      setQueue(currentQueue);
      setPendingCount(currentQueue.length);
    };

    const unsubscribe = backgroundSyncService.subscribe((event: SyncEventPayload) => {
      switch (event.type) {
        case 'sync-started':
          setIsSyncing(true);
          break;

        case 'sync-success':
          setIsSyncing(false);
          updateQueueState();
          if (event.timestamp) {
            setLastSyncTime(event.timestamp);
          }
          if (event.syncedCount && event.syncedCount > 0) {
            setRecentNotification({
              type: 'success',
              count: event.syncedCount,
              message: `Автоматически синхронизировано ${event.syncedCount} ${
                event.syncedCount === 1 ? 'операция' : event.syncedCount < 5 ? 'операции' : 'операций'
              } с сервером`,
            });
          }
          break;

        case 'sync-error':
          setIsSyncing(false);
          updateQueueState();
          break;

        case 'queue-updated':
          updateQueueState();
          break;

        case 'connection-restored':
          setIsOnline(true);
          updateQueueState();
          setRecentNotification({
            type: 'reconnected',
            message: 'Подключение к сети восстановлено. Запущена автоматическая синхронизация...',
          });
          break;

        case 'connection-lost':
          setIsOnline(false);
          updateQueueState();
          setRecentNotification({
            type: 'offline',
            message: 'Устройство перешло в офлайн-режим. Новые операции сохраняются в локальный буфер.',
          });
          break;
      }
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateQueueState();

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (recentNotification) {
      const timer = setTimeout(() => {
        setRecentNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [recentNotification]);

  const syncNow = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    try {
      await backgroundSyncService.syncNow();
    } finally {
      setIsSyncing(false);
      setQueue(StorageService.getSyncQueue());
      setPendingCount(StorageService.getSyncQueue().length);
    }
  }, []);

  const clearNotification = useCallback(() => {
    setRecentNotification(null);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queue,
    lastSyncTime,
    recentNotification,
    syncNow,
    clearNotification,
  };
}
