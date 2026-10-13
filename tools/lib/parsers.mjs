import { classify } from './ears.mjs';
import { splitFrontmatter, parseYaml } from './loaders.mjs';
import { blocks, boldFields, fenceMask, fieldBullets, isPlaceholder, listOf, normLabel, section, splitLines, stripComments, tables } from './markdown.mjs';

// Parsers for the contracts whose artifact is a run of Markdown entries rather than one frontmatter
// block. Each turns the file into records shaped like the contract's schema; the normalization
// rules are documented in CONTRACTS.md ("Normalization"). A record is
//   { data, pointer, line, lineOf(pointer), warnings[], stub }
// stub = an unfilled template entry: reported as a warning, never schema-validated.

const ids = (s, re) => [...new Set((s ?? '').match(re) ?? [])];
const ADR_RE = /ADR-[0-9]{4}/g;
const clean = (s) => (s ?? '').replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
const yesNo = (s) => (/^(yes|true|y)$/i.test(clean(s)) ? true : /^(no|false|n)$/i.test(clean(s)) ? false : clean(s));

function prepare(text) {
  const fm = splitFrontmatter(text);
  let front = {};
  let offset = 0;
  let body = text;
  if (fm) {
    const y = parseYaml(fm.yaml, 1);
    if (!y.errors.length && y.data && typeof y.data === 'object') front = y.data;
    // Keep line numbers: blank the frontmatter instead of cutting it.
    offset = 0;
    body = text.slice(0, text.length - fm.body.length).replace(/[^\n]/g, '') + fm.body;
  }
  const lines = splitLines(stripComments(body));
  return { front, lines, offset };
}

function entryRecord(data, id, line, fieldLines, warnings = [], stub = false) {
  return {
    data,
    pointer: `/${id}`,
    line,
    lineOf: (ptr) => fieldLines[ptr.split('/')[1]] ?? line,
    warnings,
    stub,
  };
}

// Entries headed "## <ID-n> · title" (also " — ", " - ", ": ").
const entryHeading = (prefix) => new RegExp(`^(${prefix}-[0-9]+)\\s*(?:[·—–:-]\\s*)?(.*)$`);

// ---------------------------------------------------------------------------------------------- //
// specs/<epic>/cuj.md -> journey

const JOURNEY_FIELDS = {
  actor: 'actor', goal: 'goal', trigger: 'trigger', steps: 'steps', success: 'success',
  unwanted: 'unwanted', personas: 'personas', persona: 'personas', 'user facing': 'user_facing',
};

export function parseJourneys(text, ctx = {}) {
  const { front, lines } = prepare(text);
  const epic = ctx.epic ?? front.epic;
  const records = [];
  for (const b of blocks(lines, entryHeading('CUJ'), { maxLevel: 2, minLevel: 2 })) {
    const [, id, title] = b.match;
    const data = { id, title: clean(title), ...(epic ? { epic } : {}) };
    const fieldLines = { id: b.heading.index + 1, title: b.heading.index + 1 };
    const extra = {};
    for (const f of fieldBullets(b.lines, b.mask)) {
      const key = JOURNEY_FIELDS[normLabel(f.label)];
      fieldLines[key ?? 'extra'] = b.start + f.index + 1;
      if (key === 'steps') {
        const steps = f.items.length ? f.items : f.value ? [f.value] : [];
        data.steps = steps.map(clean);
      } else if (key === 'personas') data.personas = listOf(clean(f.value));
      else if (key === 'user_facing') data.user_facing = yesNo(f.value);
      else if (key) data[key] = f.value;
      else extra[f.label] = f.value;
    }
    if (Object.keys(extra).length) data.extra = extra;
    const stub = isPlaceholder(title) || isPlaceholder(data.actor ?? '') || data.actor === '…';
    records.push(entryRecord(data, id, b.heading.index + 1, fieldLines, stub ? [`${id} is an unfilled template entry`] : [], stub));
  }
  return { records, errors: records.length ? [] : [{ keyword: 'entries', pointer: '', message: 'no "## CUJ-n · title" entries', line: 1 }] };
}

// ---------------------------------------------------------------------------------------------- //
// specs/<epic>/spec.md "## Requirements" tables -> requirement

