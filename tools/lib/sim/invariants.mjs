import { registry as sharedRegistry } from '../registry.mjs';
import { grantHas, landingTarget } from './authority.mjs';
import { isHuman } from './machines.mjs';
import { touchesOverlap } from './util.mjs';
import { RUNTIME_SIGNALS, ruleMatches } from './world.mjs';

// The invariants checked after every event (and once at the end). Each is named, says which
// contract rule it holds the world to, and reports { invariant, index, at, task, message } so a
// violation reproduces from the seed and the event index. Transition tables, roles, gates, guards,
// side states and claimed statuses come from state-machines/*.yaml and the task schema.

export const INVARIANTS = {
  'one-owner-per-claimed-task': 'A claimed task has exactly one owner, set by a compare-and-swap claim; one author session at a time works it, and only its owner commits to it (workflow: claim-is-compare-and-swap; playbook: single-writer).',
  'transitions-allowed': 'Every status change is a transition in workflow.yaml, from its from-state, by a role its `by` lists (or the orchestrator under a live grant naming the transition\'s `grant`), with a reason where it needs one; human roles are humans; owner changes only by a claim or a human (workflow: transitions-are-commits).',
  'guards-hold': 'Every guard of the transition holds on the evidence when it is applied (deps-merged, with an integrated dependency counting only in the same epic; owner-free, draft-pr-open, checks-green, criteria-met, criteria-named-in-tests, pr-ready, independent-review, independent-verification for risk medium and up, lands-on-protected, lands-on-integration, mechanical-only, merged-checks-green, integration-landed, question-answered); a grant adds its grant_guards (workflow guards; authority: finalize, merge).',
  'human-gates-by-humans': 'A gate transition (workflow.yaml gates) is made by a human approver, or, where the gate is grantable, by the orchestrator under a live grant of that action (authority.yaml).',
  'signals-never-advance-workflow': 'A commit decided on a runtime signal (agent state, CI result, events-lost notice) is still one the evidence and the actor\'s authority justify on their own; a wake is a hint (attention.yaml: signals-never-advance-workflow).',
  'attention-consistent': 'Task records carry attention only (working, needs-human, complete); needs-human names the next action; complete names none and is recorded only once the evidence shows nothing is left for the human (attention.yaml: idle-is-not-complete).',
  'merge-requires-authority': 'A change lands on a branch (the protected target, or an epic\'s integration branch) only by the merge role, a human, or the orchestrator under a merge grant live when it decided for that exact branch; an agent lands only together with its land or integrate commit and after checks on the merged result of that head; with an approval of the landed head by a human or by the orchestrator under such a grant, an independent passing review of that head and green checks; never over a semantic conflict or red merged checks (authority.yaml merge; playbook: landing-changes).',
  'lanes-disjoint': 'Claimed tasks (in-progress through merging) never have overlapping touches: overlapping tasks are one lane and run in sequence (playbook: single-writer).',
  'cap-workers': 'Live workers per runtime never exceed the supervisor\'s max_workers, nor a live grant\'s limits.max_workers (playbook: budgets-and-routing).',
  'cap-depth': 'No helper is spawned below the delegation depth cap; helpers do not spawn helpers by default (playbook: topologies).',
  'cap-run': 'Every run is dispatched with a turn and a spend cap within the policy\'s budgets, and the runner stops it there (HAR-3).',
  'cap-spend': 'Spend per task stays within its budget (plus human raises) and the runtime\'s total within its budget or grant (playbook: budgets-and-routing).',
  'no-progress-stops': 'After a run that made no progress or hit a ceiling, the task is not run again until a human decides (playbook: budgets-and-routing; attention.yaml: error_max_turns "never retry blindly").',
  'merged-criteria-covered': 'A merged task has every acceptance criterion named by a passing test on the landed head (workflow guard criteria-named-in-tests; the trace graph).',
  'asks-surface-to-human': 'A permission prompt is answered only by a human; in the unattended tier an ask is a denial, never an approval; every prompt and denial reaches the human as needs-human naming it (authority.yaml never_grantable: answer-permission-prompt; ADR-0021).',
  'walls-block': 'No command a forbid rule matches ever runs, in any tier, bypass included (playbook: permissions-and-autonomy).',
  'stalls-surface': 'When nothing more will happen, every unfinished task is parked by a human (suspended, spec-draft, needs-input, blocked) or its record says needs-human with no human decision since; nothing is left "working" with nobody acting (attention.yaml: coalesced-and-lossy, reconcile).',
  'contracts-valid': 'Every run-record line, return, grant and task record the simulation produced validates against its contract.',
};

