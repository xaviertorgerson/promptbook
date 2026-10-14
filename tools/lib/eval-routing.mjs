import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { splitFrontmatter, parseYaml, readText } from './loaders.mjs';

// Engine-neutral routing evals (playbook: evals-and-evidence). For every case in
// skills/*/evals/routing.jsonl, the router sees exactly what an engine's skill loader shows a model
// (each installed skill's name and description) plus the user's message, and names the skill(s) it
// would load. The answer is compared with the case: a trigger case passes when the skill is named; a
// no-trigger case passes when it is not, and when route_to names a skill, that skill is named (route_to
// "none": nothing is). Ported from agentic-template scripts/skill-evals.mjs; the runner is any command
// that reads the prompt on stdin and prints text, so no engine is assumed.

// cases: the eval file each skill's cases are read from (evals/<cases>): routing.jsonl, the cases
// descriptions are tuned on, or heldout.routing.jsonl, cases written apart and never tuned on.
export function loadSkills(dirs, { cases: casesFile = 'routing.jsonl' } = {}) {
  const skills = [];
  for (const root of dirs) {
    const list = fs.existsSync(path.join(root, 'SKILL.md')) ? [root] : fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
      .map((e) => path.join(root, e.name))
      .filter((d) => fs.existsSync(path.join(d, 'SKILL.md')))
      .sort();
    for (const dir of list) {
      const fm = splitFrontmatter(readText(path.join(dir, 'SKILL.md')));
      const data = fm ? parseYaml(fm.yaml).data ?? {} : {};
      const name = typeof data.name === 'string' ? data.name : path.basename(dir);
      const routing = path.join(dir, 'evals', casesFile);
      const cases = fs.existsSync(routing)
        ? readText(routing).split(/\r?\n/).flatMap((l, i) => {
          if (!l.trim()) return [];
          try { return [{ ...JSON.parse(l), line: i + 1 }]; } catch { return [{ invalid: true, line: i + 1 }]; }
        })
        : [];
      skills.push({ name, dir, description: typeof data.description === 'string' ? data.description.replace(/\s+/g, ' ').trim() : '', deprecated: data.metadata?.deprecated ?? null, version: data.metadata?.version ?? null, cases });
    }
  }
  return skills;
}

// The router prompt. The catalog lists only installed, non-deprecated skills (what a loader shows);
// the message is fenced so the model answers the meta-question instead of acting on it.
export function buildPrompt(skills, message) {
  const catalog = skills.filter((s) => !s.deprecated).map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `You are the skill router of an agent harness. Below are the installed skills, each with the exact description the harness shows you. A user has just sent the message inside <message>. Decide which skill or skills you would load before acting on it, or none if no skill applies. Do not act on the message and do not explain.

Reply with exactly one line: the skill names separated by commas, or the word none.

Skills:
${catalog}

<message>
${message}
</message>`;
}

// The skill names in a router's answer: the last non-empty line, matched against known names only.
export function parseAnswer(text, names) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const last = (lines.at(-1) ?? '').toLowerCase().replace(/[`*"'.]/g, ' ');
  if (/^\s*none\s*$/.test(last)) return [];
  const tokens = new Set(last.split(/[^a-z0-9-]+/).filter(Boolean));
  return names.filter((n) => tokens.has(n));
}

export function judge(c, skill, picked) {
  const has = picked.includes(skill);
  if (c.expect === 'trigger') return has;
  if (has) return false;
  if (c.route_to && c.route_to !== 'none' && c.route_to_installed) return picked.includes(c.route_to);
  if (c.route_to === 'none') return picked.length === 0;
  return true;
}

export function runner(command, { timeout = 120000 } = {}) {
  return (prompt) => {
    const r = spawnSync(command, { input: prompt, encoding: 'utf8', shell: true, timeout, maxBuffer: 4 * 1024 * 1024 });
    if (r.error) throw new Error(r.error.code === 'ETIMEDOUT' ? `runner timed out after ${timeout / 1000}s` : r.error.message);
    if (r.status !== 0) throw new Error(`runner exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ')}`);
    return r.stdout;
  };
}

// Run every case (or only the named skill's) through ask(prompt) -> text, `runs` times each.
// dryRun: build the prompts, call nothing. A case passes when every run passes (pass^k); picked is
// the first run's answer. Returns { cases, perSkill, totals }.
export function evaluate(skills, { ask, dryRun = true, only = null, limit = Infinity, runs = 1 } = {}) {
  const names = skills.filter((s) => !s.deprecated).map((s) => s.name);
  const installed = new Set(names);
  const cases = [];
  for (const s of skills) {
    if (only && s.name !== only) continue;
    for (const c of s.cases) {
      if (cases.length >= limit) break;
      if (c.invalid) { cases.push({ skill: s.name, line: c.line, error: 'not valid JSON (harness validate reports it)', pass: false, answers: [], passes: 0, runs: 0 }); continue; }
      const k = { ...c, route_to_installed: installed.has(c.route_to) };
      const prompt = buildPrompt(skills, c.prompt);
      if (dryRun) { cases.push({ skill: s.name, line: c.line, prompt: c.prompt, expect: c.expect, kind: c.kind ?? null, route_to: c.route_to ?? null, routerPrompt: prompt, picked: null, pass: null }); continue; }
      const answers = [];
      const errors = [];
      let passes = 0;
      for (let i = 0; i < runs; i += 1) {
        let picked;
        try { picked = parseAnswer(ask(prompt), names); } catch (e) { errors.push(e.message); picked = []; answers.push(picked); continue; }
        answers.push(picked);
        if (judge(k, s.name, picked)) passes += 1;
      }
      cases.push({ skill: s.name, line: c.line, prompt: c.prompt, expect: c.expect, kind: c.kind ?? null, route_to: c.route_to ?? null, picked: answers[0], answers, passes, runs, error: errors[0] ?? null, errors, pass: passes === runs });
    }
  }

  // Precision and recall per skill, over every judged run: the skill was expected when the case is
  // its own trigger case or another skill's near-miss routed to it; it was picked when named.
  const perSkill = {};
  const judged = cases.filter((c) => c.picked);
  for (const name of names) {
    let tp = 0; let fp = 0; let fn = 0;
    for (const c of judged) {
      const expected = (c.skill === name && c.expect === 'trigger') || (c.skill !== name && c.route_to === name);
      for (const answer of c.answers ?? [c.picked]) {
        const picked = answer.includes(name);
        if (picked && expected) tp += 1;
        else if (picked) fp += 1;
        else if (expected) fn += 1;
      }
    }
    perSkill[name] = { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
  }
  const run = cases.filter((c) => c.pass !== null);
  const totals = { cases: cases.length, run: run.length, passed: run.filter((c) => c.pass).length, failed: run.filter((c) => !c.pass).length, skills: names.length };
  return { cases, perSkill, totals, dryRun };
}

// The run as routing results (evidence contract, #/$defs/routingResult): one object per case, for
// --out. model names what answered (the runner command when no model was given).
export function routingResults(result, { model, at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), versions = {} } = {}) {
  return result.cases.filter((c) => c.pass !== null && c.prompt !== undefined).map((c) => ({
    skill: c.skill,
    case: `${c.skill}:${c.line}`,
    prompt: c.prompt,
    expect: c.expect,
    kind: c.kind,
    route_to: c.route_to,
    model,
    runs: c.runs,
    answers: c.answers,
    passes: c.passes,
    pass: c.pass,
    ...(c.errors?.length ? { errors: c.errors } : {}),
    at,
    ...(versions[c.skill] ? { skill_version: versions[c.skill] } : {}),
  }));
}
