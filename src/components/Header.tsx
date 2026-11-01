import { Moon, RefreshCw, Sun, Wallet } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

interface HeaderProps {
  subtitle?: string;
  theme: Theme;
  onToggleTheme: () => void;
  onRefresh?: () => void;
}

export function Header({ subtitle, theme, onToggleTheme, onRefresh }: HeaderProps) {
  const button =
    'flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800';
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white">
          <Wallet size={18} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-base font-semibold leading-tight">Семейный бюджет</h1>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button type="button" onClick={onRefresh} className={button} aria-label="Обновить">
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onToggleTheme} className={button} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
          {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