// Guards the simulator does not model (planning-time and release guards): never failed here.
const UNMODELED = new Set(['epic-approved', 'criteria-ears', 'no-blocking-question', 'requirements-cited', 'dependency-cleared', 'all-tasks-merged', 'acceptance-met', 'stage-checks-green']);
const PARKED = new Set(['suspended', 'spec-draft', 'needs-input', 'blocked']);
const DONE_FOR_HUMAN = new Set(['human-review', 'merging', 'integrated', 'merged']);
const RISKY = new Set(['medium', 'high']);

export class Checker {
  constructor({ machines, registry = sharedRegistry(), only = null } = {}) {
    this.m = machines;
    this.registry = registry;
    this.only = only ? new Set(only) : null;
    this.violations = [];
    this.seen = new Set();
    this.lastDecisionAt = new Map();
  }

  report(w, ev, invariant, task, message, key = null) {
    if (this.only && !this.only.has(invariant)) return;
    const k = key ? `${invariant}|${key}` : null;
    if (k && this.seen.has(k)) return;
    if (k) this.seen.add(k);
    const v = { invariant, seed: w.seed, index: ev.index, at: w.iso(ev.at), task: task ?? null, message };
    this.violations.push(v);
    ev.violations.push(v);
  }

  // ------------------------------------------------------------------------------ evidence

  guardHolds(w, guard, c, before) {
    const t = w.forge.tasks.get(c.task);
    const m = w.meta.get(c.task);
    const pr = w.forge.prs.get(c.task);
    const head = pr?.head;
    const review = pr ? [...pr.reviews].reverse().find((r) => r.head === head) : null;
    switch (guard) {
      case 'deps-merged': return m.spec.depends_on.every((d) => {
        const st = w.forge.tasks.get(d)?.status;
        return st === 'merged' || (st === 'integrated' && w.meta.get(d).spec.epic === m.spec.epic);
      });
      case 'owner-free': return before.owner === null || c.actorKind === 'human';
      case 'draft-pr-open': return Boolean(pr);
      case 'checks-green': return pr?.checks.get(head) === 'green';
      case 'criteria-met': return Boolean(m.lastReturn) && m.lastReturn.head === head && m.lastReturn.criteria.unmet.length === 0;
      case 'criteria-named-in-tests': return Boolean(pr) && m.spec.criteria.every((ac) => pr.coverage.get(head)?.has(ac));
      case 'pr-ready': return Boolean(pr?.ready);
      case 'independent-review': return review?.verdict === 'pass' && review.by !== pr.author;
      case 'independent-verification': {
        if (!RISKY.has(m.spec.risk.level) && !m.spec.risk.irreversible) return true;
        const verdict = pr ? [...pr.reviews].reverse().find((r) => r.head === head && r.role === 'evaluator') : null;
        return verdict?.verdict === 'pass' && verdict.by !== pr.author;
      }
      case 'lands-on-protected': return landingTarget(w.sc, m.spec) === w.sc.target;
      case 'lands-on-integration': return landingTarget(w.sc, m.spec) !== w.sc.target;
      case 'integration-landed': return w.forge.target.landed.includes(c.task);
      case 'mechanical-only': return w.merge.state.get(c.task)?.conflict !== 'semantic';
      case 'merged-checks-green': return w.merge.state.get(c.task)?.mergedChecks === 'green';
      case 'question-answered': return m.questionAnswered || w.forge.decisions.some((d) => d.task === c.task && d.kind === 'question');
      default: return UNMODELED.has(guard) || Boolean(t);
    }
  }