const COLUMN = [
  ['id', /^(#|id|ids?|req(uirement)? id|no\.?)$/],
  ['statement', /requirement|statement|behaviou?r|description/],
  ['module', /module|component|touches/],
  ['verified_by', /verif|test|evidence/],
  ['category', /category|kind|type/],
  ['measure', /measure|target|threshold|metric|budget/],
  ['cujs', /^cujs?$|journey/],
  ['adrs', /^adrs?$|decision/],
];

const columnKey = (header) => {
  if (clean(header) === '#') return 'id';
  const h = normLabel(clean(header));
  return COLUMN.find(([, re]) => re.test(h))?.[0] ?? null;
};

export function normalizeRequirementId(raw) {
  const s = clean(raw);
  let m = s.match(/^R([1-9][0-9]*)$/);
  if (m) return { id: `REQ-${m[1]}`, source_id: s };
  m = s.match(/^(REQ|NFR)-?([1-9][0-9]*)$/);
  if (m) return { id: `${m[1]}-${m[2]}`, source_id: s };
  return null;
}

export function parseRequirements(text, ctx = {}) {
  const { front, lines } = prepare(text);
  const epic = ctx.epic ?? front.epic;
  const sec = section(lines, /^Requirements\b/i);
  if (!sec) return { records: [], errors: [{ keyword: 'section', pointer: '', message: 'no "## Requirements" section', line: 1 }] };
  const records = [];
  const errors = [];
  for (const t of tables(sec.lines, sec.mask)) {
    const keys = t.headers.map(columnKey);
    if (!keys.includes('id') || !keys.includes('statement')) continue;
    for (const row of t.rows) {
      const line = sec.start + row.index + 1;
      const cell = (k) => row.cells[keys.indexOf(k)] ?? '';
      const rawId = cell('id');
      const statement = cell('statement').trim();
      if (isPlaceholder(statement) || statement === '…' || statement === '...') continue;
      const norm = normalizeRequirementId(rawId);
      if (!norm) {
        errors.push({ keyword: 'requirement-id-form', pointer: `/row-${line}/id`, message: `requirement id "${clean(rawId)}" is not R<n>, REQ-<n> or NFR-<n>`, line });
        continue;
      }
      const data = { id: norm.id, source_id: norm.source_id, ...(epic ? { epic } : {}), kind: norm.id.startsWith('NFR-') ? 'non-functional' : 'functional', statement, ears: classify(clean(statement)) };
      const extra = {};
      t.headers.forEach((h, i) => {
        const k = keys[i];
        const v = (row.cells[i] ?? '').trim();
        if (!v || v === '—' || v === '-') return;
        if (k === 'module' || k === 'verified_by' || k === 'measure') data[k] = v;
        else if (k === 'category') data.category = clean(v).toLowerCase();
        else if (k === 'cujs') data.cujs = listOf(clean(v));
        else if (k === 'adrs') data.adrs = ids(v, ADR_RE);
        else if (!k) extra[clean(h)] = v;
      });
      if (Object.keys(extra).length) data.extra = extra;
      const fieldLines = Object.fromEntries(Object.keys(data).map((k) => [k, line]));
      records.push(entryRecord(data, norm.id, line, fieldLines));
    }
  }
  const seen = new Map();
  for (const r of records) {
    if (seen.has(r.data.id)) errors.push({ keyword: 'unique', pointer: `/${r.data.id}`, message: `${r.data.id} is defined twice (lines ${seen.get(r.data.id)} and ${r.line})`, line: r.line });
    else seen.set(r.data.id, r.line);
  }
  // An epic still at intake or scoping is a stub: an empty or placeholder-only table is its to-do
  // list (a warning), not a broken spec.
  if (!records.length && !errors.length) {
    const stub = ['intake', 'scoping'].includes(front.status);
    errors.push({ keyword: 'entries', ...(stub ? { severity: 'warning' } : {}), pointer: '', message: `the Requirements section has no requirement row yet (a table with an id column and a requirement column, rows not placeholders)${stub ? `; fine while the epic is ${front.status}, required from draft on` : ''}`, line: sec.start });
  }
  return { records, errors };
}

// The spec.md "## Tasks" index table: [{ id, cujs, line }] — used by the trace check only.
export function parseTaskIndex(text) {
  const { lines } = prepare(text);
  const sec = section(lines, /^Tasks\b/i);
  if (!sec) return [];
  const out = [];
  for (const t of tables(sec.lines, sec.mask)) {
    const hi = t.headers.map((h) => normLabel(clean(h)));
    const ti = hi.findIndex((h) => h === 'task' || h === 'id');
    if (ti === -1) continue;
    const ci = hi.findIndex((h) => /^cujs?$/.test(h));
    for (const row of t.rows) {
      const id = (clean(row.cells[ti]).match(/[A-Z][A-Z0-9]*-[0-9]+/) ?? [])[0];
      if (!id || isPlaceholder(row.cells[ti])) continue;
      out.push({ id, cujs: ci === -1 ? null : ids(row.cells[ci], /CUJ-[0-9]+/g), line: sec.start + row.index + 1 });
    }
  }
  return out;
}

// The epic header's "**ADRs:**" field: ADR ids the epic says it implements.
export function parseEpicAdrs(text) {
  const { lines } = prepare(text);
  for (const [i, line] of lines.entries()) {
    const m = line.match(/\*\*ADRs:\*\*\s*(.*)$/);
    if (m) return { ids: ids(m[1], ADR_RE), line: i + 1 };
  }
  return { ids: [], line: null };
}

// ---------------------------------------------------------------------------------------------- //
// DECISIONS.md -> decision

const DECISION_FIELDS = {
  status: 'status_text', date: 'date', decision: 'decision', why: 'why', consequences: 'consequences',
  supersedes: 'supersedes', 'reversed when': 'reversal_trigger', 'reversal trigger': 'reversal_trigger',
  door: 'door', satisfies: 'satisfies', options: 'options', 'options considered': 'options', alternatives: 'options',
};

// The ADR ids a "**Supersedes:**" line supersedes. The line is clauses split by ";"; a clause that
// opens with another relation ("extends ADR-0007", "confirms ADR-0008's queue choice", "refines
// ADR-0010", "fills the gap ADR-0008 left") names a related ADR, not a superseded one.
const NOT_SUPERSESSION = /^(?:and\s+)?(?:extends|confirms|refines|fills|makes|closes|restates|amends|complements|keeps)\b/i;
export function supersededIn(line) {
  return [...new Set(clean(line).split(';').map((c) => c.trim()).filter((c) => c && !NOT_SUPERSESSION.test(c)).flatMap((c) => ids(c, ADR_RE)))];
}

function statusOf(text) {
  const status = (clean(text).match(/^[A-Za-z]+/) ?? [''])[0].toLowerCase();
  const segments = (re) => [...clean(text).matchAll(re)].map((m) => m[0]);
  const superseded = segments(/supersed[^;.]*/gi).flatMap((s) => ids(s, ADR_RE));
  const refined = segments(/refined[^;.]*/gi).flatMap((s) => ids(s, ADR_RE));
  return { status, superseded: [...new Set(superseded)], refined: [...new Set(refined)] };
}

export function parseDecisions(text) {
  const { lines } = prepare(text);
  const records = [];
  for (const b of blocks(lines, /^(ADR-[0-9]{4})\s*[:—–-]\s*(.+)$/, { maxLevel: 2, minLevel: 1 })) {
    const [, id, title] = b.match;
    const data = { id, title: title.trim() };
    const fieldLines = { id: b.heading.index + 1, title: b.heading.index + 1 };
    const placeholders = [];
    const extra = {};
    for (const f of boldFields(b.lines, b.mask)) {
      const key = DECISION_FIELDS[normLabel(f.label)];
      const line = b.start + f.index + 1;
      if (!key) { extra[f.label] = f.value; fieldLines.extra = line; continue; }
      fieldLines[key] = line;
      if (isPlaceholder(f.value)) placeholders.push(key);
      if (key === 'status_text') {
        const s = statusOf(f.value);
        data.status_text = f.value;
        data.status = s.status;
        fieldLines.status = line;
        if (s.superseded.length) { data.superseded_by = s.superseded; fieldLines.superseded_by = line; }
        if (s.refined.length) { data.refined_by = s.refined; fieldLines.refined_by = line; }
      } else if (key === 'date') {
        if (!isPlaceholder(f.value)) data.date = f.value;
      } else if (key === 'supersedes') {
        data.supersedes = f.value;
        const sup = supersededIn(f.value);
        if (sup.length) data.supersedes_ids = sup;
      } else if (key === 'door') data.door = clean(f.value).toLowerCase().replace(/\s+/g, '-').replace(/\.$/, '');
      else if (key === 'satisfies') data.satisfies = listOf(clean(f.value));
      else if (key === 'options') {
        const bullets = f.value.split('\n').map((l) => l.match(/^\s*[-*]\s+(.*)$/)?.[1]).filter(Boolean);
        data.options = bullets.length ? bullets : [f.value];
      } else data[key] = f.value;
    }
    if (Object.keys(extra).length) data.extra = extra;
    if (placeholders.length) data.placeholders = placeholders;
    const warnings = placeholders.map((p) => `${id} ${p} is a template placeholder`);
    records.push(entryRecord(data, id, b.heading.index + 1, fieldLines, warnings));
  }
  const errors = [];
  const seen = new Map();
  for (const r of records) {
    if (seen.has(r.data.id)) errors.push({ keyword: 'unique', pointer: `/${r.data.id}`, message: `${r.data.id} is defined twice (lines ${seen.get(r.data.id)} and ${r.line})`, line: r.line });
    else seen.set(r.data.id, r.line);
  }
  if (!records.length) errors.push({ keyword: 'entries', pointer: '', message: 'no "## ADR-NNNN: title" entries', line: 1 });
  return { records, errors };
}

// ---------------------------------------------------------------------------------------------- //
// docs/product/personas.md -> persona

const PERSONA_FIELDS = { name: 'name', role: 'role', goals: 'goals', goal: 'goals', pains: 'pains', 'pain points': 'pains', context: 'context', quote: 'quote', evidence: 'evidence' };
const LIST_FIELDS = new Set(['goals', 'pains', 'evidence']);

export function parsePersonas(text) {
  const { lines } = prepare(text);
  const records = [];
  for (const b of blocks(lines, entryHeading('PER'), { maxLevel: 2, minLevel: 2 })) {
    const [, id, title] = b.match;
    const data = { id, name: clean(title) };
    const fieldLines = { id: b.heading.index + 1, name: b.heading.index + 1 };
    for (const f of fieldBullets(b.lines, b.mask)) {
      const key = PERSONA_FIELDS[normLabel(f.label)];
      if (!key) continue;
      fieldLines[key] = b.start + f.index + 1;
      if (LIST_FIELDS.has(key)) data[key] = f.items.length ? f.items.map(clean) : listOf(f.value);
      else data[key] = f.value;
    }
    records.push(entryRecord(data, id, b.heading.index + 1, fieldLines));
  }
  return { records, errors: records.length ? [] : [{ keyword: 'entries', pointer: '', message: 'no "## PER-n · name" entries', line: 1 }] };
}

// ---------------------------------------------------------------------------------------------- //
// docs/ux/<epic>.md -> ux-flow

const UX_FIELDS = { cujs: 'cujs', cuj: 'cujs', journeys: 'cujs', requirements: 'requirements', steps: 'steps', screens: 'steps', states: 'states', prototype: 'prototype', accessibility: 'accessibility' };

export function parseUxFlows(text, ctx = {}) {
  const { front, lines } = prepare(text);
  const epic = ctx.epic ?? front.epic;
  const records = [];
  for (const b of blocks(lines, entryHeading('UX'), { maxLevel: 2, minLevel: 2 })) {
    const [, id, title] = b.match;
    const data = { id, title: clean(title), ...(epic ? { epic } : {}) };
    if (front.prototype) data.prototype = front.prototype;
    const fieldLines = { id: b.heading.index + 1, title: b.heading.index + 1 };
    for (const f of fieldBullets(b.lines, b.mask)) {
      const key = UX_FIELDS[normLabel(f.label)];
      if (!key) continue;
      fieldLines[key] = b.start + f.index + 1;
      if (key === 'cujs' || key === 'requirements') data[key] = listOf(clean(f.value));
      else if (key === 'steps') data.steps = (f.items.length ? f.items : f.value ? [f.value] : []).map(clean);
      else if (key === 'states') data.states = Object.fromEntries(f.fields.map((s) => [normLabel(s.label).replace(/\s+/g, '-'), s.value]));
      else if (key === 'prototype') data.prototype = clean(f.value);
      else data[key] = f.value;
    }
    records.push(entryRecord(data, id, b.heading.index + 1, fieldLines));
  }
  return { records, errors: records.length ? [] : [{ keyword: 'entries', pointer: '', message: 'no "## UX-n · title" entries', line: 1 }] };
}

// ---------------------------------------------------------------------------------------------- //
// skills/<name>/evals/evidence.md -> evidence entry

const EVIDENCE_FIELDS = { kind: 'kind', source: 'source', claim: 'claim', result: 'result', engine: 'engine', model: 'model', 'skill version': 'skill_version', revisit: 'revisit' };

export function parseEvidence(text) {
  const { lines } = prepare(text);
  const records = [];
  for (const b of blocks(lines, /^([0-9]{4}-[0-9]{2}-[0-9]{2})\s*(?:[·—–:-]\s*)?(.*)$/, { maxLevel: 2, minLevel: 2 })) {
    const [, date, title] = b.match;
    const data = { date, title: clean(title) };
    const fieldLines = { date: b.heading.index + 1, title: b.heading.index + 1 };
    for (const f of fieldBullets(b.lines, b.mask)) {
      const key = EVIDENCE_FIELDS[normLabel(f.label)];
      if (!key) continue;
      fieldLines[key] = b.start + f.index + 1;
      data[key] = key === 'kind' ? clean(f.value).toLowerCase() : key === 'source' ? clean(f.value) : f.value;
    }
    records.push(entryRecord(data, `${date}-${records.length}`, b.heading.index + 1, fieldLines));
  }
  return { records, errors: records.length ? [] : [{ keyword: 'entries', pointer: '', message: 'no "## YYYY-MM-DD · title" entries', line: 1 }] };
}

export const PARSERS = {
  journeys: parseJourneys,
  requirements: parseRequirements,
  decisions: parseDecisions,
  personas: parsePersonas,
  'ux-flows': parseUxFlows,
  evidence: parseEvidence,
};

export { fenceMask };
