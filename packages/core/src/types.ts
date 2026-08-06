/**
 * Core domain types shared by the SDK, the arbiter, the API and the CLI.
 * Amounts are plain numbers in whole currency units (12000 means 12,000 USDC).
 * The program stores them as u64 micro-units; `toMicro` and `fromMicro` convert.
 */

export type Currency = 'USDC' | 'PLEDGR';

export interface Money {
  amount: number;
  currency: Currency;
}

/** The kinds of proof the arbiter knows how to verify. */
export type ProofType = 'deploy' | 'ci' | 'commits' | 'probe' | 'revenue' | 'ledger' | 'manual';

export interface MilestoneTarget {
  /** For `revenue`: minimum monthly recurring revenue in USDC. */
  mrr?: number;
  /** For `revenue`: minimum number of paying customers. */
  payingCustomers?: number;
  /** For `ledger`: consecutive profitable months required. */
  profitableMonths?: number;
  /** For `probe`: p95 latency ceiling in milliseconds. */
  p95Ms?: number;
  /** For `ci`: minimum pass ratio, 0..1. Defaults to 1. */
  passRatio?: number;
  /** For `deploy`: the URL that must be live. */
  url?: string;
}

export interface Milestone {
  id: string;
  /** Human description used by the arbiter's reasoner. */
  title?: string;
  proof: ProofType;
  /** Share of total escrow behind this milestone. Weights across a build sum to 1. */
  weight: number;
  target?: MilestoneTarget;
  /** Unix seconds. Missing means no deadline. */
  deadline?: number;
}

export type BuildState =
  | 'open'
  | 'bonded'
  | 'funded'
  | 'building'
  | 'in_review'
  | 'released'
  | 'appeal'
  | 'slashed'
  | 'settled';

export interface BuildParams {
  /** Score needed for a full pass, 0..100. Default 80. */
  passThreshold: number;
  /** Score floor for a partial settlement, 0..100. Default 50. */
  partialFloor: number;
  /** Whether partial settlements are allowed. Default true. */
  allowPartial: boolean;
  /** Appeal window in seconds. Default 86400. */
  appealWindow: number;
}

export const DEFAULT_PARAMS: BuildParams = {
  passThreshold: 80,
  partialFloor: 50,
  allowPartial: true,
  appealWindow: 86_400,
};

export interface Build {
  id: string;
  company: string;
  spec: string;
  founder: string;
  agent?: string;
  backer?: string;
  milestones: Milestone[];
  escrow: Money;
  bond: Money;
  params: BuildParams;
  state: BuildState;
  /** Index of the milestone currently being worked on. */
  currentMilestone: number;
  createdAt: number;
}

export type VerdictKind = 'pass' | 'partial' | 'fail';

export interface Verdict {
  buildId: string;
  milestoneId: string;
  kind: VerdictKind;
  /** 0..100 */
  score: number;
  released: Money;
  slashed: Money;
  /** Amount of escrow that stays locked after this verdict. */
  locked: Money;
  reasoning: string;
  reasoningHash: string;
  /** Base64 ed25519 signature over `${buildId}:${milestoneId}:${score}:${reasoningHash}` */
  signature: string;
  arbiter: string;
  issuedAt: number;
}

export interface Attestation<T = Record<string, unknown>> {
  type: ProofType;
  buildId: string;
  milestoneId: string;
  /** Agent public key, base58. */
  signer: string;
  /** Unix seconds. */
  issuedAt: number;
  payload: T;
  /** sha256 of the canonical payload, hex. */
  hash: string;
  /** Base64 ed25519 signature over the hash. */
  signature: string;
}

export interface DeployPayload { url: string; buildHash: string; fingerprint?: string }
export interface CiPayload { provider: 'github' | 'buildkite' | 'circleci'; runId: string; passed: number; total: number; sha: string; coverage?: number }
export interface CommitsPayload { from: string; to: string; count: number; authorKey: string }
export interface ProbePayload { url: string; p95Ms: number; uptime: number; windowMinutes: number }
export interface RevenuePayload { source: 'stripe' | 'onchain'; mrr: number; payingCustomers: number; periodEnd: number }
export interface LedgerPayload { months: Array<{ month: string; netProfit: number }> }