  // [problems] for one applied commit: authorization and guards, as transitions-allowed /
  // guards-hold / human-gates-by-humans would name them.
  judgeCommit(w, entry) {
    const { commit: c, before, after } = entry;
    const out = [];
    const T = this.m.transitions.get(c.transition);
    const task = w.meta.get(c.task).spec;
    if (!T) return [{ invariant: 'transitions-allowed', message: `${c.transition} is not a transition of the task machine` }];
    if (!T.from.includes(before.status)) out.push({ invariant: 'transitions-allowed', message: `${c.transition} from ${before.status} (allowed from ${T.from.join(', ')})` });
    const to = T.to === '$prior' ? before.prior : T.to;
    if (after.status !== to) out.push({ invariant: 'transitions-allowed', message: `${c.transition} must lead to ${to}, led to ${after.status}` });
    const viaGrant = c.role === 'orchestrator' && T.grant && c.grantLive && grantHas(c.grantSnapshot, T.grant, w.sc, task);
    if (!T.by.includes(c.role) && !viaGrant) {
      out.push({ invariant: 'transitions-allowed', message: `${c.actor} (${c.role}) made ${c.transition}; by: ${T.by.join(', ')}${T.grant ? `, or the orchestrator under a live ${T.grant} grant${c.role === 'orchestrator' ? ` (${c.grant ? 'grant does not cover it' : c.grantSnapshot ? 'grant not live when it decided' : 'no grant'})` : ''}` : ''}` });
    }
    if (isHuman(this.m, c.role) !== (c.actorKind === 'human')) out.push({ invariant: 'transitions-allowed', message: `${c.actor} is ${c.actorKind === 'human' ? 'a human' : 'an agent'} acting as ${c.role}` });
    if (T.reason && !c.reason) out.push({ invariant: 'transitions-allowed', message: `${c.transition} needs a reason` });
    if (after.owner !== before.owner && !(c.transition === 'claim' && after.owner === c.actor) && c.actorKind !== 'human') {
      out.push({ invariant: 'transitions-allowed', message: `${c.actor} changed the owner ${before.owner} → ${after.owner}` });
    }
    const guards = [...T.guards, ...(viaGrant ? T.grant_guards : [])];
    // authority.yaml finalize: "once the current head passed an independent review".
    if (viaGrant && T.grant === 'finalize') guards.push('independent-review');
    for (const g of new Set(guards)) if (!this.guardHolds(w, g, c, before)) out.push({ invariant: 'guards-hold', message: `${c.transition}: guard ${g} does not hold${viaGrant ? ' (exercised under a grant)' : ''}` });
    const gate = T.gate ? this.m.gates[T.gate] : null;
    if (gate) {
      const human = c.actorKind === 'human' && gate.approver.includes(c.role);
      const granted = gate.grantable && gate.grantable === T.grant && viaGrant;
      if (!human && !granted) out.push({ invariant: 'human-gates-by-humans', message: `gate ${T.gate} (${c.transition}) passed by ${c.actor} (${c.actorKind} ${c.role})${gate.grantable ? ` without a live ${gate.grantable} grant` : ''}` });
    }
    return out;
  }

  // ------------------------------------------------------------------------------ per event

