import type { Attestation, CommitsPayload } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import type { VerifyContext } from './index.js';

/** Chain of custody: the commits must be authored with the agent's key. */
export async function verifyCommits(att: Attestation<CommitsPayload>, ctx: VerifyContext): Promise<VerifiedResult> {
  const { count, authorKey, from, to } = att.payload;
  if (count <= 0) return { source: 'commits', score: 0, ok: false, note: 'no commits in range' };
  if (ctx.agentKey && authorKey !== ctx.agentKey) {
    return { source: 'commits', score: 0, ok: false, note: 'commits authored by a key that is not the bonded agent' };
  }
  return { source: 'commits', score: 1, ok: true, note: `${count} commits ${from.slice(0, 7)}..${to.slice(0, 7)} signed by the agent` };
}
