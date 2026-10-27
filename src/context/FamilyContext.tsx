import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  useMemo, 
  useCallback, 
  ReactNode 
} from 'react';
import confetti from 'canvas-confetti';
import { 
  Family, 
  FamilyMember, 
  Category, 
  Budget, 
  Transaction, 
  MonthlyForecast,
  SavingsGoal, 
  MerchantRule, 
  FamilySetupData 
} from '../types';
import { StorageService } from '../utils/storage';
import { backgroundSyncService } from '../utils/backgroundSync';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { authFetch } from '../utils/auth';

export interface FamilyState {
  family: Family;
  members: FamilyMember[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  merchantRules: MerchantRule[];
  activeTab: 'overview' | 'budgets' | 'transactions' | 'members';
  isDark: boolean;
  isSetupWizardOpen: boolean;
  editingTransaction: Transaction | null;
}

export type ModalName = 'setupWizard';

export type FamilyAction =
  | { type: 'SET_ACTIVE_TAB'; payload: 'overview' | 'budgets' | 'transactions' | 'members' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_THEME'; payload: boolean }
  | { type: 'OPEN_MODAL'; payload: ModalName }
  | { type: 'CLOSE_MODAL'; payload: ModalName }
  | { type: 'SET_EDITING_TRANSACTION'; payload: Transaction | null }
  | { type: 'CONFIRM_DRAFT'; payload: { draftId: string; isOnline: boolean } }
  | { type: 'REJECT_DRAFT'; payload: string }
  | { type: 'ADD_TRANSACTION'; payload: { tx: Transaction } }
  | { type: 'UPDATE_TRANSACTION'; payload: { tx: Transaction } }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'UPDATE_BUDGET_LIMIT'; payload: { categoryId: string; limitKopecks: number } }
  | { type: 'MEMBER_TRANSFER'; payload: { transferTx: Transaction; fromMemberId: string; toMemberId: string; amountKopecks: number } }
  | { type: 'ADD_SAVING_GOAL'; payload: SavingsGoal }
  | { type: 'DELETE_SAVING_GOAL'; payload: string }
  | { type: 'DEPOSIT_SAVING_GOAL'; payload: { goalId: string; amountKopecks: number; tx: Transaction } }
  | { type: 'WITHDRAW_SAVING_GOAL'; payload: { goalId: string; amountKopecks: number; tx: Transaction } }
  | { type: 'CONFIRM_TELEGRAM_DRAFT'; payload: { tx: Transaction; goalId?: string } }
  | { type: 'COMPLETE_SETUP'; payload: {
      family: Family;
      members: FamilyMember[];
      categories: Category[];
      budgets: Budget[];
      transactions: Transaction[];
      savingsGoals: SavingsGoal[];
    } }
  | { type: 'SET_TRANSACTIONS_FROM_SYNC'; payload: Transaction[] };

export function getInitialFamilyState(): FamilyState {
  const saved = StorageService.loadState();
  const savedTheme = StorageService.loadTheme();

  return {
    family: saved?.family || StorageService.getFamily(),
    members: saved?.members || StorageService.getMembers(),
    categories: StorageService.getCategories(),
    budgets: StorageService.getBudgets(),
    transactions: (saved?.transactions && saved.transactions.length > 0) 
      ? saved.transactions 
      : StorageService.getTransactions(),
    savingsGoals: saved?.savingsGoals || StorageService.getSavingsGoals(),
    merchantRules: StorageService.getMerchantRules(),
    activeTab: 'overview',
    isDark: savedTheme ? savedTheme === 'dark' : true,
    isSetupWizardOpen: false,
    editingTransaction: null,
  };
}

export function familyReducer(state: FamilyState, action: FamilyAction): FamilyState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'TOGGLE_THEME':
      return { ...state, isDark: !state.isDark };

    case 'SET_THEME':
      return { ...state, isDark: action.payload };

