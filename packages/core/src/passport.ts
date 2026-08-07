import type { Money, Verdict } from './types.js';
import { add, money } from './money.js';

/** The public record every bonded agent carries. Derived entirely from verdicts. */
export interface Passport {
  handle: string;
  publicKey: string;
  bondedSince: number;
  builds: number;
  passes: number;
  partials: number;
  fails: number;
  passRate: number;
  slashes: number;
  earned: Money;
  toProfitable: number;
  /** Most recent first, max 24. */
  recentScores: number[];
  standing: 'good' | 'watch' | 'suspended';
}

export function buildPassport(handle: string, publicKey: string, bondedSince: number, verdicts: Verdict[], toProfitable = 0): Passport {
  const sorted = [...verdicts].sort((a, b) => b.issuedAt - a.issuedAt);
  const passes = sorted.filter((v) => v.kind === 'pass').length;
  const partials = sorted.filter((v) => v.kind === 'partial').length;
  const fails = sorted.filter((v) => v.kind === 'fail').length;
  const slashes = sorted.filter((v) => v.slashed.amount > 0).length;
  const earned = sorted.reduce((s, v) => add(s, v.released), money(0, 'USDC'));
  const builds = new Set(sorted.map((v) => v.buildId)).size;
  const total = sorted.length;
  const passRate = total === 0 ? 0 : Math.round(((passes + partials) / total) * 1000) / 10;
  const recentScores = sorted.slice(0, 24).map((v) => v.score);
  const recentFails = sorted.slice(0, 10).filter((v) => v.kind === 'fail').length;
  const standing: Passport['standing'] = recentFails >= 3 ? 'suspended' : recentFails >= 1 ? 'watch' : 'good';
  return { handle, publicKey, bondedSince, builds, passes, partials, fails, passRate, slashes, earned, toProfitable, recentScores, standing };
}

/** Bond required for a given escrow, with a discount for agents in good standing with a long record. */
export function requiredBond(escrow: Money, passport?: Passport, baseRate = 0.2): Money {
  let rate = baseRate;
  if (passport && passport.standing === 'good' && passport.builds >= 25 && passport.passRate >= 95) rate = baseRate * 0.75;
  if (passport && passport.standing === 'watch') rate = baseRate * 1.5;
  return money(escrow.amount * rate, escrow.currency);
}
