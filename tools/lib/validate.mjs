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

// [{ contract, artifact, captures, matched }] for every contract whose artifact paths match the file
// (a spec.md is both an epic and a set of requirements). With an explicit contract, that one only.
export function inferContracts(file, { contract, registry = sharedRegistry() } = {}) {
  const posix = toPosix(path.resolve(file));
  const fixture = posix.match(FIXTURE)?.[1];
  const names = contract ? [contract] : fixture && registry.has(fixture) ? [fixture] : registry.contracts();
  const out = [];
  for (const name of names) {
    const arts = registry.artifacts(name);
    let hit = null;
    for (const art of arts) {
      if (!accepts(art.format, file)) continue;
      for (const glob of art.paths) {
        const m = matchSuffix(posix, glob);
        if (m) { hit = { contract: name, artifact: art, captures: m.captures, matched: m.matched }; break; }
      }
      if (hit) break;
    }
    // An explicit or fixture-named contract falls back to the first artifact shape that reads the
    // file's extension, without path bindings.
    if (!hit && (contract || fixture)) {
      const art = arts.find((a) => accepts(a.format, file));
      if (art) hit = { contract: name, artifact: art, captures: [], matched: null };
    }
    if (hit) out.push(hit);
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

// The rule an Ajv error reports: the deepest x-rule, or x-rules[<key the path takes out of that
// node>], on the schema path; failing that, on the instance path through the contract's own schema
// (for values validated through a $ref into common); failing that, a default from the keyword.
export function ruleOf(err, name, pointer, registry) {
  const fromSteps = (steps) => {
    for (const { node, key } of [...steps].reverse()) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      if (key !== undefined && node['x-rules']?.[key]) return node['x-rules'][key];
      if (node['x-rule']) return node['x-rule'];
    }
    return null;
  };
  const viaSchema = fromSteps(registry.nodesOnPath(name, err.schemaPath));
  if (viaSchema) return viaSchema;
  const steps = [];
  let node = registry.at(name, pointer);
  for (const seg of err.instancePath.split('/').slice(1)) {
    if (!node || typeof node !== 'object') break;
    node = /^\d+$/.test(seg) ? node.items : node.properties?.[seg] ?? (typeof node.additionalProperties === 'object' ? node.additionalProperties : undefined);
    steps.push({ node, key: undefined });
  }
  const viaInstance = fromSteps(steps);
  if (viaInstance) return viaInstance;
  switch (err.keyword) {
    case 'required': return `missing-${err.params.missingProperty.replace(/_/g, '-')}`;
    case 'additionalProperties': return 'unknown-field';
    case 'uniqueItems': return `duplicate-${fieldOf(err.instancePath)}`;
    case 'false schema': return `forbidden-${fieldOf(err.instancePath)}`;
    default: return `invalid-${fieldOf(err.instancePath)}`;
  }
}

function describe(err) {
  if (err.keyword === 'additionalProperties') return `unknown field "${err.params.additionalProperty}"`;
  if (err.keyword === 'false schema') return 'is not allowed here';
  if (err.keyword === 'enum') return `${err.message}: ${err.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
  return err.message;
}

// Ajv reports an if/then failure twice (the then-keyword and the if); keep the specific one. An
// anyOf/oneOf failure is reported with its branches; keep the branch errors only when the
// combinator itself carries no rule.
function prune(errors) {
  return errors.filter((e) => e.keyword !== 'if');
}

function schemaFindings(record, name, pointer, registry) {
  const v = registry.validator(name, pointer);
  if (v(record.data)) return [];
  const seen = new Set();
  const out = [];
  for (const err of prune(v.errors)) {
    const rule = ruleOf(err, name, pointer, registry);
    const ptr = `${record.pointer}${err.instancePath}`;
    const key = `${rule}|${ptr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ severity: 'error', rule, pointer: ptr || '/', message: describe(err), line: record.lineOf(err.instancePath || '') ?? record.line });
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
  for (const e of loaded.errors) findings.push({ severity: 'error', rule: LOAD_RULES[e.keyword] ?? e.keyword, pointer: e.pointer || '/', message: e.message, line: e.line });
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