  afterEvent(w, ev) {
    const sc = w.sc;
    const m = this.m;

    for (const entry of ev.commits) {
      const { commit: c, before, after } = entry;
      const problems = this.judgeCommit(w, entry);
      for (const p of problems) this.report(w, ev, p.invariant, c.task, `${c.id}: ${p.message}`);
      if (c.trigger && RUNTIME_SIGNALS.has(c.trigger.kind) && problems.length) {
        this.report(w, ev, 'signals-never-advance-workflow', c.task, `${c.id} ${c.transition} (${before.status} → ${after.status}) was decided on a ${c.trigger.kind}${c.trigger.value ? ` "${c.trigger.value}"` : ''} wake without the evidence or authority it needs`);
      }
      if (c.transition === 'claim' && (before.status !== 'ready' || before.owner !== null)) {
        this.report(w, ev, 'one-owner-per-claimed-task', c.task, `${c.id}: ${c.actor} claimed ${c.task} while it was ${before.status} owned by ${before.owner}`);
      }
      if (c.session && c.transition !== 'claim' && before.owner !== c.actor) {
        this.report(w, ev, 'one-owner-per-claimed-task', c.task, `${c.id}: ${c.actor} committed ${c.transition} to a task owned by ${before.owner}`);
      }
      if (c.actorKind === 'human') this.lastDecisionAt.set(c.task, ev.at);
      if (after.status === 'merged' || after.status === 'integrated') {
        const pr = w.forge.prs.get(c.task);
        const missing = w.meta.get(c.task).spec.criteria.filter((ac) => !pr?.coverage.get(pr.head)?.has(ac));
        if (missing.length) this.report(w, ev, 'merged-criteria-covered', c.task, `${c.task} merged with no test naming ${missing.join(', ')}`);
      }
    }

    for (const l of ev.lands) {
      if (!l.admitted) continue;
      const why = [];
      const pr = w.forge.prs.get(l.task);
      const spec = w.meta.get(l.task).spec;
      const human = isHuman(m, l.role) && l.actorKind === 'human';
      const grantCovers = (g) => grantHas(g, 'merge', sc, spec);
      if (l.role === 'orchestrator') {
        if (!l.grantSnapshot) why.push(`landed by ${l.by} (orchestrator) with no grant`);
        else if (!l.grantLive) why.push(`landed by ${l.by} under ${l.grantSnapshot.id}, which was not live when it decided`);
        else if (!grantCovers(l.grantSnapshot)) why.push(`landed by ${l.by} under ${l.grantSnapshot.id}, which does not delegate merge for ${sc.repo} → ${l.target} by ${sc.strategy}`);
      } else if (!(l.role === 'merge' || human)) why.push(`landed by ${l.by} (${l.role}${l.injected ? ', an agent attempting its own merge' : ''})`);
      // An agent lands with its status commit and only after the checks on the merged result of that
      // head; a human's merge is recorded by a commit that follows (promote).
      if (!human) {
        if (!ev.commits.some((e) => e.commit.task === l.task && ['land', 'integrate'].includes(e.commit.transition))) why.push('landed without its land or integrate commit');
        if (!l.mergeState || l.mergeState.head !== l.head) why.push('no checks on the merged result of the landed head');
        else if (l.mergeState.conflict === 'semantic' || l.mergeState.mergedChecks !== 'green') why.push(`landed over ${l.mergeState.conflict === 'semantic' ? 'a semantic conflict' : 'red checks on the merged result'}`);
      }
      const a = l.approval;
      if (!a || a.head !== l.head) why.push('no approval of the landed head');
      else if (a.actorKind !== 'human') {
        const g = a.grantSnapshot;
        if (a.role !== 'orchestrator' || !g) why.push(`approved by ${a.by} (${a.role}) with no grant`);
        else {
          if (!a.grantLive) why.push(`approved under ${g.id}, which was not live when it decided`);
          if (!grantCovers(g)) why.push(`${g.id} does not delegate merge for ${sc.repo} → ${landingTarget(sc, spec)} by ${sc.strategy}`);
          // authority.yaml grantable.merge.always_requires, whatever the grant itself lists.
          const review = [...pr.reviews].reverse().find((r) => r.head === l.head);
          const evidence = { 'independent-review': review?.verdict === 'pass' && review.by !== pr.author, 'required-checks': pr.checks.get(l.head) === 'green' };
          for (const req of m.mergeRequires) if (!evidence[req]) why.push(`${req} missing for the landed head`);
        }
      }
      if (pr?.checks.get(l.head) !== 'green') why.push('checks are not green on the landed head');
      if (why.length) this.report(w, ev, 'merge-requires-authority', l.task, `${l.task}@${l.head} → ${l.target}: ${why.join('; ')}`);
      const missing = spec.criteria.filter((ac) => !l.coverage.includes(ac));
      if (missing.length) this.report(w, ev, 'merged-criteria-covered', l.task, `${l.task}@${l.head} landed with no test naming ${missing.join(', ')}`, `land-${l.task}-${l.head}-${l.target}`);
    }

    // Claimed tasks: one owner, one writer, disjoint lanes.
    const claimed = [...w.forge.tasks.values()].filter((t) => m.claimed.has(t.status));
    for (const t of claimed) if (!t.owner) this.report(w, ev, 'one-owner-per-claimed-task', t.id, `${t.id} is ${t.status} with no owner`, `noowner-${t.id}-${t.status}`);
    const authors = new Map();
    // Sessions racing for a claim are fine (the compare-and-swap decides); two that each hold it are not.
    for (const s of w.sessions.values()) {
      if (s.kind !== 'author' || !s.claimed || !(s.state === 'running' || s.state === 'blocked')) continue;
      if (!authors.has(s.task)) authors.set(s.task, []);
      authors.get(s.task).push(s);
    }
    for (const [task, list] of authors) if (list.length > 1) this.report(w, ev, 'one-owner-per-claimed-task', task, `${list.length} author sessions work ${task} at once (${list.map((s) => `${s.id}/${s.owner}`).join(', ')})`, `writers-${task}-${list.map((s) => s.id).join(',')}`);
    for (let i = 0; i < claimed.length; i += 1) {
      for (let j = i + 1; j < claimed.length; j += 1) {
        const a = w.meta.get(claimed[i].id).spec;
        const b = w.meta.get(claimed[j].id).spec;
        if (touchesOverlap(a.touches, b.touches)) this.report(w, ev, 'lanes-disjoint', a.id, `${a.id} (${claimed[i].status}) and ${b.id} (${claimed[j].status}) are both claimed and their touches overlap`, `lane-${[a.id, b.id].sort().join('-')}`);
      }
    }

    // Caps.
    const ms = w.startMs + ev.at * 60000;
    for (const rt of w.runtimes.values()) {
      const live = [...w.sessions.values()].filter((s) => s.runtime === rt.name && (s.kind === 'author' || s.kind === 'evaluator') && (s.state === 'running' || s.state === 'blocked'));
      const grantLive = rt.grant && Date.parse(rt.grant.granted_at) <= ms && ms < Date.parse(rt.grant.expires_at);
      const cap = Math.min(sc.supervisor.max_workers, grantLive ? rt.grant.limits?.max_workers ?? Infinity : Infinity);
      if (live.length > cap) this.report(w, ev, 'cap-workers', null, `${rt.name}: ${live.length} live workers, cap ${cap}`, `workers-${rt.name}-${ev.index}`);
      const total = rt.spend.total;
      if (total > sc.supervisor.budget_usd + 1e-6) this.report(w, ev, 'cap-spend', null, `${rt.name} spent $${total.toFixed(2)} of a $${sc.supervisor.budget_usd} budget`, `spend-${rt.name}`);
      for (const [task, usd] of rt.spend.perTask) {
        const b = w.meta.get(task).spec.budget?.max_usd;
        if (b == null) continue;
        const raises = w.forge.decisions.filter((d) => d.task === task && d.kind === 'budget').reduce((x, d) => x + (d.raise_usd ?? 0), 0);
        if (usd > b + raises + 1e-6) this.report(w, ev, 'cap-spend', task, `${task} spent $${usd.toFixed(2)} of $${b}${raises ? ` + $${raises} raised` : ''}`, `taskspend-${task}`);
      }
    }
    for (const s of w.sessions.values()) {
      if (s.kind === 'helper' && s.startedAt === ev.at && s.depth > sc.supervisor.max_depth) this.report(w, ev, 'cap-depth', s.task, `${s.id} spawned at depth ${s.depth}; cap ${sc.supervisor.max_depth}`, `depth-${s.id}`);
    }
    const budgets = sc.policy.budgets ?? {};
    for (const d of ev.dispatches) {
      const s = w.sessions.get(d.session);
      const bad = [];
      if (budgets.max_turns !== undefined && !(s.caps.max_turns <= budgets.max_turns)) bad.push(`max_turns ${s.caps.max_turns} (policy ${budgets.max_turns})`);
      if (budgets.max_usd !== undefined && !(s.caps.max_usd <= budgets.max_usd)) bad.push(`max_usd ${s.caps.max_usd} (policy ${budgets.max_usd})`);
      if (!Number.isFinite(s.caps.max_turns) || !Number.isFinite(s.caps.max_usd)) bad.push('a run without a turn or spend cap');
      if (bad.length) this.report(w, ev, 'cap-run', d.task, `${d.session} (${d.kind}) dispatched with ${bad.join(', ')}`);
      if (d.kind === 'author') {
        const key = `${d.runtime}:${d.task}`;
        const humanAt = Math.max(this.lastDecisionAt.get(d.task) ?? -1, w.human.lastDecision.get(d.task) ?? -1);
        const stall = w.stalls.get(key);
        if (stall && stall.count >= sc.supervisor.no_progress_runs && humanAt < stall.at) this.report(w, ev, 'no-progress-stops', d.task, `${d.session} dispatched after a run that made no progress (t=${stall.at.toFixed(1)}), with no human decision since`);
        const ceil = w.ceilings.get(key);
        if (ceil !== undefined && humanAt < ceil) this.report(w, ev, 'no-progress-stops', d.task, `${d.session} dispatched after a run hit its ceiling (t=${ceil.toFixed(1)}), with no human decision since`);
      }
    }
    for (const s of ev.ended) {
      if (s.usd > s.caps.max_usd + 1e-6 || s.turns > s.caps.max_turns) this.report(w, ev, 'cap-run', s.task, `${s.id} spent $${s.usd} in ${s.turns} turns past its caps ($${s.caps.max_usd}, ${s.caps.max_turns})`);
    }

    // Attention.
    for (const r of ev.records) {
      const a = r.after.attention;
      if (!['working', 'needs-human', 'complete'].includes(a)) this.report(w, ev, 'attention-consistent', r.task, `attention "${a}" is not an attention state`);
      if (a === 'needs-human' && !r.after.next_action) this.report(w, ev, 'attention-consistent', r.task, 'needs-human without a next action');
      if (a === 'complete' && r.after.next_action) this.report(w, ev, 'attention-consistent', r.task, 'complete with a next action');
      if (a === 'complete' && w.forge.tasks.has(r.task) && !DONE_FOR_HUMAN.has(r.status)) this.report(w, ev, 'attention-consistent', r.task, `complete recorded while ${r.task} is ${r.status}`);
    }

    // Prompts.
    const deadline = 2 * sc.supervisor.checkin_minutes + 1;
    for (const p of w.prompts.values()) {
      for (const a of p.answers ?? []) {
        if (a.kind !== 'human' && !a.reported) { a.reported = true; this.report(w, ev, 'asks-surface-to-human', p.task, `${p.id} (${p.command}) answered "${a.decision}" by ${a.by}, an agent`); }
      }
      if (p.tier === 'unattended' && p.state === 'approved') this.report(w, ev, 'asks-surface-to-human', p.task, `${p.id} (${p.command}) approved in the unattended tier`, `unattended-${p.id}`);
      if (p.read && !p.surfaced) this.report(w, ev, 'asks-surface-to-human', p.task, `${p.id} (${p.command}, ${p.state}) was read by the supervisor and not surfaced as needs-human`, `read-${p.id}`);
      if (p.state === 'pending' && !p.surfaced && ev.at - p.at > deadline) this.report(w, ev, 'asks-surface-to-human', p.task, `${p.id} (${p.command}) pending ${Math.round(ev.at - p.at)} min with no needs-human record`, `late-${p.id}`);
    }
    for (const x of ev.executed) {
      const wall = sc.policy.forbid.find((r) => ruleMatches(r, x.argv));
      if (wall) this.report(w, ev, 'walls-block', x.task, `\`${x.argv.join(' ')}\` ran in tier ${sc.policy.tier} although forbid ${JSON.stringify(wall.command)} matches it`);
      const ask = sc.policy.ask.find((r) => ruleMatches(r, x.argv));
      if (ask && !x.approvedBy) this.report(w, ev, 'asks-surface-to-human', x.task, `\`${x.argv.join(' ')}\` ran without a human answering its ask`);
    }
  }

