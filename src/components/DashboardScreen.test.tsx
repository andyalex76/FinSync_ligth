import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboard } from '../test-utils/fixtures';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, getDashboard: vi.fn() };
});

import { ApiError, getDashboard } from '../api';
import { DashboardScreen } from './DashboardScreen';

const getDashboardMock = vi.mocked(getDashboard);
const renderScreen = () => render(<DashboardScreen theme="dark" onToggleTheme={() => {}} />);

describe('DashboardScreen', () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
  });

  it('shows the dashboard once the data arrives', async () => {
    getDashboardMock.mockResolvedValue(dashboard);
    renderScreen();
    expect(screen.getByRole('status').textContent).toContain('Загрузка');
    await screen.findByText('Бюджеты по категориям');
    expect(screen.getByRole('heading', { name: 'Семейный бюджет' })).toBeTruthy();
    expect(document.body.textContent).toContain('октябрь 2026');
  });

  it('explains how to sign in when the server answers 401/403', async () => {
    getDashboardMock.mockRejectedValue(new ApiError(401, 'Недействительный токен'));
    renderScreen();
    await screen.findByText('Нужен вход через Telegram');
    expect(document.body.textContent).toContain('/dashboard');
    expect(screen.queryByText('Бюджеты по категориям')).toBeNull();
  });

  it('shows an error with a retry button when the first load fails', async () => {
    getDashboardMock.mockRejectedValueOnce(new ApiError(0, 'Нет связи с сервером'));
    renderScreen();
    await screen.findByText(/Нет связи с сервером/);

    getDashboardMock.mockResolvedValueOnce(dashboard);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Бюджеты по категориям');
  });

  it('keeps the last good data on screen when a later refresh fails', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboard);
    renderScreen();
    await screen.findByText('Бюджеты по категориям');

    getDashboardMock.mockRejectedValueOnce(new ApiError(0, 'Нет связи с сервером'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    });
    await waitFor(() => expect(document.body.textContent).toContain('Показаны последние полученные данные'));
    expect(screen.getByText('Бюджеты по категориям')).toBeTruthy();
  });

  it('polls the server periodically', async () => {
    vi.useFakeTimers();
    try {
      getDashboardMock.mockResolvedValue(dashboard);
      renderScreen();
      await vi.advanceTimersByTimeAsync(0);
      expect(getDashboardMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(getDashboardMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
