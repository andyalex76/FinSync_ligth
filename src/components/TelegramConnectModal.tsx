import React, { useState } from 'react';
import { 
  Bot, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  MessageSquare, 
  Camera, 
  X,
  Sparkles
} from 'lucide-react';
import { Family } from '../types';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: Family;
  onOpenMiniAppPreview?: () => void;
}

export const TelegramConnectModal: React.FC<TelegramConnectModalProps> = ({
  isOpen,
  onClose,
  family,
  onOpenMiniAppPreview,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  // Real or configured telegram bot username
  const botUsername = 'FinSyncFamilyBot';
  const botLink = `https://t.me/${botUsername}?start=${family.inviteCode}`;

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold dark:text-white text-slate-900">
                Ввод данных через Telegram
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Чат-бот и Telegram Mini App
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Concept summary banner */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/40 text-xs leading-relaxed text-sky-900 dark:text-sky-200">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Дашборд работает в режиме табло (Read-Only).</span> Внесение всех расходов, доходов и сканирование чеков осуществляется только через Telegram — это избавляет семью от заполнения веб-форм.
              </div>
            </div>
          </div>

          {/* Quick invite code & link card */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Код приглашения семьи
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Семья: {family.name}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="font-mono text-lg font-bold tracking-widest text-blue-600 dark:text-blue-400">
                {family.inviteCode}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(family.inviteCode, 'code')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct Bot Link */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <a
                href={botLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-98"
              >
                <Bot className="w-4 h-4" />
                <span>Открыть бота в Telegram</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <button
                type="button"
                onClick={() => copyToClipboard(botLink, 'link')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Ссылка скопирована' : 'Ссылка для семьи'}</span>
              </button>
            </div>
          </div>

          {/* How to use Telegram input */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Способы внесения информации
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Fast Bot Messages */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs">Текстовые сообщения</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Отправляйте боту текст прямо из чата:
                  </p>
                  <div className="space-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div>• 540 Кофе</div>
                    <div>• 1650 Продукты #еда</div>
                    <div>• +65000 Зарплата</div>
                  </div>
                </div>
              </div>

              {/* Option 2: Telegram Mini App */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs">Telegram Mini App</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Интерфейс в меню бота с кнопками категорий и тактильным откликом.
                  </p>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Откройте меню бота в Telegram или протестируйте сейчас в браузере:
                  </div>
                </div>

                {onOpenMiniAppPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMiniAppPreview();
                    }}
                    className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors text-center"
                  >
                    Тест Mini App в браузере
                  </button>
                )}
              </div>
            </div>

            {/* Receipt OCR option */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Фото кассовых чеков:
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  Отправьте фото чека в диалог с ботом — локальный Tesseract OCR распознает магазин, дату и сумму и предложит подтвердить операцию.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            FinSync • Автоматический прием через aiogram 3.x
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramConnectModal;
