#!/usr/bin/env node
// A deterministic stand-in for a model CLI in the routing-eval tests: it reads the router prompt on
// stdin and answers by keyword, the way a cheap model would, with no network call. FAKE_ROUTER_MODE
// selects a behaviour: "keywords" (default), "none", "all", "chatty" (explains before answering),
// "fail" (exits 3).
import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8');
const message = (input.match(/<message>\n([\s\S]*?)\n<\/message>/) ?? [])[1] ?? '';
const skills = [...input.matchAll(/^- ([a-z0-9-]+): /gm)].map((m) => m[1]);
const mode = process.env.FAKE_ROUTER_MODE ?? 'keywords';
if (mode === 'fail') { process.stderr.write('rate limited\n'); process.exit(3); }
if (mode === 'none') { console.log('none'); process.exit(0); }
if (mode === 'all') { console.log(skills.join(', ')); process.exit(0); }

const RULES = [
  [/\bpr description\b/i, 'preparing-pull-requests'],
  [/\b(?:draft|sketch|write up|idea)\b/i, 'drafting-widgets'],
  [/\b(?:check|meet|verify|done according)\b/i, 'checking-widgets'],
  [/\b(?:release|ship|publish|live)\b/i, 'shipping-widgets'],
  [/\b(?:pull request|review this)\b/i, 'reviewing-code'],
  [/\bsort these\b/i, 'drafting-widgets'],
];
// The first rule that matches decides; a skill that is not installed cannot be named, so the answer
// is none (a real router cannot pick what it was not shown).
const hit = RULES.find(([re]) => re.test(message))?.[1];
const pick = hit && skills.includes(hit) ? hit : 'none';
if (mode === 'chatty') console.log('Let me think about which skill fits.\nThe message asks about widgets.');
console.log(pick);
