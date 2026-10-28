"""
Settlements between family members based on transfers only.

A transfer is money given by member A to member B (a loan or a repayment of an earlier loan).
There are no split bills: balances come exclusively from transfers.

    given(A -> B) - given(B -> A) > 0   means B owes A that amount.

All amounts are integer kopecks. The module is pure (no database access) so it is easy to test.
"""
from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

TransferRow = Tuple[str, str, int]  # (from_member_id, to_member_id, amount_kopecks)


def net_pairs(transfers: Iterable[TransferRow]) -> Dict[Tuple[str, str], int]:
    """Net amount per ordered pair (creditor, debtor): only pairs with a positive balance are returned."""
    given: Dict[Tuple[str, str], int] = defaultdict(int)
    for giver, receiver, amount in transfers:
        if giver == receiver or amount <= 0:
            continue
        given[(giver, receiver)] += amount

    result: Dict[Tuple[str, str], int] = {}
    seen = set()
    for (a, b) in list(given):
        key = frozenset((a, b))
        if key in seen:
            continue
        seen.add(key)
        net = given.get((a, b), 0) - given.get((b, a), 0)
        if net > 0:
            result[(a, b)] = net  # b owes a
        elif net < 0:
            result[(b, a)] = -net  # a owes b
    return result


def compute_settlements(transfers: Iterable[TransferRow]) -> List[Dict[str, object]]:
    """List of open debts: who owes whom how much (largest first)."""
    pairs = net_pairs(transfers)
    items = [
        {"debtor_member_id": debtor, "creditor_member_id": creditor, "amount_kopecks": amount}
        for (creditor, debtor), amount in pairs.items()
    ]
    items.sort(key=lambda i: (-int(i["amount_kopecks"]), str(i["debtor_member_id"])))
    return items


def compute_balances(transfers: Iterable[TransferRow]) -> Dict[str, int]:
    """Per member: positive = others owe this member, negative = this member owes others."""
    balances: Dict[str, int] = defaultdict(int)
    for (creditor, debtor), amount in net_pairs(transfers).items():
        balances[creditor] += amount
        balances[debtor] -= amount
    return dict(balances)
