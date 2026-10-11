export type Currency = 'RUB' | 'USD' | 'EUR';

export type TransactionType = 'expense' | 'income' | 'transfer' | 'saving';
export type TransactionStatus = 'draft' | 'review_needed' | 'confirmed' | 'rejected';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  telegramId?: number;
  username?: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  currency: Currency;
  inviteCode: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  name: string;
  avatar: string;
  role: MemberRole;
  balanceKopecks: number; // in minor units
  isCurrentUser?: boolean;
  telegramUserId?: string | number;
}

export interface FamilySetupData {
  familyId: string;
  familyName: string;
  currency: Currency;
  inviteCode: string;
  userName: string;
  userRole: MemberRole;
  userAvatar: string;
  telegramUserId?: string;
  additionalMembers?: Array<{
    name: string;
    role: MemberRole;
    avatar: string;
  }>;
  startClean: boolean;
}

export interface Category {
  id: string;
  familyId: string;
  name: string;
  icon: string;
  color: string;
  parentId?: string | null;
  subcategories?: string[];
  monthlyBudgetKopecks?: number;
}

export interface Tag {
  id: string;
  name: string;
  familyId: string;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';
export type SyncAction = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;
  transactionId: string;
  action: SyncAction;
  payload: Transaction;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

export interface TransactionSplit {
  id: string;
  transactionId: string;
  memberId: string;
  amountKopecks: number;
}

export interface Transaction {
  id: string;
  familyId: string;
  type: TransactionType;
  amountKopecks: number; // Stored in minor units (kopecks/cents)
  currency: Currency;
  categoryId: string;
  subCategory?: string;
  paidByMemberId: string;
  description: string;
  date: string; // ISO date YYYY-MM-DD
  status: TransactionStatus;
  tags: string[];
  documentId?: string | null;
  splits?: TransactionSplit[];
  createdAt: string;
  syncStatus?: SyncStatus;
  syncedAt?: string;
}

export interface Budget {
  id: string;
  familyId: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitKopecks: number;
  spentKopecks: number;
  notifyThresholdPercent: number;
}

export type DocumentProcessingStatus = 'pending' | 'processing' | 'review_needed' | 'confirmed' | 'failed';

export interface DocumentLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceKopecks: number;
  totalKopecks: number;
}

export interface DocumentExtraction {
  id: string;
  documentId: string;
  merchantName?: string;
  merchantInn?: string;
  receiptDate?: string;
  totalAmountKopecks?: number;
  confidenceScore: number; // 0.0 - 1.0
  suggestedCategoryId?: string;
  rawText: string;
  lineItems: DocumentLineItem[];
}

export interface Document {
  id: string;
  familyId: string;
  uploadedByMemberId: string;
  fileName: string;
  fileUrl?: string;
  fileSize: number;
  mimeType: string;
  status: DocumentProcessingStatus;
  extraction?: DocumentExtraction;
  transactionDraftId?: string;
  createdAt: string;
}

export interface MonthlyForecast {
  currentMonth: string; // YYYY-MM
  daysPassed: number;
  daysTotal: number;
  daysRemaining: number;
  actualSpentKopecks: number;
  dailyAverageKopecks: number;
  projectedSpentKopecks: number;
  totalBudgetKopecks: number;
  varianceKopecks: number; // projected - budget
  isOverBudget: boolean;
}

export interface TelegramDraft {
  type?: 'expense' | 'income' | 'saving' | 'transfer';
  amountKopecks: number;
  description: string;
  categoryId: string;
  goalId?: string;
  subCategory?: string;
}

export interface TelegramBotMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  photoUrl?: string;
  time: string;
  buttons?: { label: string; callbackData: string; style?: 'primary' | 'danger' | 'default' }[];
  draftCard?: {
    merchant: string;
    amountKopecks: number;
    category: string;
    date: string;
    confidence: number;
    draftId: string;
  };
}

export interface MerchantRule {
  id: string;
  pattern: string; // e.g. "вкусвилл", "лукойл"
  categoryId: string;
  subCategory?: string;
  matchCount: number;
  updatedAt: string;
}

export type PeriodFilter = 'current_month' | 'prev_month' | 'quarter' | 'year' | 'all';

export interface SettlementProposal {
  fromMemberId: string;
  toMemberId: string;
  amountKopecks: number;
}

export type SavingsAccountType = 'deposit' | 'savings_account' | 'investment' | 'cash';

export interface SavingsGoal {
  id: string;
  familyId: string;
  name: string;
  description?: string;
  targetKopecks: number;
  currentKopecks: number;
  currency: Currency;
  accountType: SavingsAccountType;
  bankName: string;
  interestRate?: number; // annual % e.g. 18.5
  icon: string;
  color: string;
  targetDate?: string; // YYYY-MM-DD
  monthlyPlanKopecks?: number;
  createdAt: string;
  isArchived?: boolean;
}
