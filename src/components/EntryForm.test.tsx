import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categories, goal, members } from '../test-utils/fixtures';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    getCategories: vi.fn(),
    getMembers: vi.fn(),
    getGoals: vi.fn(),
    createTransaction: vi.fn(),
    rejectTransaction: vi.fn(),
  };
});
vi.mock('../utils/auth', () => ({ getCurrentMemberId: vi.fn().mockResolvedValue('m-anna') }));

import { ApiError, createTransaction, getCategories, getGoals, getMembers, rejectTransaction } from '../api';
import { EntryForm } from './EntryForm';

const api = {
  getCategories: vi.mocked(getCategories),
  getMembers: vi.mocked(getMembers),
  getGoals: vi.mocked(getGoals),
  createTransaction: vi.mocked(createTransaction),
  rejectTransaction: vi.mocked(rejectTransaction),
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Записать' }));

async function renderForm() {
  render(<EntryForm />);
  await screen.findByRole('tablist', { name: 'Тип записи' });
}

describe('EntryForm (Mini App input)', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getCategories.mockResolvedValue(categories);
    api.getMembers.mockResolvedValue(members);
    api.getGoals.mockResolvedValue([goal]);
    api.createTransaction.mockResolvedValue({ id: 'tx-1', type: 'expense', amount_kopecks: 54000, description: 'Кофе' });
    api.rejectTransaction.mockResolvedValue({ status: 'rejected' });
  });

  it('records an expense with the chosen category', async () => {
    await renderForm();
    type('Сумма, ₽', '540');
    type('Описание', 'Кофе');
    fireEvent.click(screen.getByRole('button', { name: 'Продукты' }));
    submit();

    await screen.findByText(/Записано: Расход/);
    const body = api.createTransaction.mock.calls[0][0];
    expect(body).toMatchObject({ type: 'expense', amount_kopecks: 54000, description: 'Кофе', category_id: 'c-food', currency: 'RUB' });
    expect(body.transaction_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // the form is ready for the next entry
    expect((screen.getByLabelText('Сумма, ₽') as HTMLInputElement).value).toBe('');
  });

  it('shows only income categories on the income tab', async () => {
    await renderForm();
    openTab('Доход');
    expect(screen.getByRole('button', { name: 'Зарплата и Доход' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Продукты' })).toBeNull();
  });

  it('records a transfer to another member (the only other member is preselected)', async () => {
    api.createTransaction.mockResolvedValue({ id: 'tx-2', type: 'transfer', amount_kopecks: 500000, description: 'Перевод' });
    await renderForm();
    openTab('Перевод');
    expect((screen.getByLabelText('Кому') as HTMLSelectElement).value).toBe('m-boris');
    expect((screen.getByLabelText('От кого') as HTMLSelectElement).value).toBe('m-anna');
    type('Сумма, ₽', '5000');
    submit();

    await screen.findByText(/Перевод: Анна → Борис/);
    expect(api.createTransaction.mock.calls[0][0]).toMatchObject({
      type: 'transfer', amount_kopecks: 500000, to_member_id: 'm-boris', paid_by_member_id: 'm-anna',
    });
  });

  it('can record a transfer given by someone else (e.g. a repayment from Boris)', async () => {
    await renderForm();
    openTab('Перевод');
    type('От кого', 'm-boris');
    type('Кому', 'm-anna');
    type('Сумма, ₽', '2000');
    submit();
    await screen.findByText(/Борис → Анна/);
    expect(api.createTransaction.mock.calls[0][0]).toMatchObject({ paid_by_member_id: 'm-boris', to_member_id: 'm-anna' });
  });

  it('refuses a transfer without a recipient before calling the server', async () => {
    api.getMembers.mockResolvedValue([...members, { ...members[1], id: 'm-clara', name: 'Клара' }]);
    await renderForm();
    openTab('Перевод');
    type('Сумма, ₽', '100');
    submit();
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('Выберите, кому перевод');
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('deposits into a goal and refreshes its balance', async () => {
    api.createTransaction.mockResolvedValue({ id: 'tx-3', type: 'saving', amount_kopecks: 500000, description: 'x' });
    await renderForm();
    openTab('Копилка');
    expect((screen.getByLabelText('Копилка') as HTMLSelectElement).value).toBe('g-trip'); // single goal preselected
    expect(document.body.textContent).toContain('Накоплено');
    type('Сумма, ₽', '5000');
    api.getGoals.mockResolvedValueOnce([{ ...goal, saved_kopecks: 800_000 }]);
    submit();

    await screen.findByText(/Записано: Пополнение: Отпуск/);
    expect(api.createTransaction.mock.calls[0][0]).toMatchObject({ type: 'saving', goal_id: 'g-trip', amount_kopecks: 500000 });
    await waitFor(() => expect((document.body.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')).toContain('Накоплено 8 000,00 ₽'));
    expect(api.getGoals).toHaveBeenCalledTimes(2);
  });

  it('refuses to withdraw more than saved without calling the server', async () => {
    await renderForm();
    openTab('Копилка');
    fireEvent.click(screen.getByRole('button', { name: 'Снять' }));
    type('Сумма, ₽', '3000,01');
    submit();
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('только');
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('explains how to create a goal when there are none', async () => {
    api.getGoals.mockResolvedValue([]);
    await renderForm();
    openTab('Копилка');
    expect(document.body.textContent).toContain('/goal');
  });

  it('shows the server reason when saving fails', async () => {
    api.createTransaction.mockRejectedValue(new ApiError(422, 'Получатель перевода не найден'));
    await renderForm();
    type('Сумма, ₽', '100');
    submit();
    await screen.findByText('Получатель перевода не найден');
  });

  it('cancels the last entry and says so', async () => {
    await renderForm();
    type('Сумма, ₽', '540');
    submit();
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await screen.findByText('Запись отменена');
    expect(api.rejectTransaction).toHaveBeenCalledWith('tx-1');
  });

  it('shows the refusal when cancelling is not allowed', async () => {
    api.rejectTransaction.mockRejectedValue(new ApiError(409, 'Нельзя отменить пополнение: эти деньги уже сняты с копилки'));
    await renderForm();
    type('Сумма, ₽', '540');
    submit();
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await screen.findByText(/уже сняты/);
    expect(screen.queryByText('Запись отменена')).toBeNull();
  });

  it('shows a clear message and a retry button when the data cannot be loaded', async () => {
    api.getCategories.mockRejectedValueOnce(new ApiError(403, 'Доступ запрещён'));
    render(<EntryForm />);
    await screen.findByText(/Нет доступа/);
    api.getCategories.mockResolvedValueOnce(categories);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByRole('tablist', { name: 'Тип записи' });
  });
});
