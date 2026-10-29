"""
Unit and contract tests for FinSync Telegram Bot client and handlers.
Validates:
- BotAPIClient HTTP interactions and endpoint contracts
- MarkdownV2 escaping and injection prevention
- Inline keyboard generation
- Auth & token management
"""
from unittest.mock import AsyncMock, MagicMock, patch

try:
    import pytest
except ImportError:
    class _PytestMock:
        @staticmethod
        def fixture(func):
            return func

        class mark:
            @staticmethod
            def asyncio(func):
                return func

        @staticmethod
        def raises(expected_exception):
            class _RaisesContext:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc_val, exc_tb):
                    if exc_type is None:
                        raise AssertionError(f"Expected exception {expected_exception} was not raised")
                    return issubclass(exc_type, expected_exception)

            return _RaisesContext()

    pytest = _PytestMock()

try:
    from backend.bot_client import BotAPIClient
    from backend.bot import escape_markdown_v2
except ImportError:
    from bot_client import BotAPIClient
    from bot import escape_markdown_v2


def test_escape_markdown_v2():
    """Verify that all reserved Telegram MarkdownV2 characters are escaped."""
    raw = "Hello_World *bold* [link](url) ~strike~ `code` >quote #tag +1 -2 =3 |pipe| {brace} 1.item !exclaim"
    escaped = escape_markdown_v2(raw)

    assert r"\_" in escaped
    assert r"\*" in escaped
    assert r"\[" in escaped
    assert r"\]" in escaped
    assert r"\(" in escaped
    assert r"\)" in escaped
    assert r"\~" in escaped
    assert r"\`" in escaped
    assert r"\>" in escaped
    assert r"\#" in escaped
    assert r"\+" in escaped
    assert r"\-" in escaped
    assert r"\=" in escaped
    assert r"\|" in escaped
    assert r"\{" in escaped
    assert r"\}" in escaped
    assert r"\." in escaped
    assert r"\!" in escaped

    # None should return empty string safely
    assert escape_markdown_v2(None) == ""


def test_receipt_and_invite_features_are_removed():
    """Receipts/OCR and the invite-code dialog were removed: access is by Telegram ID allowlist."""
    try:
        from backend import bot as bot_module
    except ImportError:
        import bot as bot_module

    for name in ("handle_receipt_photo", "callback_confirm_transaction", "process_invite_code", "get_draft_keyboard", "BotStates"):
        assert not hasattr(bot_module, name), name
    for name in ("upload_document", "get_document_status", "confirm_transaction", "join_family"):
        assert not hasattr(BotAPIClient, name), name


@pytest.mark.asyncio
async def test_bot_client_auth_headers():
    """Verify auth headers generation."""
    client = BotAPIClient(base_url="http://localhost:8000")
    headers_no_token = client._auth_headers(None)
    assert "Authorization" not in headers_no_token

    headers_with_token = client._auth_headers("jwt-token-123")
    assert headers_with_token["Authorization"] == "Bearer jwt-token-123"
    await client.close()


def test_bot_client_cannot_forge_tokens():
    """The bot holds no SECRET_KEY and must not be able to sign JWTs itself."""
    client = BotAPIClient()
    assert not hasattr(client, "create_fallback_token")
    assert not hasattr(client, "secret_key")


@pytest.mark.asyncio
async def test_bot_client_auth_telegram_success():
    """Mock test for auth_telegram with successful response."""
    client = BotAPIClient(base_url="http://testbackend")

    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json = AsyncMock(return_value={
        "access_token": "mock-access-token",
        "user": {
            "telegram_id": 12345,
            "first_name": "Иван",
            "member_id": "mem-ivan",
            "family_id": "fam-smirnov",
        }
    })

    mock_session = MagicMock()
    mock_session.post.return_value.__aenter__.return_value = mock_resp

    with patch.object(client, "get_session", AsyncMock(return_value=mock_session)):
        result = await client.auth_telegram(telegram_id=12345, first_name="Иван")
        assert result["access_token"] == "mock-access-token"
        assert result["user"]["member_id"] == "mem-ivan"

    await client.close()


@pytest.mark.asyncio
async def test_bot_client_create_transaction():
    """Mock test for create_transaction."""
    client = BotAPIClient(base_url="http://testbackend")

    mock_resp = AsyncMock()
    mock_resp.status = 201
    mock_resp.json = AsyncMock(return_value={
        "id": "tx-new-001",
        "status": "confirmed",
        "amount_kopecks": 54000,
        "description": "Кофе",
    })

    mock_session = MagicMock()
    mock_session.post.return_value.__aenter__.return_value = mock_resp

    with patch.object(client, "get_session", AsyncMock(return_value=mock_session)):
        res = await client.create_transaction(
            token="token123",
            amount_kopecks=54000,
            description="Кофе",
            paid_by_member_id="mem-01",
        )
        assert res["id"] == "tx-new-001"
        assert res["amount_kopecks"] == 54000

    await client.close()


