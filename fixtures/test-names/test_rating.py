import pytest


def test_bill_6_ac_1_rates_each_unit_at_its_tier():
    pass


@pytest.mark.parametrize("plan", ["flat", "tiered"], ids=["BILL-6 AC-2 flat plan", "BILL-6 AC-2 tiered plan"])
def test_flat_price(plan):
    pass


@pytest.mark.parametrize("amount", [pytest.param(5, id="BILL-6 AC-3 rounds half even")])
def test_rounding(amount):
    pass
