import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  Camera, 
  CheckCheck
} from 'lucide-react';
import { TelegramBotMessage, SavingsGoal, TelegramDraft } from '../types';
import { formatMoney } from '../utils/money';
import { useModalA11y } from '../hooks/useModalA11y';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  savingsGoals?: SavingsGoal[];
  onConfirmTelegramDraft: (draft: TelegramDraft) => void;
}

const INITIAL_BOT_MESSAGES: TelegramBotMessage[] = [
  {
    id: 'msg-1',
    sender: 'bot',
    text: '👋 Привет! Я бот для учета семейных расходов и накоплений **Семья Смирновых**.\n\n💡 **Примеры быстрых команд:**\n• `540 Кофе` — кафе\n• `24000 Ипотека Сбер` — кредиты/банки\n• `+15000 копилка подушка` — отложить в копилку «Подушка безопасности»\n• `отложил 10000 отпуск` — пополнение цели «Отпуск»\n• `2800 Бензин АИ-95` — авто\n• `/savings` — статус вкладов и целей\n• Или отправьте фото бумажного чека — я распознаю его через локальный Tesseract OCR!',
    time: '12:00',
    buttons: [
      { label: '📊 /dashboard', callbackData: 'cmd_dashboard' },
      { label: '🐷 /savings', callbackData: 'cmd_savings' },
      { label: '📸 Отправить чек', callbackData: 'cmd_photo' },
    ],
  },
];

