import { describe, expect, it } from 'vitest';
import { scoreChecks } from '../src/score.js';
import type { Check } from '../src/rubric.js';

const params = { passThreshold: 80, partialFloor: 50, allowPartial: true };
const checks: Check[] = [
  { id: 'a', label: 'A', source: 'deploy', weight: 20 },
  { id: 'b', label: 'B', source: 'ci', weight: 20 },
  { id: 'c', label: 'C', source: 'commits', weight: 20, optional: true },
  { id: 'd', label: 'D', source: 'probe', weight: 20 },
  { id: 'e', label: 'E', source: 'chain', weight: 20 },
];

describe('scoreChecks', () => {
  it('scores 96 for the demo build', () => {
    const card = scoreChecks(checks, [
      { source: 'deploy', score: 1, ok: true, note: 'live' },
      { source: 'ci', score: 1, ok: true, note: '48/48' },
      { source: 'commits', score: 1, ok: true, note: 'signed' },
      { source: 'probe', score: 0.8, ok: true, note: '340ms' },
    ], params, { id: 'm', proof: 'deploy', weight: 1, deadline: 2000 }, 1000);
    expect(card.score).toBe(96);
    expect(card.kind).toBe('pass');
  });

  it('treats missing required evidence as zero and optional evidence as full', () => {
    const card = scoreChecks(checks, [], params, { id: 'm', proof: 'deploy', weight: 1 }, 1000);
    expect(card.checks.find((c) => c.id === 'c')?.points).toBe(20);
    expect(card.checks.find((c) => c.id === 'a')?.points).toBe(0);
    expect(card.score).toBe(40);
    expect(card.kind).toBe('fail');
  });

  it('fails the deadline check when late', () => {
    const card = scoreChecks(checks, [], params, { id: 'm', proof: 'deploy', weight: 1, deadline: 500 }, 1000);
    expect(card.checks.find((c) => c.id === 'e')?.points).toBe(0);
  });

  it('returns partial between the floor and the threshold', () => {
    const card = scoreChecks(checks, [
      { source: 'deploy', score: 1, ok: true, note: '' },
      { source: 'ci', score: 0.5, ok: false, note: '' },
    ], params, { id: 'm', proof: 'deploy', weight: 1 }, 1000);
    expect(card.score).toBe(70);
    expect(card.kind).toBe('partial');
  });
});
