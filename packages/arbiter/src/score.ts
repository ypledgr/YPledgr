import type { Milestone, VerdictKind } from '@pledgr/core';
import type { Check } from './rubric.js';

/** What a verifier returns for one attestation. */
export interface VerifiedResult {
  source: Check['source'];
  /** 0..1 */
  score: number;
  ok: boolean;
  note: string;
}

export interface ScoredCheck extends Check {
  /** 0..1 */
  score: number;
  points: number;
  maxPoints: number;
  note: string;
}

export interface Scorecard {
  checks: ScoredCheck[];
  /** 0..100 */
  score: number;
  kind: VerdictKind;
}

export interface ScoreParams {
  passThreshold: number;
  partialFloor: number;
  allowPartial: boolean;
}

/** Deterministic scoring. Missing evidence scores zero unless the check is optional. */
export function scoreChecks(checks: Check[], results: VerifiedResult[], params: ScoreParams, milestone?: Milestone, now = Math.floor(Date.now() / 1000)): Scorecard {
  const bySource = new Map<string, VerifiedResult>();
  for (const r of results) bySource.set(r.source, r);

  const scored: ScoredCheck[] = checks.map((c) => {
    let s: number;
    let note: string;
    if (c.source === 'chain') {
      const ok = !milestone?.deadline || now <= milestone.deadline;
      s = ok ? 1 : 0;
      note = ok ? (milestone?.deadline ? `delivered ${fmtTime(now)}, deadline ${fmtTime(milestone.deadline)}` : 'no deadline set') : `late by ${now - (milestone?.deadline ?? now)} s`;
    } else {
      const r = bySource.get(c.source);
      if (!r) {
        s = c.optional ? 1 : 0;
        note = c.optional ? 'no evidence, optional' : 'no evidence submitted';
      } else {
        s = clamp(r.score);
        note = r.note;
      }
    }
    const maxPoints = c.weight;
    return { ...c, score: s, points: round1(s * maxPoints), maxPoints, note };
  });

  const total = scored.reduce((a, c) => a + c.maxPoints, 0);
  const got = scored.reduce((a, c) => a + c.points, 0);
  const score = total === 0 ? 0 : Math.round((got / total) * 100);
  const kind: VerdictKind = score >= params.passThreshold ? 'pass' : params.allowPartial && score >= params.partialFloor ? 'partial' : 'fail';
  return { checks: scored, score, kind };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function fmtTime(t: number): string {
  return new Date(t * 1000).toISOString().slice(11, 16);
}
