import { 
  Transaction, 
  Category, 
  FamilyMember,
  Family,
  Budget,
  SavingsGoal,
  MerchantRule,
  Currency,
  MemberRole,
  TransactionType,
  TransactionStatus,
  SavingsAccountType
} from '../types';

export function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: Category[],
  members: FamilyMember[]
): void {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const headers = [
    'ID',
    'Дата',
    'Тип',
    'Сумма (руб)',
    'Категория',
    'Кто платил/получил',
    'Описание',
    'Статус',
    'Теги',
  ];

  const rows = transactions.map((t) => {
    const rubles = (t.amountKopecks / 100).toFixed(2);
    const catName = categoryMap.get(t.categoryId) || (t.type === 'transfer' ? 'Перевод' : 'Без категории');
    const memberName = memberMap.get(t.paidByMemberId) || 'Неизвестно';
    const typeLabel = t.type === 'expense' ? 'Расход' : t.type === 'income' ? 'Доход' : 'Перевод';
    const statusLabel = t.status === 'confirmed' ? 'Подтвержден' : 'Черновик';
    const tagsStr = (t.tags || []).join('; ');

    return [
      `"${t.id}"`,
      `"${t.date}"`,
      `"${typeLabel}"`,
      `"${rubles}"`,
      `"${catName.replace(/"/g, '""')}"`,
      `"${memberName.replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${statusLabel}"`,
      `"${tagsStr}"`,
    ].join(';');
  });

  // Include UTF-8 BOM so Excel opens Cyrillic characters properly
  const bom = '\uFEFF';
  const csvContent = bom + [headers.join(';'), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `finsync_transactions_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFullBackupJSON(data: {
  family: unknown;
  members: unknown;
  categories: unknown;
  budgets: unknown;
  transactions: unknown;
  merchantRules: unknown;
  savingsGoals?: unknown;
}): void {
  const jsonStr = JSON.stringify(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'FinSync Family Budget',
      ...data,
    },
    null,
    2
  );

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `finsync_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ValidatedBackupData {
  family?: Family;
  members?: FamilyMember[];
  categories?: Category[];
  budgets?: Budget[];
  transactions?: Transaction[];
  merchantRules?: MerchantRule[];
  savingsGoals?: SavingsGoal[];
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

function isCurrency(val: unknown): val is Currency {
  return val === 'RUB' || val === 'USD' || val === 'EUR';
}

export function validateFamily(val: unknown): Family {
  if (!isObject(val)) {
    throw new Error('Секция "family" должна быть объектом');
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error('Объект "family" не содержит корректного поля "id"');
  }
  if (!isString(val.name) || !val.name.trim()) {
    throw new Error('Объект "family" не содержит корректного поля "name"');
  }
  return {
    id: val.id.trim(),
    name: val.name.trim(),
    currency: isCurrency(val.currency) ? val.currency : 'RUB',
    inviteCode: isString(val.inviteCode) ? val.inviteCode : 'FAM-2026',
    createdAt: isString(val.createdAt) ? val.createdAt : new Date().toISOString(),
  };
}

export function validateMember(val: unknown, index: number): FamilyMember {
  if (!isObject(val)) {
    throw new Error(`Участник #${index + 1} должен быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Участник #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isString(val.name) || !val.name.trim()) {
    throw new Error(`Участник #${index + 1} не содержит корректного поля "name"`);
  }
  const role: MemberRole = val.role === 'owner' || val.role === 'admin' ? val.role : 'member';
  return {
    id: val.id.trim(),
    familyId: isString(val.familyId) ? val.familyId.trim() : 'fam-01',
    userId: isString(val.userId) ? val.userId.trim() : val.id.trim(),
    name: val.name.trim(),
    avatar: isString(val.avatar) && val.avatar.trim() ? val.avatar.trim() : '👤',
    role,
    balanceKopecks: isNumber(val.balanceKopecks) ? Math.round(val.balanceKopecks) : 0,
    isCurrentUser: Boolean(val.isCurrentUser),
    telegramUserId: typeof val.telegramUserId === 'string' || typeof val.telegramUserId === 'number' ? val.telegramUserId : undefined,
  };
}

export function validateCategory(val: unknown, index: number): Category {
  if (!isObject(val)) {
    throw new Error(`Категория #${index + 1} должна быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Категория #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isString(val.name) || !val.name.trim()) {
    throw new Error(`Категория #${index + 1} не содержит корректного поля "name"`);
  }
  return {
    id: val.id.trim(),
    familyId: isString(val.familyId) ? val.familyId.trim() : 'fam-01',
    name: val.name.trim(),
    icon: isString(val.icon) && val.icon.trim() ? val.icon.trim() : 'Tag',
    color: isString(val.color) && val.color.trim() ? val.color.trim() : '#64748b',
    parentId: isString(val.parentId) ? val.parentId.trim() : null,
    subcategories: Array.isArray(val.subcategories) ? val.subcategories.filter(isString) : [],
    monthlyBudgetKopecks: isNumber(val.monthlyBudgetKopecks) ? Math.round(val.monthlyBudgetKopecks) : undefined,
  };
}

export function validateBudget(val: unknown, index: number): Budget {
  if (!isObject(val)) {
    throw new Error(`Бюджет #${index + 1} должен быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Бюджет #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isString(val.categoryId) || !val.categoryId.trim()) {
    throw new Error(`Бюджет #${index + 1} не содержит корректного поля "categoryId"`);
  }
  return {
    id: val.id.trim(),
    familyId: isString(val.familyId) ? val.familyId.trim() : 'fam-01',
    categoryId: val.categoryId.trim(),
    month: isString(val.month) && /^\d{4}-\d{2}$/.test(val.month) ? val.month : new Date().toISOString().slice(0, 7),
    limitKopecks: isNumber(val.limitKopecks) && val.limitKopecks >= 0 ? Math.round(val.limitKopecks) : 0,
    spentKopecks: isNumber(val.spentKopecks) ? Math.round(val.spentKopecks) : 0,
    notifyThresholdPercent: isNumber(val.notifyThresholdPercent) ? val.notifyThresholdPercent : 85,
  };
}

export function validateTransaction(val: unknown, index: number): Transaction {
  if (!isObject(val)) {
    throw new Error(`Операция #${index + 1} должна быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Операция #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isNumber(val.amountKopecks)) {
    throw new Error(`Операция #${index + 1} (${val.id || 'без ID'}) содержит некорректную сумму amountKopecks`);
  }
  const type: TransactionType = 
    val.type === 'income' || val.type === 'transfer' || val.type === 'saving' ? val.type : 'expense';
  const status: TransactionStatus =
    val.status === 'draft' || val.status === 'review_needed' || val.status === 'rejected' ? val.status : 'confirmed';

  return {
    id: val.id.trim(),
    familyId: isString(val.familyId) ? val.familyId.trim() : 'fam-01',
    type,
    amountKopecks: Math.round(val.amountKopecks),
    currency: isCurrency(val.currency) ? val.currency : 'RUB',
    categoryId: isString(val.categoryId) ? val.categoryId.trim() : 'cat-other',
    subCategory: isString(val.subCategory) ? val.subCategory.trim() : undefined,
    paidByMemberId: isString(val.paidByMemberId) ? val.paidByMemberId.trim() : 'm-1',
    description: isString(val.description) ? val.description : '',
    date: isString(val.date) && val.date.trim() ? val.date.trim() : new Date().toISOString().split('T')[0],
    status,
    tags: Array.isArray(val.tags) ? val.tags.filter(isString) : [],
    documentId: isString(val.documentId) ? val.documentId : null,
    createdAt: isString(val.createdAt) ? val.createdAt : new Date().toISOString(),
    syncStatus: val.syncStatus === 'pending' || val.syncStatus === 'syncing' || val.syncStatus === 'failed' ? val.syncStatus : 'synced',
    syncedAt: isString(val.syncedAt) ? val.syncedAt : undefined,
  };
}

export function validateSavingsGoal(val: unknown, index: number): SavingsGoal {
  if (!isObject(val)) {
    throw new Error(`Цель накоплений #${index + 1} должна быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Цель накоплений #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isString(val.name) || !val.name.trim()) {
    throw new Error(`Цель накоплений #${index + 1} не содержит корректного поля "name"`);
  }
  const accountType: SavingsAccountType =
    val.accountType === 'deposit' || val.accountType === 'investment' || val.accountType === 'cash'
      ? val.accountType
      : 'savings_account';

  return {
    id: val.id.trim(),
    familyId: isString(val.familyId) ? val.familyId.trim() : 'fam-01',
    name: val.name.trim(),
    description: isString(val.description) ? val.description : undefined,
    targetKopecks: isNumber(val.targetKopecks) && val.targetKopecks >= 0 ? Math.round(val.targetKopecks) : 0,
    currentKopecks: isNumber(val.currentKopecks) ? Math.round(val.currentKopecks) : 0,
    currency: isCurrency(val.currency) ? val.currency : 'RUB',
    accountType,
    bankName: isString(val.bankName) && val.bankName.trim() ? val.bankName.trim() : 'Банк',
    interestRate: isNumber(val.interestRate) ? val.interestRate : undefined,
    icon: isString(val.icon) && val.icon.trim() ? val.icon.trim() : 'PiggyBank',
    color: isString(val.color) && val.color.trim() ? val.color.trim() : '#10b981',
    targetDate: isString(val.targetDate) ? val.targetDate : undefined,
    monthlyPlanKopecks: isNumber(val.monthlyPlanKopecks) ? Math.round(val.monthlyPlanKopecks) : undefined,
    createdAt: isString(val.createdAt) ? val.createdAt : new Date().toISOString(),
    isArchived: Boolean(val.isArchived),
  };
}

export function validateMerchantRule(val: unknown, index: number): MerchantRule {
  if (!isObject(val)) {
    throw new Error(`Правило мерчанта #${index + 1} должно быть объектом`);
  }
  if (!isString(val.id) || !val.id.trim()) {
    throw new Error(`Правило мерчанта #${index + 1} не содержит корректного поля "id"`);
  }
  if (!isString(val.pattern) || !val.pattern.trim()) {
    throw new Error(`Правило мерчанта #${index + 1} не содержит корректного поля "pattern"`);
  }
  if (!isString(val.categoryId) || !val.categoryId.trim()) {
    throw new Error(`Правило мерчанта #${index + 1} не содержит корректного поля "categoryId"`);
  }
  return {
    id: val.id.trim(),
    pattern: val.pattern.trim(),
    categoryId: val.categoryId.trim(),
    subCategory: isString(val.subCategory) ? val.subCategory.trim() : undefined,
    matchCount: isNumber(val.matchCount) ? Math.round(val.matchCount) : 1,
    updatedAt: isString(val.updatedAt) ? val.updatedAt : new Date().toISOString(),
  };
}

export function validateBackupJSON(raw: unknown): ValidatedBackupData {
  if (!isObject(raw)) {
    throw new Error('Файл резервной копии должен содержать объект JSON');
  }

  const result: ValidatedBackupData = {};
  let hasValidSection = false;

  // 1. Family
  if (raw.family !== undefined) {
    result.family = validateFamily(raw.family);
    hasValidSection = true;
  }

  // 2. Members
  if (raw.members !== undefined) {
    if (!Array.isArray(raw.members)) {
      throw new Error('Секция "members" должна быть массивом');
    }
    result.members = raw.members.map((m, idx) => validateMember(m, idx));
    hasValidSection = true;
  }

  // 3. Categories
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories)) {
      throw new Error('Секция "categories" должна быть массивом');
    }
    result.categories = raw.categories.map((c, idx) => validateCategory(c, idx));
    hasValidSection = true;
  }

  // 4. Budgets
  if (raw.budgets !== undefined) {
    if (!Array.isArray(raw.budgets)) {
      throw new Error('Секция "budgets" должна быть массивом');
    }
    result.budgets = raw.budgets.map((b, idx) => validateBudget(b, idx));
    hasValidSection = true;
  }

  // 5. Transactions
  if (raw.transactions !== undefined) {
    if (!Array.isArray(raw.transactions)) {
      throw new Error('Секция "transactions" должна быть массивом');
    }
    result.transactions = raw.transactions.map((t, idx) => validateTransaction(t, idx));
    hasValidSection = true;
  }

  // 6. Savings Goals
  if (raw.savingsGoals !== undefined) {
    if (!Array.isArray(raw.savingsGoals)) {
      throw new Error('Секция "savingsGoals" должна быть массивом');
    }
    result.savingsGoals = raw.savingsGoals.map((g, idx) => validateSavingsGoal(g, idx));
    hasValidSection = true;
  }

  // 7. Merchant Rules
  if (raw.merchantRules !== undefined) {
    if (!Array.isArray(raw.merchantRules)) {
      throw new Error('Секция "merchantRules" должна быть массивом');
    }
    result.merchantRules = raw.merchantRules.map((r, idx) => validateMerchantRule(r, idx));
    hasValidSection = true;
  }

  if (!hasValidSection || (!result.transactions && !result.members && !result.family)) {
    throw new Error('Файл резервной копии не содержит распознаваемых данных (family, members, transactions)');
  }

  return result;
}

export function parseImportBackupJSON(file: File): Promise<ValidatedBackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string' || !text.trim()) {
          throw new Error('Файл резервной копии пуст');
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Файл повреждён или не является валидным JSON');
        }
        const validated = validateBackupJSON(parsed);
        resolve(validated);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file);
  });
}
