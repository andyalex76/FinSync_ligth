import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { categories, dashboard, goal, members } from './test-utils/fixtures';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    getDashboard: vi.fn(),
    getCategories: vi.fn(),
    getMembers: vi.fn(),
    getGoals: vi.fn(),
  };
});
vi.mock('./utils/auth', () => ({ getCurrentMemberId: vi.fn().mockResolvedValue('m-anna') }));

import { ApiError, getCategories, getDashboard, getGoals, getMembers } from './api';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.mocked(getDashboard).mockReset().mockResolvedValue(dashboard);
    vi.mocked(getCategories).mockReset().mockResolvedValue(categories);
    vi.mocked(getMembers).mockReset().mockResolvedValue(members);
    vi.mocked(getGoals).mockReset().mockResolvedValue([goal]);
    localStorage.clear();
  });
  afterEach(() => {
    delete (window as { Telegram?: unknown }).Telegram;
  });

  it('opens the read-only dashboard in a regular browser (no input form)', async () => {
    render(<App />);
    await screen.findByText('Бюджеты по категориям');
    expect(screen.queryByRole('button', { name: 'Записать' })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Тип записи' })).toBeNull();
  });

  it('asks to sign in through the bot when the browser has no valid session', async () => {
    vi.mocked(getDashboard).mockRejectedValue(new ApiError(401, 'Недействительный токен'));
    render(<App />);
    await screen.findByText('Нужен вход через Telegram');
  });

  it('opens the Mini App with the entry form and an overview tab inside Telegram', async () => {
    const ready = vi.fn();
    const expand = vi.fn();
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'signed', ready, expand } };

    render(<App />);
    expect(ready).toHaveBeenCalled();
    expect(expand).toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Записать' });
    expect(screen.getByRole('tab', { name: 'Ввод' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Обзор' })).toBeTruthy();
  });
});
