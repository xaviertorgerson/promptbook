import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRequires, hostEnv, parseHost, preconditionFailures } from '../tools/lib/requires.mjs';

// Review finding 13: a profile's `requires` are named probes of the host, and a bypass run does not
// start until they pass.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'promptbook-requires-'));
const FAKE = path.join(ROOT, 'fixtures/run/fake-engine.mjs');
const promptbook = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), ...a], { encoding: 'utf8', timeout: 20_000 });
// spawnSync would block the event loop that answers the listening socket; a reachable host needs an
// async child.
const promptbookAsync = (...a) => new Promise((resolve) => {
  const c = spawn(process.execPath, [path.join(ROOT, 'tools/cli.mjs'), ...a], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  c.stdout.on('data', (d) => { stdout += d; });
  c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => resolve({ status, stdout, stderr }));
});

let server;
let open;
let closed;
before(async () => {
  server = net.createServer((s) => s.end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  open = `127.0.0.1:${server.address().port}`;
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  closed = `127.0.0.1:${probe.address().port}`;
  await new Promise((r) => probe.close(r));
});
after(() => {
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

const fakeEnv = (over = {}) => ({ ...hostEnv, platform: 'linux', uid: () => 1000, env: {}, exists: () => false, read: () => '', which: () => null, run: () => 1, ...over });

describe('check-requires probes', () => {
  it('prod-unreachable-from-this-host fails when a listed production host accepts a connection, and when none is listed', async () => {
    const [reach] = await checkRequires(['prod-unreachable-from-this-host'], { prod_hosts: [closed, open], connect_timeout_ms: 2000 });
    assert.equal(reach.ok, false, reach.detail);
    assert.match(reach.detail, new RegExp(`${open} connected`));
    const [unreach] = await checkRequires(['prod-unreachable-from-this-host'], { prod_hosts: [closed, 'prod-db.invalid:5432'], connect_timeout_ms: 2000 });
    assert.equal(unreach.ok, true, unreach.detail);
    const [none] = await checkRequires(['prod-unreachable-from-this-host'], {});
    assert.equal(none.ok, false);
    assert.match(none.detail, /lists no production host/);
  });

  it('non-root, container, non-root-container and sandbox-available read the host; an unknown name fails closed', async () => {
    const results = (names, env) => checkRequires(names, {}, fakeEnv(env));
    assert.deepEqual((await results(['non-root'], { uid: () => 0 })).map((r) => r.ok), [false]);
    assert.deepEqual((await results(['non-root'], {})).map((r) => r.ok), [true]);
    assert.deepEqual((await results(['container'], { exists: (p) => p === '/.dockerenv' })).map((r) => r.ok), [true]);
    assert.deepEqual((await results(['container'], { read: () => '0::/system.slice/docker-1a2b.scope' })).map((r) => r.ok), [true]);
    assert.deepEqual((await results(['container'], {})).map((r) => r.ok), [false]);
    assert.deepEqual((await results(['non-root-container'], { uid: () => 0, exists: () => true })).map((r) => r.ok), [false]);
    assert.deepEqual((await results(['sandbox-available'], { which: () => '/usr/bin/bwrap', run: () => 0 })).map((r) => r.ok), [true]);
    assert.deepEqual((await results(['sandbox-available'], { which: () => '/usr/bin/bwrap', run: () => 1 })).map((r) => r.ok), [false]);
    assert.deepEqual((await results(['sandbox-available'], { platform: 'win32' })).map((r) => r.ok), [false]);
    const [unknown] = await results(['prod-unrechable-from-this-host'], {});
    assert.equal(unknown.ok, false);
    assert.match(unknown.detail, /no probe named/);
  });

  it('a bypass run with no requires has a failure before any probe runs', async () => {
    assert.deepEqual(await preconditionFailures({ tier: 'autonomous', requires: [] }), ['the bypass tier (autonomous) names no requires (HAR-4)']);
    assert.deepEqual(await preconditionFailures({ tier: 'unattended' }), []);
    assert.deepEqual(parseHost('[::1]:5432'), { host: '::1', port: 5432 });
    assert.deepEqual(parseHost('db.prod.example.com'), { host: 'db.prod.example.com', port: 443 });
  });
});

describe('promptbook check-requires and promptbook run', () => {
  const policy = (prodHosts, requires = ['prod-unreachable-from-this-host']) => {
    const file = path.join(TMP, `p-${Math.random().toString(36).slice(2)}.policy.yaml`);
    fs.writeFileSync(file, `policy_version: 1
profiles:
  devbox: { tier: autonomous, engines: [claude], requires: [${requires.join(', ')}] }
  laptop: { tier: auto-edit }
deny_read: ["~/.ssh/**"]
forbid: []
egress: { default: deny, allow_domains: [registry.npmjs.org] }
sandbox: { enabled: true, fail_if_unavailable: true }
requires_config: { prod_hosts: [${prodHosts.map((h) => `"${h}"`).join(', ')}], connect_timeout_ms: 2000 }
accept_gaps:
  - { engine: claude, field: egress, profiles: [devbox], reason: "the devbox's egress proxy enforces the list" }
`);
    return file;
  };

  it('check-requires exits 0 when every probe passes, 1 when one fails or is unknown, 2 on a usage error', async () => {
    const ok = promptbook('check-requires', '--policy', policy([closed]), '--profile', 'devbox');
    assert.equal(ok.status, 0, ok.stderr + ok.stdout);
    assert.match(ok.stdout, /^PASS prod-unreachable-from-this-host: /m);
    const reach = await promptbookAsync('check-requires', '--policy', policy([open]), '--profile', 'devbox', '--json');
    assert.equal(reach.status, 1, reach.stderr);
    assert.equal(JSON.parse(reach.stdout).results[0].ok, false);
    assert.equal(promptbook('check-requires', '--policy', policy([closed], ['prod-unreachable-from-this-host', 'on-a-tailnet']), '--profile', 'devbox').status, 1);
    assert.equal(promptbook('check-requires', '--policy', policy([closed]), '--profile', 'laptop').status, 0, 'nothing to check');
    assert.equal(promptbook('check-requires', '--profile', 'devbox').status, 2);
  });

  it('promptbook run refuses a bypass runner until its probes pass, then runs it', async () => {
    const compile = (file, out) => promptbook('compile-policy', file, '--profile', 'devbox', '--engine', 'claude', '--out', out);
    const outOpen = path.join(TMP, 'open');
    assert.equal(compile(policy([open]), outOpen).status, 0);
    const runner = JSON.parse(fs.readFileSync(path.join(outOpen, 'runner.json'), 'utf8'));
    assert.deepEqual(runner.requires_config, { prod_hosts: [open], connect_timeout_ms: 2000 });
    const refused = await promptbookAsync('run', '--runner', path.join(outOpen, 'runner.json'), '--', process.execPath, FAKE, 'args');
    assert.equal(refused.status, 1, refused.stderr);
    assert.match(refused.stderr, /refused: .*prod-unreachable-from-this-host: 127\.0\.0\.1:\d+ connected/);
    assert.equal(refused.stdout, '', 'the engine never started');
    const outClosed = path.join(TMP, 'closed');
    assert.equal(compile(policy([closed]), outClosed).status, 0);
    const ran = promptbook('run', '--runner', path.join(outClosed, 'runner.json'), '--', process.execPath, FAKE, 'args');
    assert.equal(ran.status, 0, ran.stderr);
    const hand = path.join(TMP, 'hand-runner.json');
    fs.writeFileSync(hand, JSON.stringify({ ...runner, requires: undefined }));
    const noReq = promptbook('run', '--runner', hand, '--', process.execPath, FAKE, 'args');
    assert.equal(noReq.status, 1);
    assert.match(noReq.stderr, /names no requires/);
  });
});
