// Grant provenance and narrowing (state-machines/authority.yaml lifecycle; CONTRACTS.md, grant).
//
// A live grant is a file the granting human committed under .orchestrator/grants/, a path the
// project's CODEOWNERS gives to its human owners; agents write only .orchestrator/grants/drafts/.
// The issued fields never change after the issuing commit: narrowing is appended to narrowed[] as
// structured removals and reductions, and the grant in force is the issued one minus them.

const actionName = (a) => (typeof a === 'string' ? a : a?.action);
const SCOPE_LISTS = ['repositories', 'epics', 'tasks', 'requirements'];
const BUDGET_KEYS = ['max_usd', 'max_turns', 'max_minutes', 'max_tokens'];
// Fields a narrowing, a revocation or a local x- note may add; everything else is the issue.
export const MUTABLE_GRANT_FIELDS = new Set(['narrowed', 'revoked_at', 'revoked_by', 'revocation_reason']);

// A grant's lifecycle state at a moment (epoch ms), read from the record and never stored in it
// (CONTRACTS.md, grant lifecycle): pending before granted_at; live; expired at or past expires_at,
// when it has one (a grant bounded by stop_when alone ends when a stop condition holds, which only
// its coordinator can tell); revoked at or past revoked_at, which wins over expiry because it
// names a person.
export function grantState(g0, ms) {
  if (!g0) return null;
  const g = effectiveGrant(g0, ms);
  if (g.revoked_at && Date.parse(g.revoked_at) <= ms) return 'revoked';
  if (ms < Date.parse(g.granted_at)) return 'pending';
  if (g.expires_at && ms >= Date.parse(g.expires_at)) return 'expired';
  return 'live';
}

// The grant in force: the issued fields minus every narrowing entry dated at or before `ms`.
export function effectiveGrant(g, ms = Infinity) {
  if (!g?.narrowed?.length) return g;
  const out = structuredClone(g);
  for (const n of g.narrowed ?? []) {
    if (Date.parse(n.at) > ms) continue;
    const drop = new Set(n.remove_actions ?? []);
    out.actions = out.actions.filter((a) => !drop.has(actionName(a)));
    for (const k of SCOPE_LISTS) {
      const rm = new Set(n.remove_scope?.[k] ?? []);
      if (rm.size && Array.isArray(out.scope?.[k])) out.scope[k] = out.scope[k].filter((x) => !rm.has(x));
    }
    const r = n.reduce_limits ?? {};
    if (r.max_workers !== undefined) out.limits.max_workers = Math.min(out.limits.max_workers, r.max_workers);
    for (const k of BUDGET_KEYS) if (r.budget?.[k] !== undefined) (out.limits.budget ??= {})[k] = Math.min(out.limits.budget[k] ?? Infinity, r.budget[k]);
    if (r.expires_at && (!out.expires_at || Date.parse(r.expires_at) < Date.parse(out.expires_at))) out.expires_at = r.expires_at;
  }
  return out;
}

// narrowing-only-narrows: each entry, in order, removes only what the grant in force still holds,
// reduces a limit or the expiry (never raises one), never empties a scope list (an empty list means
// unrestricted, so emptying one widens), and is dated within the grant's life, after the previous
// one. Findings { rule, pointer, message }.
export function narrowingFindings(g) {
  const out = [];
  if (!Array.isArray(g?.narrowed) || !Array.isArray(g.actions)) return out;
  let cur = structuredClone({ ...g, narrowed: [] });
  let last = Date.parse(g.granted_at);
  g.narrowed.forEach((n, i) => {
    const at = `/narrowed/${i}`;
    const bad = (pointer, message) => out.push({ rule: 'narrowing-only-narrows', pointer: `${at}${pointer}`, message });
    const t = Date.parse(n?.at);
    if (t < last) bad('/at', `${n.at} is before ${i ? 'the previous narrowing' : 'granted_at'}: narrowing is appended, in order`);
    if (g.revoked_at && t > Date.parse(g.revoked_at)) bad('/at', `${n.at} is after the revocation`);
    if (Number.isFinite(t)) last = t;
    const held = new Set(cur.actions.map(actionName));
    for (const a of n?.remove_actions ?? []) if (!held.has(a)) bad('/remove_actions', `removes ${a}, which the grant in force does not hold`);
    for (const k of SCOPE_LISTS) {
      const rm = n?.remove_scope?.[k] ?? [];
      if (!rm.length) continue;
      const list = cur.scope?.[k];
      if (!Array.isArray(list) || !list.length) { bad(`/remove_scope/${k}`, `scope.${k} lists nothing to remove (an absent list is unrestricted)`); continue; }
      for (const x of rm) if (!list.includes(x)) bad(`/remove_scope/${k}`, `removes ${x}, which scope.${k} does not hold`);
      if (list.every((x) => rm.includes(x))) bad(`/remove_scope/${k}`, `removes every entry of scope.${k}, which would leave it unrestricted: that widens; revoke instead`);
    }
    const r = n?.reduce_limits ?? {};
    if (r.max_workers !== undefined && r.max_workers > cur.limits.max_workers) bad('/reduce_limits/max_workers', `raises max_workers ${cur.limits.max_workers} → ${r.max_workers}: widening is a new grant`);
    for (const k of BUDGET_KEYS) {
      if (r.budget?.[k] === undefined) continue;
      const was = cur.limits.budget?.[k];
      // An unset limit is no limit, so setting one narrows.
      if (was !== undefined && r.budget[k] > was) bad(`/reduce_limits/budget/${k}`, `raises budget.${k} ${was} → ${r.budget[k]}: widening is a new grant`);
    }
    if (r.expires_at && cur.expires_at && Date.parse(r.expires_at) > Date.parse(cur.expires_at)) bad('/reduce_limits/expires_at', `extends expires_at ${cur.expires_at} → ${r.expires_at}: renewal is a new grant`);
    cur = effectiveGrant({ ...cur, narrowed: [n] });
  });
  return out;
}
