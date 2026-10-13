import fs from 'node:fs';
import path from 'node:path';
import { criteria, DEFAULT_TEST_GLOBS, namedIn, testNames } from './ears.mjs';
import { findFiles, globsOverlap, toPosix } from './glob.mjs';
import { loadFrontmatterMarkdown, readText } from './loaders.mjs';
import { parseDecisions, parseEpicAdrs, parseJourneys, parsePersonas, parseRequirements, parseTaskIndex, parseUxFlows } from './parsers.mjs';
import { fenceMask, headings, section, splitLines, stripComments } from './markdown.mjs';
import { registry as sharedRegistry } from './registry.mjs';
import { inferContracts, validateAs } from './validate.mjs';

// The trace graph (CONTRACTS.md, "Trace graph"):
//   BRIEF -> PER -> CUJ -> REQ|NFR -> UX (user-facing CUJs) -> TASK.AC -> test name
//   ADR <-> REQ|NFR it satisfies; every TASK cites >= 1 REQ/NFR; no orphans at readiness.
//
// Severity policy:
//   error    a broken reference (an id or path that does not exist), an artifact that fails its
//            contract, a dependency cycle; or a missing link on an artifact that claims readiness
//            (epic approved/in-progress/done, task ready or later).
//   warning  a missing link on an artifact that does not claim readiness yet (the to-do list for
//            approval); every link the harness introduces (personas, task->REQ, REQ->CUJ, UX, ADR
//            satisfies) while the project is in legacy adoption; advisory consistency findings.
//   info     rules skipped because their layer does not exist yet.
// Adoption is "full" when docs/product/brief.md exists, otherwise "legacy" (an agentic-template
// project from before the product docs). blocks_readiness marks gaps that keep an epic from ready.

export const TRACE_VERSION = '1.0.0';
export const DEFAULT_MODE = 'spec-driven';

// A task's methodology: its own mode, else its epic's, else spec-driven (common.schema.json mode).
export const effectiveMode = (task, epic) => task?.mode ?? epic?.mode ?? DEFAULT_MODE;
const CLAIMED_EPIC = new Set(['approved', 'in-progress', 'done']);
const CLAIMED_TASK = new Set(['ready', 'in-progress', 'review', 'human-review', 'merging', 'integrated', 'merged']);
const EVIDENCED_TASK = new Set(['review', 'human-review', 'merging', 'integrated', 'merged']);
// Requirement ids named in a task's prose. REQ-n and NFR-n anywhere; the legacy R<n> only as "(R2)"
// or "requirement R2", because a bare R2 is as likely to be Cloudflare R2 as requirement 2.
const REQ_TOKEN = /\b(?:REQ|NFR)-[1-9][0-9]*\b|\(R[1-9][0-9]*\)|\brequirements? R[1-9][0-9]*\b/gi;
const normReq = (tok) => {
  const legacy = tok.match(/R([1-9][0-9]*)\)?$/i);
  return /^(?:REQ|NFR)-/i.test(tok) ? tok.toUpperCase() : `REQ-${legacy[1]}`;
};

const rel = (root, f) => toPosix(path.relative(root, f));

// A task file's "# ID · title" text, or ''.
function titleOf(text) {
  const lines = splitLines(stripComments(text));
  return headings(lines, fenceMask(lines)).find((h) => h.level === 1)?.text ?? '';
}

// Unchecked Open questions that say they block ("**Blocks readiness**", "(blocking)", "Blocks AC-2").
export function blockingQuestions(text) {
  const lines = splitLines(stripComments(text));
  const sec = section(lines, /^Open questions\b/i);
  if (!sec) return [];
  return sec.lines.flatMap((l, i) => {
    const m = !sec.mask[i] && l.match(/^\s*[-*]\s+\[ \]\s+(.*)$/);
    return m && /\bblock(?:s|ing|ed)?\b/i.test(m[1]) ? [{ text: m[1].trim(), line: sec.start + i + 1 }] : [];
  });
}

// The walking skeleton (playbook: walking-skeleton): marked x-skeleton: true, tagged x-tags:
// [skeleton], or titled "Walking skeleton".
const isSkeleton = (t) => t['x-skeleton'] === true || [].concat(t['x-tags'] ?? []).some((x) => /^(?:walking-)?skeleton$/i.test(x)) || /\bwalking skeleton\b/i.test(t.title ?? '');
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// Resolve "<epic>/X-n" or "X-n" (in the citing epic) to "<epic>/X-n".
const qualify = (ref, epic) => (ref.includes('/') ? ref : `${epic}/${ref}`);

