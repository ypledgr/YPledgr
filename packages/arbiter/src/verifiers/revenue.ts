import type { Attestation, RevenuePayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/** Revenue milestone. The oracle's numbers win over the attestation's numbers. */
export async function verifyRevenue(att: Attestation<RevenuePayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  if (!ctx.readRevenue) return { source: 'revenue', score: 0, ok: false, note: 'no revenue oracle configured' };
  const read = await ctx.readRevenue(att.payload.source);
  if (!read) return { source: 'revenue', score: 0, ok: false, note: `${att.payload.source} oracle returned nothing` };
  const t = ctx.milestone.target ?? {};
  const parts: number[] = [];
  const notes: string[] = [];
  if (t.payingCustomers) {
    parts.push(Math.min(1, read.payingCustomers / t.payingCustomers));
    notes.push(`${read.payingCustomers} of ${t.payingCustomers} paying customers`);
  }
  if (t.mrr) {
    parts.push(Math.min(1, read.mrr / t.mrr));
    notes.push(`MRR ${read.mrr} of ${t.mrr} USDC`);
  }
  if (parts.length === 0) {
    const ok = read.mrr > 0 || read.payingCustomers > 0;
    return { source: 'revenue', score: ok ? 1 : 0, ok, note: ok ? `first revenue confirmed, MRR ${read.mrr} USDC` : 'no revenue yet' };
  }
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { source: 'revenue', score, ok: score >= 1, note: notes.join(', ') };
}
