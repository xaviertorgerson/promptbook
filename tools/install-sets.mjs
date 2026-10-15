#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { budgetSetByName, loadSets, setSkills } from './lib/lint-skills.mjs';
import { readLock } from './lib/lock.mjs';

// Installs the skill sets a toolkit.lock names: for each `kind: skill-library` entry with `sets`, the
// skills those sets resolve to (SETS.yaml at the pinned commit, `includes` followed) are copied from git
// objects at the pin into <root>/.claude/skills/<name> (Claude Code reads only that) and
// <root>/.agents/skills/<name> (Codex and others read that), and recorded with their git tree ids in
// .claude/skills/VENDORED.json. --check recomputes the tree ids and fails on an edited copy, a stale
// record, a project skill that takes a vendored name, or always-loaded descriptions over the library's
// budget less its headroom. Nothing here depends on a stack, a project layout or a machine.
//
//   promptbook install-sets [--root <dir>] [--lock <file>]       copy the pinned sets in
//   promptbook install-sets --check [--root <dir>] [--lock <file>]  verify the copies; no checkout needed
//   promptbook install-sets --resolve <set>... --sets <SETS.yaml> [--scope user|project]
//                                                                 print the skill names the sets install, one per line
//
// A library's checkout is found at $<NAME>_HOME (SKILLDEX_HOME), else the lock's `source` when it is a
// local path (relative to the lock's directory), else a sibling ../<name> of the root; only git objects
// at the pinned commit are read, never its working tree.

const USAGE = `promptbook install-sets — copy the skill sets toolkit.lock pins into the engines' skill folders

  promptbook install-sets [--root <dir>] [--lock <file>]              copy the pinned sets in
  promptbook install-sets --check [--root <dir>] [--lock <file>]      verify the copies (no checkout needed)
  promptbook install-sets --resolve <set>... --sets <SETS.yaml> [--scope user|project]
                                                                      print the skills the sets install
      --json            machine-readable
Exit 0 ok, 1 a check failed or a copy could not be made, 2 usage error.`;

const DIRS = ['.claude/skills', '.agents/skills'];
const RECORD = '.claude/skills/VENDORED.json';

const git = (dir, args, opts = {}) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, ...opts });
const isLocal = (source) => /^(\.{1,2}\/|\/)/.test(source ?? '');
const envName = (name) => `${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_HOME`;

function hash(type, body) {
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`${type} ${body.length}\0`), body])).digest('hex');
}

// A git tree id computed from a folder, as `git write-tree` would record it.
export function treeId(dir) {
  const rows = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = treeId(p);
      if (sub) rows.push({ name: e.name, sort: `${e.name}/`, mode: '40000', sha: sub });
    } else if (e.isSymbolicLink()) rows.push({ name: e.name, sort: e.name, mode: '120000', sha: hash('blob', Buffer.from(fs.readlinkSync(p))) });
    else rows.push({ name: e.name, sort: e.name, mode: fs.statSync(p).mode & 0o111 ? '100755' : '100644', sha: hash('blob', fs.readFileSync(p)) });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  return hash('tree', Buffer.concat(rows.flatMap((r) => [Buffer.from(`${r.mode} ${r.name}\0`), Buffer.from(r.sha, 'hex')])));
}

// The frontmatter fields a router sees: the description (plain, quoted or folded) and whether the
// engine lists it at all (Claude Code's disable-model-invocation keeps a description out of context).
function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const lines = m ? m[1].split(/\r?\n/) : [];
  const field = (k) => lines.findIndex((l) => l.startsWith(`${k}:`));
  const value = (k) => {
    const i = field(k);
    if (i === -1) return null;
    let v = lines[i].slice(k.length + 1).trim();
    if (/^[>|][+-]?$/.test(v)) {
      const rest = [];
      for (const l of lines.slice(i + 1)) { if (l.trim() && !/^\s/.test(l)) break; rest.push(l.trim()); }
      v = rest.join(' ').trim();
    } else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    else if (/^".*"$/.test(v)) v = JSON.parse(v);
    return v;
  };
  return { name: value('name'), description: value('description') ?? '', listed: value('disable-model-invocation') !== 'true' };
}

