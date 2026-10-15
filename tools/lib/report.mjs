import fs from 'node:fs';
import { walk } from './glob.mjs';
import { loadJsonl, readText } from './loaders.mjs';
import { registry as sharedRegistry } from './registry.mjs';
import { inferContracts, validateAs } from './validate.mjs';

// What the run records say a set of runs cost: per task, per role and in total — runs, outcomes,
// turns, cost, tokens, cache hit rate and denied calls — and the most expensive runs. Every line is
// validated against the run-record contract first; an invalid line is skipped and reported, never
// counted, and never stops the report.

export const OUTCOMES = ['advanced', 'stalled', 'needs-human', 'failed', 'verdict', 'read'];
const TOKENS = ['input', 'output', 'cache_read', 'cache_write'];

// The run-record files a path names: a file as given, or every file under a directory whose path
// is a run record's (.agent/loop-runs.jsonl, .agent/runs/*.jsonl, *.run-record.jsonl).
export function runFiles(target, { registry = sharedRegistry() } = {}) {
  if (!fs.statSync(target).isDirectory()) return [target];
  return walk(target).filter((f) => inferContracts(f, { registry }).some((h) => h.contract === 'run-record'));
}

// { runs: [{ data, file, line }], invalid: [{ file, line, rule, message }] }. A run started before
// `since` (ms since the epoch) is left out; an empty file holds no runs.
export function readRuns(files, { since = null, registry = sharedRegistry() } = {}) {
  const runs = [];
  const invalid = [];
  for (const file of files) {
    let text;
    try { text = readText(file); } catch (e) { invalid.push({ file, line: null, rule: 'unreadable', message: e.message }); continue; }
    if (!text.trim()) continue;
    const hit = inferContracts(file, { contract: 'run-record', registry })[0];
    if (!hit) { invalid.push({ file, line: null, rule: 'not-jsonl', message: 'a run-record file is JSON Lines (.jsonl)' }); continue; }
    const bad = new Map();
    for (const f of validateAs(file, hit, { registry, text }).findings) {
      // The pointer within the line: the record's own index is the line number already given.
      const at = f.pointer.replace(/^\/\d+/, '');
      if (f.severity === 'error' && !bad.has(f.line)) bad.set(f.line, { file, line: f.line, rule: f.rule, message: `${at ? `${at} ` : ''}${f.message}` });
    }
    invalid.push(...bad.values());
    for (const r of loadJsonl(text).records) {
      if (bad.has(r.line)) continue;
      if (since !== null && !(Date.parse(r.data.started_at) >= since)) continue;
      runs.push({ data: r.data, file, line: r.line });
    }
  }
  return { runs, invalid };
}

const denials = (d) => (Array.isArray(d.permission_denials) ? d.permission_denials.length : d.permission_denials ?? 0);
const money = (x) => Math.round(x * 1e6) / 1e6;

function totals(runs) {
  const t = { runs: runs.length, outcomes: Object.fromEntries(OUTCOMES.map((o) => [o, 0])), turns: 0, cost_usd: 0, unpriced: 0, with_usage: 0, tokens: Object.fromEntries(TOKENS.map((k) => [k, 0])), denials: 0 };
  for (const { data: d } of runs) {
    t.outcomes[d.outcome] += 1;
    t.turns += d.num_turns ?? 0;
    if (d.total_cost_usd == null) t.unpriced += 1;
    else t.cost_usd += d.total_cost_usd;
    if (d.usage) {
      t.with_usage += 1;
      for (const k of TOKENS) t.tokens[k] += d.usage[k] ?? 0;
    }
    t.denials += denials(d);
  }
  t.cost_usd = money(t.cost_usd);
  // All input the runs sent: uncached, read from the cache, and written to it.
  t.input_total = t.tokens.input + t.tokens.cache_read + t.tokens.cache_write;
  t.cache_hit_rate = t.input_total ? t.tokens.cache_read / t.input_total : null;
  return t;
}

