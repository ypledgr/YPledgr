import { DEFAULT_PARAMS, type Build, type BuildParams, type Milestone, type Money, type VerdictKind } from './types.js';
import { min, money, mul, sub } from './money.js';

export interface Tranche {
  milestoneId: string;
  index: number;
  amount: Money;
}

/** Split a build's escrow into tranches by milestone weight. Rounds to micro-units and gives the remainder to the last tranche. */
export function computeTranches(escrow: Money, milestones: Milestone[]): Tranche[] {
  if (milestones.length === 0) throw new Error('A build needs at least one milestone');
  const totalWeight = milestones.reduce((s, m) => s + m.weight, 0);
  if (Math.abs(totalWeight - 1) > 1e-6) throw new Error(`Milestone weights must sum to 1, got ${totalWeight}`);
  const tranches: Tranche[] = [];
  let allocated = 0;
  milestones.forEach((m, i) => {
    const last = i === milestones.length - 1;
    const amount = last ? round6(escrow.amount - allocated) : round6(escrow.amount * m.weight);
    allocated += amount;
    tranches.push({ milestoneId: m.id, index: i, amount: money(amount, escrow.currency) });
  });
  return tranches;
}

export interface SettlementInput {
  tranche: Money;
  bond: Money;
  /** 0..100 */
  score: number;
  params?: Partial<BuildParams>;
  /** Escrow still locked before this settlement, including this tranche. */
  lockedBefore: Money;
}

export interface Settlement {
  kind: VerdictKind;
  released: Money;
  /** Refunded to the founder (or backer) from this tranche. */
  refunded: Money;
  slashed: Money;
  lockedAfter: Money;
}

/**
 * The money rule. Deterministic, no model involved.
 *
 * pass     score >= passThreshold            tranche released in full
 * partial  partialFloor <= score < threshold  tranche * score / 100 released, rest refunded
 * fail     score < partialFloor               nothing released, bond slashed up to the founder's loss
 */
export function settleMilestone(input: SettlementInput): Settlement {
  const p = { ...DEFAULT_PARAMS, ...input.params };
  const { tranche, bond, score } = input;
  if (score < 0 || score > 100) throw new Error(`Score out of range: ${score}`);

  const zero = money(0, tranche.currency);
  let kind: VerdictKind;
  let released: Money;

  if (score >= p.passThreshold) {
    kind = 'pass';
    released = tranche;
  } else if (p.allowPartial && score >= p.partialFloor) {
    kind = 'partial';
    released = mul(tranche, score / 100);
  } else {
    kind = 'fail';
    released = zero;
  }

  const refunded = sub(tranche, released);
  const founderLoss = refunded;
  const slashed = kind === 'fail' ? min(bond, money(founderLoss.amount, bond.currency)) : money(0, bond.currency);
  const lockedAfter = sub(input.lockedBefore, tranche);

  return { kind, released, refunded, slashed, lockedAfter };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Convenience: settle the current milestone of a build. */
export function settleCurrent(build: Build, score: number): Settlement & { tranche: Tranche } {
  const tranches = computeTranches(build.escrow, build.milestones);
  const tranche = tranches[build.currentMilestone];
  if (!tranche) throw new Error(`No milestone at index ${build.currentMilestone}`);
  const lockedBefore = tranches.slice(build.currentMilestone).reduce((s, t) => s + t.amount.amount, 0);
  const s = settleMilestone({
    tranche: tranche.amount,
    bond: build.bond,
    score,
    params: build.params,
    lockedBefore: money(lockedBefore, build.escrow.currency),
  });
  return { ...s, tranche };
}
