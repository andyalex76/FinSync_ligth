/**
 * Category colors come from the server as names ("emerald", "blue", ...).
 * Class names are written out in full so Tailwind can see them at build time.
 */
export interface ColorStyle {
  bar: string;
  badge: string;
}

const STYLES: Record<string, ColorStyle> = {
  emerald: { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-500' },
  blue: { bar: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-500' },
  amber: { bar: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-500' },
  orange: { bar: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-500' },
  rose: { bar: 'bg-rose-500', badge: 'bg-rose-500/15 text-rose-500' },
  purple: { bar: 'bg-purple-500', badge: 'bg-purple-500/15 text-purple-500' },
  indigo: { bar: 'bg-indigo-500', badge: 'bg-indigo-500/15 text-indigo-500' },
  sky: { bar: 'bg-sky-500', badge: 'bg-sky-500/15 text-sky-500' },
};

const FALLBACK: ColorStyle = { bar: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-500' };

export const colorStyle = (name: string | undefined): ColorStyle => (name && STYLES[name]) || FALLBACK;
