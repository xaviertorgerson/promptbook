import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { globToRegExp, toPosix } from './glob.mjs';
import { grantState, MUTABLE_GRANT_FIELDS, narrowingFindings } from './grant.mjs';
import { validateData } from './validate.mjs';

// promptbook grant verify: what a coordinator checks about a grant file before acting under it
// (state-machines/authority.yaml lifecycle.issue; CONTRACTS.md, grant provenance).

// CODEOWNERS: the first of CODEOWNERS, .github/, docs/, .gitlab/ under root. Rules in file order;
// the last rule matching a path decides its owners (as the forges read it).
const CODEOWNERS_AT = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'];
export function readCodeowners(root) {
  for (const rel of CODEOWNERS_AT) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const rules = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter((l) => l && !l.startsWith('['))
      .map((l) => { const [pattern, ...owners] = l.split(/\s+/); return { pattern, owners: owners.map((o) => o.replace(/^@/, '').toLowerCase()) }; });
    return { file: rel, rules };
  }
  return null;
}

const codeownersMatches = (pattern, p) => {
  let pat = pattern.startsWith('/') ? pattern.slice(1) : `**/${pattern}`;
  if (pat.endsWith('/')) pat = `${pat}**`;
  else if (!/[*?]/.test(pat.split('/').pop())) pat = `${pat}{,/**}`;
  const alts = pat.includes('{,/**}') ? [pat.replace('{,/**}', ''), pat.replace('{,/**}', '/**')] : [pat];
  return alts.some((a) => globToRegExp(a).test(p));
};

export function ownersFor(co, relPath) {
  let hit = null;
  for (const r of co?.rules ?? []) if (codeownersMatches(r.pattern, relPath)) hit = r;
  return hit;
}

const git = (cwd, ...args) => spawnSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...args], { encoding: 'utf8' });
const sameIdentity = (handle, author, identities) => {
  const h = String(handle).toLowerCase();
  const known = (identities?.[handle] ?? []).map((x) => String(x).toLowerCase());
  const name = author.name.toLowerCase();
  const email = author.email.toLowerCase();
  return known.includes(email) || known.includes(name) || name === h || name.replace(/\s+/g, '-') === h || email.split('@')[0] === h;
};

