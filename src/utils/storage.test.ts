import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage';
import { Transaction } from '../types';

describe('StorageService (Local-first persistence with offline queueing)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads initial default family data when localStorage is empty', () => {
    const family = StorageService.getFamily();
    expect(family).toBeDefined();
    expect(family.name).toBe('Семейный бюджет');
    expect(family.currency).toBe('RUB');

    const members = StorageService.getMembers();
    expect(members.length).toBeGreaterThan(0);
    expect(members[0].name).toBeDefined();

    const categories = StorageService.getCategories();
    expect(categories.length).toBeGreaterThan(0);
  });

  it('persists and retrieves updated transactions', () => {
    const initialTxs = StorageService.getTransactions();
    const testTx: Transaction = {
      id: 'tx-test-12345',
      familyId: 'fam-01',
      type: 'expense',
      amountKopecks: 75000,
      currency: 'RUB',
      categoryId: 'cat-groceries',
      paidByMemberId: 'mem-01',
      description: 'Тестовая покупка продуктов',
      date: '2026-09-10',
      status: 'confirmed',
      tags: [],
      createdAt: new Date().toISOString(),
      splits: [],
    };

    StorageService.setTransactions([testTx, ...initialTxs]);
    const loaded = StorageService.getTransactions();
    expect(loaded[0].id).toBe('tx-test-12345');
    expect(loaded[0].amountKopecks).toBe(75000);
  });

  it('handles offline sync queue operations (add, retrieve, clear)', () => {
    expect(StorageService.getSyncQueue().length).toBe(0);

    const testTx: Transaction = {
      id: 'tx-offline-1',
      familyId: 'fam-01',
      type: 'expense',
      amountKopecks: 5000,
      currency: 'RUB',
      categoryId: 'cat-groceries',
      paidByMemberId: 'mem-01',
      description: 'Офлайн транзакция',
      date: '2026-09-10',
      status: 'draft',
      tags: [],
      createdAt: new Date().toISOString(),
      splits: [],
    };

    StorageService.addToSyncQueue('create', testTx);

    const queue = StorageService.getSyncQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].transactionId).toBe('tx-offline-1');
    expect(queue[0].action).toBe('create');
    expect(queue[0].payload.amountKopecks).toBe(5000);

    StorageService.clearSyncQueue();
    expect(StorageService.getSyncQueue().length).toBe(0);
  });

  it('resets all collections to default initial state cleanly', () => {
    StorageService.setTransactions([]);
    expect(StorageService.getTransactions().length).toBe(0);

    StorageService.resetToInitial();
    expect(StorageService.getFamily().name).toBe('Семейный бюджет');
  });

  it('learns and matches merchant category rules dynamically', () => {
    StorageService.learnMerchantRule('Wildberries', 'cat-clothing');
    const matched = StorageService.matchMerchantCategory('Оплата в wildberries интернет-магазин');
    expect(matched).toBe('cat-clothing');
  });

  it('optimizes state loading via single-parse bundled storage', () => {
    const initialState = {
      family: StorageService.getFamily(),
      members: StorageService.getMembers(),
      categories: StorageService.getCategories(),
      budgets: StorageService.getBudgets(),
      transactions: StorageService.getTransactions(),
      savingsGoals: StorageService.getSavingsGoals(),
    };

    StorageService.saveState(initialState);
    const loadedState = StorageService.loadState();
    expect(loadedState).not.toBeNull();
    expect(loadedState?.family.name).toBe('Семейный бюджет');
    expect(loadedState?.transactions.length).toBe(initialState.transactions.length);
  });
});
