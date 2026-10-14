import path from 'node:path';
import { CHECKS, checkSections } from './checks.mjs';
import { matchSuffix, toPosix, walk } from './glob.mjs';
import { accepts, loadFrontmatterMarkdown, loadJson, loadJsonl, loadYaml, readText } from './loaders.mjs';
import { PARSERS } from './parsers.mjs';
import { registry as sharedRegistry } from './registry.mjs';

// Validate one file against one or more contracts. A finding is
//   { severity: 'error'|'warning', rule, pointer, message, line }
// rule is the name an invalid fixture is named for (x-rule / x-rules annotations, a check id, or a
// default derived from the failing keyword); pointer is a JSON pointer into the record, prefixed
// with the record's own pointer for files that hold several records.

// Fixture convention: fixtures/{valid,invalid}/<contract>/<case>[.ext | /...] names its contract and
// its case; an invalid case is named for the rule it breaks. A case directory may hold the artifact
// in its real layout (skills/<name>/SKILL.md) so path bindings apply.
const FIXTURE = /(?:^|\/)fixtures\/(?:valid|invalid)\/([a-z0-9-]+)\/([^/]+)/;

export function fixtureCase(file) {
  const m = toPosix(path.resolve(file)).match(FIXTURE);
  return m ? m[2].replace(/\.[^.]+$/, '') : null;
}

// A template kept beside its examples (adr.template.md, grant.template.yaml, or a project's
// _UX-TEMPLATE.md, which the trace skips like a _-prefixed task) holds placeholders on purpose: no
// contract is inferred for it; --contract still validates it.
export const isTemplate = (file) => /\.template\.[^./]+$/i.test(path.basename(file)) || path.basename(file).startsWith('_');

// The artifact a filename suffix names (x-artifacts[].suffixes: *.grant.yaml, *.task.md, …), for an
// example that lives outside the project layout (a skill's references/). Among a contract's
// artifacts that share the suffix, one with frontmatter reads a file that has it. A binding to the
// first path segment (an epic) comes from the name before the suffix (rating-engine.cuj.md) and only
// for entry files, which carry no frontmatter to compare it with.
function suffixHit(name, arts, file, base) {
  const matches = arts.filter((a) => a.suffixes?.some((x) => base.toLowerCase().endsWith(x)) && accepts(a.format, file));
  if (!matches.length) return null;
  let art = matches[0];
  if (matches.length > 1) {
    let fm = false;
    try { fm = /^---[ \t]*\r?\n/.test(readText(file)); } catch { /* unreadable: the first shape reports it */ }
    art = matches.find((a) => (a.format === 'frontmatter-markdown') === fm) ?? art;
  }
  const suffix = art.suffixes.find((x) => base.toLowerCase().endsWith(x));
  const prefix = base.slice(0, base.length - suffix.length);
  const captures = art.format === 'markdown-entries' && Object.values(art.bind ?? {}).includes(1) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix) ? [prefix] : [];
  return { contract: name, artifact: art, captures, matched: null, suffix };
}

// [{ contract, artifact, captures, matched }] for every contract whose artifact paths match the file
// (a spec.md is both an epic and a set of requirements); when no path matches, for every contract
// whose filename suffix does. With an explicit contract, that one only.
export function inferContracts(file, { contract, registry = sharedRegistry() } = {}) {
  const posix = toPosix(path.resolve(file));
  if (!contract && isTemplate(file)) return [];
  const fixture = posix.match(FIXTURE)?.[1];
  const names = contract ? [contract] : fixture && registry.has(fixture) ? [fixture] : registry.contracts();
  const base = path.basename(file);
  const byPath = (name) => {
    for (const art of registry.artifacts(name)) {
      if (!accepts(art.format, file)) continue;
      for (const glob of art.paths) {
        const m = matchSuffix(posix, glob);
        // A _-prefixed folder in a captured segment (specs/_drafts/spec.md) is out of the layout,
        // as the trace reads it.
        if (m && m.captures.some((c) => c.startsWith('_'))) continue;
        if (m) return { contract: name, artifact: art, captures: m.captures, matched: m.matched };
      }
    }
    return null;
  };
  let out = names.map(byPath).filter(Boolean);
  if (!out.length) out = names.map((name) => suffixHit(name, registry.artifacts(name), file, base)).filter(Boolean);
  // An explicit or fixture-named contract falls back to the first artifact shape that reads the
  // file's extension, without path bindings.
  if (!out.length && (contract || fixture)) {
    const art = registry.artifacts(names[0]).find((a) => accepts(a.format, file));
    if (art) out = [{ contract: names[0], artifact: art, captures: [], matched: null }];
  }
  return out;
}

