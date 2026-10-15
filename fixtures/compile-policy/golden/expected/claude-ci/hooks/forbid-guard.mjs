#!/usr/bin/env node
// The promptbook forbid guard: a PreToolUse hook that denies a shell command a policy forbid rule
// matches, however the command is spelled. compile-policy copies this file and the compiled rule
// list (forbid.json) next to an engine's settings when the policy sets hooks.forbid_guard, and
// registers it for the shell tool; Claude Code and Codex send the same hook input
// ({tool_name: "Bash", tool_input: {command}}) and both read exit 2 as "deny, stderr is the reason".
//
//   node forbid-guard.mjs <forbid.json>    reads the hook input on stdin; exit 0 allow, 2 deny
//
// forbid.json holds the command forbids (rules) and the policy's read denies (read_deny, path globs).
// A command that names a path a read deny matches (an argument, a --flag=value, a redirection
// target, ~ and $HOME expanded, a relative path read from the hook's cwd) is denied too: the
// backstop for a sandbox that ignores glob patterns (Claude Code's on Linux).
//
// Defense in depth, not the wall: the project's own hook deny (L2) and the engine's sandbox are.
// It reads the command as a shell would split it: compound commands (&&, ||, ;, |, &, newlines,
// subshells), command and process substitution, `sh -c` / `bash -lc` / `eval` strings, quoting,
// leading VAR=value assignments, wrappers (env, sudo, nice, timeout, nohup, stdbuf, command,
// builtin, exec, time, xargs, doas, noglob) and a program named by path (/usr/bin/git). It does not
// expand variables or aliases, so `$GIT push -f` and an alias get through; anything it cannot read
// (unbalanced quotes, unreadable input or rules) is denied. Node builtins only: it runs from the
// directory it is copied to.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SEPARATORS = new Set([';', '&', '|', '\n', '(', ')']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const WRAPPERS = new Set(['env', 'sudo', 'doas', 'nice', 'timeout', 'nohup', 'stdbuf', 'command', 'builtin', 'exec', 'time', 'xargs', 'noglob']);
// Wrapper options that take the next token as their value.
const VALUED = { env: ['-u', '-C', '-S'], sudo: ['-u', '-g', '-C', '-p', '-r', '-t', '-U', '-h'], nice: ['-n'], timeout: ['-s', '-k'], stdbuf: ['-i', '-o', '-e'], xargs: ['-n', '-I', '-P', '-L', '-s', '-d', '-E', '-a'] };
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const base = (t) => t.split('/').at(-1);

// Index of the parenthesis that closes the one at `open`, honouring quotes.
function closingParen(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '\\') i += 1;
    else if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')' && --depth === 0) return i;
  }
  throw new Error('unbalanced parenthesis');
}

// The simple commands in a shell string, each an argv. Substitutions are read as commands of their
// own (and leave a placeholder word); redirections are dropped from the argv, their targets pushed
// to `targets` when one is given.
export function splitCommands(text, targets = null) {
  const out = [];
  let argv = [];
  let word = null;
  let skipTarget = false;
  const endWord = () => {
    if (word === null) return;
    if (skipTarget) { skipTarget = false; targets?.push(word); } else argv.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (argv.length) out.push(...expand(argv));
    argv = [];
  };
  const substitution = (i) => {
    const close = closingParen(text, i + 1);
    out.push(...splitCommands(text.slice(i + 2, close), targets));
    word = `${word ?? ''}$(…)`;
    return close;
  };
  const backtick = (i) => {
    const close = text.indexOf('`', i + 1);
    if (close === -1) throw new Error('unbalanced backtick');
    out.push(...splitCommands(text.slice(i + 1, close), targets));
    word = `${word ?? ''}\`…\``;
    return close;
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') {
      if (text[i + 1] === '\n') { i += 1; continue; }
      word = (word ?? '') + (text[i + 1] ?? '');
      i += 1;
    } else if (c === "'") {
      const close = text.indexOf("'", i + 1);
      if (close === -1) throw new Error('unbalanced quote');
      word = (word ?? '') + text.slice(i + 1, close);
      i = close;
    } else if (c === '"') {
      word = word ?? '';
      for (i += 1; i < text.length && text[i] !== '"'; i += 1) {
        if (text[i] === '\\' && i + 1 < text.length) { word += text[i + 1]; i += 1; } else if (text[i] === '$' && text[i + 1] === '(') i = substitution(i);
        else if (text[i] === '`') i = backtick(i);
        else word += text[i];
      }
      if (i >= text.length) throw new Error('unbalanced quote');
    } else if (c === '$' && text[i + 1] === '(') i = substitution(i);
    else if ((c === '<' || c === '>') && text[i + 1] === '(') {
      const close = closingParen(text, i + 1);
      out.push(...splitCommands(text.slice(i + 2, close), targets));
      i = close;
    } else if (c === '`') i = backtick(i);
    else if (c === '<' || c === '>') {
      if (word !== null && /^[0-9&]*$/.test(word)) word = null; // an fd prefix (2>, &>)
      endWord();
      while (text[i + 1] === '>' || text[i + 1] === '&' || text[i + 1] === '<') i += 1;
      if (/[0-9-]/.test(text[i + 1] ?? '') && text[i] === '&') { while (/[0-9-]/.test(text[i + 1] ?? '')) i += 1; } else skipTarget = true;
    } else if (SEPARATORS.has(c)) endCommand();
    else if (c === '#' && word === null) {
      while (i < text.length && text[i] !== '\n') i += 1;
      endCommand();
    } else if (/\s/.test(c)) endWord();
    else word = (word ?? '') + c;
  }
  endCommand();
  return out;

  // One argv, and the commands it runs in a string: sh -c '...', bash -lc "...", eval ....
  function expand(a0) { return expandArgv(a0, targets); }
}

