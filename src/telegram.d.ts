/** The small part of the Telegram Mini App SDK (telegram-web-app.js) that this app uses. */
interface TelegramWebApp {
  initData: string;
  colorScheme?: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
