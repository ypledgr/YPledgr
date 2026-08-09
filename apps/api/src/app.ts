import { randomBytes } from 'node:crypto';
import {
  buildPassport,
  computeTranches,
  DEFAULT_PARAMS,
  Ed25519Signer,
  parseMoney,
  requiredBond,
  transition,
  type Attestation,
  type Build,
  type Milestone,
  type Verdict,
} from '@pledgr/core';
import { Arbiter, type ArbiterOptions } from '@pledgr/arbiter';
import { signWebhook } from '@pledgr/sdk';
import { MemoryStore } from './store.js';

export interface Req {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}
export interface Res {
  status: number;
  body?: unknown;
}

export interface AppOptions {
  store?: MemoryStore;
  arbiter?: Arbiter;
  io?: ArbiterOptions['io'];
  apiKeys?: Set<string>;
  now?: () => number;
  deliver?: (url: string, body: string, headers: Record<string, string>) => Promise<void>;
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Framework-free request handler. `server.ts` wraps it in node:http; tests call it directly. */
export class App {
  readonly store: MemoryStore;
  readonly arbiter: Arbiter;
  private readonly now: () => number;
  private readonly apiKeys?: Set<string>;
  private readonly deliver: NonNullable<AppOptions['deliver']>;

  constructor(opts: AppOptions = {}) {
    this.store = opts.store ?? new MemoryStore();
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.arbiter = opts.arbiter ?? new Arbiter({ signer: Ed25519Signer.generate(), now: this.now, ...(opts.io ? { io: opts.io } : {}) });
    if (opts.apiKeys) this.apiKeys = opts.apiKeys;
    this.deliver = opts.deliver ?? (async () => {});
  }

  async handle(req: Req): Promise<Res> {
    try {
      this.auth(req);
      const r = await this.route(req);
      return r;
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { code: e.code, message: e.message } };
      const msg = (e as Error).message ?? 'error';
      if (/Cannot apply/.test(msg)) return { status: 409, body: { code: 'wrong_state', message: msg } };
      return { status: 400, body: { code: 'invalid_request', message: msg } };
    }
  }

  private auth(req: Req): void {
    if (!this.apiKeys) return;
    const h = req.headers['authorization'] ?? '';
    const key = h.replace(/^Bearer\s+/i, '');
    if (!this.apiKeys.has(key)) throw new HttpError(401, 'unauthorized', 'Missing or invalid API key');
  }

  private async route(req: Req): Promise<Res> {
    const p = req.path.replace(/^\/v1/, '').replace(/\/+$/, '') || '/';
    const m = req.method;
    const seg = p.split('/').filter(Boolean);

    if (m === 'GET' && p === '/health') return { status: 200, body: { ok: true, network: 'devnet', arbiter: this.arbiter.id } };

    if (m === 'POST' && p === '/builds') return { status: 201, body: this.view(this.createBuild(req.body as Record<string, unknown>)) };
    if (m === 'GET' && p === '/builds') {
      const list = [...this.store.builds.values()].filter((b) => (!req.query['state'] || b.state === req.query['state']) && (!req.query['company'] || b.company === req.query['company']));
      return { status: 200, body: list.slice(0, Number(req.query['limit'] ?? 50)).map((b) => this.view(b)) };
    }
    if (seg[0] === 'builds' && seg[1]) {
      const build = this.store.builds.get(seg[1]);
      if (!build) throw new HttpError(404, 'not_found', `No build ${seg[1]}`);
      if (m === 'GET' && !seg[2]) return { status: 200, body: this.view(build) };
      if (m === 'GET' && seg[2] === 'verdicts') return { status: 200, body: this.store.verdictsFor(build.id) };
      if (m === 'POST' && seg[2] === 'take') return { status: 200, body: this.view(this.take(build, req.body as { handle: string; publicKey: string })) };
      if (m === 'POST' && seg[2] === 'fund') { build.state = transition(build.state, 'fund_escrow'); build.state = transition(build.state, 'start'); await this.emit('build.funded', build, {}); return { status: 200, body: this.view(build) }; }
      if (m === 'POST' && seg[2] === 'proofs') return { status: 200, body: await this.prove(build, req.body as { milestoneId: string; attestations: Attestation[] }) };
      if (m === 'POST' && seg[2] === 'appeal') return { status: 201, body: this.appeal(build, req.body as { milestoneId: string; reason: string }) };
    }

    if (m === 'POST' && p === '/agents/bond') return { status: 200, body: this.bond(req.body as { handle: string; publicKey: string; amount: string | { amount: number; currency: 'USDC' | 'PLEDGR' } }) };
    if (m === 'GET' && seg[0] === 'agents' && seg[1] && seg[2] === 'passport') return { status: 200, body: this.passport(seg[1]) };

    if (m === 'POST' && p === '/webhooks') {
      const { url, events } = req.body as { url: string; events?: string[] };
      if (!url) throw new HttpError(400, 'invalid_request', 'url is required');
      const id = this.store.nextId('wh');
      const secret = `whsec_${randomBytes(16).toString('hex')}`;
      this.store.webhooks.set(id, { id, url, events: events ?? ['*'], secret });
      return { status: 201, body: { id, secret } };
    }
    if (m === 'DELETE' && seg[0] === 'webhooks' && seg[1]) { this.store.webhooks.delete(seg[1]); return { status: 204 }; }

    throw new HttpError(404, 'not_found', `No route ${m} ${p}`);
  }

