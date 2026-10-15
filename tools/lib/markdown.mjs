// Markdown helpers for the artifact parsers. Line-based and dependency-free: the artifacts are
// written from templates, so headings, GFM tables and "- **Field:** value" bullets are all we read.
// Every helper keeps 1-based line numbers so errors point at the file.

// Blank out <!-- comments --> without changing line numbers.
export function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
}

export function splitLines(text) {
  return text.split(/\r?\n/);
}

// true for every line inside a ``` or ~~~ fence (fence lines included).
export function fenceMask(lines) {
  const mask = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      mask.push(true);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    } else if (m) {
      fence = m[1];
      mask.push(true);
    } else mask.push(false);
  }
  return mask;
}

// Headings outside fences: { level, text, index } where index is the 0-based line index.
export function headings(lines, mask = fenceMask(lines)) {
  const out = [];
  lines.forEach((line, i) => {
    if (mask[i]) return;
    const m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2], index: i });
  });
  return out;
}

// Split into blocks at headings matching re (at most maxLevel deep); each block runs to the next
// heading of the same or a higher level.
export function blocks(lines, re, { maxLevel = 2, minLevel = 1 } = {}) {
  const mask = fenceMask(lines);
  const hs = headings(lines, mask);
  const out = [];
  hs.forEach((h, k) => {
    if (h.level > maxLevel || h.level < minLevel) return;
    const m = h.text.match(re);
    if (!m) return;
    const next = hs.slice(k + 1).find((n) => n.level <= h.level);
    const end = next ? next.index : lines.length;
    out.push({ heading: h, match: m, start: h.index + 1, end, lines: lines.slice(h.index + 1, end), mask: mask.slice(h.index + 1, end) });
  });
  return out;
}

// The section under the first level-2 heading matching re, or null.
export function section(lines, re, level = 2) {
  return blocks(lines, re, { maxLevel: level, minLevel: level })[0] ?? null;
}

const splitRow = (line) => {
  const cells = [];
  let cur = '';
  let code = false;
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '\\' && body[i + 1] === '|') { cur += '|'; i += 1; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
};

// GFM tables in a block: [{ headers, rows: [{ cells, index }], index }] with 0-based line indexes
// relative to the lines given (add the block's start for file lines).
export function tables(lines, mask = fenceMask(lines)) {
  const out = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (mask[i] || !/^\s*\|.*\|\s*$/.test(lines[i])) continue;
    if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) continue;
    const headers = splitRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && !mask[j] && /^\s*\|.*\|\s*$/.test(lines[j])) {
      rows.push({ cells: splitRow(lines[j]), index: j });
      j += 1;
    }
    out.push({ headers, rows, index: i });
    i = j - 1;
  }
  return out;
}

// "- **Label:** value" bullets at column 0, with what is nested under them:
//   numbered or plain sub-bullets  -> items[]
//   "  - **Sub:** value"           -> fields[] (one level)
//   other indented text            -> continuation of value
// Returns [{ label, value, items, fields, index }], index 0-based relative to the lines given.
export function fieldBullets(lines, mask = fenceMask(lines)) {
  const out = [];
  let cur = null;
  const FIELD = /^-\s+\*\*([^*]+?):\*\*\s*(.*)$/;
  const SUBFIELD = /^\s+[-*]\s+\*\*([^*]+?):\*\*\s*(.*)$/;
  const ITEM = /^\s+(?:[-*+]|\d+[.)])\s+(.*)$/;
  lines.forEach((line, i) => {
    if (mask[i]) return;
    const f = line.match(FIELD);
    if (f) {
      cur = { label: f[1].trim(), value: f[2].trim(), items: [], fields: [], index: i };
      out.push(cur);
      return;
    }
    if (!cur) return;
    if (!line.trim()) return;
    if (!/^\s/.test(line)) { cur = null; return; }
    const sf = line.match(SUBFIELD);
    if (sf) { cur.fields.push({ label: sf[1].trim(), value: sf[2].trim(), index: i }); return; }
    const it = line.match(ITEM);
    if (it) { cur.items.push(it[1].trim()); return; }
    const last = cur.fields.at(-1);
    if (last && i - 1 === last.index) last.value = `${last.value} ${line.trim()}`.trim();
    else cur.value = `${cur.value} ${line.trim()}`.trim();
  });
  return out;
}

// "**Label:** value" paragraphs (DECISIONS.md style): a field runs until the next known label line.
// Unknown bold labels without a colon inside the bold (**Measured** (…)) are part of the value.
// "**Label:** value" lines; "**Label.** value" too when the label is one of periodLabels (normalized),
// so a bold sentence opening a paragraph is not read as a field.
export function boldFields(lines, mask = fenceMask(lines), { periodLabels = new Set() } = {}) {
  const out = [];
  let cur = null;
  lines.forEach((line, i) => {
    if (mask[i]) { if (cur) cur.raw.push(line); return; }
    const period = line.match(/^\*\*([A-Z][A-Za-z ()/-]*?)\.\*\*\s*(.*)$/);
    const m = line.match(/^\*\*([A-Z][A-Za-z ()/-]*?):\*\*\s*(.*)$/) ?? (period && periodLabels.has(normLabel(period[1])) ? period : null);
    if (m) {
      cur = { label: m[1].trim(), raw: [m[2]], index: i };
      out.push(cur);
    } else if (cur) cur.raw.push(line);
  });
  for (const f of out) {
    while (f.raw.length && !f.raw.at(-1).trim()) f.raw.pop();
    f.value = f.raw.join('\n').trim();
    delete f.raw;
  }
  return out;
}

// A template token left unfilled: TODO(...) anywhere, a value that is wholly one <...> token, or an
// ellipsis. "<stage>" inside prose (ops/deploy.sh <stage>) is content, not a placeholder.
export const isPlaceholder = (s) => {
  if (typeof s !== 'string') return false;
  const t = s.trim().replace(/^`|`$/g, '');
  return /TODO\(/.test(t) || /^<[^<>]+>$/.test(t) || /^(…|\.\.\.)$/.test(t);
};

export const normLabel = (label) => label.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const listOf = (value) => (value ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
