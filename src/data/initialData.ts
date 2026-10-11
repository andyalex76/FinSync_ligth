import { Family, FamilyMember, Category, Transaction, Budget, Document, SavingsGoal } from '../types';

const currentIsoMonth = new Date().toISOString().slice(0, 7);
const nowIso = new Date().toISOString();

export const INITIAL_FAMILY: Family = {
  id: 'fam-01',
  name: 'Семейный бюджет',
  currency: 'RUB',
  inviteCode: 'FINSYNC-77',
  createdAt: nowIso,
};

export const INITIAL_MEMBERS: FamilyMember[] = [
  {
    id: 'mem-01',
    familyId: 'fam-01',
    userId: 'usr-01',
    name: 'Алексей (Вы)',
    avatar: '👨‍💼',
    role: 'owner',
    balanceKopecks: 0,
    isCurrentUser: true,
  },
  {
    id: 'mem-02',
    familyId: 'fam-01',
    userId: 'usr-02',
    name: 'Елена',
    avatar: '👩‍⚕️',
    role: 'admin',
    balanceKopecks: 0,
  },
  {
    id: 'mem-03',
    familyId: 'fam-01',
    userId: 'usr-03',
    name: 'Михаил (Сын)',
    avatar: '🧑‍🎓',
    role: 'member',
    balanceKopecks: 0,
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-groceries',
    familyId: 'fam-01',
    name: 'Продукты',
    icon: 'ShoppingCart',
    color: 'emerald',
    subcategories: ['Супермаркет', 'Фрукты/Овощи', 'ВкусВилл', 'Мясо/Рыба'],
    monthlyBudgetKopecks: 4500000, // 45 000.00 ₽
  },
  {
    id: 'cat-housing',
    familyId: 'fam-01',
    name: 'Жилье и ЖКХ',
    icon: 'Home',
    color: 'blue',
    subcategories: ['Квартплата', 'Электричество', 'Интернет', 'Бытовая химия'],
    monthlyBudgetKopecks: 1800000, // 18 000.00 ₽
  },
  {
    id: 'cat-auto',
    familyId: 'fam-01',
    name: 'Авто и Транспорт',
    icon: 'Car',
    color: 'amber',
    subcategories: ['Бензин', 'Парковка', 'Метро/Тройка', 'ТО и мойка'],
    monthlyBudgetKopecks: 2000000, // 20 000.00 ₽
  },
  {
    id: 'cat-cafes',
    familyId: 'fam-01',
    name: 'Кафе и Доставка',
    icon: 'Utensils',
    color: 'orange',
    subcategories: ['Бизнес-ланчи', 'Кофе с собой', 'Доставка еды', 'Рестораны'],
    monthlyBudgetKopecks: 1500000, // 15 000.00 ₽
  },
  {
    id: 'cat-health',
    familyId: 'fam-01',
    name: 'Здоровье и Аптека',
    icon: 'HeartPulse',
    color: 'rose',
    subcategories: ['Лекарства', 'Витамины', 'Врачи', 'Стоматолог'],
    monthlyBudgetKopecks: 1000000, // 10 000.00 ₽
  },
  {
    id: 'cat-leisure',
    familyId: 'fam-01',
    name: 'Развлечения и Хобби',
    icon: 'Sparkles',
    color: 'purple',
    subcategories: ['Кино', 'Книги', 'Спортзал', 'Подписки'],
    monthlyBudgetKopecks: 800000, // 8 000.00 ₽
  },
  {
    id: 'cat-clothes',
    familyId: 'fam-01',
    name: 'Одежда и Обувь',
    icon: 'Shirt',
    color: 'indigo',
    subcategories: ['Сезонная одежда', 'Обувь', 'Детское'],
    monthlyBudgetKopecks: 1200000, // 12 000.00 ₽
  },
  {
    id: 'cat-loans',
    familyId: 'fam-01',
    name: 'Кредиты/Банки',
    icon: 'Landmark',
    color: 'red',
    subcategories: ['Ипотека', 'Потребительский кредит', 'Автокредит', 'Кредитная карта', 'Комиссии банков'],
    monthlyBudgetKopecks: 3500000, // 35 000.00 ₽
  },
  {
    id: 'cat-transfer',
    familyId: 'fam-01',
    name: 'Перевод участнику',
    icon: 'ArrowLeftRight',
    color: 'slate',
    subcategories: ['Взаиморасчет', 'Карманные расходы'],
    monthlyBudgetKopecks: 0,
  },
  {
    id: 'cat-savings',
    familyId: 'fam-01',
    name: 'Копилка и Накопления',
    icon: 'PiggyBank',
    color: 'purple',
    subcategories: ['Подушка безопасности', 'Вклад', 'Накопительный счет', 'Инвестиции'],
    monthlyBudgetKopecks: 3000000, // 30 000.00 ₽ целевой отклад в месяц
  },
];

