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
