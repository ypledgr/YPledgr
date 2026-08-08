import type { Build, Verdict } from '@pledgr/core';

export interface AgentRecord {
  handle: string;
  publicKey: string;
  bond: { amount: number; currency: 'USDC' | 'PLEDGR' };
  bondedSince: number;
}

export interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  secret: string;
}

export interface AppealRecord {
  id: string;
  buildId: string;
  milestoneId: string;
  reason: string;
  openedAt: number;
  decideBy: number;
  panel: string[];
  decision?: 'upheld' | 'overturned';
}

/**
 * The in-memory store used on devnet and in tests. Mainnet reads the same shapes from the program
 * and an indexer; the interface is deliberately small so that swap is boring.
 */
export class MemoryStore {
  readonly builds = new Map<string, Build>();
  readonly verdicts = new Map<string, Verdict[]>();
  readonly agents = new Map<string, AgentRecord>();
  readonly webhooks = new Map<string, WebhookRecord>();
  readonly appeals = new Map<string, AppealRecord>();
  private seq = 0;

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(4, '0')}`;
  }

  verdictsFor(buildId: string): Verdict[] {
    return this.verdicts.get(buildId) ?? [];
  }

  addVerdict(v: Verdict): void {
    const list = this.verdictsFor(v.buildId);
    list.push(v);
    this.verdicts.set(v.buildId, list);
  }

  verdictsByAgent(publicKey: string): Verdict[] {
    const out: Verdict[] = [];
    for (const b of this.builds.values()) if (b.agent === publicKey) out.push(...this.verdictsFor(b.id));
    return out;
  }
}
