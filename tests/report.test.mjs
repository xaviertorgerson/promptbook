import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readRuns, render, runFiles, summarize } from '../tools/lib/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-report-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const report = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/report.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

// fixtures/report: a loop's .agent/loop-runs.jsonl with usage, a log from before usage (with an
// evaluator's and a reader's run), and a file whose second line is a needs-human run with no reason.
describe('report: the fixtures', () => {
  const files = runFiles(path.join(FIX, 'report'));
  const { runs, invalid } = readRuns(files);
  const s = summarize(runs);

  it('finds the run-record files in a directory, the loop\'s own under .agent/ included', () => {
    assert.deepEqual(files.map((f) => path.relative(path.join(FIX, 'report'), f)), ['invalid.run-record.jsonl', 'legacy.run-record.jsonl', 'project/.agent/loop-runs.jsonl']);
  });

  it('skips the invalid line, names its file, line and rule, and counts every valid one', () => {
    assert.deepEqual(invalid.map((x) => [path.basename(x.file), x.line, x.rule]), [['invalid.run-record.jsonl', 2, 'failure-says-why']]);
    assert.equal(s.total.runs, 11);
    assert.deepEqual(s.total.outcomes, { advanced: 4, stalled: 2, 'needs-human': 1, failed: 2, verdict: 1, read: 1 });
  });

  it('totals turns, cost and denials, and says how many runs reported no cost', () => {
    assert.equal(s.total.turns, 293);
    assert.equal(s.total.cost_usd, 14.92);
    assert.equal(s.total.unpriced, 1);
    assert.equal(s.total.denials, 1);
  });

  it('computes the cache hit rate over the runs that report usage: cache read / all input', () => {
    assert.equal(s.total.with_usage, 5);
    assert.deepEqual(s.total.tokens, { input: 9300, output: 185000, cache_read: 11410000, cache_write: 1995000 });
    assert.equal(s.total.input_total, 13414300);
    near(s.total.cache_hit_rate, 11410000 / 13414300);
  });

  it('reports per task, costliest first, with the status the latest run left', () => {
    assert.deepEqual(s.tasks.map((t) => [t.task, t.runs, t.cost_usd, t.last_status]), [
      ['BILL-6', 2, 5.98, 'review'], ['BILL-5', 2, 3.95, 'review'], ['BILL-3', 4, 2.76, 'ready'], ['BILL-7', 3, 2.23, 'review'],
    ]);
    assert.equal(s.tasks.find((t) => t.task === 'BILL-7').cache_hit_rate, null);
  });

  it('reports per role once a run names one; a run without a role is the author\'s', () => {
    assert.deepEqual(s.roles.map((r) => [r.role, r.runs]), [['author', 9], ['evaluator', 1], ['reader', 1]]);
  });

  it('lists the three most expensive runs with where each line is', () => {
    assert.deepEqual(s.most_expensive.map((r) => [r.task, r.cost_usd, r.outcome, path.basename(r.file), r.line]), [
      ['BILL-6', 5.02, 'failed', 'loop-runs.jsonl', 4], ['BILL-5', 3.37, 'stalled', 'loop-runs.jsonl', 2], ['BILL-3', 2.14, 'advanced', 'loop-runs.jsonl', 1],
    ]);
  });

  it('prints the tables, the invalid line and the floor on cost', () => {
    const text = render({ files, invalid, since: null }, s);
    assert.match(text, /^11 runs in 3 files, 1 invalid line skipped$/m);
    assert.match(text, /^task +runs +advanced +stalled +needs-human +failed +verdict +read +turns +cost +input +output +cache hit +denials +last status$/m);
    assert.match(text, /^total +11 +4 +2 +1 +2 +1 +1 +293 +\$14\.92\* +13\.41M +185\.0k +85% \(5\/11 runs\) +1$/m);
    assert.match(text, /^BILL-7 .* — +— +— +0 +review$/m);
    assert.match(text, /^role +runs /m);
    assert.match(text, /^ {2}1\. \$5\.02 {2}BILL-6 \(author\) failed, 88 turns, session 3e9c5d8b/m);
    assert.match(text, /invalid\.run-record\.jsonl:2 {2}failure-says-why: \/reason must be string/);
    assert.match(text, /^\* 1 run reported no cost/m);
  });
});

