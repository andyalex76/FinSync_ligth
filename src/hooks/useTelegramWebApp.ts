import { useEffect, useState, useMemo, useCallback } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramUser;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function useTelegramWebApp() {
  const [isReady, setIsReady] = useState(false);
  const [forceTmaPreview, setForceTmaPreview] = useState(false);

  const tg = useMemo(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp;
    }
    return undefined;
  }, []);

  // Detect whether we are running in actual Telegram or preview mode
  const isInsideTelegram = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const hasTgParam = urlParams.get('source') === 'telegram' || urlParams.get('tma') === '1' || urlParams.get('tma') === 'true';
    const hasTgHash = window.location.hash.includes('tgWebAppData');
    const hasValidTgObj = Boolean(tg && tg.initData && tg.initData.length > 0);
    return Boolean(hasTgParam || hasTgHash || hasValidTgObj || forceTmaPreview);
  }, [tg, forceTmaPreview]);

  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch (err) {
        console.warn('Failed to initialize Telegram WebApp:', err);
      }
    }
    setIsReady(true);
  }, [tg]);

  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      tg?.HapticFeedback?.impactOccurred(style);
    } catch {
      // Ignored outside TG
    }
  }, [tg]);

  const hapticSuccess = useCallback(() => {
    try {
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch {
      // Ignored outside TG
    }
  }, [tg]);

  const hapticError = useCallback(() => {
    try {
      tg?.HapticFeedback?.notificationOccurred('error');
    } catch {
      // Ignored outside TG
    }
  }, [tg]);

  const closeApp = useCallback(() => {
    try {
      tg?.close();
    } catch {
      // Ignored outside TG
    }
  }, [tg]);

  return {
    tg,
    isReady,
    isInsideTelegram,
    forceTmaPreview,
    setForceTmaPreview,
    user: tg?.initDataUnsafe?.user,
    colorScheme: tg?.colorScheme,
    themeParams: tg?.themeParams,
    hapticImpact,
    hapticSuccess,
    hapticError,
    closeApp,
  };
}
