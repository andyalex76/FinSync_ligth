import { DashboardScreen } from './components/DashboardScreen';
import { MiniAppView } from './components/MiniAppView';
import { useTheme } from './hooks/useTheme';

/**
 * Two faces of one app:
 *  - inside Telegram (signed initData present): the Mini App with the entry form;
 *  - in a regular browser: the read-only dashboard (signed in with the one-time link from the bot).
 */
export default function App() {
  const { theme, toggle } = useTheme();
  const insideTelegram = Boolean(window.Telegram?.WebApp?.initData);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-4 text-slate-900 dark:text-slate-100">
      {insideTelegram ? (
        <div className="mx-auto max-w-md">
          <MiniAppView theme={theme} onToggleTheme={toggle} />
        </div>
      ) : (
        <DashboardScreen theme={theme} onToggleTheme={toggle} />
      )}
    </div>
  );
}