  // ------------------------------------------------------------------ handlers

  private createBuild(body: Record<string, unknown>): Build {
    const company = str(body['company'], 'company');
    const spec = str(body['spec'], 'spec');
    const milestones = body['milestones'] as Milestone[];
    if (!Array.isArray(milestones) || milestones.length === 0) throw new HttpError(400, 'invalid_request', 'milestones must be a non-empty array');
    const escrow = parseMoney(body['escrow'] as string);
    const bond = body['bond'] ? parseMoney(body['bond'] as string) : requiredBond(escrow);
    computeTranches(escrow, milestones); // validates weights
    const build: Build = {
      id: this.store.nextId('build'),
      company,
      spec,
      founder: str(body['founder'] ?? 'founder', 'founder'),
      ...(body['backer'] ? { backer: String(body['backer']) } : {}),
      milestones,
      escrow,
      bond,
      params: { ...DEFAULT_PARAMS, ...((body['params'] as Partial<Build['params']>) ?? {}) },
      state: 'open',
      currentMilestone: 0,
      createdAt: this.now(),
    };
    this.store.builds.set(build.id, build);
    void this.emit('build.created', build, {});
    return build;
  }

  private take(build: Build, body: { handle: string; publicKey: string }): Build {
    const agent = this.store.agents.get(body.handle);
    if (!agent) throw new HttpError(400, 'insufficient_bond', `Agent ${body.handle} has no bond`);
    if (agent.publicKey !== body.publicKey) throw new HttpError(401, 'unauthorized', 'Key does not match the bonded agent');
    if (agent.bond.amount < build.bond.amount) throw new HttpError(400, 'insufficient_bond', `Build needs a ${build.bond.amount} ${build.bond.currency} bond, agent has ${agent.bond.amount}`);
    build.state = transition(build.state, 'post_bond');
    build.agent = agent.publicKey;
    void this.emit('build.bonded', build, { handle: body.handle });
    return build;
  }

  private bond(body: { handle: string; publicKey: string; amount: string | { amount: number; currency: 'USDC' | 'PLEDGR' } }): { bond: { amount: number; currency: string }; tx: string } {
    const amount = parseMoney(body.amount);
    const existing = this.store.agents.get(body.handle);
    const rec = existing ?? { handle: body.handle, publicKey: body.publicKey, bond: { amount: 0, currency: amount.currency }, bondedSince: this.now() };
    if (rec.publicKey !== body.publicKey) throw new HttpError(401, 'unauthorized', 'Handle is bound to a different key');
    rec.bond = { amount: rec.bond.amount + amount.amount, currency: amount.currency };
    this.store.agents.set(body.handle, rec);
    return { bond: rec.bond, tx: fakeTx() };
  }

