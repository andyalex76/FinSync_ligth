import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('en') ? 'en' : 'ru';

  const toggleLanguage = () => {
    const nextLang = currentLang === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900/60 bg-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition shadow-xs active:scale-95"
      title={currentLang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      aria-label="Toggle language"
    >
      <Languages className="w-3.5 h-3.5 text-blue-500" />
      <span className="uppercase tracking-wide font-mono">{currentLang}</span>
    </button>
  );
};
