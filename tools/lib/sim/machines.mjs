import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { registry as sharedRegistry } from '../registry.mjs';

// The state machines the simulator enforces, read from state-machines/*.yaml so a change there
// changes what the simulator checks. The claimed statuses come from the task schema's own rule.

export const STATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../state-machines');

export function loadMachines({ dir = STATE_DIR, registry = sharedRegistry() } = {}) {
  const read = (n) => parse(fs.readFileSync(path.join(dir, `${n}.yaml`), 'utf8'));
  const workflow = read('workflow');
  const attention = read('attention');
  const authority = read('authority');
  const task = workflow.machines.task;
  const transitions = new Map(task.transitions.map((t) => [t.id, { ...t, from: [].concat(t.from), guards: t.guards ?? [], grant_guards: t.grant_guards ?? [] }]));
  const claimedRule = registry.schema('task').allOf.find((r) => r['x-rule'] === 'claimed-task-has-owner');
  return {
    workflow,
    attention,
    authority,
    states: task.states,
    transitions,
    sideStates: new Set(task.side_states),
    terminal: new Set(task.terminal),
    claimed: new Set(claimedRule.if.properties.status.enum),
    roleKind: Object.fromEntries(Object.entries(workflow.roles).map(([r, v]) => [r, v.kind])),
    gates: workflow.gates,
    mergeRequires: authority.grantable.merge.always_requires,
  };
}

export const isHuman = (m, role) => m.roleKind[role] === 'human';

