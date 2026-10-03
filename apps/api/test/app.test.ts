import { describe, expect, it } from 'vitest';
import { Ed25519Signer, attest } from '@pledgr/core';
import { verifyWebhook } from '@pledgr/sdk';
import { App } from '../src/app.js';

const io = {
  probeUrl: async () => ({ status: 200, bodyHash: 'deadbeef', latencyMs: 90 }),
  readCiRun: async () => ({ passed: 48, total: 48, sha: 'abc1234' }),
  readRevenue: async () => ({ mrr: 5000, payingCustomers: 120 }),
  readLedger: async () => [{ month: '1', netProfit: 1 }, { month: '2', netProfit: 1 }, { month: '3', netProfit: 1 }],
};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return { method: 'POST', path, query: {}, body, headers };
}
function get(path: string) {
  return { method: 'GET', path, query: {}, body: undefined, headers: {} };
}

describe('API', () => {
  it('runs a build from creation to settlement with webhooks', async () => {
    const delivered: Array<{ body: string; sig: string }> = [];
    let t = 1_000;
    const app = new App({ io, now: () => t, deliver: async (_url, body, headers) => { delivered.push({ body, sig: headers['pledgr-signature']! }); } });
    const agent = Ed25519Signer.generate();

    const wh = await app.handle(post('/v1/webhooks', { url: 'https://example.test/hook' }));
    expect(wh.status).toBe(201);
    const secret = (wh.body as { secret: string }).secret;

    const created = await app.handle(post('/v1/builds', {
      company: 'Lumen Health', spec: 'MVP', escrow: '12000 USDC',
      milestones: [
        { id: 'mvp-live', proof: 'deploy', weight: 0.5, target: { url: 'https://lumen.health' } },
        { id: 'profitable', proof: 'ledger', weight: 0.5, target: { profitableMonths: 3 } },
      ],
    }));
    expect(created.status).toBe(201);
    const build = created.body as { id: string; bond: { amount: number } };
    expect(build.bond.amount).toBe(2400);

    expect((await app.handle(post('/v1/builds/' + build.id + '/take', { handle: 'forge-1', publicKey: agent.publicKey }))).status).toBe(400);
    await app.handle(post('/v1/agents/bond', { handle: 'forge-1', publicKey: agent.publicKey, amount: '2400 USDC' }));
    expect((await app.handle(post('/v1/builds/' + build.id + '/take', { handle: 'forge-1', publicKey: agent.publicKey }))).status).toBe(200);
    expect((await app.handle(post('/v1/builds/' + build.id + '/fund', {}))).status).toBe(200);

    const atts = [
      attest({ type: 'deploy', buildId: build.id, milestoneId: 'mvp-live', payload: { url: 'https://lumen.health', buildHash: 'deadbeef' }, issuedAt: t }, agent),
      attest({ type: 'ci', buildId: build.id, milestoneId: 'mvp-live', payload: { provider: 'github', runId: '1', passed: 48, total: 48, sha: 'abc1234' }, issuedAt: t }, agent),
    ];
    const v1 = await app.handle(post('/v1/builds/' + build.id + '/proofs', { milestoneId: 'mvp-live', attestations: atts }));
    expect(v1.status).toBe(200);
    expect((v1.body as { kind: string; released: { amount: number } }).kind).toBe('pass');
    expect((v1.body as { released: { amount: number } }).released.amount).toBe(6000);

    const mid = await app.handle(get('/v1/builds/' + build.id));
    expect((mid.body as { state: string; tranches: Array<{ status: string }> }).state).toBe('building');
    expect((mid.body as { tranches: Array<{ status: string }> }).tranches.map((x) => x.status)).toEqual(['released', 'locked']);

    t += 100;
    const v2 = await app.handle(post('/v1/builds/' + build.id + '/proofs', { milestoneId: 'profitable', attestations: [attest({ type: 'ledger', buildId: build.id, milestoneId: 'profitable', payload: { months: [] }, issuedAt: t }, agent)] }));
    expect((v2.body as { kind: string }).kind).toBe('pass');
    expect(((await app.handle(get('/v1/builds/' + build.id))).body as { state: string }).state).toBe('settled');

    const passport = (await app.handle(get('/v1/agents/forge-1/passport'))).body as { builds: number; passRate: number; earned: { amount: number }; toProfitable: number };
    expect(passport.builds).toBe(1);
    expect(passport.passRate).toBe(100);
    expect(passport.earned.amount).toBe(12_000);
    expect(passport.toProfitable).toBe(1);

    const types = delivered.map((d) => JSON.parse(d.body).type);
    expect(types).toContain('tranche.released');
    expect(types[types.length - 1]).toBe('build.settled');
    expect(() => verifyWebhook(delivered[0]!.body, delivered[0]!.sig, secret, 300, t)).not.toThrow();
  });

  it('refuses proofs for the wrong milestone and enforces the appeal window', async () => {
    let t = 1_000;
    const app = new App({ io, now: () => t });
    const agent = Ed25519Signer.generate();
    const build = (await app.handle(post('/v1/builds', { company: 'X', spec: 'Y', escrow: '1000 USDC', milestones: [{ id: 'a', proof: 'deploy', weight: 0.5, target: { p95Ms: 300 } }, { id: 'b', proof: 'ledger', weight: 0.5 }] }))).body as { id: string };
    await app.handle(post('/v1/agents/bond', { handle: 'a1', publicKey: agent.publicKey, amount: '200 USDC' }));
    await app.handle(post('/v1/builds/' + build.id + '/take', { handle: 'a1', publicKey: agent.publicKey }));
    await app.handle(post('/v1/builds/' + build.id + '/fund', {}));

    const wrong = await app.handle(post('/v1/builds/' + build.id + '/proofs', { milestoneId: 'b', attestations: [] }));
    expect(wrong.status).toBe(409);

    const fail = await app.handle(post('/v1/builds/' + build.id + '/proofs', { milestoneId: 'a', attestations: [] }));
    expect((fail.body as { kind: string; slashed: { amount: number } }).kind).toBe('fail');
    expect((fail.body as { slashed: { amount: number } }).slashed.amount).toBe(200);

    t += 90_000;
    const late = await app.handle(post('/v1/builds/' + build.id + '/appeal', { milestoneId: 'a', reason: 'the deploy was up' }));
    expect(late.status).toBe(409);
    expect((late.body as { code: string }).code).toBe('appeal_window_closed');
  });

  it('requires an API key when keys are configured', async () => {
    const app = new App({ apiKeys: new Set(['sk_live_1']) });
    expect((await app.handle(get('/v1/health'))).status).toBe(401);
    expect((await app.handle({ ...get('/v1/health'), headers: { authorization: 'Bearer sk_live_1' } })).status).toBe(200);
  });
});
