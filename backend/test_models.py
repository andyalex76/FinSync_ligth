"""ORM sanity: every relationship() must resolve. Catches SQLAlchemy upgrades that break string lookups."""
try:
    import backend.models  # noqa: F401
except ImportError:
    import models  # noqa: F401

from sqlalchemy.orm import configure_mappers


def test_orm_mappers_configure():
    configure_mappers()


def test_family_funds_relationship_points_to_savings_goals():
    try:
        from backend.models import Family, SavingsGoal
    except ImportError:
        from models import Family, SavingsGoal
    configure_mappers()
    assert Family.funds.property.mapper.class_ is SavingsGoal


def test_removed_tables_are_gone_and_transfers_have_a_recipient():
    try:
        from backend.models import Base, Transaction
    except ImportError:
        from models import Base, Transaction

    tables = set(Base.metadata.tables)
    for gone in ("transaction_splits", "documents", "document_extractions", "document_line_items",
                 "document_comments", "recurring_rules", "scheduled_payments", "audit_logs"):
        assert gone not in tables, gone
    assert "to_member_id" in Transaction.__table__.c
    assert "document_id" not in Transaction.__table__.c
