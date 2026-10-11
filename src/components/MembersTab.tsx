import React, { useState, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  ArrowLeftRight, 
  Sparkles
} from 'lucide-react';
import { Family, FamilyMember } from '../types';
import { formatMoney } from '../utils/money';

interface MembersTabProps {
  family: Family;
  members: FamilyMember[];
  onAddMemberTransfer: (fromMemberId: string, toMemberId: string, amountKopecks: number) => void;
  onOpenSetupWizard?: () => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  family,
  members,
  onAddMemberTransfer,
  onOpenSetupWizard,
}) => {
  const [copied, setCopied] = useState(false);
  const [transferFrom, setTransferFrom] = useState(members[1]?.id || members[0].id);
  const [transferTo, setTransferTo] = useState(members[0].id);
  const [transferAmountRub, setTransferAmountRub] = useState('2000');

  const copyInviteCode = () => {
    navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const rubles = parseFloat(transferAmountRub.replace(',', '.'));
    if (!isNaN(rubles) && rubles > 0 && transferFrom !== transferTo) {
      onAddMemberTransfer(transferFrom, transferTo, Math.round(rubles * 100));
    }
  };

  // Real debt clearing algorithm (greedy min(-debtor.balance, creditor.balance) reduction, as in iHateMoney / Splitwise)
  const settlementRecommendations = useMemo(() => {
    // Creditors: members who are owed money (balanceKopecks > 0)
    const creditors = members
      .filter((m) => m.balanceKopecks > 0)
      .map((m) => ({ member: m, amount: m.balanceKopecks }))
      .sort((a, b) => b.amount - a.amount);

    // Debtors: members who owe money (balanceKopecks < 0)
    const debtors = members
      .filter((m) => m.balanceKopecks < 0)
      .map((m) => ({ member: m, amount: -m.balanceKopecks }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: {
      id: string;
      debtor: FamilyMember;
      creditor: FamilyMember;
      amountKopecks: number;
    }[] = [];

    let cIdx = 0;
    let dIdx = 0;

    // While there is both a debtor and a creditor, transfer min(debtor.amount, creditor.amount) and update balances
    while (cIdx < creditors.length && dIdx < debtors.length) {
      const creditor = creditors[cIdx];
      const debtor = debtors[dIdx];

      const settlementAmount = Math.min(debtor.amount, creditor.amount);

      if (settlementAmount > 0) {
        settlements.push({
          id: `settle-${debtor.member.id}-${creditor.member.id}-${settlementAmount}-${settlements.length}`,
          debtor: debtor.member,
          creditor: creditor.member,
          amountKopecks: settlementAmount,
        });

        debtor.amount -= settlementAmount;
        creditor.amount -= settlementAmount;
      }

      if (debtor.amount <= 0) {
        dIdx++;
      }
      if (creditor.amount <= 0) {
        cIdx++;
      }
    }

    return settlements;
  }, [members]);

  return (
    <div className="space-y-6">
      {/* Family Invite Code Card (Sleek Gradient Banner) */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white rounded-2xl p-4 sm:p-6 shadow-lg shadow-blue-900/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full text-blue-100">
                Код синхронизации Telegram
              </span>
              <span className="text-xs text-blue-200 font-mono">
                {members.length} / 5 участников
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mt-1 tracking-tight">
              Привязка Telegram-бота через код семьи
            </h3>
            <p className="text-xs text-blue-100/90 mt-1 max-w-xl leading-relaxed">
              Чтобы подключить второго участника семьи, перешлите ему бота и этот токен. Достаточно отправить: <code className="bg-slate-950/40 px-2 py-0.5 rounded font-mono text-white">/start {family.inviteCode}</code>
            </p>
          </div>

          <button
            onClick={copyInviteCode}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-950/60 hover:bg-slate-950 text-white border border-white/20 rounded-xl font-mono font-bold text-sm shadow-md transition-all self-start sm:self-center active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-300" />}
            <span>{family.inviteCode}</span>
            <span className="text-[11px] font-sans text-slate-300 font-normal">
              {copied ? '(Скопировано!)' : '(Копировать)'}
            </span>
          </button>
        </div>
      </div>

      {/* Members List with Balances */}
      <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Баланс и роли участников (iHateMoney Engine)
            </h3>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-0.5">
              Автоматический клиринг взаимных долгов за общие расходы
            </p>
          </div>
          {onOpenSetupWizard && (
            <button
              onClick={onOpenSetupWizard}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl border dark:border-slate-700 border-slate-300 dark:hover:bg-slate-800 hover:bg-slate-100 text-xs font-semibold flex items-center space-x-1.5 transition text-blue-600 dark:text-blue-400"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Настройки семьи & ID</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className={`p-4 rounded-xl border transition-all ${
                member.isCurrentUser
                  ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-500/5 shadow-xs'
                  : 'dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-950/60 bg-slate-50/80 dark:hover:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{member.avatar}</span>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="font-semibold text-sm dark:text-white text-slate-900">
                        {member.name}
                      </h4>
                      {member.isCurrentUser && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                          Вы
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {member.role === 'owner' ? 'Владелец' : member.role === 'admin' ? 'Администратор' : 'Участник'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t dark:border-slate-800/80 border-slate-200 flex items-baseline justify-between">
                <span className="text-xs dark:text-slate-400 text-slate-500">Взаиморасчет:</span>
                <span
                  className={`font-mono font-bold text-base ${
                    member.balanceKopecks >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatMoney(member.balanceKopecks, 'RUB', true)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 text-right font-mono">
                {member.balanceKopecks >= 0 ? 'Семья должна участнику' : 'Участник должен в бюджет'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Settlements & Internal Transfer Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settlement Calculations */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
            Рекомендуемые взаиморасчеты
          </h3>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-4">
            Оптимальные переводы для сведения сальдо к нулю
          </p>

          <div className="space-y-3">
            {settlementRecommendations.length === 0 ? (
              <div className="p-4 rounded-xl dark:bg-slate-950/60 bg-slate-50 border dark:border-slate-800/80 border-slate-200 text-center text-xs dark:text-slate-400 text-slate-600">
                <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                Все взаиморасчеты закрыты, никто никому не должен!
              </div>
            ) : (
              settlementRecommendations.map((settlement) => (
                <div
                  key={settlement.id}
                  className="p-3.5 rounded-xl dark:bg-slate-950/60 bg-slate-50/90 border dark:border-slate-800/80 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs"
                >
                  <div className="flex items-center space-x-2 text-xs dark:text-slate-300 text-slate-700">
                    <span className="font-semibold">{settlement.debtor.avatar} {settlement.debtor.name}</span>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-semibold">{settlement.creditor.avatar} {settlement.creditor.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                      {formatMoney(settlement.amountKopecks)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferFrom(settlement.debtor.id);
                        setTransferTo(settlement.creditor.id);
                        setTransferAmountRub((settlement.amountKopecks / 100).toString());
                        onAddMemberTransfer(settlement.debtor.id, settlement.creditor.id, settlement.amountKopecks);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 flex items-center space-x-1"
                      title="Рассчитаться прямо сейчас"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Рассчитаться</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transfer between members */}
        <div className="dark:bg-slate-900/50 bg-white backdrop-blur-md border dark:border-slate-800/60 border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
            Зафиксировать перевод между участниками
          </h3>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-4">
            Служит для выравнивания балансов (деньги остаются внутри семьи)
          </p>

          <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block dark:text-slate-400 text-slate-600 mb-1">Кто переводит:</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full p-2 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl dark:text-white text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.avatar} {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block dark:text-slate-400 text-slate-600 mb-1">Кому перевод:</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full p-2 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl dark:text-white text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.avatar} {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block dark:text-slate-400 text-slate-600 mb-1">Сумма перевода (₽):</label>
              <input
                type="number"
                value={transferAmountRub}
                onChange={(e) => setTransferAmountRub(e.target.value)}
                placeholder="2000"
                className="w-full p-2 dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl dark:text-white text-slate-900 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={transferFrom === transferTo}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition-all text-xs active:scale-95"
            >
              Зафиксировать перевод
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
