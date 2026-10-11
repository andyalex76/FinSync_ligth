import {
  Family,
  FamilyMember,
  Category,
  Budget,
  Transaction,
  MerchantRule,
  SavingsGoal,
  SyncQueueItem,
  FamilySetupData,
} from '../types';
import {
  INITIAL_FAMILY,
  INITIAL_MEMBERS,
  INITIAL_CATEGORIES,
  INITIAL_BUDGETS,
  INITIAL_TRANSACTIONS,
  INITIAL_SAVINGS_GOALS,
} from '../data/initialData';

const KEYS = {
  STATE: 'finsync_state_bundle_v1',
  FAMILY: 'finsync_family_v1',
  MEMBERS: 'finsync_members_v1',
  CATEGORIES: 'finsync_categories_v1',
  BUDGETS: 'finsync_budgets_v1',
  TRANSACTIONS: 'finsync_transactions_v1',
  MERCHANT_RULES: 'finsync_merchant_rules_v1',
  SAVINGS_GOALS: 'finsync_savings_goals_v1',
  THEME: 'finsync_theme_v1',
  SYNC_QUEUE: 'finsync_sync_queue_v1',
  LAST_SYNC_TIME: 'finsync_last_sync_time_v1',
  IS_CONFIGURED: 'finsync_is_configured_v1',
};

const DEFAULT_MERCHANT_RULES: MerchantRule[] = [
  { id: 'rule-1', pattern: 'перекресток', categoryId: 'cat-groceries', matchCount: 12, updatedAt: new Date().toISOString() },
  { id: 'rule-2', pattern: 'вкусвилл', categoryId: 'cat-groceries', matchCount: 8, updatedAt: new Date().toISOString() },
  { id: 'rule-3', pattern: 'пятерочка', categoryId: 'cat-groceries', matchCount: 15, updatedAt: new Date().toISOString() },
  { id: 'rule-4', pattern: 'лукойл', categoryId: 'cat-auto', matchCount: 5, updatedAt: new Date().toISOString() },
  { id: 'rule-5', pattern: 'газпромнефть', categoryId: 'cat-auto', matchCount: 4, updatedAt: new Date().toISOString() },
  { id: 'rule-6', pattern: 'яндекс такси', categoryId: 'cat-auto', matchCount: 9, updatedAt: new Date().toISOString() },
  { id: 'rule-7', pattern: 'аптека', categoryId: 'cat-health', matchCount: 6, updatedAt: new Date().toISOString() },
  { id: 'rule-8', pattern: 'мосэнергосбыт', categoryId: 'cat-housing', matchCount: 3, updatedAt: new Date().toISOString() },
  { id: 'rule-9', pattern: 'кинопоиск', categoryId: 'cat-leisure', matchCount: 2, updatedAt: new Date().toISOString() },
  { id: 'rule-10', pattern: 'сбербанк', categoryId: 'cat-loans', matchCount: 7, updatedAt: new Date().toISOString() },
  { id: 'rule-11', pattern: 'ипотека', categoryId: 'cat-loans', matchCount: 5, updatedAt: new Date().toISOString() },
  { id: 'rule-12', pattern: 'тинькофф', categoryId: 'cat-loans', matchCount: 4, updatedAt: new Date().toISOString() },
  { id: 'rule-13', pattern: 'кредит', categoryId: 'cat-loans', matchCount: 6, updatedAt: new Date().toISOString() },
];

