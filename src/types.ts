/** Types of the JSON returned by the FinSync API. All money amounts are integer kopecks. */

export type Currency = 'RUB' | 'USD' | 'EUR';

export type TransactionType = 'expense' | 'income' | 'transfer' | 'saving' | 'withdrawal';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_income: boolean;
  sort_order: number;
  monthly_limit_kopecks: number;
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  role: string;
  /** Positive: others owe this member. Negative: this member owes others. */
  balance_kopecks: number;
  is_active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target_amount_kopecks: number;
  target_date: string | null;
  saved_kopecks: number;
  remaining_kopecks: number;
  progress_percent: number;
  is_reached: boolean;
  days_left: number | null;
  is_overdue: boolean;
  required_per_month_kopecks: number | null;
}

export interface DashboardBudget {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  limit_kopecks: number;
  spent_kopecks: number;
  remaining_kopecks: number;
  percent: number;
  is_over: boolean;
}

export interface DashboardForecast {
  current_month: string;
  days_passed: number;
  days_total: number;
  days_remaining: number;
  actual_spent_kopecks: number;
  daily_average_kopecks: number;
  projected_spent_kopecks: number;
  total_budget_kopecks: number;
  variance_kopecks: number;
  is_over_budget: boolean;
  has_budget: boolean;
}

export interface DashboardTransaction {
  id: string;
  date: string;
  type: TransactionType;
  amount_kopecks: number;
  description: string;
  category_name: string | null;
  paid_by_name: string | null;
  to_name: string | null;
  goal_name: string | null;
}

export interface Settlement {
  debtor_member_id: string;
  creditor_member_id: string;
  amount_kopecks: number;
  debtor_name: string;
  creditor_name: string;
}

export interface DashboardMember {
  id: string;
  name: string;
  avatar: string;
  balance_kopecks: number;
}

export interface Dashboard {
  generated_at: string;
  period: string;
  totals: {
    income_kopecks: number;
    expenses_kopecks: number;
    saved_kopecks: number;
    balance_kopecks: number;
  };
  forecast: DashboardForecast;
  budgets: DashboardBudget[];
  unbudgeted_spent_kopecks: number;
  goals: Goal[];
  recent_transactions: DashboardTransaction[];
  members: DashboardMember[];
  settlements: Settlement[];
}

/** Body of POST /api/transactions. */
export interface NewTransaction {
  type: TransactionType;
  amount_kopecks: number;
  description: string;
  transaction_date: string;
  currency?: Currency;
  category_id?: string;
  paid_by_member_id?: string;
  to_member_id?: string;
  goal_id?: string;
}

export interface CreatedTransaction {
  id: string;
  type: TransactionType;
  amount_kopecks: number;
  description: string;
}
