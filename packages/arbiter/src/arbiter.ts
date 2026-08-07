import {
  attestationHashMatches,
  computeTranches,
  money,
  settleMilestone,
  sha256Hex,
  type Attestation,
  type Build,
  type Signer,
  type Verdict,
} from '@pledgr/core';
import { compileRubric } from './rubric.js';
import { scoreChecks, type Scorecard, type VerifiedResult } from './score.js';
import { VERIFIERS, type VerifyContext, type Verifier } from './verifiers/index.js';
import { TemplateReasoner, type Reasoner } from './reasoner.js';

export interface ArbiterOptions {
  /** Signs verdicts. On devnet the API generates one; on mainnet it lives in an HSM. */
  signer: Signer;
  /** Override or add verifiers. Tests inject fakes here. */
  verifiers?: Partial<Record<string, Verifier>>;
  reasoner?: Reasoner;
  /** External readers for the verifiers. */
  io?: Pick<VerifyContext, 'probeUrl' | 'readCiRun' | 'readRevenue' | 'readLedger'>;
  now?: () => number;
}

export interface Judgement {
  verdict: Verdict;
  scorecard: Scorecard;
  rejected: Array<{ attestation: Attestation; reason: string }>;
}

export class AttestationRejected extends Error {}

/**
 * proof-v1. Verify every attestation, score the rubric, settle the tranche, sign the verdict.
 * Nothing here can move money on its own; the API submits the signed verdict to the program.
 */
export class Arbiter {
  public readonly id: string;
  private readonly verifiers: Partial<Record<string, Verifier>>;
  private readonly reasoner: Reasoner;
  private readonly now: () => number;

  constructor(private readonly opts: ArbiterOptions) {
    this.id = opts.signer.publicKey;
    this.verifiers = { ...VERIFIERS, ...opts.verifiers };
    this.reasoner = opts.reasoner ?? new TemplateReasoner();
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async judge(build: Build, milestoneId: string, attestations: Attestation[]): Promise<Judgement> {
    const index = build.milestones.findIndex((m) => m.id === milestoneId);
    if (index < 0) throw new Error(`Build ${build.id} has no milestone "${milestoneId}"`);
    const milestone = build.milestones[index]!;
    const now = this.now();

    const ctx: VerifyContext = { milestone, now, ...(build.agent ? { agentKey: build.agent } : {}), ...this.opts.io };

    const results: VerifiedResult[] = [];
    const rejected: Judgement['rejected'] = [];
    for (const att of attestations) {
      const reason = this.precheck(att, build, milestoneId);
      if (reason) { rejected.push({ attestation: att, reason }); continue; }
      const verifier = this.verifiers[att.type];
      if (!verifier) { rejected.push({ attestation: att, reason: `no verifier for ${att.type}` }); continue; }
      results.push(await verifier(att, ctx));
    }

    const checks = compileRubric(milestone);
    const scorecard = scoreChecks(checks, results, build.params, milestone, now);

    const tranches = computeTranches(build.escrow, build.milestones);
    const lockedBefore = tranches.slice(index).reduce((s, t) => s + t.amount.amount, 0);
    const settlement = settleMilestone({
      tranche: tranches[index]!.amount,
      bond: build.bond,
      score: scorecard.score,
      params: build.params,
      lockedBefore: money(lockedBefore, build.escrow.currency),
    });

    const reasoning = await this.reasoner.explain(build, milestone, scorecard);
    const reasoningHash = sha256Hex(reasoning);
    const message = `${build.id}:${milestoneId}:${scorecard.score}:${reasoningHash}`;
    const signature = this.opts.signer.sign(Buffer.from(message));

    const verdict: Verdict = {
      buildId: build.id,
      milestoneId,
      kind: settlement.kind,
      score: scorecard.score,
      released: settlement.released,
      slashed: settlement.slashed,
      locked: settlement.lockedAfter,
      reasoning,
      reasoningHash,
      signature,
      arbiter: this.id,
      issuedAt: now,
    };
    return { verdict, scorecard, rejected };
  }

  private precheck(att: Attestation, build: Build, milestoneId: string): string | null {
    if (att.buildId !== build.id) return 'attestation is for a different build';
    if (att.milestoneId !== milestoneId) return 'attestation is for a different milestone';
    if (!attestationHashMatches(att)) return 'hash does not match payload';
    if (build.agent && att.signer !== build.agent) return 'signed by a key that is not the bonded agent';
    if (att.issuedAt > this.now() + 300) return 'issued in the future';
    return null;
  }
}

/** Message the program verifies against the arbiter's signature. Kept here so the API and program tests agree. */
export function verdictMessage(v: Pick<Verdict, 'buildId' | 'milestoneId' | 'score' | 'reasoningHash'>): string {
  return `${v.buildId}:${v.milestoneId}:${v.score}:${v.reasoningHash}`;
}