export const INITIAL_SAVINGS_GOALS: SavingsGoal[] = [
  {
    id: 'goal-emergency',
    familyId: 'fam-01',
    name: 'Подушка безопасности',
    description: 'Неприкосновенный запас расходов семьи',
    targetKopecks: 60000000, // 600 000 ₽
    currentKopecks: 0,
    currency: 'RUB',
    accountType: 'deposit',
    bankName: 'Т-Банк (СмартВклад)',
    interestRate: 19.0,
    icon: 'Shield',
    color: 'indigo',
    monthlyPlanKopecks: 2500000,
    createdAt: nowIso,
  },
  {
    id: 'goal-vacation',
    familyId: 'fam-01',
    name: 'Семейный отпуск',
    description: 'Семейная поездка и отдых',
    targetKopecks: 25000000, // 250 000 ₽
    currentKopecks: 0,
    currency: 'RUB',
    accountType: 'savings_account',
    bankName: 'Сбер (Накопительный)',
    interestRate: 16.0,
    icon: 'Plane',
    color: 'blue',
    monthlyPlanKopecks: 1500000,
    createdAt: nowIso,
  },
  {
    id: 'goal-auto-downpayment',
    familyId: 'fam-01',
    name: 'Крупная покупка',
    description: 'Накопления на крупную семейную цель',
    targetKopecks: 80000000, // 800 000 ₽
    currentKopecks: 0,
    currency: 'RUB',
    accountType: 'deposit',
    bankName: 'ВТБ (Депозит Доходный)',
    interestRate: 18.5,
    icon: 'Car',
    color: 'emerald',
    monthlyPlanKopecks: 3000000,
    createdAt: nowIso,
  },
];

export const INITIAL_BUDGETS: Budget[] = [
  {
    id: 'b-01',
    familyId: 'fam-01',
    categoryId: 'cat-groceries',
    month: currentIsoMonth,
    limitKopecks: 4500000, // 45 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-02',
    familyId: 'fam-01',
    categoryId: 'cat-housing',
    month: currentIsoMonth,
    limitKopecks: 1800000, // 18 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 85,
  },
  {
    id: 'b-03',
    familyId: 'fam-01',
    categoryId: 'cat-auto',
    month: currentIsoMonth,
    limitKopecks: 2000000, // 20 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-04',
    familyId: 'fam-01',
    categoryId: 'cat-cafes',
    month: currentIsoMonth,
    limitKopecks: 1500000, // 15 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-05',
    familyId: 'fam-01',
    categoryId: 'cat-health',
    month: currentIsoMonth,
    limitKopecks: 1000000, // 10 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-06',
    familyId: 'fam-01',
    categoryId: 'cat-leisure',
    month: currentIsoMonth,
    limitKopecks: 800000, // 8 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-07',
    familyId: 'fam-01',
    categoryId: 'cat-clothes',
    month: currentIsoMonth,
    limitKopecks: 1200000, // 12 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 80,
  },
  {
    id: 'b-08',
    familyId: 'fam-01',
    categoryId: 'cat-loans',
    month: currentIsoMonth,
    limitKopecks: 3500000, // 35 000 ₽
    spentKopecks: 0,
    notifyThresholdPercent: 85,
  },
];

// Clean empty transactions on startup - no demo data
export const INITIAL_TRANSACTIONS: Transaction[] = [];

// Clean empty documents on startup - no sample receipts
export const INITIAL_DOCUMENTS: Document[] = [];
