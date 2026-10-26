"""
Telegram Bot based on aiogram 3.x for FinSync Family Budget.
Features:
- Access only for Telegram IDs from the allowlist (checked by the bot and by the API)
- /start authenticates against the backend (/api/auth/telegram, trusted bot key)
- Quick entry (e.g. "540 Кофе", "+50000 Зарплата", "1450 Продукты #еда") saved to PostgreSQL
  with an "Отменить" button
- /dashboard command: live monthly summary and burn-rate forecast, plus a one-time link
  that opens the web dashboard in the browser
- Complete MarkdownV2 escaping against user text injection
"""
import asyncio
from datetime import date
import logging
import os
import re
from typing import Any, Optional, Tuple

from aiogram import BaseMiddleware, Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, WebAppInfo

try:
    from backend.bot_client import BotAPIClient
    from backend.security import is_telegram_id_allowed
except ImportError:
    from bot_client import BotAPIClient
    from security import is_telegram_id_allowed

# Real values come only from the server-side .env (never from the repository).
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
if not TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN is not set (fill it in the server-side .env)")
DASHBOARD_URL = os.getenv("APP_URL", "http://localhost:3000")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:8000")
MINI_APP_URL = f"{DASHBOARD_URL}?source=telegram"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("family_budget.bot")

bot = Bot(token=TOKEN)
dp = Dispatcher()
api_client = BotAPIClient(base_url=BACKEND_API_URL)


class AllowlistMiddleware(BaseMiddleware):
    """Silently ignore every update from Telegram IDs that are not on the allowlist."""

    async def __call__(self, handler, event, data):
        user = data.get("event_from_user")
        if user is None or not is_telegram_id_allowed(user.id):
            logger.warning("Ignoring update from non-allowlisted Telegram ID %s", user.id if user else None)
            return None
        return await handler(event, data)


dp.update.outer_middleware(AllowlistMiddleware())


def escape_markdown_v2(text: Any) -> str:
    """
    Escapes characters reserved by Telegram MarkdownV2:
    _ * [ ] ( ) ~ ` > # + - = | { } . !
    Protects against markdown injection from arbitrary user inputs and API strings.
    """
    if text is None:
        return ""
    escape_chars = r"_*[]()~`>#+-=|{}.!"
    return re.sub(f"([{re.escape(escape_chars)}])", r"\\\1", str(text))


async def dashboard_link(telegram_id: int) -> str:
    """Dashboard URL with a one-time login code (valid 5 minutes) for browser access."""
    try:
        code = await api_client.get_login_code(telegram_id)
        return f"{DASHBOARD_URL}?login={code}"
    except Exception as exc:
        logger.warning("Could not create dashboard login link (%s)", type(exc).__name__)
        return DASHBOARD_URL