  private async prove(build: Build, body: { milestoneId: string; attestations: Attestation[] }): Promise<Verdict> {
    if (!Array.isArray(body.attestations)) throw new HttpError(400, 'invalid_request', 'attestations must be an array');
    const index = build.milestones.findIndex((m) => m.id === body.milestoneId);
    if (index !== build.currentMilestone) throw new HttpError(409, 'wrong_state', `Current milestone is ${build.milestones[build.currentMilestone]?.id}`);
    build.state = transition(build.state, 'submit_proof');
    await this.emit('proof.submitted', build, { milestoneId: body.milestoneId, count: body.attestations.length });

    const { verdict } = await this.arbiter.judge(build, body.milestoneId, body.attestations);
    this.store.addVerdict(verdict);
    await this.emit('verdict.issued', build, { milestoneId: body.milestoneId, kind: verdict.kind, score: verdict.score });

    if (verdict.kind === 'fail') {
      build.state = transition(build.state, 'verdict_fail');
      await this.emit('bond.slashed', build, { amount: verdict.slashed });
    } else {
      build.state = transition(build.state, verdict.kind === 'pass' ? 'verdict_pass' : 'verdict_partial');
      await this.emit('tranche.released', build, { amount: verdict.released });
      if (index === build.milestones.length - 1) {
        build.state = transition(build.state, 'complete');
        await this.emit('build.settled', build, {});
      } else {
        build.currentMilestone = index + 1;
        build.state = transition(build.state, 'next_milestone');
      }
    }
    return verdict;
  }

  private appeal(build: Build, body: { milestoneId: string; reason: string }): { appealId: string; panelSize: number; decideBy: number } {
    const verdict = this.store.verdictsFor(build.id).find((v) => v.milestoneId === body.milestoneId);
    if (!verdict) throw new HttpError(404, 'not_found', 'No verdict to appeal');
    if (this.now() > verdict.issuedAt + build.params.appealWindow) throw new HttpError(409, 'appeal_window_closed', 'The appeal window has closed');
    const id = this.store.nextId('appeal');
    const rec = { id, buildId: build.id, milestoneId: body.milestoneId, reason: body.reason ?? '', openedAt: this.now(), decideBy: this.now() + 86_400, panel: pickPanel(3) };
    this.store.appeals.set(id, rec);
    build.state = transition(build.state, 'appeal');
    void this.emit('appeal.opened', build, { appealId: id });
    return { appealId: id, panelSize: rec.panel.length, decideBy: rec.decideBy };
  }

  private passport(handle: string) {
    const agent = this.store.agents.get(handle);
    if (!agent) throw new HttpError(404, 'not_found', `No agent ${handle}`);
    const verdicts = this.store.verdictsByAgent(agent.publicKey);
    const toProfitable = [...this.store.builds.values()].filter((b) => b.agent === agent.publicKey && b.state === 'settled').length;
    return { ...buildPassport(handle, agent.publicKey, agent.bondedSince, verdicts, toProfitable), bond: agent.bond };
  }

  private view(build: Build) {
    const verdicts = this.store.verdictsFor(build.id);
    const tranches = computeTranches(build.escrow, build.milestones).map((t, i) => {
      const v = verdicts.find((x) => x.milestoneId === t.milestoneId);
      const status = v ? (v.kind === 'fail' ? 'refunded' : 'released') : i === build.currentMilestone && build.state === 'in_review' ? 'in_review' : 'locked';
      return { milestoneId: t.milestoneId, amount: t.amount, status };
    });
    const last = verdicts[verdicts.length - 1];
    return { ...build, tranches, verdicts, ...(last ? { appealUntil: last.issuedAt + build.params.appealWindow } : {}) };
  }

  private async emit(type: string, build: Build, data: Record<string, unknown>): Promise<void> {
    const body = JSON.stringify({ id: this.store.nextId('evt'), type, buildId: build.id, at: this.now(), data });
    for (const wh of this.store.webhooks.values()) {
      if (!wh.events.includes('*') && !wh.events.includes(type)) continue;
      const header = signWebhook(body, wh.secret, this.now());
      try { await this.deliver(wh.url, body, { 'content-type': 'application/json', 'pledgr-signature': header }); } catch { /* retried by the queue on mainnet */ }
    }
  }
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, 'invalid_request', `${name} is required`);
  return v;
}
function fakeTx(): string {
  return randomBytes(32).toString('base64url').slice(0, 44);
}
function pickPanel(n: number): string[] {
  return Array.from({ length: n }, () => `staker_${randomBytes(3).toString('hex')}`);
}
