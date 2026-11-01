import { Loader2, LockKeyhole } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardView, periodLabel } from './DashboardView';
import { Header } from './Header';
import { Notice } from './ui';
import type { Theme } from '../hooks/useTheme';

interface ScreenProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** Hide the page header (the Mini App shell shows its own). */
  embedded?: boolean;
}

export function DashboardScreen({ theme, onToggleTheme, embedded = false }: ScreenProps) {
  const { state, refresh } = useDashboard();

  const subtitle =
    state.status === 'ready'
      ? `${periodLabel(state.data.period)} · обновлено ${state.updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : undefined;

  return (
    <div className="space-y-4">
      {!embedded && <Header subtitle={subtitle} theme={theme} onToggleTheme={onToggleTheme} onRefresh={() => void refresh()} />}

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 py-16 text-slate-500" role="status">
          <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Загрузка...
        </div>
      )}

      {state.status === 'unauthorized' && (
        <div className="mx-auto max-w-sm space-y-3 py-12 text-center">
          <LockKeyhole className="mx-auto text-slate-400" size={36} aria-hidden="true" />
          <h2 className="text-lg font-semibold">Нужен вход через Telegram</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Отправьте боту команду <code className="rounded bg-slate-200 px-1.5 py-0.5 dark:bg-slate-800">/dashboard</code> и нажмите
            кнопку «Открыть Web Дашборд». Ссылка действует 5 минут и работает один раз.
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-3">
          <Notice tone="error">Не удалось загрузить данные: {state.message}</Notice>
          <button type="button" onClick={() => void refresh()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
            Повторить
          </button>
        </div>
      )}

      {state.status === 'ready' && <DashboardView data={state.data} offlineMessage={state.offline ? state.message : undefined} />}
    </div>
  );
}
