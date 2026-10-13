import { fenceMask, section, splitLines, stripComments } from './markdown.mjs';

// EARS: the five sentence shapes an acceptance criterion may take. The patterns are agentic-template's
// scripts/ears-lint.mjs, unchanged, so a file that passes there passes here.

const PATTERNS = [
  { name: 'event', re: /^when\b.+,.*\bshall\b/i },
  { name: 'state', re: /^while\b.+,.*\bshall\b/i },
  { name: 'optional', re: /^where\b.+,.*\bshall\b/i },
  { name: 'unwanted', re: /^if\b.+,\s*then\b.+\bshall\b/i },
  { name: 'ubiquitous', re: /^the\b.+\bshall\b/i },
];

export function classify(statement) {
  const s = statement.trim();
  if (!/\bshall\b/i.test(s)) return null;
  return PATTERNS.find((p) => p.re.test(s))?.name ?? null;
}

const isPlaceholder = (s) => /<[^>]+>/.test(s);

// Criteria under "## Acceptance criteria": [{ id, raw, statement, line, legacy, placeholder }].
// id is canonical AC-n (a legacy AC1 is normalized and flagged); line is 1-based in the full text.
export function criteria(text) {
  const lines = splitLines(stripComments(text));
  const sec = section(lines, /^Acceptance criteria\b/i);
  if (!sec) return { found: false, items: [] };
  const mask = fenceMask(sec.lines);
  const items = [];
  sec.lines.forEach((line, i) => {
    if (mask[i]) return;
    const b = line.match(/^\s*-\s+(?:\[[ xX]\]\s*)?(.*)$/);
    if (!b) return;
    const raw = b[1].trim();
    if (!raw) return;
    const m = raw.match(/^(AC-?(\d+))\b\s*[-–—:.]?\s*(.*)$/i);
    const statement = m ? m[3].trim() : raw;
    items.push({
      id: m ? `AC-${Number(m[2])}` : null,
      written: m ? m[1] : null,
      legacy: m ? !/^AC-/.test(m[1]) : false,
      statement,
      raw,
      line: sec.start + i + 1,
      placeholder: isPlaceholder(statement),
    });
  });
  return { found: true, items };
}

// The test-name extractor of scripts/ears-coverage.mjs: the first string argument of it/test/describe.
const NAME_CALL = /\b(?:it|test|describe)(?:\.(?:each|only|skip|todo|concurrent))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
export function testNames(text) {
  return [...text.matchAll(NAME_CALL)].map((m) => m[2]);
}

export function namedIn(names, id) {
  const re = new RegExp(`(^|[^A-Z0-9-])${id.replace('-', '-?')}(?![0-9])`, 'i');
  return names.some((n) => re.test(n));
}

export const DEFAULT_TEST_GLOBS = ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.js', '**/*.test.js', '**/*.spec.mjs', '**/*.test.mjs', '**/*.e2e-spec.ts', 'e2e/**/*.ts', 'tests/**/*.ts'];
