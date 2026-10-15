import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// The prose holds to what the repository is: citations resolve where the cited thing lives, and
// the claims the README and the guides make about the repository are true of it.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.sim-out']);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  if (SKIP.has(d.name)) return [];
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});
const docs = walk(ROOT).filter((f) => /\.(md|ya?ml)$/.test(f));
const rel = (f) => path.relative(ROOT, f);

describe('citations', () => {
  it('ADR-0021 and permission-probe are cited where they exist: branch docs/adr-permission-precedence at c177fa1, not master', () => {
    for (const f of docs) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (!/ADR-0021|permission-probe/.test(line)) return;
        assert.doesNotMatch(line, /agentic-template\/(?:blob|tree)\/(?:master|main)\//, `${rel(f)}:${i + 1} links master`);
      });
    }
    const page = fs.readFileSync(path.join(ROOT, 'playbook/runtime/permissions-and-autonomy.md'), 'utf8');
    assert.match(page, /blob\/c177fa1\/DECISIONS\.md/);
    assert.match(page, /blob\/c177fa1\/scripts\/permission-probe\.mjs/);
    assert.match(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'), /docs\/adr-permission-precedence`, commit `c177fa1`/);
  });
});

describe('the README\'s claims', () => {
  const ENGINES = /\b(?:Claude|Codex|Gemini|Antigravity|Herdr|stagehand|GitHub|Forgejo)\b/;

  it('the playbook\'s Practice sections name no engine, runtime or forge', () => {
    for (const f of walk(path.join(ROOT, 'playbook')).filter((x) => x.endsWith('.md'))) {
      const practice = fs.readFileSync(f, 'utf8').split(/^## /m).find((s) => s.startsWith('Practice'));
      if (practice) assert.doesNotMatch(practice, ENGINES, `${rel(f)} Practice names an engine`);
    }
  });

  it('no longer says that nothing outside adapters/ names an engine, and CHANGELOG.md exists in Keep a Changelog shape', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    assert.doesNotMatch(readme, /No file outside `adapters\/` names/);
    const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    assert.match(log, /^## \[Unreleased\]$/m);
    assert.match(log, /^## \[0\.1\.0\] - 2026-10-13$/m);
    const unreleased = log.split(/^## \[/m).find((s) => s.startsWith('Unreleased'));
    for (const entry of unreleased.split('\n').filter((l) => /^- \*\*/.test(l))) assert.match(entry, /^- \*\*(?:additive|behavioral|breaking)\*\* — /, entry);
  });
});

describe('the standards block', () => {
  const text = fs.readFileSync(path.join(ROOT, 'standards/engineering.md'), 'utf8');
  const block = text.slice(text.indexOf('<!-- standards:begin '), text.indexOf('<!-- standards:end -->'));

  it('sits between versioned markers, and the file names how the version moves', () => {
    assert.match(block, /^<!-- standards:begin v3 -->\n/);
    assert.match(text, /^<!-- standards:end -->$/m);
    assert.match(text, /The `v<n>` in the markers is the block version/);
  });

  it('ENG-5 holds in every trust profile: required checks always, a human approval only where the profile requires one', () => {
    const eng5 = block.split(/\n- /).find((l) => l.startsWith('**ENG-5')).replace(/\s+/g, ' ');
    for (const phrase of ['Never push to the default branch', 'force-push a shared branch', 'required checks pass', 'approved by a human where the project\'s trust profile requires it', 'never approve your own work', 'bypass a required check']) assert.ok(eng5.includes(phrase), phrase);
    assert.doesNotMatch(eng5, /reviewed pull request|merge your own work/);
  });

  it('the principles are ENG-9 to ENG-14, one sentence each, and the block stays short', () => {
    const items = block.split(/\n- /).slice(1).map((l) => l.replace(/\s+/g, ' ').trim());
    const principles = items.filter((l) => /^\*\*ENG-(9|1[0-4]) /.test(l));
    assert.deepEqual(principles.map((l) => l.match(/^\*\*(ENG-\d+)/)[1]), ['ENG-9', 'ENG-10', 'ENG-11', 'ENG-12', 'ENG-13', 'ENG-14']);
    for (const l of principles) {
      const body = l.replace(/^\*\*[^*]+\*\* /, '');
      assert.equal(body.match(/[.!?](\s|$)/g)?.length, 1, `one sentence: ${body}`);
    }
    for (const id of principles.map((l) => l.match(/^\*\*(ENG-\d+)/)[1])) assert.match(text, new RegExp(`^\\| ${id} \\|`, 'm'), `${id} has an enforcement row`);
    assert.ok(block.length <= 2500, `the block is ${block.length} characters; keep it short`);
  });
});

describe('version labels', () => {
  it('every "<contract> contract X.Y.Z", "<machine> machine X.Y.Z" and "(workflow X.Y.Z)" label states the current version', async () => {
    const { registry } = await import('../tools/lib/registry.mjs');
    const { parse } = await import('yaml');
    const reg = registry();
    const current = new Map(reg.contracts().map((c) => [c, reg.version(c)]));
    for (const m of ['workflow', 'attention', 'authority']) current.set(m, String(parse(fs.readFileSync(path.join(ROOT, 'state-machines', `${m}.yaml`), 'utf8')).version));
    const LABELS = [
      /`?\b([a-z][a-z-]*?)(?:\.yaml|\.schema\.json)?`? (?:contract|machine) (\d+\.\d+\.\d+)/g,
      /\b(workflow|authority|attention) (\d+\.\d+\.\d+)/g,
      /`([a-z][a-z-]*)\.(?:yaml|schema\.json)` (\d+\.\d+\.\d+)/g,
    ];
    const stale = [];
    for (const f of docs.filter((x) => x.endsWith('.md') && !x.endsWith('CHANGELOG.md'))) {
      const text = fs.readFileSync(f, 'utf8').replace(/\s+/g, ' ');
      for (const re of LABELS) for (const m of text.matchAll(re)) {
        const since = /\bsince $/.test(text.slice(Math.max(0, m.index - 6), m.index));
        if (current.has(m[1]) && current.get(m[1]) !== m[2] && !since) stale.push(`${rel(f)}: "${m[0]}" (now ${current.get(m[1])})`);
      }
      assert.doesNotMatch(text, /\bcontracts \d+\.\d+\.\d+/, `${rel(f)} labels every contract with one version`);
    }
    assert.deepEqual(stale, []);
  });
});

describe('TOOLS.md and the simulator agree', () => {
  it('states the number of invariants and mutations the simulator has', async () => {
    const { INVARIANTS } = await import('../tools/lib/sim/invariants.mjs');
    const { MUTATIONS } = await import('../tools/lib/sim/policies.mjs');
    const tools = fs.readFileSync(path.join(ROOT, 'TOOLS.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(tools, new RegExp(`checks ${Object.keys(INVARIANTS).length} invariants`));
    assert.match(tools, new RegExp(`one of ${Object.keys(MUTATIONS).length} deliberately broken supervisors`));
    for (const k of Object.keys(INVARIANTS)) assert.ok(tools.includes(`\`${k}\``), `TOOLS.md lists ${k}`);
  });
});