async def get_or_create_user_auth(user: types.User, state: FSMContext) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Ensure the Telegram user is authenticated on the backend.
    Returns: (access_token, member_id, family_id).
    Stores credentials in FSM state for rapid access.
    """
    data = await state.get_data()
    token = data.get("access_token")
    member_id = data.get("member_id")
    family_id = data.get("family_id")

    if token and member_id:
        return token, member_id, family_id

    try:
        auth_res = await api_client.auth_telegram(
            telegram_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            username=user.username,
        )
        token = auth_res.get("access_token", "")
        u_info = auth_res.get("user") or {}
        member_id = u_info.get("member_id")
        family_id = u_info.get("family_id")

        await state.update_data(
            access_token=token,
            member_id=member_id,
            family_id=family_id,
            user=u_info,
        )
        return token, member_id, family_id
    except Exception as exc:
        # The bot cannot sign tokens itself. Without a valid token API calls fail with 401 and the
        # handlers show an error to the user.
        logger.warning("Auth call failed for tg_user %s (%s)", user.id, type(exc).__name__)
        return "", None, None


@dp.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    """
    Handle /start. Access is controlled by the Telegram ID allowlist, so an authenticated user
    (the API found or created their family membership) is simply greeted.
    """
    if not message.from_user:
        return

    user_name = escape_markdown_v2(message.from_user.first_name or "друг")
    token, member_id, family_id = await get_or_create_user_auth(message.from_user, state)
    await state.set_state(None)

    if member_id:
        await message.answer(
            f"👋 Привет, {user_name}\\!\n\n"
            f"Вы авторизованы в семейном бюджете\\.\n\n"
            f"💡 *Возможности бота:*\n"
            f"• Введите `650 Обед` для быстрой записи расхода в базу\n"
            f"• `\\+50000 Зарплата` — доход\n"
            f"• Отправьте /dashboard для проверки баланса и прогноза",
            parse_mode="MarkdownV2",
        )
    else:
        # Auth failed (backend unavailable) or the family is full.
        await message.answer(
            "⚠️ Не удалось подключиться к семейному бюджету\\. "
            "Попробуйте позже или сообщите администратору\\.",
            parse_mode="MarkdownV2",
        )


@dp.message(Command("dashboard"))
async def cmd_dashboard(message: types.Message, state: FSMContext):
    """
    Fetch real monthly summary and burn-rate forecast from PostgreSQL.
    """
    if not message.from_user:
        return

    token, _, _ = await get_or_create_user_auth(message.from_user, state)
    link = await dashboard_link(message.from_user.id)

    try:
        summary = await api_client.get_dashboard_summary(token=token)
        forecast = await api_client.get_dashboard_forecast(token=token)

        total_spent_rub = summary.get("total_expenses_kopecks", 0) / 100.0
        total_income_rub = summary.get("total_income_kopecks", 0) / 100.0
        net_savings_rub = summary.get("net_savings_kopecks", 0) / 100.0
        total_budget_rub = forecast.get("total_budget_kopecks", 0) / 100.0
        projected_rub = forecast.get("projected_spent_kopecks", 0) / 100.0
        period = summary.get("period", "Текущий месяц")
        is_over = forecast.get("is_over_budget", False)

        percent = int(round((total_spent_rub / total_budget_rub * 100) if total_budget_rub > 0 else 0))
        status_text = "⚠️ превышение бюджета" if is_over else "в рамках бюджета ✅"

        safe_period = escape_markdown_v2(period)
        safe_spent = escape_markdown_v2(f"{total_spent_rub:,.2f}")
        safe_budget = escape_markdown_v2(f"{total_budget_rub:,.2f}")
        safe_projected = escape_markdown_v2(f"{projected_rub:,.2f}")
        safe_income = escape_markdown_v2(f"{total_income_rub:,.2f}")
        safe_savings = escape_markdown_v2(f"{net_savings_rub:,.2f}")
        safe_status = escape_markdown_v2(status_text)

        text = (
            f"📊 *Семейный бюджет за {safe_period}*\n\n"
            f"💰 Расходы: *{safe_spent} ₽* из *{safe_budget} ₽* \\({percent}%\\)\n"
            f"📈 Прогноз на конец месяца: *{safe_projected} ₽* \\({safe_status}\\)\n"
            f"💵 Доходы: *{safe_income} ₽*\n"
            f"🏦 Баланс: *{safe_savings} ₽*\n\n"
            f"👇 Полная аналитика в веб\\-интерфейсе:"
        )

        await message.answer(
            text,
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=link)]
                ]
            ),
        )
    except Exception as exc:
        logger.error("cmd_dashboard failed: %s", exc)
        safe_err = escape_markdown_v2(str(exc))
        await message.answer(
            f"⚠️ Не удалось загрузить данные дашборда: {safe_err}\n"
            f"Вы можете открыть веб\\-интерфейс напрямую:",
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=link)]
                ]
            ),
        )


@dp.callback_query(F.data.startswith("tx_reject:"))
async def callback_reject_transaction(callback: types.CallbackQuery, state: FSMContext):
    """Cancel a transaction that was just entered."""
    if not callback.data or not callback.message:
        return

    draft_id = callback.data.split(":", 1)[1]
    token, _, _ = await get_or_create_user_auth(callback.from_user, state)

    try:
        await api_client.reject_transaction(token=token, draft_id=draft_id)
    except Exception as exc:
        logger.warning("Reject call error for %s: %s", draft_id, exc)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply(
        "❌ *Запись отменена\\.*",
        parse_mode="MarkdownV2",
    )
    await callback.answer("Отменено")


@dp.message(F.text)
async def handle_quick_entry(message: types.Message, state: FSMContext):
    """
    Parse quick manual expense or income:
    Expense: '540 Кофе', '1450.50 Продукты #еда', '2500 Бензин АИ-95'.
    Income: '+50000 Зарплата', '+15000 Премия'.
    Sends POST request to /api/transactions and records in PostgreSQL.
    """
    if not message.text or not message.from_user:
        return

    text = message.text.strip()
    is_income = text.startswith("+")
    clean_text = text.lstrip("+").strip() if is_income else text

    match = re.match(r"^(\d+(?:[.,]\d{1,2})?)\s+(.*)$", clean_text)

    if match:
        amount_str, desc = match.groups()
        amount_rub = float(amount_str.replace(",", "."))
        amount_kopecks = int(round(amount_rub * 100))

        token, member_id, _ = await get_or_create_user_auth(message.from_user, state)

        # Extract optional tags
        tags = [w.lstrip("#") for w in desc.split() if w.startswith("#")]
        clean_desc = " ".join([w for w in desc.split() if not w.startswith("#")]).strip() or desc

        tx_type = "income" if is_income else "expense"

        try:
            tx_res = await api_client.create_transaction(
                token=token,
                amount_kopecks=amount_kopecks,
                description=clean_desc,
                paid_by_member_id=member_id,
                category_id=None,  # Backend intelligently selects or defaults category
                tx_type=tx_type,
                tx_date=date.today().isoformat(),
                tags=tags,
            )

            sign = "+" if is_income else "-"
            type_label = "Доход" if is_income else "Расход"
            safe_amount = escape_markdown_v2(f"{sign}{amount_rub:,.2f} ₽")
            safe_desc = escape_markdown_v2(clean_desc)
            user_name = escape_markdown_v2(message.from_user.first_name or "Пользователь")
            tx_id = tx_res.get("id", "")

            await message.answer(
                f"✅ *{type_label} успешно записан в PostgreSQL\\!*\n\n"
                f"💰 *Сумма:* {safe_amount}\n"
                f"📝 *Описание:* {safe_desc}\n"
                f"👤 *Участник:* {user_name}\n"
                f"🆔 *ID:* `{escape_markdown_v2(tx_id)}`",
                parse_mode="MarkdownV2",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [
                            InlineKeyboardButton(text="❌ Отменить", callback_data=f"tx_reject:{tx_id}"),
                            InlineKeyboardButton(text="📱 Mini App", web_app=WebAppInfo(url=MINI_APP_URL)),
                        ],
                        [
                            InlineKeyboardButton(text="📊 Дашборд", url=DASHBOARD_URL),
                        ],
                    ]
                ),
            )
        except Exception as exc:
            logger.error("Failed to create quick transaction: %s", exc)
            safe_err = escape_markdown_v2(str(exc))
            await message.answer(
                f"❌ Ошибка сохранения операции: {safe_err}\n"
                f"Попробуйте снова или проверьте подключение к серверу\\.",
                parse_mode="MarkdownV2",
            )
    else:
        await message.answer(
            "💡 *Как вносить данные в бота:*\n\n"
            "• *Расход:* `650 Обед` или `2400 Бензин АИ\\-95 #авто`\n"
            "• *Доход:* `+80000 Зарплата` или `+15000 Премия`\n"
            "• *Кнопки:* Нажмите кнопку меню *📱 Бюджет* внизу для открытия Mini App\\.",
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="📱 Открыть Mini App", web_app=WebAppInfo(url=MINI_APP_URL)),
                        InlineKeyboardButton(text="📊 Дашборд", url=DASHBOARD_URL),
                    ]
                ]
            ),
        )


async def main():
    try:
        bot_user = await bot.get_me()
        logger.info(f"✅ FinSync Telegram bot connected: @{bot_user.username} (ID: {bot_user.id})")
        logger.info(f"🚀 Connected to backend at: {BACKEND_API_URL}")

        # Set Telegram Chat Menu Button to open Mini App
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="📱 Бюджет",
                    web_app=WebAppInfo(url=MINI_APP_URL)
                )
            )
            logger.info("✅ Chat Menu Button set to Telegram Mini App (%s)", MINI_APP_URL)
        except Exception as mb_exc:
            logger.warning("Could not set chat menu button: %s", mb_exc)

        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"❌ Failed to start Telegram bot: {e}")
        raise e
    finally:
        await api_client.close()


if __name__ == "__main__":
    asyncio.run(main())