function bindings(art, captures, file) {
  if (!art.bind || !captures.length) return {};
  const out = {};
  for (const [key, from] of Object.entries(art.bind)) {
    out[key] = from === '$name' ? path.basename(file).replace(/\.[^.]+$/, '') : captures[from - 1];
  }
  return out;
}

const fieldOf = (instancePath) => {
  const segs = instancePath.split('/').slice(1).filter((s) => !/^\d+$/.test(s));
  return (segs.at(-1) ?? 'document').replace(/_/g, '-');
};

// The rule an Ajv error reports, and the human description that goes with it: the nearest x-rule,
// or x-rules[<key the path takes out of that node>], among the failing schema node's ancestors;
// failing that, on the instance path through the contract's own schema (for values validated
// through a $ref into common); failing that, a default named from the keyword.
export function ruleOf(err, name, pointer, registry) {
  const fromSteps = (nearestFirst) => {
    for (const { node, key } of nearestFirst) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      if (key !== undefined && node['x-rules']?.[key]) return { rule: node['x-rules'][key] };
      if (node['x-rule']) return { rule: node['x-rule'], why: node.description };
    }
    return null;
  };
  // The keyword's own node: parentSchema holds it, and the keyword is the first key out of it. A
  // boolean false schema has no node to look up, so walk its schemaPath instead (relative to the
  // validated fragment when there is one).
  let own;
  if (err.parentSchema && typeof err.parentSchema === 'object') {
    own = registry.ancestry(err.parentSchema);
    own[0].key = err.keyword;
  } else {
    // Ajv appends "/false schema" to the path of a boolean false subschema.
    const raw = err.schemaPath.replace(/\/false schema$/, '');
    const schemaPath = pointer && raw.startsWith('#') ? `${pointer}${raw.slice(1)}` : raw;
    own = registry.nodesOnPath(name, schemaPath).reverse();
  }
  const steps = [];
  let node = registry.at(name, pointer);
  for (const seg of err.instancePath.split('/').slice(1)) {
    if (!node || typeof node !== 'object') break;
    node = /^\d+$/.test(seg) ? node.items : node.properties?.[seg] ?? (typeof node.additionalProperties === 'object' ? node.additionalProperties : undefined);
    steps.push({ node, key: undefined });
  }
  const named = fromSteps(own) ?? fromSteps(steps.reverse());
  if (named) return named;
  switch (err.keyword) {
    case 'required': return { rule: `missing-${err.params.missingProperty.replace(/_/g, '-')}` };
    case 'additionalProperties': return { rule: 'unknown-field' };
    case 'uniqueItems': return { rule: `duplicate-${fieldOf(err.instancePath)}` };
    case 'false schema': return { rule: `forbidden-${fieldOf(err.instancePath)}` };
    default: return { rule: `invalid-${fieldOf(err.instancePath)}` };
  }
}

function describe(err, why) {
  let msg;
  if (err.keyword === 'additionalProperties') msg = `unknown field "${err.params.additionalProperty}"`;
  else if (err.keyword === 'false schema') msg = 'is not allowed here';
  else if (err.keyword === 'enum') msg = `${err.message}: ${err.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
  else if (err.keyword === 'const') msg = `must be ${JSON.stringify(err.params.allowedValue)}`;
  else msg = err.message;
  return why ? `${msg} (${why.replace(/\.$/, '')})` : msg;
}

// Ajv reports an if/then failure twice (the then-keyword and the if), and a failed contains once
// per item tried plus once for the contains itself; keep the specific error of each.
function prune(errors, registry) {
  const insideContains = (e) => e.parentSchema && typeof e.parentSchema === 'object' && registry.ancestry(e.parentSchema).slice(1).some((s) => s.key === 'contains');
  return errors.filter((e) => e.keyword !== 'if' && !insideContains(e));
}

function schemaFindings(record, name, pointer, registry) {
  const v = registry.validator(name, pointer);
  if (v(record.data)) return [];
  const seen = new Set();
  const out = [];
  for (const err of prune(v.errors, registry)) {
    const { rule, why } = ruleOf(err, name, pointer, registry);
    const at = err.keyword === 'additionalProperties' ? `${err.instancePath}/${err.params.additionalProperty}` : err.instancePath;
    const ptr = `${record.pointer}${at}`;
    const key = `${rule}|${ptr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ severity: 'error', rule, pointer: ptr || '/', message: describe(err, why), line: record.lineOf(at || '') ?? record.line });
  }
  return out;
}

