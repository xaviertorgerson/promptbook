// Planning proof: test names carry "<TASK-ID> AC-n", which the trace check reads. Bodies are stubs;
// the implementing tasks fill them.
describe('SPLIT-1 walking skeleton', () => {
  it('SPLIT-1 AC-1 adds each member an even share when a bill is saved', () => {});
  it('SPLIT-1 AC-2 shows the household bills and balance from a valid link', () => {});
  it('SPLIT-1 AC-3 returns no rows of another household from any list endpoint', () => {});
  it('SPLIT-1 AC-4 deploys the one built artifact to the first stage by digest', () => {});
  it('SPLIT-1 AC-5 readiness probe reports datastore and config healthy', () => {});
});

describe('SPLIT-2 save a bill exactly once', () => {
  it('SPLIT-2 AC-1 stores one bill for a double submit within 10 seconds', () => {});
  it('SPLIT-2 AC-2 keeps the draft and offers Retry when saving fails', () => {});
  it('SPLIT-2 AC-3 shows a field error and saves nothing for a non-positive amount', () => {});
  it('SPLIT-2 AC-4 acknowledges a save within 300 ms at p95 under 20 rps', () => {});
});

describe('SPLIT-3 settle a share from a household link', () => {
  it('SPLIT-3 AC-1 sets the share balance to zero when marked paid', () => {});
  it('SPLIT-3 AC-2 shows the revoked page and no household data for a revoked link', () => {});
  it('SPLIT-3 AC-3 offers Undo within 24 hours of marking paid', () => {});
  it('SPLIT-3 AC-4 passes the accessibility audit with 0 serious violations', () => {});
  it('SPLIT-3 AC-5 completes CUJ-2 with the keyboard alone', () => {});
});
