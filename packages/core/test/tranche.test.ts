import { describe, expect, it } from 'vitest';
import { computeTranches, settleMilestone, settleCurrent } from '../src/tranche.js';
import { money } from '../src/money.js';
import { DEFAULT_PARAMS, type Build } from '../src/types.js';

const escrow = money(12_000);
const milestones = [
  { id: 'mvp-live', proof: 'deploy' as const, weight: 1 / 3 },
  { id: '100-paying-users', proof: 'revenue' as const, weight: 1 / 3 },
  { id: 'profitable', proof: 'ledger' as const, weight: 1 / 3 },
];

describe('computeTranches', () => {
  it('splits escrow by weight and gives rounding to the last tranche', () => {
    const t = computeTranches(escrow, milestones);
    expect(t.map((x) => x.amount.amount)).toEqual([4000, 4000, 4000]);
    const uneven = computeTranches(money(10_000), [{ id: 'a', proof: 'deploy', weight: 0.3334 }, { id: 'b', proof: 'revenue', weight: 0.3333 }, { id: 'c', proof: 'ledger', weight: 0.3333 }]);
    expect(uneven.map((x) => x.amount.amount)).toEqual([3334, 3333, 3333]);
    expect(uneven.reduce((s, x) => s + x.amount.amount, 0)).toBeCloseTo(10_000, 6);
  });

  it('rejects weights that do not sum to 1', () => {
    expect(() => computeTranches(escrow, [{ id: 'a', proof: 'manual', weight: 0.5 }])).toThrow(/sum to 1/);
  });
});

describe('settleMilestone', () => {
  const base = { tranche: money(4000), bond: money(2400), lockedBefore: money(12_000) };

  it('releases the full tranche on a pass', () => {
    const s = settleMilestone({ ...base, score: 96 });
    expect(s.kind).toBe('pass');
    expect(s.released.amount).toBe(4000);
    expect(s.slashed.amount).toBe(0);
    expect(s.lockedAfter.amount).toBe(8000);
  });

  it('releases pro rata on a partial and refunds the rest', () => {
    const s = settleMilestone({ ...base, score: 62 });
    expect(s.kind).toBe('partial');
    expect(s.released.amount).toBe(2480);
    expect(s.refunded.amount).toBe(1520);
    expect(s.slashed.amount).toBe(0);
  });

  it('slashes the bond up to the founder loss on a fail', () => {
    const s = settleMilestone({ ...base, score: 31 });
    expect(s.kind).toBe('fail');
    expect(s.released.amount).toBe(0);
    expect(s.slashed.amount).toBe(2400);
  });

  it('never slashes more than the founder lost', () => {
    const s = settleMilestone({ tranche: money(500), bond: money(2400), lockedBefore: money(500), score: 0 });
    expect(s.slashed.amount).toBe(500);
  });

  it('treats a partial as a fail when partials are disabled', () => {
    const s = settleMilestone({ ...base, score: 62, params: { allowPartial: false } });
    expect(s.kind).toBe('fail');
  });

  it('rejects scores outside 0..100', () => {
    expect(() => settleMilestone({ ...base, score: 101 })).toThrow();
  });
});

describe('settleCurrent', () => {
  it('settles the current milestone of a build', () => {
    const build: Build = {
      id: 'b1', company: 'Lumen Health', spec: 'MVP', founder: 'F', milestones, escrow, bond: money(2400),
      params: DEFAULT_PARAMS, state: 'in_review', currentMilestone: 1, createdAt: 0,
    };
    const s = settleCurrent(build, 90);
    expect(s.tranche.milestoneId).toBe('100-paying-users');
    expect(s.lockedAfter.amount).toBeCloseTo(4000, 5);
  });
});
