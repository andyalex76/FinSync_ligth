import type { Category, Dashboard, Goal, Member } from '../types';

export const goal: Goal = {
  id: 'g-trip',
  name: 'Отпуск',
  icon: 'PiggyBank',
  target_amount_kopecks: 15_000_000,
  target_date: '2027-06-30',
  saved_kopecks: 300_000,
  remaining_kopecks: 14_700_000,
  progress_percent: 2,
  is_reached: false,
  days_left: 200,
  is_overdue: false,
  required_per_month_kopecks: 2_100_000,
};

export const members: Member[] = [
  { id: 'm-anna', name: 'Анна', avatar: '', role: 'owner', balance_kopecks: 300_000, is_active: true },
  { id: 'm-boris', name: 'Борис', avatar: '', role: 'member', balance_kopecks: -300_000, is_active: true },
];

export const categories: Category[] = [
  { id: 'c-food', name: 'Продукты', icon: 'ShoppingCart', color: 'emerald', is_income: false, sort_order: 1, monthly_limit_kopecks: 4_500_000 },
  { id: 'c-home', name: 'Жилье и ЖКХ', icon: 'Home', color: 'blue', is_income: false, sort_order: 2, monthly_limit_kopecks: 1_800_000 },
  { id: 'c-pay', name: 'Зарплата и Доход', icon: 'Banknote', color: 'emerald', is_income: true, sort_order: 9, monthly_limit_kopecks: 0 },
];

export const dashboard: Dashboard = {
  generated_at: '2026-10-30T10:00:00Z',
  period: '2026-10',
  totals: { income_kopecks: 10_000_000, expenses_kopecks: 2_100_000, saved_kopecks: 800_000, balance_kopecks: 7_100_000 },
  forecast: {
    current_month: '2026-10', days_passed: 10, days_total: 31, days_remaining: 21,
    actual_spent_kopecks: 2_100_000, daily_average_kopecks: 210_000, projected_spent_kopecks: 6_510_000,
    total_budget_kopecks: 6_300_000, variance_kopecks: 210_000, is_over_budget: true, has_budget: true,
  },
  budgets: [
    { category_id: 'c-food', name: 'Продукты', icon: 'ShoppingCart', color: 'emerald', limit_kopecks: 4_500_000, spent_kopecks: 100_000, remaining_kopecks: 4_400_000, percent: 2, is_over: false },
    { category_id: 'c-home', name: 'Жилье и ЖКХ', icon: 'Home', color: 'blue', limit_kopecks: 1_800_000, spent_kopecks: 2_000_000, remaining_kopecks: 0, percent: 111, is_over: true },
  ],
  unbudgeted_spent_kopecks: 0,
  goals: [goal],
  recent_transactions: [
    { id: 't1', date: '2026-10-30', type: 'expense', amount_kopecks: 54_000, description: 'Кофе', category_name: 'Кафе', paid_by_name: 'Анна', to_name: null, goal_name: null },
    { id: 't2', date: '2026-10-29', type: 'transfer', amount_kopecks: 300_000, description: 'Одолжила', category_name: null, paid_by_name: 'Анна', to_name: 'Борис', goal_name: null },
    { id: 't3', date: '2026-10-28', type: 'saving', amount_kopecks: 500_000, description: 'В отпуск', category_name: null, paid_by_name: 'Анна', to_name: null, goal_name: 'Отпуск' },
  ],
  members: [
    { id: 'm-anna', name: 'Анна', avatar: '', balance_kopecks: 300_000 },
    { id: 'm-boris', name: 'Борис', avatar: '', balance_kopecks: -300_000 },
  ],
  settlements: [
    { debtor_member_id: 'm-boris', creditor_member_id: 'm-anna', amount_kopecks: 300_000, debtor_name: 'Борис', creditor_name: 'Анна' },
  ],
};
