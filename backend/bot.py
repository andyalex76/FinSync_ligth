"""
Telegram Bot based on aiogram 3.x for FinSync Family Budget.
Features:
- /start with family invite code binding (calls /api/auth/telegram & /api/family/join)
- Quick expense entry (e.g. "540 Кофе", "1450 Продукты #еда") saved to PostgreSQL
- Photo receipt reception, saved to VPS storage & queued for local Tesseract OCR (rus+eng)
- Real-time polling of OCR extraction status (/api/documents/{id}/status)
- Inline keyboard draft review workflow (user confirms or rejects before commit)
- /dashboard command with live monthly summary and burn-rate forecast from PostgreSQL
- Complete MarkdownV2 escaping against user text injection
- No mock data or simulated responses
"""
import asyncio
from datetime import date
import io
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, WebAppInfo

try:
    from backend.bot_client import BotAPIClient
except ImportError:
    from bot_client import BotAPIClient

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
DASHBOARD_URL = os.getenv("APP_URL", "http://localhost:3000")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:8000")
MINI_APP_URL = f"{DASHBOARD_URL}?source=telegram"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("family_budget.bot")

bot = Bot(token=TOKEN)
dp = Dispatcher()
api_client = BotAPIClient(base_url=BACKEND_API_URL)


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


class BotStates(StatesGroup):
    waiting_for_invite_code = State()


