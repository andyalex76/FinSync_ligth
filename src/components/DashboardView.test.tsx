import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Dashboard } from '../types';
import { dashboard } from '../test-utils/fixtures';
import { DashboardView, periodLabel } from './DashboardView';

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ');
const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;

describe('DashboardView', () => {
  it('shows month totals', () => {
    render(<DashboardView data={dashboard} />);
    const body = text(document.body);
    expect(body).toContain('100 000,00 ₽'); // income
    expect(body).toContain('21 000,00 ₽'); // expenses
    expect(body).toContain('8 000,00 ₽'); // saved
    expect(body).toContain('71 000,00 ₽'); // balance
  });

  it('shows plan vs fact per category and flags an overspent budget', () => {
    render(<DashboardView data={dashboard} />);
    const budgets = section('Бюджеты по категориям');
    expect(text(budgets)).toContain('1 000,00 ₽ / 45 000,00 ₽');
    expect(text(budgets)).toContain('Сверх лимита: 2 000,00 ₽');
    expect(within(budgets).getByRole('progressbar', { name: 'Жилье и ЖКХ' }).getAttribute('aria-valuenow')).toBe('100'); // capped
    expect(within(budgets).getByRole('progressbar', { name: 'Продукты' }).getAttribute('aria-valuenow')).toBe('2');
  });

  it('shows the forecast and warns about the expected overspend', () => {
    render(<DashboardView data={dashboard} />);
    const forecast = section('Прогноз расходов к концу месяца');
    expect(text(forecast)).toContain('65 100,00 ₽');
    expect(text(forecast)).toContain('Ожидаемый перерасход: 2 100,00 ₽');
  });

  it('says so when no budget is configured instead of inventing one', () => {
    const noBudget: Dashboard = { ...dashboard, budgets: [], forecast: { ...dashboard.forecast, has_budget: false, total_budget_kopecks: 0, variance_kopecks: 0, is_over_budget: false } };
    render(<DashboardView data={noBudget} />);
    expect(text(section('Прогноз расходов'))).toContain('Бюджет на месяц не задан');
    expect(text(section('Бюджеты по категориям'))).toContain('Бюджеты на этот месяц не заданы');
  });

  it('shows savings goals with progress and the monthly amount needed', () => {
    render(<DashboardView data={dashboard} />);
    const goals = section('Копилки');
    expect(text(goals)).toContain('Отпуск');
    expect(text(goals)).toContain('3 000,00 ₽ / 150 000,00 ₽');
    expect(text(goals)).toContain('до 2027-06-30');
    expect(text(goals)).toContain('21 000,00 ₽ в месяц');
  });

  it('shows who owes whom', () => {
    render(<DashboardView data={dashboard} />);
    const settlements = section('Взаиморасчёты');
    expect(text(settlements)).toContain('Борис');
    expect(text(settlements)).toContain('Анна');
    expect(text(settlements)).toContain('3 000,00 ₽');
  });

  it('shows empty states for debts, goals and operations', () => {
    const empty: Dashboard = { ...dashboard, goals: [], settlements: [], recent_transactions: [] };
    render(<DashboardView data={empty} />);
    expect(text(document.body)).toContain('Никто никому не должен');
    expect(text(document.body)).toContain('Копилок пока нет');
    expect(text(document.body)).toContain('Операций пока нет');
  });

  it('lists recent operations with names, goals and transfer direction', () => {
    render(<DashboardView data={dashboard} />);
    const recent = section('Последние операции');
    expect(text(recent)).toContain('Кофе');
    expect(text(recent)).toContain('30.10 · Кафе · Анна');
    expect(text(recent)).toContain('Анна → Борис');
    expect(text(recent)).toContain('Отпуск');
    expect(text(recent)).toContain('-540,00 ₽');
  });

  it('warns when showing stale data', () => {
    render(<DashboardView data={dashboard} offlineMessage="Нет связи с сервером" />);
    expect(screen.getByRole('status').textContent).toContain('Нет связи с сервером');
  });

  it('names the month in Russian', () => {
    expect(periodLabel('2026-10')).toBe('октябрь 2026');
    expect(periodLabel('broken')).toBe('broken');
  });
});
