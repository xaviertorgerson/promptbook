import { fenceMask, headings, section, splitLines, stripComments, tables } from './markdown.mjs';

// agentic-template keeps a skill's evals in one evals.md: a "## Trigger routing" table (Prompt |
// Expected), "## Scenarios" (### title, Fixture:, Assertions:) and "## Evidence" (- **date, who.**
// text). The harness keeps them as three files in the evidence contract's shapes: routing.jsonl,
// scenarios.md and evidence.md. What the source does not say (a scenario's prompt, a neighbour
// that is not a skill) is written as a marker that lint reports (imported-needs-review), so a human
// finishes the import instead of a guess shipping as an eval.

export const NEEDS_ROUTE = 'needs route_to';
export const NEEDS_PROMPT = 'TODO(import): the user prompt that starts this scenario';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const unquote = (s) => s.trim().replace(/^["“'`]+|["”'`]+$/g, '').trim();

// One routing row -> a routing case (evidence contract, routingCase). rename maps the source's
// skill names to the harness's.
export function routingCase(promptCell, expectedCell, rename = {}) {
  const near = /\(\s*near[- ]miss\s*\)/i.test(promptCell);
  const prompt = unquote(promptCell.replace(/\(\s*near[- ]miss\s*\)/i, ''));
  const expected = expectedCell.trim();
  if (/^trigger\b/i.test(expected)) return { prompt, expect: 'trigger', kind: 'positive' };
  const paren = expected.match(/\(([^)]*)\)/)?.[1] ?? '';
  const named = [...paren.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  const skill = named.map((n) => rename[n] ?? n).find((n) => SLUG.test(n));
  if (skill) return { prompt, expect: 'no-trigger', kind: 'near-miss', route_to: skill };
  // No skill to route to: a negative until a human names the neighbour (or confirms none).
  return { prompt, expect: 'no-trigger', kind: 'negative', note: `${NEEDS_ROUTE}${near ? ' (the source marks it a near miss)' : ''}${paren ? `: the source says ${paren.trim()}` : ''}` };
}

function sectionText(lines, re) {
  const sec = section(lines, re);
  return sec ? { ...sec, text: sec.lines.join('\n') } : null;
}

// "Label: text" paragraphs inside one scenario: { fixture, assertions, ... } (lowercased labels).
function labelled(text) {
  const out = {};
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z][A-Za-z ]{1,30}):\s*(.*)$/);
    if (m) { cur = m[1].toLowerCase(); out[cur] = m[2].trim(); continue; }
    if (cur && line.trim()) out[cur] = `${out[cur]} ${line.trim()}`.trim();
    else if (!line.trim()) cur = null;
  }
  return out;
}

// "- **2026-09-21, template audit.** text" (text may run over indented lines).
function evidenceItems(text) {
  const items = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([0-9]{4}-[0-9]{2}(?:-[0-9]{2})?)\s*,?\s*([^*]*?)\.?\*\*\s*(.*)$/);
    if (m) { cur = { date: m[1], who: m[2].trim(), text: m[3].trim() }; items.push(cur); continue; }
    if (cur && /^\s+\S/.test(line)) cur.text = `${cur.text} ${line.trim()}`.trim();
    else if (!line.trim()) cur = null;
  }
  return items;
}

const kindOf = (who, text) => (/\baudit\b/i.test(who) ? 'audit' : /\b(?:incident|outage|broke|regress)/i.test(`${who} ${text}`) ? 'incident' : 'observed');

// evals.md text -> { routing: [case], scenarios: string, evidence: string, counts, review: [string] }.
// source names the file the evidence entries cite.
export function importEvals(text, { skill, source, rename = {}, k = 3 } = {}) {
  const lines = splitLines(stripComments(text));
  const review = [];

  const routing = [];
  const rsec = section(lines, /^Trigger routing\b|^Routing\b/i);
  for (const t of rsec ? tables(rsec.lines, rsec.mask) : []) {
    const h = t.headers.map((x) => x.toLowerCase());
    const pi = h.findIndex((x) => /prompt/.test(x));
    const ei = h.findIndex((x) => /expect/.test(x));
    if (pi === -1 || ei === -1) continue;
    for (const row of t.rows) {
      const c = routingCase(row.cells[pi] ?? '', row.cells[ei] ?? '', rename);
      if (!c.prompt) continue;
      if (c.note) review.push(`routing: "${c.prompt}" ${c.note}`);
      routing.push(c);
    }
  }

  const ssec = sectionText(lines, /^Scenarios\b/i);
  const scenarios = [];
  if (ssec) {
    const hs = headings(ssec.lines, fenceMask(ssec.lines)).filter((x) => x.level === 3);
    hs.forEach((h, i) => {
      const body = ssec.lines.slice(h.index + 1, hs[i + 1]?.index ?? ssec.lines.length).join('\n');
      const f = labelled(body);
      scenarios.push({ title: h.text.trim(), setup: f.fixture ?? f.setup ?? f.given ?? '', prompt: f.prompt ?? null, pass: f.assertions ?? f.pass ?? f.expected ?? '' });
    });
  }
  for (const s of scenarios) if (!s.prompt) review.push(`scenario "${s.title}" has no prompt`);
  const scenariosMd = [
    `# Scenarios — ${skill}`,
    '',
    `Imported from ${source} by harness import-evals.`,
    `k = ${k} for every scenario (pass^k). A value the source did not supply carries the import marker;`,
    'lint reports it (imported-needs-review) until a human writes the value.',
    '',
    ...scenarios.flatMap((s, i) => [
      `## ${i + 1}. ${s.title}`,
      `- **Setup:** ${s.setup || 'TODO(import): the fixture'}`,
      `- **Prompt:** ${s.prompt ?? NEEDS_PROMPT}`,
      `- **Pass criteria:** ${s.pass || 'TODO(import): what must hold'}`,
      '',
    ]),
  ].join('\n');

  const esec = sectionText(lines, /^Evidence\b/i);
  const entries = esec ? evidenceItems(esec.text) : [];
  const evidenceMd = [
    `# Evidence — ${skill}`,
    '',
    ...entries.flatMap((e) => [
      `## ${e.date} · ${e.who || 'imported entry'}`,
      `- **Kind:** ${kindOf(e.who, e.text)}`,
      `- **Source:** ${source}`,
      `- **Claim:** ${e.text}`,
      '',
    ]),
  ].join('\n');
  if (!entries.length) review.push('evidence: the source has no dated entry; add one');

  return {
    routing,
    routingJsonl: `${routing.map((c) => JSON.stringify(c)).join('\n')}\n`,
    scenarios: scenariosMd,
    evidence: evidenceMd,
    counts: { positive: routing.filter((c) => c.kind === 'positive').length, nearMiss: routing.filter((c) => c.kind === 'near-miss').length, negative: routing.filter((c) => c.kind === 'negative').length, scenarios: scenarios.length, evidence: entries.length },
    review,
  };
}
