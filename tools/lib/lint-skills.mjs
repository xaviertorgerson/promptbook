import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYamlText } from 'yaml';
import { splitFrontmatter, parseYaml, readText } from './loaders.mjs';
import { fenceMask, headings, splitLines, stripComments } from './markdown.mjs';
import { registry as sharedRegistry } from './registry.mjs';
import { validateAs } from './validate.mjs';

// The skill authoring rules (TOOLS.md, lint) as checks over a set of skill
// folders. A finding is { severity, rule, file, line, message }; rule names are stable so fixtures
// and CI can name them. The skill schema itself is checked by the validator (tools/lib/validate.mjs);
// lint adds what JSON Schema cannot see: the description's shape, the body's size and neutrality,
// links, and the evals folder.
//
// Errors are the Agent Skills spec's hard limits (the frontmatter, the name, a description of at most
// 1,024 characters), what breaks an installed skill (a link out of its folder, a malformed eval file,
// a route to no skill) and engine neutrality. promptbook's authoring style is advice: the rules in
// STYLE are warnings unless the skill's library asks for them in its SETS.yaml
// (lint: { strict: [rule...], skills: [name...] }), so one library's maintainers keep their own
// style while another's skills in the same library stay strict.

// Style heuristics: warnings unless strict. evals-present is strict-able too: by default it accepts
// a single evals/evals.md, strict it wants routing.jsonl, scenarios.md and evidence.md.
export const STYLE = new Set([
  'name-is-gerund', 'description-use-when', 'description-do-not-use-for', 'description-length', 'deprecated-description',
  'body-length', 'routing-counts', 'routing-kind-declared', 'scenarios-count', 'scenario-format', 'evidence-count', 'deprecated-never-triggers',
]);
export const STRICTABLE = new Set([...STYLE, 'evals-present']);

// Engine, runtime, forge, host and stack names an L3 skill body or description must not carry.
// references/engine-notes.md is the one place they may appear (adapters own the mapping).
export const DEFAULT_DENY_TERMS = [
  'Claude Code', 'Claude', 'Codex', 'Gemini', 'Antigravity', 'Herdr', 'Heeler', 'stagehand', 'OpenAI', 'Anthropic', 'Copilot',
  'GitHub', 'GitLab', 'Forgejo', 'Cloudflare', 'Coolify', 'Hetzner', 'Angular', 'NestJS', 'Drizzle', 'pnpm',
];

// Terms of art that contain a deny-listed word but name a practice, not a product: they are read
// as one word, so "Claude Search Optimization (CSO)" is not a mention of an engine.
export const TERMS_OF_ART = ['Claude Search Optimization'];

export const LIMITS = {
  bodyWarn: 200,
  bodyFail: 300,
  // A description is always in context: keep each short, and the whole set under the smallest
  // engine's always-loaded budget. Claude Code lists skills within skillListingBudgetFraction of
  // its context window (1% by default, about 8,000 characters at 200k tokens; the suite's settings
  // set 2%) and drops the least-used descriptions first; Codex keeps 2% of the window in tokens and
  // falls back to 8,000 characters only when the window is unknown. 10,000 sits under both at 2%
  // with margin. A library's SETS.yaml sets its own `budget`; this is the default for a bare folder.
  descriptionWarn: 300,
  descriptionFail: 400,
  descriptionBudget: 10000,
  positive: 4,
  nearMiss: 3,
  negative: 2,
  scenarios: 3,
  evidence: 1,
  overlap: 0.3,
};

const ENGINE_NOTES = 'references/engine-notes.md';

// Words that say nothing about when a skill applies; dropped before comparing trigger phrases.
const STOP = new Set(`a an and are as at be but by can could for from has have if in into is it its of on or
  so than that the their them then there these this those to was were what when where which while who
  will with you your use used using not do does any about only one two after before over under via such
  per each own same other more most less get set also just user users says say asks ask wants want runs
  run needs need like make made it's i we our something someone thing things way new`.split(/\s+/).filter(Boolean));

