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

// Does grant g delegate `action` for this task? merge must name the scenario's repository, exact
// target and strategy (authority.yaml grantable.merge.scope_rule); every action is bounded by the
// grant's scope (repositories, epics, tasks).
export function grantHas(g, action, sc, task) {
  if (!g) return false;
  if (!g.scope?.repositories?.includes(sc.repo)) return false;
  if (task && g.scope.epics?.length && !g.scope.epics.includes(task.epic)) return false;
  if (task && g.scope.tasks?.length && !g.scope.tasks.includes(task.id)) return false;
  return g.actions.some((a) => actionName(a) === action && (action !== 'merge' || (a.repo === sc.repo && a.target === sc.target && a.strategy === sc.strategy)));
}