function expandArgv(argv, targets = null) {
  const out = [argv];
  const a = unwrap(argv);
  const head = a.length ? base(a[0]) : '';
  if (SHELLS.has(head)) {
    const c = a.findIndex((t, i) => i > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(t));
    if (c !== -1 && a[c + 1] !== undefined) out.push(...splitCommands(a[c + 1], targets));
  }
  if (head === 'eval') out.push(...splitCommands(a.slice(1).join(' '), targets));
  return out;
}
const expand = (argv) => expandArgv(argv);

// The argv a wrapper runs: leading assignments and wrappers (with their options) removed.
export function unwrap(argv) {
  let a = argv;
  for (;;) {
    while (a.length && ASSIGNMENT.test(a[0])) a = a.slice(1);
    const w = a.length ? base(a[0]) : '';
    if (!WRAPPERS.has(w)) return a;
    if (w === 'command' && a[1] === '-v') return a;
    a = a.slice(1);
    while (a.length && a[0].startsWith('-') && a[0] !== '-') {
      const takes = (VALUED[w] ?? []).includes(a[0]);
      a = a.slice(takes ? 2 : 1);
    }
    if (w === 'timeout' && a.length) a = a.slice(1); // the duration
    if (w === 'nice' && /^-?[0-9]+$/.test(a[0] ?? '')) a = a.slice(1);
  }
}

const tokenIs = (tok, alt, i) => [].concat(alt).some((w) => (i === 0 ? base(tok) : tok) === w);
const flagIs = (tok, flag) => (flag.endsWith('*') ? tok.startsWith(flag.slice(0, -1)) : tok === flag);

// Does a forbid rule match one simple command? A command rule matches the argv's prefix once the
// wrappers are removed; with flags_anywhere it matches when the command words appear in order
// anywhere in the argv and a later token is one of the flags (a flag ending in * matches every
// token it begins).
export function ruleMatches(rule, argv) {
  if (!rule.flags_anywhere) {
    const a = unwrap(argv);
    return rule.command.length <= a.length && rule.command.every((alt, i) => tokenIs(a[i], alt, i));
  }
  let at = -1;
  for (const [i, alt] of rule.command.entries()) {
    at = argv.findIndex((t, j) => j > at && tokenIs(t, alt, i));
    if (at === -1) return false;
  }
  return argv.slice(at + 1).some((t) => rule.flags_anywhere.some((f) => flagIs(t, f)));
}

// The first simple command in `command` (a shell string, or an argv as Codex may send it) that a
// rule matches: { rule, argv }, or null.
export function forbidHit(rules, command) {
  const commands = Array.isArray(command) ? expand(command.map(String)) : splitCommands(command);
  for (const argv of commands) {
    const rule = rules.find((r) => ruleMatches(r, argv));
    if (rule) return { rule, argv };
  }
  return null;
}

// ------------------------------------------------------------------------------------- read denies

