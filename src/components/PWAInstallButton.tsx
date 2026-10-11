import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const { modalRef } = useModalA11y({
    isOpen: showIOSGuide,
    onClose: () => setShowIOSGuide(false),
  });

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95 shrink-0"
        title="Установить приложение"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700/80 transition active:scale-95 shrink-0"
          title="Инструкция по установке на iPhone"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">В PWA</span>
        </button>

        {showIOSGuide && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => { if (e.target === e.currentTarget) setShowIOSGuide(false); }}
          >
            <div 
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-guide-title"
              tabIndex={-1}
              className="w-full sm:max-w-sm rounded-t-[28px] sm:rounded-3xl bg-[#020617] border-t sm:border border-slate-800 p-5 shadow-2xl text-white animate-in slide-in-from-bottom duration-200 outline-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 id="ios-guide-title" className="font-bold text-sm text-white">Установка на iPhone</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Закрыть инструкцию"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <Share2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Шаг 1:</strong> Нажмите кнопку <span className="text-white font-medium">«Поделиться»</span> в нижней панели Safari.
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Шаг 2:</strong> Прокрутите меню и выберите <span className="text-white font-medium">«На экран „Домой“»</span>.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
