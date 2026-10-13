import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { criteria as readCriteria } from '../ears.mjs';
import { findFiles } from '../glob.mjs';
import { loadFrontmatterMarkdown, readText } from '../loaders.mjs';

// A simulation scenario: the tasks, the actors and their latencies, the L1 policy tier the runtime
// runs under, an optional grant, and the faults to inject. Every key has a default, so a scenario
// names only what it is about. Unknown keys are errors (a typo must not silently do nothing).

export const DEFAULTS = {
  name: 'scenario',
  description: '',
  seed: 1,
  start: '2026-10-13T08:00:00Z',
  horizon_minutes: 20160,
  adopt_owners: false,
  repo: 'acme/app',
  target: 'main',
  strategy: 'squash',
  policy: { tier: 'autonomous', forbid: [], ask: [], budgets: { max_turns: 200, max_usd: 5 } },
  supervisor: { max_workers: 3, max_depth: 1, no_progress_runs: 1, max_review_rounds: 3, max_ci_rounds: 3, max_crash_restarts: 2, checkin_minutes: 60, budget_usd: null },
  grant: null,
  human: {
    name: 'owner',
    review_minutes: [30, 240],
    answer_minutes: [10, 120],
    on_ask: 'approve',
    on_budget: 'raise',
    raise_usd: 10,
    max_raises: 1,
    on_grant_expiry: 'renew',
    renew_for_minutes: 2880,
    max_conflicts: 2,
    on_integration: 'merge',
  },
  work: {
    minutes: { XS: [10, 30], S: [30, 90], M: [90, 180], L: [180, 300], XL: [300, 480] },
    fix_minutes: [10, 40],
    usd_per_minute: 0.02,
    minutes_per_turn: 1,
    cover_rate: 0.85,
    helper_rate: 0.3,
    helper_minutes: [5, 15],
  },
  checks: { minutes: [5, 15], red_rate: 0.05, merged_red_rate: 0.02 },
  evaluator: { minutes: [10, 30], reject_rate: 0.05 },
  // queue_targets: the branches the merge queue (merge role) serves; null = every branch. A branch it
  // does not serve is landed by whoever holds a merge grant for it (the orchestrator), or nobody.
  merge: { minutes: [3, 10], queue_targets: null },
  latency: { push: [0.1, 1], signal: [0, 0.5], webhook: [0, 0.2] },
  tasks: [],
  faults: {},
};

export const FAULTS = {
  concurrent_claims: { start_minutes: 0 },
  crash: { tasks: [], rate: 0, at: [0.2, 0.8] },
  lost_events: { rate: 0.3, notice_rate: 0.7, notice_minutes: [1, 30] },
  duplicate_wakes: { rate: 0.2 },
  unknown_signals: { rate: 0.2 },
  no_progress: { tasks: [] },
  budget_exhaustion: { tasks: [], factor: 8 },
  semantic_conflict: { pairs: [], rate: 0 },
  evaluator_rejection: { tasks: {} },
  grant_expiry: { at_minutes: 240 },
  merge_without_grant: { tasks: [] },
  ask: { tasks: [], command: ['psql'] },
  wall: { tasks: [], command: ['git', 'push', '--force'] },
  question: { tasks: [] },
};

