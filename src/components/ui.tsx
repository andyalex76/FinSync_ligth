import type { ReactNode } from 'react';

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      {title && (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h2>
      )}
      {children}
    </section>
  );
}

/** Horizontal progress bar. `percent` may exceed 100, the bar is capped. */
export function ProgressBar({ percent, barClass, label }: { percent: number; barClass: string; label: string }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function Notice({ tone, children }: { tone: 'warning' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}