  // ------------------------------------------------------------------------------ at the end

  atEnd(w) {
    const ev = w.ev;
    if (!w.cut) {
      for (const t of w.forge.tasks.values()) {
        if (t.status === 'merged' || PARKED.has(t.status)) continue;
        // A task a human holds (an owner no runtime runs as) is the human's to move: humans win.
        if (t.owner && !w.coders.has(t.owner)) continue;
        const recs = [...w.runtimes.values()].map((rt) => rt.records.get(t.id)).filter(Boolean);
        const waiting = recs.some((r) => r.attention === 'needs-human' && !(Math.max(this.lastDecisionAt.get(t.id) ?? -1, w.human.lastDecision.get(t.id) ?? -1) > Date.parse(r.updated_at) / 60000 - w.startMs / 60000 + 1e-9));
        if (!waiting) this.report(w, ev, 'stalls-surface', t.id, `${t.id} ends ${t.status}${t.owner ? ` (owner ${t.owner})` : ''} with nothing in flight and no needs-human record awaiting a human`);
      }
      for (const p of w.prompts.values()) if ((p.state === 'pending' || (p.state === 'denied' && p.answeredKind === 'policy')) && !p.surfaced) this.report(w, ev, 'asks-surface-to-human', p.task, `${p.id} (${p.command}, ${p.state}) never reached the human`, `end-${p.id}`);
    }
    this.contracts(w, ev);
  }

