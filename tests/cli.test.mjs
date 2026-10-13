import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../tools/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-cli-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Run the bin the way a package manager installs it: a symlink on PATH.
const bin = path.join(TMP, 'harness');
fs.symlinkSync(path.join(ROOT, pkg.bin.harness), bin);
const harness = (...a) => spawnSync(bin, a, { encoding: 'utf8', cwd: ROOT });

describe('harness CLI', () => {
  it('package.json names tools/cli.mjs as the harness bin, and an npm script per command', () => {
    assert.deepEqual(pkg.bin, { harness: 'tools/cli.mjs' });
    for (const cmd of Object.keys(COMMANDS)) assert.ok(pkg.scripts[cmd], `scripts.${cmd}`);
    assert.ok(fs.statSync(path.join(ROOT, 'tools/cli.mjs')).mode & 0o111, 'executable');
  });

  it('lists the commands, and exits 2 without one or on an unknown one', () => {
    const r = harness();
    assert.equal(r.status, 2);
    for (const cmd of ['validate', 'trace', 'lint', 'simulate', 'compile-policy', 'lock', 'eval-routing']) assert.match(r.stdout, new RegExp(`^ {2}${cmd} `, 'm'));
    assert.equal(harness('--help').status, 0);
    assert.equal(harness('frobnicate').status, 2);
  });

  it('dispatches each command with its arguments and passes its exit code through', () => {
    assert.equal(harness('validate', 'fixtures/valid/task').status, 0);
    assert.equal(harness('validate', 'fixtures/invalid/task/invalid-status.md').status, 1);
    const tr = harness('trace', 'fixtures/trace/complete');
    assert.equal(tr.status, 0, tr.stdout);
    assert.match(tr.stdout, /^PASS trace: 0 error/m);
    assert.equal(harness('trace', 'fixtures/trace/broken').status, 1);
    assert.equal(harness('lint', 'fixtures/lint/good/skills').status, 0);
    assert.equal(harness('simulate', 'fixtures/scenarios/happy-path.yaml', '--no-trace').status, 0);
    assert.equal(harness('compile-policy', 'fixtures/compile-policy/golden/agent-policy.yaml', '--profile', 'ci', '--engine', 'claude').status, 0);
    assert.equal(harness('eval-routing', 'fixtures/lint/good/skills').status, 0);
    assert.equal(harness('lock', '--lock', path.join(TMP, 'none.lock')).status, 2);
    for (const cmd of Object.keys(COMMANDS)) assert.equal(harness(cmd, '--help').status, 0, `${cmd} --help`);
  });
});
