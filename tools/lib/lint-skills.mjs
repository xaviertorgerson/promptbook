import fs from 'node:fs';
import path from 'node:path';
import { splitFrontmatter, parseYaml, readText } from './loaders.mjs';
import { fenceMask, headings, splitLines, stripComments } from './markdown.mjs';
import { registry as sharedRegistry } from './registry.mjs';
import { validateAs } from './validate.mjs';

// The skill authoring rules (README "skills/", the skill catalog) as checks over a set of skill
// folders. A finding is { severity, rule, file, line, message }; rule names are stable so fixtures
// and CI can name them. The skill schema itself is checked by the validator (tools/lib/validate.mjs);
// lint adds what JSON Schema cannot see: the description's shape, the body's size and neutrality,
// links, and the evals folder.

// Skilldex skills the harness pins rather than authors; a near-miss may route to them.
export const PINNED_EXTERNAL = ['reviewing-code', 'preparing-pull-requests', 'resolving-findings', 'writing-specifications', 'building-skills'];

// Engine, runtime, forge, host and stack names an L3 skill body or description must not carry.
// references/engine-notes.md is the one place they may appear (adapters own the mapping).
export const DEFAULT_DENY_TERMS = [
  'Claude Code', 'Claude', 'Codex', 'Gemini', 'Antigravity', 'Herdr', 'Heeler', 'stagehand', 'OpenAI', 'Anthropic', 'Copilot',
  'GitHub', 'GitLab', 'Forgejo', 'Cloudflare', 'Coolify', 'Hetzner', 'Angular', 'NestJS', 'Drizzle', 'pnpm',
];