  contracts(w, ev) {
    const check = (contract, data, what) => {
      const v = this.registry.validator(contract);
      if (!v(data)) this.report(w, ev, 'contracts-valid', data.task ?? data.task_id ?? null, `${what} fails ${contract}: ${v.errors.slice(0, 2).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`, `${contract}-${what}`);
      const ruleChecks = { 'run-record': (d) => Date.parse(d.ended_at) >= Date.parse(d.started_at) };
      if (ruleChecks[contract] && !ruleChecks[contract](data)) this.report(w, ev, 'contracts-valid', data.task, `${what}: ended before it started`, `${contract}-order-${what}`);
    };
    w.artifacts.runRecords.forEach((r, i) => check('run-record', r, `run-record ${i}`));
    w.artifacts.returns.forEach((r, i) => check('return', r, `return ${i}`));
    w.artifacts.grants.forEach((g) => check('grant', g, g.id));
    for (const rec of exportTaskRecords(w)) check('task-record', rec, `task-record ${rec.task_id}`);
  }
}

// The runtime's task records in the task-record contract's shape.
export function exportTaskRecords(w) {
  const out = [];
  for (const rt of w.runtimes.values()) {
    for (const [id, r] of rt.records) {
      if (!w.forge.tasks.has(id)) continue;
      const state = { name: r.attention, summary: r.summary || r.attention };
      if (r.attention !== 'complete' && r.next_action) state.next_action = r.next_action;
      const rec = { task_id: id, runtime: rt.name, objective: w.meta.get(id).spec.title, state, updated_at: r.updated_at };
      if (rt.grant) rec.grant = rt.grant.id;
      const signals = Object.fromEntries(Object.entries(r.signals).map(([role, s]) => [role, s]));
      if (Object.keys(signals).length) rec.signals = signals;
      out.push(rec);
    }
  }
  return out;
}
