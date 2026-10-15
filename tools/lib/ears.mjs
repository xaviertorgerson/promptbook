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
// JS/TS is scripts/ears-coverage.mjs's extractor: the first string argument of it/test/describe.
// A file's extension picks its extractors; an unknown extension gets all of them, on the raw text.
// For a known language, comments are blanked first and tests that never run are dropped: a
// commented-out, skipped or todo test evidences nothing.

// Comment and string syntax per language, for blanking comments without touching strings.
const SYNTAX = {
  js: { line: ['//'], block: [['/*', '*/']], quotes: ['`', '"', "'"] },
  go: { line: ['//'], block: [['/*', '*/']], quotes: ['`', '"', "'"] },
  python: { line: ['#'], block: [], quotes: ['"""', "'''", '"', "'"] },
  junit: { line: ['//'], block: [['/*', '*/']], quotes: ['"""', '"', "'"] },
  // Rust: ' opens a char literal only when it closes one character later ('a' vs the lifetime 'a).
  rust: { line: ['//'], block: [['/*', '*/']], quotes: ['"'], charLiteral: true },
  ruby: { line: ['#'], block: [['=begin', '=end']], quotes: ['"', "'"] },
};

const blank = (s) => s.replace(/[^\n]/g, ' ');

// The text with every comment replaced by spaces (newlines kept, so lines and offsets hold).
export function blankComments(text, lang) {
  const syn = SYNTAX[lang];
  if (!syn) return text;
  let out = '';
  let i = 0;
  const at = (tok) => text.startsWith(tok, i);
  while (i < text.length) {
    const q = syn.quotes.find(at);
    if (q) {
      let j = i + q.length;
      while (j < text.length && !text.startsWith(q, j)) j += text[j] === '\\' ? 2 : 1;
      j = Math.min(text.length, j + q.length);
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (syn.charLiteral && text[i] === "'") {
      const m = text.slice(i).match(/^'(?:\\.[^']*|[^'\\])'/);
      const len = m ? m[0].length : 1;
      out += text.slice(i, i + len);
      i += len;
      continue;
    }
    const line = syn.line.find(at);
    if (line) {
      const end = text.indexOf('\n', i);
      const j = end === -1 ? text.length : end;
      out += blank(text.slice(i, j));
      i = j;
      continue;
    }
    const block = syn.block.find(([open]) => at(open) && (open !== '=begin' || i === 0 || text[i - 1] === '\n'));
    if (block) {
      const end = text.indexOf(block[1], i + block[0].length);
      const j = end === -1 ? text.length : end + block[1].length;
      out += blank(text.slice(i, j));
      i = j;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

// The offset just past the parenthesis that closes the one at `open`, skipping strings; -1 if none.
function closeParen(text, open, quotes = SYNTAX.js.quotes) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const q = quotes.find((x) => text.startsWith(x, i));
    if (q) {
      let j = i + q.length;
      while (j < text.length && !text.startsWith(q, j)) j += text[j] === '\\' ? 2 : 1;
      i = j + q.length - 1;
      continue;
    }
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && (depth -= 1) === 0) return i + 1;
  }
  return -1;
}

// it.skip / test.todo / describe.skip (and their .each), xit / xdescribe / xtest, and a call whose
// options say { skip: … } or { todo: … }: the whole call is blanked, so the tests a skipped describe
// holds are dropped with it.
const SKIPPED_CALL = /\b(?:x(?:it|test|describe)|(?:it|test|describe)\.(?:skip|todo))(?:\.each)?\s*\(/g;
const OPTION_SKIP = /\b(?:it|test|describe)\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*\{[^{}]*\b(?:skip|todo)\s*:(?!\s*false\b)[^{}]*\}/g;
function blankSkippedJs(text) {
  let out = text;
  for (const re of [SKIPPED_CALL, OPTION_SKIP]) {
    for (const m of text.matchAll(re)) {
      let end = closeParen(text, text.indexOf('(', m.index));
      if (end === -1) end = text.length;
      // .each(table)(name, fn): the second call is the test.
      if (/\.each\s*\($/.test(m[0])) {
        const next = text.slice(end).match(/^\s*\(/);
        if (next) end = closeParen(text, end + next[0].length - 1);
        if (end === -1) end = text.length;
      }
      out = out.slice(0, m.index) + blank(out.slice(m.index, end)) + out.slice(end);
    }
  }
  return out;
}

// it/test/describe calls (Playwright's test.describe too); a member call such as regex.test("…") is no test.
const NAME_CALL = /(?:(?<![.\w$])(it|test)|(?<![\w$])(?:test\.)?(describe))(?:\.(?:each|only|concurrent|serial|parallel))?\s*\(\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;

// JS: the offset just past the parenthesis that closes the call opened at `open`, skipping strings,
// template literals (with their ${…}) and regex literals, so a describe's extent is its whole body.
// Comments are already blanked. -1 if the call never closes.
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function skipQuoted(text, i, q) {
  let j = i + 1;
  while (j < text.length && text[j] !== q && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
  return j;
}
function skipTemplate(text, i) {
  let j = i + 1;
  while (j < text.length && text[j] !== '`') {
    if (text[j] === '\\') { j += 2; continue; }
    if (text[j] === '$' && text[j + 1] === '{') {
      j = jsSkip(text, j + 1, '{', '}') - 1;
    }
    j += 1;
  }
  return j;
}
function skipRegex(text, i) {
  let j = i + 1;
  let cls = false;
  while (j < text.length && text[j] !== '\n') {
    const c = text[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '[') cls = true;
    else if (c === ']') cls = false;
    else if (c === '/' && !cls) return j;
    j += 1;
  }
  return i; // not a regex after all: read the slash as division
}
// From the opener at `open`, the offset just past its matching closer.
function jsSkip(text, open, opener, closer) {
  let depth = 0;
  let prev = '';
  let word = '';
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'") { i = skipQuoted(text, i, c); prev = c; word = ''; continue; }
    if (c === '`') { i = skipTemplate(text, i); prev = '`'; word = ''; continue; }
    if (c === '/' && (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || REGEX_AFTER_WORD.has(word))) { i = skipRegex(text, i); prev = '/'; word = ''; continue; }
    if (c === opener) depth += 1;
    else if (c === closer && (depth -= 1) === 0) return i + 1;
    if (/[A-Za-z0-9_$]/.test(c)) word = /[A-Za-z0-9_$]/.test(prev) ? word + c : c;
    else if (!/\s/.test(c)) word = '';
    if (!/\s/.test(c)) prev = c;
  }
  return -1;
}

// JS test names as Jest, Vitest, Playwright and node:test report them: each describe's title, outer
// first, joined with the test's own (' > '), so it('AC-3 …') inside describe('BOOK-12 …') is
// "BOOK-12 … > AC-3 …". A call outside any describe keeps its own title.
function jsFullNames(t) {
  const calls = [...t.matchAll(NAME_CALL)].map((m) => {
    const open = m.index + m[0].search(/\(/);
    const kind = m[1] ?? m[2];
    return { kind, title: m[4], start: m.index, end: kind === 'describe' ? jsSkip(t, open, '(', ')') : -1 };
  });
  const suites = calls.filter((c) => c.kind === 'describe');
  return calls.map((c) => {
    const outer = suites.filter((d) => d !== c && d.start < c.start && (d.end === -1 || c.start < d.end));
    return [...outer.map((d) => d.title), c.title].join(' > ');
  });
}

// Python: pytest's node ids, without the file: each test function under its enclosing classes
// (TestBook12::test_ac_3), and a parametrize id under the test it decorates (test_x[id]).
function pythonTestNames(t) {
  const lines = t.split('\n');
  const indent = (l) => l.match(/^\s*/)[0].length;
  const classesAbove = (row, col) => {
    const out = [];
    let limit = col;
    for (let r = row - 1; r >= 0 && limit > 0; r -= 1) {
      const m = lines[r].match(/^(\s*)class\s+([A-Za-z_]\w*)/);
      if (m && m[1].length < limit) { out.unshift(m[2]); limit = m[1].length; }
      else if (lines[r].trim() && indent(lines[r]) < limit && !/^\s*(?:@|#|class\b)/.test(lines[r])) limit = indent(lines[r]);
    }
    return out;
  };
  const defs = [];
  lines.forEach((l, row) => {
    const m = l.match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/);
    if (m) defs.push({ row, offset: lines.slice(0, row).join('\n').length + (row ? 1 : 0), name: m[2], full: [...classesAbove(row, m[1].length), m[2]].join('::') });
  });
  const tests = defs.filter((d) => d.name.startsWith('test'));
  // A parametrize id belongs to the next def after it, when that def is a test; else it stands alone.
  const owner = (offset) => { const d = defs.find((x) => x.offset > offset); return d?.name.startsWith('test') ? d : null; };
  const ids = [
    ...[...t.matchAll(/\bids\s*=\s*[[(]([^\])]*)[\])]/g)].flatMap((m) => [...m[1].matchAll(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((x) => ({ id: x[2], at: m.index }))),
    ...pytestParamIds(t),
  ];
  return [...tests.map((d) => d.full), ...ids.map(({ id, at }) => { const d = owner(at); return d ? `${d.full}[${id}]` : id; })];
}
// A Rust test: a fn under a test attribute (#[test], #[tokio::test], #[rstest], #[test_case(…)]), not #[ignore].
const RUST_FN = /((?:#\[[^\]]*\]\s*)+)(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/g;
const RUST_TEST_ATTR = /#\[\s*(?:[\w]+::)*(?:test|rstest|test_case)\b/;
const RUST_IGNORE = /#\[\s*ignore\b/;
// Python: the id="…" of each pytest.param(…).
const pytestParamIds = (t) => [...t.matchAll(/\bpytest\.param\s*\(/g)].flatMap((m) => {
  const open = m.index + m[0].length - 1;
  const end = closeParen(t, open, SYNTAX.python.quotes);
  const args = t.slice(open, end === -1 ? t.length : end);
  return [...args.matchAll(/\bid\s*=\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((x) => ({ id: x[2], at: m.index }));
});
const EXTRACTORS = {
  js: [(t) => jsFullNames(blankSkippedJs(t))],
  // Go: t.Run("…") subtests (b.Run for benchmarks), and the TestXxx function names.
  go: [
    (t) => [...t.matchAll(/\b[tb]\.Run\(\s*"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]),
    (t) => [...t.matchAll(/\bfunc\s+(Test\w+)\s*\(/g)].map((m) => m[1]),
  ],
  // Python: def test_… (ac_2 matches AC-2) under its classes; pytest parametrize ids=[…] and
  // pytest.param(…, id="…") under the test they decorate.
  python: [pythonTestNames],
  // JUnit 5 (Java and Kotlin): @DisplayName("…").
  junit: [(t) => [...t.matchAll(/@(?:[A-Za-z_][\w.]*\.)?DisplayName\(\s*"((?:\\.|[^"\\])*)"\s*\)/g)].map((m) => m[1])],
  // Kotlin: backticked function names, fun `AC-2 rounds half to even`().
  kotlin: [(t) => [...t.matchAll(/\bfun\s+`([^`]+)`/g)].map((m) => m[1])],
  // Rust: the names of test fns (ac_2 matches AC-2); a helper fn or an #[ignore]d test is no test.
  rust: [(t) => [...t.matchAll(RUST_FN)].filter((m) => RUST_TEST_ATTR.test(m[1]) && !RUST_IGNORE.test(m[1])).map((m) => m[2])],
  // Ruby (RSpec, minitest/spec): it "…", describe/context/specify/test "…" (xit and friends never run).
  ruby: [(t) => [...t.matchAll(/\b(?:it|describe|context|specify|test)\s*\(?\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2])],
};
const BY_EXTENSION = {
  '.js': ['js'], '.mjs': ['js'], '.cjs': ['js'], '.jsx': ['js'], '.ts': ['js'], '.tsx': ['js'], '.mts': ['js'], '.cts': ['js'],
  '.go': ['go'], '.py': ['python'], '.java': ['junit'], '.kt': ['junit', 'kotlin'], '.kts': ['junit', 'kotlin'], '.rs': ['rust'], '.rb': ['ruby'],
};

// The test names in one file's text. file (optional) picks the extractors by extension; patterns are
// extra regexes (--test-pattern), read from the same text: each match's first capture group, or the
// whole match, is a name.
export function testNames(text, { file = null, patterns = [] } = {}) {
  const ext = file ? (file.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase() : '';
  const known = BY_EXTENSION[ext];
  const langs = known ?? Object.keys(EXTRACTORS);
  const source = known ? blankComments(text, known[0]) : text;
  const names = langs.flatMap((l) => EXTRACTORS[l].flatMap((fn) => fn(source)));
  for (const p of patterns) {
    const re = new RegExp(p instanceof RegExp ? p.source : p, 'gm');
    for (const m of source.matchAll(re)) names.push(m[1] ?? m[0]);
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

// The indexes of the names that carry an id, as namedIn reads one name.
export function namingIndexes(names, id) {
  const res = idPatterns(id);
  return names.flatMap((n, i) => (res.some((re) => re.test(n)) ? [i] : []));
}

export const DEFAULT_TEST_GLOBS = [
  '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.js', '**/*.test.js', '**/*.spec.mjs', '**/*.test.mjs', '**/*.e2e-spec.ts', 'e2e/**/*.ts', 'tests/**/*.ts',
  '**/*_test.go', '**/test_*.py', '**/*_test.py', '**/*Test.java', '**/*Tests.java', '**/*Test.kt', '**/*Tests.kt', 'tests/**/*.rs', 'src/**/*.rs', '**/*_spec.rb', '**/*_test.rb', '**/test_*.rb',
];
