import { useEffect, useState } from 'react';
import { LayoutDashboard, PlusCircle } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import { DashboardScreen } from './DashboardScreen';
import { EntryForm } from './EntryForm';
import { Header } from './Header';

type Section = 'entry' | 'overview';

/** The Telegram Mini App: an entry form plus the same read-only overview as the web dashboard. */
export function MiniAppView({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [section, setSection] = useState<Section>('entry');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
  }, []);

  const tab = (id: Section, label: string, Icon: typeof PlusCircle) => (
    <button
      type="button"
      role="tab"
      aria-selected={section === id}
      onClick={() => setSection(id)}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
        section === id ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="pb-20">
      <div className="mb-4">
        <Header theme={theme} onToggleTheme={onToggleTheme} />
      </div>
      {section === 'entry' ? <EntryForm /> : <DashboardScreen theme={theme} onToggleTheme={onToggleTheme} embedded />}
      <nav
        role="tablist"
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {tab('entry', 'Ввод', PlusCircle)}
        {tab('overview', 'Обзор', LayoutDashboard)}
      </nav>
    </div>
  );
}
