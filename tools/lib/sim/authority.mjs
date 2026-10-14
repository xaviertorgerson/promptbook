// Authority facts shared by the world, the supervisor and the invariants (state-machines/authority.yaml).

// A grant's lifecycle state at a moment (epoch ms). Derived, never stored: the grant contract has no
// status field (CONTRACTS.md, grant lifecycle). pending: before granted_at; live; expired: at or past
// expires_at; revoked: at or past revoked_at (revocation wins over expiry, since it names a person).
export function grantState(g, ms) {
  if (!g) return null;
  if (g.revoked_at && Date.parse(g.revoked_at) <= ms) return 'revoked';
  if (ms < Date.parse(g.granted_at)) return 'pending';
  if (ms >= Date.parse(g.expires_at)) return 'expired';
  return 'live';
}

export function grantLiveAt(g, ms) {
  return grantState(g, ms) === 'live';
}

const actionName = (a) => (typeof a === 'string' ? a : a.action);

// The branch a task lands on: its lands_to (an epic's integration branch), else the protected target.
export const landingTarget = (sc, task) => task?.lands_to ?? sc.target;

// Does grant g delegate `action` for this task? merge must name the scenario's repository, the
// exact branch the task lands on, which is never the protected branch, and the strategy
// (authority.yaml grantable.merge.scope_rule); every action is bounded by the grant's scope
// (repositories, epics, tasks).
export function grantHas(g, action, sc, task) {
  if (!g) return false;
  if (!g.scope?.repositories?.includes(sc.repo)) return false;
  if (task && g.scope.epics?.length && !g.scope.epics.includes(task.epic)) return false;
  if (task && g.scope.tasks?.length && !g.scope.tasks.includes(task.id)) return false;
  const mergeCovers = (a) => a.repo === sc.repo && a.target === landingTarget(sc, task) && a.target !== sc.target && a.protected_branch === sc.target && a.strategy === sc.strategy;
  return g.actions.some((a) => actionName(a) === action && (action !== 'merge' || mergeCovers(a)));
}

// Actions that start or steer workers. A grant that delegates one of them bounds how many run at
// once (limits.max_workers) and what the runtime spends (limits.budget); a merge-only or
// review-only grant bounds neither (authority.yaml lifecycle.limits).
export const DISPATCH_ACTIONS = ['select-tasks', 'approve-plan', 'dispose-findings', 'finalize'];
export const dispatches = (g) => g.actions.some((a) => DISPATCH_ACTIONS.includes(actionName(a)));

// The workers cap at a moment: the supervisor's own cap, and the smallest max_workers among the
// live grants that delegate dispatch.
export function workerCap(grants, ms, base) {
  return Math.min(base, ...grants.filter((g) => grantLiveAt(g, ms) && dispatches(g)).map((g) => g.limits?.max_workers ?? Infinity));
}

// The grant an action is exercised under: a live one that delegates it for the task; else one that
// names the action at all (expired, or for another branch or scope), so a check can say why it does
// not cover the action; else none. Merge authority therefore comes from a merge grant only.
export function grantFor(grants, action, sc, task, ms) {
  if (!action) return grants.find((g) => grantLiveAt(g, ms)) ?? grants[0] ?? null;
  return grants.find((g) => grantLiveAt(g, ms) && grantHas(g, action, sc, task)) ?? grants.find((g) => g.actions.some((a) => actionName(a) === action)) ?? null;
}

// The grant a task's record names: the one under which its work is dispatched (a dispatch grant
// whose scope covers the task), else any grant whose scope covers it.
export function recordGrant(grants, sc, task) {
  const covers = (g) => DISPATCH_ACTIONS.some((a) => grantHas(g, a, sc, task)) || grantHas(g, 'merge', sc, task);
  return grants.find((g) => dispatches(g) && covers(g)) ?? grants.find(covers) ?? null;
}