const LOADERS = { 'frontmatter-markdown': loadFrontmatterMarkdown, yaml: loadYaml, json: loadJson, jsonl: loadJsonl };

// Validate one file against one inferred contract. Returns { contract, version, records, findings }.
export function validateAs(file, hit, { registry = sharedRegistry(), text = readText(file) } = {}) {
  const { contract: name, artifact: art } = hit;
  const pointer = art.pointer ?? '';
  const bound = bindings(art, hit.captures, file);
  const findings = [];
  let loaded;
  if (art.format === 'markdown-entries') {
    loaded = PARSERS[art.parser](text, { ...bound });
  } else {
    loaded = LOADERS[art.format](text);
  }
  const LOAD_RULES = { parse: 'parse-error', unique: 'duplicate-id', entries: 'no-entries', section: 'no-entries' };
  for (const e of loaded.errors) findings.push({ severity: e.severity ?? 'error', rule: LOAD_RULES[e.keyword] ?? e.keyword, pointer: e.pointer || '/', message: e.message, line: e.line });
  for (const record of loaded.records) {
    for (const w of record.warnings ?? []) findings.push({ severity: 'warning', rule: 'template-placeholder', pointer: record.pointer || '/', message: w, line: record.line });
    if (record.stub) continue;
    findings.push(...schemaFindings(record, name, pointer, registry));
    if (art.format === 'frontmatter-markdown') {
      for (const [key, value] of Object.entries(bound)) {
        if (record.data?.[key] !== value) {
          findings.push({ severity: 'error', rule: `${key.replace(/_/g, '-')}-matches-path`, pointer: `/${key}`, message: `${key} is ${JSON.stringify(record.data?.[key])}, the path says ${JSON.stringify(value)}`, line: record.lineOf(`/${key}`) ?? record.line });
        }
      }
    }
    for (const id of registry.at(name, pointer)['x-checks'] ?? []) {
      for (const f of CHECKS[id]({ data: record.data, text, file })) {
        findings.push({ severity: f.severity ?? 'error', rule: f.rule, pointer: f.pointer === '(body)' ? '(body)' : `${record.pointer}${f.pointer}`, message: f.message, line: f.line ?? record.lineOf(f.pointer) ?? record.line });
      }
    }
  }
  if (art.format === 'frontmatter-markdown' && loaded.records.length) {
    findings.push(...checkSections(registry.sections(name), loaded.body, loaded.bodyLine).map((f) => ({ severity: 'error', ...f })));
  }
  findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return { contract: name, version: registry.version(name), records: loaded.records.length, findings };
}

// Validate one in-memory record (a grant the simulator holds, a run record it wrote) against a
// contract: the schema, then the contract's named checks. Returns the error messages, [] when valid.
export function validateData(name, data, { registry = sharedRegistry() } = {}) {
  const v = registry.validator(name);
  const out = v(data) ? [] : v.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
  for (const id of registry.schema(name)['x-checks'] ?? []) {
    for (const f of CHECKS[id]({ data, text: '', file: null })) if ((f.severity ?? 'error') === 'error') out.push(`${f.pointer} ${f.rule}: ${f.message}`);
  }
  return out;
}

// Validate a file against every contract it maps to. status: PASS | FAIL | SKIP (no contract).
export function validateFile(file, opts = {}) {
  const registry = opts.registry ?? sharedRegistry();
  const hits = inferContracts(file, { contract: opts.contract, registry });
  if (!hits.length) return { file, status: 'SKIP', results: [] };
  const text = readText(file);
  const results = hits.map((hit) => validateAs(file, hit, { registry, text }));
  const failed = results.some((r) => r.findings.some((f) => f.severity === 'error'));
  return { file, status: failed ? 'FAIL' : 'PASS', results };
}

export function validatePath(target, opts = {}) {
  return walk(target).map((f) => validateFile(f, opts)).filter((r) => r.status !== 'SKIP' || opts.contract);
}
