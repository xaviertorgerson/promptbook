import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../tools/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'promptbook-cli-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Run the bin the way a package manager installs it: a symlink on PATH.
const bin = path.join(TMP, 'promptbook');
fs.symlinkSync(path.join(ROOT, pkg.bin.promptbook), bin);
const promptbook = (...a) => spawnSync(bin, a, { encoding: 'utf8', cwd: ROOT });

describe('promptbook CLI', () => {
  it('package.json names tools/cli.mjs as the promptbook bin, and an npm script per command', () => {
    assert.deepEqual(pkg.bin, { promptbook: 'tools/cli.mjs' });
    for (const cmd of Object.keys(COMMANDS)) assert.ok(pkg.scripts[cmd], `scripts.${cmd}`);
    assert.ok(fs.statSync(path.join(ROOT, 'tools/cli.mjs')).mode & 0o111, 'executable');
  });

  it('lists the commands, and exits 2 without one or on an unknown one', () => {
    const r = promptbook();
    assert.equal(r.status, 2);
    for (const cmd of ['validate', 'trace', 'lint', 'simulate', 'compile-policy', 'lock', 'eval-routing']) assert.match(r.stdout, new RegExp(`^ {2}${cmd} `, 'm'));
    assert.equal(promptbook('--help').status, 0);
    assert.equal(promptbook('frobnicate').status, 2);
  });

  it('dispatches each command with its arguments and passes its exit code through', () => {
    assert.equal(promptbook('validate', 'fixtures/valid/task').status, 0);
    assert.equal(promptbook('validate', 'fixtures/invalid/task/invalid-status.md').status, 1);
    const tr = promptbook('trace', 'fixtures/trace/complete');
    assert.equal(tr.status, 0, tr.stdout);
    assert.match(tr.stdout, /^PASS trace: 0 error/m);
    assert.equal(promptbook('trace', 'fixtures/trace/broken').status, 1);
    assert.equal(promptbook('lint', 'fixtures/lint/good/skills').status, 0);
    assert.equal(promptbook('simulate', 'fixtures/scenarios/happy-path.yaml', '--no-trace').status, 0);
    assert.equal(promptbook('compile-policy', 'fixtures/compile-policy/golden/agent-policy.yaml', '--profile', 'ci', '--engine', 'claude').status, 0);
    assert.equal(promptbook('eval-routing', 'fixtures/lint/good/skills').status, 0);
    assert.equal(promptbook('lock', '--lock', path.join(TMP, 'none.lock')).status, 2);
    assert.equal(promptbook('report', 'fixtures/report/project').status, 0);
    assert.equal(promptbook('report', 'fixtures/report').status, 1);
    for (const cmd of Object.keys(COMMANDS)) assert.equal(promptbook(cmd, '--help').status, 0, `${cmd} --help`);
  });
});