const groupBy = (runs, key) => {
  const groups = new Map();
  for (const r of runs) {
    const k = key(r.data);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return groups;
};
const byCost = (key) => (a, b) => b.cost_usd - a.cost_usd || String(a[key]).localeCompare(String(b[key]));

export function summarize(runs, { top = 3 } = {}) {
  const tasks = [...groupBy(runs, (d) => d.task)].map(([task, rs]) => {
    const last = rs.reduce((a, b) => (Date.parse(b.data.ended_at) >= Date.parse(a.data.ended_at) ? b : a));
    return { task, last_status: last.data.status_after, ...totals(rs) };
  }).sort(byCost('task'));
  // A run with no role is the author's (the contract's default); roles are reported once any run names one.
  const roles = runs.some((r) => r.data.role !== undefined)
    ? [...groupBy(runs, (d) => d.role ?? 'author')].map(([role, rs]) => ({ role, ...totals(rs) })).sort(byCost('role'))
    : null;
  const expensive = runs.filter((r) => r.data.total_cost_usd != null)
    .sort((a, b) => b.data.total_cost_usd - a.data.total_cost_usd || a.data.started_at.localeCompare(b.data.started_at))
    .slice(0, top)
    .map(({ data: d, file, line }) => ({ task: d.task, role: d.role ?? 'author', session_id: d.session_id, started_at: d.started_at, outcome: d.outcome, num_turns: d.num_turns, cost_usd: d.total_cost_usd, file, line }));
  return { total: totals(runs), tasks, roles, most_expensive: expensive };
}

const tokens = (n) => (n < 1e3 ? String(n) : n < 1e6 ? `${(n / 1e3).toFixed(1)}k` : `${(n / 1e6).toFixed(2)}M`);
const usd = (x) => `$${x > 0 && x < 0.01 ? x.toFixed(4) : x.toFixed(2)}`;
const pct = (t) => (t.cache_hit_rate === null ? '—' : `${Math.round(t.cache_hit_rate * 100)}%${t.with_usage < t.runs ? ` (${t.with_usage}/${t.runs} runs)` : ''}`);

// One row per group: the label (task or role) and, for tasks, the status the latest run left, are
// left-aligned; the numbers are right-aligned.
function table(rows, label, outcomes) {
  const status = label === 'task';
  const cells = rows.map((t) => [
    t[label], String(t.runs), ...outcomes.map((o) => String(t.outcomes[o])), String(t.turns),
    `${usd(t.cost_usd)}${t.unpriced ? '*' : ''}`, t.with_usage ? tokens(t.input_total) : '—', t.with_usage ? tokens(t.tokens.output) : '—',
    pct(t), String(t.denials), ...(status ? [t.last_status ?? '—'] : []),
  ]);
  const header = [label, 'runs', ...outcomes, 'turns', 'cost', 'input', 'output', 'cache hit', 'denials', ...(status ? ['last status'] : [])];
  const width = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
  const left = (i) => i === 0 || (status && i === header.length - 1);
  const line = (c) => c.map((x, i) => (left(i) ? x.padEnd(width[i]) : x.padStart(width[i]))).join('  ').trimEnd();
  return [line(header), ...cells.map(line)];
}

export function render({ files, invalid, since }, s) {
  const out = [];
  const skipped = invalid.length ? `, ${invalid.length} invalid line${invalid.length === 1 ? '' : 's'} skipped` : '';
  out.push(`${s.total.runs} run${s.total.runs === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'}${skipped}${since ? `, started since ${since}` : ''}`);
  if (s.total.runs) {
    // Outcome columns that are zero everywhere stay out; an author-only log has no verdict or read.
    const outcomes = OUTCOMES.filter((o) => s.total.outcomes[o] > 0);
    out.push('', ...table([...s.tasks, { ...s.total, task: 'total', last_status: '' }], 'task', outcomes));
    if (s.roles) out.push('', ...table(s.roles, 'role', outcomes));
    out.push('', 'most expensive runs');
    s.most_expensive.forEach((r, i) => out.push(`  ${i + 1}. ${usd(r.cost_usd)}  ${r.task} (${r.role}) ${r.outcome}, ${r.num_turns ?? '?'} turns, session ${r.session_id}, ${r.started_at}  ${r.file}:${r.line}`));
    out.push('', 'input counts every input token (uncached, cache read, cache write); cache hit = cache read / input.');
    if (s.total.unpriced) out.push(`* ${s.total.unpriced} run${s.total.unpriced === 1 ? '' : 's'} reported no cost (killed, or no result): the cost shown is a floor.`);
  }
  if (invalid.length) {
    out.push('', 'invalid lines (skipped)');
    for (const x of invalid) out.push(`  ${x.file}${x.line ? `:${x.line}` : ''}  ${x.rule}: ${x.message}`);
  }
  return out.join('\n');
}
