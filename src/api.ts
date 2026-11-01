import { authFetch } from './utils/auth';
import type { Category, CreatedTransaction, Dashboard, Goal, Member, NewTransaction } from './types';

/** An HTTP error from the API with the server's human-readable reason (`detail`). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authFetch(path, init);
  } catch {
    throw new ApiError(0, 'Нет связи с сервером');
  }

  if (!response.ok) {
    let detail = `Ошибка сервера (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string' && body.detail) detail = body.detail;
      else if (Array.isArray(body.detail)) detail = 'Проверьте введённые данные';
    } catch {
      // keep the generic message
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const getDashboard = () => request<Dashboard>('/api/dashboard');
export const getCategories = () => request<Category[]>('/api/categories');
export const getMembers = () => request<Member[]>('/api/family/members');
export const getGoals = async (): Promise<Goal[]> => (await request<{ goals: Goal[] }>('/api/goals')).goals;

export const createTransaction = (body: NewTransaction) =>
  request<CreatedTransaction>('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const rejectTransaction = (id: string) =>
  request<{ status: string }>(`/api/transactions/${encodeURIComponent(id)}/reject`, { method: 'POST' });