export const LIMITS = {
  bodyWarn: 200,
  bodyFail: 300,
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
  const m = description.match(/use when([\s\S]*?)(?:\bdo not use for\b|$)/i);
  const text = m ? m[1] : description;
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
// Each names a setup, a prompt, pass criteria and k (for pass^k) as labels at the start of a line,
// bold or not, bulleted or not ("- **Setup:** …", "Fixture: …"); common synonyms are accepted.
const label = (words) => new RegExp(`^\\s*(?:[-*+]\\s+)?(?:\\*\\*|__)?(?:${words})(?:\\s*\\([^)]*\\))?\\s*(?::\\s*(?:\\*\\*|__)|(?:\\*\\*|__)\\s*:|:)`, 'im');
const SCENARIO_FIELDS = [
  { id: 'setup', re: label('setup|set-up|fixture|given|context|state') },
  { id: 'prompt', re: label('prompt|user prompt|input|request|user says|trigger') },
  { id: 'pass criteria', re: label('pass criteria|pass|passes when|assertions?|expected|expect|then|success') },
  { id: 'k', re: /(?:^\s*(?:[-*+]\s+)?(?:\*\*|__)?(?:k|pass\^k|trials)(?:\*\*|__)?\s*(?::|=)\s*(?:\*\*|__)?\s*\d|\bpass\^\d|\bpass\^k\s*(?:=|:|\(k\s*=)\s*\d|\bk\s*(?:=|≥|>=)\s*\d)/im },
];
const STOP_CONDITION = /needs-human|hand(?:s|ed)?(?: it)?(?: back| off)? to (?:a|the) human|stop condition|stops? and (?:asks?|escalates?)|escalat|human decision|must not (?:proceed|continue)/i;

export function parseScenarios(text) {
  const lines = splitLines(stripComments(text));
  const hs = headings(lines, fenceMask(lines)).filter((h) => h.level === 2 || h.level === 3);
  const level = hs.some((h) => h.level === 3) ? 3 : 2;
  const chosen = hs.filter((h) => h.level === level && !/^scenarios?\b/i.test(h.text));
  return chosen.map((h) => {
    const next = hs.find((n) => n.index > h.index && n.level <= level);
    return { title: h.text, line: h.index + 1, body: lines.slice(h.index + 1, next ? next.index : lines.length).join('\n') };
  });
}

function loadFrontmatter(file) {
  const text = readText(file);
  const fm = splitFrontmatter(text);
  if (!fm) return { text, data: null, body: text, bodyLine: 1 };
  const y = parseYaml(fm.yaml, 1);
  return { text, data: y.errors.length ? null : y.data, body: fm.body, bodyLine: fm.bodyLine };
}

function validateWith(file, contract, format, captures, reg) {
  const artifact = reg.artifacts(contract).find((a) => a.format === format);
  return validateAs(file, { contract, artifact, captures, matched: null }, { registry: reg });
}

export function lintSkills(targets, opts = {}) {
  const reg = opts.registry ?? sharedRegistry();
  const limits = { ...LIMITS, ...(opts.limits ?? {}) };
  const denyTerms = (opts.denyTerms ?? DEFAULT_DENY_TERMS).filter((t) => !(opts.allowTerms ?? []).some((a) => a.toLowerCase() === t.toLowerCase()));
  const known = new Set([...PINNED_EXTERNAL, ...(opts.known ?? []), 'none']);
  // Linting one skill folder still knows its siblings, so its near-misses can name them.
  for (const t of targets.map((x) => path.resolve(x))) {
    if (fs.existsSync(path.join(t, 'SKILL.md'))) for (const d of skillDirs(path.dirname(t))) known.add(path.basename(d));
  }
  const dirs = [...new Set(targets.flatMap((t) => skillDirs(path.resolve(t))))];
  const skills = dirs.map((dir) => ({ dir, name: path.basename(dir), findings: [] }));
  const names = new Set(skills.map((s) => s.name));

  for (const s of skills) {
    const f = (severity, rule, file, line, message) => s.findings.push({ severity, rule, file: file ? path.relative(s.dir, file) || path.basename(file) : null, line: line ?? null, message });
    const skillFile = path.join(s.dir, 'SKILL.md');
    const { data, body, bodyLine } = loadFrontmatter(skillFile);
    s.description = typeof data?.description === 'string' ? data.description : '';
    s.deprecated = data?.metadata?.deprecated ?? null;

    // 1. The skill contract (agentskills.io core fields, name = directory).
    const v = validateWith(skillFile, 'skill', 'frontmatter-markdown', [s.name], reg);
    for (const x of v.findings) f(x.severity, x.rule, skillFile, x.line, `${x.pointer} ${x.message}`);
    if (data?.name && data.name !== s.name && !v.findings.some((x) => x.rule === 'name-matches-path')) {
      f('error', 'name-matches-path', skillFile, 2, `name is "${data.name}", the directory is "${s.name}"`);
    }
    if (!isGerundName(s.name)) f('error', 'name-is-gerund', skillFile, 2, `"${s.name}" is not gerund kebab-case (writing-requirements, debugging-failures)`);

    // 2. The description is a routing trigger.
    const d = s.description;
    if (d) {
      const useAt = d.search(/\bUse when\b/);
      const notAt = d.search(/\bDo not use for\b/);
      if (useAt === -1) f('error', 'description-use-when', skillFile, 3, 'description has no "Use when …" trigger clause');
      else if (useAt > 0) f('warning', 'description-leads-with-use-when', skillFile, 3, 'description should open with "Use when"');
      if (notAt === -1) f('error', 'description-do-not-use-for', skillFile, 3, 'description has no "Do not use for … (<neighbour>)" clause');
      else if (useAt !== -1 && notAt < useAt) f('warning', 'description-clause-order', skillFile, 3, '"Do not use for" comes before "Use when"');
      else if (!/\b[a-z]{2,}ing(?:-[a-z0-9]+)+\b/.test(d.slice(notAt)) && ![...names, ...known].some((n) => n !== 'none' && d.slice(notAt).includes(n))) {
        f('warning', 'do-not-use-names-neighbour', skillFile, 3, '"Do not use for" names no neighbouring skill, e.g. "(mapping-journeys)"');
      }
    }

    // 3. Body size.
    const bodyLines = body.replace(/\s+$/, '').split(/\r?\n/).length;
    if (bodyLines > limits.bodyFail) f('error', 'body-length', skillFile, bodyLine, `body is ${bodyLines} lines (limit ${limits.bodyFail}; keep under ${limits.bodyWarn}, move detail to references/)`);
    else if (bodyLines > limits.bodyWarn) f('warning', 'body-length', skillFile, bodyLine, `body is ${bodyLines} lines (aim under ${limits.bodyWarn}; move detail to references/)`);

    // 4. Engine and vendor neutrality of the description and the body (URLs aside: a citation is not
    // a procedure step). One finding per line, naming the longest term that matched.
    const terms = [...denyTerms].sort((a, b) => b.length - a.length).map((t) => ({ t, re: termRegExp(t) }));
    const named = (line) => terms.find(({ re }) => re.test(line.replace(/\bhttps?:\/\/\S+/g, '')))?.t;
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
    // went); its scenarios go with its body.
    const required = s.deprecated ? [[routing, 'routing.jsonl'], [evidence, 'evidence.md']] : [[routing, 'routing.jsonl'], [scenarios, 'scenarios.md'], [evidence, 'evidence.md']];
    for (const [file, what] of required) {
      if (!fs.existsSync(file)) f('error', 'evals-present', file, null, `evals/${what} is missing`);
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
          f('error', 'route-to-known', routing, c.line, `route_to "${c.route_to}" is neither a scanned skill nor a pinned external (${PINNED_EXTERNAL.join(', ')}) nor "none"`);
        }
      }
    }

    if (fs.existsSync(scenarios)) {
      const list = parseScenarios(readText(scenarios));
      if (list.length < limits.scenarios && !s.deprecated) f('error', 'scenarios-count', scenarios, null, `${list.length} scenario(s) (need ≥ ${limits.scenarios}, each a "## " or "### " heading)`);
      for (const sc of list) {
        const missing = SCENARIO_FIELDS.filter((x) => !x.re.test(sc.body)).map((x) => x.id);
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

  const all = [...skills.flatMap((s) => s.findings), ...overlaps];
  const counts = { skills: skills.length, error: all.filter((x) => x.severity === 'error').length, warning: all.filter((x) => x.severity === 'warning').length };
  for (const s of skills) s.status = s.findings.some((x) => x.severity === 'error') ? 'FAIL' : 'PASS';
  return {
    skills: skills.map(({ dir, name, status, findings, description, deprecated }) => ({ dir, name, status, deprecated, description, findings })),
    overlaps,
    counts,
  };
}
