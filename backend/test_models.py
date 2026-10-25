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
