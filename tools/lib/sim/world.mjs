import { grantHas, grantLiveAt, landingTarget } from './authority.mjs';
import { Heap, makeRng, round } from './util.mjs';

// The simulated world: everything except the supervisor policy under test.
//
//   forge      task files on one shared ref with compare-and-swap pushes (a push whose base is not
//              the ref's head is rejected, as git rejects a non-fast-forward push; the actor re-pulls
//              and re-validates), pull requests with heads, check runs, reviews and approvals, a
//              protected target branch and per-epic integration branches (a task's lands_to), each
//              admitting a merge only with an approval for the head.
//   runtime    per runtime: sessions (authors, evaluators, their helpers), the runner's per-run caps,
//              the engine's permission decisions, Herdr-style signals (lossy, duplicable), task records.
//   actors     authors (coder role), evaluators (evaluator role), CI, the merge queue (merge role,
//              for the branches it serves), the orchestrator's own merge under a merge grant, and the
//              human (owner role, who also merges an integration branch into the target), each with
//              seeded latencies and scripted behaviour.
//
// A status changes only by a commit the forge accepts; nothing here moves a status on a signal. The
// supervisor sees a snapshot (its pull) and acts through the api: dispatch, evaluate, commit (as
// orchestrator), record attention, consume run results. Everything it does is checked afterwards.

export const RUNTIME_SIGNALS = new Set(['signal', 'ci', 'notice']);
// A session's kind as a run record names its role: an evaluator's run ends in a verdict.
const RUN_ROLE = { author: 'author', evaluator: 'evaluator', helper: 'reader' };

const argvMatches = (rule, argv) => rule.command.length <= argv.length && rule.command.every((tok, i) => [].concat(tok).includes(argv[i]));
export const ruleMatches = argvMatches;

// The engine's permission decision for one command: deny beats ask beats allow (adapters/*), and a
// deny holds in every tier, bypass included (ADR-0021). "bypass-skips-walls" is the broken binding
// the walls-block invariant must catch: the disableAllHooks case, where bypass runs everything.
export const ENGINES = {
  correct(tier, argv, policy) {
    if (policy.forbid.some((r) => argvMatches(r, argv))) return 'deny';
    if (policy.ask.some((r) => argvMatches(r, argv))) return 'ask';
    return 'allow';
  },
  'bypass-skips-walls'(tier, argv, policy) {
    if (tier === 'autonomous') return 'allow';
    return ENGINES.correct(tier, argv, policy);
  },
};

export class World {
  constructor(sc, { seed, machines, policies, engine = 'correct', forgeProtection = true, cas = true, mergeBot = 'correct', trace = true }) {
    this.sc = sc;
    this.m = machines;
    this.seed = seed;
    this.rng = makeRng((Number(sc.seed) * 1000003) ^ Number(seed));
    this.startMs = Date.parse(sc.start);
    this.t = 0;
    this.heap = new Heap();
    this.seq = 0;
    this.index = 0;
    this.engine = typeof engine === 'function' ? engine : ENGINES[engine];
    if (!this.engine) throw new Error(`unknown engine ${engine}`);
    this.forgeProtection = forgeProtection;
    // World breakages for the mutation tests: a forge that accepts a push whatever its base (no
    // compare-and-swap), and a merge queue that lands over semantic conflicts and red merged checks.
    this.cas = cas;
    this.mergeBot = mergeBot;
    this.traceOn = trace;
    this.trace = [];
    this.stats = { pushesRejected: 0, claimsLost: 0, signalsLost: 0, notices: 0, duplicates: 0, wallsBlocked: 0, landsRejected: 0, mergesLanded: 0, humanActions: 0, needsHuman: 0, prompts: 0, denials: 0, crashes: 0, helpersRefused: 0 };
    this.commitSeq = 0;
    this.sessionSeq = 0;
    this.promptSeq = 0;
    this.prSeq = 0;
    this.artifacts = { runRecords: [], returns: [], grants: [] };

    this.forge = { version: 0, tasks: new Map(), prs: new Map(), decisions: [], target: { name: sc.target, version: 0, landed: [] }, branches: new Map() };
    this.forge.branches.set(sc.target, this.forge.target);
    this.meta = new Map();
    for (const t of sc.tasks) {
      this.forge.tasks.set(t.id, { id: t.id, status: t.status, owner: t.owner, prior: null, kickback_reason: null, lastTransition: null, changedAt: 0 });
      const factor = sc.faults.budget_exhaustion?.tasks.includes(t.id) ? sc.faults.budget_exhaustion.factor : 1;
      this.meta.set(t.id, { spec: t, workTotal: this.rng.between(sc.work.minutes[t.size]) * factor, workDone: 0, lastReturn: null, crashes: 0, asked: false, askResolved: false, questionAsked: false, questionAnswered: false, mergeAttempted: false, rejections: 0, spend: 0, runs: 0 });
    }
    // A project queue may start mid-flight: tasks already in review or later get a PR with green
    // checks, a passing review and full coverage, as their status claims.
    for (const t of sc.tasks.filter((x) => ['review', 'human-review', 'merging', 'integrated'].includes(x.status))) {
      const head = this.rng.hex(7);
      const pr = this.newPr(t.id, t.owner ?? 'unknown', head);
      pr.checks.set(head, 'green');
      pr.coverage.set(head, new Set(t.criteria));
      pr.reviews.push({ head, verdict: 'pass', by: 'prior-reviewer', role: 'evaluator', at: 0 });
      if (t.status !== 'review') pr.ready = true;
      if (['merging', 'integrated'].includes(t.status)) pr.approval = { head, by: 'prior-human', actorKind: 'human', role: 'owner', grant: null, at: 0 };
      if (t.status === 'integrated') {
        const branch = this.branchOf(t.id);
        pr.merged = { head, at: 0, version: (branch.version += 1), target: branch.name };
        branch.landed.push(t.id);
      }
      this.meta.get(t.id).lastReturn = { head, criteria: { met: [...t.criteria], unmet: [] } };
    }

    this.sessions = new Map();
    this.prompts = new Map();
    this.executed = [];
    this.runtimes = new Map();
    const rival = sc.faults.concurrent_claims;
    const names = rival ? ['main', 'rival'] : ['main'];
    for (const name of names) {
      const prefix = name === 'main' ? 'sim' : 'rival';
      const factory = policies[name] ?? policies.main;
      const grant = name === 'main' && sc.grant ? structuredClone(sc.grant) : null;
      if (grant) this.artifacts.grants.push(structuredClone(grant));
      this.runtimes.set(name, {
        name,
        coder: `${prefix}-coder`,
        evaluator: `${prefix}-evaluator`,
        policy: factory({ runtime: name, sc }),
        grant,
        records: new Map(),
        spend: { total: 0, perTask: new Map() },
        consumed: new Set(),
        noticePending: false,
        startAt: name === 'main' ? 0 : rival.start_minutes,
      });
    }
    this.coders = new Map([...this.runtimes.values()].map((r) => [r.coder, r]));
    // Owners a project queue already carries (agents of an earlier run) are adopted by the main runtime.
    // A project queue may carry the owners of an earlier run; adopt_owners hands those claims to the
    // main runtime's coder, so the simulation resumes them instead of leaving them to a human.
    if (sc.adopt_owners) for (const t of this.forge.tasks.values()) if (t.owner && !this.coders.has(t.owner)) t.owner = this.runtimes.get('main').coder;

    this.human = { inbox: new Map(), raises: new Map(), conflicts: new Map(), lastDecision: new Map(), promoted: new Set() };
    this.merge = { busy: false, queue: [], state: new Map() };
    this.ceilings = new Map();
    this.stalls = new Map();
  }

  // ------------------------------------------------------------------------------- time & trace

