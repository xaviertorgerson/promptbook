import { globsOverlap } from './glob.mjs';

// A project's trust profile (governance.schema.json) as the auto-land guards read it
// (workflow.yaml trust-permits, no-protected-path, visual-checked). Pure functions of the recorded
// profile and a task's own fields, so the platform that lands a change and the checks that judge
// the landing compute the same answer from the same evidence.

export const RISK_ORDER = { none: -1, low: 0, medium: 1, high: 2 };

// The highest risk each profile lets land without a human's approval, when auto_land says nothing.
export const PROFILE_CEILING = { solo: 'medium', team: 'low', regulated: 'none' };

export function autoLandCeiling(gov) {
  if (!gov) return 'none';
  return gov.auto_land?.max_risk ?? PROFILE_CEILING[gov.trust] ?? 'none';
}

// A task's risk: a level, or { level, irreversible }; no risk is low.
const riskOf = (risk) => (typeof risk === 'object' && risk ? { level: risk.level ?? 'low', irreversible: Boolean(risk.irreversible) } : { level: risk ?? 'low', irreversible: false });

// trust-permits: the profile's ceiling covers the task's risk, and the task is not irreversible.
export function riskPermitted(gov, risk) {
  const r = riskOf(risk);
  return !r.irreversible && RISK_ORDER[r.level] <= RISK_ORDER[autoLandCeiling(gov)];
}

// The globs of `paths` that a change touching `touches` (globs or paths) reaches.
export const pathsHit = (paths = [], touches = []) => paths.filter((p) => touches.some((t) => globsOverlap(p, t)));

// no-protected-path and visual-checked, on the change's paths.
export const touchesProtected = (gov, touches) => pathsHit(gov?.protected_paths, touches).length > 0;
export const touchesUi = (gov, touches) => pathsHit(gov?.ui_paths, touches).length > 0;
