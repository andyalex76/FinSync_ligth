import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const defaultNS = 'translation';

export const resources = {
  ru: {
    translation: {
      app: {
        title: 'Семейный Бюджет',
        subtitle: 'FinSync',
        online: 'В сети',
        offline: 'Офлайн',
        sync: 'Синхронизировать',
        syncing: 'Синхронизация...',
        synced: 'Синхронизировано',
        pendingSync: 'Ожидает отправки',
        addTransaction: 'Добавить',
        language: 'Язык',
        theme: 'Тема',
        cleanDbMode: 'Чистая БД активна',
      },
      nav: {
        overview: 'Сводка',
        budgets: 'Бюджеты',
        transactions: 'Операции',
        savings: 'Копилки',
        settlements: 'Взаиморасчеты',
        analytics: 'Аналитика',
        members: 'Семья',
        telegram: 'Telegram-бот',
        ocr: 'Сканер чеков',
        backup: 'Бэкап',
      },
      periods: {
        current_month: 'Текущий месяц',
        prev_month: 'Прошлый месяц',
        quarter: 'Квартал',
        year: 'Год',
        all: 'Все время',
      },
      types: {
        expense: 'Расход',
        income: 'Доход',
        saving: 'В копилку',
        transfer: 'Перевод',
        draft: 'Черновик',
        all: 'Все типы',
      },
      common: {
        save: 'Сохранить',
        cancel: 'Отмена',
        delete: 'Удалить',
        edit: 'Редактировать',
        search: 'Поиск...',
        confirm: 'Принять',
        reject: 'Отклонить',
        clear: 'Очистить',
        close: 'Закрыть',
        loading: 'Загрузка...',
        actions: 'Действия',
        date: 'Дата',
        amount: 'Сумма',
        category: 'Категория',
        member: 'Член семьи',
        description: 'Описание',
        notes: 'Заметки',
        allMembers: 'Все члены семьи',
        allCategories: 'Все категории',
      },
      transactions: {
        title: 'Список операций',
        emptyTitle: 'Операции не найдены',
        emptyCleanDesc: 'База данных готова к тестированию! Создайте первую операцию через «+ Добавить», отсканируйте чек или пришлите данные боту.',
        emptyFilterDesc: 'Попробуйте изменить период или параметры фильтров',
        searchPlaceholder: 'Поиск по описанию, магазину или #тегам...',
        draftBadge: 'Черновик OCR',
        pendingBadge: 'В буфере',
        syncingBadge: 'Синхронизация...',
        totalCount: 'Отображено операций: {{count}}',
        virtualizationActive: 'Виртуализация списка активна',
        exportCSV: 'Экспорт в CSV',
        deleteConfirm: 'Удалить эту операцию?',
      },
      overview: {
        balance: 'Текущий баланс семьи',
        monthlyIncome: 'Доходы за месяц',
        monthlyExpense: 'Расходы за месяц',
        savingsTotal: 'В копилках семьи',
        recentTransactions: 'Недавние операции',
        allTransactions: 'Все операции',
        budgetStatus: 'Исполнение бюджетов',
        forecastTitle: 'Прогноз расходов до конца месяца',
        quickAdd: 'Быстрое добавление',
      },
    },
  },
  en: {
    translation: {
      app: {
        title: 'Family Budget',
        subtitle: 'FinSync',
        online: 'Online',
        offline: 'Offline',
        sync: 'Sync Now',
        syncing: 'Syncing...',
        synced: 'Synced',
        pendingSync: 'Pending Sync',
        addTransaction: 'Add Transaction',
        language: 'Language',
        theme: 'Theme',
        cleanDbMode: 'Clean DB active',
      },
      nav: {
        overview: 'Overview',
        budgets: 'Budgets',
        transactions: 'Transactions',
        savings: 'Savings',
        settlements: 'Settlements',
        analytics: 'Analytics',
        members: 'Family',
        telegram: 'Telegram Bot',
        ocr: 'Receipt OCR',
        backup: 'Backup',
      },
      periods: {
        current_month: 'Current Month',
        prev_month: 'Previous Month',
        quarter: 'Quarter',
        year: 'Year',
        all: 'All Time',
      },
      types: {
        expense: 'Expense',
        income: 'Income',
        saving: 'To Savings',
        transfer: 'Transfer',
        draft: 'Draft',
        all: 'All Types',
      },
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search...',
        confirm: 'Accept',
        reject: 'Reject',
        clear: 'Clear',
        close: 'Close',
        loading: 'Loading...',
        actions: 'Actions',
        date: 'Date',
        amount: 'Amount',
        category: 'Category',
        member: 'Family Member',
        description: 'Description',
        notes: 'Notes',
        allMembers: 'All members',
        allCategories: 'All categories',
      },
      transactions: {
        title: 'Transactions',
        emptyTitle: 'No transactions found',
        emptyCleanDesc: 'Database is ready! Create your first transaction via "+ Add", scan a receipt, or send data via Telegram bot.',
        emptyFilterDesc: 'Try adjusting the period or filter criteria',
        searchPlaceholder: 'Search by description, merchant or #tags...',
        draftBadge: 'OCR Draft',
        pendingBadge: 'Buffered',
        syncingBadge: 'Syncing...',
        totalCount: 'Showing transactions: {{count}}',
        virtualizationActive: 'List virtualization active',
        exportCSV: 'Export to CSV',
        deleteConfirm: 'Delete this transaction?',
      },
      overview: {
        balance: 'Family Balance',
        monthlyIncome: 'Monthly Income',
        monthlyExpense: 'Monthly Expense',
        savingsTotal: 'Family Savings',
        recentTransactions: 'Recent Transactions',
        allTransactions: 'All Transactions',
        budgetStatus: 'Budget Progress',
        forecastTitle: 'Expense Forecast for Month End',
        quickAdd: 'Quick Add',
      },
    },
  },
} as const;

const SAVED_LANG_KEY = 'finsync_language_v1';
const initialLang = (() => {
  try {
    const saved = localStorage.getItem(SAVED_LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
    return navigator.language?.startsWith('en') ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
})();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'ru',
    defaultNS,
    interpolation: {
      escapeValue: false, // React already protects against XSS
    },
  });

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(SAVED_LANG_KEY, lng);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lng;
    }
  } catch {
    // Ignore storage errors
  }
});

export default i18n;
