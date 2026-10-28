"""
SQLAlchemy 2.0 async models for Family Budget MVP.
All financial amounts are stored as BIGINT kopecks (minor units).
"""
import enum
import uuid
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Integer, String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class CurrencyEnum(str, enum.Enum):
    RUB = "RUB"
    USD = "USD"
    EUR = "EUR"


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class TransactionType(str, enum.Enum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"
    SAVING = "saving"


class TransactionStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEW_NEEDED = "review_needed"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[Optional[int]] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(64))
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[Optional[str]] = mapped_column(String(128))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    language_code: Mapped[str] = mapped_column(String(8), default="ru")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    memberships: Mapped[List["FamilyMember"]] = relationship(back_populates="user")


class Family(Base):
    __tablename__ = "family"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128))
    base_currency: Mapped[str] = mapped_column(String(3), default="RUB")
    invite_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    members: Mapped[List["FamilyMember"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    categories: Mapped[List["Category"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    transactions: Mapped[List["Transaction"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    budgets: Mapped[List["Budget"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    tags: Mapped[List["Tag"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    funds: Mapped[List["SavingsGoal"]] = relationship(back_populates="family", cascade="all, delete-orphan")


class FamilyMember(Base):
    __tablename__ = "family_members"
    __table_args__ = (UniqueConstraint("family_id", "user_id", name="uq_family_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="member")
    display_name: Mapped[str] = mapped_column(String(64))
    avatar_emoji: Mapped[str] = mapped_column(String(8), default="👤")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(64))
    icon: Mapped[str] = mapped_column(String(32), default="Tag")
    color: Mapped[str] = mapped_column(String(16), default="emerald")
    is_income: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    family: Mapped["Family"] = relationship(back_populates="categories")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("family_id", "name", name="uq_family_tag"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="tags")
    transactions: Mapped[List["Transaction"]] = relationship(
        secondary="transaction_tags", back_populates="tags"
    )


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        # A transfer is money given by `paid_by_member_id` to `to_member_id` (a loan or a repayment).
        # It must name a different recipient; other transaction types must not have one.
        CheckConstraint(
            "(type = 'transfer' AND to_member_id IS NOT NULL AND to_member_id <> paid_by_member_id) "
            "OR (type <> 'transfer' AND to_member_id IS NULL)",
            name="ck_transfer_recipient",
        ),
        CheckConstraint("amount_kopecks > 0", name="ck_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    paid_by_member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id"))
    to_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id"))
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(16))  # expense, income, transfer, saving
    amount_kopecks: Mapped[int] = mapped_column(BigInteger)  # Stored in minor units!
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    description: Mapped[str] = mapped_column(Text)
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(16), default="review_needed", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="transactions")
    tags: Mapped[List["Tag"]] = relationship(secondary="transaction_tags", back_populates="transactions")


class TransactionTag(Base):
    __tablename__ = "transaction_tags"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("family_id", "category_id", "month_period", name="uq_family_cat_month"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"))
    month_period: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    limit_kopecks: Mapped[int] = mapped_column(BigInteger)
    notify_threshold_percent: Mapped[int] = mapped_column(Integer, default=80)

    family: Mapped["Family"] = relationship(back_populates="budgets")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    target_amount_kopecks: Mapped[int] = mapped_column(BigInteger)
    current_amount_kopecks: Mapped[int] = mapped_column(BigInteger, default=0)
    target_date: Mapped[Optional[date]] = mapped_column(Date)
    icon: Mapped[str] = mapped_column(String(32), default="PiggyBank")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="funds")


Fund = SavingsGoal