# ---------------------------------------------------------------------------
# /start must not trap an authenticated user in the invite-code dialog
# ---------------------------------------------------------------------------
def _fake_message(text="/start"):
    message = MagicMock()
    message.text = text
    message.from_user = MagicMock(id=235794506, first_name="Андрей", last_name=None, username="andy")
    message.answer = AsyncMock()
    return message


def _fsm_context():
    from aiogram.fsm.context import FSMContext
    from aiogram.fsm.storage.base import StorageKey
    from aiogram.fsm.storage.memory import MemoryStorage

    return FSMContext(storage=MemoryStorage(), key=StorageKey(bot_id=1, chat_id=1, user_id=1))


@pytest.mark.asyncio
async def test_start_greets_authenticated_user_without_invite_code():
    from backend import bot as bot_module

    state = _fsm_context()
    message = _fake_message("/start")
    auth_reply = {"access_token": "jwt", "user": {"member_id": "mem-1", "family_id": "fam-1"}}

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=auth_reply)):
        await bot_module.cmd_start(message, state)

    sent = message.answer.call_args.args[0]
    assert "код приглашения" not in sent.lower()
    assert await state.get_state() is None


@pytest.mark.asyncio
async def test_start_without_membership_does_not_wait_for_invite_code():
    from backend import bot as bot_module

    state = _fsm_context()
    message = _fake_message("/start")

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(side_effect=RuntimeError("down"))):
        await bot_module.cmd_start(message, state)

    assert "код приглашения" not in message.answer.call_args.args[0].lower()
    assert await state.get_state() is None


# ---------------------------------------------------------------------------
# /transfer and /debts
# ---------------------------------------------------------------------------
def test_parse_amount_kopecks():
    from backend.bot import parse_amount_kopecks

    assert parse_amount_kopecks("5000") == 500000
    assert parse_amount_kopecks("1500,50") == 150050
    assert parse_amount_kopecks("1500.5") == 150050
    for bad in ("0", "-5", "12.345", "abc", "", "1 000"):
        assert parse_amount_kopecks(bad) is None, bad


def test_parse_transfer_args():
    from backend.bot import parse_transfer_args

    assert parse_transfer_args("Борис 5000") == ("Борис", 500000, "")
    assert parse_transfer_args("Борис 1500,50 за такси и кофе") == ("Борис", 150050, "за такси и кофе")
    assert parse_transfer_args("Борис") is None
    assert parse_transfer_args("Борис много") is None
    assert parse_transfer_args("") is None


def test_find_member_by_name_ignores_sender_and_case():
    from backend.bot import find_member_by_name

    members = [
        {"id": "1", "name": "Анна"},
        {"id": "2", "name": "Борис"},
        {"id": "3", "name": "Борислав"},
    ]
    assert [m["id"] for m in find_member_by_name(members, "бор")] == ["2", "3"]
    assert [m["id"] for m in find_member_by_name(members, "Борис")] == ["2", "3"]
    assert find_member_by_name(members, "Анна", exclude_id="1") == []


def _command(args):
    command = MagicMock()
    command.args = args
    return command


@pytest.mark.asyncio
async def test_transfer_command_records_a_transfer_to_the_named_member():
    from backend import bot as bot_module

    state = _fsm_context()
    message = _fake_message("/transfer Борис 5000 за обед")
    members = [{"id": "m-anna", "name": "Анна"}, {"id": "m-boris", "name": "Борис"}]
    auth_reply = {"access_token": "jwt", "user": {"member_id": "m-anna", "family_id": "f"}}
    create = AsyncMock(return_value={"id": "tx-1"})

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=auth_reply)), \
         patch.object(bot_module.api_client, "get_members", AsyncMock(return_value=members)), \
         patch.object(bot_module.api_client, "create_transaction", create):
        await bot_module.cmd_transfer(message, state, _command("Борис 5000 за обед"))

    kwargs = create.call_args.kwargs
    assert kwargs["tx_type"] == "transfer"
    assert kwargs["to_member_id"] == "m-boris"
    assert kwargs["amount_kopecks"] == 500000
    assert kwargs["paid_by_member_id"] == "m-anna"
    assert kwargs["description"] == "за обед"