// Every file of <sub> at the pinned commit, read from git objects into a temporary folder.
function materialize(dir, commit, sub) {
  const ls = git(dir, ['ls-tree', '-r', '-z', '--full-tree', commit, '--', sub], { encoding: 'buffer' });
  if (ls.status !== 0) throw new Error(`git ls-tree ${commit} ${sub}: ${ls.stderr.toString().trim()}`);
  const rows = ls.stdout.toString('utf8').split('\0').filter(Boolean).map((r) => { const [meta, file] = r.split('\t'); const [mode, type, sha] = meta.split(' '); return { mode, type, sha, file }; });
  const bad = rows.find((r) => r.type !== 'blob' || r.mode === '120000');
  if (bad) throw new Error(`${bad.file} at the pin is a ${bad.mode === '120000' ? 'symlink' : bad.type}; only plain files can be installed`);
  const cat = git(dir, ['cat-file', '--batch'], { input: Buffer.from(rows.map((r) => r.sha).join('\n') + '\n'), encoding: 'buffer' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-sets-'));
  let off = 0;
  for (const r of rows) {
    const nl = cat.stdout.indexOf(10, off);
    const size = Number(cat.stdout.subarray(off, nl).toString().split(' ')[2]);
    const dest = path.join(tmp, r.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, cat.stdout.subarray(nl + 1, nl + 1 + size), { mode: r.mode === '100755' ? 0o755 : 0o644 });
    off = nl + 1 + size + 1;
  }
  return { tmp, lib: path.join(tmp, sub === '.' ? '' : sub) };
}

// A skill name is a folder name and nothing else: a pinned SETS.yaml or a record that names
// `../../victim` must never reach rmSync or cpSync. The Agent Skills name grammar, no dots or slashes.
const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
export function checkName(name, where) {
  if (typeof name !== 'string' || !SKILL_NAME.test(name)) throw new Error(`${where} names ${JSON.stringify(name)}, which is not a skill name (lowercase letters, digits and hyphens): nothing was installed or removed`);
  return name;
}

// What the entry's sets install, read with the library's own SETS.yaml at the pin: the skill names,
// what loads beside them (other sets named loaded_with), and the budget less headroom.
function readSets(lib, entry) {
  const parts = [];
  let limit = Infinity;
  for (const set of entry.sets) {
    const out = budgetSetByName(path.join(lib, 'SETS.yaml'), set);
    for (const f of out.findings) if (f.severity === 'error') throw new Error(`${entry.name} set ${set}: ${f.rule} — ${f.message}`);
    parts.push(...out.skills);
    limit = Math.min(limit, out.limit);
  }
  const skills = [...new Set(parts.filter((p) => entry.sets.includes(p.from)).map((p) => checkName(p.name, `${entry.name}'s SETS.yaml`)))].sort();
  const loadedWith = {};
  for (const p of parts.filter((x) => !entry.sets.includes(x.from))) {
    const w = (loadedWith[p.from] ??= { chars: 0, skills: [] });
    if (w.skills.includes(p.name)) continue;
    w.skills.push(p.name);
    w.chars += p.chars;
  }
  return { skills, loadedWith, limit };
}

export class Installer {
  constructor({ root = process.cwd(), lock = null } = {}) {
    this.root = path.resolve(root);
    this.lockFile = lock ? path.resolve(lock) : path.join(this.root, 'toolkit.lock');
  }
  at(...p) { return path.join(this.root, ...p); }

  entries() {
    if (!fs.existsSync(this.lockFile)) return [];
    const { data } = readLock(this.lockFile);
    return (data?.entries ?? []).filter((e) => e.kind === 'skill-library' && Array.isArray(e.sets) && e.sets.length).map((e) => ({ ...e, path: e.path || '.' }));
  }
  checkout(entry) {
    const tries = process.env[envName(entry.name)] ? [process.env[envName(entry.name)]] : [...(isLocal(entry.source) ? [path.resolve(path.dirname(this.lockFile), entry.source)] : []), path.resolve(this.root, '..', entry.name)];
    return tries.find((d) => fs.existsSync(d) && git(d, ['cat-file', '-e', `${entry.commit}^{commit}`]).status === 0) ?? null;
  }
  where(entry) { return isLocal(entry.source) ? path.resolve(path.dirname(this.lockFile), entry.source) : `../${entry.name}`; }
  skillFolders(dir) { return fs.existsSync(this.at(dir)) ? fs.readdirSync(this.at(dir), { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(this.at(dir, e.name, 'SKILL.md'))).map((e) => e.name) : []; }
  readRecord() {
    const libs = fs.existsSync(this.at(RECORD)) ? JSON.parse(fs.readFileSync(this.at(RECORD), 'utf8')).libraries ?? {} : {};
    for (const [lib, r] of Object.entries(libs)) { checkName(lib, RECORD); for (const n of Object.keys(r.skills ?? {})) checkName(n, `${RECORD} (${lib})`); }
    return libs;
  }

  // A project skill (any folder the record does not name) that takes an installed name, by folder or
  // by the name in its frontmatter: engines resolve such a collision in opposite directions.
  collisions(installed, recorded) {
    const out = [];
    for (const dir of DIRS) for (const f of this.skillFolders(dir)) {
      if (recorded.has(f)) continue;
      const name = frontmatter(this.at(dir, f, 'SKILL.md')).name ?? f;
      for (const n of new Set([f, name])) if (installed.has(n)) out.push(`${dir}/${f} is the project's own skill named ${n}, which ${installed.get(n)} installs: rename the project's skill`);
    }
    return out;
  }

  // What each engine always loads: every installed description it reads, what the sets are loaded
  // with (measured at the pin), and on Claude Code the project's own listed skills.
  budget(libs) {
    const installed = Object.values(libs).flatMap((l) => Object.keys(l.skills));
    const beside = Object.values(libs).flatMap((l) => Object.entries(l.loaded_with ?? {}));
    const besideChars = [...new Map(beside).values()].reduce((a, x) => a + x.chars, 0);
    const listed = (dir, n) => { const f = this.at(dir, n, 'SKILL.md'); const fm = fs.existsSync(f) ? frontmatter(f) : null; return fm?.listed ? fm.description.length : 0; };
    const sum = (dir, names) => names.reduce((a, n) => a + listed(dir, n), 0);
    const own = this.skillFolders('.claude/skills').filter((n) => !installed.includes(n));
    const limit = Math.min(...Object.values(libs).map((l) => l.budget));
    const ownChars = sum('.claude/skills', own);
    const engines = [
      { engine: 'claude', total: sum('.claude/skills', installed) + besideChars + ownChars },
      { engine: 'codex', total: sum('.agents/skills', installed) + besideChars },
    ];
    const parts = `${installed.length} installed, ${beside.map(([k, v]) => `${k} ${v.chars} loaded beside`).join(', ') || 'nothing beside'}, ${own.length} own (${ownChars} listed)`;
    return { limit, engines, parts, over: engines.filter((e) => e.total > limit), line: `always-loaded descriptions: ${engines.map((e) => `${e.engine} ${e.total}/${limit}`).join(', ')} (${parts})` };
  }

  install() {
    const plans = [];
    try { return this.installWith(plans); } finally { for (const p of plans) fs.rmSync(p.tmp, { recursive: true, force: true }); }
  }
  installWith(plans) {
    const previous = this.readRecord();
    const libraries = {};
    const installed = new Map();
    for (const entry of this.entries()) {
      const dir = this.checkout(entry);
      if (!dir) throw new Error(`${entry.name}: no checkout holding ${entry.commit.slice(0, 12)}; put one at ${this.where(entry)} (or set ${envName(entry.name)})`);
      const tree = git(dir, ['rev-parse', `${entry.commit}:${entry.path}`]).stdout.trim();
      if (tree !== entry.tree) throw new Error(`${entry.name}: ${entry.path} at ${entry.commit.slice(0, 12)} is tree ${tree.slice(0, 12)}, the lock pins ${entry.tree?.slice(0, 12)}`);
      const { tmp, lib } = materialize(dir, entry.commit, entry.path);
      const sets = readSets(lib, entry);
      for (const n of sets.skills) installed.set(n, entry.name);
      plans.push({ entry, dir, tmp, lib, sets });
    }
    const recorded = new Set(Object.values(previous).flatMap((l) => Object.keys(l.skills)));
    const clash = this.collisions(installed, recorded);
    if (clash.length) throw new Error(clash.join('\n'));
    for (const n of recorded) if (!installed.has(n)) for (const d of DIRS) fs.rmSync(this.at(d, n), { recursive: true, force: true });
    for (const { entry, dir, lib, sets } of plans) {
      const skills = {};
      for (const n of sets.skills) {
        const pinned = git(dir, ['rev-parse', `${entry.commit}:${path.posix.join(entry.path, n)}`]).stdout.trim();
        for (const d of DIRS) {
          fs.rmSync(this.at(d, n), { recursive: true, force: true });
          fs.mkdirSync(this.at(d), { recursive: true });
          fs.cpSync(path.join(lib, n), this.at(d, n), { recursive: true });
          const copied = treeId(this.at(d, n));
          if (copied !== pinned) throw new Error(`${d}/${n}: the copy hashes to ${copied?.slice(0, 12)}, the pin to ${pinned.slice(0, 12)}`);
        }
        skills[n] = pinned;
      }
      const library = fs.readdirSync(lib, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(lib, e.name, 'SKILL.md'))).map((e) => e.name).sort();
      // Skills the installed evals route near-misses to that the library does not hold: what its
      // SETS.yaml loads beside them from elsewhere, so a lint of the copies alone knows the names.
      const routed = sets.skills.flatMap((n) => (fs.existsSync(path.join(lib, n, 'evals')) ? fs.readdirSync(path.join(lib, n, 'evals')).filter((f) => f.endsWith('.jsonl')).flatMap((f) => fs.readFileSync(path.join(lib, n, 'evals', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).route_to)) : []));
      const beside = [...new Set(routed.filter((n) => n && n !== 'none' && !library.includes(n)))].sort();
      libraries[entry.name] = { commit: entry.commit, tree: entry.tree, path: entry.path, sets: entry.sets, budget: sets.limit, skills, loaded_with: sets.loadedWith, library, beside };
    }
    fs.mkdirSync(path.dirname(this.at(RECORD)), { recursive: true });
    fs.writeFileSync(this.at(RECORD), `${JSON.stringify({
      $comment: 'Written by `promptbook install-sets`, never by hand: the skills it copied from each skill library toolkit.lock pins (its `sets`) into .claude/skills and .agents/skills, each with its git tree id at the pin. `loaded_with` is what a session holding those sets loads beside them, measured at the pin; `budget` is the library\'s always-loaded budget less its headroom; `library` is every skill name at the pin and `beside` the skills of other libraries its evals route to. `promptbook install-sets --check` recomputes the tree ids.',
      libraries,
    }, null, 2)}\n`);
    return libraries;
  }

  verify() {
    const entries = this.entries();
    const libs = this.readRecord();
    const errors = [];
    const notes = [];
    for (const entry of entries) {
      const r = libs[entry.name];
      if (!r) { errors.push(`${entry.name}: toolkit.lock names sets ${entry.sets.join(', ')} but nothing was installed: run promptbook install-sets`); continue; }
      if (r.commit !== entry.commit || r.tree !== entry.tree || r.sets.join() !== entry.sets.join()) errors.push(`${entry.name}: the copies are of ${r.commit.slice(0, 12)} (${r.sets.join(', ')}), toolkit.lock pins ${entry.commit.slice(0, 12)} (${entry.sets.join(', ')}): run promptbook install-sets`);
      const dir = this.checkout(entry);
      if (!dir) { notes.push(`${entry.name} pin not re-read (no checkout)`); continue; }
      const tree = git(dir, ['rev-parse', `${r.commit}:${r.path}`]).stdout.trim();
      if (tree !== r.tree) errors.push(`${entry.name}: ${r.path} at ${r.commit.slice(0, 12)} is tree ${tree.slice(0, 12)}, the record says ${r.tree.slice(0, 12)}`);
      for (const [n, t] of Object.entries(r.skills)) {
        const pinned = git(dir, ['rev-parse', `${r.commit}:${path.posix.join(r.path, n)}`]).stdout.trim();
        if (pinned !== t) errors.push(`${entry.name}: ${n} at the pin is tree ${pinned.slice(0, 12) || '(absent)'}, the record says ${t.slice(0, 12)}`);
      }
      notes.push(`${entry.name} pin verified in ${path.relative(this.root, dir) || dir}`);
    }
    for (const name of Object.keys(libs)) if (!entries.some((e) => e.name === name)) errors.push(`${RECORD} holds ${name}, which toolkit.lock no longer pins with sets: run promptbook install-sets`);
    const installed = new Map(Object.entries(libs).flatMap(([lib, r]) => Object.keys(r.skills).map((n) => [n, lib])));
    for (const [lib, r] of Object.entries(libs)) for (const [n, t] of Object.entries(r.skills)) for (const d of DIRS) {
      const got = fs.existsSync(this.at(d, n)) ? treeId(this.at(d, n)) : null;
      if (got !== t) errors.push(`${d}/${n} ${got ? `hashes to ${got.slice(0, 12)}` : 'is missing'}; ${lib} pins ${t.slice(0, 12)}: an installed skill is never edited here (run promptbook install-sets)`);
    }
    errors.push(...this.collisions(installed, new Set(installed.keys())));
    return { libs, errors, notes, count: installed.size };
  }
}

// --resolve: the skill names the named sets install, from one SETS.yaml; refuses a set of the wrong
// scope (a project set at user scope would shadow every project's own pin).
export function resolveSets(setsFile, names, { scope = null } = {}) {
  const { data, errors } = loadSets(setsFile);
  if (!data) throw new Error(`${setsFile}: ${errors.join('; ')}`);
  const out = new Set();
  for (const n of names) {
    if (!data.sets[n]) throw new Error(`${setsFile} has no set ${n} (sets: ${Object.keys(data.sets).join(', ')})`);
    if (scope && data.sets[n].scope !== scope) throw new Error(`set ${n} is ${data.sets[n].scope}, not a ${scope}-scope set`);
    for (const s of setSkills(data, n)) out.add(s);
  }
  if (!out.size) throw new Error(`the sets ${names.join(', ')} name no skills`);
  return [...out];
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const value = (f) => { const i = argv.indexOf(f); return i === -1 ? undefined : argv[i + 1]; };
  const json = argv.includes('--json');
  if (argv.includes('--resolve')) {
    const sets = value('--sets');
    const names = argv.slice(argv.indexOf('--resolve') + 1).filter((a, i, all) => !a.startsWith('--') && !['--sets', '--scope'].includes(all[i - 1]));
    if (!sets || !names.length) { console.error(`install-sets: --resolve needs set names and --sets <SETS.yaml>\n\n${USAGE}`); return 2; }
    try {
      const skills = resolveSets(sets, names, { scope: value('--scope') ?? null });
      console.log(json ? JSON.stringify({ sets: names, skills }) : skills.join('\n'));
      return 0;
    } catch (e) { console.error(`install-sets: ${e.message}`); return 1; }
  }
  const inst = new Installer({ root: value('--root'), lock: value('--lock') });
  if (!inst.entries().length) { console.log(`install-sets: ${path.relative(process.cwd(), inst.lockFile) || inst.lockFile} names no skill library with install sets; nothing installed.`); return 0; }
  try {
    if (argv.includes('--check')) {
      const { libs, errors, notes, count } = inst.verify();
      const b = Object.keys(libs).length ? inst.budget(libs) : null;
      if (b?.over.length) errors.push(`${b.over.map((e) => `${e.engine} loads ${e.total}`).join(', ')} characters of descriptions, over ${b.limit} (the library's budget less its headroom): shorten the project's own descriptions, or set disable-model-invocation on a skill only a person or a workflow starts by name`);
      if (json) { console.log(JSON.stringify({ ok: !errors.length, count, errors, notes, budget: b })); return errors.length ? 1 : 0; }
      for (const e of errors) console.error(`FAIL ${e}`);
      if (errors.length) { console.error(`install-sets: ${errors.length} problem(s)${b ? `; ${b.line}` : ''}`); return 1; }
      console.log(`install-sets: ${count} installed skill(s) match ${Object.entries(libs).map(([n, r]) => `${n}@${r.commit.slice(0, 7)}`).join(', ')} (${notes.join('; ')}); ${b.line}`);
      return 0;
    }
    const libs = inst.install();
    const b = inst.budget(libs);
    if (json) { console.log(JSON.stringify({ ok: !b.over.length, libraries: libs, budget: b })); return b.over.length ? 1 : 0; }
    for (const [n, r] of Object.entries(libs)) console.log(`${n}@${r.commit.slice(0, 7)} ${r.sets.join(' + ')}: ${Object.keys(r.skills).join(', ')}`);
    console.log(`install-sets: wrote ${RECORD}; ${b.line}`);
    if (b.over.length) { console.error(`FAIL ${b.over.map((e) => `${e.engine} ${e.total}`).join(', ')} over ${b.limit}`); return 1; }
    return 0;
  } catch (e) {
    console.error(`install-sets: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
