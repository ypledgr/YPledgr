import type { Attestation, DeployPayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/**
 * Refetch the deployed URL up to three times. Full marks when it answers 2xx and the body hash
 * matches the attested build hash. Five points off per failed fetch. Hash mismatch halves the score.
 */
export async function verifyDeploy(att: Attestation<DeployPayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  const { url, buildHash } = att.payload;
  const expected = ctx.milestone.target?.url;
  if (expected && normalise(expected) !== normalise(url)) {
    return { source: 'deploy', score: 0, ok: false, note: `attested ${url}, milestone requires ${expected}` };
  }
  if (!ctx.probeUrl) return { source: 'deploy', score: 0, ok: false, note: 'no prober configured' };

  let failures = 0;
  let hashMatched = false;
  for (let i = 0; i < 3; i++) {
    const r = await ctx.probeUrl(url);
    if (r.status < 200 || r.status >= 300) { failures++; continue; }
    if (r.bodyHash === buildHash) hashMatched = true;
  }
  if (failures === 3) return { source: 'deploy', score: 0, ok: false, note: `${url} did not answer` };
  let score = 1 - failures * 0.05;
  if (!hashMatched) score *= 0.5;
  return { source: 'deploy', score, ok: score >= 0.8, note: hashMatched ? `live at ${hostOf(url)}, build hash matches` : `live at ${hostOf(url)}, build hash does not match attestation` };
}

function normalise(u: string): string {
  return u.replace(/\/+$/, '').toLowerCase();
}
function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}
