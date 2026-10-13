// Names only (see tests/skeleton.test.ts).
describe('SPLIT-2 save a bill exactly once', () => {
  it('SPLIT-2 AC-1 stores one bill for a double submit within 10 seconds', () => {});
  it('SPLIT-2 AC-1 stores one bill when two identical submits race', () => {});
  it('SPLIT-2 AC-2 keeps the draft and offers Retry when saving fails', () => {});
  it('SPLIT-2 AC-3 shows a field error and saves nothing for a non-positive amount', () => {});
  it('SPLIT-2 AC-4 acknowledges a save within 300 ms at p95 under 20 rps', () => {});
});
