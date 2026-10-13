import fs from 'node:fs';
import path from 'node:path';
import { isMap, isPair, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';

// One loader per artifact format. Each returns { records, errors } where a record is
// { data, pointer, line, lineOf } — pointer is the JSON pointer of the record inside the file (''
// for a single-object file), and lineOf maps a pointer inside the record to a 1-based file line
// (or null). markdown-entries records come from tools/lib/parsers.mjs.

export const FORMAT_EXTENSIONS = {
  'frontmatter-markdown': ['.md'],
  'markdown-entries': ['.md'],
  yaml: ['.yaml', '.yml', '.lock'],
  json: ['.json'],
  jsonl: ['.jsonl'],
};

export const accepts = (format, file) => (FORMAT_EXTENSIONS[format] ?? []).includes(path.extname(file).toLowerCase());

const unescape = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~');

// A YAML 1.2 (core schema) document with positions kept, so validation errors point at lines.
// Dates stay strings (no YAML 1.1 timestamps); duplicate keys are errors.
export function parseYaml(text, lineOffset = 0) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: false, uniqueKeys: true, version: '1.2' });
  const errors = [...doc.errors, ...doc.warnings.filter((w) => w.code === 'DUPLICATE_KEY')].map((e) => ({
    keyword: 'parse',
    pointer: '',
    message: `YAML: ${e.message.split('\n')[0]}`,
    line: e.linePos?.[0]?.line ? e.linePos[0].line + lineOffset : null,
  }));
  const data = errors.length ? undefined : doc.toJS({ maxAliasCount: 100 });
  const lineOf = (pointer) => {
    let node = doc.contents;
    let best = node;
    for (const seg of pointer.split('/').slice(1).map(unescape)) {
      if (isMap(node)) {
        const pair = node.items.find((p) => isPair(p) && (isScalar(p.key) ? String(p.key.value) : String(p.key)) === seg);
        if (!pair) break;
        best = pair.key ?? pair.value;
        node = pair.value;
      } else if (isSeq(node)) {
        const item = node.items[Number(seg)];
        if (!item) break;
        best = item;
        node = item;
      } else break;
    }
    const at = best?.range?.[0];
    return at === undefined ? null : lineCounter.linePos(at).line + lineOffset;
  };
  return { data, errors, lineOf };
}

// Split "---\n<yaml>\n---\n<body>". Returns null when the file has no frontmatter block.
export function splitFrontmatter(text) {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return null;
  return { yaml: m[1], body: text.slice(m[0].length), bodyLine: m[0].split(/\r?\n/).length };
}

export function loadFrontmatterMarkdown(text) {
  const fm = splitFrontmatter(text);
  if (!fm) {
    return { records: [], errors: [{ keyword: 'frontmatter', pointer: '', message: 'no YAML frontmatter block (--- ... ---) at the top of the file', line: 1 }] };
  }
  const y = parseYaml(fm.yaml, 1);
  if (y.errors.length) return { records: [], errors: y.errors };
  if (y.data === null || typeof y.data !== 'object' || Array.isArray(y.data)) {
    return { records: [], errors: [{ keyword: 'frontmatter', pointer: '', message: 'frontmatter must be a YAML mapping', line: 2 }] };
  }
  return { records: [{ data: y.data, pointer: '', line: 1, lineOf: y.lineOf }], errors: [], body: fm.body, bodyLine: fm.bodyLine };
}

export function loadYaml(text) {
  const y = parseYaml(text, 0);
  if (y.errors.length) return { records: [], errors: y.errors };
  return { records: [{ data: y.data, pointer: '', line: 1, lineOf: y.lineOf }], errors: [] };
}

export function loadJson(text) {
  try {
    return { records: [{ data: JSON.parse(text), pointer: '', line: 1, lineOf: () => null }], errors: [] };
  } catch (e) {
    return { records: [], errors: [{ keyword: 'parse', pointer: '', message: `JSON: ${e.message}`, line: null }] };
  }
}

// One JSON value per non-blank line; the record pointer is its 0-based index among records.
export function loadJsonl(text) {
  const records = [];
  const errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const pointer = `/${records.length + errors.length}`;
    try {
      records.push({ data: JSON.parse(line), pointer, line: i + 1, lineOf: () => i + 1 });
    } catch (e) {
      errors.push({ keyword: 'parse', pointer, message: `JSONL: ${e.message}`, line: i + 1 });
    }
  });
  if (!records.length && !errors.length) errors.push({ keyword: 'parse', pointer: '', message: 'JSONL: no records', line: 1 });
  return { records, errors };
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}
