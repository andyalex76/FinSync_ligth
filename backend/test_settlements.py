"""Pure unit tests for transfer-based settlements (no database)."""
try:
    from backend.settlements import compute_balances, compute_settlements, net_pairs
except ImportError:
    from settlements import compute_balances, compute_settlements, net_pairs


def test_single_loan_creates_a_debt():
    # Anna gave Boris 5000.00
    rows = [("anna", "boris", 500000)]
    assert compute_settlements(rows) == [
        {"debtor_member_id": "boris", "creditor_member_id": "anna", "amount_kopecks": 500000}
    ]
    assert compute_balances(rows) == {"anna": 500000, "boris": -500000}


def test_repayment_reduces_the_debt_and_full_repayment_closes_it():
    rows = [("anna", "boris", 500000), ("boris", "anna", 200000)]
    assert compute_balances(rows) == {"anna": 300000, "boris": -300000}
    rows.append(("boris", "anna", 300000))
    assert compute_settlements(rows) == []
    assert compute_balances(rows) == {}


def test_overpayment_flips_the_direction():
    rows = [("anna", "boris", 100000), ("boris", "anna", 150000)]
    assert compute_settlements(rows) == [
        {"debtor_member_id": "anna", "creditor_member_id": "boris", "amount_kopecks": 50000}
    ]


def test_pairs_are_independent_and_balances_sum_to_zero():
    rows = [
        ("anna", "boris", 300000),
        ("anna", "clara", 100000),
        ("clara", "boris", 40000),
    ]
    balances = compute_balances(rows)
    assert balances == {"anna": 400000, "boris": -340000, "clara": -60000}
    assert sum(balances.values()) == 0
    assert len(compute_settlements(rows)) == 3


def test_invalid_rows_are_ignored():
    assert net_pairs([("anna", "anna", 100), ("anna", "boris", 0), ("anna", "boris", -5)]) == {}
