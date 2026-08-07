import type { Attestation, LedgerPayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/**
 * The profitable milestone. Needs N consecutive months of positive net profit from the ledger oracle,
 * ending with the most recent month. Raw figures never leave the oracle; only the result is scored.
 */
export async function verifyLedger(att: Attestation<LedgerPayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  const need = ctx.milestone.target?.profitableMonths ?? 3;
  const months = ctx.readLedger ? await ctx.readLedger() : att.payload.months;
  if (!months || months.length === 0) return { source: 'ledger', score: 0, ok: false, note: 'ledger oracle returned nothing' };
  let streak = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    if ((months[i]?.netProfit ?? 0) > 0) streak++; else break;
  }
  const score = Math.min(1, streak / need);
  return { source: 'ledger', score, ok: streak >= need, note: `${streak} consecutive profitable month${streak === 1 ? '' : 's'}, ${need} required` };
}