describe('report: line shapes', () => {
  it('the loop\'s own lines with usage (loop-mjs-usage.jsonl): tokens summed, no role table', () => {
    const { runs, invalid } = readRuns([path.join(FIX, 'valid/run-record/loop-mjs-usage.jsonl')]);
    const s = summarize(runs);
    assert.equal(invalid.length, 0);
    assert.deepEqual(s.total.tokens, { input: 200, output: 4000, cache_read: 248000, cache_write: 32000 });
    assert.equal(Math.round(s.total.cache_hit_rate * 100), 89);
    assert.equal(s.total.denials, 1);
    assert.equal(s.roles, null);
    const text = render({ files: ['x'], invalid, since: null }, s);
    assert.doesNotMatch(text, /verdict|^role /m, 'outcome columns that are zero everywhere, and the role table, stay out');
  });

  it('lines from before usage report no hit rate rather than 0%', () => {
    const s = summarize(readRuns([path.join(FIX, 'report/legacy.run-record.jsonl')]).runs);
    assert.equal(s.total.with_usage, 0);
    assert.equal(s.total.cache_hit_rate, null);
    assert.match(render({ files: ['x'], invalid: [], since: null }, s), /^total +6 .* — +— +— +0$/m);
  });

  it('a line that is not a run record is skipped and counted, never fatal; an empty file holds no runs', () => {
    const good = fs.readFileSync(path.join(FIX, 'valid/run-record/loop-mjs-usage.jsonl'), 'utf8').split('\n')[0];
    const file = path.join(TMP, 'mixed.run-record.jsonl');
    fs.writeFileSync(file, [good, '{"task":"T-1","session_id":"cut off mid-wri', 'null', '[1]', '{"task":"T-2"}', '', good.replace('"usage":{', '"usage":{"cache_hit":1,')].join('\n'));
    const empty = path.join(TMP, 'empty.run-record.jsonl');
    fs.writeFileSync(empty, '');
    const json = path.join(TMP, 'runs.json');
    fs.writeFileSync(json, good);
    const { runs, invalid } = readRuns([file, empty, json]);
    assert.equal(runs.length, 1);
    assert.deepEqual(invalid.map((x) => [path.basename(x.file), x.line, x.rule]), [
      ['mixed.run-record.jsonl', 2, 'parse-error'], ['mixed.run-record.jsonl', 3, 'invalid-document'], ['mixed.run-record.jsonl', 4, 'invalid-document'],
      ['mixed.run-record.jsonl', 5, 'missing-session-id'], ['mixed.run-record.jsonl', 7, 'usage-counts-tokens'], ['runs.json', null, 'not-jsonl'],
    ]);
  });

  it('a directory holds run records only at their paths; another .jsonl there is not read', () => {
    const dir = path.join(TMP, 'proj');
    fs.mkdirSync(path.join(dir, '.agent', 'runs'), { recursive: true });
    for (const f of ['.agent/loop-runs.jsonl', '.agent/runs/ci.jsonl', 'notes.jsonl', 'a.run-record.jsonl']) fs.writeFileSync(path.join(dir, f), '');
    assert.deepEqual(runFiles(dir).map((f) => path.relative(dir, f)).sort(), ['.agent/loop-runs.jsonl', '.agent/runs/ci.jsonl', 'a.run-record.jsonl']);
  });
});

describe('report: the command', () => {
  it('exits 1 when a line was skipped, 0 when every line is a run record, 2 on a usage error', () => {
    assert.equal(report('fixtures/report').status, 1);
    const ok = report('fixtures/report/project');
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^4 runs in 1 file$/m);
    assert.equal(report('fixtures/report/project', '--since', 'last week').status, 2);
    assert.equal(report('fixtures/report/nowhere').status, 2);
    assert.equal(report('--frobnicate').status, 2);
  });

  it('--since keeps the runs started at or after it', () => {
    const r = report('fixtures/report/project', '--since', '2026-10-14', '--json');
    const j = JSON.parse(r.stdout);
    assert.equal(j.since, '2026-10-14');
    assert.deepEqual(j.tasks.map((t) => [t.task, t.runs]), [['BILL-6', 1], ['BILL-5', 1]]);
  });

  it('--json is the summary, and a file named twice (and through its directory) is read once', () => {
    const r = report('fixtures/report/project', 'fixtures/report/project/.agent/loop-runs.jsonl', '--json');
    const j = JSON.parse(r.stdout);
    assert.deepEqual(j.files, ['fixtures/report/project/.agent/loop-runs.jsonl']);
    const s = summarize(readRuns([path.join(FIX, 'report/project/.agent/loop-runs.jsonl')]).runs);
    for (const k of ['total', 'tasks', 'roles']) assert.deepEqual(j[k], s[k], k);
    assert.equal(j.total.cost_usd, 11.11);
  });
});
