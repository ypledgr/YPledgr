import { describe, expect, it } from 'vitest';
import { attestationHashMatches, Ed25519Signer } from '@pledgr/core';
import { Pledgr } from '../src/client.js';
import { PledgrError } from '../src/errors.js';
import type { FetchLike } from '../src/http.js';

function fakeFetch(handler: (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => { status: number; body?: unknown }): { fetch: FetchLike; calls: Array<{ url: string; init?: { method?: string; body?: string; headers?: Record<string, string> } }> } {
  const calls: Array<{ url: string; init?: { method?: string; body?: string; headers?: Record<string, string> } }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const r = handler(url, init);
    const text = r.body === undefined ? '' : JSON.stringify(r.body);
    return { status: r.status, json: async () => r.body, text: async () => text };
  };
  return { fetch, calls };
}

describe('Pledgr client', () => {
  it('creates a build with a default 20% bond and bearer auth', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { id: 'build_1' } }));
    const p = new Pledgr({ apiKey: 'sk_test', network: 'local', fetch: f.fetch });
    const b = await p.builds.create({ company: 'Lumen Health', spec: 'MVP', escrow: '12000 USDC', milestones: [{ id: 'mvp-live', proof: 'deploy', weight: 1 }] });
    expect(b.id).toBe('build_1');
    const call = f.calls[0]!;
    expect(call.url).toBe('http://127.0.0.1:8787/v1/builds');
    expect(call.init?.headers?.['authorization']).toBe('Bearer sk_test');
    const sent = JSON.parse(call.init!.body!);
    expect(sent.bond).toEqual({ amount: 2400, currency: 'USDC' });
  });

  it('turns API errors into PledgrError with a code', async () => {
    const f = fakeFetch(() => ({ status: 409, body: { code: 'wrong_state', message: 'Build is not in review' } }));
    const p = new Pledgr({ network: 'local', fetch: f.fetch });
    await expect(p.builds.fund('build_1')).rejects.toMatchObject({ name: 'PledgrError', code: 'wrong_state', status: 409 });
  });

  it('retries once on a 503 then succeeds', async () => {
    let n = 0;
    const f = fakeFetch(() => (n++ === 0 ? { status: 503, body: { message: 'try again' } } : { status: 200, body: [] }));
    const p = new Pledgr({ network: 'local', fetch: f.fetch });
    await expect(p.builds.list()).resolves.toEqual([]);
    expect(f.calls).toHaveLength(2);
  });

  it('signs attestations with the agent key and never sends the key', async () => {
    const signer = Ed25519Signer.generate();
    const f = fakeFetch(() => ({ status: 200, body: { kind: 'pass', score: 96 } }));
    const p = new Pledgr({ network: 'local', fetch: f.fetch });
    const agent = p.agent({ handle: 'forge-1', signer });
    const verdict = await agent.prove('build_1', 'mvp-live', { deploy: { url: 'https://lumen.health', buildHash: 'abc' }, ci: { provider: 'github', runId: '8821', passed: 48, total: 48, sha: 'abc1234' } });
    expect(verdict.kind).toBe('pass');
    const sent = JSON.parse(f.calls[0]!.init!.body!);
    expect(sent.attestations).toHaveLength(2);
    expect(sent.attestations.every((a: any) => attestationHashMatches(a))).toBe(true);
    expect(sent.attestations[0].signer).toBe(signer.publicKey);
    expect(JSON.stringify(sent)).not.toContain('PRIVATE');
  });

  it('throws a network error when fetch keeps failing', async () => {
    const fetch: FetchLike = async () => { throw new Error('ECONNREFUSED'); };
    const p = new Pledgr({ network: 'local', fetch });
    await expect(p.builds.get('x')).rejects.toBeInstanceOf(PledgrError);
  });
});
