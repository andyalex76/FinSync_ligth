"""
FastAPI Backend for Family Budget MVP.
Connected to PostgreSQL via SQLAlchemy 2.0 Async (asyncpg).
Features:
- Authentication via Telegram (verified Mini App initData / trusted bot) with an ID allowlist
- Real PostgreSQL CRUD operations with strict minor-units (kopecks) validation
- Budgets (Plan / Fact) & End-of-month Forecast calculation
"""
import calendar
import hmac
import logging
import os
import secrets
import time
import uuid
import sys
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure both package directory and parent directory are on sys.path
_backend_dir = Path(__file__).resolve().parent
_root_dir = _backend_dir.parent
for _p in [str(_backend_dir), str(_root_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address
except ImportError:
    # Graceful fallback when running in lightweight runtime without slowapi
    class Limiter:
        def __init__(self, *args, **kwargs):
            pass

        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator

    class RateLimitExceeded(Exception):
        pass

    def _rate_limit_exceeded_handler(request, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded: 60/minute"})

    class SlowAPIMiddleware:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            await self.app(scope, receive, send)

    def get_remote_address(request):
        return "127.0.0.1"

try:
    from backend.database import engine, get_session, to_uuid
    from backend.models import (
        Budget,
        Category,
        Family,
        FamilyMember,
        Tag,
        Transaction,
        TransactionTag,
        User,
    )
except ImportError:
    from database import engine, get_session, to_uuid
    from models import (
        Budget,
        Category,
        Family,
        FamilyMember,
        Tag,
        Transaction,
        TransactionTag,
        User,
    )

try:
    from backend.settlements import compute_balances, compute_settlements
except ImportError:
    from settlements import compute_balances, compute_settlements

try:
    from backend.auth import (
        consume_login_code,
        create_access_token,
        create_login_code,
        decode_access_token,
        verify_token,
    )
    from backend.security import (
        InitDataError,
        admin_telegram_ids,
        is_telegram_id_allowed,
        service_key_ok,
        validate_init_data,
        validate_runtime_config,
    )
except ImportError:
    from auth import (
        consume_login_code,
        create_access_token,
        create_login_code,
        decode_access_token,
        verify_token,
    )
    from security import (
        InitDataError,
        admin_telegram_ids,
        is_telegram_id_allowed,
        service_key_ok,
        validate_init_data,
        validate_runtime_config,
    )

# ---------------------------------------------------------------------
# Structured Logging (structlog with fallback to standard logging)
# ---------------------------------------------------------------------
try:
    import structlog

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            (
                structlog.processors.JSONRenderer()
                if os.getenv("LOG_FORMAT", "json").lower() == "json"
                else structlog.dev.ConsoleRenderer()
            ),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    _raw_logger = structlog.get_logger("family_budget.api")
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    )
    _raw_logger = logging.getLogger("family_budget.api")


class StructuredLogger:
    """Wrapper ensuring structured logging methods (.info, .warning, .error, .debug) accept kwargs seamlessly."""

    def __init__(self, logger_instance):
        self._logger = logger_instance
        self._is_structlog = hasattr(logger_instance, "bind")

    def info(self, msg: str, *args, **kwargs):
        if self._is_structlog:
            self._logger.info(msg, *args, **kwargs)
        else:
            extra = f" | {kwargs}" if kwargs else ""
            self._logger.info(f"{msg}{extra}", *args)

    def warning(self, msg: str, *args, **kwargs):
        if self._is_structlog:
            self._logger.warning(msg, *args, **kwargs)
        else:
            extra = f" | {kwargs}" if kwargs else ""
            self._logger.warning(f"{msg}{extra}", *args)

    def error(self, msg: str, *args, **kwargs):
        if self._is_structlog:
            self._logger.error(msg, *args, **kwargs)
        else:
            extra = f" | {kwargs}" if kwargs else ""
            self._logger.error(f"{msg}{extra}", *args)

    def debug(self, msg: str, *args, **kwargs):
        if self._is_structlog:
            self._logger.debug(msg, *args, **kwargs)
        else:
            extra = f" | {kwargs}" if kwargs else ""
            self._logger.debug(f"{msg}{extra}", *args)


logger = StructuredLogger(_raw_logger)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate secrets on startup. The schema is created by Alembic (entrypoint.sh), never by the app."""
    # Refuse to start with missing/placeholder secrets or an empty Telegram allowlist.
    validate_runtime_config()
    yield


limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="Family Budget API (Семейный Бюджет)",
    version="1.0.0",
    description="Local self-hosted family budget tracking with PostgreSQL SQLAlchemy Async and aiogram bot integration",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Structured request logging middleware
@app.middleware("http")
async def structured_request_logging_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        status_code = response.status_code if response else 500
        # Exclude internal continuous health probes from cluttering logs
        if request.url.path not in ("/healthz", "/api/healthz"):
            logger.info(
                "http_request",
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=latency_ms,
                client=request.client.host if request.client else None,
            )

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "https://finance.yourdomain.ru,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------

class TelegramAuthRequest(BaseModel):
    """
    Two ways to authenticate (nothing else is accepted):
      1. Mini App: `init_data` = raw Telegram.WebApp.initData (signature is verified with the bot token).
      2. Telegram bot container: `telegram_id` + header `X-Internal-Key` (trusted service call).
    """
    init_data: Optional[str] = None
    telegram_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class LoginLinkRequest(BaseModel):
    telegram_id: int


class LoginExchangeRequest(BaseModel):
    code: str


class FamilyJoinRequest(BaseModel):
    invite_code: str
    display_name: str
    avatar_emoji: str = "👤"


class ResetRequest(BaseModel):
    mode: Optional[str] = "clean"


class MemberSetupItem(BaseModel):
    name: str
    role: str = "member"
    avatar_emoji: str = "👤"
    telegram_user_id: Optional[str] = None


class FamilySetupPayload(BaseModel):
    family_id: str
    name: str
    currency: str = "RUB"
    invite_code: str
    members: List[MemberSetupItem] = []


class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(expense|income|transfer|saving)$")
    amount_kopecks: int = Field(..., gt=0, description="Amount in minor units (kopecks/cents)")
    currency: str = Field(default="RUB", pattern="^(RUB|USD|EUR)$")
    category_id: Optional[str] = None
    paid_by_member_id: Optional[str] = None
    to_member_id: Optional[str] = Field(default=None, description="Recipient of a transfer (type='transfer')")
    description: str
    transaction_date: str = Field(..., description="YYYY-MM-DD")
    tags: List[str] = []

    @model_validator(mode="after")
    def _transfer_needs_recipient(self):
        if self.type == "transfer" and not self.to_member_id:
            raise ValueError("Для перевода нужен получатель (to_member_id)")
        if self.type != "transfer" and self.to_member_id:
            raise ValueError("to_member_id допустим только для перевода")
        return self


class BatchSyncItem(BaseModel):
    id: str
    action: str = Field(default="create", pattern="^(create|update|delete)$")
    type: str = "expense"
    amount_kopecks: int = Field(..., gt=0)
    currency: str = "RUB"
    category_id: Optional[str] = None
    paid_by_member_id: str
    to_member_id: Optional[str] = None
    description: str
    transaction_date: str
    tags: List[str] = []
    created_at: Optional[str] = None


class BatchSyncRequest(BaseModel):
    items: List[BatchSyncItem]
    client_time: Optional[str] = None


class BudgetSetRequest(BaseModel):
    category_id: str
    month_period: str = Field(..., pattern="^20[0-9]{2}-(0[1-9]|1[0-2])$")
    limit_kopecks: int = Field(..., ge=0)
    notify_threshold_percent: int = Field(default=80, ge=1, le=100)


# ---------------------------------------------------------------------
# Helper: Ensure Default Seed Data in PostgreSQL
# ---------------------------------------------------------------------
async def get_or_create_default_family(
    session: AsyncSession,
    creator: Optional[User] = None,
) -> Family:
    """
    Return the family workspace. There is exactly one family per installation.

    On a brand-new database the first authenticated (allowlisted) user creates it: the family gets
    standard categories, this month's default budgets and starter tags. No demo members, users or
    transactions are created. Without `creator` and without a family the request is refused:
    nobody has logged in yet (open the bot with /start first).
    """
    family = (await session.execute(select(Family).limit(1))).scalar_one_or_none()
    if family is not None:
        return family

    if creator is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Семья ещё не создана: откройте бота и отправьте /start",
        )

    family = Family(
        id=to_uuid("fam-01"),
        name="Семья",
        base_currency="RUB",
        invite_code=f"FIN-{secrets.token_hex(4).upper()}",
        created_by_user_id=creator.id,
    )
    session.add(family)
    await session.flush()

    # Seed Standard Categories
    default_categories_data = [
        ("cat-groceries", "Продукты", "ShoppingCart", "emerald", False, 1, 4500000),
        ("cat-housing", "Жилье и ЖКХ", "Home", "blue", False, 2, 1800000),
        ("cat-auto", "Авто и Транспорт", "Car", "amber", False, 3, 2000000),
        ("cat-cafes", "Кафе и Доставка", "Utensils", "orange", False, 4, 1500000),
        ("cat-health", "Здоровье и Аптека", "HeartPulse", "rose", False, 5, 1000000),
        ("cat-leisure", "Развлечения и Хобби", "Sparkles", "purple", False, 6, 800000),
        ("cat-clothes", "Одежда и Обувь", "Shirt", "indigo", False, 7, 1200000),
        ("cat-salary", "Зарплата и Доход", "Banknote", "emerald", True, 8, 0),
    ]

    current_month = date.today().strftime("%Y-%m")
    pending_budgets = []
    for cat_slug, name, icon, color, is_inc, sort_order, limit_kopecks in default_categories_data:
        cat_id = to_uuid(cat_slug)
        category = Category(
            id=cat_id,
            family_id=family.id,
            name=name,
            icon=icon,
            color=color,
            is_income=is_inc,
            sort_order=sort_order,
        )
        session.add(category)
        if limit_kopecks > 0:
            budget = Budget(
                family_id=family.id,
                category_id=cat_id,
                month_period=current_month,
                limit_kopecks=limit_kopecks,
                notify_threshold_percent=80,
            )
            pending_budgets.append(budget)

    # Categories must be INSERTed before budgets: there is no ORM relationship between them,
    # so SQLAlchemy would not order the two inserts and the FK check could fail.
    await session.flush()
    session.add_all(pending_budgets)

    # Seed Default Tags
    for tag_name in ["супермаркет", "кафе", "аптека", "жкх", "бензин"]:
        session.add(Tag(family_id=family.id, name=tag_name))

    await session.flush()
    return family


# ---------------------------------------------------------------------
# SYSTEM & HEALTH CHECK ENDPOINTS (/healthz)
# ---------------------------------------------------------------------
async def check_database_health() -> Dict[str, Any]:
    """Check database connectivity with a lightweight SELECT 1 query via SQLAlchemy Async."""
    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "ok", "latency_ms": latency_ms}
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "error", "error": str(exc), "latency_ms": latency_ms}


@app.get(
    "/healthz",
    tags=["System"],
    summary="Health check probe for database connectivity",
)
@app.get(
    "/api/healthz",
    tags=["System"],
    summary="Health check probe for database connectivity",
)
async def healthz():
    """
    Health check probe verifying the PostgreSQL connection.
    Returns HTTP 200 when operational, HTTP 503 when the database is unavailable.
    """
    db_result = await check_database_health()

    is_healthy = db_result["status"] == "ok"
    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": "ok" if is_healthy else "unhealthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "checks": {
            "database": db_result,
        },
    }

    if not is_healthy:
        logger.warning("healthz_probe_degraded", checks=payload["checks"])
        return JSONResponse(status_code=http_status, content=payload)

    return payload


# ---------------------------------------------------------------------
# 1. AUTHENTICATION & TELEGRAM BINDING
# ---------------------------------------------------------------------
def _resolve_telegram_identity(
    payload: TelegramAuthRequest,
    internal_key: Optional[str],
) -> Dict[str, Any]:
    """
    Establish WHO is calling, then check the allowlist. Never trusts a bare telegram_id
    from an unauthenticated client.
    """
    if payload.init_data:
        try:
            tg_user = validate_init_data(payload.init_data, os.getenv("TELEGRAM_BOT_TOKEN", ""))
        except InitDataError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительные данные Telegram")
        identity = {
            "telegram_id": tg_user["id"],
            "first_name": tg_user.get("first_name") or "Участник",
            "last_name": tg_user.get("last_name"),
            "username": tg_user.get("username"),
            "avatar_url": tg_user.get("photo_url"),
        }
    elif payload.telegram_id is not None and service_key_ok(internal_key):
        identity = {
            "telegram_id": payload.telegram_id,
            "first_name": payload.first_name or "Участник",
            "last_name": payload.last_name,
            "username": payload.username,
            "avatar_url": payload.avatar_url,
        }
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация через Telegram")

    if not is_telegram_id_allowed(identity["telegram_id"]):
        logger.warning("auth_denied_not_in_allowlist", telegram_id=identity["telegram_id"])
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return identity


@app.post("/api/auth/login-link", tags=["Auth"])
@limiter.limit("20/minute")
async def create_dashboard_login_link(
    request: Request,
    payload: LoginLinkRequest,
    x_internal_key: Optional[str] = Header(None, alias="X-Internal-Key"),
):
    """Bot-only: issue a one-time code that the browser dashboard exchanges for a session."""
    if not service_key_ok(x_internal_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется X-Internal-Key")
    if not is_telegram_id_allowed(payload.telegram_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return {"code": create_login_code(payload.telegram_id), "expires_in": 300}


@app.post("/api/auth/exchange", tags=["Auth"])
@limiter.limit("20/minute")
async def exchange_login_code(
    request: Request,
    payload: LoginExchangeRequest,
    session: AsyncSession = Depends(get_session),
):
    """Exchange a one-time login code (from the bot link) for a normal session token."""
    try:
        telegram_id = consume_login_code(payload.code)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ссылка недействительна или устарела")
    if not is_telegram_id_allowed(telegram_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    user = (await session.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сначала откройте бота командой /start")
    family = await get_or_create_default_family(session, creator=user)
    membership = (await session.execute(
        select(FamilyMember).where(FamilyMember.family_id == family.id, FamilyMember.user_id == user.id)
    )).scalar_one_or_none()
    token = create_access_token(
        telegram_id=user.telegram_id,
        user_id=str(user.id),
        extra_claims={"family_id": str(family.id), "member_id": str(membership.id) if membership else None},
    )
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/telegram", tags=["Auth"])
@limiter.limit("20/minute")
async def auth_telegram(
    request: Request,
    payload: TelegramAuthRequest,
    x_internal_key: Optional[str] = Header(None, alias="X-Internal-Key"),
    session: AsyncSession = Depends(get_session),
):
    """
    Authenticate or register user from Telegram Mini App (verified initData) or the bot service.
    Only IDs from the allowlist (TELEGRAM_ADMIN_CHAT_IDS + ALLOWED_TELEGRAM_IDS) get a token.
    """
    identity = _resolve_telegram_identity(payload, x_internal_key)
    payload = TelegramAuthRequest(**identity)
    stmt = select(User).where(User.telegram_id == payload.telegram_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            telegram_id=payload.telegram_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            username=payload.username,
            avatar_url=payload.avatar_url,
        )
        session.add(user)
        await session.flush()
    else:
        user.first_name = payload.first_name
        if payload.last_name:
            user.last_name = payload.last_name
        if payload.username:
            user.username = payload.username
        if payload.avatar_url:
            user.avatar_url = payload.avatar_url
        await session.flush()

    family = await get_or_create_default_family(session, creator=user)

    # Check if membership already exists
    mem_stmt = select(FamilyMember).where(
        FamilyMember.family_id == family.id,
        FamilyMember.user_id == user.id,
    )
    membership = (await session.execute(mem_stmt)).scalar_one_or_none()

    if membership is None:
        count_stmt = select(func.count(FamilyMember.id)).where(
            FamilyMember.family_id == family.id,
            FamilyMember.is_active.is_(True),
        )
        current_count = (await session.execute(count_stmt)).scalar_one()
        if current_count < 5:
            membership = FamilyMember(
                family_id=family.id,
                user_id=user.id,
                role="owner" if current_count == 0 else "member",
                display_name=payload.first_name or payload.username or "Участник",
                avatar_emoji="👤",
            )
            session.add(membership)
            await session.flush()

    access_token = create_access_token(
        telegram_id=user.telegram_id,
        user_id=str(user.id),
        extra_claims={
            "family_id": str(family.id),
            "member_id": str(membership.id) if membership else None,
        },
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "telegram_id": user.telegram_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "family_id": str(family.id),
            "member_id": str(membership.id) if membership else None,
        },
    }


# ---------------------------------------------------------------------
# 2. FAMILY & MEMBERS (iHateMoney pattern & PostgreSQL)
# ---------------------------------------------------------------------
@app.get("/api/family/current", tags=["Family"])
@limiter.limit("60/minute")
async def get_current_family(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Get active family workspace details and members count from PostgreSQL.
    """
    family = await get_or_create_default_family(session)

    count_stmt = select(func.count(FamilyMember.id)).where(
        FamilyMember.family_id == family.id,
        FamilyMember.is_active.is_(True),
    )
    members_count = (await session.execute(count_stmt)).scalar_one()

    return {
        "id": str(family.id),
        "name": family.name,
        "base_currency": family.base_currency,
        "invite_code": family.invite_code,
        "members_count": members_count,
        "max_members": 5,
    }


async def _transfer_rows(session: AsyncSession, family: Family) -> List[tuple]:
    """All live transfers of the family as (giver_id, receiver_id, amount_kopecks)."""
    stmt = select(
        Transaction.paid_by_member_id, Transaction.to_member_id, Transaction.amount_kopecks
    ).where(
        Transaction.family_id == family.id,
        Transaction.type == "transfer",
        Transaction.status != "rejected",
        Transaction.to_member_id.is_not(None),
    )
    return [(str(a), str(b), int(amount)) for a, b, amount in (await session.execute(stmt)).all()]


@app.get("/api/family/members", tags=["Family"])
@limiter.limit("60/minute")
async def get_family_members(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Active participants with their balance from transfers:
    positive balance_kopecks = others owe this member, negative = this member owes others.
    """
    family = await get_or_create_default_family(session)

    stmt = select(FamilyMember).where(
        FamilyMember.family_id == family.id,
        FamilyMember.is_active.is_(True),
    ).order_by(FamilyMember.created_at)
    members = (await session.execute(stmt)).scalars().all()
    balances = compute_balances(await _transfer_rows(session, family))

    return [
        {
            "id": str(member.id),
            "name": member.display_name,
            "avatar": member.avatar_emoji,
            "role": member.role,
            "balance_kopecks": balances.get(str(member.id), 0),
            "is_active": member.is_active,
        }
        for member in members
    ]


@app.get("/api/family/settlements", tags=["Family"])
@limiter.limit("60/minute")
async def get_family_settlements(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """Open debts between members, derived only from transfers (who owes whom how much)."""
    family = await get_or_create_default_family(session)
    members = (await session.execute(
        select(FamilyMember).where(FamilyMember.family_id == family.id)
    )).scalars().all()
    names = {str(m.id): m.display_name for m in members}

    items = []
    for debt in compute_settlements(await _transfer_rows(session, family)):
        items.append({
            **debt,
            "debtor_name": names.get(str(debt["debtor_member_id"]), "?"),
            "creditor_name": names.get(str(debt["creditor_member_id"]), "?"),
        })
    return {"count": len(items), "settlements": items}


@app.post("/api/family/setup", tags=["Family"])
@limiter.limit("60/minute")
async def setup_family_configuration(
    request: Request,
    payload: FamilySetupPayload,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Initialize or update a family workspace with custom family_id, name, currency, and members.
    Persists configuration to PostgreSQL.
    """
    fam_uuid = to_uuid(payload.family_id)
    fam_stmt = select(Family).where(Family.id == fam_uuid)
    family = (await session.execute(fam_stmt)).scalar_one_or_none()

    if family is None:
        user_stmt = select(User).limit(1)
        owner_user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not owner_user:
            owner_user = User(first_name="Создатель", language_code="ru")
            session.add(owner_user)
            await session.flush()

        family = Family(
            id=fam_uuid,
            name=payload.name,
            base_currency=payload.currency,
            invite_code=payload.invite_code,
            created_by_user_id=owner_user.id,
        )
        session.add(family)
        await session.flush()
    else:
        family.name = payload.name
        family.base_currency = payload.currency
        family.invite_code = payload.invite_code

    # Add or update members
    for m in payload.members:
        mem_stmt = select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.display_name == m.name,
        )
        existing_mem = (await session.execute(mem_stmt)).scalar_one_or_none()
        if not existing_mem:
            new_u = User(first_name=m.name, language_code="ru")
            session.add(new_u)
            await session.flush()

            new_mem = FamilyMember(
                family_id=family.id,
                user_id=new_u.id,
                role=m.role,
                display_name=m.name,
                avatar_emoji=m.avatar_emoji,
            )
            session.add(new_mem)

    await session.flush()

    return {
        "status": "success",
        "family_id": str(family.id),
        "name": family.name,
        "currency": family.base_currency,
        "invite_code": family.invite_code,
        "members_count": len(payload.members),
        "message": f"Семья '{family.name}' успешно сконфигурирована в PostgreSQL.",
    }


@app.post("/api/family/join", tags=["Family"])
@limiter.limit("60/minute")
async def join_family_by_code(
    request: Request,
    payload: FamilyJoinRequest,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Join an existing family via invite code (from Telegram or Web).
    Checks constraints (max 5 members) and creates PostgreSQL records.
    """
    stmt = select(Family).where(func.upper(Family.invite_code) == payload.invite_code.strip().upper())
    family = (await session.execute(stmt)).scalar_one_or_none()

    if not family:
        raise HTTPException(status_code=404, detail="Неверный код приглашения семьи")

    count_stmt = select(func.count(FamilyMember.id)).where(
        FamilyMember.family_id == family.id,
        FamilyMember.is_active.is_(True),
    )
    current_count = (await session.execute(count_stmt)).scalar_one()

    # Check if user already exists from token_data
    user_id_claim = token_data.get("user_id")
    user = None
    if user_id_claim:
        user = await session.get(User, to_uuid(user_id_claim))
    if not user and token_data.get("telegram_id"):
        stmt_u = select(User).where(User.telegram_id == token_data.get("telegram_id"))
        user = (await session.execute(stmt_u)).scalar_one_or_none()

    existing_mem = None
    if user:
        mem_stmt = select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == user.id,
        )
        existing_mem = (await session.execute(mem_stmt)).scalar_one_or_none()

    if not existing_mem and current_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Превышен лимит участников семьи (максимум 5 участников)",
        )

    if not user:
        user = User(first_name=payload.display_name, language_code="ru")
        session.add(user)
        await session.flush()

    if existing_mem:
        new_member = existing_mem
        if payload.display_name:
            new_member.display_name = payload.display_name
        await session.flush()
    else:
        new_member = FamilyMember(
            family_id=family.id,
            user_id=user.id,
            role="member",
            display_name=payload.display_name,
            avatar_emoji=payload.avatar_emoji,
        )
        session.add(new_member)
        await session.flush()

    new_token = create_access_token(
        telegram_id=token_data.get("telegram_id") or token_data.get("sub"),
        user_id=str(user.id),
        extra_claims={
            "family_id": str(family.id),
            "member_id": str(new_member.id),
        },
    )

    return {
        "status": "success",
        "family_id": str(family.id),
        "family_name": family.name,
        "member_id": str(new_member.id),
        "access_token": new_token,
        "message": f"Успешно присоединен: {payload.display_name}",
    }


# ---------------------------------------------------------------------
# 3. CATEGORIES & BUDGETS (ActualBudget pattern in PostgreSQL)
# ---------------------------------------------------------------------
@app.get("/api/categories", tags=["Categories"])
@limiter.limit("60/minute")
async def get_categories(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Get categories tree with monthly budget limits from PostgreSQL.
    """
    family = await get_or_create_default_family(session)
    current_month = date.today().strftime("%Y-%m")

    cat_stmt = (
        select(Category)
        .where(Category.family_id == family.id)
        .order_by(Category.sort_order, Category.name)
    )
    categories = (await session.execute(cat_stmt)).scalars().all()

    budget_stmt = select(Budget).where(
        Budget.family_id == family.id,
        Budget.month_period == current_month,
    )
    budgets = (await session.execute(budget_stmt)).scalars().all()
    budget_map = {b.category_id: b.limit_kopecks for b in budgets}

    return [
        {
            "id": str(c.id),
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "is_income": c.is_income,
            "sort_order": c.sort_order,
            "monthly_limit_kopecks": budget_map.get(c.id, 0),
        }
        for c in categories
    ]


@app.get("/api/budgets/{month}", tags=["Budgets"])
@limiter.limit("60/minute")
async def get_monthly_budgets(
    request: Request,
    month: str,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Get Plan / Fact budget progress for the specified month (e.g. 2026-09) computed from PostgreSQL.
    """
    family = await get_or_create_default_family(session)

    try:
        start_date = date.fromisoformat(f"{month}-01")
        days_in_month = calendar.monthrange(start_date.year, start_date.month)[1]
        end_date = date(start_date.year, start_date.month, days_in_month)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат месяца, используйте YYYY-MM")

    # Categories
    cat_stmt = select(Category).where(Category.family_id == family.id, Category.is_income.is_(False))
    categories = (await session.execute(cat_stmt)).scalars().all()

    # Budgets
    budget_stmt = select(Budget).where(Budget.family_id == family.id, Budget.month_period == month)
    budgets = (await session.execute(budget_stmt)).scalars().all()
    budget_map = {b.category_id: b.limit_kopecks for b in budgets}

    # Actual spent from transactions
    spent_stmt = (
        select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount_kopecks), 0))
        .where(
            Transaction.family_id == family.id,
            Transaction.type == "expense",
            Transaction.status != "rejected",
            Transaction.transaction_date.between(start_date, end_date),
        )
        .group_by(Transaction.category_id)
    )
    spent_map = dict((await session.execute(spent_stmt)).all())

    items = []
    total_limit = 0
    total_spent = 0

    for cat in categories:
        c_limit = budget_map.get(cat.id, 0)
        c_spent = spent_map.get(cat.id, 0)
        total_limit += c_limit
        total_spent += c_spent

        items.append({
            "category_id": str(cat.id),
            "name": cat.name,
            "limit_kopecks": c_limit,
            "spent_kopecks": c_spent,
        })

    return {
        "month": month,
        "total_limit_kopecks": total_limit,
        "total_spent_kopecks": total_spent,
        "remaining_kopecks": max(0, total_limit - total_spent),
        "items": items,
    }


@app.post("/api/budgets", tags=["Budgets"])
@limiter.limit("60/minute")
async def set_category_budget(
    request: Request,
    payload: BudgetSetRequest,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Set or update monthly category budget limit in PostgreSQL.
    """
    family = await get_or_create_default_family(session)
    cat_uuid = to_uuid(payload.category_id)

    stmt = select(Budget).where(
        Budget.family_id == family.id,
        Budget.category_id == cat_uuid,
        Budget.month_period == payload.month_period,
    )
    budget = (await session.execute(stmt)).scalar_one_or_none()

    if budget:
        budget.limit_kopecks = payload.limit_kopecks
        budget.notify_threshold_percent = payload.notify_threshold_percent
    else:
        budget = Budget(
            family_id=family.id,
            category_id=cat_uuid,
            month_period=payload.month_period,
            limit_kopecks=payload.limit_kopecks,
            notify_threshold_percent=payload.notify_threshold_percent,
        )
        session.add(budget)

    await session.flush()
    return {
        "status": "success",
        "category_id": payload.category_id,
        "month_period": payload.month_period,
        "limit_kopecks": payload.limit_kopecks,
    }


# ---------------------------------------------------------------------
# 4. TRANSACTIONS CRUD (Real PostgreSQL with minor units)
# ---------------------------------------------------------------------
# ---------------------------------------------------------------------
# Resolution helpers: the server, not the client, decides who a transaction belongs to
# ---------------------------------------------------------------------
async def _find_member(
    session: AsyncSession, family: Family, supplied: Optional[str]
) -> Optional[FamilyMember]:
    """An active member of this family with the given id, or None (unknown ids are never trusted)."""
    if not supplied:
        return None
    stmt = select(FamilyMember).where(
        FamilyMember.id == to_uuid(supplied),
        FamilyMember.family_id == family.id,
        FamilyMember.is_active.is_(True),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _resolve_payer(
    session: AsyncSession,
    family: Family,
    supplied: Optional[str],
    token_data: Dict[str, Any],
) -> FamilyMember:
    """
    Payer = the member the client names (if it really exists), otherwise the member of the
    authenticated user. This also keeps old clients that still send demo ids ('mem-01') working.
    """
    member = await _find_member(session, family, supplied)
    if member is None:
        member = await _find_member(session, family, token_data.get("member_id"))
    if member is None and token_data.get("user_id"):
        stmt = select(FamilyMember).where(
            FamilyMember.family_id == family.id,
            FamilyMember.user_id == to_uuid(token_data["user_id"]),
            FamilyMember.is_active.is_(True),
        )
        member = (await session.execute(stmt)).scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Вы не состоите в семье: отправьте /start боту",
        )
    return member


async def _existing_category_id(
    session: AsyncSession, family: Family, supplied: Optional[str]
) -> Optional[uuid.UUID]:
    """The id only if such a category exists in this family (otherwise None instead of an FK error)."""
    if not supplied:
        return None
    cat = (await session.execute(
        select(Category.id).where(Category.id == to_uuid(supplied), Category.family_id == family.id)
    )).scalar_one_or_none()
    return cat


@app.get("/api/transactions", tags=["Transactions"])
@limiter.limit("60/minute")
async def list_transactions(
    request: Request,
    status_filter: Optional[str] = None,
    month: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    List transactions from PostgreSQL. Supports status filtering ('confirmed', 'review_needed') and month.
    """
    family = await get_or_create_default_family(session)

    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.tags))
        .where(Transaction.family_id == family.id)
    )

    if status_filter:
        stmt = stmt.where(Transaction.status == status_filter)

    if month:
        try:
            start_date = date.fromisoformat(f"{month}-01")
            days_in_month = calendar.monthrange(start_date.year, start_date.month)[1]
            end_date = date(start_date.year, start_date.month, days_in_month)
            stmt = stmt.where(Transaction.transaction_date.between(start_date, end_date))
        except ValueError:
            pass

    stmt = stmt.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
    transactions = (await session.execute(stmt)).scalars().all()

    items = [
        {
            "id": str(t.id),
            "type": t.type,
            "amount_kopecks": t.amount_kopecks,
            "currency": t.currency,
            "category_id": str(t.category_id) if t.category_id else None,
            "paid_by_member_id": str(t.paid_by_member_id),
            "to_member_id": str(t.to_member_id) if t.to_member_id else None,
            "description": t.description,
            "transaction_date": t.transaction_date.isoformat(),
            "status": t.status,
            "tags": [tag.name for tag in t.tags],
            "created_at": t.created_at.isoformat(),
        }
        for t in transactions
    ]

    return {"status": "ok", "count": len(items), "items": items}


@app.post("/api/transactions", status_code=status.HTTP_201_CREATED, tags=["Transactions"])
@limiter.limit("60/minute")
async def create_transaction(
    request: Request,
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Create a transaction in PostgreSQL (amounts in kopecks).
    type='transfer' means the payer gave money to `to_member_id` (a loan or a repayment).
    """
    family = await get_or_create_default_family(session)
    payer = await _resolve_payer(session, family, payload.paid_by_member_id, token_data)

    recipient = None
    if payload.type == "transfer":
        recipient = await _find_member(session, family, payload.to_member_id)
        if recipient is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Получатель перевода не найден")
        if recipient.id == payer.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Нельзя переводить самому себе")

    cat_uuid = None
    if payload.type != "transfer":
        cat_uuid = await _existing_category_id(session, family, payload.category_id)
    if not cat_uuid and payload.type == "expense":
        desc_lower = payload.description.lower()
        cat_stmt = select(Category).where(Category.family_id == family.id)
        categories = (await session.execute(cat_stmt)).scalars().all()
        for cat in categories:
            name_lower = cat.name.lower()
            if "продукт" in name_lower or "супермаркет" in name_lower:
                if any(w in desc_lower for w in ["продукт", "магазин", "вкусвилл", "пятерочк", "магнит", "перекресток", "хлеб", "молоко", "еда", "мясо", "сыр"]):
                    cat_uuid = cat.id
                    break
            elif "кафе" in name_lower or "доставк" in name_lower or "ресторан" in name_lower:
                if any(w in desc_lower for w in ["кофе", "пицца", "кафе", "обед", "ужин", "бургер", "додо", "суши", "доставка", "чай"]):
                    cat_uuid = cat.id
                    break
            elif "авто" in name_lower or "транспорт" in name_lower:
                if any(w in desc_lower for w in ["бензин", "азс", "лукойл", "такси", "мойка", "парковк", "газпром", "метро"]):
                    cat_uuid = cat.id
                    break
            elif "здоров" in name_lower or "аптек" in name_lower:
                if any(w in desc_lower for w in ["аптека", "врач", "лекарств", "ригла", "таблетк", "клиник"]):
                    cat_uuid = cat.id
                    break
            elif "жиль" in name_lower or "жкх" in name_lower:
                if any(w in desc_lower for w in ["жкх", "квартплат", "электроэнерги", "мосэнерго", "аренд", "интернет"]):
                    cat_uuid = cat.id
                    break
        if not cat_uuid and categories:
            expense_cats = [c for c in categories if not c.is_income]
            if expense_cats:
                cat_uuid = expense_cats[0].id

    try:
        tx_date = date.fromisoformat(payload.transaction_date)
    except ValueError:
        tx_date = date.today()

    tx = Transaction(
        family_id=family.id,
        paid_by_member_id=payer.id,
        to_member_id=recipient.id if recipient else None,
        category_id=cat_uuid,
        type=payload.type,
        amount_kopecks=payload.amount_kopecks,
        currency=payload.currency,
        description=payload.description,
        transaction_date=tx_date,
        status="confirmed",
    )

    # Attach or create tags in PostgreSQL
    if payload.tags:
        for tag_str in payload.tags:
            clean_tag = tag_str.strip().lstrip("#")
            if clean_tag:
                tag_stmt = select(Tag).where(Tag.family_id == family.id, Tag.name == clean_tag)
                tag_obj = (await session.execute(tag_stmt)).scalar_one_or_none()
                if not tag_obj:
                    tag_obj = Tag(family_id=family.id, name=clean_tag)
                    session.add(tag_obj)
                    await session.flush()
                tx.tags.append(tag_obj)

    session.add(tx)
    await session.flush()

    return {
        "id": str(tx.id),
        "type": tx.type,
        "status": tx.status,
        "amount_kopecks": tx.amount_kopecks,
        "currency": tx.currency,
        "category_id": str(tx.category_id) if tx.category_id else None,
        "paid_by_member_id": str(tx.paid_by_member_id),
        "to_member_id": str(tx.to_member_id) if tx.to_member_id else None,
        "description": tx.description,
        "transaction_date": tx.transaction_date.isoformat(),
        "created_at": tx.created_at.isoformat(),
    }


@app.post("/api/transactions/sync", tags=["Transactions"])
@limiter.limit("60/minute")
async def batch_sync_transactions(
    request: Request,
    payload: BatchSyncRequest,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Batch endpoint used by the current web client to push locally buffered transactions.
    Payer and category are validated against the database; unknown ids never cause an FK error.
    """
    family = await get_or_create_default_family(session)
    synced_ids = []

    for item in payload.items:
        item_uuid = to_uuid(item.id)

        if item.action == "delete":
            await session.execute(delete(TransactionTag).where(TransactionTag.transaction_id == item_uuid))
            await session.execute(
                delete(Transaction).where(Transaction.id == item_uuid, Transaction.family_id == family.id)
            )
            synced_ids.append(item.id)

        elif item.action == "update":
            stmt = select(Transaction).where(Transaction.id == item_uuid, Transaction.family_id == family.id)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                existing.amount_kopecks = item.amount_kopecks
                existing.description = item.description
                # Transfer-ness (and its recipient) is fixed at creation.
                if item.type != "transfer" and existing.type != "transfer":
                    existing.type = item.type
                if existing.type != "transfer":
                    cat_id = await _existing_category_id(session, family, item.category_id)
                    if cat_id:
                        existing.category_id = cat_id
                if item.transaction_date:
                    try:
                        existing.transaction_date = date.fromisoformat(item.transaction_date)
                    except ValueError:
                        pass
            synced_ids.append(item.id)

        else:  # create
            existing = (await session.execute(select(Transaction).where(Transaction.id == item_uuid))).scalar_one_or_none()
            if not existing:
                payer = await _resolve_payer(session, family, item.paid_by_member_id, token_data)
                recipient = None
                if item.type == "transfer":
                    recipient = await _find_member(session, family, item.to_member_id)
                    if recipient is None or recipient.id == payer.id:
                        logger.warning("sync_skipped_invalid_transfer", item_id=item.id)
                        synced_ids.append(item.id)  # drop it from the client queue instead of retrying forever
                        continue

                try:
                    tx_date = date.fromisoformat(item.transaction_date)
                except ValueError:
                    tx_date = date.today()

                session.add(Transaction(
                    id=item_uuid,
                    family_id=family.id,
                    paid_by_member_id=payer.id,
                    to_member_id=recipient.id if recipient else None,
                    category_id=None if recipient else await _existing_category_id(session, family, item.category_id),
                    type=item.type,
                    amount_kopecks=item.amount_kopecks,
                    currency=item.currency,
                    description=item.description,
                    transaction_date=tx_date,
                    status="confirmed",
                ))
            synced_ids.append(item.id)

    await session.flush()

    return {
        "status": "success",
        "synced_count": len(synced_ids),
        "synced_ids": synced_ids,
        "processed_at": datetime.utcnow().isoformat(),
        "message": f"Успешно синхронизировано {len(synced_ids)} операций в PostgreSQL",
    }


@app.delete("/api/transactions/{draft_id}/reject", tags=["Transactions"])
@app.post("/api/transactions/{draft_id}/reject", tags=["Transactions"])
@limiter.limit("60/minute")
async def reject_draft_transaction(
    request: Request,
    draft_id: str,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Cancel a transaction entered by mistake (the "Отменить" button in the bot).
    The row is kept with status 'rejected' and is excluded from all totals.
    """
    tx_uuid = to_uuid(draft_id)
    stmt = select(Transaction).where(Transaction.id == tx_uuid)
    tx = (await session.execute(stmt)).scalar_one_or_none()

    if tx:
        tx.status = "rejected"
        await session.flush()

    return {"status": "rejected", "draft_id": draft_id}


# ---------------------------------------------------------------------
# 5. DASHBOARD & FORECAST
# ---------------------------------------------------------------------
@app.get("/api/dashboard/summary", tags=["Dashboard"])
@limiter.limit("60/minute")
async def get_dashboard_summary(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Monthly totals, active budgets, participant balances, and recent activities from PostgreSQL.
    """
    family = await get_or_create_default_family(session)
    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    days_in_month = calendar.monthrange(today.year, today.month)[1]
    start_date = date(today.year, today.month, 1)
    end_date = date(today.year, today.month, days_in_month)

    # Sum of income
    inc_stmt = select(func.coalesce(func.sum(Transaction.amount_kopecks), 0)).where(
        Transaction.family_id == family.id,
        Transaction.type == "income",
        Transaction.status != "rejected",
        Transaction.transaction_date.between(start_date, end_date),
    )
    total_income = (await session.execute(inc_stmt)).scalar_one()

    # Sum of expenses
    exp_stmt = select(func.coalesce(func.sum(Transaction.amount_kopecks), 0)).where(
        Transaction.family_id == family.id,
        Transaction.type == "expense",
        Transaction.status != "rejected",
        Transaction.transaction_date.between(start_date, end_date),
    )
    total_expenses = (await session.execute(exp_stmt)).scalar_one()

    # Drafts pending review
    draft_stmt = select(func.count(Transaction.id)).where(
        Transaction.family_id == family.id,
        Transaction.status == "review_needed",
    )
    drafts_count = (await session.execute(draft_stmt)).scalar_one()

    return {
        "period": month_str,
        "total_income_kopecks": total_income,
        "total_expenses_kopecks": total_expenses,
        "net_savings_kopecks": total_income - total_expenses,
        "drafts_pending_count": drafts_count,
    }


@app.get("/api/dashboard/forecast", tags=["Dashboard"])
@limiter.limit("60/minute")
async def get_expense_forecast(
    request: Request,
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    End-of-month expense forecast based on current daily burn rate from PostgreSQL data:
    projected = (actual_spent / days_passed) * total_days_in_month
    """
    family = await get_or_create_default_family(session)
    today = date.today()
    days_passed = max(1, today.day)
    total_days = calendar.monthrange(today.year, today.month)[1]
    days_remaining = total_days - days_passed
    month_str = f"{today.year}-{today.month:02d}"

    start_date = date(today.year, today.month, 1)
    end_date = date(today.year, today.month, total_days)

    # Actual spent so far this month
    spent_stmt = select(func.coalesce(func.sum(Transaction.amount_kopecks), 0)).where(
        Transaction.family_id == family.id,
        Transaction.type == "expense",
        Transaction.status != "rejected",
        Transaction.transaction_date.between(start_date, end_date),
    )
    actual_spent_kopecks = (await session.execute(spent_stmt)).scalar_one()

    # Total budget configured for this month
    budget_stmt = select(func.coalesce(func.sum(Budget.limit_kopecks), 0)).where(
        Budget.family_id == family.id,
        Budget.month_period == month_str,
    )
    total_budget_kopecks = (await session.execute(budget_stmt)).scalar_one()
    daily_burn_kopecks = actual_spent_kopecks // days_passed
    projected_spent_kopecks = daily_burn_kopecks * total_days
    # Without any configured budget there is nothing to compare with: no invented default limit.
    variance_kopecks = projected_spent_kopecks - total_budget_kopecks if total_budget_kopecks > 0 else 0

    return {
        "current_month": month_str,
        "days_passed": days_passed,
        "days_total": total_days,
        "days_remaining": days_remaining,
        "actual_spent_kopecks": actual_spent_kopecks,
        "daily_average_kopecks": daily_burn_kopecks,
        "projected_spent_kopecks": projected_spent_kopecks,
        "total_budget_kopecks": total_budget_kopecks,
        "variance_kopecks": variance_kopecks,
        "is_over_budget": total_budget_kopecks > 0 and variance_kopecks > 0,
        "has_budget": total_budget_kopecks > 0,
    }


# ---------------------------------------------------------------------
# 7. SYSTEM DATABASE & STORAGE RESET (Protected by Admin Auth)
# ---------------------------------------------------------------------
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
TELEGRAM_ADMIN_CHAT_IDS = [str(cid) for cid in admin_telegram_ids()]


async def verify_admin_token(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Dependency that verifies administrative authorization for critical system actions.
    Accepts:
      - 'X-Admin-Token' header matching ADMIN_TOKEN from env (if set).
      - 'Authorization: Bearer <token>' matching ADMIN_TOKEN, a JWT of an admin telegram ID,
        or a valid HS256 JWT containing admin/owner role.
    """
    # 1. Verify X-Admin-Token header
    if x_admin_token:
        if ADMIN_TOKEN and hmac.compare_digest(x_admin_token, ADMIN_TOKEN):
            return {"sub": "admin", "auth_method": "x_admin_token"}
        # Backdoor удалён (audit P0.3): ранее принимались захардкоженные
        # "admin"/"finsync-admin-secret"/"superadmin" — любой, кто читал
        # исходник, мог сбросить БД. Теперь — только env ADMIN_TOKEN (или JWT админа).

    # 2. Verify Authorization Bearer header (JWT or static admin key)
    bearer_token = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:].strip()

    if bearer_token:
        if ADMIN_TOKEN and hmac.compare_digest(bearer_token, ADMIN_TOKEN):
            return {"sub": "admin", "auth_method": "bearer_admin_token"}
        # Backdoor удалён (audit P0.3): Bearer-вариант той же уязвимости.

        try:
            payload = decode_access_token(bearer_token)
        except Exception:
            payload = None

        if payload and payload.get("typ") == "login":
            payload = None  # one-time login codes never grant admin access

        if payload:
            role = payload.get("role")
            is_admin = payload.get("is_admin", False)
            sub = str(payload.get("sub", ""))
            tg_id = str(payload.get("telegram_id", ""))

            if (
                role in ("admin", "owner", "superuser")
                or is_admin is True
                or sub in TELEGRAM_ADMIN_CHAT_IDS
                or tg_id in TELEGRAM_ADMIN_CHAT_IDS
                or sub == "admin"
            ):
                return payload

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав: требуется роль администратора",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация администратора (передайте заголовок X-Admin-Token или Bearer JWT токен)",
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.post("/api/system/reset", tags=["System"])
@app.post("/api/reset", tags=["System"])
@limiter.limit("60/minute")
async def reset_database_and_cache(
    request: Request,
    payload: Optional[ResetRequest] = None,
    admin: Dict[str, Any] = Depends(verify_admin_token),
    session: AsyncSession = Depends(get_session),
    token_data: Dict[str, Any] = Depends(verify_token),
):
    """
    Delete all transactions (and their tag links). Family, members, categories and budgets stay.
    Protected endpoint: requires administrative authentication.
    """
    mode = "clean"

    await session.execute(delete(TransactionTag))
    await session.execute(delete(Transaction))
    await session.flush()

    return {
        "status": "success",
        "mode": mode,
        "message": "Операции удалены",
        "tables_cleared": ["transactions", "transaction_tags"],
        "reset_at": datetime.utcnow().isoformat(),
        "authorized_by": admin.get("sub", "admin"),
    }
