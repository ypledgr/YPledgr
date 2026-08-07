import type { Attestation, Milestone, ProofType } from '@pledgr/core';
import type { VerifiedResult } from '../score.js';
import { verifyDeploy } from './deploy.js';
import { verifyCi } from './ci.js';
import { verifyCommits } from './commits.js';
import { verifyProbe } from './probe.js';
import { verifyRevenue } from './revenue.js';
import { verifyLedger } from './ledger.js';

/** Everything a verifier may need from the outside world. All injectable so tests never touch the network. */
export interface VerifyContext {
  milestone: Milestone;
  /** Expected signer (agent public key). When set, attestations from other keys are rejected. */
  agentKey?: string;
  now: number;
  /** Fetch a URL and return the status and a sha256 of the body. */
  probeUrl?: (url: string) => Promise<{ status: number; bodyHash: string; latencyMs: number }>;
  /** Read a CI run from the provider. */
  readCiRun?: (provider: string, runId: string) => Promise<{ passed: number; total: number; sha: string } | null>;
  /** Read revenue from an oracle. */
  readRevenue?: (source: string) => Promise<{ mrr: number; payingCustomers: number } | null>;
  /** Read monthly net profit from a ledger oracle, most recent last. */
  readLedger?: () => Promise<Array<{ month: string; netProfit: number }> | null>;
}

export type Verifier = (att: Attestation<any>, ctx: VerifyContext) => Promise<VerifiedResult>;

export const VERIFIERS: Partial<Record<ProofType, Verifier>> = {
  deploy: verifyDeploy,
  ci: verifyCi,
  commits: verifyCommits,
  probe: verifyProbe,
  revenue: verifyRevenue,
  ledger: verifyLedger,
};

export { verifyDeploy, verifyCi, verifyCommits, verifyProbe, verifyRevenue, verifyLedger };