function loadProject(root, { testGlobs = DEFAULT_TEST_GLOBS, testPatterns = [], registry = sharedRegistry() } = {}) {
  const p = {
    root,
    brief: null,
    personas: new Map(),
    epics: new Map(),
    decisions: new Map(),
    testFiles: [],
    names: [],
    invalid: [],
  };
  const validateInto = (file) => {
    for (const hit of inferContracts(file, { registry })) {
      const r = validateAs(file, hit, { registry });
      for (const f of r.findings.filter((x) => x.severity === 'error')) p.invalid.push({ file: rel(root, file), contract: r.contract, ...f });
    }
  };

  const briefFile = path.join(root, 'docs/product/brief.md');
  if (exists(briefFile)) {
    validateInto(briefFile);
    const l = loadFrontmatterMarkdown(readText(briefFile));
    p.brief = { file: rel(root, briefFile), data: l.records[0]?.data ?? {}, line: 1 };
  }
  const personaFiles = [path.join(root, 'docs/product/personas.md'), ...findFiles(root, ['docs/product/personas/*.md'])].filter(exists);
  for (const file of personaFiles) {
    validateInto(file);
    const recs = path.basename(file) === 'personas.md' ? parsePersonas(readText(file)).records : loadFrontmatterMarkdown(readText(file)).records;
    for (const r of recs) if (r.data?.id) p.personas.set(r.data.id, { ...r.data, file: rel(root, file), line: r.line });
  }

  const specsDir = path.join(root, 'specs');
  const epicDirs = exists(specsDir) ? fs.readdirSync(specsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.')).map((e) => e.name).sort() : [];
  for (const slug of epicDirs) {
    const dir = path.join(specsDir, slug);
    const e = { slug, spec: null, status: null, journeys: new Map(), requirements: new Map(), tasks: new Map(), index: [], adrs: { ids: [], line: null }, ux: new Map(), files: {} };
    const spec = path.join(dir, 'spec.md');
    if (exists(spec)) {
      validateInto(spec);
      const text = readText(spec);
      e.files.spec = rel(root, spec);
      e.spec = loadFrontmatterMarkdown(text).records[0]?.data ?? {};
      e.status = e.spec.status ?? null;
      for (const r of parseRequirements(text, { epic: slug }).records) e.requirements.set(r.data.id, { ...r.data, line: r.line });
      e.index = parseTaskIndex(text);
      e.adrs = parseEpicAdrs(text);
    }
    const cuj = path.join(dir, 'cuj.md');
    if (exists(cuj)) {
      validateInto(cuj);
      e.files.cuj = rel(root, cuj);
      for (const r of parseJourneys(readText(cuj), { epic: slug }).records) if (!r.stub) e.journeys.set(r.data.id, { ...r.data, line: r.line });
    }
    for (const file of findFiles(dir, ['tasks/*.md']).filter((f) => !path.basename(f).startsWith('_'))) {
      validateInto(file);
      const text = readText(file);
      const data = loadFrontmatterMarkdown(text).records[0]?.data;
      if (!data?.id) continue;
      const crit = criteria(text).items.filter((c) => c.id && !c.placeholder);
      const prose = text.replace(/^---[\s\S]*?\n---/, '');
      const mentioned = [...new Set((prose.match(REQ_TOKEN) ?? []).map(normReq))];
      e.tasks.set(data.id, { ...data, file: rel(root, file), criteria: crit, mentioned, title: titleOf(text), blocking: blockingQuestions(text) });
    }
    const ux = path.join(root, 'docs/ux', `${slug}.md`);
    if (exists(ux)) {
      validateInto(ux);
      e.files.ux = rel(root, ux);
      for (const r of parseUxFlows(readText(ux), { epic: slug }).records) e.ux.set(r.data.id, { ...r.data, line: r.line });
    }
    p.epics.set(slug, e);
  }

  const decisionFiles = [path.join(root, 'DECISIONS.md'), ...findFiles(root, ['docs/adr/*.md'])].filter(exists);
  for (const file of decisionFiles) {
    validateInto(file);
    for (const r of parseDecisions(readText(file)).records) p.decisions.set(r.data.id, { ...r.data, file: rel(root, file), line: r.line });
  }

  p.testFiles = findFiles(root, testGlobs);
  for (const f of p.testFiles) p.names.push(...testNames(readText(f), { file: f, patterns: testPatterns }));
  p.testGlobs = testGlobs;
  return p;
}

export function trace(root, opts = {}) {
  root = path.resolve(root);
  const p = loadProject(root, opts);
  const adoption = p.brief ? 'full' : 'legacy';
  const gaps = [];
  const gap = (g) => gaps.push(g);

  // Severity for a missing link. scope: the epic or task whose readiness the link is part of.
  const missing = ({ harness, claims }) => {
    if (harness && adoption === 'legacy') return 'warning';
    return claims ? 'error' : 'warning';
  };

  // ---------------------------------------------------------------- artifacts and product layer
  for (const f of p.invalid) {
    gap({ rule: 'artifact-valid', severity: 'error', subject: f.file, message: `${f.contract}: ${f.rule} at ${f.pointer}: ${f.message}`, file: f.file, line: f.line ?? null });
  }

  const allJourneys = new Map();
  for (const e of p.epics.values()) for (const j of e.journeys.values()) allJourneys.set(`${e.slug}/${j.id}`, { ...j, epic: e.slug });
  const allRequirements = new Map();
  for (const e of p.epics.values()) for (const r of e.requirements.values()) allRequirements.set(`${e.slug}/${r.id}`, { ...r, epic: e.slug });
  const allTasks = new Map();
  for (const e of p.epics.values()) for (const t of e.tasks.values()) allTasks.set(t.id, { ...t, epicSlug: e.slug });

  if (adoption === 'legacy') {
    gap({ rule: 'brief-exists', severity: 'warning', subject: 'docs/product/brief.md', message: 'no product brief: legacy adoption. The trace starts at journeys; persona links are not checked and harness-introduced links (task->REQ, REQ->CUJ, UX, ADR satisfies) are warnings, not errors.', file: 'docs/product/brief.md', line: null });
    gap({ rule: 'rules-skipped', severity: 'info', subject: 'product layer', message: 'skipped until docs/product exists: persona-exists, persona-has-journey, persona-in-brief, journey-cites-persona, user-facing-journey-has-ux', file: null, line: null });
  } else {
    for (const id of p.brief.data.personas ?? []) {
      if (!p.personas.has(id)) gap({ rule: 'persona-exists', severity: 'error', subject: 'BRIEF', message: `the brief cites ${id}, which no persona file defines`, file: p.brief.file, line: 1 });
    }
    const cited = new Set([...allJourneys.values()].flatMap((j) => j.personas ?? []));
    for (const [id, per] of p.personas) {
      if (!cited.has(id)) gap({ rule: 'persona-has-journey', severity: 'warning', subject: id, message: `${id} (${per.name}) is served by no journey`, file: per.file, line: per.line });
      if (p.brief.data.personas && !p.brief.data.personas.includes(id)) gap({ rule: 'persona-in-brief', severity: 'warning', subject: id, message: `${id} is not listed in the brief's personas`, file: per.file, line: per.line });
    }
  }

  // ---------------------------------------------------------------- decisions
  const adrStatus = (id) => p.decisions.get(id)?.status;
  for (const d of p.decisions.values()) {
    for (const ref of [...(d.superseded_by ?? []), ...(d.refined_by ?? []), ...(d.supersedes_ids ?? [])]) {
      if (!p.decisions.has(ref)) gap({ rule: 'decision-exists', severity: 'error', subject: d.id, message: `${d.id} names ${ref}, which DECISIONS.md does not define`, file: d.file, line: d.line });
    }
    for (const ref of d.satisfies ?? []) {
      if (!allRequirements.has(ref)) gap({ rule: 'requirement-exists', severity: 'error', subject: d.id, message: `${d.id} satisfies ${ref}, which no spec.md defines`, file: d.file, line: d.line });
      else {
        const r = allRequirements.get(ref);
        if (r.adrs && !r.adrs.includes(d.id)) gap({ rule: 'decision-link-agrees', severity: 'warning', subject: ref, message: `${d.id} says it satisfies ${ref}, but ${ref}'s ADR column lists ${r.adrs.join(', ')}`, file: d.file, line: d.line });
      }
    }
  }

  // ---------------------------------------------------------------- tests
  const testsPresent = p.testFiles.length > 0;
  if (!testsPresent) {
    gap({ rule: 'tests-exist', severity: 'warning', subject: 'tests', message: `no test file matches ${p.testGlobs.length} glob(s); criterion coverage is not checked (as agentic-template's ears-coverage does in status mode)`, file: null, line: null });
  }
  const acCount = new Map();
  for (const t of allTasks.values()) for (const c of t.criteria) acCount.set(c.id, (acCount.get(c.id) ?? 0) + 1);

  // ---------------------------------------------------------------- epics
  const epics = [];
  for (const e of p.epics.values()) {
    const epicClaims = CLAIMED_EPIC.has(e.status);
    const before = gaps.length;
    const cov = { journeys: { covered: 0, total: e.journeys.size }, requirements: { covered: 0, total: e.requirements.size }, tasks: { covered: 0, total: e.tasks.size }, criteria: { covered: 0, total: 0 } };
    const egap = (g) => gap({ epic: e.slug, ...g });

    if (!e.spec) egap({ rule: 'epic-has-spec', severity: 'error', subject: e.slug, message: 'the epic folder has no spec.md', file: `specs/${e.slug}/spec.md`, line: null, blocks_readiness: true });
    if (!e.files.cuj) egap({ rule: 'epic-has-journeys', severity: missing({ claims: epicClaims }), subject: e.slug, message: 'the epic has no cuj.md', file: `specs/${e.slug}/cuj.md`, line: null, blocks_readiness: true });
    for (const id of e.adrs.ids) {
      if (!p.decisions.has(id)) egap({ rule: 'decision-exists', severity: 'error', subject: e.slug, message: `the spec header cites ${id}, which DECISIONS.md does not define`, file: e.files.spec, line: e.adrs.line });
    }

    // Task -> journey, task -> requirement, task -> task, guiding docs, criteria -> tests.
    const journeyTasks = new Map([...e.journeys.keys()].map((k) => [k, []]));
    const requirementTasks = new Map([...e.requirements.keys()].map((k) => [k, { strong: [], weak: [] }]));
    for (const t of e.tasks.values()) {
      const tClaims = CLAIMED_TASK.has(t.status);
      const cujs = t.cuj == null ? [] : [].concat(t.cuj);
      if (!cujs.length) egap({ rule: 'task-serves-journey', severity: 'warning', subject: t.id, message: `${t.id} serves no journey (cuj: null); a task no CUJ needs is probably scope creep`, file: t.file, line: null });
      for (const c of cujs) {
        const q = qualify(c, e.slug);
        if (!allJourneys.has(q)) egap({ rule: 'journey-exists', severity: 'error', subject: t.id, message: `${t.id} serves ${c}, which ${q.split('/')[0]}/cuj.md does not define`, file: t.file, line: null });
        else if (q.startsWith(`${e.slug}/`)) journeyTasks.get(q.split('/')[1])?.push(t.id);
      }
      const strong = t.requirements ?? [];
      for (const r of strong) {
        const q = qualify(r, e.slug);
        if (!allRequirements.has(q)) egap({ rule: 'requirement-exists', severity: 'error', subject: t.id, message: `${t.id} cites ${r}, which ${q.split('/')[0]}/spec.md does not define`, file: t.file, line: null });
        else if (q.startsWith(`${e.slug}/`)) requirementTasks.get(q.split('/')[1]).strong.push(t.id);
      }
      const weak = t.mentioned.filter((r) => e.requirements.has(r) && !strong.includes(r));
      for (const r of weak) requirementTasks.get(r).weak.push(t.id);
      if (strong.length) cov.tasks.covered += 1;
      else if (weak.length) {
        cov.tasks.covered += 1;
        egap({ rule: 'task-cites-requirement', severity: 'warning', subject: t.id, message: `${t.id} names ${weak.join(', ')} only in prose; add requirements: [${weak.join(', ')}] to its frontmatter`, file: t.file, line: null });
      } else {
        egap({ rule: 'task-cites-requirement', severity: missing({ harness: true, claims: tClaims }), subject: t.id, message: `${t.id} cites no requirement of ${e.slug}/spec.md (requirements: [REQ-n])`, file: t.file, line: null, blocks_readiness: true });
      }
      for (const d of [...(t.depends_on ?? []), ...(t.parent ? [t.parent] : [])]) {
        if (!allTasks.has(d)) egap({ rule: 'task-exists', severity: 'error', subject: t.id, message: `${t.id} depends on ${d}, which no task file defines`, file: t.file, line: null });
      }
      for (const doc of t.guiding_docs ?? []) {
        if (/^https?:\/\//.test(doc)) continue;
        const [file, anchor] = doc.split('#');
        if (!exists(path.join(root, file))) {
          egap({ rule: 'guiding-doc-exists', severity: 'error', subject: t.id, message: `${t.id} guiding doc ${doc} does not exist`, file: t.file, line: null });
        } else if (anchor && /^ADR-[0-9]{4}$/.test(anchor)) {
          if (!p.decisions.has(anchor)) egap({ rule: 'decision-exists', severity: 'error', subject: t.id, message: `${t.id} guiding doc ${doc}: ${anchor} is not in DECISIONS.md`, file: t.file, line: null });
          else if (adrStatus(anchor) === 'superseded') egap({ rule: 'cites-current-decision', severity: 'warning', subject: t.id, message: `${t.id} reads ${anchor}, which is superseded by ${(p.decisions.get(anchor).superseded_by ?? []).join(', ')}`, file: t.file, line: null });
        }
      }
      for (const c of t.criteria) {
        cov.criteria.total += 1;
        if (!testsPresent) continue;
        const qualified = p.names.some((n) => namedIn([n], t.id) && namedIn([n], c.id));
        const bare = qualified || namedIn(p.names, c.id);
        if (bare) cov.criteria.covered += 1;
        if (!EVIDENCED_TASK.has(t.status)) continue;
        if (!bare) egap({ rule: 'criterion-named-in-test', severity: 'error', subject: `${t.id} ${c.id}`, message: `${t.id} is ${t.status} but no test name contains ${c.id}`, file: t.file, line: c.line, blocks_readiness: true });
        else if (!qualified && acCount.get(c.id) > 1) egap({ rule: 'criterion-evidence-unambiguous', severity: 'warning', subject: `${t.id} ${c.id}`, message: `${c.id} appears in a test name, but ${acCount.get(c.id)} tasks have a ${c.id}; name the test "${t.id} ${c.id} ..."`, file: t.file, line: c.line });
      }
    }
    if (!testsPresent) cov.criteria.covered = 0;

    // Dependency cycles (within and across epics, reported once per epic that holds a member).
    const seen = new Set();
    const onPath = [];
    const visit = (id) => {
      if (onPath.includes(id)) {
        const cycle = [...onPath.slice(onPath.indexOf(id)), id];
        if (cycle.some((x) => e.tasks.has(x))) egap({ rule: 'dependencies-acyclic', severity: 'error', subject: cycle[0], message: `dependency cycle: ${cycle.join(' -> ')}`, file: allTasks.get(cycle[0])?.file ?? null, line: null });
        return;
      }
      if (seen.has(id) || !allTasks.has(id)) return;
      seen.add(id);
      onPath.push(id);
      for (const d of allTasks.get(id).depends_on ?? []) visit(d);
      onPath.pop();
    };
    for (const id of e.tasks.keys()) visit(id);

    // The plan's shape (playbook: walking-skeleton, single-writer, plan-readiness). Missing order is
    // a warning until the epic claims readiness; harness-introduced, so a warning in legacy adoption.
    const ancestors = new Map();
    const ancestorsOf = (id, stack = new Set()) => {
      if (ancestors.has(id)) return ancestors.get(id);
      const out = new Set();
      if (stack.has(id)) return out;
      stack.add(id);
      for (const d of allTasks.get(id)?.depends_on ?? []) { out.add(d); for (const x of ancestorsOf(d, stack)) out.add(x); }
      stack.delete(id);
      ancestors.set(id, out);
      return out;
    };
    const ordered = (a, b) => ancestorsOf(a).has(b) || ancestorsOf(b).has(a);
    const open = [...e.tasks.values()].filter((t) => !['merged', 'integrated'].includes(t.status));
    for (let i = 0; i < open.length; i += 1) {
      for (let j = i + 1; j < open.length; j += 1) {
        const [a, b] = [open[i], open[j]];
        if (!a.touches?.length || !b.touches?.length || ordered(a.id, b.id)) continue;
        const shared = a.touches.flatMap((x) => b.touches.filter((y) => globsOverlap(x, y)).map((y) => (x === y ? x : `${x} ~ ${y}`)));
        if (shared.length) egap({ rule: 'overlapping-tasks-ordered', severity: missing({ harness: true, claims: epicClaims }), subject: `${a.id} ${b.id}`, message: `${a.id} and ${b.id} can run in parallel but both touch ${shared.join(', ')}; one must depend on the other (one lane, one writer)`, file: b.file, line: null, blocks_readiness: true });
      }
    }
    const skeletons = [...e.tasks.values()].filter(isSkeleton);
    if (skeletons.length > 1) egap({ rule: 'skeleton-is-root', severity: missing({ harness: true, claims: epicClaims }), subject: skeletons.map((t) => t.id).join(' '), message: `${skeletons.length} tasks are marked as the walking skeleton; an epic has one`, file: skeletons[1].file, line: null, blocks_readiness: true });
    for (const sk of skeletons.slice(0, 1)) {
      const upstream = [...ancestorsOf(sk.id)].filter((d) => e.tasks.has(d));
      if (upstream.length) egap({ rule: 'skeleton-is-root', severity: missing({ harness: true, claims: epicClaims }), subject: sk.id, message: `the walking skeleton ${sk.id} depends on ${upstream.join(', ')}; it is the root of the epic's graph`, file: sk.file, line: null, blocks_readiness: true });
      const loose = [...e.tasks.values()].filter((t) => t.id !== sk.id && !ancestorsOf(t.id).has(sk.id)).map((t) => t.id);
      if (loose.length) egap({ rule: 'skeleton-is-root', severity: missing({ harness: true, claims: epicClaims }), subject: sk.id, message: `${loose.join(', ')} ${loose.length > 1 ? 'do' : 'does'} not depend on the walking skeleton ${sk.id}; nothing else runs before the skeleton lands`, file: sk.file, line: null, blocks_readiness: true });
    }
    // One-way doors the epic relies on are decided before it is ready.
    const cited = new Set([...e.adrs.ids, ...[...e.requirements.values()].flatMap((r) => r.adrs ?? [])]);
    for (const d of p.decisions.values()) if ((d.satisfies ?? []).some((r) => r.startsWith(`${e.slug}/`))) cited.add(d.id);
    for (const t of e.tasks.values()) for (const doc of t.guiding_docs ?? []) { const a = doc.split('#')[1]; if (a && /^ADR-[0-9]{4}$/.test(a)) cited.add(a); }
    for (const id of [...cited].sort()) {
      const d = p.decisions.get(id);
      if (d?.door === 'one-way' && d.status === 'proposed') egap({ rule: 'one-way-door-decided', severity: missing({ harness: true, claims: epicClaims }), subject: id, message: `${id} (${d.title}) is a one-way door still proposed; decide it before the epic is ready`, file: d.file, line: d.line, blocks_readiness: true });
    }
    // A ready task has no open blocking question and fits in one pass (not XL).
    for (const t of e.tasks.values()) {
      const tClaims = CLAIMED_TASK.has(t.status);
      if (t.status === 'ready') for (const q of t.blocking) egap({ rule: 'ready-task-unblocked', severity: missing({ harness: true, claims: true }), subject: t.id, message: `${t.id} is ready with an open blocking question: "${q.text.slice(0, 100)}"; answer it or move the task to needs-input`, file: t.file, line: q.line, blocks_readiness: true });
      if (t.size === 'XL') egap({ rule: 'task-size-fits', severity: missing({ harness: true, claims: tClaims }), subject: t.id, message: `${t.id} is XL; split it before it is ready (an XL task does not fit one reviewed pass)`, file: t.file, line: null, blocks_readiness: tClaims });
    }

    // The spec's Tasks index against the task files.
    const indexed = new Map(e.index.map((r) => [r.id, r]));
    for (const r of e.index) {
      if (!e.tasks.has(r.id)) egap({ rule: 'task-index-agrees', severity: 'warning', subject: r.id, message: `spec.md Tasks lists ${r.id}, which has no task file`, file: e.files.spec, line: r.line });
    }
    for (const t of e.tasks.values()) {
      const row = indexed.get(t.id);
      if (!row) { if (e.index.length) egap({ rule: 'task-index-agrees', severity: 'warning', subject: t.id, message: `${t.id} is missing from spec.md's Tasks table`, file: e.files.spec, line: null }); continue; }
      const fm = new Set((t.cuj == null ? [] : [].concat(t.cuj)).map((c) => c.split('/').pop()));
      const extra = (row.cujs ?? []).filter((c) => !fm.has(c));
      if (row.cujs && extra.length) egap({ rule: 'task-index-agrees', severity: 'warning', subject: t.id, message: `spec.md Tasks says ${t.id} serves ${row.cujs.join(', ')}; its frontmatter says ${[...fm].join(', ') || 'none'}. Write cuj: [${row.cujs.join(', ')}]`, file: t.file, line: null });
    }

    // Journeys: a task covers each; a requirement serves each; personas; UX for user-facing ones.
    const uxByJourney = new Map();
    for (const u of e.ux.values()) for (const c of u.cujs ?? []) {
      const q = qualify(c, e.slug);
      if (!allJourneys.has(q)) egap({ rule: 'journey-exists', severity: 'error', subject: u.id, message: `${u.id} designs ${c}, which no cuj.md defines`, file: e.files.ux, line: u.line });
      (uxByJourney.get(q) ?? uxByJourney.set(q, []).get(q)).push(u.id);
    }
    for (const u of e.ux.values()) for (const r of u.requirements ?? []) {
      if (!allRequirements.has(qualify(r, e.slug))) egap({ rule: 'requirement-exists', severity: 'error', subject: u.id, message: `${u.id} cites ${r}, which no spec.md defines`, file: e.files.ux, line: u.line });
    }
    const reqJourneys = new Map();
    for (const r of e.requirements.values()) {
      for (const c of r.cujs ?? []) {
        const q = qualify(c, e.slug);
        if (!allJourneys.has(q)) egap({ rule: 'journey-exists', severity: 'error', subject: r.id, message: `${r.id} serves ${c}, which no cuj.md defines`, file: e.files.spec, line: r.line });
        else (reqJourneys.get(q) ?? reqJourneys.set(q, new Set()).get(q)).add(r.id);
      }
    }
    // Derived requirement -> journey links through the tasks that implement both.
    for (const t of e.tasks.values()) {
      const rs = [...(t.requirements ?? []), ...t.mentioned.filter((r) => e.requirements.has(r))].map((r) => qualify(r, e.slug));
      for (const c of t.cuj == null ? [] : [].concat(t.cuj)) {
        const q = qualify(c, e.slug);
        for (const r of rs) (reqJourneys.get(q) ?? reqJourneys.set(q, new Set()).get(q)).add(r.split('/')[1]);
      }
    }
    for (const j of e.journeys.values()) {
      const q = `${e.slug}/${j.id}`;
      const tasks = journeyTasks.get(j.id) ?? [];
      if (tasks.length) cov.journeys.covered += 1;
      else {
        const viaIndex = e.index.filter((r) => (r.cujs ?? []).includes(j.id)).map((r) => r.id);
        egap({ rule: 'journey-has-task', severity: missing({ claims: epicClaims }), subject: j.id, message: viaIndex.length ? `no task's cuj: names ${j.id}; spec.md Tasks attributes it to ${viaIndex.join(', ')} (fix the frontmatter)` : `${j.id} (${j.title}) is served by no task`, file: e.files.cuj, line: j.line, blocks_readiness: true });
      }
      if (!(reqJourneys.get(q)?.size)) egap({ rule: 'journey-has-requirement', severity: missing({ harness: true, claims: epicClaims }), subject: j.id, message: `no requirement of ${e.slug} serves ${j.id} (add a CUJ column to the Requirements table, or cite requirements from its tasks)`, file: e.files.cuj, line: j.line, blocks_readiness: true });
      if (adoption === 'full') {
        if (!(j.personas ?? []).length) egap({ rule: 'journey-cites-persona', severity: missing({ claims: epicClaims }), subject: j.id, message: `${j.id} names no persona (- **Personas:** PER-n)`, file: e.files.cuj, line: j.line, blocks_readiness: true });
        for (const per of j.personas ?? []) if (!p.personas.has(per)) egap({ rule: 'persona-exists', severity: 'error', subject: j.id, message: `${j.id} cites ${per}, which no persona file defines`, file: e.files.cuj, line: j.line });
        if (j.user_facing === undefined) egap({ rule: 'journey-says-user-facing', severity: 'warning', subject: j.id, message: `${j.id} does not say whether it is user-facing (- **User-facing:** yes|no)`, file: e.files.cuj, line: j.line });
        if (j.user_facing === true && !uxByJourney.get(q)?.length) egap({ rule: 'user-facing-journey-has-ux', severity: missing({ claims: epicClaims }), subject: j.id, message: `${j.id} is user-facing and no flow in docs/ux/${e.slug}.md designs it`, file: e.files.cuj, line: j.line, blocks_readiness: true });
      }
    }

    // Requirements: each implemented by a task; an NFR names the decision that satisfies it.
    for (const r of e.requirements.values()) {
      const impl = requirementTasks.get(r.id);
      if (impl.strong.length || impl.weak.length) cov.requirements.covered += 1;
      else egap({ rule: 'requirement-has-task', severity: missing({ harness: true, claims: epicClaims }), subject: r.id, message: `${r.id}${r.source_id && r.source_id !== r.id ? ` (${r.source_id})` : ''} is implemented by no task`, file: e.files.spec, line: r.line, blocks_readiness: true });
      for (const a of r.adrs ?? []) if (!p.decisions.has(a)) egap({ rule: 'decision-exists', severity: 'error', subject: r.id, message: `${r.id} cites ${a}, which DECISIONS.md does not define`, file: e.files.spec, line: r.line });
      if (r.kind === 'non-functional') {
        const satisfiedBy = [...p.decisions.values()].filter((d) => (d.satisfies ?? []).includes(`${e.slug}/${r.id}`)).map((d) => d.id);
        if (!satisfiedBy.length && !(r.adrs ?? []).length) egap({ rule: 'nfr-has-decision', severity: 'warning', subject: r.id, message: `no ADR satisfies ${r.id} (**Satisfies:** ${e.slug}/${r.id}, or an ADR column)`, file: e.files.spec, line: r.line });
      }
    }
    for (const u of e.ux.values()) if (!(u.cujs ?? []).length) egap({ rule: 'ux-flow-serves-journey', severity: 'warning', subject: u.id, message: `${u.id} designs no journey`, file: e.files.ux, line: u.line });

    // Modes: the epic's mode is the default; a task's own mode overrides it (playbook: modes).
    const mode = e.spec?.mode ?? DEFAULT_MODE;
    const taskModes = {};
    for (const t of e.tasks.values()) {
      taskModes[t.id] = effectiveMode(t, e.spec);
      if (t.mode && e.spec?.mode && t.mode !== e.spec.mode) egap({ rule: 'task-mode-overrides-epic', severity: 'info', subject: t.id, message: `${t.id} runs ${t.mode}; the epic's default is ${e.spec.mode}`, file: t.file, line: null });
    }

    const mine = gaps.slice(before);
    const counts = { error: 0, warning: 0, info: 0 };
    for (const g of mine) counts[g.severity] += 1;
    const verdict = counts.error === 0 && !mine.some((g) => g.blocks_readiness) ? 'ready' : 'not-ready';
    epics.push({ epic: e.slug, epic_status: e.status ?? 'intake', mode, task_modes: taskModes, verdict, counts, coverage: cov, gaps: mine });
  }

  const counts = { error: 0, warning: 0, info: 0 };
  for (const g of gaps) counts[g.severity] += 1;
  return { root, adoption, generator: `harness/validate@${TRACE_VERSION}`, counts, epics, gaps, tests: { files: p.testFiles.length, names: p.names.length, globs: p.testGlobs } };
}

// The readiness report for one epic (schemas/readiness-report.schema.json), as Markdown text.
export function renderReadiness(result, epic, { now = new Date().toISOString(), commit } = {}) {
  const e = result.epics.find((x) => x.epic === epic);
  if (!e) throw new Error(`no epic ${epic}`);
  const fm = {
    epic: e.epic,
    generated_at: now.replace(/\.\d{3}Z$/, 'Z'),
    generator: result.generator,
    ...(commit ? { source_commit: commit } : {}),
    adoption: result.adoption,
    epic_status: e.epic_status,
    verdict: e.verdict,
    counts: e.counts,
    coverage: e.coverage,
    gaps: e.gaps.map((g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null && v !== undefined))),
  };
  const ratio = (r) => `${r.covered}/${r.total}`;
  const yaml = (v, ind = '') => {
    if (Array.isArray(v)) return v.length ? v.map((x) => `\n${ind}- ${yaml(x, `${ind}  `).trimStart()}`).join('') : ' []';
    if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `\n${ind}${k}:${typeof x === 'object' && x !== null ? yaml(x, `${ind}  `) : ` ${JSON.stringify(x)}`}`).join('');
    return JSON.stringify(v);
  };
  const front = yaml(fm).replace(/^\n/, '').replace(/\n(\s*)- \n\s*/g, '\n$1- ');
  const lines = [
    '---', front, '---', '',
    `# Readiness · ${e.epic}`, '',
    '<!-- Generated by tools/validate.mjs --trace. Do not edit; regenerate. -->', '',
    '## Verdict', '',
    `**${e.verdict}** — epic status \`${e.epic_status}\`, ${result.adoption} adoption: ${e.counts.error} error(s), ${e.counts.warning} warning(s).`, '',
    '## Coverage', '',
    '| Link | Covered |', '|---|---|',
    `| Journeys served by a task | ${ratio(e.coverage.journeys)} |`,
    `| Requirements implemented by a task | ${ratio(e.coverage.requirements)} |`,
    `| Tasks citing a requirement | ${ratio(e.coverage.tasks)} |`,
    `| Criteria named in a test | ${ratio(e.coverage.criteria)} |`, '',
    '## Gaps', '',
    ...(e.gaps.length ? ['| Severity | Rule | Subject | Finding |', '|---|---|---|---|', ...e.gaps.map((g) => `| ${g.severity}${g.blocks_readiness ? ' (blocks)' : ''} | ${g.rule} | ${g.subject} | ${g.message.replace(/\|/g, '\\|')} |`)] : ['None.']),
    '',
  ];
  return lines.join('\n');
}
