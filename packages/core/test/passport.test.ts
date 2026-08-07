import { describe, expect, it } from 'vitest';
import { buildPassport, requiredBond } from '../src/passport.js';
import { money } from '../src/money.js';
import type { Verdict } from '../src/types.js';

function v(kind: Verdict['kind'], score: number, released: number, slashed = 0, at = 1, buildId = 'b'): Verdict {
  return { buildId, milestoneId: 'm', kind, score, released: money(released), slashed: money(slashed), locked: money(0), reasoning: '', reasoningHash: '', signature: '', arbiter: 'a', issuedAt: at };
}

describe('passport', () => {
  it('derives counts, pass rate and earnings from verdicts', () => {
    const p = buildPassport('forge-1', 'pk', 0, [v('pass', 96, 4000, 0, 3, 'b1'), v('partial', 62, 2480, 0, 2, 'b2'), v('fail', 31, 0, 2400, 1, 'b3')]);
    expect(p.builds).toBe(3);
    expect(p.passRate).toBe(66.7);
    expect(p.slashes).toBe(1);
    expect(p.earned.amount).toBe(6480);
    expect(p.recentScores).toEqual([96, 62, 31]);
    expect(p.standing).toBe('watch');
  });

  it('suspends after three recent fails', () => {
    const p = buildPassport('x', 'pk', 0, [v('fail', 0, 0, 1, 3), v('fail', 0, 0, 1, 2), v('fail', 0, 0, 1, 1)]);
    expect(p.standing).toBe('suspended');
  });

  it('discounts bonds for a long good record and raises them on watch', () => {
    const good = { ...buildPassport('g', 'pk', 0, []), standing: 'good' as const, builds: 86, passRate: 96.4 };
    expect(requiredBond(money(12_000), good).amount).toBe(1800);
    const watch = { ...good, standing: 'watch' as const };
    expect(requiredBond(money(12_000), watch).amount).toBe(3600);
    expect(requiredBond(money(12_000)).amount).toBe(2400);
  });
});