export const TelegramBotModal: React.FC<TelegramBotModalProps> = ({
  isOpen,
  onClose,
  savingsGoals = [],
  onConfirmTelegramDraft,
}) => {
  const [messages, setMessages] = useState<TelegramBotMessage[]>(INITIAL_BOT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const { modalRef } = useModalA11y({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: TelegramBotMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Bot response logic
    setTimeout(() => {
      setIsTyping(false);
      const lower = text.toLowerCase().trim();

      if (lower.startsWith('/start')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'bot',
            text: '👋 Бот активен! Вы привязаны к семье **Семья Смирновых**.\nОтправьте сумму и описание (например: `650 Обед` или `+10000 копилка подушка`) или фото чека.',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else if (lower.startsWith('/dashboard')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'bot',
            text: '📊 **Семейный бюджет за Сентябрь 2026**\n\n💰 Расходы: **38 750 ₽** из **128 000 ₽** (30%)\n📈 Прогноз на конец месяца: **116 250 ₽** (в рамках лимита ✅)\n👤 Ваш баланс: **+14 500 ₽**\n\nВеб-дашборд открыт в текущей вкладке!',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            buttons: [
              { label: '📊 Перейти к графикам', callbackData: 'open_web' },
            ],
          },
        ]);
      } else if (lower.startsWith('/savings') || lower === 'копилка' || lower === 'вклады') {
        const totalSavings = savingsGoals.reduce((sum, g) => sum + g.currentKopecks, 0);
        const goalsText = savingsGoals
          .map(
            (g) =>
              `• **${g.name}** (${g.bankName}${g.interestRate ? `, ${g.interestRate}%` : ''}): ${formatMoney(
                g.currentKopecks
              )} / ${formatMoney(g.targetKopecks)} (${Math.round((g.currentKopecks / g.targetKopecks) * 100)}%)`
          )
          .join('\n');

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'bot',
            text: `🐷 **Семейный фонд накоплений:**\nВсего отложено: **${formatMoney(
              totalSavings
            )}**\n\n${goalsText || 'Цели пока не настроены'}\n\n💡 Чтобы отложить, напишите: ` + '`+10000 копилка подушка`',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        // Savings command regex: e.g. "+15000 копилка подушка", "отложил 10000 отпуск", "копилка 5000 авто", "+5000 в копилку"
        const isSavingCommand = /копилк|отложил|отложить|сбережен|накоплен|вклад/i.test(lower);
        
        // Extract numbers
        const numMatch = text.match(/(?:\+)?(\d+(?:[.,]\d{1,2})?)/);

        if (isSavingCommand && numMatch) {
          const amountRub = parseFloat(numMatch[1].replace(',', '.'));
          const kopecks = Math.round(amountRub * 100);

          // Find target goal
          let matchedGoal = savingsGoals[0];
          for (const goal of savingsGoals) {
            const gNameLower = goal.name.toLowerCase();
            if (
              lower.includes(gNameLower) ||
              (gNameLower.includes('подушк') && lower.includes('подушк')) ||
              (gNameLower.includes('отпуск') && lower.includes('отпуск')) ||
              (gNameLower.includes('авто') && (lower.includes('авто') || lower.includes('машин')))
            ) {
              matchedGoal = goal;
              break;
            }
          }

          const goalName = matchedGoal ? matchedGoal.name : 'Семейная копилка';

          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now() + 1}`,
              sender: 'bot',
              text: `🐷 **Отчислено в копилку:** ${amountRub.toFixed(2)} ₽\n🎯 **Цель:** ${goalName} (${matchedGoal?.bankName || 'Вклад'})\n💡 Средства направлены в фонд накоплений и вычтены из операционного бюджета месяца.`,
              time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);

          onConfirmTelegramDraft({
            type: 'saving',
            amountKopecks: kopecks,
            description: `В копилку: ${goalName}`,
            categoryId: 'cat-savings',
            subCategory: goalName,
            goalId: matchedGoal?.id,
          });
        } else {
          // Quick expense/income parser regex (e.g. "540 кофе" or "1250 супермаркет" or "+50000 зарплата")
          const match = text.match(/^(?:\+)?(\d+(?:[.,]\d{1,2})?)\s+(.*)$/);
          if (match) {
            const amountRub = parseFloat(match[1].replace(',', '.'));
            const desc = match[2];
            const kopecks = Math.round(amountRub * 100);
            const isIncome = text.startsWith('+') || /зарплат|аванс|доход|премия/i.test(desc);

            let cat = 'Продукты';
            let catId = 'cat-groceries';
            if (/кредит|ипотек|банк|займ|рассрочк|сбербанк|тинькофф|втб|альфа/i.test(desc)) {
              cat = 'Кредиты/Банки';
              catId = 'cat-loans';
            } else if (/кофе|пицца|кафе|обед|ресторан|доставка/i.test(desc)) {
              cat = 'Кафе и Доставка';
              catId = 'cat-cafes';
            } else if (/бензин|азс|такси|мойка|парковк|то\b/i.test(desc)) {
              cat = 'Авто и Транспорт';
              catId = 'cat-auto';
            } else if (/аптека|лекарств|врач|стоматолог|витамин/i.test(desc)) {
              cat = 'Здоровье и Аптека';
              catId = 'cat-health';
            } else if (/жкх|квартплат|еирц|свет|интернет/i.test(desc)) {
              cat = 'Жилье и ЖКХ';
              catId = 'cat-housing';
            } else if (/одежд|обувь|куртк|кроссовк/i.test(desc)) {
              cat = 'Одежда и Обувь';
              catId = 'cat-clothes';
            } else if (/кино|книг|подписк|игры/i.test(desc)) {
              cat = 'Развлечения и Хобби';
              catId = 'cat-leisure';
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now() + 1}`,
                sender: 'bot',
                text: `✅ **Записан ${isIncome ? 'доход' : 'расход'}:** ${amountRub.toFixed(2)} ₽\n📝 **Описание:** ${desc}\n🏷️ **Категория:** ${cat}\n👤 **Плательщик:** Алексей (Вы)`,
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                buttons: [
                  { label: '✏️ Изменить', callbackData: 'edit_tx' },
                  { label: '❌ Отмена', callbackData: 'cancel_tx', style: 'danger' },
                ],
              },
            ]);

            onConfirmTelegramDraft({
              type: isIncome ? 'income' : 'expense',
              amountKopecks: kopecks,
              description: desc,
              categoryId: catId,
            });
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now() + 1}`,
                sender: 'bot',
                text: '💡 Чтобы записать расход или накопление, отправьте сумму и назначение:\n• `650 Обед` (расход)\n• `+10000 копилка подушка` (в копилку)\n• `/savings` (просмотр накоплений)\n\nИли нажмите 📎 для отправки фото чека!',
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }
      }
    }, 600);
  };

  const handleSimulatePhotoUpload = () => {
    const userMsg: TelegramBotMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: '📷 [Фото кассового чека ВкусВилл]',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: 'bot',
          text: '🔍 **Локальный Tesseract OCR распознал чек:**\n\n🏪 **Магазин:** ВкусВилл (ИП Избёнка)\n💰 **Сумма:** 1 845.00 ₽\n🛒 **Позиции:**\n• Молоко 3.2% 1л — 92.00 ₽\n• Хлеб бездрожжевой — 68.00 ₽\n• Сыр Российский — 340.00 ₽\n• Филе куриное 1кг — 410.00 ₽\n• Манго Египет — 480.00 ₽\n• Масло сладкосливочное — 215.00 ₽\n• Пакет био — 15.00 ₽\n\n📌 **Расход ожидает вашего подтверждения** в веб-интерфейсе FinSync.',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          buttons: [
            { label: '✅ Подтвердить в приложении', callbackData: 'open_review' },
          ],
        },
      ]);
    }, 1200);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-bot-title"
        tabIndex={-1}
        className="dark:bg-[#0b141a] bg-[#f8fafc] w-full max-w-md h-[88vh] max-h-[700px] rounded-3xl border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden flex flex-col dark:text-white text-slate-900 outline-none"
      >
        {/* Telegram Header */}
        <div className="px-4 py-3 dark:bg-[#1f2c34] bg-white border-b dark:border-slate-800 border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md relative">
              <Bot className="w-5 h-5" />
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute bottom-0 right-0 border-2 dark:border-[#1f2c34] border-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 id="telegram-bot-title" className="font-bold text-sm dark:text-white text-slate-900">FinSync Telegram Bot</h3>
                <span className="text-[10px] dark:bg-sky-500/20 bg-sky-100 dark:text-sky-300 text-sky-700 px-1.5 py-0.2 rounded font-mono">
                  бот
                </span>
              </div>
              <p className="text-[11px] dark:text-slate-400 text-slate-500">@FinSync_Family_bot • бот семьи</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно Telegram бота"
            className="w-8 h-8 flex items-center justify-center dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-700/50 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 dark:bg-[#0b141a] bg-slate-100/70 overscroll-contain">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  msg.sender === 'user'
                    ? 'dark:bg-[#005c4b] bg-emerald-600 text-white rounded-br-xs'
                    : 'dark:bg-[#202c33] bg-white dark:text-slate-200 text-slate-800 rounded-bl-xs border dark:border-slate-700/60 border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="whitespace-pre-line break-words">{msg.text}</div>
                <div
                  className={`text-[9px] mt-1 text-right flex items-center justify-end space-x-1 ${
                    msg.sender === 'user' ? 'text-emerald-100/80' : 'dark:text-slate-400 text-slate-400'
                  }`}
                >
                  <span>{msg.time}</span>
                  {msg.sender === 'user' && <CheckCheck className="w-3 h-3 inline text-emerald-200" />}
                </div>
              </div>

              {/* Bot Action Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%]">
                  {msg.buttons.map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (btn.callbackData === 'cmd_dashboard') {
                          handleSendMessage('/dashboard');
                        } else if (btn.callbackData === 'cmd_savings') {
                          handleSendMessage('/savings');
                        } else if (btn.callbackData === 'cmd_photo') {
                          handleSimulatePhotoUpload();
                        } else if (btn.callbackData === 'open_web' || btn.callbackData === 'open_review') {
                          onClose();
                        }
                      }}
                      className="px-3 py-1.5 dark:bg-[#1f2c34] bg-white dark:hover:bg-[#2a3942] hover:bg-slate-50 border dark:border-slate-700/80 border-slate-200 rounded-xl text-xs font-semibold dark:text-sky-400 text-sky-600 transition active:scale-95 shadow-xs"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-1.5 dark:text-slate-400 text-slate-600 text-xs py-1 px-3 dark:bg-[#202c33] bg-white border dark:border-transparent border-slate-200 shadow-2xs rounded-full w-fit">
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px]">Бот печатает...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-2.5 dark:bg-[#1f2c34] bg-white border-t dark:border-slate-800 border-slate-200 flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleSimulatePhotoUpload}
            title="Отправить чек с камеры"
            className="p-2 dark:text-slate-400 text-slate-500 dark:hover:text-sky-400 hover:text-sky-600 dark:hover:bg-[#2a3942] hover:bg-slate-100 rounded-xl transition"
          >
            <Camera className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Сообщение или +10000 копилка..."
            className="flex-1 dark:bg-[#2a3942] bg-slate-100 border dark:border-slate-700/60 border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm dark:text-white text-slate-900 focus:outline-none focus:border-sky-500 dark:placeholder:text-slate-400 placeholder:text-slate-400"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            className="p-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md transition active:scale-95 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramBotModal;
