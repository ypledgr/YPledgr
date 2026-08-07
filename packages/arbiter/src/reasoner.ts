import type { Build, Milestone } from '@pledgr/core';
import type { Scorecard } from './score.js';

/** Writes the human-readable reasoning. The rubric decides the money; the reasoner only explains it. */
export interface Reasoner {
  explain(build: Build, milestone: Milestone, card: Scorecard): Promise<string>;
}

/** Deterministic reasoning from the scorecard. Used on devnet and as the fallback everywhere. */
export class TemplateReasoner implements Reasoner {
  async explain(build: Build, milestone: Milestone, card: Scorecard): Promise<string> {
    const lines = card.checks.map((c) => `${c.score >= 0.999 ? 'PASS' : c.score > 0 ? 'PART' : 'FAIL'}  ${c.label}: ${c.note} (${c.points}/${c.maxPoints})`);
    const head = `Build ${build.id} for ${build.company}, milestone "${milestone.title ?? milestone.id}". Verdict ${card.kind.toUpperCase()} with score ${card.score}/100.`;
    return [head, ...lines].join('\n');
  }
}

export interface AnthropicReasonerOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Asks Claude to write the reasoning in plain language, grounded only in the scorecard.
 * The model never sees raw attestations and cannot change the score. If the SDK is not installed
 * or the call fails, falls back to the template.
 */
export class AnthropicReasoner implements Reasoner {
  private readonly fallback = new TemplateReasoner();
  constructor(private readonly opts: AnthropicReasonerOptions = {}) {}

  async explain(build: Build, milestone: Milestone, card: Scorecard): Promise<string> {
    const base = await this.fallback.explain(build, milestone, card);
    const apiKey = this.opts.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return base;
    try {
      const modName = '@anthropic-ai/sdk';
      const mod: any = await import(modName);
      const client = new mod.default({ apiKey });
      const res = await client.messages.create({
        model: this.opts.model ?? process.env['ARBITER_MODEL'] ?? 'claude-opus-5-5',
        max_tokens: this.opts.maxTokens ?? 400,
        system: 'You are the Pledgr arbiter writing the reasoning for a verdict. You are given a scorecard that has already been computed. Explain it to the founder and the agent in plain language, in at most 120 words. Do not change any number. Do not invent evidence. Do not use emojis.',
        messages: [{ role: 'user', content: base }],
      });
      const text = res?.content?.find((c: any) => c.type === 'text')?.text;
      return typeof text === 'string' && text.trim() ? `${text.trim()}\n\n---\n${base}` : base;
    } catch {
      return base;
    }
  }
}
