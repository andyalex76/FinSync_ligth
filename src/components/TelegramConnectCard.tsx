import React, { useState } from 'react';
import { 
  Bot, 
  ExternalLink, 
  Copy, 
  Check, 
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { Family } from '../types';

interface TelegramConnectCardProps {
  family: Family;
  onOpenConnectModal: () => void;
  onOpenMiniAppPreview?: () => void;
}

export const TelegramConnectCard: React.FC<TelegramConnectCardProps> = ({
  family,
  onOpenConnectModal,
  onOpenMiniAppPreview,
}) => {
  const [copied, setCopied] = useState(false);

  const botUsername = 'FinSyncFamilyBot';
  const botLink = `https://t.me/${botUsername}?start=${family.inviteCode}`;

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dark:bg-slate-900/60 bg-white backdrop-blur-md border dark:border-slate-800/80 border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info & Concept */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 border border-sky-500/20">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base dark:text-white text-slate-900">
                Ввод расходов и чеков — в Telegram
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Read-Only экран
              </span>
            </div>

            <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Этот дашборд отображает актуальное состояние бюджета. Все расходы, доходы и фото чеков вносятся через Telegram-бота или Telegram Mini App без заполнения форм на сайте.
            </p>

            {/* Quick cheat sheet chips */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">Примеры для бота:</span>
              <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60">
                650 Обед
              </code>
              <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60">
                2500 Бензин #авто
              </code>
              <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60">
                +85000 Зарплата
              </code>
              <span className="hidden sm:inline text-slate-400">•</span>
              <span className="hidden sm:inline text-amber-600 dark:text-amber-400 font-medium">📷 Фото чека (OCR)</span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Invite Code */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 self-start lg:self-center">
          {/* Family Invite Code Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Код:</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {family.inviteCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              title="Скопировать код семьи"
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Open Bot Link */}
          <a
            href={botLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            <Bot className="w-4 h-4" />
            <span>Открыть бота</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

          {/* Mini App preview button */}
          {onOpenMiniAppPreview && (
            <button
              type="button"
              onClick={onOpenMiniAppPreview}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mini App</span>
            </button>
          )}

          {/* Instruction modal button */}
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="Инструкция по подключению Telegram"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramConnectCard;