const stem = (w) => (w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function triggerTokens(description) {
  const m = description.match(/use when([\s\S]*?)(?:\bdo not use\b|$)/i);
  const text = m ? m[1] : description.split(/\bdo not use\b/i)[0];
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

const termRegExp = (term) => new RegExp(`(?<![A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![A-Za-z0-9])`, 'i');

// Gerund kebab-case: the first word ends in -ing (writing-requirements, debugging-failures).
export const isGerundName = (name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && /^[a-z]{2,}ing$/.test(name.split('-')[0]);

function skillDirs(target) {
  if (fs.existsSync(path.join(target, 'SKILL.md'))) return [target];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map((e) => path.join(target, e.name))
    .filter((d) => fs.existsSync(path.join(d, 'SKILL.md')))
    .sort();
}

function mdFiles(dir) {
  const out = [];
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visit(p);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    }
  };
  visit(dir);
  return out;
}

// Links in a Markdown file outside fences and inline code: [{ target, line }].
export function markdownLinks(text) {
  const lines = splitLines(stripComments(text));
  const mask = fenceMask(lines);
  const out = [];
  lines.forEach((raw, i) => {
    if (mask[i]) return;
    const line = raw.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push({ target: m[1], line: i + 1 });
    const def = line.match(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/);
    if (def) out.push({ target: def[1], line: i + 1 });
  });
  return out;
}

const isExternal = (t) => /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('#') || t.startsWith('//');

// Scenarios in scenarios.md: one per "## " heading, or per "### " heading when the file groups them.
// Each names a setup, a prompt, pass criteria and k (for pass^k): labels at the start of a line, bold
// or not, bulleted or not, with an optional parenthetical or variant letter ("- **Setup (M):** …",
// "**Prompt A:** …", "Fixture: …"); a bold label may follow another on one line. k may sit in the
// heading ("(k = 3)"). A setup or k stated once in the file's preamble ("Fixtures: …",
// "k = 3 for every scenario") covers every scenario.
const label = (words) => new RegExp(`(?:^\\s*(?:[-*+]\\s+)?(?:\\*\\*|__)?(?:${words})(?:\\s+[A-Z0-9])?(?:\\s*\\([^)]*\\))?\\s*(?::|\\.\\s*(?:\\*\\*|__)|(?:\\*\\*|__)\\s*:?)|\\*\\*(?:${words})(?:\\s+[A-Z0-9])?(?:\\s*\\([^)]*\\))?:\\*\\*)`, 'im');
const K = /(?:^\s*(?:[-*+]\s+)?(?:\*\*|__)?(?:k|pass\^k|trials)(?:\*\*|__)?\s*(?::|=)\s*(?:\*\*|__)?\s*\d|\bpass\^\d|\bpass\^k\s*(?:=|:|\(k\s*=)\s*\d|\bk\s*(?:=|≥|>=)\s*\d)/im;
const SCENARIO_FIELDS = [
  { id: 'setup', re: label('setup|set-up|fixtures?|given|context|state'), shared: label('setup|set-up|fixtures?|given|context') },
  { id: 'prompt', re: label('prompt|user prompt|input|request|user says|trigger|event|wake') },
  { id: 'pass criteria', re: label('pass criteria|pass when|pass|passes when|assertions?|expected|expect|then|success') },
  { id: 'k', re: K, shared: K, title: true },
];
const STOP_CONDITION = /needs-human|hand(?:s|ed)?(?: it)?(?: back| off)? to (?:a|the) human|stop condition|stops? and (?:asks?|escalates?)|escalat|human decision|must not (?:proceed|continue)/i;

export function parseScenarios(text) {
  const lines = splitLines(stripComments(text));
  const hs = headings(lines, fenceMask(lines)).filter((h) => h.level === 2 || h.level === 3);
  const level = hs.some((h) => h.level === 3) ? 3 : 2;
  const chosen = hs.filter((h) => h.level === level && !/^scenarios?\b/i.test(h.text));
  const preamble = lines.slice(0, chosen[0]?.index ?? lines.length).join('\n');
  return chosen.map((h) => {
    const next = hs.find((n) => n.index > h.index && n.level <= level);
    return { title: h.text, line: h.index + 1, body: lines.slice(h.index + 1, next ? next.index : lines.length).join('\n'), preamble };
  });
}

export const scenarioMissing = (sc) => SCENARIO_FIELDS.filter((x) => !x.re.test(sc.body) && !(x.title && x.re.test(sc.title)) && !(x.shared && x.shared.test(sc.preamble))).map((x) => x.id);

function loadFrontmatter(file) {
  const text = readText(file);
  const fm = splitFrontmatter(text);
  if (!fm) return { text, data: null, body: text, bodyLine: 1 };
  const y = parseYaml(fm.yaml, 1);
  // The usual cause of a frontmatter that does not parse: a plain value holding ": " (description:
  // Deprecated: use x), which YAML reads as a nested mapping.
  const colon = fm.yaml.split(/\r?\n/).findIndex((l) => /^\s*[A-Za-z_][\w-]*:\s+(?!["'|>])[^#]*:\s/.test(l));
  return { text, data: y.errors.length ? null : y.data, body: fm.body, bodyLine: fm.bodyLine, parseHint: y.errors.length && colon !== -1 ? `quote values that contain ": " (line ${colon + 2}: description: "…")` : null };
}

function validateWith(file, contract, format, captures, reg) {
  const artifact = reg.artifacts(contract).find((a) => a.format === format);
  return validateAs(file, { contract, artifact, captures, matched: null }, { registry: reg });
}

export function lintSkills(targets, opts = {}) {
  const reg = opts.registry ?? sharedRegistry();
  const limits = { ...LIMITS, ...(opts.limits ?? {}) };
  const denyTerms = (opts.denyTerms ?? DEFAULT_DENY_TERMS).filter((t) => !(opts.allowTerms ?? []).some((a) => a.toLowerCase() === t.toLowerCase()));
  const known = new Set([...(opts.known ?? []), 'none']);
  // Linting one skill folder still knows its siblings, so its near-misses can name them. A
  // near-miss may also route to what loads beside: the skills of the --sets library, and the
  // externals of every SETS.yaml that names the linted skills or that --sets gives.
  const resolved = targets.map((x) => path.resolve(x));
  for (const t of resolved) {
    if (fs.existsSync(path.join(t, 'SKILL.md'))) for (const d of skillDirs(path.dirname(t))) known.add(path.basename(d));
  }
  if (opts.setsFile) for (const d of skillsUnder(setsLibrary(opts.setsFile))) known.add(path.basename(d));
  const nearSets = [...resolved.map((t) => setsFileOf(fs.existsSync(path.join(t, 'SKILL.md')) ? path.dirname(t) : t)), opts.setsFile ?? null].filter(Boolean);
  for (const file of nearSets) for (const e of Object.values(loadSets(file).data?.external ?? {})) for (const n of e.skills) known.add(n);
  const dirs = [...new Set(targets.flatMap((t) => skillDirs(path.resolve(t))))];
  const skills = dirs.map((dir) => ({ dir, name: path.basename(dir), findings: [] }));
  const names = new Set(skills.map((s) => s.name));
  // The rules a skill is held to strictly: what its own library's SETS.yaml asks (lint.strict, for
  // the skills lint.skills names, or all of them), and opts.strictRules.
  const libraryLint = (s) => { const file = setsFileOf(path.dirname(s.dir)); return file ? loadSets(file).data?.lint ?? null : null; };
  const strictFor = (s) => {
    const lint = libraryLint(s);
    const own = lint && (!lint.skills || lint.skills.includes(s.name)) ? lint.strict ?? [] : [];
    return new Set([...(opts.strictRules ?? []), ...own]);
  };
  // The terms a library allows its skills to name (lint.allow_terms in its SETS.yaml: a forge's
  // name in a skill about pull requests), beside the caller's --allow-terms.
  const denyFor = (s) => { const allow = libraryLint(s)?.allow_terms ?? []; return denyTerms.filter((t) => !allow.some((a) => a.toLowerCase() === t.toLowerCase())); };

  for (const s of skills) {
    const strict = strictFor(s);
    s.strict = [...strict];
    const f = (severity, rule, file, line, message) => s.findings.push({ severity: severity === 'error' && STYLE.has(rule) && !strict.has(rule) ? 'warning' : severity, rule, file: file ? path.relative(s.dir, file) || path.basename(file) : null, line: line ?? null, message });
    const skillFile = path.join(s.dir, 'SKILL.md');
    const { data, body, bodyLine, parseHint } = loadFrontmatter(skillFile);
    s.description = typeof data?.description === 'string' ? data.description : '';
    s.deprecated = data?.metadata?.deprecated ?? null;

    // 1. The skill contract (agentskills.io core fields, name = directory).
    const v = validateWith(skillFile, 'skill', 'frontmatter-markdown', [s.name], reg);
    for (const x of v.findings) f(x.severity, x.rule, skillFile, x.line, `${x.pointer} ${x.message}${x.rule === 'parse-error' && parseHint ? `; ${parseHint}` : ''}`);
    if (data?.name && data.name !== s.name && !v.findings.some((x) => x.rule === 'name-matches-path')) {
      f('error', 'name-matches-path', skillFile, 2, `name is "${data.name}", the directory is "${s.name}"`);
    }
    if (!isGerundName(s.name)) f('error', 'name-is-gerund', skillFile, 2, `"${s.name}" is not gerund kebab-case (writing-requirements, debugging-failures)`);

    // 2. The description is a routing trigger, short enough to stay loaded. A deprecated skill's
    // description no longer triggers: it says "Deprecated:" first and names the replacement.
    const d = s.description;
    if (d.length > limits.descriptionFail) f('error', 'description-length', skillFile, 3, `description is ${d.length} characters (over ${limits.descriptionFail}; aim under ${limits.descriptionWarn}: the discriminating feature, the strongest triggers, one "Do not use for" neighbour; longer trigger lists go in the body)`);
    else if (d.length > limits.descriptionWarn) f('warning', 'description-length', skillFile, 3, `description is ${d.length} characters (aim under ${limits.descriptionWarn}; limit ${limits.descriptionFail})`);
    if (d && s.deprecated) {
      if (!/^Deprecated:/.test(d)) f('error', 'deprecated-description', skillFile, 3, 'a deprecated skill\'s description starts with "Deprecated:" and names its replacement, so no router picks it');
      else if (![...names, ...known].some((n) => n !== 'none' && n !== s.name && d.includes(n))) f('error', 'deprecated-description', skillFile, 3, 'the "Deprecated:" description names no replacement skill');
    } else if (d) {
      const useAt = d.search(/\bUse when\b/i);
      // "Do not use for …", "Do not use merely to …", "Do not use when …": any exclusion clause.
      const notAt = d.search(/\bDo not use\b/i);
      if (useAt === -1) f('error', 'description-use-when', skillFile, 3, 'description has no "Use when …" trigger clause');
      else if (useAt > 0) f('warning', 'description-leads-with-use-when', skillFile, 3, 'description should open with "Use when"');
      if (notAt === -1) f('error', 'description-do-not-use-for', skillFile, 3, 'description has no "Do not use …" clause naming what it is not for (and the neighbour skill that is)');
      else if (useAt !== -1 && notAt < useAt) f('warning', 'description-clause-order', skillFile, 3, '"Do not use for" comes before "Use when"');
      else if (!/\b[a-z]{2,}ing(?:-[a-z0-9]+)+\b/.test(d.slice(notAt)) && ![...names, ...known].some((n) => n !== 'none' && d.slice(notAt).includes(n))) {
        f('warning', 'do-not-use-names-neighbour', skillFile, 3, '"Do not use for" names no neighbouring skill, e.g. "(mapping-journeys)"');
      }
    }

    // 3. Body size.
    const bodyLines = body.replace(/\s+$/, '').split(/\r?\n/).length;
    if (bodyLines > limits.bodyFail) f('error', 'body-length', skillFile, bodyLine, `body is ${bodyLines} lines (over ${limits.bodyFail}; keep under ${limits.bodyWarn}, move detail to references/)`);
    else if (bodyLines > limits.bodyWarn) f('warning', 'body-length', skillFile, bodyLine, `body is ${bodyLines} lines (aim under ${limits.bodyWarn}; move detail to references/)`);

    // 4. Engine and vendor neutrality of the description and the body (URLs aside: a citation is not
    // a procedure step). One finding per line, naming the longest term that matched.
    const terms = denyFor(s).sort((a, b) => b.length - a.length).map((t) => ({ t, re: termRegExp(t) }));
    const arts = TERMS_OF_ART.map((t) => new RegExp(termRegExp(t).source, 'gi'));
    const named = (line) => {
      const text = arts.reduce((x, re) => x.replace(re, ' '), line.replace(/\bhttps?:\/\/\S+/g, ''));
      return terms.find(({ re }) => re.test(text))?.t;
    };
    if (named(d)) f('error', 'engine-neutral', skillFile, 3, `description names "${named(d)}"; engine notes go in ${ENGINE_NOTES}`);
    splitLines(body).forEach((l, i) => {
      const t = named(l);
      if (t) f('error', 'engine-neutral', skillFile, bodyLine + i, `body names "${t}"; engine notes go in ${ENGINE_NOTES}`);
    });

    // 5. Self-contained: no relative link leaves the skill folder.
    for (const file of mdFiles(s.dir)) {
      for (const { target, line } of markdownLinks(readText(file))) {
        if (isExternal(target)) continue;
        const clean = decodeURIComponent(target.replace(/[#?].*$/, ''));
        if (!clean) continue;
        const resolved = clean.startsWith('/') ? clean : path.resolve(path.dirname(file), clean);
        const rel = path.relative(s.dir, resolved);
        if (clean.startsWith('/') || rel.startsWith('..') || path.isAbsolute(rel)) {
          f('error', 'links-stay-in-skill', file, line, `link "${target}" leaves the skill folder; copy what it needs into references/`);
        } else if (!fs.existsSync(resolved)) {
          f('warning', 'link-target-exists', file, line, `link "${target}" points at nothing`);
        }
      }
    }

    // 6. evals/: routing cases, scenarios, evidence.
    const evals = path.join(s.dir, 'evals');
    const routing = path.join(evals, 'routing.jsonl');
    const scenarios = path.join(evals, 'scenarios.md');
    const evidence = path.join(evals, 'evidence.md');
    // A deprecated skill keeps routing (its old prompts, now routed elsewhere) and evidence (why it
    // went); its scenarios go with its body. Unless the library holds the skill to evals-present
    // strictly, one evals/evals.md (a test plan in prose) is evals enough.
    const required = s.deprecated ? [[routing, 'routing.jsonl'], [evidence, 'evidence.md']] : [[routing, 'routing.jsonl'], [scenarios, 'scenarios.md'], [evidence, 'evidence.md']];
    const plan = path.join(evals, 'evals.md');
    if (strict.has('evals-present') || !fs.existsSync(plan)) {
      const missing = required.filter(([file]) => !fs.existsSync(file));
      for (const [file, what] of missing) f('error', 'evals-present', file, null, `evals/${what} is missing${strict.has('evals-present') ? '' : ' (or keep one evals/evals.md)'}`);
    }

    if (fs.existsSync(routing)) {
      const r = validateWith(routing, 'evidence', 'jsonl', [s.name], reg);
      for (const x of r.findings) f(x.severity, x.rule === 'parse-error' ? 'routing-valid' : x.rule, routing, x.line, `${x.pointer} ${x.message}`);
      const cases = [];
      readText(routing).split(/\r?\n/).forEach((l, i) => {
        if (!l.trim()) return;
        try { cases.push({ ...JSON.parse(l), line: i + 1 }); } catch { /* reported by the validator */ }
      });
      s.cases = cases;
      const positive = cases.filter((c) => c.expect === 'trigger');
      const nearMiss = cases.filter((c) => c.kind === 'near-miss' && c.route_to);
      const negative = cases.filter((c) => c.kind === 'negative');
      for (const c of cases.filter((x) => /^needs route_to\b/.test(x.note ?? ''))) {
        f('error', 'imported-needs-review', routing, c.line, `an imported case awaits a human: ${c.note} (name the neighbour skill in route_to and make it a near-miss, or confirm a negative and drop the note)`);
      }
      for (const c of cases.filter((x) => x.expect === 'no-trigger' && !x.kind)) {
        f('error', 'routing-kind-declared', routing, c.line, 'a no-trigger case says whether it is a near-miss or a negative (kind)');
      }
      if (s.deprecated) {
        for (const c of positive) f('error', 'deprecated-never-triggers', routing, c.line, 'a deprecated skill keeps only no-trigger cases (its old prompts must route elsewhere)');
        if (!cases.length) f('error', 'routing-counts', routing, null, 'a deprecated skill keeps its old prompts as no-trigger cases');
        const replacement = [...s.deprecated.matchAll(/[a-z0-9]+(?:-[a-z0-9]+)+/g)].map((m) => m[0]).find((n) => names.has(n) || known.has(n));
        if (!replacement) f('warning', 'deprecated-names-replacement', skillFile, 2, `metadata.deprecated names no replacement skill: "${s.deprecated}"`);
      } else {
        const short = [];
        if (positive.length < limits.positive) short.push(`${positive.length} positive (need ≥ ${limits.positive})`);
        if (nearMiss.length < limits.nearMiss) short.push(`${nearMiss.length} near-miss with route_to (need ≥ ${limits.nearMiss})`);
        if (negative.length < limits.negative) short.push(`${negative.length} negative (need ≥ ${limits.negative})`);
        if (short.length) f('error', 'routing-counts', routing, null, short.join(', '));
      }
      for (const c of cases.filter((x) => x.route_to)) {
        if (c.route_to === s.name) f('error', 'route-to-self', routing, c.line, `a no-trigger case routes to ${s.name} itself`);
        else if (!names.has(c.route_to) && !known.has(c.route_to)) {
          f('error', 'route-to-known', routing, c.line, `route_to "${c.route_to}" is neither a scanned skill, a skill loaded beside it (the --sets library, a SETS.yaml external), --known, nor "none"`);
        }
      }
    }

    if (fs.existsSync(scenarios)) {
      splitLines(readText(scenarios)).forEach((l, i) => {
        if (/TODO\(import\)/.test(l)) f('error', 'imported-needs-review', scenarios, i + 1, `an imported scenario awaits a human: ${l.trim().slice(0, 100)}`);
      });
      const list = parseScenarios(readText(scenarios));
      if (list.length < limits.scenarios && !s.deprecated) f('error', 'scenarios-count', scenarios, null, `${list.length} scenario(s) (need ≥ ${limits.scenarios}, each a "## " or "### " heading)`);
      for (const sc of list) {
        const missing = scenarioMissing(sc);
        if (missing.length) f('error', 'scenario-format', scenarios, sc.line, `"${sc.title}" lacks ${missing.join(', ')} (setup · prompt · pass criteria · k for pass^k)`);
      }
      if (list.length && !s.deprecated && !list.some((sc) => STOP_CONDITION.test(`${sc.title}\n${sc.body}`))) {
        f('warning', 'scenario-stop-condition', scenarios, null, 'no scenario where the skill must stop and hand to a human (needs-human)');
      }
    }

    if (fs.existsSync(evidence)) {
      const r = validateWith(evidence, 'evidence', 'markdown-entries', [s.name], reg);
      for (const x of r.findings) f(x.severity, x.rule === 'no-entries' ? 'evidence-count' : x.rule, evidence, x.line, `${x.pointer} ${x.message}`);
      if (r.records < limits.evidence && !r.findings.some((x) => x.rule === 'no-entries')) f('error', 'evidence-count', evidence, null, `${r.records} evidence entr(ies) (need ≥ ${limits.evidence})`);
    }
  }

  // 7. Descriptions that overlap: two skills competing for the same trigger phrases.
  const overlaps = [];
  const tok = skills.map((s) => triggerTokens(s.description));
  for (let i = 0; i < skills.length; i += 1) {
    for (let j = i + 1; j < skills.length; j += 1) {
      if (skills[i].deprecated || skills[j].deprecated) continue;
      const score = jaccard(tok[i], tok[j]);
      if (score > limits.overlap) {
        const shared = [...tok[i]].filter((x) => tok[j].has(x)).sort();
        overlaps.push({ severity: 'warning', rule: 'description-overlap', a: skills[i].name, b: skills[j].name, score: Number(score.toFixed(3)), shared, message: `${skills[i].name} ↔ ${skills[j].name}: trigger overlap ${score.toFixed(2)} > ${limits.overlap} (shared: ${shared.join(', ')}); sharpen one description or merge them` });
      }
    }
  }

  // 8. The set's always-loaded budget. A library with its own SETS.yaml is never installed whole:
  // each of its sets is checked against the budget instead (9), so the folder's total is not one.
  const total = skills.reduce((a, s) => a + s.description.length, 0);
  const library = targets.length > 0 && targets.every((x) => setsFileOf(path.resolve(x)));
  if (!library && total > limits.descriptionBudget) {
    const longest = [...skills].sort((a, b) => b.description.length - a.description.length).slice(0, 3).map((s) => `${s.name} ${s.description.length}`);
    overlaps.push({ severity: 'warning', rule: 'description-budget', score: total, message: `the ${skills.length} descriptions total ${total} characters, over the ${limits.descriptionBudget} an engine may keep loaded (2% of a 200k window, with margin); longest: ${longest.join(', ')}` });
  }

  // 9. Install sets: the SETS.yaml of a linted library (in the folder, or at the root above its
  // skills/), and the one --sets names, each checked against the skills of its library.
  const setsFiles = [...new Set([...targets.map((x) => setsFileOf(path.resolve(x))).filter(Boolean), ...(opts.setsFile ? [path.resolve(opts.setsFile)] : [])])];
  const sets = setsFiles.map((file) => lintSets(file, librarySkills(file), { externalDirs: opts.externalDirs ?? {} }));

  const all = [...skills.flatMap((s) => s.findings), ...overlaps, ...sets.flatMap((x) => x.findings)];
  const counts = { skills: skills.length, error: all.filter((x) => x.severity === 'error').length, warning: all.filter((x) => x.severity === 'warning').length };
  for (const s of skills) s.status = s.findings.some((x) => x.severity === 'error') ? 'FAIL' : 'PASS';
  return {
    skills: skills.map(({ dir, name, status, findings, description, deprecated, strict }) => ({ dir, name, status, deprecated, description, strict, findings })),
    overlaps,
    sets,
    counts,
  };
}

// ------------------------------------------------------------------------------------- install sets

// A skill library's SETS.yaml (Skilldex's) names what a machine (scope user) or a project (scope
// project) installs, and what a session loads beside it (loaded_with: other sets, externals); scope
// library is the whole library, never installed. Every installed set, with what it is loaded with,
// stays within the always-loaded budget less its headroom. The file sits beside the skills it names
// or at the library's root above its skills/ folder.
export const SETS_FILE = 'SETS.yaml';
const SET_SCOPES = ['user', 'project', 'library'];

// The folder whose skills a SETS.yaml names.
export function setsLibrary(file) {
  const dir = path.dirname(path.resolve(file));
  return skillDirs(dir).length || !fs.existsSync(path.join(dir, 'skills')) ? dir : path.join(dir, 'skills');
}

// The SETS.yaml that names a folder's skills: in the folder, or at the root above a skills/ folder.
export function setsFileOf(dir) {
  const own = path.join(dir, SETS_FILE);
  if (fs.existsSync(own)) return own;
  const root = path.join(path.dirname(dir), SETS_FILE);
  return path.basename(dir) === 'skills' && fs.existsSync(root) && setsLibrary(root) === dir ? root : null;
}

// Each skill of a SETS.yaml's library, with its description: { name, description }.
function librarySkills(file) {
  return skillDirs(setsLibrary(file)).map((d) => {
    const { data: fm } = loadFrontmatter(path.join(d, 'SKILL.md'));
    return { name: path.basename(d), description: typeof fm?.description === 'string' ? fm.description : '' };
  });
}

export function loadSets(file) {
  const errors = [];
  let data;
  try { data = parseYamlText(readText(file)); } catch (e) { return { data: null, errors: [`not YAML: ${e.message}`] }; }
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  if (!isObj(data)) return { data: null, errors: ['a mapping with budget, external and sets'] };
  for (const k of Object.keys(data)) if (!['budget', 'external', 'sets', 'lint'].includes(k)) errors.push(`${k}: unknown key (budget, external, sets, lint)`);
  if (data.lint !== undefined) {
    if (!isObj(data.lint) || !strings(data.lint.strict ?? []) || (data.lint.skills !== undefined && !strings(data.lint.skills)) || (data.lint.allow_terms !== undefined && !strings(data.lint.allow_terms))) errors.push('lint: { strict: [rule names], skills: [skill names], allow_terms: [names] } (skills optional: every skill of the library)');
    for (const k of Object.keys(isObj(data.lint) ? data.lint : {})) if (!['strict', 'skills', 'allow_terms'].includes(k)) errors.push(`lint.${k}: unknown key (strict, skills, allow_terms)`);
    for (const r of Array.isArray(data.lint?.strict) ? data.lint.strict : []) if (!STRICTABLE.has(r)) errors.push(`lint.strict: ${r} is no rule lint can make strict (${[...STRICTABLE].join(', ')})`);
  }
  if (!isObj(data.budget) || !Number.isInteger(data.budget.limit) || !(data.budget.headroom >= 0 && data.budget.headroom < 1)) errors.push('budget: { limit: <characters>, headroom: <0..1> }');
  for (const [n, e] of Object.entries(data.external ?? {})) {
    if (!isObj(e) || !strings(e.skills) || !Number.isInteger(e.chars)) errors.push(`external.${n}: { source, commit, skills: [names], chars: <measured> }`);
    for (const k of Object.keys(e ?? {})) if (!['source', 'commit', 'skills', 'chars'].includes(k)) errors.push(`external.${n}.${k}: unknown key`);
  }
  if (!isObj(data.sets) || !Object.keys(data.sets).length) errors.push('sets: a mapping of set names');
  for (const [n, s] of Object.entries(data.sets ?? {})) {
    if (!isObj(s)) { errors.push(`sets.${n}: a mapping`); continue; }
    for (const k of Object.keys(s)) if (!['scope', 'about', 'skills', 'includes', 'loaded_with'].includes(k)) errors.push(`sets.${n}.${k}: unknown key (scope, about, skills, includes, loaded_with)`);
    if (!SET_SCOPES.includes(s.scope)) errors.push(`sets.${n}.scope: one of ${SET_SCOPES.join(', ')}`);
    for (const k of ['skills', 'includes', 'loaded_with']) if (s[k] !== undefined && !strings(s[k])) errors.push(`sets.${n}.${k}: a list of names`);
    if (!s.skills?.length && !s.includes?.length) errors.push(`sets.${n}: names skills or includes other sets`);
  }
  return { data: errors.length ? null : data, errors };
}

// The skill names a set installs (its skills and those of the sets it includes).
export function setSkills(data, name, stack = []) {
  const s = data.sets[name];
  if (!s || stack.includes(name)) return new Set();
  const out = new Set(s.skills ?? []);
  for (const inc of s.includes ?? []) for (const x of setSkills(data, inc, [...stack, name])) out.add(x);
  return out;
}

// What a session holding this set loads: [{ from, name, chars }], the set's skills, then each
// loaded_with set's, then each external's (read from its checkout when one is given, else the
// measured chars).
export function setLoad(data, name, chars, { externalDirs = {} } = {}) {
  const parts = [];
  const seen = new Set();
  const addSet = (n) => { for (const sk of setSkills(data, n)) if (!seen.has(sk)) { seen.add(sk); parts.push({ from: n, name: sk, chars: chars.get(sk) ?? 0 }); } };
  addSet(name);
  for (const w of data.sets[name]?.loaded_with ?? []) {
    if (data.sets[w]) addSet(w);
    else if (data.external?.[w]) {
      const e = data.external[w];
      const dir = externalDirs[w];
      if (dir && fs.existsSync(dir)) {
        for (const d of skillsUnder(dir)) {
          const { data: fm } = loadFrontmatter(path.join(d, 'SKILL.md'));
          if (!e.skills.includes(fm?.name ?? path.basename(d))) continue;
          parts.push({ from: w, name: fm?.name ?? path.basename(d), chars: typeof fm?.description === 'string' ? fm.description.length : 0 });
        }
      } else parts.push({ from: w, name: `${w} (${e.skills.length} skills, measured at ${e.commit})`, chars: e.chars, count: e.skills.length });
    }
  }
  return { parts, total: parts.reduce((a, p) => a + p.chars, 0) };
}

// --budget-set <name>: one set of a SETS.yaml, as budgetSet reports a file (what a session holding
// it loads, against the budget less its headroom; over it is an error, set-over-budget).
export function budgetSetByName(setsFile, name, { externalDirs = {} } = {}) {
  const { data, errors } = loadSets(setsFile);
  if (!data) throw new Error(`${setsFile}: ${errors.join('; ')}`);
  if (!data.sets[name]) throw new Error(`${setsFile} has no set ${name} (sets: ${Object.keys(data.sets).join(', ')})`);
  const load = setLoad(data, name, new Map(librarySkills(setsFile).map((s) => [s.name, s.description.length])), { externalDirs });
  const limit = Math.floor(data.budget.limit * (1 - data.budget.headroom));
  const findings = [];
  if (data.sets[name].scope !== 'library' && load.total > limit) findings.push({ severity: 'error', rule: 'set-over-budget', message: `${name} loads ${load.total} characters, over ${limit} (${data.budget.limit} less ${Math.round(data.budget.headroom * 100)}% headroom)` });
  if (data.sets[name].scope === 'library') findings.push({ severity: 'warning', rule: 'set-not-installed', message: `${name} is the library scope: nothing installs it whole (${load.total} of ${limit})` });
  return { file: `${path.resolve(setsFile)}#${name}`, skills: load.parts.map((p) => ({ name: p.name, from: p.from, chars: p.chars, count: p.count ?? 1 })), total: load.total, limit, findings };
}

export function lintSets(file, skills, { externalDirs = {} } = {}) {
  const findings = [];
  const f = (severity, rule, message) => findings.push({ severity, rule, file: path.basename(file), message });
  const { data, errors } = loadSets(file);
  for (const e of errors) f('error', 'sets-shape', e);
  if (!data) return { file, findings, sets: [] };
  const chars = new Map(skills.map((s) => [s.name, s.description.length]));
  const names = new Set(skills.map((s) => s.name));
  for (const sk of data.lint?.skills ?? []) if (!names.has(sk)) f('error', 'sets-known', `lint.skills names ${sk}, which is no skill here`);
  for (const [n, s] of Object.entries(data.sets)) {
    for (const sk of s.skills ?? []) if (!names.has(sk)) f('error', 'sets-known', `sets.${n} names ${sk}, which is no skill here`);
    for (const inc of s.includes ?? []) if (!data.sets[inc]) f('error', 'sets-known', `sets.${n} includes ${inc}, which is no set`);
    for (const w of s.loaded_with ?? []) if (!data.sets[w] && !data.external?.[w]) f('error', 'sets-known', `sets.${n} is loaded with ${w}, which is no set or external`);
  }
  // Each skill belongs to exactly one set's own list, and some installable set installs it.
  const owner = new Map();
  for (const [n, s] of Object.entries(data.sets)) for (const sk of s.skills ?? []) {
    if (owner.has(sk)) f('error', 'sets-disjoint', `${sk} is listed by both ${owner.get(sk)} and ${n}: list a skill in one set and include that set`);
    else owner.set(sk, n);
  }
  const installed = new Set(Object.entries(data.sets).filter(([, s]) => s.scope !== 'library').flatMap(([n]) => [...setSkills(data, n)]));
  for (const sk of names) if (!installed.has(sk)) f('error', 'sets-cover', `${sk} is in no user or project set, so nothing installs it`);
  const out = [];
  const limit = Math.floor(data.budget.limit * (1 - data.budget.headroom));
  for (const [n, s] of Object.entries(data.sets)) {
    const load = setLoad(data, n, chars, { externalDirs });
    out.push({ name: n, scope: s.scope, skills: setSkills(data, n).size, ...load, limit });
    if (s.scope === 'library') continue;
    if (load.total > limit) {
      const by = Object.entries(load.parts.reduce((m, p) => ({ ...m, [p.from]: (m[p.from] ?? 0) + p.chars }), {})).map(([k, v]) => `${k} ${v}`).join(', ');
      f('error', 'set-over-budget', `${n} (${s.scope}) loads ${load.total} characters with what it is loaded with (${by}), over ${limit}: the ${data.budget.limit}-character budget less ${Math.round(data.budget.headroom * 100)}% headroom; split the set or shorten its descriptions`);
    }
  }
  marketplaceFindings(file, data).forEach((m) => f('error', 'marketplace-sets', m));
  return { file, findings, sets: out };
}

// A library that packages its sets as plugins (.claude-plugin/marketplace.json at its root) keeps
// one plugin per installable set, each with exactly that set's skills.
function marketplaceFindings(file, data) {
  const lib = setsLibrary(file);
  const market = path.join(path.dirname(lib), '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(market)) return [];
  let plugins;
  try { plugins = JSON.parse(readText(market)).plugins; } catch (e) { return [`.claude-plugin/marketplace.json: not JSON: ${e.message}`]; }
  if (!Array.isArray(plugins)) return ['.claude-plugin/marketplace.json: no plugins list'];
  const out = [];
  const installable = Object.entries(data.sets).filter(([, s]) => s.scope !== 'library').map(([n]) => n);
  for (const n of installable) if (!plugins.some((pl) => pl?.name === n)) out.push(`set ${n} has no plugin in .claude-plugin/marketplace.json`);
  for (const pl of plugins) {
    const name = pl?.name;
    if (!installable.includes(name)) { out.push(`plugin ${name} is no installable set of ${SETS_FILE}`); continue; }
    const base = path.resolve(path.dirname(lib), typeof pl.source === 'string' ? pl.source : '.');
    const listed = Array.isArray(pl.skills) ? pl.skills.map((x) => path.resolve(base, x)) : skillDirs(path.join(base, 'skills'));
    const outside = listed.filter((d) => path.dirname(d) !== lib);
    for (const d of outside) out.push(`plugin ${name} lists ${path.relative(path.dirname(lib), d)}, outside ${path.relative(path.dirname(lib), lib) || '.'}`);
    const got = new Set(listed.map((d) => path.basename(d)));
    const want = setSkills(data, name);
    const missing = [...want].filter((x) => !got.has(x));
    const extra = [...got].filter((x) => !want.has(x));
    if (missing.length || extra.length) out.push(`plugin ${name} differs from set ${name}${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; extra ${extra.join(', ')}` : ''}`);
  }
  return out;
}

// ------------------------------------------------------------------------------------- budget set

// The always-loaded budget applies to what an engine actually loads: every skill a machine profile
// installs (a skill library's, a project's, a runtime's), not the folder being linted. A budget set
// names that installed set, as either
//   a list of skill folders or folders of skills (YAML list, or one path per line; # comments), or
//   a toolkit.lock (or toolkit.yaml) in the toolkit-lock contract: each entry with a local source
//   contributes the skills under source/path (or source/skills), narrowed to the install sets its
//   `sets` names (read from the library's SETS.yaml) and to its x-skills list, when it has them; a
//   remote entry cannot be read and is reported, not guessed.
// Paths are relative to the set's file; ~ is the home directory.
const expandHome = (p) => (p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p);
const isRemoteSource = (s) => /^(?:https:\/\/|ssh:\/\/|git@|file:)/.test(s);

function skillsUnder(dir) {
  if (fs.existsSync(path.join(dir, 'SKILL.md'))) return [dir];
  const direct = skillDirs(dir);
  return direct.length || !fs.existsSync(path.join(dir, 'skills')) ? direct : skillDirs(path.join(dir, 'skills'));
}

export function budgetSet(file, { limit = LIMITS.descriptionBudget } = {}) {
  const base = path.dirname(path.resolve(file));
  const text = readText(file);
  const findings = [];
  const sources = [];
  let data;
  try { data = parseYamlText(text); } catch { data = null; }
  const resolve = (p) => path.resolve(base, expandHome(String(p)));
  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.entries)) {
    for (const e of data.entries) {
      if (!e?.source) continue;
      if (isRemoteSource(e.source)) {
        findings.push({ severity: 'warning', rule: 'budget-set-unread', message: `${e.name}: ${e.source} is remote; its skills are not counted (list the installed folders instead)` });
        continue;
      }
      const dir = resolve(path.join(e.source, e.path ?? ''));
      let only = Array.isArray(e['x-skills']) ? new Set(e['x-skills']) : null;
      if (Array.isArray(e.sets) && fs.existsSync(dir)) {
        const lib = skillDirs(dir).length || !fs.existsSync(path.join(dir, 'skills')) ? dir : path.join(dir, 'skills');
        const file = setsFileOf(lib);
        const data = file ? loadSets(file).data : null;
        if (!data) { findings.push({ severity: 'error', rule: 'budget-set-sets', message: `${e.name}: names sets ${e.sets.join(', ')}, but ${lib} has no valid ${SETS_FILE}` }); continue; }
        const unknown = e.sets.filter((n) => !data.sets[n]);
        if (unknown.length) { findings.push({ severity: 'error', rule: 'budget-set-sets', message: `${e.name}: ${file} has no set ${unknown.join(', ')} (sets: ${Object.keys(data.sets).join(', ')})` }); continue; }
        const inSets = new Set(e.sets.flatMap((n) => [...setSkills(data, n)]));
        only = only ? new Set([...only].filter((x) => inSets.has(x))) : inSets;
      }
      sources.push({ from: e.name, dir, only: only ? [...only] : null });
    }
  } else {
    const list = Array.isArray(data) ? data : text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
    for (const p of list) sources.push({ from: String(p), dir: resolve(p), only: null });
  }
  const seen = new Set();
  const skills = [];
  for (const src of sources) {
    if (!fs.existsSync(src.dir) || !fs.statSync(src.dir).isDirectory()) {
      findings.push({ severity: 'error', rule: 'budget-set-missing', message: `${src.from}: ${src.dir} is not a folder` });
      continue;
    }
    for (const dir of skillsUnder(src.dir)) {
      if (src.only && !src.only.includes(path.basename(dir))) continue;
      if (seen.has(dir)) continue;
      seen.add(dir);
      const { data: fm } = loadFrontmatter(path.join(dir, 'SKILL.md'));
      const description = typeof fm?.description === 'string' ? fm.description : '';
      if (!description) findings.push({ severity: 'warning', rule: 'budget-set-unread', message: `${dir}: no description in SKILL.md; counted as 0` });
      skills.push({ name: fm?.name ?? path.basename(dir), dir, from: src.from, chars: description.length });
    }
  }
  const total = skills.reduce((a, s) => a + s.chars, 0);
  if (total > limit) {
    const longest = [...skills].sort((a, b) => b.chars - a.chars).slice(0, 3).map((s) => `${s.name} ${s.chars}`);
    const byFrom = Object.entries(skills.reduce((m, s) => ({ ...m, [s.from]: (m[s.from] ?? 0) + 1 }), {})).map(([k, n]) => `${n} from ${k}`).join(', ');
    findings.push({ severity: 'warning', rule: 'description-budget', score: total, message: `the installed set's ${skills.length} descriptions total ${total} characters, over the ${limit} an engine may keep loaded (2% of a 200k window, with margin), so some may be cut before a router sees them (${byFrom}; longest: ${longest.join(', ')}); install a per-profile subset` });
  }
  return { file: path.resolve(file), skills, total, limit, findings };
}
