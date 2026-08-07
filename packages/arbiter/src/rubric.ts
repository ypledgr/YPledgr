import type { Milestone, ProofType } from '@pledgr/core';

/** Where a check gets its evidence from. `chain` means the program's own timestamps. */
export type CheckSource = ProofType | 'chain';

export interface Check {
  id: string;
  label: string;
  source: CheckSource;
  weight: number;
  /** When true, a missing attestation scores 1 instead of 0. Used for optional evidence. */
  optional?: boolean;
}

/**
 * Compile a milestone into the checks the arbiter will score.
 * Weights are relative; `scoreChecks` normalises them.
 */
export function compileRubric(milestone: Milestone): Check[] {
  const deadline: Check = { id: 'deadline', label: 'Delivered before deadline', source: 'chain', weight: 20 };
  switch (milestone.proof) {
    case 'deploy':
      return [
        { id: 'deploy-live', label: `Deploy live${milestone.target?.url ? ` at ${hostOf(milestone.target.url)}` : ''}`, source: 'deploy', weight: 20 },
        { id: 'tests-pass', label: 'Tests pass', source: 'ci', weight: 20 },
        { id: 'chain-of-custody', label: 'Commits signed by the agent', source: 'commits', weight: 20, optional: true },
        { id: 'performance', label: milestone.target?.p95Ms ? `p95 under ${milestone.target.p95Ms} ms` : 'Performance within tolerance', source: 'probe', weight: 20, optional: !milestone.target?.p95Ms },
        deadline,
      ];
    case 'ci':
      return [
        { id: 'tests-pass', label: 'Tests pass', source: 'ci', weight: 50 },
        { id: 'chain-of-custody', label: 'Commits signed by the agent', source: 'commits', weight: 30 },
        deadline,
      ];
    case 'revenue':
      return [
        { id: 'revenue-target', label: revenueLabel(milestone), source: 'revenue', weight: 80 },
        deadline,
      ];
    case 'ledger':
      return [
        { id: 'profitable', label: `${milestone.target?.profitableMonths ?? 3} consecutive profitable months`, source: 'ledger', weight: 100 },
      ];
    case 'probe':
      return [
        { id: 'performance', label: `p95 under ${milestone.target?.p95Ms ?? 300} ms`, source: 'probe', weight: 80 },
        deadline,
      ];
    case 'commits':
      return [
        { id: 'chain-of-custody', label: 'Commits signed by the agent', source: 'commits', weight: 80 },
        deadline,
      ];
    case 'manual':
      return [
        { id: 'manual', label: 'Founder acceptance', source: 'manual', weight: 80 },
        deadline,
      ];
  }
}

function revenueLabel(m: Milestone): string {
  const t = m.target ?? {};
  if (t.payingCustomers) return `${t.payingCustomers} paying customers`;
  if (t.mrr) return `MRR of ${t.mrr} USDC`;
  return 'First revenue';
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}
