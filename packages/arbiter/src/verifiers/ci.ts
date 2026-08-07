import type { Attestation, CiPayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/**
 * Read the CI run from the provider and compare with the attestation.
 * Score is the pass ratio, zero below 90%, and zero if the provider's numbers disagree with the claim.
 */
export async function verifyCi(att: Attestation<CiPayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  const { provider, runId, passed, total, sha } = att.payload;
  if (total <= 0) return { source: 'ci', score: 0, ok: false, note: 'empty test run' };
  if (!ctx.readCiRun) return { source: 'ci', score: 0, ok: false, note: 'no CI reader configured' };
  const run = await ctx.readCiRun(provider, runId);
  if (!run) return { source: 'ci', score: 0, ok: false, note: `${provider} run ${runId} not found` };
  if (run.passed !== passed || run.total !== total || run.sha !== sha) {
    return { source: 'ci', score: 0, ok: false, note: `${provider} reports ${run.passed}/${run.total} at ${run.sha.slice(0, 7)}, attestation claims ${passed}/${total}` };
  }
  const ratio = passed / total;
  const floor = ctx.milestone.target?.passRatio ?? 0.9;
  const score = ratio < floor ? 0 : ratio;
  return { source: 'ci', score, ok: score >= 0.9, note: `${passed}/${total} passed, signed ${provider} run ${runId}` };
}
