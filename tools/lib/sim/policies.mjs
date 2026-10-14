import { dispatches } from './authority.mjs';
import { touchesOverlap } from './util.mjs';

// Supervisor policies: the orchestrating-work protocol as code. `orchestrating()` is the correct
// policy; each entry of MUTATIONS breaks exactly one behaviour of it, so a mutation test shows which
// invariant notices that one change.
//
// The correct policy, per wake (playbook: dormancy-and-wakes, single-writer, budgets-and-routing,
// landing-changes, return-contract; state-machines/attention.yaml):
//   1. reconcile: read the durable evidence (task files, PRs, check runs, reviews, ended runs) and
//      the returns of runs that ended; a wake is a hint, never the evidence.
//   2. surface: every permission prompt, denial, open question, ceiling, crash limit, stall or lapsed
//      grant becomes attention needs-human naming the next action; it never answers a prompt.
//   3. advance only through the actor that owns the transition: a coder run (claim, open-draft,
//      iterate, finalize), the evaluator (a verdict on every head before finalizing), or itself only
//      where a live grant delegates it (finalize -> mark-pr-ready, merge -> approve-pr, and land or
//      integrate on a branch no merge queue serves) and the guards hold on the evidence.
//   4. dispatch ready work in priority order within caps: workers, depth, turns, spend (per run,
//      per task, per runtime), no-progress, and one writer per lane (disjoint touches); a dependency
//      counts when merged, or integrated in the dependent's own epic.

export const MUTATIONS = {
  'advance-on-wake': 'treats an author\'s done/idle signal as finished work and advances the task without evidence',
  'merge-without-grant': 'approves PRs for merge itself when a review passed, holding no merge grant',
  'act-on-expired-grant': 'keeps exercising its merge grant after the grant expired',
  'skip-evaluator': 'finalizes and approves under its grant without an independent review of the head',
  'overlapping-dispatch': 'dispatches ready tasks without checking their touches against the lanes in flight',
  'ignore-budget': 'dispatches runs with no turn or spend caps and retries after a ceiling',
  'auto-approve-ask': 'answers permission prompts itself to keep the run moving',
  'swallow-denials': 'reads a run that was denied a permission and records it as working, asking no one',
  'ignore-no-progress': 'redispatches a task whose last run made no progress, without a human',
  'unbounded-workers': 'dispatches every ready task at once, past the worker cap',
  'nested-helpers': 'lets workers spawn helpers that spawn helpers (no depth cap)',
  'redispatch-on-unknown': 'starts a second author when a pane\'s state is unknown',
  'complete-on-idle': 'records a task complete when its author\'s pane goes done or idle',
  'status-as-attention': 'writes the workflow status into the task record\'s attention',
  'wake-ledger': 'treats the wake stream as complete: ignores events-lost notices and check-ins, never reconciles',
  'land-directly': 'lands an approved change itself instead of leaving it to the merge queue (no merged-result checks)',
  'cross-epic-integrated': 'treats a dependency integrated on another epic\'s integration branch as merged, and claims the dependent before that branch reached the protected branch',
  'finalize-unverified': 'marks a PR ready (finalize) on green checks and covered criteria without waiting for the evaluator\'s verdict on the head',
  'land-without-grant': 'runs its own merge and lands every approved change, whether or not a merge grant of its covers that branch',
  'uncounted-readers': 'counts its authors and evaluators against the workers cap but not the readers they started',
};

const PRIORITY = { P0: 0, P1: 1, P2: 2, P3: 3 };
const CLAIMED = new Set(['in-progress', 'review', 'human-review', 'merging']);
const LIVE = new Set(['running', 'blocked']);
const MIN_RUN_USD = 0.25;
const byPriority = (a, b) => (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9) || a.id.localeCompare(b.id, 'en', { numeric: true });

