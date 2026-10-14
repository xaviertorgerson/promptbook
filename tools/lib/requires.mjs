import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

// The named preconditions a profile's `requires` lists (policy contract), each a probe of this host.
// A name with no probe fails closed: a precondition nobody can check is not met. HAR-4 is why they
// exist: the bypass tier is safe only where production is unreachable and the agent is non-root in
// a sandbox or container, which no policy file can enforce.

export const DEFAULT_CONNECT_TIMEOUT_MS = 3000;

// The host as the probes see it; tests pass their own.
export const hostEnv = {
  platform: process.platform,
  uid: () => (typeof process.getuid === 'function' ? process.getuid() : null),
  env: process.env,
  exists: (p) => fs.existsSync(p),
  read: (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''),
  which: (cmd) => (process.env.PATH ?? '').split(path.delimiter).map((d) => path.join(d, cmd)).find((p) => fs.existsSync(p)) ?? null,
  run: (cmd, args) => spawnSync(cmd, args, { stdio: 'ignore', timeout: 10_000 }).status,
  connect: (host, port, timeoutMs) => new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs, () => done('timed out'));
    socket.once('connect', () => done('connected'));
    socket.once('error', (e) => done(e.code ?? e.message));
  }),
};

// "host" or "host:port" (443 by default); a bracketed IPv6 address keeps its colons.
export function parseHost(spec) {
  const m = /^\[([^\]]+)\](?::(\d+))?$/.exec(spec) ?? /^([^:]+)(?::(\d+))?$/.exec(spec);
  return m ? { host: m[1], port: Number(m[2] ?? 443) } : null;
}

const nonRoot = (env) => {
  const uid = env.uid();
  if (uid === null) return { ok: false, detail: 'this platform reports no uid, so non-root cannot be shown' };
  return uid === 0 ? { ok: false, detail: 'running as root (uid 0)' } : { ok: true, detail: `uid ${uid}` };
};

const CGROUP = /docker|kubepods|containerd|libpod|podman|lxc/;
const container = (env) => {
  if (env.exists('/.dockerenv')) return { ok: true, detail: '/.dockerenv' };
  if (env.exists('/run/.containerenv')) return { ok: true, detail: '/run/.containerenv' };
  if (env.env.container) return { ok: true, detail: `$container=${env.env.container}` };
  const cg = env.read('/proc/1/cgroup');
  if (CGROUP.test(cg)) return { ok: true, detail: `/proc/1/cgroup names ${CGROUP.exec(cg)[0]}` };
  return { ok: false, detail: 'no /.dockerenv, /run/.containerenv, $container or container cgroup' };
};

export const PROBES = {
  // Every host in requires_config.prod_hosts refuses, drops or cannot resolve a TCP connect within
  // the timeout. A host that resolves and accepts is reachable: the precondition fails.
  async 'prod-unreachable-from-this-host'(config, env) {
    const hosts = config?.prod_hosts ?? [];
    if (!hosts.length) return { ok: false, detail: 'requires_config.prod_hosts lists no production host to probe' };
    const timeout = config.connect_timeout_ms ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const results = await Promise.all(hosts.map(async (spec) => {
      const h = parseHost(spec);
      if (!h) return { spec, reachable: true, result: 'not host[:port]' };
      const result = await env.connect(h.host, h.port, timeout);
      return { spec, reachable: result === 'connected', result };
    }));
    const reached = results.filter((r) => r.reachable);
    const detail = results.map((r) => `${r.spec} ${r.result}`).join('; ');
    return { ok: reached.length === 0, detail };
  },
  'non-root': (config, env) => nonRoot(env),
  container: (config, env) => container(env),
  'non-root-container'(config, env) {
    const a = nonRoot(env);
    const b = container(env);
    return { ok: a.ok && b.ok, detail: `${a.detail}; ${b.detail}` };
  },
  // The OS sandbox primitive runs here: bubblewrap on Linux, sandbox-exec on macOS.
  'sandbox-available'(config, env) {
    if (env.platform === 'linux') {
      const bwrap = env.which('bwrap');
      if (!bwrap) return { ok: false, detail: 'no bwrap (bubblewrap) on PATH' };
      const status = env.run(bwrap, ['--ro-bind', '/', '/', '--dev', '/dev', 'true']);
      return status === 0 ? { ok: true, detail: `${bwrap} runs` } : { ok: false, detail: `${bwrap} is present but exits ${status} (user namespaces blocked?)` };
    }
    if (env.platform === 'darwin') {
      const status = env.run('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/usr/bin/true']);
      return status === 0 ? { ok: true, detail: 'sandbox-exec runs' } : { ok: false, detail: `sandbox-exec exits ${status}` };
    }
    return { ok: false, detail: `no OS sandbox probe for ${env.platform}` };
  },
};

// Probe every name; an unknown one fails closed.
export async function checkRequires(names, config = {}, env = hostEnv) {
  return Promise.all(names.map(async (name) => {
    const probe = PROBES[name];
    if (!probe) return { name, ok: false, detail: `no probe named ${name} (known: ${Object.keys(PROBES).join(', ')}); a precondition nobody can check is not met` };
    return { name, ...(await probe(config, env)) };
  }));
}

// What a run must satisfy before it starts: its profile's requires, and for the bypass tier at least
// one (HAR-4). Returns the failures as lines; empty when the run may start.
export async function preconditionFailures({ tier, requires = [], requires_config: config = {} }, env = hostEnv) {
  if (tier === 'autonomous' && !requires.length) return ['the bypass tier (autonomous) names no requires (HAR-4)'];
  const results = await checkRequires(requires, config, env);
  return results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`);
}
