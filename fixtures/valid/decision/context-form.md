# Architecture decisions

## ADR-0040: Store money as integer minor units
**Status:** Accepted
**Date:** 2026-10-06
**Context:** Floating-point totals drifted by a cent on 3 of 10,000 rated periods in the load test,
and the payment provider reports amounts in minor units.
**Decision:** Every amount is an integer count of the currency's minor unit, end to end.
**Consequences:** Formatting happens only at the edges; a currency with three decimals needs its own
exponent.