    case 'OPEN_MODAL':
      switch (action.payload) {
        case 'setupWizard': return { ...state, isSetupWizardOpen: true };
      }
      return state;

    case 'CLOSE_MODAL':
      switch (action.payload) {
        case 'setupWizard': return { ...state, isSetupWizardOpen: false };
      }
      return state;

    case 'SET_EDITING_TRANSACTION':
      return { ...state, editingTransaction: action.payload };

    case 'CONFIRM_DRAFT':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.draftId
            ? {
                ...t,
                status: 'confirmed',
                syncStatus: action.payload.isOnline ? 'synced' : 'pending',
                syncedAt: action.payload.isOnline ? new Date().toISOString() : undefined,
              }
            : t
        ),
      };

    case 'REJECT_DRAFT':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
      };

    case 'ADD_TRANSACTION': {
      const { tx } = action.payload;
      const updatedMembers = tx.type === 'expense'
        ? state.members.map((m) =>
            m.id === tx.paidByMemberId
              ? { ...m, balanceKopecks: m.balanceKopecks + tx.amountKopecks }
              : m
          )
        : state.members;

      return {
        ...state,
        transactions: [tx, ...state.transactions],
        members: updatedMembers,
      };
    }

    case 'UPDATE_TRANSACTION': {
      const { tx } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === tx.id ? tx : t)),
        editingTransaction: null,
      };
    }

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
        editingTransaction: null,
      };

    case 'UPDATE_BUDGET_LIMIT':
      return {
        ...state,
        budgets: state.budgets.map((b) =>
          b.categoryId === action.payload.categoryId
            ? { ...b, limitKopecks: action.payload.limitKopecks }
            : b
        ),
      };

    case 'MEMBER_TRANSFER': {
      const { transferTx, fromMemberId, toMemberId, amountKopecks } = action.payload;
      return {
        ...state,
        transactions: [transferTx, ...state.transactions],
        members: state.members.map((m) => {
          if (m.id === fromMemberId) {
            return { ...m, balanceKopecks: m.balanceKopecks + amountKopecks };
          }
          if (m.id === toMemberId) {
            return { ...m, balanceKopecks: m.balanceKopecks - amountKopecks };
          }
          return m;
        }),
      };
    }

    case 'ADD_SAVING_GOAL':
      return {
        ...state,
        savingsGoals: [action.payload, ...state.savingsGoals],
      };

    case 'DELETE_SAVING_GOAL':
      return {
        ...state,
        savingsGoals: state.savingsGoals.filter((g) => g.id !== action.payload),
      };

    case 'DEPOSIT_SAVING_GOAL': {
      const { goalId, amountKopecks, tx } = action.payload;
      return {
        ...state,
        savingsGoals: state.savingsGoals.map((g) =>
          g.id === goalId ? { ...g, currentKopecks: g.currentKopecks + amountKopecks } : g
        ),
        transactions: [tx, ...state.transactions],
      };
    }

    case 'WITHDRAW_SAVING_GOAL': {
      const { goalId, amountKopecks, tx } = action.payload;
      return {
        ...state,
        savingsGoals: state.savingsGoals.map((g) =>
          g.id === goalId
            ? { ...g, currentKopecks: Math.max(0, g.currentKopecks - amountKopecks) }
            : g
        ),
        transactions: [tx, ...state.transactions],
      };
    }

    case 'CONFIRM_TELEGRAM_DRAFT': {
      const { tx, goalId } = action.payload;
      const updatedSavingsGoals = tx.type === 'saving' && goalId
        ? state.savingsGoals.map((g) =>
            g.id === goalId ? { ...g, currentKopecks: g.currentKopecks + tx.amountKopecks } : g
          )
        : state.savingsGoals;

      const updatedMembers = tx.type === 'expense'
        ? state.members.map((m) =>
            m.id === tx.paidByMemberId
              ? { ...m, balanceKopecks: m.balanceKopecks + tx.amountKopecks }
              : m
          )
        : state.members;

      return {
        ...state,
        transactions: [tx, ...state.transactions],
        savingsGoals: updatedSavingsGoals,
        members: updatedMembers,
      };
    }

    case 'COMPLETE_SETUP':
      return {
        ...state,
        family: action.payload.family,
        members: action.payload.members,
        categories: action.payload.categories,
        budgets: action.payload.budgets,
        transactions: action.payload.transactions,
        savingsGoals: action.payload.savingsGoals,
        isSetupWizardOpen: false,
      };

    case 'SET_TRANSACTIONS_FROM_SYNC':
      return {
        ...state,
        transactions: action.payload,
      };

    default:
      return state;
  }
}

