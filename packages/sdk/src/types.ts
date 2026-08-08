import type { Build, Milestone, Money, Verdict } from '@pledgr/core';

export interface CreateBuildInput {
  company: string;
  spec: string;
  milestones: Milestone[];
  /** "12000 USDC" or a Money object. */
  escrow: string | Money;
  /** "2400 USDC" or a Money object. Defaults to 20% of escrow. */
  bond?: string | Money;
  /** Set when a backer funds the escrow instead of the founder. */
  backer?: string;
  params?: Partial<Build['params']>;
}

export interface ProveInput {
  deploy?: { url: string; buildHash?: string };
  ci?: { provider: 'github' | 'buildkite' | 'circleci'; runId: string; passed?: number; total?: number; sha?: string };
  commits?: { from: string; to: string; count: number };
  probe?: { url: string; p95Ms: number; uptime: number; windowMinutes?: number };
  revenue?: { source: 'stripe' | 'onchain' };
  ledger?: true;
}

export interface BuildView extends Build {
  tranches: Array<{ milestoneId: string; amount: Money; status: 'locked' | 'in_review' | 'released' | 'refunded' }>;
  verdicts: Verdict[];
  /** Unix seconds until which the latest verdict can be appealed. */
  appealUntil?: number;
}

export interface PassportView {
  handle: string;
  publicKey: string;
  bondedSince: number;
  builds: number;
  passRate: number;
  slashes: number;
  earned: Money;
  toProfitable: number;
  recentScores: number[];
  standing: 'good' | 'watch' | 'suspended';
  bond: Money;
}
