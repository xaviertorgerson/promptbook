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

// Test names, per language: the strings a criterion id must appear in (CONTRACTS.md, trace graph).
// JS/TS is scripts/ears-coverage.mjs's extractor unchanged: the first string argument of
// it/test/describe. A file's extension picks its extractors; an unknown extension gets all of them.
const NAME_CALL = /\b(?:it|test|describe)(?:\.(?:each|only|skip|todo|concurrent))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const EXTRACTORS = {
  js: [(t) => [...t.matchAll(NAME_CALL)].map((m) => m[2])],
  // Go: t.Run("…") subtests (b.Run for benchmarks), and the TestXxx function names.
  go: [
    (t) => [...t.matchAll(/\b[tb]\.Run\(\s*"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]),
    (t) => [...t.matchAll(/\bfunc\s+(Test\w+)\s*\(/g)].map((m) => m[1]),
  ],
  // Python: def test_… (ac_2 matches AC-2); pytest parametrize ids=[…] and pytest.param(…, id="…").
  python: [
    (t) => [...t.matchAll(/^\s*(?:async\s+)?def\s+(test\w*)\s*\(/gm)].map((m) => m[1]),
    (t) => [...t.matchAll(/\bids\s*=\s*[[(]([^\])]*)[\])]/g)].flatMap((m) => [...m[1].matchAll(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((x) => x[2])),
    (t) => [...t.matchAll(/\bid\s*=\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]),
  ],
  // JUnit 5 (Java and Kotlin): @DisplayName("…").
  junit: [(t) => [...t.matchAll(/@(?:[A-Za-z_][\w.]*\.)?DisplayName\(\s*"((?:\\.|[^"\\])*)"\s*\)/g)].map((m) => m[1])],
  // Kotlin: backticked function names, fun `AC-2 rounds half to even`().
  kotlin: [(t) => [...t.matchAll(/\bfun\s+`([^`]+)`/g)].map((m) => m[1])],
  // Rust: fn names (#[test] fns are plain fns; ac_2 matches AC-2).
  rust: [(t) => [...t.matchAll(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/g)].map((m) => m[1])],
  // Ruby (RSpec, minitest/spec): it "…", describe/context/specify/test "…".
  ruby: [(t) => [...t.matchAll(/\b(?:it|describe|context|specify|test)\s*\(?\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2])],
};
const BY_EXTENSION = {
  '.js': ['js'], '.mjs': ['js'], '.cjs': ['js'], '.jsx': ['js'], '.ts': ['js'], '.tsx': ['js'], '.mts': ['js'], '.cts': ['js'],
  '.go': ['go'], '.py': ['python'], '.java': ['junit'], '.kt': ['junit', 'kotlin'], '.kts': ['junit', 'kotlin'], '.rs': ['rust'], '.rb': ['ruby'],
};

// The test names in one file's text. file (optional) picks the extractors by extension; patterns are
// extra regexes (--test-pattern): each match's first capture group, or the whole match, is a name.
export function testNames(text, { file = null, patterns = [] } = {}) {
  const ext = file ? (file.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase() : '';
  const langs = BY_EXTENSION[ext] ?? Object.keys(EXTRACTORS);
  const names = langs.flatMap((l) => EXTRACTORS[l].flatMap((fn) => fn(text)));
  for (const p of patterns) {
    const re = new RegExp(p instanceof RegExp ? p.source : p, 'gm');
    for (const m of text.matchAll(re)) names.push(m[1] ?? m[0]);
  }
  return names;
}

// An id (AC-2, BILL-7) as a name may write it: any case, the separator a hyphen, an underscore or
// nothing (AC-2, ac_2, AC2, bill_7), not inside a longer id or number; or in CamelCase, upper case
// right after a lower-case letter or a digit (TestBILL7AC2RoundsHalfEven).
const idPatterns = (id) => {
  const [prefix, n] = id.split('-');
  return [new RegExp(`(^|[^A-Za-z0-9-])${prefix}[-_]?${n}(?![0-9])`, 'i'), new RegExp(`(?<=[a-z0-9])${prefix}[-_]?${n}(?![0-9])`)];
};

export function namedIn(names, id) {
  const res = idPatterns(id);
  return names.some((n) => res.some((re) => re.test(n)));
}

export const DEFAULT_TEST_GLOBS = [
  '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.js', '**/*.test.js', '**/*.spec.mjs', '**/*.test.mjs', '**/*.e2e-spec.ts', 'e2e/**/*.ts', 'tests/**/*.ts',
  '**/*_test.go', '**/test_*.py', '**/*_test.py', '**/*Test.java', '**/*Tests.java', '**/*Test.kt', '**/*Tests.kt', 'tests/**/*.rs', 'src/**/*.rs', '**/*_spec.rb', '**/*_test.rb', '**/test_*.rb',
];