// Every check a coordinator runs on a grant file before acting under it. opts: root (the project
// root; default: the file's git top level, else the folder above .orchestrator), owners (handles,
// overriding CODEOWNERS), identities ({handle: [git author emails or names]}), git (check the
// history), at (epoch ms the grant must be live at; default now). Returns { file, state, live,
// findings: [{ severity, rule, message }] }: state is the grant's lifecycle state at `at` (pending,
// live, expired, revoked), and live means it is on the live path, verifies, and is live then.
export function verifyGrant(file, { root = null, owners = null, identities = {}, git: useGit = false, at = Date.now() } = {}) {
  const findings = [];
  const add = (rule, message, severity = 'error') => findings.push({ severity, rule, message });
  const abs = path.resolve(file);
  let g;
  try { g = parse(fs.readFileSync(abs, 'utf8')); } catch (e) { add('parse-error', e.message); return { file, state: null, live: false, findings }; }
  for (const m of validateData('grant', g)) add('grant-contract', m);
  // The project root: given, else the folder that holds .orchestrator/, else the git top level.
  const marker = `${path.sep}.orchestrator${path.sep}`;
  const top = () => { const r = git(path.dirname(abs), 'rev-parse', '--show-toplevel'); return r.status === 0 ? r.stdout.trim() : path.dirname(abs); };
  const base = root ? path.resolve(root) : abs.includes(marker) ? abs.slice(0, abs.lastIndexOf(marker)) : top();
  const rel = toPosix(path.relative(base, abs));
  const draft = /(^|\/)\.orchestrator\/grants\/drafts\//.test(rel);
  const live = /(^|\/)\.orchestrator\/grants\/[^/]+\.ya?ml$/.test(rel);
  if (draft) add('grant-is-draft', `${rel} is a draft: an agent may write it, so nothing acts under it until the human commits it under .orchestrator/grants/`);
  else if (!live) add('grant-on-protected-path', `${rel} is not under .orchestrator/grants/: a live grant is the file the human committed there`);

  // granted_by is a human owner of the path the grant lives on.
  let ownerList = owners?.map((o) => o.replace(/^@/, '').toLowerCase()) ?? null;
  if (!ownerList) {
    const co = readCodeowners(base);
    const rule = co && ownersFor(co, live || draft ? rel : '.orchestrator/grants/GRANT-0.yaml');
    if (!co) add('granted-by-is-owner', `no CODEOWNERS under ${base} (CODEOWNERS, .github/, docs/, .gitlab/), and no --owners: the grants path must belong to its human owners`);
    else if (!rule || !rule.owners.length) add('grant-on-protected-path', `${co.file} gives ${rel} no owner: protect .orchestrator/grants/ (e.g. "/.orchestrator/grants/ @<owner>")`);
    else ownerList = rule.owners;
  }
  if (ownerList && g?.granted_by && !ownerList.includes(String(g.granted_by).toLowerCase())) add('granted-by-is-owner', `granted_by ${g.granted_by} is not an owner of the grants path (${ownerList.join(', ')}): only a human who holds the authority issues it`);
  for (const [i, n] of (g?.narrowed ?? []).entries()) {
    if (ownerList && n?.by && !ownerList.includes(String(n.by).toLowerCase())) add('narrowed-by-owner', `narrowed[${i}] by ${n.by}, who is not an owner of the grants path: a coordinator stops exercising part of its grant and drafts the narrowing; a human commits it`);
  }
  if (g?.revoked_by && ownerList && !ownerList.includes(String(g.revoked_by).toLowerCase())) add('revoked-by-owner', `revoked_by ${g.revoked_by} is not an owner of the grants path`);

  if (useGit && !draft) {
    const log = git(base, 'log', '--follow', '--format=%H%x09%an%x09%ae', '--', rel);
    const commits = log.status === 0 ? log.stdout.trim().split('\n').filter(Boolean).map((l) => { const [sha, name, email] = l.split('\t'); return { sha, name, email }; }) : [];
    if (!commits.length) add('grant-committed', `${rel} is not committed: a live grant is a commit by the granting human`);
    else {
      const [lastC] = commits;
      if (!sameIdentity(g.granted_by, lastC, identities)) add('committed-by-granter', `the last commit to ${rel} (${lastC.sha.slice(0, 7)}) is by ${lastC.name} <${lastC.email}>, not ${g.granted_by}: only the granting human commits a live grant`);
      for (const c of commits.slice(1)) if (!sameIdentity(g.granted_by, c, identities) && !(ownerList ?? []).some((o) => sameIdentity(o, c, identities))) add('committed-by-owner', `${c.sha.slice(0, 7)} touched ${rel} as ${c.name} <${c.email}>, who is no owner of the grants path`);
      // Append-only: the issued fields as first committed, narrowed[] only ever extended.
      const shown = (sha) => { const r = git(base, 'show', `${sha}:./${rel}`); return r.status === 0 ? parse(r.stdout) : null; };
      const versions = [...commits].reverse().map((c) => ({ sha: c.sha, data: shown(c.sha) })).filter((v) => v.data);
      versions.push({ sha: 'the working file', data: g });
      const issued = versions[0]?.data;
      if (issued) {
        for (const k of new Set([...Object.keys(issued), ...Object.keys(g)])) {
          if (MUTABLE_GRANT_FIELDS.has(k) || k.startsWith('x-')) continue;
          if (JSON.stringify(issued[k]) !== JSON.stringify(g[k])) add('issued-fields-unchanged', `${k} changed after the issuing commit ${versions[0].sha.slice(0, 7)}: narrow by appending to narrowed[]; anything wider is a new grant`);
        }
      }
      for (let i = 1; i < versions.length; i += 1) {
        const before = versions[i - 1].data.narrowed ?? [];
        const now = versions[i].data.narrowed ?? [];
        if (before.some((n, j) => JSON.stringify(n) !== JSON.stringify(now[j]))) add('narrowing-append-only', `${versions[i].sha.slice(0, 7)} rewrote or dropped an earlier narrowed[] entry: narrowing is appended, never edited`);
      }
      const sha = String(g.source ?? '').match(/\b(?:commit\s+)?([0-9a-f]{7,40})\b/)?.[1];
      if (sha && git(base, 'cat-file', '-e', `${sha}^{commit}`).status !== 0) add('source-resolves', `source names commit ${sha}, which this repository does not have`);
    }
  }
  if (g && !findings.some((f) => f.rule === 'grant-contract')) for (const f of narrowingFindings(g)) add(f.rule, `${f.pointer}: ${f.message}`);
  // Nothing acts under a grant that is not live now: before granted_at, at or past expires_at, or
  // revoked (authority.yaml lifecycle.validity). Renewing is a new grant.
  const state = g && typeof g === 'object' && g.granted_at ? grantState(g, at) : null;
  const when = new Date(at).toISOString();
  if (state === 'pending') add('grant-is-live', `pending at ${when}: granted_at is ${g.granted_at}`);
  else if (state === 'expired') add('grant-is-live', `expired at ${when}: expires_at was ${g.expires_at}; renewing is a new grant from the human`);
  else if (state === 'revoked') add('grant-is-live', `revoked at ${g.revoked_at} by ${g.revoked_by ?? 'an unnamed human'}${g.revocation_reason ? ` (${g.revocation_reason})` : ''}`);
  return { file, state, live: live && state === 'live' && !findings.some((f) => f.severity === 'error'), findings };
}
