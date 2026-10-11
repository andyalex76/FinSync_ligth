import React, { useState } from 'react';
import { 
  Sparkles, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  UserPlus, 
  Trash2, 
  Wallet, 
  AlertCircle,
  X,
  Crown,
  User,
  Shield
} from 'lucide-react';
import { Currency, MemberRole, FamilySetupData } from '../types';
import confetti from 'canvas-confetti';
import { useModalA11y } from '../hooks/useModalA11y';

interface FamilySetupWizardProps {
  isOpen: boolean;
  isInitialSetup: boolean;
  onComplete: (data: FamilySetupData) => void;
  onClose?: () => void;
}

const AVATAR_PRESETS = ['👨‍💼', '👩‍⚕️', '👨', '👩', '🧑', '🧔', '👩‍🦰', '🧑‍💻', '🦊', '🦁', '🦉', '🚀', '👑'];

export const FamilySetupWizard: React.FC<FamilySetupWizardProps> = ({
  isOpen,
  isInitialSetup,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Family info
  const [familyName, setFamilyName] = useState<string>('Семья Ивановых');
  const [familyId, setFamilyId] = useState<string>(() => `fam-${Math.random().toString(36).substring(2, 7)}`);
  const [currency, setCurrency] = useState<Currency>('RUB');
  const [inviteCode, setInviteCode] = useState<string>('IVANOV-77');

  // Step 2: Creator profile & role
  const [userName, setUserName] = useState<string>('Алексей');
  const [userRole, setUserRole] = useState<MemberRole>('owner');
  const [userAvatar, setUserAvatar] = useState<string>('👨‍💼');
  const [telegramUserId, setTelegramUserId] = useState<string>('');

  // Step 3: Additional members (optional)
  const [additionalMembers, setAdditionalMembers] = useState<Array<{ name: string; role: MemberRole; avatar: string }>>([
    { name: 'Елена', role: 'admin', avatar: '👩‍⚕️' },
  ]);

  // Step 4: Mode (clean vs demo)
  const [startClean, setStartClean] = useState<boolean>(true);

  // Errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { modalRef } = useModalA11y({
    isOpen,
    onClose: onClose,
  });

  if (!isOpen) return null;

  const generateRandomId = () => {
    const cleanPrefix = familyName.trim()
      ? familyName.toLowerCase().replace(/[^a-zа-я0-9]/gi, '').slice(0, 6)
      : 'fam';
    const rand = Math.random().toString(36).substring(2, 6);
    setFamilyId(`${cleanPrefix}-${rand}`);
  };

  const generateInviteCode = () => {
    const letters = familyName.trim()
      ? familyName.toUpperCase().replace(/[^A-ZА-Я0-9]/gi, '').slice(0, 6)
      : 'FAMILY';
    const num = Math.floor(10 + Math.random() * 90);
    setInviteCode(`${letters || 'FINSYNC'}-${num}`);
  };

  const handleAddMember = () => {
    if (additionalMembers.length >= 5) return;
    setAdditionalMembers(prev => [
      ...prev,
      { name: '', role: 'member', avatar: '🧑' }
    ]);
  };

  const handleRemoveMember = (index: number) => {
    setAdditionalMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMember = (index: number, field: 'name' | 'role' | 'avatar', value: string) => {
    setAdditionalMembers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!familyName.trim()) {
        setErrorMsg('Пожалуйста, укажите название семьи');
        return;
      }
      if (!familyId.trim()) {
        setErrorMsg('Пожалуйста, укажите Family ID для идентификации в базе данных');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!userName.trim()) {
        setErrorMsg('Пожалуйста, укажите ваше имя');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  const handleFinish = () => {
    try {
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    const payload: FamilySetupData = {
      familyId: familyId.trim(),
      familyName: familyName.trim(),
      currency,
      inviteCode: inviteCode.trim() || `${familyId.toUpperCase()}-01`,
      userName: userName.trim(),
      userRole,
      userAvatar,
      telegramUserId: telegramUserId.trim() || undefined,
      additionalMembers: additionalMembers.filter(m => m.name.trim().length > 0),
      startClean,
    };

    onComplete(payload);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-setup-wizard-title"
        tabIndex={-1}
        className="dark:bg-[#020617] bg-white w-full max-w-xl rounded-3xl border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-200 dark:text-white text-slate-900 outline-none"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b dark:border-slate-800 border-slate-200 relative bg-gradient-to-r dark:from-slate-900/60 from-blue-50/50 to-transparent">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть мастер настройки семьи"
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {isInitialSetup ? 'Первый вход • Onboarding' : 'Настройка семейного пространства'}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Шаг {step} из 4</span>
          </div>

          <h3 id="family-setup-wizard-title" className="text-xl font-bold tracking-tight">
            Мастер настройки семьи
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Конфигурация параметров `familyID`, `name` и `role` для боевого использования
          </p>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-1.5 mt-4">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 4 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: FAMILY IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  1. Название семьи
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Например: Семья Ивановых или Наш Дом"
                  className="w-full px-3.5 py-2.5 rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-50 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 dark:text-white"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Отображается в шапке приложения, отчетах и приветствии бота.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    2. Family ID (Идентификатор семьи)
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomId}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Случайный ID</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="fam-ivanov"
                    className="w-full px-3.5 py-2.5 rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-50 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 dark:text-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Ключ для связи с базой данных PostgreSQL и разделения доступа между семьями.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    3. Основная валюта
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['RUB', 'USD', 'EUR'] as Currency[]).map((cur) => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setCurrency(cur)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition ${
                          currency === cur
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
                            : 'border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <span>{cur === 'RUB' ? '₽ RUB' : cur === 'USD' ? '$ USD' : '€ EUR'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      4. Код инвайта в Telegram
                    </label>
                    <button
                      type="button"
                      onClick={generateInviteCode}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Обновить
                    </button>
                  </div>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-50 text-xs font-mono font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: USER PROFILE & ROLE */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  1. Ваше имя в системе
                </label>
                <div className="flex items-center space-x-2">
                  <div className="w-11 h-11 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center text-2xl shrink-0">
                    {userAvatar}
                  </div>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Например: Алексей или Мария"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-50 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 dark:text-white"
                  />
                </div>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  2. Выберите ваш аватар / эмодзи
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setUserAvatar(emoji)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition ${
                        userAvatar === emoji
                          ? 'border-2 border-blue-500 bg-blue-500/15 scale-110'
                          : 'border dark:border-slate-800 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  3. Ваша роль в семейном бюджете (Role)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Owner */}
                  <button
                    type="button"
                    onClick={() => setUserRole('owner')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                      userRole === 'owner'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Crown className="w-4 h-4" />
                      </span>
                      {userRole === 'owner' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs">Владелец (Owner)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                        Создатель семьи. Полные права на лимиты, роли и удаление.
                      </p>
                    </div>
                  </button>

                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => setUserRole('admin')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                      userRole === 'admin'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        <Shield className="w-4 h-4" />
                      </span>
                      {userRole === 'admin' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs">Админ (Admin)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                        Супруг(а). Управление бюджетами, модерация чеков OCR.
                      </p>
                    </div>
                  </button>

                  {/* Member */}
                  <button
                    type="button"
                    onClick={() => setUserRole('member')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                      userRole === 'member'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <User className="w-4 h-4" />
                      </span>
                      {userRole === 'member' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs">Участник</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                        Внесение расходов, чеков и личный баланс взаиморасчетов.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Optional Telegram ID */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  4. Telegram ID или Username (опционально)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={telegramUserId}
                    onChange={(e) => setTelegramUserId(e.target.value)}
                    placeholder="@alexey или 789123456"
                    className="w-full px-3.5 py-2 rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-50 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 dark:text-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Позволит боту мгновенно идентифицировать ваши чеки и сообщения без ввода паролей.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: FAMILY MEMBERS (OPTIONAL) */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Участники вашей семьи
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Добавьте членов семьи сейчас или пригласите их позже по инвайт-коду.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>

              {/* Creator Card */}
              <div className="p-3.5 rounded-2xl border dark:border-blue-900/60 border-blue-200 dark:bg-blue-950/20 bg-blue-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0">
                    {userAvatar}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs">{userName}</span>
                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.2 rounded-md font-bold uppercase">
                        Вы ({userRole})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Баланс: 0.00 {currency}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">ID: mem-01</span>
              </div>

              {/* Additional Members List */}
              <div className="space-y-2.5">
                {additionalMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-slate-50 flex items-center gap-2"
                  >
                    <select
                      value={m.avatar}
                      onChange={(e) => handleUpdateMember(idx, 'avatar', e.target.value)}
                      className="w-10 h-10 text-xl rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 flex items-center justify-center text-center cursor-pointer"
                    >
                      {AVATAR_PRESETS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => handleUpdateMember(idx, 'name', e.target.value)}
                      placeholder="Имя (например: Елена, Михаил)"
                      className="flex-1 px-3 py-2 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white text-xs font-medium focus:outline-hidden dark:text-white"
                    />

                    <select
                      value={m.role}
                      onChange={(e) => handleUpdateMember(idx, 'role', e.target.value as MemberRole)}
                      className="px-2.5 py-2 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white text-xs font-semibold focus:outline-hidden dark:text-white"
                    >
                      <option value="admin">Админ</option>
                      <option value="member">Участник</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      title="Удалить участника"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {additionalMembers.length === 0 && (
                <div className="p-4 rounded-2xl border border-dashed dark:border-slate-800 border-slate-300 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Вы можете продолжать без добавления других участников. В любой момент можно отправить им код инвайта через Telegram.
                </div>
              )}
            </div>
          )}

          {/* STEP 4: START MODE (CLEAN VS DEMO) */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Режим начальных данных
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Выберите, хотите ли вы начать вести реальный бюджет с чистого листа или ознакомиться с примерами.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Clean Slate (Production) */}
                <button
                  type="button"
                  onClick={() => setStartClean(true)}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                    startClean
                      ? 'border-blue-600 bg-blue-50/90 dark:bg-blue-950/40 ring-2 ring-blue-500/20 text-blue-900 dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      {startClean && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <h5 className="font-bold text-xs">Чистый лист (Рекомендуется)</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      0 операций, 0.00 ₽ балансов. База готова для ввода ваших реальных расходов через PWA и Telegram-бота.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-3 block">
                    Для боевого использования
                  </span>
                </button>

                {/* Demo Data */}
                <button
                  type="button"
                  onClick={() => setStartClean(false)}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                    !startClean
                      ? 'border-blue-600 bg-blue-50/90 dark:bg-blue-950/40 ring-2 ring-blue-500/20 text-blue-900 dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-xs">
                        <Wallet className="w-4 h-4" />
                      </span>
                      {!startClean && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <h5 className="font-bold text-xs">Демо-данные 2026</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Загрузить примеры трат (супермаркеты, авто, кафе) для наглядного тестирования графиков и прогноза.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-3 block">
                    Для ознакомления с интерфейсом
                  </span>
                </button>
              </div>

              {/* Summary Card */}
              <div className="p-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 bg-slate-50/80 dark:bg-slate-900/40 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Итоговая конфигурация:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Семья: </span>
                    <span className="font-semibold">{familyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Family ID: </span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{familyId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Создатель: </span>
                    <span className="font-semibold">{userAvatar} {userName} ({userRole})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Участников: </span>
                    <span className="font-semibold">{1 + additionalMembers.filter(m => m.name.trim()).length} чел.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 sm:p-5 border-t dark:border-slate-800 border-slate-200 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="py-2.5 px-4 rounded-xl border dark:border-slate-700 border-slate-300 dark:hover:bg-slate-800 hover:bg-slate-100 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5 active:scale-98"
              >
                <span>Далее</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/25 flex items-center gap-1.5 active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Завершить настройку & Открыть бюджет</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilySetupWizard;