const TIERS = ['read-only', 'ask', 'auto-edit', 'autonomous', 'unattended'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const TASK_KEYS = new Set(['id', 'epic', 'priority', 'size', 'risk', 'touches', 'depends_on', 'criteria', 'budget', 'status', 'owner', 'title', 'lands_to']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function merge(base, over, where, errors) {
  if (!isObj(over)) return over === undefined ? structuredClone(base) : over;
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (!(k in base)) { errors.push(`${where}${k}: unknown key (known: ${Object.keys(base).join(', ')})`); continue; }
    out[k] = isObj(base[k]) && isObj(v) && Object.keys(base[k]).length ? merge(base[k], v, `${where}${k}.`, errors) : v;
  }
  return out;
}

// "+90m", "+2h", "+1d", a number of minutes, or an ISO time -> ISO time.
export function resolveTime(v, startMs) {
  if (typeof v === 'number') return new Date(startMs + v * 60000).toISOString();
  const m = String(v).match(/^\+(\d+(?:\.\d+)?)([mhd])$/);
  if (m) return new Date(startMs + Number(m[1]) * { m: 1, h: 60, d: 1440 }[m[2]] * 60000).toISOString();
  return new Date(Date.parse(v)).toISOString();
}

const range = (r, name, errors) => {
  if (!Array.isArray(r) || r.length !== 2 || !(r[0] <= r[1]) || r[0] < 0) errors.push(`${name}: a [min, max] range`);
};

export function normalize(raw, { source = 'scenario' } = {}) {
  const errors = [];
  if (!isObj(raw)) throw new Error(`${source}: a scenario is a YAML mapping`);
  const sc = merge(DEFAULTS, raw, '', errors);
  const startMs = Date.parse(sc.start);
  if (Number.isNaN(startMs)) errors.push('start: an ISO time');
  if (!TIERS.includes(sc.policy.tier)) errors.push(`policy.tier: one of ${TIERS.join(', ')}`);
  for (const k of ['forbid', 'ask']) {
    sc.policy[k] = (sc.policy[k] ?? []).map((r, i) => {
      if (!Array.isArray(r?.command)) errors.push(`policy.${k}[${i}]: { command: [argv...] } (the simulator models command rules)`);
      return r;
    });
  }
  sc.faults = Object.fromEntries(Object.entries(raw.faults ?? {}).map(([k, v]) => {
    if (!FAULTS[k]) { errors.push(`faults.${k}: unknown fault (known: ${Object.keys(FAULTS).join(', ')})`); return [k, v]; }
    return [k, merge(FAULTS[k], v ?? {}, `faults.${k}.`, errors)];
  }));

  const ids = new Set();
  sc.tasks = (raw.tasks ?? []).map((t, i) => {
    for (const k of Object.keys(t ?? {})) if (!TASK_KEYS.has(k)) errors.push(`tasks[${i}].${k}: unknown key`);
    if (!/^[A-Z][A-Z0-9]*-[0-9]+$/.test(t?.id ?? '')) errors.push(`tasks[${i}].id: <PREFIX>-<n>`);
    if (ids.has(t.id)) errors.push(`tasks[${i}].id: ${t.id} repeats`);
    ids.add(t.id);
    const size = t.size ?? 'M';
    if (!SIZES.includes(size)) errors.push(`tasks[${i}].size: one of ${SIZES.join(', ')}`);
    const risk = typeof t.risk === 'object' ? { level: t.risk.level ?? 'low', irreversible: Boolean(t.risk.irreversible) } : { level: t.risk ?? 'low', irreversible: false };
    const crit = typeof t.criteria === 'number' || t.criteria === undefined
      ? Array.from({ length: t.criteria ?? 2 }, (_, k) => `AC-${k + 1}`)
      : t.criteria;
    return {
      id: t.id,
      title: t.title ?? t.id,
      epic: t.epic ?? 'sim',
      priority: t.priority ?? 'P2',
      size,
      risk,
      touches: t.touches ?? [],
      depends_on: t.depends_on ?? [],
      criteria: crit,
      budget: t.budget ?? null,
      status: t.status ?? 'ready',
      owner: t.owner ?? null,
      lands_to: t.lands_to && t.lands_to !== sc.target ? t.lands_to : null,
    };
  });
  for (const t of sc.tasks) for (const d of t.depends_on) if (!ids.has(d)) errors.push(`${t.id}.depends_on: no task ${d}`);
  const seen = new Set();
  const visit = (id, stack) => {
    if (stack.includes(id)) { errors.push(`depends_on cycle: ${[...stack, id].join(' -> ')}`); return; }
    if (seen.has(id)) return;
    seen.add(id);
    for (const d of sc.tasks.find((x) => x.id === id)?.depends_on ?? []) visit(d, [...stack, id]);
  };
  for (const t of sc.tasks) visit(t.id, []);
  const taskRefs = (list, where) => { for (const id of list) if (!ids.has(id)) errors.push(`${where}: no task ${id}`); };
  for (const [k, f] of Object.entries(sc.faults)) {
    if (Array.isArray(f.tasks)) taskRefs(f.tasks, `faults.${k}.tasks`);
    if (k === 'evaluator_rejection') taskRefs(Object.keys(f.tasks), `faults.${k}.tasks`);
    if (k === 'semantic_conflict') for (const p of f.pairs) taskRefs(p, `faults.${k}.pairs`);
  }
  if (sc.merge.queue_targets !== null && !(Array.isArray(sc.merge.queue_targets) && sc.merge.queue_targets.every((x) => typeof x === 'string'))) errors.push('merge.queue_targets: null (every branch) or a list of branch names');
  if (!['merge', 'hold'].includes(sc.human.on_integration)) errors.push('human.on_integration: merge or hold');
  for (const [k, r] of [['work.fix_minutes', sc.work.fix_minutes], ['checks.minutes', sc.checks.minutes], ['evaluator.minutes', sc.evaluator.minutes], ['merge.minutes', sc.merge.minutes], ['human.review_minutes', sc.human.review_minutes], ['human.answer_minutes', sc.human.answer_minutes]]) range(r, k, errors);
  if (sc.grant) {
    sc.grant = structuredClone(sc.grant);
    for (const k of ['granted_at', 'expires_at', 'revoked_at']) if (sc.grant[k] !== undefined) sc.grant[k] = resolveTime(sc.grant[k], startMs);
    if (sc.faults.grant_expiry) sc.grant.expires_at = resolveTime(sc.faults.grant_expiry.at_minutes, startMs);
  } else if (sc.faults.grant_expiry) errors.push('faults.grant_expiry: the scenario has no grant to expire');
  sc.supervisor.budget_usd ??= sc.grant?.limits?.budget?.max_usd ?? 100;
  if (errors.length) throw new Error(`${source}:\n  ${errors.join('\n  ')}`);
  sc.source = source;
  return sc;
}

export function loadScenario(file) {
  return normalize(parse(fs.readFileSync(file, 'utf8')), { source: file });
}

// A project's own queue as a scenario: every specs/<epic>/tasks/*.md, with its status, owner,
// depends_on, touches, size, risk, budget and criteria; actors and faults from an optional config.
export function scenarioFromProject(root, config = {}) {
  const files = findFiles(root, ['specs/*/tasks/*.md']).filter((f) => !path.basename(f).startsWith('_'));
  if (!files.length) throw new Error(`${root}: no specs/<epic>/tasks/*.md`);
  const tasks = [];
  for (const f of files) {
    const text = readText(f);
    const d = loadFrontmatterMarkdown(text).records[0]?.data;
    if (!d?.id) continue;
    const crit = readCriteria(text).items.filter((c) => c.id && !c.placeholder).map((c) => c.id);
    tasks.push({
      id: d.id,
      epic: d.epic,
      priority: d.priority ?? 'P2',
      size: d.size ?? 'M',
      risk: typeof d.risk === 'object' && d.risk ? { level: d.risk.level, irreversible: d.risk.irreversible } : d.risk ?? 'low',
      touches: d.touches ?? [],
      depends_on: d.depends_on ?? [],
      criteria: crit.length ? crit : ['AC-1'],
      budget: d.budget ?? undefined,
      status: d.status,
      owner: d.owner ?? null,
      ...(d.lands_to ? { lands_to: d.lands_to } : {}),
    });
  }
  const known = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.depends_on = t.depends_on.filter((x) => known.has(x));
  // The spec gate is a human's; assume_approved stands in for it, so a draft queue can be simulated.
  const { assume_approved: approved = false, ...rest } = config;
  if (approved) for (const t of tasks) if (t.status === 'spec-draft') t.status = 'ready';
  return normalize({ name: path.basename(path.resolve(root)), adopt_owners: true, ...rest, tasks }, { source: root });
}
