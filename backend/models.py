"""
SQLAlchemy 2.0 async models for Family Budget MVP.
All financial amounts are stored as BIGINT kopecks (minor units).
"""
import enum
import uuid
from datetime import date, datetime, time
from typing import List, Optional
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Integer, Numeric, String, Text, Time, UniqueConstraint
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


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW_NEEDED = "review_needed"
    CONFIRMED = "confirmed"
    FAILED = "failed"


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
    recurring_rules: Mapped[List["RecurringRule"]] = relationship(back_populates="family", cascade="all, delete-orphan")
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


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    uploaded_by_member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id"))
    file_path: Mapped[str] = mapped_column(Text)
    file_name: Mapped[str] = mapped_column(String(255))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(64))
    sha256_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    extraction: Mapped[Optional["DocumentExtraction"]] = relationship(
        back_populates="document", uselist=False, cascade="all, delete-orphan"
    )
    comments: Mapped[List["DocumentComment"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentComment(Base):
    __tablename__ = "document_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id", ondelete="CASCADE"))
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    document: Mapped["Document"] = relationship(back_populates="comments")
    member: Mapped["FamilyMember"] = relationship()


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), unique=True)
    merchant_name: Mapped[Optional[str]] = mapped_column(String(128))
    merchant_inn: Mapped[Optional[str]] = mapped_column(String(16))
    receipt_date: Mapped[Optional[date]] = mapped_column(Date)
    receipt_time: Mapped[Optional[time]] = mapped_column(Time)
    extracted_total_kopecks: Mapped[Optional[int]] = mapped_column(BigInteger)
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 2), default=0.0)
    suggested_category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    raw_ocr_text: Mapped[str] = mapped_column(Text)
    ocr_engine: Mapped[str] = mapped_column(String(32), default="tesseract-5.4-rus+eng")

    document: Mapped["Document"] = relationship(back_populates="extraction")
    line_items: Mapped[List["DocumentLineItem"]] = relationship(back_populates="extraction", cascade="all, delete-orphan")


class DocumentLineItem(Base):
    __tablename__ = "document_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extraction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("document_extractions.id", ondelete="CASCADE"))
    item_name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=1.0)
    unit_price_kopecks: Mapped[int] = mapped_column(BigInteger)
    total_price_kopecks: Mapped[int] = mapped_column(BigInteger)

    extraction: Mapped["DocumentExtraction"] = relationship(back_populates="line_items")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    paid_by_member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id"))
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(16))  # expense, income, transfer, saving
    amount_kopecks: Mapped[int] = mapped_column(BigInteger)  # Stored in minor units!
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    description: Mapped[str] = mapped_column(Text)
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(16), default="review_needed", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="transactions")
    splits: Mapped[List["TransactionSplit"]] = relationship(back_populates="transaction", cascade="all, delete-orphan")
    tags: Mapped[List["Tag"]] = relationship(secondary="transaction_tags", back_populates="transactions")


class TransactionTag(Base):
    __tablename__ = "transaction_tags"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"
    __table_args__ = (UniqueConstraint("transaction_id", "member_id", name="uq_tx_member_split"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"))
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id", ondelete="CASCADE"))
    share_kopecks: Mapped[int] = mapped_column(BigInteger)

    transaction: Mapped["Transaction"] = relationship(back_populates="splits")


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


class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family_members.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    amount_kopecks: Mapped[int] = mapped_column(BigInteger)
    frequency: Mapped[str] = mapped_column(String(16))  # daily, weekly, monthly, yearly
    day_of_month: Mapped[Optional[int]] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    family: Mapped["Family"] = relationship(back_populates="recurring_rules")
    category: Mapped[Optional["Category"]] = relationship()
    member: Mapped["FamilyMember"] = relationship()
    scheduled_payments: Mapped[List["ScheduledPayment"]] = relationship(back_populates="recurring_rule")


class ScheduledPayment(Base):
    __tablename__ = "scheduled_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recurring_rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("recurring_rules.id", ondelete="SET NULL"))
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    due_date: Mapped[date] = mapped_column(Date)
    amount_kopecks: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending, paid, skipped
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    recurring_rule: Mapped[Optional["RecurringRule"]] = relationship(back_populates="scheduled_payments")
    family: Mapped["Family"] = relationship()
    transaction: Mapped[Optional["Transaction"]] = relationship()


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


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("family.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