function safeGet<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return fallback;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Storage load error for ${key}:`, err);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Storage save error for ${key}:`, err);
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Storage remove error for ${key}:`, err);
  }
}

export interface AppStoredState {
  family: Family;
  members: FamilyMember[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
}

export const StorageService = {
  getFamily: (): Family => safeGet(KEYS.FAMILY, INITIAL_FAMILY),
  setFamily: (data: Family) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.FAMILY, data);
  },

  getMembers: (): FamilyMember[] => safeGet(KEYS.MEMBERS, INITIAL_MEMBERS),
  setMembers: (data: FamilyMember[]) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.MEMBERS, data);
  },

  getCategories: (): Category[] => {
    const loaded = safeGet(KEYS.CATEGORIES, INITIAL_CATEGORIES);
    // Sanitize and ensure correct distinct icons
    const sanitized = loaded.map((c: Category) => {
      if (c.id === 'cat-savings') {
        return { ...c, icon: 'PiggyBank' };
      }
      if (c.id === 'cat-loans') {
        return { ...c, icon: 'Landmark' };
      }
      return c;
    });

    // Ensure newly defined system categories (e.g. cat-loans) are present
    const existingIds = new Set(sanitized.map((c: Category) => c.id));
    const missing = INITIAL_CATEGORIES.filter((c) => !existingIds.has(c.id));
    if (missing.length > 0) {
      const merged = [...sanitized, ...missing];
      safeSet(KEYS.CATEGORIES, merged);
      return merged;
    }
    return sanitized;
  },
  setCategories: (data: Category[]) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.CATEGORIES, data);
  },

  getBudgets: (): Budget[] => {
    const loaded = safeGet(KEYS.BUDGETS, INITIAL_BUDGETS);
    // Ensure newly defined initial budgets are present
    const existingCategoryBudgetIds = new Set(loaded.map((b: Budget) => b.categoryId));
    const missingBudgets = INITIAL_BUDGETS.filter((b) => !existingCategoryBudgetIds.has(b.categoryId));
    if (missingBudgets.length > 0) {
      const merged = [...loaded, ...missingBudgets];
      safeSet(KEYS.BUDGETS, merged);
      return merged;
    }
    return loaded;
  },
  setBudgets: (data: Budget[]) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.BUDGETS, data);
  },

  getTransactions: (): Transaction[] => safeGet(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS),
  setTransactions: (data: Transaction[]) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.TRANSACTIONS, data);
  },

  getSavingsGoals: (): SavingsGoal[] => safeGet(KEYS.SAVINGS_GOALS, INITIAL_SAVINGS_GOALS),
  setSavingsGoals: (data: SavingsGoal[]) => {
    localStorage.removeItem(KEYS.STATE);
    safeSet(KEYS.SAVINGS_GOALS, data);
  },

  getMerchantRules: (): MerchantRule[] => safeGet(KEYS.MERCHANT_RULES, DEFAULT_MERCHANT_RULES),
  setMerchantRules: (data: MerchantRule[]) => safeSet(KEYS.MERCHANT_RULES, data),

  loadState: (): AppStoredState | null => {
    try {
      // Fast path: load the whole bundle with a single safeGet call
      const bundled = safeGet<AppStoredState | null>(KEYS.STATE, null);
      if (bundled) {
        return bundled;
      }

      // Backward-compatible fallback for initial or legacy separated storage
      const fam = safeGet<Family | null>(KEYS.FAMILY, null);
      if (!fam) return null;
      const state: AppStoredState = {
        family: StorageService.getFamily(),
        members: StorageService.getMembers(),
        categories: StorageService.getCategories(),
        budgets: StorageService.getBudgets(),
        transactions: StorageService.getTransactions(),
        savingsGoals: StorageService.getSavingsGoals(),
      };
      safeSet(KEYS.STATE, state);
      return state;
    } catch {
      return null;
    }
  },

  saveState: (state: AppStoredState) => {
    // Save bundled state for single-parse loading
    safeSet(KEYS.STATE, state);
    // Sync individual keys for backward-compatibility & separate collection getters
    safeSet(KEYS.FAMILY, state.family);
    safeSet(KEYS.MEMBERS, state.members);
    safeSet(KEYS.CATEGORIES, state.categories);
    safeSet(KEYS.BUDGETS, state.budgets);
    safeSet(KEYS.TRANSACTIONS, state.transactions);
    safeSet(KEYS.SAVINGS_GOALS, state.savingsGoals);
  },

  learnMerchantRule: (merchantText: string, categoryId: string): MerchantRule[] => {
    const cleanPattern = merchantText.trim().toLowerCase().replace(/["'«»ООО]/g, '').trim();
    if (!cleanPattern || cleanPattern.length < 3) return StorageService.getMerchantRules();

    const rules = StorageService.getMerchantRules();
    const existingIndex = rules.findIndex((r) => r.pattern === cleanPattern || cleanPattern.includes(r.pattern));

    if (existingIndex >= 0) {
      rules[existingIndex] = {
        ...rules[existingIndex],
        categoryId,
        matchCount: rules[existingIndex].matchCount + 1,
        updatedAt: new Date().toISOString(),
      };
    } else {
      rules.push({
        id: `rule-${Date.now()}`,
        pattern: cleanPattern,
        categoryId,
        matchCount: 1,
        updatedAt: new Date().toISOString(),
      });
    }

    StorageService.setMerchantRules(rules);
    return rules;
  },

  matchMerchantCategory: (text: string): string | null => {
    const lower = text.toLowerCase();
    const rules = StorageService.getMerchantRules();
    const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
    for (const rule of sorted) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        return rule.categoryId;
      }
    }
    return null;
  },

  getTheme: (): boolean => safeGet(KEYS.THEME, true),
  setTheme: (isDark: boolean) => safeSet(KEYS.THEME, isDark),
  loadTheme: (): 'light' | 'dark' => (safeGet(KEYS.THEME, true) ? 'dark' : 'light'),
  saveTheme: (theme: 'light' | 'dark') => safeSet(KEYS.THEME, theme === 'dark'),

  // Background Sync Queue Storage Methods
  getSyncQueue: (): SyncQueueItem[] => safeGet(KEYS.SYNC_QUEUE, []),
  setSyncQueue: (data: SyncQueueItem[]): void => safeSet(KEYS.SYNC_QUEUE, data),

  addToSyncQueue: (
    action: 'create' | 'update' | 'delete',
    transaction: Transaction
  ): SyncQueueItem => {
    const queue = StorageService.getSyncQueue();
    // If an item for this transaction already exists in queue, update it instead of duplicating
    const existingIdx = queue.findIndex((q) => q.transactionId === transaction.id);
    const newItem: SyncQueueItem = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionId: transaction.id,
      action,
      payload: transaction,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = newItem;
    } else {
      queue.push(newItem);
    }

    StorageService.setSyncQueue(queue);
    return newItem;
  },

  removeFromSyncQueue: (queueItemIdOrTransactionId: string): void => {
    const queue = StorageService.getSyncQueue();
    const filtered = queue.filter(
      (q) => q.id !== queueItemIdOrTransactionId && q.transactionId !== queueItemIdOrTransactionId
    );
    StorageService.setSyncQueue(filtered);
  },

  clearSyncQueue: (): void => {
    safeRemove(KEYS.SYNC_QUEUE);
  },

  getLastSyncTime: (): string | null => safeGet(KEYS.LAST_SYNC_TIME, null),
  setLastSyncTime: (isoString: string): void => safeSet(KEYS.LAST_SYNC_TIME, isoString),

  isConfigured: (): boolean => {
    return safeGet<boolean>(KEYS.IS_CONFIGURED, true);
  },

  setConfigured: (val: boolean): void => {
    safeSet(KEYS.IS_CONFIGURED, val);
  },

  setupFamily: (data: FamilySetupData): AppStoredState => {
    const familyId = data.familyId.trim() || `fam-${Date.now().toString(36)}`;
    const family: Family = {
      id: familyId,
      name: data.familyName.trim() || 'Моя семья',
      currency: data.currency || 'RUB',
      inviteCode: data.inviteCode.trim() || `${(data.familyName || 'FAMILY').slice(0, 6).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      createdAt: new Date().toISOString(),
    };

    const currentMember: FamilyMember = {
      id: `mem-${Date.now().toString(36)}-1`,
      familyId: family.id,
      userId: `usr-${Date.now().toString(36)}-1`,
      name: data.userName.trim() || 'Я',
      avatar: data.userAvatar || '👨‍💼',
      role: data.userRole || 'owner',
      balanceKopecks: 0,
      isCurrentUser: true,
      telegramUserId: data.telegramUserId?.trim() || undefined,
    };

    const members: FamilyMember[] = [currentMember];

    if (data.additionalMembers && data.additionalMembers.length > 0) {
      data.additionalMembers.forEach((m, idx) => {
        if (m.name.trim()) {
          members.push({
            id: `mem-${Date.now().toString(36)}-${idx + 2}`,
            familyId: family.id,
            userId: `usr-${Date.now().toString(36)}-${idx + 2}`,
            name: m.name.trim(),
            avatar: m.avatar || '👩‍⚕️',
            role: m.role || 'member',
            balanceKopecks: 0,
            isCurrentUser: false,
          });
        }
      });
    }

    // Clean categories mapped to the new family
    const categories: Category[] = INITIAL_CATEGORIES.map((c) => ({
      ...c,
      familyId: family.id,
    }));

    const budgets: Budget[] = INITIAL_BUDGETS.map((b) => ({
      ...b,
      familyId: family.id,
    }));

    const transactions: Transaction[] = data.startClean ? [] : INITIAL_TRANSACTIONS;
    const savingsGoals: SavingsGoal[] = INITIAL_SAVINGS_GOALS.map((g) => ({
      ...g,
      familyId: family.id,
      currentKopecks: data.startClean ? 0 : g.currentKopecks,
    }));

    const state: AppStoredState = {
      family,
      members,
      categories,
      budgets,
      transactions,
      savingsGoals,
    };

    StorageService.saveState(state);
    StorageService.setConfigured(true);
    StorageService.clearSyncQueue();

    return state;
  },

  wipeTransactionsAndSyncQueue: () => {
    safeRemove(KEYS.STATE);
    safeSet(KEYS.TRANSACTIONS, []);
    safeRemove(KEYS.SYNC_QUEUE);
    safeRemove(KEYS.LAST_SYNC_TIME);
  },

  resetToInitial: () => {
    Object.values(KEYS).forEach((key) => {
      safeRemove(key);
    });
    safeSet(KEYS.IS_CONFIGURED, true);
  },

  clearAllLocalStorage: () => {
    try {
      Object.values(KEYS).forEach((key) => {
        safeRemove(key);
      });
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('finsync_')) {
            safeRemove(key);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to clear localStorage completely:', e);
    }
  },
};
