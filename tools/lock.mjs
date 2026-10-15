#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applyToDoc, defaultCache, processLock, readLock, serializeLock, validateLock } from './lib/lock.mjs';

const USAGE = `Generate or verify toolkit.lock: the commit and git tree id each entry pins.

  node tools/lock.mjs [--lock toolkit.lock]          fill commit, tree and version where missing
  node tools/lock.mjs --check                        verify; exit 1 on drift, change nothing
  node tools/lock.mjs --update [name...]             move pins: named entries to their ref's head (or
                                                     the highest tag), others within their autoUpdate
      --offline         skip remote sources (a warning, not a pass)
      --cache <dir>     where remote objects are fetched (default ${defaultCache()})
      --timeout <s>     per remote call (default 30)
      --json            machine-readable

Local sources (paths) are read with git plumbing and need no network; remote sources (https, ssh,
git@, file:) are resolved with git ls-remote and a blob-less fetch of the pinned commit.
Exit 0 ok, 1 drift or an error, 2 usage error.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--lock', '--cache', '--timeout']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const usage = (m) => { console.error(`lock: ${m}\n\n${USAGE}`); return 2; };
  const check = argv.includes('--check');
  const updating = argv.includes('--update');
  if (check && updating) return usage('--check and --update are exclusive');
  const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  if (names.length && !updating) return usage(`unexpected argument ${names[0]}`);
  const file = path.resolve(value('--lock') ?? 'toolkit.lock');
  if (!fs.existsSync(file)) return usage(`no lock file at ${file}`);
  const timeout = Number(value('--timeout') ?? 30) * 1000;
  if (!(timeout > 0)) return usage('--timeout takes seconds');

  let lock;
  try { lock = readLock(file); } catch (e) { console.error(`lock: ${e.message}`); return 1; }
  if (check) {
    const invalid = validateLock(lock.data);
    if (invalid.length) {
      console.error(`lock: ${file} does not satisfy the toolkit-lock contract:\n${invalid.map((x) => `  ${x}`).join('\n')}`);
      return 1;
    }
  }
  const known = new Set((lock.data.entries ?? []).map((e) => e.name));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length) return usage(`no entry named ${unknown.join(', ')}`);

  const result = processLock(lock.data, {
    mode: check ? 'check' : 'lock',
    lockDir: path.dirname(file),
    update: updating ? (names.length ? new Set(names) : true) : null,
    offline: argv.includes('--offline'),
    cacheDir: value('--cache') ?? defaultCache(),
    timeout,
  });
  const errors = result.entries.flatMap((r) => r.findings.filter((x) => x.severity === 'error'));

  let wrote = false;
  if (!check && !errors.length && result.changed) {
    applyToDoc(lock.doc, result.entries);
    const next = lock.doc.toJS();
    const invalid = validateLock(next);
    if (invalid.length) {
      console.error(`lock: the resolved lock would not satisfy the contract:\n${invalid.map((x) => `  ${x}`).join('\n')}`);
      return 1;
    }
    fs.writeFileSync(file, serializeLock(lock));
    wrote = true;
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ file, mode: check ? 'check' : 'lock', wrote, ...result }, null, 2));
    return errors.length ? 1 : 0;
  }
  for (const r of result.entries) {
    const bad = r.findings.some((x) => x.severity === 'error');
    const moved = r.before.commit && r.after.commit !== r.before.commit;
    const pin = r.after.commit ? `${r.after.ref} ${r.after.commit.slice(0, 12)} tree ${r.after.tree?.slice(0, 12)} v${r.after.version}` : r.before.ref ?? '';
    console.log(`${bad ? (check ? 'DRIFT' : 'ERROR') : moved ? 'MOVED' : !r.before.commit && r.after.commit ? 'PINNED' : 'OK'} ${r.name} ${pin}${moved ? ` (was ${r.before.ref} ${r.before.commit.slice(0, 12)})` : ''}`);
    for (const x of r.findings) console.log(`  ${x.severity.padEnd(7)} ${x.rule}: ${x.message}`);
  }
  const verdict = errors.length ? 'FAIL' : 'PASS';
  console.log(`${verdict} ${path.relative(process.cwd(), file) || file}: ${result.entries.length} entr${result.entries.length === 1 ? 'y' : 'ies'}, ${errors.length} error(s)${check ? '' : wrote ? '; written' : '; unchanged'}`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