@pytest.mark.asyncio
async def test_transfer_command_refuses_unknown_or_malformed_input():
    from backend import bot as bot_module

    state = _fsm_context()
    members = [{"id": "m-anna", "name": "Анна"}, {"id": "m-boris", "name": "Борис"}]
    auth_reply = {"access_token": "jwt", "user": {"member_id": "m-anna", "family_id": "f"}}
    create = AsyncMock()

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=auth_reply)), \
         patch.object(bot_module.api_client, "get_members", AsyncMock(return_value=members)), \
         patch.object(bot_module.api_client, "create_transaction", create):
        unknown = _fake_message("/transfer Вася 100")
        await bot_module.cmd_transfer(unknown, state, _command("Вася 100"))
        malformed = _fake_message("/transfer Борис")
        await bot_module.cmd_transfer(malformed, state, _command("Борис"))
        to_self = _fake_message("/transfer Анна 100")
        await bot_module.cmd_transfer(to_self, state, _command("Анна 100"))

    create.assert_not_called()
    assert "не найден" in unknown.answer.call_args.args[0]
    assert "/transfer" in malformed.answer.call_args.args[0]


@pytest.mark.asyncio
async def test_debts_command_lists_who_owes_whom():
    from backend import bot as bot_module

    state = _fsm_context()
    message = _fake_message("/debts")
    auth_reply = {"access_token": "jwt", "user": {"member_id": "m-anna", "family_id": "f"}}
    data = {"count": 1, "settlements": [
        {"debtor_name": "Борис", "creditor_name": "Анна", "amount_kopecks": 300000},
    ]}

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=auth_reply)), \
         patch.object(bot_module.api_client, "get_settlements", AsyncMock(return_value=data)):
        await bot_module.cmd_debts(message, state)

    text = message.answer.call_args.args[0]
    assert "Борис" in text and "Анна" in text and "3 000" in text


# ---------------------------------------------------------------------------
# Savings goals: /goal, /save, /withdraw, /goals
# ---------------------------------------------------------------------------
def test_parse_deadline_accepts_iso_and_dotted_dates_only():
    from backend.bot import parse_deadline

    assert parse_deadline("2027-06-30") == "2027-06-30"
    assert parse_deadline("30.06.2027") == "2027-06-30"
    assert parse_deadline("31.02.2027") is None
    assert parse_deadline("завтра") is None


def test_parse_goal_args():
    from backend.bot import parse_goal_args

    assert parse_goal_args("150000 Отпуск") == (15000000, "Отпуск", None)
    assert parse_goal_args("150000 Отпуск на море до 30.06.2027") == (15000000, "Отпуск на море", "2027-06-30")
    assert parse_goal_args("1500,50 Подушка ДО 2027-01-15") == (150050, "Подушка", "2027-01-15")
    assert parse_goal_args("150000") is None            # no name
    assert parse_goal_args("Отпуск 150000") is None     # amount must come first
    assert parse_goal_args("150000 Отпуск до 99.99.2027") is None  # impossible date is refused, not ignored


def test_parse_savings_args_and_goal_lookup():
    from backend.bot import find_goals_by_name, parse_savings_args

    assert parse_savings_args("5000 Отпуск") == (500000, "Отпуск")
    assert parse_savings_args("5000") == (500000, "")
    assert parse_savings_args("Отпуск 5000") is None
    assert parse_savings_args("") is None

    goals = [{"id": "1", "name": "Отпуск"}, {"id": "2", "name": "Отпуск на море"}, {"id": "3", "name": "Подушка"}]
    assert [g["id"] for g in find_goals_by_name(goals, "отпуск")] == ["1"]        # exact beats prefix
    assert [g["id"] for g in find_goals_by_name(goals, "отпуск н")] == ["2"]
    assert [g["id"] for g in find_goals_by_name(goals, "душ")] == ["3"]            # substring
    assert find_goals_by_name(goals, "") == []                                     # ambiguous without a name
    assert [g["id"] for g in find_goals_by_name(goals[2:], "")] == ["3"]           # single goal: name optional
    assert find_goals_by_name(goals, "машина") == []


def test_format_goal_line_variants():
    from backend.bot import format_goal_line

    base = {"name": "Отпуск", "saved_kopecks": 300000, "target_amount_kopecks": 15000000,
            "progress_percent": 2, "is_reached": False, "target_date": None}
    assert format_goal_line(base) == "Отпуск: 3 000.00 ₽ из 150 000.00 ₽ (2%)"
    with_date = {**base, "target_date": "2027-06-30", "is_overdue": False, "required_per_month_kopecks": 2100000}
    assert "до 2027-06-30" in format_goal_line(with_date) and "21 000.00 ₽/мес" in format_goal_line(with_date)
    assert "прошёл" in format_goal_line({**base, "target_date": "2020-01-01", "is_overdue": True})
    assert "достигнута" in format_goal_line({**base, "is_reached": True})