// A glob segment (no "/") as a regex: * any run, ? one character, [..] a class.
const segRe = (s) => new RegExp(`^${s.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
const WILD = /[*?[]/;
// Can two segments match a common name? Exact when either is literal; else compare the literal ends.
function segmentsMeet(a, b) {
  if (a === b) return true;
  if (!WILD.test(a)) return segRe(b).test(a);
  if (!WILD.test(b)) return segRe(a).test(b);
  const ends = (s) => [s.slice(0, s.search(WILD)), s.slice(s.search(/[*?\]](?=[^*?\]]*$)/) + 1)];
  const [pa, sa] = ends(a);
  const [pb, sb] = ends(b);
  return (pa.startsWith(pb) || pb.startsWith(pa)) && (sa.endsWith(sb) || sb.endsWith(sa));
}
// Can a word (a path, or a pattern the shell expands) name a path a deny glob matches? ** spans any
// depth, but a trailing /** needs something under the directory (dir/** denies its contents, not
// listing it), and a word's leading wildcard never matches a dotfile, as the shell's does not.
function pathsMeet(x, y) {
  const A = x.split('/').filter(Boolean);
  const B = y.split('/').filter(Boolean);
  const meet = (a, b) => !(WILD.test(a[0]) && b.startsWith('.')) && segmentsMeet(a, b);
  const memo = new Map();
  const go = (i, j) => {
    const key = `${i},${j}`;
    if (memo.has(key)) return memo.get(key);
    let r;
    if (j === B.length - 1 && j > 0 && B[j] === '**') r = i < A.length;
    else if (i === A.length && j === B.length) r = true;
    else if (i < A.length && A[i] === '**') r = go(i + 1, j) || (j < B.length && go(i, j + 1));
    else if (j < B.length && B[j] === '**') r = go(i, j + 1) || (i < A.length && go(i + 1, j));
    else if (i === A.length || j === B.length) r = false;
    else r = meet(A[i], B[j]) && go(i + 1, j + 1);
    memo.set(key, r);
    return r;
  };
  return go(0, 0);
}

// A read-deny glob as an absolute glob: ~ is the home directory; a relative glob is the project's
// (the hook's cwd), and one that starts with ** matches at any depth anywhere.
function absoluteGlob(glob, { home, cwd }) {
  if (glob === '~' || glob.startsWith('~/')) return path.posix.join(home, glob.slice(1));
  if (glob.startsWith('/')) return glob;
  if (glob.startsWith('**/')) return `/${glob}`;
  return path.posix.join(cwd, glob.replace(/^\.\//, ''));
}

// The path a word names, absolute: ~ and $HOME expanded, a relative word read from cwd.
function wordPath(word, { home, cwd }) {
  const w = word.replace(/^(?:\$HOME|\$\{HOME\})(?=\/|$)/, home);
  if (w === '~' || w.startsWith('~/')) return path.posix.join(home, w.slice(1));
  if (w.startsWith('/')) return path.posix.normalize(w);
  return path.posix.join(cwd, w);
}

// The first word of the command (its arguments, --flag=value values and redirection targets) that
// names a path a read deny matches: { word, glob }, or null. Program names are not paths read.
export function readDenyHit(globs, command, { home = os.homedir(), cwd = process.cwd() } = {}) {
  if (!globs?.length) return null;
  const targets = [];
  const commands = Array.isArray(command) ? expandArgv(command.map(String), targets) : splitCommands(command, targets);
  const words = [...commands.flatMap((argv) => unwrap(argv).slice(1)), ...targets];
  const ctx = { home, cwd };
  // The most specific deny names the hit: a glob that matches anywhere (**/...) is tried last.
  const denies = globs.map((g) => ({ glob: g, abs: absoluteGlob(g, ctx) })).sort((a, b) => Number(a.glob.startsWith('**/')) - Number(b.glob.startsWith('**/')));
  for (const word of words) {
    const candidates = [word, ...(word.includes('=') ? [word.slice(word.indexOf('=') + 1)] : [])].filter((x) => x && !x.startsWith('-') && !/[$`]/.test(x.replace(/^(?:\$HOME|\$\{HOME\})/, '')));
    for (const c of candidates) {
      const p = wordPath(c, ctx);
      const hit = denies.find((d) => pathsMeet(p, d.abs));
      if (hit) return { word, glob: hit.glob };
    }
  }
  return null;
}

const describe = (r) => `${JSON.stringify(r.command)}${r.flags_anywhere ? ` with ${r.flags_anywhere.join(' | ')} anywhere` : ''}`;

function main() {
  const deny = (why) => {
    process.stderr.write(`promptbook forbid guard: ${why}\n`);
    process.exitCode = 2;
  };
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    if (input?.tool_name !== 'Bash') return;
    const { rules, read_deny: readDeny = [] } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const command = input.tool_input?.command;
    if (typeof command !== 'string' && !Array.isArray(command)) { deny('a Bash call with no command; denied (fail closed)'); return; }
    const hit = forbidHit(rules, command);
    if (hit) { deny(`\`${hit.argv.join(' ')}\` is forbidden by the operator's policy (${describe(hit.rule)})${hit.rule.reason ? `: ${hit.rule.reason}` : ''}`); return; }
    const read = readDenyHit(readDeny, command, { cwd: typeof input.cwd === 'string' ? input.cwd : process.cwd() });
    if (read) deny(`\`${read.word}\` names a path the operator's policy denies reading (deny_read ${read.glob})`);
  } catch (e) {
    deny(`${e.message}; denied (fail closed)`);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
