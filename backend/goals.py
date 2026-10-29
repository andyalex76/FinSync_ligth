"""
Savings goals: progress math (pure functions, no database access).

The saved amount of a goal is never stored. It is derived from transactions:
    saved = sum(deposits, type='saving') - sum(withdrawals, type='withdrawal')
All amounts are integer kopecks.
"""
import math
from datetime import date
from typing import Any, Dict, Optional

AVG_DAYS_PER_MONTH = 30.4375


def goal_progress(
    target_kopecks: int,
    saved_kopecks: int,
    target_date: Optional[date],
    today: date,
) -> Dict[str, Any]:
    """Progress numbers of one goal for the dashboard and the bot."""
    saved = max(saved_kopecks, 0)
    remaining = max(target_kopecks - saved, 0)
    percent = min(100, saved * 100 // target_kopecks) if target_kopecks > 0 else 0

    days_left: Optional[int] = None
    is_overdue = False
    required_per_month: Optional[int] = None
    if target_date is not None:
        days_left = (target_date - today).days
        if remaining > 0:
            if days_left < 0:
                is_overdue = True
            else:
                months_left = max(1, math.ceil(days_left / AVG_DAYS_PER_MONTH))
                required_per_month = math.ceil(remaining / months_left)

    return {
        "saved_kopecks": saved,
        "remaining_kopecks": remaining,
        "progress_percent": percent,
        "is_reached": saved >= target_kopecks > 0,
        "days_left": days_left,
        "is_overdue": is_overdue,
        "required_per_month_kopecks": required_per_month,
    }
