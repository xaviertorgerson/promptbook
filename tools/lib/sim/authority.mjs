// Authority facts shared by the world, the supervisor and the invariants (state-machines/authority.yaml).

export function grantLiveAt(g, ms) {
  if (!g) return false;
  return Date.parse(g.granted_at) <= ms && ms < Date.parse(g.expires_at) && !(g.revoked_at && Date.parse(g.revoked_at) <= ms);
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