export interface FamilyContextValue {
  state: FamilyState;
  dispatch: React.Dispatch<FamilyAction>;
  forecast: MonthlyForecast;
  pendingDraftsCount: number;
  syncInfo: {
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    syncNow: () => Promise<void>;
  };
  // Memoized handlers
  handleCompleteSetup: (data: FamilySetupData) => void;
  handleConfirmDraft: (draftId: string) => void;
  handleRejectDraft: (draftId: string) => void;
  handleAddTransaction: (newTx: Transaction) => void;
  handleUpdateTransaction: (updatedTx: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  handleUpdateBudgetLimit: (categoryId: string, newLimitKopecks: number) => void;
  handleAddMemberTransfer: (fromMemberId: string, toMemberId: string, amountKopecks: number) => void;
  handleAddSavingGoal: (goal: SavingsGoal) => void;
  handleDeleteSavingGoal: (goalId: string) => void;
  handleDepositSavingGoal: (goalId: string, amountKopecks: number, memberId?: string, isInterest?: boolean) => void;
  handleWithdrawSavingGoal: (goalId: string, amountKopecks: number, memberId?: string) => void;
  handleConfirmTelegramDraft: (draft: {
    type?: 'expense' | 'income' | 'saving' | 'transfer';
    amountKopecks: number;
    description: string;
    categoryId: string;
    goalId?: string;
    subCategory?: string;
  }) => void;
  // Modal helpers
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  setEditingTransaction: (tx: Transaction | null) => void;
  setActiveTab: (tab: 'overview' | 'budgets' | 'transactions' | 'members') => void;
  toggleTheme: () => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(familyReducer, undefined, getInitialFamilyState);
  const { isOnline, isSyncing, pendingCount, syncNow } = useBackgroundSync();

  // Listen for background sync updates to synchronize transaction status
  useEffect(() => {
    const unsubscribe = backgroundSyncService.subscribe((event) => {
      if (event.type === 'sync-success') {
        const storedTransactions = StorageService.getTransactions();
        if (storedTransactions && storedTransactions.length > 0) {
          dispatch({ type: 'SET_TRANSACTIONS_FROM_SYNC', payload: storedTransactions });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronize state changes to LocalStorage persistence layer
  useEffect(() => {
    if (!StorageService.isConfigured()) return;
    StorageService.saveState({
      family: state.family,
      members: state.members,
      categories: state.categories,
      budgets: state.budgets,
      transactions: state.transactions,
      savingsGoals: state.savingsGoals,
    });
  }, [state.family, state.members, state.categories, state.budgets, state.transactions, state.savingsGoals]);

  // Dark/Light mode DOM synchronization & persistence
  useEffect(() => {
    if (state.isDark) {
      document.documentElement.classList.add('dark');
      StorageService.saveTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      StorageService.saveTheme('light');
    }
  }, [state.isDark]);

  // Compute end-of-month linear forecast
  const forecast = useMemo<MonthlyForecast>(() => {
    const now = new Date();
    const daysTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const daysRemaining = Math.max(0, daysTotal - daysPassed);
    const currentMonth = now.toISOString().slice(0, 7);

    const confirmedExpensesKopecks = state.transactions
      .filter((t) => t.status === 'confirmed' && t.type === 'expense')
      .reduce((sum, t) => sum + t.amountKopecks, 0);

    const totalBudgetKopecks = state.budgets.reduce((sum, b) => sum + b.limitKopecks, 0);

    const dailyAverageKopecks = Math.round(confirmedExpensesKopecks / Math.max(1, daysPassed));
    const projectedSpentKopecks = dailyAverageKopecks * daysTotal;
    const varianceKopecks = projectedSpentKopecks - totalBudgetKopecks;

    return {
      currentMonth,
      daysPassed,
      daysTotal,
      daysRemaining,
      actualSpentKopecks: confirmedExpensesKopecks,
      dailyAverageKopecks,
      projectedSpentKopecks,
      totalBudgetKopecks,
      varianceKopecks,
      isOverBudget: varianceKopecks > 0,
    };
  }, [state.transactions, state.budgets]);

  // Count pending OCR drafts
  const pendingDraftsCount = useMemo(() => {
    return state.transactions.filter((t) => t.status === 'review_needed' || t.status === 'draft').length;
  }, [state.transactions]);

  // useCallback Handlers
  const handleCompleteSetup = useCallback((data: FamilySetupData) => {
    const newState = StorageService.setupFamily(data);
    dispatch({
      type: 'COMPLETE_SETUP',
      payload: {
        family: newState.family,
        members: newState.members,
        categories: newState.categories,
        budgets: newState.budgets,
        transactions: newState.transactions,
        savingsGoals: newState.savingsGoals,
      },
    });

    try {
      authFetch('/api/family/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_id: newState.family.id,
          name: newState.family.name,
          currency: newState.family.currency,
          invite_code: newState.family.inviteCode,
          members: newState.members.map((m) => ({
            name: m.name,
            role: m.role,
            avatar_emoji: m.avatar,
            telegram_user_id: m.telegramUserId,
          })),
        }),
      }).catch((e) => console.warn('Backend sync optional notice:', e));
    } catch {
      // ignore
    }
  }, []);

  const handleConfirmDraft = useCallback((draftId: string) => {
    const targetTx = state.transactions.find((t) => t.id === draftId);
    if (targetTx) {
      const confirmedTx: Transaction = {
        ...targetTx,
        status: 'confirmed',
        syncStatus: isOnline ? 'synced' : 'pending',
        syncedAt: isOnline ? new Date().toISOString() : undefined,
      };
      backgroundSyncService.bufferTransaction('update', confirmedTx);
    }
    dispatch({ type: 'CONFIRM_DRAFT', payload: { draftId, isOnline } });
    confetti({ particleCount: 40, spread: 50 });
  }, [state.transactions, isOnline]);

  const handleRejectDraft = useCallback((draftId: string) => {
    const target = state.transactions.find((t) => t.id === draftId);
    if (target) {
      backgroundSyncService.bufferTransaction('delete', target);
    }
    dispatch({ type: 'REJECT_DRAFT', payload: draftId });
  }, [state.transactions]);

  const handleAddTransaction = useCallback((newTx: Transaction) => {
    const txWithStatus: Transaction = {
      ...newTx,
      syncStatus: isOnline ? 'synced' : 'pending',
      syncedAt: isOnline ? new Date().toISOString() : undefined,
    };
    dispatch({ type: 'ADD_TRANSACTION', payload: { tx: txWithStatus } });
    backgroundSyncService.bufferTransaction('create', txWithStatus);
  }, [isOnline]);

  const handleUpdateTransaction = useCallback((updatedTx: Transaction) => {
    const txWithStatus: Transaction = {
      ...updatedTx,
      syncStatus: isOnline ? 'synced' : 'pending',
      syncedAt: isOnline ? new Date().toISOString() : undefined,
    };
    dispatch({ type: 'UPDATE_TRANSACTION', payload: { tx: txWithStatus } });
    backgroundSyncService.bufferTransaction('update', txWithStatus);
  }, [isOnline]);

  const handleDeleteTransaction = useCallback((id: string) => {
    const target = state.transactions.find((t) => t.id === id);
    if (target) {
      backgroundSyncService.bufferTransaction('delete', target);
    }
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  }, [state.transactions]);

  const handleUpdateBudgetLimit = useCallback((categoryId: string, newLimitKopecks: number) => {
    dispatch({ type: 'UPDATE_BUDGET_LIMIT', payload: { categoryId, limitKopecks: newLimitKopecks } });
  }, []);

  const handleAddMemberTransfer = useCallback((fromMemberId: string, toMemberId: string, amountKopecks: number) => {
    const fromMember = state.members.find((m) => m.id === fromMemberId);
    const toMember = state.members.find((m) => m.id === toMemberId);

    const transferTx: Transaction = {
      id: `tx-transfer-${Date.now()}`,
      familyId: state.family.id,
      type: 'transfer',
      amountKopecks,
      currency: 'RUB',
      categoryId: 'cat-transfer',
      paidByMemberId: fromMemberId,
      description: `Перевод: ${fromMember?.name} ➡️ ${toMember?.name}`,
      date: new Date().toISOString().split('T')[0],
      status: 'confirmed',
      syncStatus: isOnline ? 'synced' : 'pending',
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      tags: ['перевод', 'взаиморасчет'],
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'MEMBER_TRANSFER',
      payload: { transferTx, fromMemberId, toMemberId, amountKopecks },
    });
    backgroundSyncService.bufferTransaction('create', transferTx);
    confetti({ particleCount: 35, spread: 45 });
  }, [state.family.id, state.members, isOnline]);

  const handleAddSavingGoal = useCallback((goal: SavingsGoal) => {
    dispatch({ type: 'ADD_SAVING_GOAL', payload: goal });
    confetti({ particleCount: 40, spread: 50 });
  }, []);

  const handleDeleteSavingGoal = useCallback((goalId: string) => {
    dispatch({ type: 'DELETE_SAVING_GOAL', payload: goalId });
  }, []);

  const handleDepositSavingGoal = useCallback((
    goalId: string,
    amountKopecks: number,
    memberId?: string,
    isInterest?: boolean
  ) => {
    const targetGoal = state.savingsGoals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const payerId = memberId || state.members[0]?.id || 'm-1';
    const tx: Transaction = {
      id: `tx-save-${Date.now()}`,
      familyId: state.family.id,
      type: isInterest ? 'income' : 'saving',
      amountKopecks,
      currency: 'RUB',
      categoryId: 'cat-savings',
      subCategory: targetGoal.name,
      paidByMemberId: payerId,
      description: isInterest
        ? `Проценты по вкладу: ${targetGoal.name} (${targetGoal.bankName})`
        : `Пополнение цели: ${targetGoal.name}`,
      date: new Date().toISOString().split('T')[0],
      status: 'confirmed',
      syncStatus: isOnline ? 'synced' : 'pending',
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      tags: ['копилка', 'накопления', ...(isInterest ? ['проценты', 'доход'] : [])],
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'DEPOSIT_SAVING_GOAL',
      payload: { goalId, amountKopecks, tx },
    });
    backgroundSyncService.bufferTransaction('create', tx);
    confetti({ particleCount: 35, spread: 50 });
  }, [state.savingsGoals, state.members, state.family.id, isOnline]);

  const handleWithdrawSavingGoal = useCallback((
    goalId: string,
    amountKopecks: number,
    memberId?: string
  ) => {
    const targetGoal = state.savingsGoals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const payerId = memberId || state.members[0]?.id || 'm-1';
    const tx: Transaction = {
      id: `tx-withdraw-${Date.now()}`,
      familyId: state.family.id,
      type: 'income',
      amountKopecks,
      currency: 'RUB',
      categoryId: 'cat-savings',
      subCategory: targetGoal.name,
      paidByMemberId: payerId,
      description: `Снятие из копилки: ${targetGoal.name}`,
      date: new Date().toISOString().split('T')[0],
      status: 'confirmed',
      tags: ['копилка', 'снятие'],
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'WITHDRAW_SAVING_GOAL',
      payload: { goalId, amountKopecks, tx },
    });
    confetti({ particleCount: 25, spread: 40 });
  }, [state.savingsGoals, state.members, state.family.id]);

  const handleConfirmTelegramDraft = useCallback((draft: {
    type?: 'expense' | 'income' | 'saving' | 'transfer';
    amountKopecks: number;
    description: string;
    categoryId: string;
    goalId?: string;
    subCategory?: string;
  }) => {
    const txType = draft.type || 'expense';
    const newTx: Transaction = {
      id: `tx-tg-${Date.now()}`,
      familyId: state.family.id,
      type: txType,
      amountKopecks: draft.amountKopecks,
      currency: 'RUB',
      categoryId: draft.categoryId || (txType === 'saving' ? 'cat-savings' : 'cat-groceries'),
      subCategory: draft.subCategory,
      paidByMemberId: state.members[0]?.id || 'm-1',
      description: draft.description,
      date: new Date().toISOString().split('T')[0],
      status: 'confirmed',
      syncStatus: isOnline ? 'synced' : 'pending',
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      tags: ['telegram', 'бот', ...(txType === 'saving' ? ['копилка', 'накопления'] : [])],
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'CONFIRM_TELEGRAM_DRAFT',
      payload: { tx: newTx, goalId: draft.goalId },
    });
    backgroundSyncService.bufferTransaction('create', newTx);
  }, [state.family.id, state.members, isOnline]);

