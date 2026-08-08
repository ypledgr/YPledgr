import { describe, expect, it } from 'vitest';
import { attest, DEFAULT_PARAMS, Ed25519Signer, money, type Build } from '@pledgr/core';
import { Arbiter, verdictMessage } from '../src/arbiter.js';

const agent = Ed25519Signer.generate();
const arbiterKey = Ed25519Signer.generate();

const build: Build = {
  id: 'build_0412',
  company: 'Lumen Health',
  spec: 'Ship the MVP: auth, billing, dashboard',
  founder: 'founder_key',
  agent: agent.publicKey,
  milestones: [
    { id: 'mvp-live', title: 'MVP live', proof: 'deploy', weight: 1 / 3, target: { url: 'https://lumen.health', p95Ms: 300 }, deadline: 2_000 },
    { id: '100-paying-users', proof: 'revenue', weight: 1 / 3, target: { payingCustomers: 100 } },
    { id: 'profitable', proof: 'ledger', weight: 1 / 3, target: { profitableMonths: 3 } },
  ],
  escrow: money(12_000),
  bond: money(2_400),
  params: DEFAULT_PARAMS,
  state: 'in_review',
  currentMilestone: 0,
  createdAt: 0,
};

const io = {
  probeUrl: async () => ({ status: 200, bodyHash: 'deadbeef', latencyMs: 120 }),
  readCiRun: async () => ({ passed: 48, total: 48, sha: 'abc1234' }),
  readRevenue: async () => ({ mrr: 4200, payingCustomers: 100 }),
  readLedger: async () => [{ month: '2027-01', netProfit: 100 }, { month: '2027-02', netProfit: 250 }, { month: '2027-03', netProfit: 900 }],
};

function arbiter(now = 1_000) {
  return new Arbiter({ signer: arbiterKey, io, now: () => now });
}

describe('Arbiter.judge', () => {
  it('passes the MVP milestone with a signed verdict and the right money', async () => {
    const atts = [
      attest({ type: 'deploy', buildId: build.id, milestoneId: 'mvp-live', payload: { url: 'https://lumen.health', buildHash: 'deadbeef' }, issuedAt: 900 }, agent),
      attest({ type: 'ci', buildId: build.id, milestoneId: 'mvp-live', payload: { provider: 'github', runId: '8821', passed: 48, total: 48, sha: 'abc1234' }, issuedAt: 900 }, agent),
      attest({ type: 'commits', buildId: build.id, milestoneId: 'mvp-live', payload: { from: 'aaaaaaa', to: 'bbbbbbb', count: 214, authorKey: agent.publicKey }, issuedAt: 900 }, agent),
      attest({ type: 'probe', buildId: build.id, milestoneId: 'mvp-live', payload: { url: 'https://lumen.health', p95Ms: 340, uptime: 0.999, windowMinutes: 60 }, issuedAt: 900 }, agent),
    ];
    const { verdict, scorecard, rejected } = await arbiter().judge(build, 'mvp-live', atts);
    expect(rejected).toEqual([]);
    expect(scorecard.score).toBe(97);
    expect(verdict.kind).toBe('pass');
    expect(verdict.released.amount).toBeCloseTo(4000, 5);
    expect(verdict.locked.amount).toBeCloseTo(8000, 5);
    expect(verdict.slashed.amount).toBe(0);
    expect(arbiterKey.verify(Buffer.from(verdictMessage(verdict)), verdict.signature)).toBe(true);
    expect(verdict.reasoning).toContain('Verdict PASS');
  });

  it('rejects attestations signed by someone other than the bonded agent', async () => {
    const stranger = Ed25519Signer.generate();
    const att = attest({ type: 'deploy', buildId: build.id, milestoneId: 'mvp-live', payload: { url: 'https://lumen.health', buildHash: 'deadbeef' }, issuedAt: 900 }, stranger);
    const { rejected, verdict } = await arbiter().judge(build, 'mvp-live', [att]);
    expect(rejected[0]?.reason).toMatch(/not the bonded agent/);
    expect(verdict.kind).toBe('fail');
    expect(verdict.slashed.amount).toBe(2400);
  });

  it('rejects a tampered attestation', async () => {
    const att = attest({ type: 'ci', buildId: build.id, milestoneId: 'mvp-live', payload: { provider: 'github', runId: '8821', passed: 40, total: 48, sha: 'abc1234' }, issuedAt: 900 }, agent);
    (att.payload as { passed: number }).passed = 48;
    const { rejected } = await arbiter().judge(build, 'mvp-live', [att]);
    expect(rejected[0]?.reason).toMatch(/hash/);
  });

  it('settles the revenue milestone pro rata when the oracle is short', async () => {
    const short = new Arbiter({ signer: arbiterKey, now: () => 1000, io: { ...io, readRevenue: async () => ({ mrr: 2000, payingCustomers: 60 }) } });
    const att = attest({ type: 'revenue', buildId: build.id, milestoneId: '100-paying-users', payload: { source: 'stripe', mrr: 2000, payingCustomers: 60, periodEnd: 999 }, issuedAt: 900 }, agent);
    const { verdict, scorecard } = await short.judge({ ...build, currentMilestone: 1 }, '100-paying-users', [att]);
    expect(scorecard.score).toBe(68);
    expect(verdict.kind).toBe('partial');
    expect(verdict.released.amount).toBeCloseTo(2720, 0);
  });

  it('unlocks the profitable milestone on three good months', async () => {
    const att = attest({ type: 'ledger', buildId: build.id, milestoneId: 'profitable', payload: { months: [] }, issuedAt: 900 }, agent);
    const { verdict } = await arbiter().judge({ ...build, currentMilestone: 2 }, 'profitable', [att]);
    expect(verdict.kind).toBe('pass');
    expect(verdict.locked.amount).toBeCloseTo(0, 5);
  });
});
