import type { Attestation, ProbePayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/**
 * Performance clause. Full marks inside the target, linear to zero at twice the target.
 * A 20% tolerance band above the target still counts as ok, with a reduced score.
 */
export async function verifyProbe(att: Attestation<ProbePayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  const target = ctx.milestone.target?.p95Ms ?? 300;
  const { p95Ms, uptime } = att.payload;
  if (uptime < 0.99) return { source: 'probe', score: 0.5 * ratioScore(p95Ms, target), ok: false, note: `uptime ${(uptime * 100).toFixed(2)}% below 99%` };
  const score = ratioScore(p95Ms, target);
  const ok = p95Ms <= target * 1.2;
  return { source: 'probe', score, ok, note: p95Ms <= target ? `p95 ${p95Ms} ms under ${target} ms` : `measured ${p95Ms} ms, target ${target} ms, ${ok ? 'within the 20% tolerance' : 'outside tolerance'}` };
}

function ratioScore(measured: number, target: number): number {
  if (measured <= target) return 1;
  if (measured >= target * 2) return 0;
  return 1 - (measured - target) / target;
}