_AUTH = {"access_token": "jwt", "user": {"member_id": "m-anna", "family_id": "f"}}
_GOAL = {"id": "g-1", "name": "Отпуск", "saved_kopecks": 0, "target_amount_kopecks": 15000000,
         "progress_percent": 0, "is_reached": False, "target_date": None}


@pytest.mark.asyncio
async def test_goal_command_creates_a_goal():
    from backend import bot as bot_module

    message = _fake_message("/goal")
    create = AsyncMock(return_value={**_GOAL, "target_date": "2027-06-30"})
    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
         patch.object(bot_module.api_client, "create_goal", create):
        await bot_module.cmd_goal(message, _fsm_context(), _command("150000 Отпуск до 30.06.2027"))

    assert create.call_args.args[1:] == ("Отпуск", 15000000, "2027-06-30")
    assert "Копилка создана" in message.answer.call_args.args[0]


@pytest.mark.asyncio
async def test_save_and_withdraw_commands_use_the_goal():
    from backend import bot as bot_module

    for command_fn, args, tx_type in (
        (bot_module.cmd_save, "5000 отпуск", "saving"),
        (bot_module.cmd_withdraw, "2000 отпуск", "withdrawal"),
    ):
        message = _fake_message("/x")
        create = AsyncMock(return_value={"id": "tx-1"})
        with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
             patch.object(bot_module.api_client, "get_goals", AsyncMock(return_value=[_GOAL])), \
             patch.object(bot_module.api_client, "create_transaction", create):
            await command_fn(message, _fsm_context(), _command(args))

        kwargs = create.call_args.kwargs
        assert kwargs["tx_type"] == tx_type and kwargs["goal_id"] == "g-1"
        assert kwargs["amount_kopecks"] in (500000, 200000)
        assert "Отпуск" in message.answer.call_args.args[0]


@pytest.mark.asyncio
async def test_withdraw_shows_the_api_reason_when_refused():
    from backend import bot as bot_module

    message = _fake_message("/withdraw")
    refused = AsyncMock(side_effect=RuntimeError("В копилке «Отпуск» только 0.00: снять больше нельзя"))
    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
         patch.object(bot_module.api_client, "get_goals", AsyncMock(return_value=[_GOAL])), \
         patch.object(bot_module.api_client, "create_transaction", refused):
        await bot_module.cmd_withdraw(message, _fsm_context(), _command("9000"))

    assert "снять больше нельзя" in message.answer.call_args.args[0]


@pytest.mark.asyncio
async def test_goals_command_lists_goals_or_shows_help():
    from backend import bot as bot_module

    message = _fake_message("/goals")
    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
         patch.object(bot_module.api_client, "get_goals", AsyncMock(return_value=[_GOAL])):
        await bot_module.cmd_goals(message, _fsm_context())
    assert "Отпуск" in message.answer.call_args.args[0]

    empty = _fake_message("/goals")
    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
         patch.object(bot_module.api_client, "get_goals", AsyncMock(return_value=[])):
        await bot_module.cmd_goals(empty, _fsm_context())
    assert "/goal" in empty.answer.call_args.args[0]


@pytest.mark.asyncio
async def test_cancel_button_reports_a_refused_cancellation_instead_of_lying():
    from backend import bot as bot_module

    callback = MagicMock()
    callback.data = "tx_reject:tx-1"
    callback.from_user = MagicMock(id=235794506, first_name="Андрей", last_name=None, username="andy")
    callback.message = MagicMock()
    callback.message.edit_reply_markup = AsyncMock()
    callback.message.reply = AsyncMock()
    callback.answer = AsyncMock()
    refused = AsyncMock(side_effect=RuntimeError("Нельзя отменить пополнение: эти деньги уже сняты с копилки"))

    with patch.object(bot_module.api_client, "auth_telegram", AsyncMock(return_value=_AUTH)), \
         patch.object(bot_module.api_client, "reject_transaction", refused):
        await bot_module.callback_reject_transaction(callback, _fsm_context())

    callback.message.reply.assert_not_called()          # no "Запись отменена"
    callback.message.edit_reply_markup.assert_not_called()  # the entry (and button) stay
    assert "уже сняты" in callback.answer.call_args.args[0]
    assert callback.answer.call_args.kwargs.get("show_alert") is True
