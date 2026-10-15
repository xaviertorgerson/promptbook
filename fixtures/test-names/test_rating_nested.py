import pytest


class TestBILL6:
    def test_ac_1_rates_each_unit_at_its_tier(self):
        pass

    class TestFlatPlans:
        @pytest.mark.parametrize("plan", ["flat"], ids=["AC-2 flat plan"])
        def test_flat_price(self, plan):
            pass

    @pytest.mark.parametrize("amount", [pytest.param(5, id="AC-3 rounds half even")])
    def test_rounding(self, amount):
        pass