export function orchestrating({ break: breaks = [] } = {}) {
  const broken = new Set([].concat(breaks));
  for (const b of broken) if (!MUTATIONS[b]) throw new Error(`unknown mutation ${b} (known: ${Object.keys(MUTATIONS).join(', ')})`);
  return ({ runtime }) => {
    const st = { tasks: new Map(), pending: new Map(), grantNoted: new Set() };
    const T = (id) => {
      if (!st.tasks.has(id)) st.tasks.set(id, { ci: 0, ciHead: null, rounds: 0, roundHead: null, crashes: 0, waitSince: null, waitFor: null, completeRecorded: false });
      return st.tasks.get(id);
    };
    return {
      name: broken.size ? `orchestrating-work (broken: ${[...broken].join(', ')})` : 'orchestrating-work',
      onEvent(note, api) { decide(note, api, { st, T, broken, runtime }); },
    };
  };
}

function decide(note, api, { st, T, broken }) {
  const v = api.view();
  const cfg = api.config;
  const tasks = new Map(v.tasks.map((t) => [t.id, t]));
  const live = v.sessions.filter((s) => LIVE.has(s.state));
  const counted = broken.has('uncounted-readers') ? live.filter((s) => s.kind !== 'helper') : live;
  const liveFor = (id, kind) => live.filter((s) => s.task === id && (!kind || s.kind === kind));
  const decidedSince = (id, t0) => v.decisions.some((d) => d.task === id && d.at >= t0);
  const pr = (id) => v.prs[id] ?? null;
  const reviewOf = (p) => [...p.reviews].reverse().find((r) => r.head === p.head) ?? null;
  const lastReturn = (id) => v.sessions.filter((s) => s.task === id && s.kind === 'author' && s.return && s.return.head !== undefined).sort((a, b) => a.endedAt - b.endedAt).at(-1)?.return ?? null;
  const covered = (t, p) => t.criteria.every((ac) => p.coverage.includes(ac));
  const mine = (t) => t.owner === api.coder;
  const wait = (id, why, item, next, questions = []) => {
    const ts = T(id);
    if (ts.waitFor !== item || ts.waitNext !== next) { ts.waitSince = v.t; ts.waitFor = item; ts.waitNext = next; }
    api.record(id, { attention: 'needs-human', summary: why, next_action: next, item, questions });
  };
  const working = (id, why) => {
    const ts = T(id);
    ts.waitFor = null;
    api.record(id, { attention: broken.has('status-as-attention') ? tasks.get(id)?.status ?? 'working' : 'working', summary: why });
  };
  const waitingOnHuman = (id) => {
    const ts = T(id);
    return ts.waitFor !== null && !decidedSince(id, ts.waitSince);
  };

  // A pushed commit is pending until the task's status moves (or the push was rejected).
  for (const [id, p] of st.pending) if (tasks.get(id)?.status !== p.from || v.t - p.at > 5) st.pending.delete(id);
  const commit = (t, c) => {
    st.pending.set(t.id, { from: t.status, at: v.t });
    api.commit(t.id, c);
  };

  // ---------------------------------------------------------------- mutations that act on the wake itself
  if (broken.has('wake-ledger') && (note.kind === 'checkin' || note.kind === 'notice')) return;
  if (broken.has('complete-on-idle') && note.kind === 'signal' && note.role === 'author' && ['done', 'idle'].includes(note.value)) {
    api.record(note.task, { attention: 'complete', summary: 'the author went idle' });
  }
  if (broken.has('advance-on-wake') && note.kind === 'signal' && note.role === 'author' && ['done', 'idle'].includes(note.value)) {
    const t = tasks.get(note.task);
    if (t?.status === 'review') commit(t, { transition: 'mark-pr-ready', to: 'human-review', prReady: true });
    else if (t?.status === 'in-progress') commit(t, { transition: 'open-draft', to: 'review' });
  }
  if (broken.has('redispatch-on-unknown') && note.kind === 'signal' && note.value === 'unknown' && note.role === 'author') {
    const t = tasks.get(note.task);
    if (t && mine(t)) api.dispatch(t.id, { mode: 'work', caps: caps(t) });
  }

  // ---------------------------------------------------------------- 1. reconcile runs that ended
  for (const run of v.runs) {
    api.consume(run.id);
    if (run.kind !== 'author') continue;
    const ts = T(run.task);
    const r = run.result;
    if (r.claimLost) continue;
    if (run.denials.length) {
      if (broken.has('swallow-denials')) { working(run.task, 'retrying after a denied command'); continue; }
      const p = v.prompts.filter((x) => run.denials.includes(x.id));
      wait(run.task, 'a command was denied', 'denial', `Decide on the denied command: ${p.map((x) => x.command).join('; ')}`, run.denials);
      if (broken.has('auto-approve-ask')) for (const id of run.denials) api.answerPrompt(id, 'approve');
      continue;
    }
    if (r.subtype?.startsWith('error_max')) {
      wait(run.task, `ceiling: ${r.subtype}`, 'budget', `Raise the budget or re-plan ${run.task} (${r.subtype})`);
      continue;
    }
    if (run.state === 'crashed') {
      ts.crashes += 1;
      if (ts.crashes > cfg.max_crash_restarts) wait(run.task, 'crashed repeatedly', 'crash-limit', `${run.task} crashed ${ts.crashes} times; look at the run logs`);
      continue;
    }
    if (run.return?.attention === 'needs-human' && run.return.decisions_needed.length) {
      wait(run.task, 'open question', 'question', run.return.decisions_needed[0].question);
      continue;
    }
    if (r.outcome === 'stalled') {
      if (!broken.has('ignore-no-progress')) wait(run.task, 'no progress', 'no-progress', `${run.task}: the last run left the status unchanged; re-plan or take over`);
      continue;
    }
  }

  // ---------------------------------------------------------------- 2. prompts and grants
  for (const p of v.prompts.filter((x) => x.state === 'pending')) {
    if (broken.has('auto-approve-ask')) { api.answerPrompt(p.id, 'approve'); continue; }
    wait(p.task, 'permission prompt', 'prompt', `Answer the permission prompt for \`${p.command}\``, [p.id]);
  }
  for (const g of v.grants) {
    if (v.grantsLive.some((x) => x.id === g.id) || st.grantNoted.has(g.id) || broken.has('act-on-expired-grant')) continue;
    st.grantNoted.add(g.id);
    api.record(g.id, { attention: 'needs-human', summary: `${g.id} lapsed`, next_action: `Renew ${g.id} or take back what it delegated`, item: 'grant' });
  }
  const granted = (action, t) => (broken.has('act-on-expired-grant') ? v.grants.some((g) => hasAction(g, action)) : v.grantHas(action, t));

  // ---------------------------------------------------------------- caps
  function caps(t) {
    if (broken.has('ignore-budget')) return { max_depth: broken.has('nested-helpers') ? Infinity : cfg.max_depth };
    const pol = api.budgets ?? {};
    const raises = v.decisions.filter((d) => d.task === t.id && d.kind === 'budget').reduce((a, d) => a + (d.raise_usd ?? 0), 0);
    const inflightTask = live.filter((s) => s.task === t.id).reduce((a, s) => a + s.caps.max_usd, 0);
    const taskLeft = t.budget?.max_usd != null ? t.budget.max_usd + raises - (v.spend.perTask[t.id] ?? 0) - inflightTask : Infinity;
    const runtimeLeft = cfg.budget_usd - v.spend.total - v.spend.inflightCaps;
    return {
      max_usd: Math.min(pol.max_usd ?? Infinity, taskLeft, runtimeLeft),
      max_turns: Math.min(pol.max_turns ?? Infinity, t.budget?.max_turns ?? Infinity),
      max_depth: broken.has('nested-helpers') ? Infinity : cfg.max_depth,
      binding: taskLeft <= runtimeLeft ? 'budget' : 'spend-limit',
    };
  }
  // A grant that dispatches work caps the workers; a merge-only grant caps nothing it does not run.
  const workerCap = broken.has('unbounded-workers') ? Infinity : Math.min(cfg.max_workers, ...v.grantsLive.filter(dispatches).map((g) => g.limits?.max_workers ?? Infinity));
  let capacity = workerCap - counted.length;
  const affordable = (t) => {
    const c = caps(t);
    if (broken.has('ignore-budget')) return c;
    if (c.max_usd < MIN_RUN_USD) {
      wait(t.id, 'out of budget', c.binding, c.binding === 'budget' ? `${t.id} has spent its budget; raise it or re-plan` : 'The runtime budget is spent; raise it to continue');
      return null;
    }
    const { binding, ...rest } = c;
    return rest;
  };
  const dispatch = (t, mode, extra = {}) => {
    if (capacity <= 0) return false;
    const c = affordable(t);
    if (!c) return false;
    capacity -= 1;
    api.dispatch(t.id, { mode, caps: c, ...extra });
    working(t.id, `${mode} run`);
    return true;
  };
  const evaluate = (t) => {
    if (capacity <= 0) return false;
    const c = affordable(t);
    if (!c) return false;
    capacity -= 1;
    api.evaluate(t.id, { caps: c });
    return true;
  };
  // A task may run again after a ceiling, a stall or a crash limit only once a human decided.
  const gated = (t) => !broken.has('ignore-no-progress') && !broken.has('ignore-budget') && waitingOnHuman(t.id) && T(t.id).waitFor !== 'prompt';

  // Lanes: tasks whose touches overlap run one at a time; a claimed task (or one being claimed by a
  // live run of ours) holds its lane until it merges.
  const occupants = () => v.tasks.filter((t) => CLAIMED.has(t.status) || liveFor(t.id, 'author').length);
  const laneFree = (t, extra = []) => broken.has('overlapping-dispatch') || ![...occupants(), ...extra].some((o) => o.id !== t.id && touchesOverlap(o.touches, t.touches));
  const depsMerged = (t, view = v) => t.depends_on.every((d) => {
    const x = view.tasks.find((y) => y.id === d);
    return x?.status === 'merged' || (x?.status === 'integrated' && (x.epic === t.epic || broken.has('cross-epic-integrated')));
  });

  // ---------------------------------------------------------------- 3. per task, by evidence
  const ordered = [...tasks.values()].sort(byPriority);
  for (const t of ordered) {
    if (st.pending.has(t.id)) continue;
    const ts = T(t.id);
    const p = pr(t.id);
    switch (t.status) {
      case 'review': {
        if (!mine(t) || liveFor(t.id).length || gated(t)) break;
        const checks = p?.checks[p.head];
        if (!p || checks === undefined) break;
        if (checks === 'red') {
          if (ts.ciHead !== p.head) { ts.ciHead = p.head; ts.ci += 1; }
          if (ts.ci > cfg.max_ci_rounds) wait(t.id, 'checks keep failing', 'ci-limit', `${t.id}: checks failed ${ts.ci} times; look at the failures`);
          else dispatch(t, 'fix');
          break;
        }
        const review = reviewOf(p);
        if (!review && !broken.has('skip-evaluator') && !broken.has('finalize-unverified')) { evaluate(t); break; }
        if (review?.verdict === 'changes-requested') {
          if (ts.roundHead !== p.head) { ts.roundHead = p.head; ts.rounds += 1; }
          if (ts.rounds > cfg.max_review_rounds) wait(t.id, 'review keeps failing', 'review-limit', `${t.id}: ${ts.rounds} review rounds failed; re-plan the criteria`);
          else dispatch(t, 'fix');
          break;
        }
        const ret = lastReturn(t.id);
        if (!covered(t, p) || !ret || ret.head !== p.head || ret.criteria.unmet.length) { dispatch(t, 'fix'); break; }
        if (granted('finalize', t)) commit(t, { transition: 'mark-pr-ready', to: 'human-review', prReady: true });
        else dispatch(t, 'finalize');
        break;
      }
      case 'human-review': {
        if (t.lastTransition === 'return-to-human' || !p) break;
        const review = reviewOf(p);
        const independent = review?.verdict === 'pass' && review.by !== p.author;
        const mayMerge = broken.has('merge-without-grant') || granted('merge', t);
        if (mayMerge && (independent || broken.has('skip-evaluator')) && p.checks[p.head] === 'green') commit(t, { transition: 'approve-pr', to: 'merging', prApproval: true });
        break;
      }
      case 'merging': {
        if (broken.has('land-directly') && p && !p.merged) { api.land(t.id); break; }
        // A branch the merge queue serves is the queue's; one it does not is landed by the holder of a
        // merge grant for exactly that branch (tier 2), one change at a time.
        const target = t.lands_to ?? v.protectedBranch;
        const mayLand = broken.has('land-without-grant') || (!v.queueServes(target) && granted('merge', t));
        if (mayLand && !v.merging) api.merge(t.id);
        break;
      }
      case 'integrated':
        if (!ts.integratedRecorded) { ts.integratedRecorded = true; api.record(t.id, { attention: 'complete', summary: `integrated on ${t.lands_to}` }); }
        break;
      case 'in-progress': {
        if (!mine(t) || liveFor(t.id, 'author').length || gated(t)) break;
        if (ts.crashes > cfg.max_crash_restarts && !decidedSince(t.id, ts.waitSince ?? 0)) break;
        dispatch(t, 'work');
        break;
      }
      case 'needs-input': {
        if (!mine(t) || liveFor(t.id, 'author').length) break;
        if (decidedSince(t.id, t.changedAt) && laneFree(t)) dispatch(t, 'work');
        else if (!decidedSince(t.id, t.changedAt) && ts.waitFor !== 'question') wait(t.id, 'open question', 'question', `Answer the open question on ${t.id}`);
        break;
      }
      case 'merged':
        if (!ts.completeRecorded) { ts.completeRecorded = true; api.record(t.id, { attention: 'complete', summary: 'merged' }); }
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- 4. dispatch ready work
  const claiming = [];
  for (const t of ordered.filter((x) => x.status === 'ready' && x.owner === null)) {
    if (capacity <= 0) break;
    if (st.pending.has(t.id) || liveFor(t.id, 'author').length || gated(t)) continue;
    const parkedDep = t.depends_on.map((d) => tasks.get(d)).find((d) => d && ['suspended', 'spec-draft'].includes(d.status));
    if (parkedDep) { wait(t.id, 'dependency parked', 'dependency', `${t.id} waits on ${parkedDep.id}, which is ${parkedDep.status}`); continue; }
    if (!depsMerged(t)) continue;
    if (api.tier === 'unattended' && (t.risk.level === 'high' || t.risk.irreversible)) { wait(t.id, 'high risk', 'risk', `${t.id} is high-risk; run it supervised or approve it`); continue; }
    if (!laneFree(t, claiming)) continue;
    const ok = dispatch(t, 'work', {
      claimable: (view, id) => {
        const x = view.tasks.find((y) => y.id === id);
        return depsMerged(x, view) && (broken.has('overlapping-dispatch') || !view.tasks.some((o) => o.id !== id && CLAIMED.has(o.status) && touchesOverlap(o.touches, x.touches)));
      },
    });
    if (ok) claiming.push(t);
  }

  // A task whose run is going again after a prompt is working again.
  for (const s of live.filter((x) => x.kind === 'author' && x.state === 'running')) {
    if (T(s.task).waitFor === 'prompt' && !v.prompts.some((x) => x.task === s.task && x.state === 'pending')) working(s.task, 'resumed after the prompt');
  }
}

const hasAction = (g, action) => g.actions.some((a) => (typeof a === 'string' ? a : a.action) === action);