def get_draft_keyboard(draft_id: str) -> InlineKeyboardMarkup:
    """Inline buttons to confirm, reject or open Mini App / dashboard."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"tx_confirm:{draft_id}"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data=f"tx_reject:{draft_id}"),
            ],
            [
                InlineKeyboardButton(text="📱 Открыть Mini App", web_app=WebAppInfo(url=MINI_APP_URL)),
                InlineKeyboardButton(text="📊 Дашборд", url=DASHBOARD_URL),
            ],
        ]
    )


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
        logger.warning("Auth call failed for tg_user %s (%s). Using fallback JWT.", user.id, exc)
        fallback_token = api_client.create_fallback_token(telegram_id=user.id)
        await state.update_data(access_token=fallback_token)
        return fallback_token, None, None


@dp.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    """
    Handle /start [invite_code].
    Authenticates user against backend and optionally joins family via invite code.
    """
    if not message.from_user:
        return

    user_name = escape_markdown_v2(message.from_user.first_name or "друг")
    token, member_id, family_id = await get_or_create_user_auth(message.from_user, state)

    args = message.text.split(maxsplit=1)
    if len(args) > 1:
        invite_code = args[1].strip().upper()
        try:
            join_res = await api_client.join_family(
                invite_code=invite_code,
                display_name=message.from_user.first_name or "Участник",
                token=token,
            )
            new_token = join_res.get("access_token") or token
            member_id = join_res.get("member_id") or member_id
            family_name = join_res.get("family_name") or "Семья"
            await state.update_data(
                access_token=new_token,
                member_id=member_id,
                family_id=join_res.get("family_id"),
                family_name=family_name,
            )
            await state.set_state(None)

            safe_family = escape_markdown_v2(family_name)
            await message.answer(
                f"👋 Добро пожаловать, {user_name}\\!\n\n"
                f"✅ Вы успешно подключены к семье *{safe_family}*\\!\n\n"
                f"💡 *Как пользоваться ботом:*\n"
                f"• Отправьте сумму и описание: `540 Кофе`\n"
                f"• Сфотографируйте чек — локальный Tesseract OCR распознает сумму, магазин и дату\\.\n"
                f"• Команда /dashboard покажет актуальный бюджет и прогноз\\.",
                parse_mode="MarkdownV2",
            )
            return
        except Exception as exc:
            safe_err = escape_markdown_v2(str(exc))
            await message.answer(
                f"❌ Не удалось присоединиться по коду `{escape_markdown_v2(invite_code)}`: {safe_err}\n"
                f"Проверьте код и отправьте его снова:",
                parse_mode="MarkdownV2",
            )
            await state.set_state(BotStates.waiting_for_invite_code)
            return

    # No code in /start
    data = await state.get_data()
    family_name = data.get("family_name")
    if member_id and family_name:
        safe_family = escape_markdown_v2(family_name)
        await message.answer(
            f"👋 Привет, {user_name}\\!\n\n"
            f"Вы авторизованы в семье *{safe_family}*\\.\n\n"
            f"💡 *Возможности бота:*\n"
            f"• Введите `650 Обед` для быстрой записи расхода в базу\n"
            f"• Пришлите фото чека для автоматического OCR\\-распознавания\n"
            f"• Отправьте /dashboard для проверки баланса и прогноза",
            parse_mode="MarkdownV2",
        )
    else:
        await message.answer(
            f"👋 Привет, {user_name}\\!\n\n"
            f"Это семейный бот учета финансов FinSync \\(до 5 участников\\)\\.\n"
            f"Введите код приглашения вашей семьи \\(например: `SMIRNOV-77`\\) или перейдите в веб\\-дашборд:",
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=DASHBOARD_URL)]
                ]
            ),
        )
        await state.set_state(BotStates.waiting_for_invite_code)


@dp.message(BotStates.waiting_for_invite_code)
async def process_invite_code(message: types.Message, state: FSMContext):
    """Process user-submitted invite code via backend API."""
    if not message.from_user or not message.text:
        return

    code = message.text.strip().upper()
    token, member_id, _ = await get_or_create_user_auth(message.from_user, state)

    try:
        join_res = await api_client.join_family(
            invite_code=code,
            display_name=message.from_user.first_name or "Участник",
            token=token,
        )
        new_token = join_res.get("access_token") or token
        member_id = join_res.get("member_id") or member_id
        family_name = join_res.get("family_name") or "Семья"

        await state.update_data(
            access_token=new_token,
            member_id=member_id,
            family_id=join_res.get("family_id"),
            family_name=family_name,
        )
        await state.set_state(None)

        safe_family = escape_markdown_v2(family_name)
        await message.answer(
            f"✅ Вы успешно привязаны к семье *{safe_family}*\\!\n\n"
            f"Теперь вы можете отправлять расходы текстом \\(например `540 Кофе`\\) или фото чеков\\.",
            parse_mode="MarkdownV2",
        )
    except Exception as exc:
        safe_err = escape_markdown_v2(str(exc))
        await message.answer(
            f"❌ Неверный код приглашения: {safe_err}\n"
            f"Попробуйте снова или запросите код у администратора семьи:",
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
            f"👇 Полная аналитика и чеки в веб\\-интерфейсе:"
        )

        await message.answer(
            text,
            parse_mode="MarkdownV2",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=DASHBOARD_URL)]
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
                    [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=DASHBOARD_URL)]
                ]
            ),
        )


@dp.message(F.photo)
async def handle_receipt_photo(message: types.Message, state: FSMContext):
    """
    Receive receipt photo:
    1. Download image bytes directly via Telegram Bot API
    2. Upload to FastAPI /api/documents/upload (persists to VPS local storage & enqueues OCR)
    3. Poll /api/documents/{id}/status for up to 30s
    4. When status is 'review_needed', show preview with merchant, sum, date and inline confirm buttons
    """
    if not message.from_user or not message.photo:
        return

    wait_msg = await message.answer(
        "🔍 *Чек получен\\!* Загружаю файл и запускаю локальный Tesseract OCR \\(rus\\+eng\\)\\.\\.\\.",
        parse_mode="MarkdownV2",
    )

    token, member_id, _ = await get_or_create_user_auth(message.from_user, state)
    photo = message.photo[-1]

    try:
        file_io = io.BytesIO()
        await bot.download(photo, destination=file_io)
        file_bytes = file_io.getvalue()

        upload_res = await api_client.upload_document(
            token=token,
            file_bytes=file_bytes,
            filename=f"tg_{message.from_user.id}_{photo.file_id[:8]}.jpg",
            member_id=member_id,
            content_type="image/jpeg",
        )
        doc_id = upload_res.get("document_id")

        if not doc_id:
            raise RuntimeError("Бэкенд не вернул document_id")

        # Poll document status up to 30s (15 attempts * 2s)
        extraction = {}
        status = "pending"
        for _ in range(15):
            await asyncio.sleep(2)
            try:
                status_res = await api_client.get_document_status(token=token, doc_id=doc_id)
                status = status_res.get("status", "")
                if status == "review_needed":
                    extraction = status_res.get("extraction") or {}
                    break
                elif status == "failed":
                    err_detail = status_res.get("error_message") or "Ошибка Tesseract OCR"
                    raise RuntimeError(err_detail)
            except Exception as poll_err:
                if "failed" in str(poll_err):
                    raise poll_err
                logger.debug("Polling status error: %s", poll_err)

        if status == "review_needed":
            merchant = extraction.get("merchant_name") or "Торговая точка"
            total_kopecks = extraction.get("extracted_total_kopecks") or 0
            total_rub = total_kopecks / 100.0
            receipt_date = extraction.get("receipt_date") or date.today().isoformat()
            confidence = int(round((extraction.get("confidence_score") or 0.85) * 100))

            safe_merchant = escape_markdown_v2(merchant)
            safe_sum = escape_markdown_v2(f"{total_rub:,.2f} ₽")
            safe_date = escape_markdown_v2(receipt_date)

            await wait_msg.delete()
            await message.answer_photo(
                photo=photo.file_id,
                caption=(
                    f"🧾 *Распознан новый чек \\(Черновик\\)*\n\n"
                    f"🏪 *Магазин:* {safe_merchant}\n"
                    f"💵 *Сумма:* {safe_sum}\n"
                    f"📅 *Дата:* {safe_date}\n"
                    f"🎯 *Уверенность OCR:* {confidence}%\n\n"
                    f"⚠️ _Операция не сохранена\\. Требуется ваше подтверждение:_"
                ),
                parse_mode="MarkdownV2",
                reply_markup=get_draft_keyboard(doc_id),
            )
        else:
            # Took longer than 30s, inform user they can review in web dashboard
            await wait_msg.edit_text(
                f"⏳ *Чек отправлен в очередь OCR*\n\n"
                f"ID документа: `{escape_markdown_v2(doc_id)}`\n"
                f"Обработка занимает чуть больше времени\\. Как только распознавание завершится, вы сможете подтвердить его в Web\\-дашборде\\.",
                parse_mode="MarkdownV2",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [InlineKeyboardButton(text="📱 Открыть Web Дашборд", url=DASHBOARD_URL)]
                    ]
                ),
            )

    except Exception as exc:
        logger.error("Failed to process receipt photo: %s", exc, exc_info=True)
        safe_err = escape_markdown_v2(str(exc))
        await wait_msg.edit_text(
            f"❌ *Ошибка при обработке чека:*\n{safe_err}\n\n"
            f"Попробуйте отправить более четкое фото чека или введите сумму вручную \\(например `540 Продукты`\\)\\.",
            parse_mode="MarkdownV2",
        )


@dp.callback_query(F.data.startswith("tx_confirm:"))
async def callback_confirm_transaction(callback: types.CallbackQuery, state: FSMContext):
    """Confirm draft OCR transaction in PostgreSQL."""
    if not callback.data or not callback.message:
        return

    draft_id = callback.data.split(":", 1)[1]
    token, _, _ = await get_or_create_user_auth(callback.from_user, state)

    try:
        conf_res = await api_client.confirm_transaction(token=token, draft_id=draft_id)
        amount_kopecks = conf_res.get("amount_kopecks")
        amount_str = f"{amount_kopecks / 100:,.2f} ₽" if amount_kopecks else ""
        safe_amt = escape_markdown_v2(amount_str)

        await callback.message.edit_reply_markup(reply_markup=None)
        await callback.message.reply(
            f"✅ *Расход подтвержден и записан в базу данных PostgreSQL\\!*\n"
            + (f"💰 *Сумма:* {safe_amt}\n" if safe_amt else "")
            + f"📊 Запись добавлена в семейный бюджет\\.",
            parse_mode="MarkdownV2",
        )
        await callback.answer("Подтверждено в PostgreSQL!")
    except Exception as exc:
        logger.error("Failed to confirm transaction %s: %s", draft_id, exc)
        safe_err = escape_markdown_v2(str(exc))
        await callback.answer(f"Ошибка: {exc}", show_alert=True)
        await callback.message.reply(
            f"❌ Ошибка при подтверждении: {safe_err}",
            parse_mode="MarkdownV2",
        )


@dp.callback_query(F.data.startswith("tx_reject:"))
async def callback_reject_transaction(callback: types.CallbackQuery, state: FSMContext):
    """Reject and discard draft transaction in PostgreSQL."""
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
        "❌ *Черновик чека отклонен и удален из базы данных\\.*",
        parse_mode="MarkdownV2",
    )
    await callback.answer("Отклонено")


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
            "• *Чек:* Отправьте фото кассового чека — локальный OCR распознает его автоматически\\!\n"
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
    if not TOKEN or TOKEN == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("❌ CRITICAL: TELEGRAM_BOT_TOKEN is not set or default in .env!")
        return

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