  // Modal helpers
  const openSetupWizard = useCallback(() => dispatch({ type: 'OPEN_MODAL', payload: 'setupWizard' }), []);
  const closeSetupWizard = useCallback(() => dispatch({ type: 'CLOSE_MODAL', payload: 'setupWizard' }), []);
  const setEditingTransaction = useCallback((tx: Transaction | null) => dispatch({ type: 'SET_EDITING_TRANSACTION', payload: tx }), []);
  const setActiveTab = useCallback((tab: 'overview' | 'budgets' | 'transactions' | 'members') => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }), []);
  const toggleTheme = useCallback(() => dispatch({ type: 'TOGGLE_THEME' }), []);

  const value: FamilyContextValue = useMemo(() => ({
    state,
    dispatch,
    forecast,
    pendingDraftsCount,
    syncInfo: { isOnline, isSyncing, pendingCount, syncNow },
    handleCompleteSetup,
    handleConfirmDraft,
    handleRejectDraft,
    handleAddTransaction,
    handleUpdateTransaction,
    handleDeleteTransaction,
    handleUpdateBudgetLimit,
    handleAddMemberTransfer,
    handleAddSavingGoal,
    handleDeleteSavingGoal,
    handleDepositSavingGoal,
    handleWithdrawSavingGoal,
    handleConfirmTelegramDraft,
    openSetupWizard,
    closeSetupWizard,
    setEditingTransaction,
    setActiveTab,
    toggleTheme,
  }), [
    state,
    forecast,
    pendingDraftsCount,
    isOnline,
    isSyncing,
    pendingCount,
    syncNow,
    handleCompleteSetup,
    handleConfirmDraft,
    handleRejectDraft,
    handleAddTransaction,
    handleUpdateTransaction,
    handleDeleteTransaction,
    handleUpdateBudgetLimit,
    handleAddMemberTransfer,
    handleAddSavingGoal,
    handleDeleteSavingGoal,
    handleDepositSavingGoal,
    handleWithdrawSavingGoal,
    handleConfirmTelegramDraft,
    openSetupWizard,
    closeSetupWizard,
    setEditingTransaction,
    setActiveTab,
    toggleTheme,
  ]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