  iso(t = this.t) { return new Date(this.startMs + t * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

  at(delay, kind, meta, fn) {
    this.heap.push({ at: this.t + Math.max(0, delay), seq: (this.seq += 1), kind, ...meta, fn });
  }

  effect(e) { this.ev?.effects.push(e); }

  run(checker) {
    this.checker = checker;
    for (const rt of this.runtimes.values()) {
      this.at(rt.startAt, 'start', { actor: rt.name }, () => this.handle(rt, { kind: 'start' }));
      this.at(rt.startAt + this.sc.supervisor.checkin_minutes, 'checkin', { actor: rt.name }, () => this.checkin(rt));
    }
    for (const t of this.sc.tasks) {
      if (t.status === 'merging') this.mergeEnqueue(t.id);
      if (t.status === 'integrated') this.humanNotify({ kind: 'integration', task: t.id, ref: this.branchOf(t.id).name });
      if (t.status === 'human-review') this.humanNotify({ kind: 'review', task: t.id });
    }
    if (this.sc.grant && this.sc.faults.grant_expiry) {
      const at = (Date.parse(this.sc.grant.expires_at) - this.startMs) / 60000;
      this.at(at, 'grant-expires', { actor: 'clock' }, () => this.effect({ grant: this.sc.grant.id, expired: true }));
    }
    const horizon = this.sc.horizon_minutes;
    while (this.heap.size) {
      const e = this.heap.pop();
      if (e.at > horizon) { this.cut = true; break; }
      this.t = e.at;
      this.ev = { index: this.index, at: e.at, kind: e.kind, actor: e.actor ?? null, task: e.task ?? null, detail: e.detail ?? null, effects: [], commits: [], lands: [], ended: [], dispatches: [], records: [], prompts: [], executed: [], note: null, violations: [] };
      this.index += 1;
      e.fn();
      checker.afterEvent(this, this.ev);
      if (this.traceOn) this.trace.push(this.traceLine(this.ev));
    }
    this.ev = { index: this.index, at: this.t, kind: 'end', effects: [], commits: [], lands: [], ended: [], dispatches: [], records: [], prompts: [], executed: [], violations: [] };
    checker.atEnd(this);
    if (this.traceOn) this.trace.push(this.traceLine(this.ev));
  }

  traceLine(ev) {
    const line = { i: ev.index, t: round(ev.at, 3), at: this.iso(ev.at), kind: ev.kind };
    if (ev.actor) line.actor = ev.actor;
    if (ev.task) line.task = ev.task;
    if (ev.detail) Object.assign(line, ev.detail);
    if (ev.note) line.note = ev.note;
    if (ev.commits.length) line.commits = ev.commits.map(({ commit: c, before, after }) => ({ id: c.id, task: c.task, transition: c.transition, from: before.status, to: after.status, owner: after.owner, by: c.actor, role: c.role, ...(c.grant ? { grant: c.grant } : {}), ...(c.trigger ? { trigger: c.trigger.kind } : {}) }));
    if (ev.effects.length) line.effects = ev.effects;
    if (ev.violations.length) line.violations = ev.violations.map((v) => v.invariant);
    return line;
  }

  // ------------------------------------------------------------------------------- notifications

  // A wake for one runtime's supervisor. Lossy and duplicable per the scenario's faults; a lost wake
  // may be followed by an events_lost notice (attention.yaml coalesced-and-lossy).
  deliver(rt, note) {
    const f = this.sc.faults;
    if (f.lost_events && this.rng.chance(f.lost_events.rate)) {
      this.stats.signalsLost += 1;
      this.effect({ lost: note.kind, value: note.value ?? note.what ?? null, to: rt.name });
      if (!rt.noticePending && this.rng.chance(f.lost_events.notice_rate)) {
        rt.noticePending = true;
        this.at(this.rng.between(f.lost_events.notice_minutes), 'deliver', { actor: rt.name, detail: { wake: 'notice' } }, () => {
          rt.noticePending = false;
          this.stats.notices += 1;
          this.handle(rt, { kind: 'notice', value: 'events_lost' });
        });
      }
      return;
    }
    const delay = this.rng.between(this.sc.latency.signal);
    const wake = note.kind === 'signal' ? `signal:${note.value}` : note.kind;
    this.at(delay, 'deliver', { actor: rt.name, task: note.task, detail: { wake } }, () => this.handle(rt, note));
    if (f.duplicate_wakes && this.rng.chance(f.duplicate_wakes.rate)) {
      this.stats.duplicates += 1;
      this.at(delay + this.rng.between(this.sc.latency.signal), 'deliver', { actor: rt.name, task: note.task, detail: { wake, duplicate: true } }, () => this.handle(rt, { ...note, duplicate: true }));
    }
  }

  webhook(note) {
    for (const rt of this.runtimes.values()) this.deliver(rt, { kind: 'webhook', ...note });
  }

  handle(rt, note) {
    this.ev.note = { kind: note.kind, ...(note.value ? { value: note.value } : {}), ...(note.what ? { what: note.what } : {}), ...(note.duplicate ? { duplicate: true } : {}) };
    if (note.kind === 'signal' && note.task) {
      const rec = this.recordOf(rt, note.task);
      rec.signals[note.role] = { source: 'herdr', value: note.value, observed_at: this.iso() };
    }
    rt.handling = note;
    rt.policy.onEvent(note, this.api(rt, note));
    rt.handling = null;
  }

  // A bounded check-in from a cheap timer (playbook: dormancy-and-wakes): an opportunity to look,
  // stopped once nothing changes between two of them.
  checkin(rt) {
    const live = [...this.sessions.values()].filter((x) => x.state === 'running' || x.state === 'blocked').length;
    const fingerprint = `${this.forge.version}:${live}:${this.human.inbox.size}:${this.merge.queue.length}:${this.merge.busy}:${rt.mergingTask ?? ''}:${this.forge.decisions.length}`;
    const pending = this.heap.items.some((e) => e.kind !== 'checkin');
    this.handle(rt, { kind: 'checkin' });
    if (pending || fingerprint !== rt.lastCheckin) {
      rt.lastCheckin = fingerprint;
      this.at(this.sc.supervisor.checkin_minutes, 'checkin', { actor: rt.name }, () => this.checkin(rt));
    }
  }

  // ------------------------------------------------------------------------------- the supervisor's api

  api(rt, note) {
    return {
      note,
      now: this.t,
      runtime: rt.name,
      coder: rt.coder,
      evaluator: rt.evaluator,
      tier: this.sc.policy.tier,
      config: this.sc.supervisor,
      budgets: this.sc.policy.budgets,
      view: () => this.snapshot(rt),
      dispatch: (task, opts) => this.dispatch(rt, task, opts),
      evaluate: (task, opts) => this.dispatchEvaluator(rt, task, opts),
      commit: (task, c) => this.supervisorCommit(rt, task, c, note),
      record: (task, rec) => this.record(rt, task, rec),
      consume: (sessionId) => this.consume(rt, sessionId),
      answerPrompt: (id, decision) => this.answerPrompt(id, decision, { actor: rt.name, kind: 'agent', role: 'orchestrator' }),
      // The orchestrator's own merge (rebase, merged checks, land or hand back), for a branch no merge
      // queue serves; its authority is judged on the grant as it stood when it decided.
      merge: (task) => this.orchestratorMerge(rt, task, note),
      // A raw land through the forge with no status commit and no merged checks (the land-directly mutation).
      land: (task) => this.landAttempt(task, { actor: rt.name, role: 'orchestrator', kind: 'agent', injected: false }),
    };
  }

  snapshot(rt) {
    const ms = this.startMs + this.t * 60000;
    const tasks = [...this.forge.tasks.values()].map((t) => {
      const spec = this.meta.get(t.id).spec;
      return { ...t, depends_on: spec.depends_on, touches: spec.touches, priority: spec.priority, risk: spec.risk, criteria: spec.criteria, size: spec.size, budget: spec.budget, epic: spec.epic, lands_to: spec.lands_to };
    });
    const prs = {};
    for (const [id, pr] of this.forge.prs) {
      prs[id] = { head: pr.head, base: pr.base, author: pr.author, ready: pr.ready, checks: Object.fromEntries(pr.checks), reviews: pr.reviews.map((r) => ({ ...r })), approval: pr.approval ? { ...pr.approval } : null, coverage: [...(pr.coverage.get(pr.head) ?? [])], merged: pr.merged ? { ...pr.merged } : null };
    }
    const sessions = [...this.sessions.values()].filter((s) => s.runtime === rt.name && (s.kind === 'author' || s.kind === 'evaluator')).map((s) => this.sessionView(s));
    return {
      t: this.t,
      tasks,
      prs,
      sessions,
      runs: sessions.filter((s) => s.state !== 'running' && s.state !== 'blocked' && !rt.consumed.has(s.id)),
      decisions: this.forge.decisions.map((d) => ({ ...d })),
      prompts: [...this.prompts.values()].filter((p) => this.sessions.get(p.session)?.runtime === rt.name).map((p) => ({ ...p })),
      grant: rt.grant ? structuredClone(rt.grant) : null,
      grantLive: grantLiveAt(rt.grant, ms),
      grantHas: (action, task) => grantLiveAt(rt.grant, ms) && grantHas(rt.grant, action, this.sc, task),
      spend: { total: rt.spend.total, perTask: Object.fromEntries(rt.spend.perTask), inflightCaps: sessions.filter((s) => s.state === 'running' || s.state === 'blocked').reduce((a, s) => a + (Number.isFinite(s.caps.max_usd) ? s.caps.max_usd : Infinity), 0) },
      records: Object.fromEntries([...rt.records].map(([k, v]) => [k, structuredClone(v)])),
      target: { version: this.forge.target.version, landed: [...this.forge.target.landed] },
      protectedBranch: this.sc.target,
      queueServes: (branch) => this.queueServes(branch),
      merging: rt.mergingTask ?? null,
    };
  }

  sessionView(s) {
    return { id: s.id, task: s.task, kind: s.kind, mode: s.mode, state: s.state, startedAt: s.startedAt, endedAt: s.endedAt, claimed: s.claimed, caps: { ...s.caps }, result: s.result ? { ...s.result } : null, return: s.ret ? structuredClone(s.ret) : null, denials: [...s.denials] };
  }

  consume(rt, sessionId) {
    if (rt.consumed.has(sessionId)) return;
    rt.consumed.add(sessionId);
    const s = this.sessions.get(sessionId);
    for (const id of s?.denials ?? []) {
      const p = this.prompts.get(id);
      if (p && !p.read) { p.read = true; this.ev.prompts.push(p); }
    }
  }

  recordOf(rt, task) {
    if (!rt.records.has(task)) rt.records.set(task, { attention: 'working', summary: 'tracking', next_action: null, item: null, questions: [], signals: {}, updated_at: this.iso() });
    return rt.records.get(task);
  }

  // Attention for one task (task-record.state). needs-human with an item notifies the human (the
  // runtime's phone push); questions name the prompts it surfaces.
  record(rt, task, { attention, summary, next_action = null, item = null, questions = [] }) {
    const rec = this.recordOf(rt, task);
    const before = { attention: rec.attention, next_action: rec.next_action, item: rec.item };
    const same = rec.attention === attention && rec.next_action === next_action && rec.item === item && questions.every((q) => rec.questions.includes(q));
    if (same) return;
    Object.assign(rec, { attention, summary: String(summary ?? attention).slice(0, 120), next_action, item, updated_at: this.iso() });
    for (const q of questions) {
      if (!rec.questions.includes(q)) rec.questions.push(q);
      const p = this.prompts.get(q);
      if (p) { p.surfaced = true; this.ev.prompts.push(p); }
    }
    this.ev.records.push({ runtime: rt.name, task, before, after: { attention, next_action, item }, status: this.forge.tasks.get(task)?.status });
    this.effect({ record: task, attention, ...(next_action ? { next_action } : {}) });
    if (attention === 'needs-human' && item) {
      this.stats.needsHuman += 1;
      this.humanNotify({ kind: item, task, ref: questions[0] ?? null, runtime: rt.name });
    }
  }

  // ------------------------------------------------------------------------------- forge

  // The branch a task's PR targets: the protected target, or its epic's integration branch.
  branchOf(task) {
    const name = landingTarget(this.sc, this.meta.get(task).spec);
    if (!this.forge.branches.has(name)) this.forge.branches.set(name, { name, version: 0, landed: [], integration: true });
    return this.forge.branches.get(name);
  }

  queueServes(branch) {
    return this.sc.merge.queue_targets === null || this.sc.merge.queue_targets.includes(branch);
  }

  newPr(task, author, head) {
    const pr = { number: (this.prSeq += 1), task, author, head, base: this.branchOf(task).version, ready: false, checks: new Map(), reviews: [], approval: null, coverage: new Map(), merged: null };
    this.forge.prs.set(task, pr);
    return pr;
  }

  // Push a commit to the task file. It reaches the forge after a latency and is accepted only if no
  // other commit landed since the actor's pull (compare-and-swap); a rejected actor re-pulls and
  // re-validates with c.retry() before pushing again, or yields with c.onReject().
  push(c) {
    c.id ??= `c${(this.commitSeq += 1)}`;
    c.base = this.forge.version;
    c.decidedAt ??= this.t;
    c.decidedMs ??= this.startMs + this.t * 60000;
    this.at(this.rng.between(this.sc.latency.push), 'push', { actor: c.actor, task: c.task, detail: { commit: c.id, transition: c.transition } }, () => this.applyPush(c));
  }

  applyPush(c) {
    const f = this.forge;
    const t = f.tasks.get(c.task);
    if (this.cas && c.base !== f.version) {
      this.stats.pushesRejected += 1;
      this.effect({ push: 'rejected', commit: c.id, by: c.actor });
      const valid = c.retry ? c.retry(t) : t.status === c.from && t.owner === c.expectOwner;
      if (valid) this.push(c);
      else c.onReject?.(t);
      return;
    }
    const before = { status: t.status, owner: t.owner, prior: t.prior };
    t.status = c.to;
    if (c.owner !== undefined) t.owner = c.owner;
    const side = this.m.sideStates;
    if (side.has(c.to) && !side.has(before.status)) t.prior = before.status;
    else if (!side.has(c.to)) t.prior = null;
    if (c.reason) t.kickback_reason = c.reason;
    t.lastTransition = c.transition;
    t.changedAt = this.t;
    f.version += 1;
    const pr = f.prs.get(c.task);
    if (c.prApproval && pr) pr.approval = { head: pr.head, by: c.actor, actorKind: c.actorKind, role: c.role, grant: c.grant ?? null, grantLive: c.grantLive ?? null, grantSnapshot: c.grantSnapshot ?? null, decidedMs: c.decidedMs, at: this.t };
    if (c.prReady && pr) pr.ready = true;
    if (c.actorKind === 'human') this.human.lastDecision.set(c.task, this.t);
    this.ev.commits.push({ commit: c, before, after: { status: t.status, owner: t.owner }, appliedAt: this.t });
    c.onAccept?.(t);
    this.webhook({ what: 'status', task: c.task, value: t.status });
    if (t.status === 'human-review') this.humanNotify({ kind: c.transition === 'return-to-human' ? 'conflict' : 'review', task: c.task, ref: c.reason ?? null });
    if (t.status === 'merging') this.mergeEnqueue(c.task);
    // An integration branch with nothing in flight is the human's to merge (tier 3): tell them when a
    // task lands there, and when the last task in flight on it leaves the claimed states.
    const branch = this.branchOf(c.task);
    if (branch.integration && (t.status === 'integrated' || (this.m.claimed.has(before.status) && !this.m.claimed.has(t.status)))) {
      if ([...this.forge.tasks.values()].some((x) => x.status === 'integrated' && this.branchOf(x.id) === branch)) this.humanNotify({ kind: 'integration', task: c.task, ref: branch.name });
    }
  }

  // A merge into the branch the task lands on (the protected target or its epic's integration
  // branch). Branch protection admits it only with an approval recorded for the PR's current head and
  // green checks on that head; with protection off (a misconfigured forge) it admits anything, and
  // only the invariants stand between the change and the branch.
  landAttempt(task, who, onLanded) {
    const pr = this.forge.prs.get(task);
    const branch = this.branchOf(task);
    const approved = pr?.approval && pr.approval.head === pr.head;
    const green = pr?.checks.get(pr?.head) === 'green';
    const admit = !this.forgeProtection || (approved && green);
    const entry = { task, head: pr?.head ?? null, target: branch.name, by: who.actor, role: who.role, actorKind: who.kind, injected: Boolean(who.injected), grantLive: who.grantLive ?? null, grantSnapshot: who.grantSnapshot ?? null, approval: pr?.approval ? { ...pr.approval } : null, mergeState: this.merge.state.get(task) ?? null, coverage: [...(pr?.coverage.get(pr?.head) ?? [])], admitted: Boolean(admit) };
    this.ev.lands.push(entry);
    if (!admit || !pr) {
      this.stats.landsRejected += 1;
      this.effect({ land: 'rejected', task, by: who.actor, why: !pr ? 'no PR' : !approved ? 'no approval for this head' : 'checks not green' });
      this.webhook({ what: 'push-rejected', task });
      return false;
    }
    pr.merged = { head: pr.head, at: this.t, version: (branch.version += 1), target: branch.name };
    branch.landed.push(task);
    this.stats.mergesLanded += 1;
    this.effect({ land: branch.integration ? 'integrated' : 'merged', task, head: pr.head, by: who.actor, target: branch.name });
    onLanded?.();
    return true;
  }

  // ------------------------------------------------------------------------------- sessions

  newSession(rt, { task, kind, role, owner, mode, caps, depth = 0, parent = null }) {
    const s = { id: `s${(this.sessionSeq += 1)}`, runtime: rt.name, task, kind, role, owner, mode, caps: { max_turns: Infinity, max_usd: Infinity, max_depth: Infinity, ...caps }, depth, parent, startedAt: this.t, endedAt: null, state: 'running', claimed: false, active: 0, segStart: this.t, helperUsd: 0, helperTurns: 0, denials: [], result: null, ret: null, statusBefore: this.forge.tasks.get(task)?.status ?? null, children: [] };
    this.sessions.set(s.id, s);
    return s;
  }

  signal(s, value) {
    const rt = this.runtimes.get(s.runtime);
    this.deliver(rt, { kind: 'signal', value, session: s.id, task: s.task, role: s.kind === 'evaluator' ? 'evaluator' : 'author' });
  }

  // The supervisor dispatches an author. A work run on a ready task starts with the claim (the
  // coder's compare-and-swap); claimable(view) is the dispatcher's own precondition, re-checked by
  // the author on a fresh pull whenever the claim push is rejected.
  dispatch(rt, taskId, { mode = 'work', caps = {}, claimable = () => true } = {}) {
    const t = this.forge.tasks.get(taskId);
    const s = this.newSession(rt, { task: taskId, kind: 'author', role: 'coder', owner: rt.coder, mode, caps });
    s.claimable = claimable;
    this.meta.get(taskId).runs += 1;
    this.ev.dispatches.push({ runtime: rt.name, task: taskId, kind: 'author', mode, session: s.id });
    this.effect({ dispatch: s.id, task: taskId, mode, caps: { max_turns: s.caps.max_turns, max_usd: s.caps.max_usd, max_depth: s.caps.max_depth } });
    this.signal(s, 'working');
    if (mode === 'work' && t.status === 'ready') this.at(0, 'session', { actor: s.id, task: taskId, detail: { step: 'claim' } }, () => this.authorClaim(s));
    else {
      if (t.owner === s.owner) s.claimed = true;
      this.at(0, 'session', { actor: s.id, task: taskId, detail: { step: 'begin' } }, () => this.authorBegin(s));
    }
    return s.id;
  }

  authorCommit(s, transition, to, extra = {}) {
    const t = this.forge.tasks.get(s.task);
    // A coder reads the task file before it commits: a transition its status no longer allows means
    // the task changed under the run (another writer, a human), so the run stops.
    if (!this.m.transitions.get(transition).from.includes(t.status)) {
      this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `${transition} not allowed from ${t.status}: the task changed under the run`, ret: this.authorReturn(s, 'working', `The task moved to ${t.status} while the run worked; nothing was committed.`) });
      return;
    }
    const c = { task: s.task, transition, from: t.status, to, expectOwner: t.owner, actor: s.owner, actorKind: 'agent', role: 'coder', runtime: s.runtime, session: s.id, ...extra };
    c.onReject ??= () => this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `${transition} rejected: the task changed under the run`, ret: this.authorReturn(s, 'working', 'The task changed while the run was pushing; nothing more was done.') });
    this.push(c);
  }

  authorClaim(s) {
    if (s.state !== 'running') return;
    const rt = this.runtimes.get(s.runtime);
    const t = this.forge.tasks.get(s.task);
    if (t.status !== 'ready' || t.owner !== null) {
      this.stats.claimsLost += 1;
      this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: 'claim lost: the task was no longer ready', ret: null });
      return;
    }
    this.authorCommit(s, 'claim', 'in-progress', {
      owner: s.owner,
      retry: (task) => task.status === 'ready' && task.owner === null && s.claimable(this.snapshot(rt), s.task),
      onReject: () => {
        this.stats.claimsLost += 1;
        this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: 'claim lost: another actor claimed the task or its lane first', ret: null });
      },
      onAccept: () => { s.claimed = true; this.authorBegin(s); },
    });
  }

  authorBegin(s) {
    if (s.state !== 'running') return;
    const t = this.forge.tasks.get(s.task);
    const m = this.meta.get(s.task);
    if (t.owner !== s.owner) {
      this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `not the owner of ${s.task}`, ret: null });
      return;
    }
    s.claimed = true;
    if (s.mode === 'finalize') {
      this.authorCommit(s, 'mark-pr-ready', 'human-review', { prReady: true, onAccept: () => this.authorEnd(s, { outcome: 'advanced', subtype: 'success', exit: 0, reason: null, ret: this.authorReturn(s, 'complete', 'Marked the PR ready for review.') }) });
      return;
    }
    if (t.status === 'needs-input' && m.questionAnswered) {
      const rt = this.runtimes.get(s.runtime);
      const free = (x) => x.status === 'needs-input' && x.owner === s.owner && s.claimable(this.snapshot(rt), s.task);
      if (!free(t)) { this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: 'claim lost: the lane was taken before the resume', ret: null }); return; }
      this.authorCommit(s, 'resume-answered', t.prior, { onAccept: () => this.authorPlan(s), retry: free });
      return;
    }
    if (t.status === 'review') {
      this.authorCommit(s, 'iterate', 'in-progress', { onAccept: () => this.authorPlan(s) });
      return;
    }
    if (t.status !== 'in-progress') {
      this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `nothing to do from ${t.status}`, ret: null });
      return;
    }
    this.authorPlan(s);
  }

  // The run's milestones, in active minutes from its start, and where its caps cut it.
  authorPlan(s) {
    const sc = this.sc;
    const m = this.meta.get(s.task);
    const f = sc.faults;
    const pr = this.forge.prs.get(s.task);
    const rework = Boolean(pr) && (s.mode === 'fix' || s.mode === 'work');
    const remaining = rework ? this.rng.between(sc.work.fix_minutes) : Math.max(1, m.workTotal - m.workDone);
    s.rework = rework;
    s.remaining = remaining;
    const steps = [];
    const rate = sc.work.usd_per_minute;
    const mpt = sc.work.minutes_per_turn;
    let helperAt = null;
    if (this.rng.chance(sc.work.helper_rate)) {
      helperAt = remaining * 0.1;
      steps.push({ at: helperAt, what: 'helper' });
    }
    if (f.wall?.tasks.includes(s.task)) steps.push({ at: remaining * 0.3, what: 'wall' });
    if (f.question?.tasks.includes(s.task) && !m.questionAsked && !rework) steps.push({ at: remaining * 0.4, what: 'question' });
    if (f.ask?.tasks.includes(s.task) && !m.askResolved && !rework) steps.push({ at: remaining * 0.5, what: 'ask' });
    const crashListed = f.crash?.tasks.includes(s.task) && m.crashes === 0;
    if (crashListed || (f.crash && this.rng.chance(f.crash.rate))) steps.push({ at: remaining * this.rng.between(f.crash.at), what: 'crash' });
    if (f.unknown_signals && this.rng.chance(f.unknown_signals.rate)) steps.push({ at: remaining * this.rng.next(), what: 'unknown' });
    const noProgress = f.no_progress?.tasks.includes(s.task) && !rework;
    steps.push({ at: remaining, what: noProgress ? 'give-up' : 'complete' });
    // The runner's caps: spend and turns grow with active minutes, helpers add theirs at spawn.
    const hMin = helperAt === null ? 0 : this.rng.between(sc.work.helper_minutes);
    s.helperPlan = hMin;
    const cross = (limit, slope, jump) => {
      if (!Number.isFinite(limit)) return Infinity;
      const pre = limit / slope;
      if (helperAt === null || pre < helperAt) return pre;
      if (helperAt * slope + jump >= limit) return helperAt;
      return (limit - jump) / slope;
    };
    const usdAt = cross(s.caps.max_usd, rate, hMin * rate);
    const turnsAt = cross(s.caps.max_turns, 1 / mpt, hMin / mpt);
    const capAt = Math.min(usdAt, turnsAt);
    if (capAt < remaining) steps.push({ at: capAt, what: 'cap', subtype: usdAt <= turnsAt ? 'error_max_budget_usd' : 'error_max_turns' });
    steps.sort((a, b) => a.at - b.at || (a.what === 'cap' ? -1 : 1));
    s.steps = steps;
    s.cursor = 0;
    s.segStart = this.t;
    this.authorNext(s);
  }

  authorNext(s) {
    if (s.state !== 'running') return;
    const step = s.steps[s.cursor];
    if (!step) return;
    const delay = Math.max(0, step.at - s.active);
    this.at(delay, 'session', { actor: s.id, task: s.task, detail: { step: step.what } }, () => {
      if (s.state !== 'running') return;
      s.active = step.at;
      s.cursor += 1;
      this.authorStep(s, step);
    });
  }

  authorStep(s, step) {
    const sc = this.sc;
    const m = this.meta.get(s.task);
    const rt = this.runtimes.get(s.runtime);
    switch (step.what) {
      case 'helper': {
        if (s.caps.max_depth < s.depth + 1) { this.stats.helpersRefused += 1; this.effect({ spawn: 'refused', depth: s.depth + 1 }); break; }
        this.spawnHelper(rt, s, s.helperPlan);
        break;
      }
      case 'wall': {
        const argv = sc.faults.wall.command;
        const decision = this.engine(sc.policy.tier, argv, sc.policy);
        if (decision === 'deny') { this.stats.wallsBlocked += 1; this.effect({ wall: 'blocked', command: argv.join(' ') }); } else {
          this.executed.push({ task: s.task, session: s.id, argv, at: this.t });
          this.ev.executed.push({ task: s.task, session: s.id, argv });
          this.effect({ executed: argv.join(' ') });
        }
        break;
      }
      case 'unknown':
        this.signal(s, 'unknown');
        break;
      case 'question':
        m.questionAsked = true;
        this.authorCommit(s, 'need-input', 'needs-input', {
          reason: 'open question: which rounding rule applies (blocking)',
          onAccept: () => this.authorEnd(s, { outcome: 'advanced', subtype: 'success', exit: 0, reason: null, ret: this.authorReturn(s, 'needs-human', 'Stopped at an open question the spec does not answer.', [{ question: 'Which rounding rule applies to the prorated total?', blocking: true, for: 'human' }]) }),
        });
        return;
      case 'ask': {
        const argv = sc.faults.ask.command;
        const decision = this.engine(sc.policy.tier, argv, sc.policy);
        if (decision === 'deny') { this.stats.wallsBlocked += 1; this.effect({ wall: 'blocked', command: argv.join(' ') }); break; }
        if (decision === 'allow') { this.executed.push({ task: s.task, session: s.id, argv, at: this.t }); this.ev.executed.push({ task: s.task, session: s.id, argv }); m.askResolved = true; break; }
        m.asked = true;
        const p = { id: `p${(this.promptSeq += 1)}`, task: s.task, session: s.id, command: argv.join(' '), tier: sc.policy.tier, state: 'pending', answeredBy: null, answeredKind: null, read: false, surfaced: false, at: this.t };
        this.prompts.set(p.id, p);
        this.stats.prompts += 1;
        this.ev.prompts.push(p);
        if (sc.policy.tier === 'unattended') {
          // dontAsk: every ask is a denial, recorded for a human (ADR-0021).
          p.state = 'denied';
          p.answeredBy = 'runtime';
          p.answeredKind = 'policy';
          s.denials.push(p.id);
          this.stats.denials += 1;
          this.effect({ ask: p.id, command: p.command, decision: 'denied (dontAsk)' });
          this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `permission denied: ${p.command}`, ret: this.authorReturn(s, 'needs-human', `A command needed permission and was denied: ${p.command}.`, [{ question: `Run \`${p.command}\` yourself, or allow it for this task?`, blocking: true, for: 'human' }]) });
          return;
        }
        this.effect({ ask: p.id, command: p.command, decision: 'prompt' });
        this.pause(s);
        s.prompt = p.id;
        this.signal(s, 'blocked');
        return;
      }
      case 'crash':
        this.stats.crashes += 1;
        m.crashes += 1;
        this.authorEnd(s, { crashed: true, outcome: 'failed', subtype: null, exit: 'SIGKILL', reason: 'exit SIGKILL: no JSON result', ret: null });
        return;
      case 'cap':
        this.authorEnd(s, { outcome: 'failed', subtype: step.subtype, exit: 1, reason: step.subtype, ret: null });
        return;
      case 'give-up':
        this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: 'status unchanged after the run', ret: this.authorReturn(s, 'working', 'The tests still fail; more time might help.', [], { unmet: m.spec.criteria }) });
        return;
      case 'complete':
        this.authorComplete(s);
        return;
      default:
        break;
    }
    this.authorNext(s);
  }

  spawnHelper(rt, parent, minutes) {
    const h = this.newSession(rt, { task: parent.task, kind: 'helper', role: 'helper', owner: parent.owner, mode: 'read', caps: parent.caps, depth: parent.depth + 1, parent: parent.id });
    parent.children.push(h.id);
    parent.helperUsd += minutes * this.sc.work.usd_per_minute;
    parent.helperTurns += minutes / this.sc.work.minutes_per_turn;
    this.effect({ spawn: h.id, depth: h.depth });
    if (this.rng.chance(0.5)) {
      this.at(minutes / 2, 'session', { actor: h.id, task: h.task, detail: { step: 'nested-helper' } }, () => {
        if (h.state !== 'running') return;
        if (h.caps.max_depth < h.depth + 1) { this.stats.helpersRefused += 1; this.effect({ spawn: 'refused', depth: h.depth + 1 }); return; }
        const n = this.newSession(rt, { task: h.task, kind: 'helper', role: 'helper', owner: h.owner, mode: 'read', caps: h.caps, depth: h.depth + 1, parent: h.id });
        h.children.push(n.id);
        this.effect({ spawn: n.id, depth: n.depth });
        this.at(minutes / 4, 'session', { actor: n.id, task: n.task, detail: { step: 'helper-done' } }, () => this.endHelper(n));
      });
    }
    this.at(minutes, 'session', { actor: h.id, task: h.task, detail: { step: 'helper-done' } }, () => this.endHelper(h));
  }

  endHelper(h) {
    if (h.state !== 'running') return;
    h.state = 'ended';
    h.endedAt = this.t;
    for (const c of h.children) this.endHelper(this.sessions.get(c));
  }

  pause(s) {
    s.state = 'blocked';
  }

  resume(s) {
    if (s.state !== 'blocked') return;
    s.state = 'running';
    this.signal(s, 'working');
    this.authorNext(s);
  }

  authorComplete(s) {
    const sc = this.sc;
    const m = this.meta.get(s.task);
    const crit = m.spec.criteria;
    if (!s.rework) m.workDone = m.workTotal;
    let pr = this.forge.prs.get(s.task);
    const prev = pr ? pr.coverage.get(pr.head) ?? new Set() : new Set();
    const rate = pr ? Math.max(sc.work.cover_rate, 0.95) : sc.work.cover_rate;
    const covered = new Set([...prev, ...crit.filter((ac) => !prev.has(ac) && this.rng.chance(rate))]);
    const head = this.rng.hex(7);
    if (!pr) pr = this.newPr(s.task, s.owner, head);
    pr.head = head;
    pr.base = this.branchOf(s.task).version;
    pr.ready = false;
    pr.approval = null;
    pr.coverage.set(head, covered);
    this.effect({ pushed: head, pr: pr.number, covered: [...covered] });
    this.ciRun(s.task, head);
    this.authorCommit(s, 'open-draft', 'review', {
      onAccept: () => {
        const f = sc.faults.merge_without_grant;
        if (f?.tasks.includes(s.task) && !m.mergeAttempted) {
          m.mergeAttempted = true;
          this.landAttempt(s.task, { actor: s.owner, role: 'coder', kind: 'agent', injected: true });
        }
        const unmet = crit.filter((ac) => !covered.has(ac));
        this.authorEnd(s, { outcome: 'advanced', subtype: 'success', exit: 0, reason: null, ret: this.authorReturn(s, unmet.length ? 'working' : 'complete', unmet.length ? `Opened the PR; ${unmet.join(', ')} still lack a test.` : 'Opened the PR with a test for every criterion.', [], { unmet, head }) });
      },
    });
  }

  authorReturn(s, attention, summary, decisions = [], { unmet = null, head = null } = {}) {
    const crit = this.meta.get(s.task).spec.criteria;
    const un = unmet ?? (attention === 'complete' ? [] : crit);
    const pr = this.forge.prs.get(s.task);
    return {
      task: s.task,
      role: 'coder',
      summary,
      attention,
      artifacts: pr ? [{ path: `pr/${pr.number}`, kind: 'pr' }] : [],
      decisions_needed: decisions,
      criteria: { met: crit.filter((c) => !un.includes(c)), unmet: un.map((id) => ({ id, reason: 'no test names it, or it does not pass yet' })) },
      head: head ?? pr?.head ?? null,
    };
  }

  // A run ends: its spend is charged, its run-record line written, its return kept for the
  // supervisor, and a done (or, for a dead process, idle) signal sent.
  authorEnd(s, { crashed = false, outcome, subtype, exit, reason, ret }) {
    if (s.state === 'ended' || s.state === 'crashed') return;
    const sc = this.sc;
    const rt = this.runtimes.get(s.runtime);
    const m = this.meta.get(s.task);
    if (s.state === 'running') s.active = Math.max(s.active, 0);
    s.state = crashed ? 'crashed' : 'ended';
    s.endedAt = this.t;
    for (const c of s.children) this.endHelper(this.sessions.get(c));
    const usd = s.active * sc.work.usd_per_minute + s.helperUsd;
    const turns = Math.ceil(s.active / sc.work.minutes_per_turn + s.helperTurns);
    s.usd = round(usd, 6);
    s.turns = turns;
    if (s.kind === 'author' && !s.rework && s.mode !== 'finalize' && (crashed || subtype?.startsWith('error_max'))) m.workDone += s.active;
    rt.spend.total += usd;
    rt.spend.perTask.set(s.task, (rt.spend.perTask.get(s.task) ?? 0) + usd);
    m.spend += usd;
    if (ret) {
      s.ret = ret;
      if (s.kind === 'author' && ret.head !== undefined) m.lastReturn = ret;
      const { head, ...rest } = ret;
      this.artifacts.returns.push(head === undefined ? structuredClone(rest) : { ...structuredClone(rest), 'x-head': head });
    }
    const statusAfter = this.forge.tasks.get(s.task)?.status ?? null;
    const outcomeFinal = outcome === 'advanced' && ['ready', 'in-progress', null].includes(statusAfter) ? 'stalled' : outcome;
    const moved = ['advanced', 'verdict', 'read'].includes(outcomeFinal);
    s.result = { outcome: outcomeFinal, subtype: subtype ?? null, exit, reason: moved ? null : reason ?? (outcomeFinal === 'stalled' ? 'status unchanged after the run' : 'run failed'), statusAfter, claimLost: /^claim lost/.test(reason ?? '') };
    if (s.kind === 'author') {
      const key = `${s.runtime}:${s.task}`;
      if (subtype?.startsWith('error_max')) this.ceilings.set(key, this.t);
      if (outcomeFinal === 'stalled' && !s.result.claimLost && !s.denials.length && !(ret?.decisions_needed?.length)) {
        const st = this.stalls.get(key) ?? { count: 0, at: 0 };
        this.stalls.set(key, { count: st.count + 1, at: this.t });
      } else if (outcomeFinal === 'advanced') this.stalls.delete(key);
    }
    const line = {
      task: s.task,
      session_id: `${this.seed}-${s.id}`,
      started_at: this.iso(s.startedAt),
      ended_at: this.iso(s.endedAt),
      exit,
      outcome: s.result.outcome,
      reason: s.result.reason,
      subtype: subtype ?? null,
      num_turns: crashed ? null : turns,
      total_cost_usd: crashed ? null : round(usd, 6),
      status_after: statusAfter,
      engine: 'sim',
      runtime: s.runtime,
      role: RUN_ROLE[s.kind] ?? 'other',
      status_before: s.statusBefore,
      permission_denials: s.denials.length,
      attention: ret?.attention ?? (crashed || subtype ? 'needs-human' : 'working'),
    };
    const budget = Object.fromEntries([['max_turns', s.caps.max_turns], ['max_usd', s.caps.max_usd]].filter(([, v]) => Number.isFinite(v)));
    if (Object.keys(budget).length) line.budget = budget;
    this.artifacts.runRecords.push(line);
    this.ev.ended.push(s);
    this.effect({ ended: s.id, outcome: s.result.outcome, subtype: s.result.subtype, usd: round(usd, 4), turns });
    this.signal(s, crashed ? 'idle' : 'done');
  }

  // ------------------------------------------------------------------------------- evaluator, CI, merge queue

  dispatchEvaluator(rt, taskId, { caps = {} } = {}) {
    const pr = this.forge.prs.get(taskId);
    if (!pr) return null;
    const s = this.newSession(rt, { task: taskId, kind: 'evaluator', role: 'evaluator', owner: rt.evaluator, mode: 'evaluate', caps });
    s.head = pr.head;
    this.ev.dispatches.push({ runtime: rt.name, task: taskId, kind: 'evaluator', mode: 'evaluate', session: s.id });
    this.effect({ dispatch: s.id, task: taskId, mode: 'evaluate', head: pr.head });
    this.signal(s, 'working');
    const minutes = this.rng.between(this.sc.evaluator.minutes);
    const capMin = Math.min(s.caps.max_usd / this.sc.work.usd_per_minute, s.caps.max_turns * this.sc.work.minutes_per_turn);
    const ends = Math.min(minutes, capMin);
    this.at(ends, 'session', { actor: s.id, task: taskId, detail: { step: 'verdict' } }, () => {
      s.active = ends;
      if (ends < minutes) { this.authorEnd(s, { outcome: 'failed', subtype: capMin === s.caps.max_usd / this.sc.work.usd_per_minute ? 'error_max_budget_usd' : 'error_max_turns', exit: 1, reason: 'evaluator hit its cap', ret: null }); return; }
      const m = this.meta.get(taskId);
      const forced = this.sc.faults.evaluator_rejection?.tasks[taskId];
      const covered = pr.coverage.get(s.head) ?? new Set();
      const missing = m.spec.criteria.filter((ac) => !covered.has(ac));
      let verdict = 'pass';
      let why = 'every criterion has a passing test';
      if (forced === 'always' || (Number.isInteger(forced) && m.rejections < forced)) { verdict = 'changes-requested'; why = 'a material finding against the criteria'; m.rejections += 1; } else if (missing.length) { verdict = 'changes-requested'; why = `no test names ${missing.join(', ')}`; } else if (this.rng.chance(this.sc.evaluator.reject_rate)) { verdict = 'changes-requested'; why = 'a material finding'; }
      pr.reviews.push({ head: s.head, verdict, by: s.owner, role: 'evaluator', at: this.t, session: s.id });
      this.effect({ review: verdict, head: s.head, why });
      this.webhook({ what: 'review', task: taskId, value: verdict });
      this.authorEnd(s, { outcome: 'verdict', subtype: 'success', exit: 0, reason: null, ret: { task: taskId, role: 'evaluator', summary: `Reviewed ${s.head}: ${verdict} (${why}).`, attention: 'complete', artifacts: [{ path: `pr/${pr.number}#review`, kind: 'report' }], decisions_needed: [], verification: [{ command: 'run the tests named for each criterion', result: verdict === 'pass' ? 'pass' : 'fail' }] } });
    });
    return s.id;
  }

  ciRun(task, head) {
    this.at(this.rng.between(this.sc.checks.minutes), 'ci', { actor: 'ci', task, detail: { head } }, () => {
      const pr = this.forge.prs.get(task);
      const status = this.rng.chance(this.sc.checks.red_rate) ? 'red' : 'green';
      pr.checks.set(head, status);
      this.effect({ checks: status, head });
      for (const rt of this.runtimes.values()) this.deliver(rt, { kind: 'ci', task, value: status === 'green' ? 'success' : 'failure', head });
    });
  }

  mergeEnqueue(task) {
    if (!this.queueServes(this.branchOf(task).name)) return;
    if (!this.merge.queue.includes(task)) this.merge.queue.push(task);
    this.mergeNext();
  }

  // The merge queue (role merge): one change at a time, for the branches it serves.
  mergeNext() {
    if (this.merge.busy || !this.merge.queue.length) return;
    const task = this.merge.queue.shift();
    if (this.forge.tasks.get(task).status !== 'merging') { this.mergeNext(); return; }
    this.merge.busy = true;
    const who = {
      actor: 'merge-bot',
      role: 'merge',
      push: (c) => this.push({ ...c, actor: 'merge-bot', actorKind: 'agent', role: 'merge' }),
      lander: { actor: 'merge-bot', role: 'merge', kind: 'agent', injected: false },
    };
    this.mergeProcess(task, who, () => { this.merge.busy = false; this.mergeNext(); });
  }

  // The orchestrator merges a change itself (a runtime with no merge role for that branch), one at a
  // time. What it may do is judged on the grant as it stood when it decided to merge.
  orchestratorMerge(rt, task, note) {
    if (rt.mergingTask || this.forge.tasks.get(task)?.status !== 'merging') return false;
    rt.mergingTask = task;
    const ms = this.startMs + this.t * 60000;
    const live = grantLiveAt(rt.grant, ms);
    const snapshot = rt.grant ? structuredClone(rt.grant) : null;
    const grant = { grant: live ? rt.grant.id : null, grantSnapshot: snapshot, grantLive: live };
    const who = {
      actor: rt.name,
      role: 'orchestrator',
      push: (c) => this.push({ ...c, actor: rt.name, actorKind: 'agent', role: 'orchestrator', runtime: rt.name, decidedMs: ms, trigger: note ? { kind: note.kind, value: note.value ?? note.what ?? null } : null, ...grant }),
      lander: { actor: rt.name, role: 'orchestrator', kind: 'agent', injected: false, ...grant },
    };
    this.effect({ merge: 'orchestrator', task, grant: grant.grant });
    this.mergeProcess(task, who, () => { rt.mergingTask = null; this.webhook({ what: 'merge-done', task }); });
    return true;
  }

  // Rebase onto the branch the task lands on, classify conflicts, re-run the checks on the merged
  // result, then land (land -> merged on the protected target, integrate -> integrated on an
  // integration branch) or hand back to a human. Never resolves a semantic conflict (a broken merge
  // queue, mergeBot 'resolve-semantic', does).
  mergeProcess(task, who, done) {
    const branch = this.branchOf(task);
    this.at(this.rng.between(this.sc.merge.minutes), 'merge', { actor: who.actor, task, detail: { step: 'rebase', target: branch.name } }, () => {
      const pr = this.forge.prs.get(task);
      const landedSince = branch.landed.slice(pr.base);
      const pairs = this.sc.faults.semantic_conflict?.pairs ?? [];
      const semantic = landedSince.some((other) => pairs.some((p) => p.includes(task) && p.includes(other)) && this.rng.chance(this.sc.faults.semantic_conflict.rate || 1));
      const conflict = semantic ? 'semantic' : landedSince.length ? 'mechanical' : 'none';
      this.effect({ rebase: conflict, onto: branch.version, target: branch.name });
      this.at(this.rng.between(this.sc.checks.minutes), 'merge', { actor: who.actor, task, detail: { step: 'merged-checks' } }, () => {
        const mergedChecks = this.rng.chance(this.sc.checks.merged_red_rate) ? 'red' : 'green';
        this.merge.state.set(task, { conflict, mergedChecks, head: pr.head, by: who.actor });
        this.effect({ mergedChecks });
        const t = this.forge.tasks.get(task);
        // Someone else landed it, or a human moved it, while this merge ran: nothing to commit.
        if (t.status !== 'merging') { done(); return; }
        const commit = (transition, to, extra) => who.push({ task, transition, from: 'merging', to, expectOwner: t.owner, retry: (x) => x.status === 'merging', onReject: done, ...extra });
        const resolves = who.role === 'merge' && this.mergeBot !== 'correct';
        if ((conflict === 'semantic' || mergedChecks === 'red') && !resolves) {
          commit('return-to-human', 'human-review', { reason: conflict === 'semantic' ? 'semantic conflict with a change that landed first' : 'checks failed on the merged result', onAccept: done });
          return;
        }
        const integrate = Boolean(branch.integration);
        commit(integrate ? 'integrate' : 'land', integrate ? 'integrated' : 'merged', {
          onAccept: () => {
            if (!this.landAttempt(task, who.lander)) this.effect({ warning: `${integrate ? 'integrated' : 'merged'} status without a landed change` });
            this.webhook({ what: integrate ? 'integrated' : 'merged', task });
            done();
          },
        });
      });
    });
  }

  // Tier 3: the human merges an integration branch into the protected target once nothing on it is in
  // flight, then records each task it carried as merged (promote).
  mergeIntegration(branchName) {
    const h = this.sc.human;
    const onBranch = [...this.forge.tasks.values()].filter((x) => this.branchOf(x.id).name === branchName);
    if (onBranch.some((x) => this.m.claimed.has(x.status))) return;
    const ready = onBranch.filter((x) => x.status === 'integrated' && !this.human.promoted.has(x.id));
    if (!ready.length || h.on_integration !== 'merge') return;
    this.stats.humanActions += 1;
    this.effect({ human: 'merged the integration branch', branch: branchName, into: this.sc.target, tasks: ready.map((x) => x.id) });
    for (const x of ready) {
      const pr = this.forge.prs.get(x.id);
      this.forge.target.version += 1;
      this.forge.target.landed.push(x.id);
      this.human.promoted.add(x.id);
      this.stats.mergesLanded += 1;
      this.ev.lands.push({ task: x.id, head: pr.head, target: this.sc.target, via: branchName, by: h.name, role: 'owner', actorKind: 'human', injected: false, grantLive: null, grantSnapshot: null, approval: { head: pr.head, by: h.name, actorKind: 'human', role: 'owner' }, mergeState: null, coverage: [...(pr.coverage.get(pr.head) ?? [])], admitted: true });
    }
    for (const x of ready) this.humanCommit(x.id, 'promote', 'merged', { retry: (y) => y.status === 'integrated' });
  }

  // ------------------------------------------------------------------------------- prompts & the human

  answerPrompt(id, decision, who) {
    const p = this.prompts.get(id);
    if (!p) return false;
    const prev = p.state;
    p.answers = [...(p.answers ?? []), { decision, by: who.actor, kind: who.kind, at: this.t, prev }];
    this.ev.prompts.push(p);
    if (prev !== 'pending' && !(prev === 'denied' && decision === 'approve')) return false;
    p.state = decision === 'approve' ? 'approved' : 'denied';
    p.answeredBy = who.actor;
    p.answeredKind = who.kind;
    const s = this.sessions.get(p.session);
    const m = this.meta.get(p.task);
    this.effect({ prompt: id, answered: p.state, by: who.actor });
    if (p.state === 'approved') {
      m.askResolved = true;
      this.executed.push({ task: p.task, session: p.session, argv: p.command.split(' '), at: this.t, approvedBy: who.actor });
      if (s?.state === 'blocked') { s.prompt = null; this.resume(s); }
      return true;
    }
    if (s?.state === 'blocked') {
      s.denials.push(id);
      this.stats.denials += 1;
      s.state = 'running';
      this.authorEnd(s, { outcome: 'stalled', subtype: 'success', exit: 0, reason: `permission denied: ${p.command}`, ret: this.authorReturn(s, 'needs-human', `A command needed permission and was denied: ${p.command}.`, [{ question: `Run \`${p.command}\` yourself, or allow it for this task?`, blocking: true, for: 'human' }]) });
    }
    return true;
  }

  humanNotify(item) {
    const key = `${item.kind}:${item.task}:${item.ref ?? ''}`;
    if (this.human.inbox.has(key)) return;
    this.human.inbox.set(key, item);
    const h = this.sc.human;
    const latency = ['review', 'conflict', 'integration'].includes(item.kind) ? h.review_minutes : h.answer_minutes;
    this.at(this.rng.between(latency), 'human', { actor: h.name, task: item.task, detail: { item: item.kind } }, () => {
      this.human.inbox.delete(key);
      this.humanAct(item);
    });
  }

  humanCommit(task, transition, to, extra = {}) {
    const t = this.forge.tasks.get(task);
    this.stats.humanActions += 1;
    this.push({ task, transition, from: t.status, to, expectOwner: t.owner, actor: this.sc.human.name, actorKind: 'human', role: 'owner', ...extra });
  }

  decide(task, kind, data = {}) {
    this.stats.humanActions += 1;
    const d = { task, kind, by: this.sc.human.name, at: this.t, ...data };
    this.forge.decisions.push(d);
    this.human.lastDecision.set(task, this.t);
    this.effect({ decision: kind, task, ...data });
    this.webhook({ what: 'decision', task, value: kind });
  }

  mergeGrantCovers(task) {
    const ms = this.startMs + this.t * 60000;
    const spec = this.meta.get(task).spec;
    return [...this.runtimes.values()].some((rt) => grantLiveAt(rt.grant, ms) && grantHas(rt.grant, 'merge', this.sc, spec) && this.forge.tasks.get(task).owner === rt.coder);
  }

  humanAct(item) {
    const h = this.sc.human;
    const t = this.forge.tasks.get(item.task);
    const m = this.meta.get(item.task);
    const pr = this.forge.prs.get(item.task);
    switch (item.kind) {
      case 'review':
        if (t.status !== 'human-review' || t.lastTransition === 'return-to-human') return;
        if (this.mergeGrantCovers(item.task)) { this.effect({ human: 'skipped review: a live merge grant covers it' }); return; }
        if (pr && pr.checks.get(pr.head) === 'green') this.humanCommit(item.task, 'approve-pr', 'merging', { prApproval: true, retry: (x) => x.status === 'human-review' });
        else this.humanCommit(item.task, 'redo', 'ready', { owner: null, reason: 'checks are not green on the head' });
        return;
      case 'integration':
        this.mergeIntegration(item.ref);
        return;
      case 'conflict': {
        if (t.status !== 'human-review') return;
        const n = (this.human.conflicts.get(item.task) ?? 0) + 1;
        this.human.conflicts.set(item.task, n);
        if (n <= h.max_conflicts) this.humanCommit(item.task, 'redo', 'ready', { owner: null, reason: `rebase and resolve: ${t.kickback_reason ?? 'returned by the merge queue'}`, retry: (x) => x.status === 'human-review' });
        else this.humanCommit(item.task, 'suspend', 'suspended', { reason: 'repeated merge conflicts; needs a human plan', retry: (x) => x.status === 'human-review' });
        return;
      }
      case 'question':
        if (t.status !== 'needs-input' || m.questionAnswered) return;
        m.questionAnswered = true;
        this.decide(item.task, 'question', { answer: 'round half to even' });
        return;
      case 'prompt': {
        const p = this.prompts.get(item.ref);
        if (!p || p.state !== 'pending') return;
        this.stats.humanActions += 1;
        this.answerPrompt(p.id, h.on_ask === 'approve' ? 'approve' : 'deny', { actor: h.name, kind: 'human', role: 'owner' });
        if (h.on_ask !== 'approve') { m.askResolved = true; this.decide(item.task, 'denial', { resolution: 'ran it by hand' }); }
        return;
      }
      case 'denial':
        if (m.askResolved) return;
        m.askResolved = true;
        this.decide(item.task, 'denial', { resolution: 'ran it by hand' });
        return;
      case 'budget': {
        // review included: a task can run out of budget before its fix or finalize run.
        if (!['in-progress', 'ready', 'review'].includes(t.status)) return;
        const n = this.human.raises.get(item.task) ?? 0;
        if (h.on_budget === 'raise' && n < h.max_raises) {
          this.human.raises.set(item.task, n + 1);
          this.decide(item.task, 'budget', { raise_usd: h.raise_usd });
        } else this.humanCommit(item.task, 'suspend', 'suspended', { reason: 'over budget; re-plan before spending more' });
        return;
      }
      case 'review-limit':
        if (t.status !== 'review') return;
        this.humanCommit(item.task, 'respec', 'spec-draft', { reason: 'the evaluator keeps rejecting it; the criteria need rework' });
        return;
      case 'grant': {
        const rt = this.runtimes.get(item.runtime ?? 'main');
        if (h.on_grant_expiry === 'renew' && rt.grant && !grantLiveAt(rt.grant, this.startMs + this.t * 60000)) {
          const n = Number(rt.grant.id.split('-')[1]) + 1;
          rt.grant = { ...structuredClone(rt.grant), id: `GRANT-${n}`, granted_at: this.iso(), expires_at: this.iso(this.t + h.renew_for_minutes), source: `sim: renewed by ${h.name} at ${this.iso()}` };
          delete rt.grant.revoked_at;
          this.artifacts.grants.push(structuredClone(rt.grant));
          this.decide(item.task, 'grant', { renewed: rt.grant.id });
        } else {
          for (const x of this.forge.tasks.values()) if (x.status === 'human-review') this.humanNotify({ kind: 'review', task: x.id, ref: 'grant-declined' });
          this.decide(item.task, 'grant', { renewed: null });
        }
        return;
      }
      case 'ci-limit':
      case 'no-progress':
      case 'crash-limit':
      case 'risk':
      case 'spend-limit':
      case 'dependency':
        if (['merged', 'suspended', 'spec-draft'].includes(t.status)) return;
        if (!this.m.transitions.get('suspend').from.includes(t.status)) { this.decide(item.task, item.kind, { action: 'acknowledged' }); return; }
        this.humanCommit(item.task, 'suspend', 'suspended', { reason: `${item.kind}: parked for a human plan` });
        return;
      default:
        this.decide(item.task, item.kind, { action: 'acknowledged' });
    }
  }

  // The orchestrator's own commit (it holds nothing by default; authority.yaml). Grant liveness is
  // judged at decision time: an action decided under a live grant finishes its step.
  supervisorCommit(rt, taskId, c, note) {
    const t = this.forge.tasks.get(taskId);
    const ms = this.startMs + this.t * 60000;
    const live = grantLiveAt(rt.grant, ms);
    this.push({
      task: taskId,
      from: t.status,
      expectOwner: t.owner,
      actor: rt.name,
      actorKind: 'agent',
      role: 'orchestrator',
      runtime: rt.name,
      grant: live ? rt.grant.id : null,
      grantSnapshot: rt.grant ? structuredClone(rt.grant) : null,
      grantLive: live,
      trigger: note ? { kind: note.kind, value: note.value ?? note.what ?? null } : null,
      ...c,
      onReject: () => this.webhook({ what: 'push-rejected', task: taskId }),
    });
  }
}
