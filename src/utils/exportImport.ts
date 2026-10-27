import { Transaction, Category, FamilyMember } from '../types';

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
