import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// harness run: an engine launched under its compiled runner.json, with the caps the engine does not
// enforce itself enforced here (review finding 12), against a stand-in engine.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAKE = path.join(ROOT, 'fixtures/run/fake-engine.mjs');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-run-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
const runnerFile = (over = {}) => {
  const r = {
    generated_by: 'harness compile-policy',
    source: 'agent-policy.yaml',
    engine: 'claude',
    profile: 'ci',
    tier: 'unattended',
    args: [],
    caps: { max_turns: 10, max_budget_usd: 4, timeout_seconds: 60 },
    enforcement: { max_turns: 'engine', max_budget_usd: 'engine', timeout_seconds: 'harness-run' },
    ...over,
  };
  n += 1;
  const file = path.join(TMP, `runner-${n}.json`);
  fs.writeFileSync(file, JSON.stringify(r));
  return file;
};
const run = (runner, engineArgs, extra = []) => {
  const report = path.join(TMP, `report-${n}.json`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), 'run', '--runner', runner, '--report', report, '--grace', '1', ...extra, '--', process.execPath, FAKE, ...engineArgs], { encoding: 'utf8', timeout: 20_000 });
  return { ...r, report: fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : null };
};

describe('harness run', () => {
  it('appends the runner\'s args to the engine command and passes its output and exit code through', () => {
    const r = run(runnerFile({ args: ['--permission-mode', 'dontAsk', '--max-turns', '10'] }), ['args']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).argv, ['--permission-mode', 'dontAsk', '--max-turns', '10']);
    assert.equal(run(runnerFile(), ['exit', '3']).status, 3);
  });

  it('kills a run at its timeout (a hard wall-clock kill) and exits 124', () => {
    const t0 = Date.now();
    const r = run(runnerFile({ caps: { max_turns: 10, max_budget_usd: 4, timeout_seconds: 1 } }), ['sleep']);
    assert.equal(r.status, 124, r.stderr);
    assert.ok(Date.now() - t0 < 10_000, 'killed near the deadline');
    assert.match(r.stderr, /stopped claude at timeout_seconds 1/);
    assert.equal(r.report.stopped_by, 'timeout_seconds');
  });

  it('codex: counts tool actions in the --json stream and stops the run past max_turns, exit 125', () => {
    const r = run(runnerFile({ engine: 'codex', args: ['--json'], caps: { max_turns: 3, max_budget_usd: 4, timeout_seconds: 60 }, enforcement: { max_turns: 'harness-run', max_budget_usd: 'none', timeout_seconds: 'harness-run' } }), ['codex', '20']);
    assert.equal(r.status, 125, r.stderr);
    assert.equal(r.report.stopped_by, 'max_turns');
    assert.equal(r.report.turns, 4, 'stopped as the fourth action started');
    const ok = run(runnerFile({ engine: 'codex', args: ['--json'], caps: { max_turns: 5, max_budget_usd: 4, timeout_seconds: 60 }, enforcement: { max_turns: 'harness-run', max_budget_usd: 'none', timeout_seconds: 'harness-run' } }), ['codex', '2']);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.report.turns, 2);
    assert.deepEqual(ok.report.usage, { input_tokens: 10, output_tokens: 5 });
  });

  it('claude: checks the reported cost and turns against the caps after the run, exit 125 on a breach', () => {
    const over = run(runnerFile(), ['claude', '3', '4.5']);
    assert.equal(over.status, 125, over.stderr);
    assert.equal(over.report.stopped_by, 'max_budget_usd');
    assert.equal(over.report.cost_usd, 4.5);
    assert.equal(run(runnerFile(), ['claude', '3', '1.2']).status, 0);
  });

  it('refuses to start an unattended run whose caps are missing or that no clock bounds where the engine meters no spend', () => {
    const noCaps = run(runnerFile({ caps: undefined }), ['args']);
    assert.equal(noCaps.status, 1);
    assert.match(noCaps.stderr, /refused/);
    const noClock = run(runnerFile({ engine: 'gemini', caps: { max_turns: 5, max_budget_usd: 1, timeout_seconds: null } }), ['args']);
    assert.equal(noClock.status, 1);
    assert.match(noClock.stderr, /timeout_seconds/);
    const notCompiled = run(runnerFile({ generated_by: 'hand' }), ['args']);
    assert.equal(notCompiled.status, 1);
  });

  it('exits 2 on a usage error', () => {
    assert.equal(spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), 'run', '--runner', runnerFile()], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), 'run', '--', 'true'], { encoding: 'utf8' }).status, 2);
  });
});
