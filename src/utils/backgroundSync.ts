import { Transaction, SyncQueueItem, SyncStatus } from '../types';
import { StorageService } from './storage';
import { authFetch } from './auth';

export type SyncEventType =
  | 'sync-started'
  | 'sync-success'
  | 'sync-error'
  | 'queue-updated'
  | 'connection-restored'
  | 'connection-lost';

export interface SyncEventPayload {
  type: SyncEventType;
  syncedCount?: number;
  pendingCount?: number;
  error?: string;
  timestamp?: string;
  isOnline?: boolean;
}

type SyncEventListener = (event: SyncEventPayload) => void;

class BackgroundSyncManager {
  private isSyncing = false;
  private listeners: Set<SyncEventListener> = new Set();
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastAutoSyncAttempt = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initEventListeners();
      this.initPeriodicHeartbeat();
      this.registerServiceWorkerSync();
    }
  }

  /**
   * Set up connection and lifecycle listeners
   */
  private initEventListeners() {
    // 1. Primary trigger: Device reconnects to internet
    window.addEventListener('online', () => {
      console.info('[BackgroundSync] 🌐 Device reconnected to internet! Triggering auto-push...');
      this.notifyListeners({
        type: 'connection-restored',
        isOnline: true,
        pendingCount: this.getPendingCount(),
      });
      // Automatically push locally buffered transactions without manual intervention
      this.processQueue('online_event');
    });

    // 2. Offline transition notification
    window.addEventListener('offline', () => {
      console.info('[BackgroundSync] 📴 Device went offline. Transactions will be buffered locally.');
      this.notifyListeners({
        type: 'connection-lost',
        isOnline: false,
        pendingCount: this.getPendingCount(),
      });
    });

    // 3. User returns to app (tab visibility or window focus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // If there are pending items and we haven't synced in the last 10 seconds
        if (this.getPendingCount() > 0 && Date.now() - this.lastAutoSyncAttempt > 10000) {
          console.info('[BackgroundSync] App focused with pending buffer. Auto-pushing...');
          this.processQueue('visibility_change');
        }
      }
    });

    window.addEventListener('focus', () => {
      if (navigator.onLine && this.getPendingCount() > 0 && Date.now() - this.lastAutoSyncAttempt > 10000) {
        this.processQueue('window_focus');
      }
    });
  }

  /**
   * Heartbeat to flush pending queue if internet is available
   */
  private initPeriodicHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (navigator.onLine && this.getPendingCount() > 0 && !this.isSyncing) {
        this.processQueue('heartbeat');
      }
    }, 25000); // check every 25 seconds
  }

  /**
   * Register with browser's native Service Worker Background Sync API if supported
   */
  public async registerServiceWorkerSync(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // Check if SyncManager is supported by the browser (Chromium / Android)
      if ('sync' in registration && typeof (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register === 'function') {
        await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-buffered-transactions');
        console.info('[BackgroundSync] Registered native ServiceWorker sync tag: sync-buffered-transactions');
        return true;
      }
    } catch (err) {
      console.info('[BackgroundSync] Native SW SyncManager not available, using robust online-event engine', err);
    }
    return false;
  }

  /**
   * Subscribe to background sync events
   */
  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(payload: SyncEventPayload) {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[BackgroundSync] Error in listener callback:', err);
      }
    });
  }

  /**
   * Get current count of transactions waiting in the local buffer
   */
  public getPendingCount(): number {
    return StorageService.getSyncQueue().length;
  }

  /**
   * Get all items in the queue
   */
  public getQueue(): SyncQueueItem[] {
    return StorageService.getSyncQueue();
  }

  /**
   * Buffer a transaction in local storage and queue for background push
   */
  public bufferTransaction(
    action: 'create' | 'update' | 'delete',
    transaction: Transaction
  ): SyncQueueItem {
    const queueItem = StorageService.addToSyncQueue(action, {
      ...transaction,
      syncStatus: 'pending',
    });

    console.info(`[BackgroundSync] 📥 Transaction buffered (${action}): ${transaction.id} — ${transaction.description}`);

    this.notifyListeners({
      type: 'queue-updated',
      pendingCount: this.getPendingCount(),
    });

    // Try to register native SW sync tag
    this.registerServiceWorkerSync().catch(() => {});

    // If device is already online, push immediately in background
    if (navigator.onLine) {
      setTimeout(() => {
        this.processQueue('immediate_online_push');
      }, 300);
    }

    return queueItem;
  }

  /**
   * Main Background Sync Engine:
   * Pushes all buffered transactions to the server automatically.
   */
  public async processQueue(reason: string = 'manual'): Promise<{ success: boolean; syncedCount: number }> {
    // 1. Guard against concurrent sync runs or offline state
    if (this.isSyncing) {
      console.info('[BackgroundSync] Sync already in progress, skipping duplicate call.');
      return { success: false, syncedCount: 0 };
    }

    if (!navigator.onLine) {
      console.info('[BackgroundSync] Device is offline. Preserving locally buffered transactions.');
      return { success: false, syncedCount: 0 };
    }

    const queue = StorageService.getSyncQueue();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    this.isSyncing = true;
    this.lastAutoSyncAttempt = Date.now();

    this.notifyListeners({
      type: 'sync-started',
      pendingCount: queue.length,
    });

    console.info(`[BackgroundSync] 🚀 Auto-pushing ${queue.length} buffered transactions (Trigger: ${reason})...`);

    let successfullySyncedIds: string[] = [];

    try {
      // Step A: Attempt batch push to `/api/transactions/sync`
      const batchPayload = {
        items: queue.map((q) => ({
          id: q.transactionId,
          action: q.action,
          type: q.payload.type,
          amount_kopecks: q.payload.amountKopecks,
          currency: q.payload.currency,
          category_id: q.payload.categoryId,
          paid_by_member_id: q.payload.paidByMemberId,
          description: q.payload.description,
          transaction_date: q.payload.date,
          tags: q.payload.tags || [],
          document_id: q.payload.documentId || null,
          created_at: q.payload.createdAt,
        })),
        client_time: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let batchSuccess = false;

      try {
        const response = await authFetch('/api/transactions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          successfullySyncedIds = data.synced_ids || queue.map((q) => q.transactionId);
          batchSuccess = true;
        } else if (response.status === 404) {
          // Fallback to individual transaction endpoint if batch endpoint isn't on server
          console.warn('[BackgroundSync] /api/transactions/sync returned 404, attempting single endpoint...');
        }
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        console.warn('[BackgroundSync] Batch sync endpoint fetch issue:', fetchErr);
      }

      // Step B: If batch was not accepted, try individual /api/transactions
      if (!batchSuccess) {
        for (const item of queue) {
          try {
            const singleController = new AbortController();
            const singleTimeout = setTimeout(() => singleController.abort(), 6000);

            const res = await authFetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: item.payload.type,
                amount_kopecks: item.payload.amountKopecks,
                currency: item.payload.currency,
                category_id: item.payload.categoryId,
                paid_by_member_id: item.payload.paidByMemberId,
                description: item.payload.description,
                transaction_date: item.payload.date,
                tags: item.payload.tags || [],
                document_id: item.payload.documentId || null,
              }),
              signal: singleController.signal,
            });

            clearTimeout(singleTimeout);

            if (res.ok) {
              successfullySyncedIds.push(item.transactionId);
            }
          } catch {
            // Individual request failed; will be retried
          }
        }
      }

      // Step C (removed): ранее здесь находился ОПАСНЫЙ фолбэк, который при
      // неудачной синхронизации делал HEAD-пинг к window.location.origin и при
      // любом ответе со статусом <500 помечал ВСЕ элементы очереди как synced.
      // Это приводило к ложной синхронизации: данные не доходили до сервера,
      // но UI показывал «Синхронизировано». Теперь — честный retry через
      // scheduleRetry() (вызывается ниже). См. audit P0.4.

      // Step D: Reconcile and update storage
      if (successfullySyncedIds.length > 0) {
        const syncedSet = new Set(successfullySyncedIds);

        // 1. Remove synced items from syncQueue
        const remainingQueue = queue.filter((q) => !syncedSet.has(q.transactionId));
        StorageService.setSyncQueue(remainingQueue);

        // 2. Update status of transactions in localStorage to 'synced'
        const allTransactions = StorageService.getTransactions();
        const now = new Date().toISOString();
        const updatedTransactions = allTransactions.map((tx) => {
          if (syncedSet.has(tx.id)) {
            return {
              ...tx,
              syncStatus: 'synced' as SyncStatus,
              syncedAt: now,
            };
          }
          return tx;
        });
        StorageService.setTransactions(updatedTransactions);
        StorageService.setLastSyncTime(now);

        console.info(`[BackgroundSync] ✅ Successfully pushed ${successfullySyncedIds.length} transactions to server!`);

        this.notifyListeners({
          type: 'sync-success',
          syncedCount: successfullySyncedIds.length,
          pendingCount: remainingQueue.length,
          timestamp: now,
        });

        return { success: true, syncedCount: successfullySyncedIds.length };
      } else {
        // Retry logic with backoff
        const updatedQueue = queue.map((q) => ({
          ...q,
          attempts: q.attempts + 1,
          lastError: 'Server unreachable or request timed out',
        }));
        StorageService.setSyncQueue(updatedQueue);

        this.notifyListeners({
          type: 'sync-error',
          error: 'Не удалось подключиться к серверу, повтор при появлении стабильной сети',
          pendingCount: queue.length,
        });

        this.scheduleRetry();
        return { success: false, syncedCount: 0 };
      }
    } catch (err: unknown) {
      console.error('[BackgroundSync] Critical error in processQueue:', err);
      this.notifyListeners({
        type: 'sync-error',
        error: String(err),
        pendingCount: this.getPendingCount(),
      });
      this.scheduleRetry();
      return { success: false, syncedCount: 0 };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Schedule automatic retry with exponential backoff
   */
  private scheduleRetry() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    // Retry in 15 seconds if still online
    this.retryTimeout = setTimeout(() => {
      if (navigator.onLine && this.getPendingCount() > 0) {
        this.processQueue('exponential_retry');
      }
    }, 15000);
  }

  /**
   * Force manual sync on demand
   */
  public async syncNow(): Promise<{ success: boolean; syncedCount: number }> {
    return this.processQueue('user_forced_sync');
  }

  /**
   * Clear all pending items from local buffer queue and notify listeners
   */
  public clearQueue() {
    StorageService.clearSyncQueue();
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.notifyListeners({
      type: 'queue-updated',
      pendingCount: 0,
    });
  }

  /**
   * Clean up timer on unload
   */
  public destroy() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncManager();
