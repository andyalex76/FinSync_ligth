"""Pure unit tests for savings goal progress (no database)."""
from datetime import date

try:
    from backend.goals import goal_progress
except ImportError:
    from goals import goal_progress

TODAY = date(2026, 10, 28)


def test_progress_without_deadline():
    p = goal_progress(15_000_000, 4_500_000, None, TODAY)
    assert p["saved_kopecks"] == 4_500_000
    assert p["remaining_kopecks"] == 10_500_000
    assert p["progress_percent"] == 30
    assert p["is_reached"] is False
    assert p["days_left"] is None
    assert p["required_per_month_kopecks"] is None


def test_required_monthly_amount_rounds_up():
    # 6 months-ish left: remaining 1_000_000 over ceil(days/30.4375) months
    p = goal_progress(1_000_000, 0, date(2027, 4, 28), TODAY)
    assert p["days_left"] == 182
    assert p["required_per_month_kopecks"] == 166_667  # ceil(1_000_000 / 6)


def test_reached_goal_has_no_remaining_and_no_required_amount():
    p = goal_progress(1_000_000, 1_200_000, date(2027, 4, 28), TODAY)
    assert p["is_reached"] is True
    assert p["remaining_kopecks"] == 0
    assert p["progress_percent"] == 100
    assert p["required_per_month_kopecks"] is None


def test_overdue_goal_is_flagged():
    p = goal_progress(1_000_000, 100_000, date(2026, 9, 1), TODAY)
    assert p["is_overdue"] is True
    assert p["days_left"] < 0
    assert p["required_per_month_kopecks"] is None


def test_last_days_count_as_one_month():
    p = goal_progress(300_000, 0, date(2026, 10, 30), TODAY)
    assert p["required_per_month_kopecks"] == 300_000


def test_negative_saved_is_clamped_and_zero_target_is_safe():
    assert goal_progress(1_000_000, -5, None, TODAY)["saved_kopecks"] == 0
    assert goal_progress(0, 0, None, TODAY)["progress_percent"] == 0
