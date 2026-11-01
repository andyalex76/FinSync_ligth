import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getDashboard } from '../api';
import type { Dashboard } from '../types';

export type DashboardState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'ready'; data: Dashboard; updatedAt: Date; offline: false }
  | { status: 'ready'; data: Dashboard; updatedAt: Date; offline: true; message: string }
  | { status: 'error'; message: string };

/**
 * Loads the dashboard from the server and keeps it fresh (polling + refresh when the tab becomes
 * visible again). The last good data stays on screen if a refresh fails.
 */
export function useDashboard(intervalMs = 30_000) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const lastGood = useRef<{ data: Dashboard; updatedAt: Date } | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getDashboard();
      if (!alive.current) return;
      lastGood.current = { data, updatedAt: new Date() };
      setState({ status: 'ready', data, updatedAt: lastGood.current.updatedAt, offline: false });
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && err.isAuthError) {
        lastGood.current = null;
        setState({ status: 'unauthorized' });
        return;
      }
      const message = err instanceof Error ? err.message : 'Не удалось обновить данные';
      if (lastGood.current) {
        setState({ status: 'ready', ...lastGood.current, offline: true, message });
      } else {
        setState({ status: 'error', message });
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return { state, refresh };
}
