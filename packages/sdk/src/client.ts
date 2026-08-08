import { attest, parseMoney, type Attestation, type Signer, type Verdict } from '@pledgr/core';
import { Http, type FetchLike } from './http.js';
import type { BuildView, CreateBuildInput, PassportView, ProveInput } from './types.js';

export interface PledgrOptions {
  apiKey?: string;
  network?: 'devnet' | 'mainnet' | 'local';
  /** Overrides the network's default base URL. */
  baseUrl?: string;
  fetch?: FetchLike;
}

const BASE: Record<NonNullable<PledgrOptions['network']>, string> = {
  devnet: 'https://api.devnet.pledgr.si/v1',
  mainnet: 'https://api.pledgr.si/v1',
  local: 'http://127.0.0.1:8787/v1',
};

/** The Pledgr client. One instance per API key; create agents from it with `pledgr.agent(...)`. */
export class Pledgr {
  private readonly http: Http;

  constructor(opts: PledgrOptions = {}) {
    const baseUrl = opts.baseUrl ?? BASE[opts.network ?? 'devnet'];
    this.http = new Http({ baseUrl, ...(opts.apiKey ? { apiKey: opts.apiKey } : {}), ...(opts.fetch ? { fetch: opts.fetch } : {}) });
  }

  readonly builds = {
    create: async (input: CreateBuildInput): Promise<BuildView> => {
      const escrow = parseMoney(input.escrow);
      const bond = input.bond ? parseMoney(input.bond) : { amount: escrow.amount * 0.2, currency: escrow.currency };
      return this.http.request<BuildView>('POST', '/builds', { ...input, escrow, bond });
    },
    get: (id: string) => this.http.request<BuildView>('GET', `/builds/${encodeURIComponent(id)}`),
    list: (q: { state?: string; company?: string; limit?: number } = {}) => this.http.request<BuildView[]>('GET', `/builds${query(q)}`),
    verdicts: (id: string) => this.http.request<Verdict[]>('GET', `/builds/${encodeURIComponent(id)}/verdicts`),
    appeal: (id: string, milestoneId: string, reason: string) => this.http.request<{ appealId: string; panelSize: number; decideBy: number }>('POST', `/builds/${encodeURIComponent(id)}/appeal`, { milestoneId, reason }),
    fund: (id: string) => this.http.request<BuildView>('POST', `/builds/${encodeURIComponent(id)}/fund`),
  };

  readonly passports = {
    get: (handle: string) => this.http.request<PassportView>('GET', `/agents/${encodeURIComponent(handle)}/passport`),
  };

  readonly webhooks = {
    register: (url: string, events: string[] = ['*']) => this.http.request<{ id: string; secret: string }>('POST', '/webhooks', { url, events }),
    remove: (id: string) => this.http.request<void>('DELETE', `/webhooks/${encodeURIComponent(id)}`),
  };

  /** An agent handle bound to a signer. The signer never leaves the process; only signatures are sent. */
  agent(opts: { handle: string; signer: Signer }): Agent {
    return new Agent(this.http, opts.handle, opts.signer);
  }
}

export class Agent {
  constructor(private readonly http: Http, public readonly handle: string, private readonly signer: Signer) {}

  get publicKey(): string {
    return this.signer.publicKey;
  }

  bond(amount: string): Promise<{ bond: { amount: number; currency: string }; tx: string }> {
    return this.http.request('POST', '/agents/bond', { handle: this.handle, publicKey: this.publicKey, amount: parseMoney(amount) });
  }

  take(buildId: string): Promise<BuildView> {
    return this.http.request('POST', `/builds/${encodeURIComponent(buildId)}/take`, { handle: this.handle, publicKey: this.publicKey });
  }

  /** Turn a ProveInput into signed attestations and submit them. Returns the verdict once the arbiter has run. */
  async prove(buildId: string, milestoneId: string, input: ProveInput): Promise<Verdict> {
    const attestations = this.attestations(buildId, milestoneId, input);
    return this.http.request<Verdict>('POST', `/builds/${encodeURIComponent(buildId)}/proofs`, { milestoneId, attestations });
  }

  /** Build the attestations without sending them. Useful for inspection and tests. */
  attestations(buildId: string, milestoneId: string, input: ProveInput): Attestation[] {
    const out: Attestation[] = [];
    const base = { buildId, milestoneId };
    if (input.deploy) out.push(attest({ ...base, type: 'deploy', payload: { url: input.deploy.url, buildHash: input.deploy.buildHash ?? '' } }, this.signer));
    if (input.ci) out.push(attest({ ...base, type: 'ci', payload: { provider: input.ci.provider, runId: input.ci.runId, passed: input.ci.passed ?? 0, total: input.ci.total ?? 0, sha: input.ci.sha ?? '' } }, this.signer));
    if (input.commits) out.push(attest({ ...base, type: 'commits', payload: { ...input.commits, authorKey: this.publicKey } }, this.signer));
    if (input.probe) out.push(attest({ ...base, type: 'probe', payload: { windowMinutes: 60, ...input.probe } }, this.signer));
    if (input.revenue) out.push(attest({ ...base, type: 'revenue', payload: { source: input.revenue.source, mrr: 0, payingCustomers: 0, periodEnd: 0 } }, this.signer));
    if (input.ledger) out.push(attest({ ...base, type: 'ledger', payload: { months: [] } }, this.signer));
    return out;
  }

  passport(): Promise<PassportView> {
    return this.http.request('GET', `/agents/${encodeURIComponent(this.handle)}/passport`);
  }
}

function query(q: Record<string, string | number | undefined>): string {
  const parts = Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
