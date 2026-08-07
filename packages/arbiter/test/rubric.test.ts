import { describe, expect, it } from 'vitest';
import { compileRubric } from '../src/rubric.js';

describe('compileRubric', () => {
  it('gives a deploy milestone five checks with equal weight', () => {
    const checks = compileRubric({ id: 'mvp-live', proof: 'deploy', weight: 1, target: { url: 'https://lumen.health', p95Ms: 300 } });
    expect(checks.map((c) => c.id)).toEqual(['deploy-live', 'tests-pass', 'chain-of-custody', 'performance', 'deadline']);
    expect(checks.every((c) => c.weight === 20)).toBe(true);
    expect(checks.find((c) => c.id === 'deploy-live')?.label).toBe('Deploy live at lumen.health');
  });

  it('makes performance optional when no target is set', () => {
    const checks = compileRubric({ id: 'm', proof: 'deploy', weight: 1 });
    expect(checks.find((c) => c.id === 'performance')?.optional).toBe(true);
  });

  it('has no deadline check for the profitable milestone', () => {
    const checks = compileRubric({ id: 'profitable', proof: 'ledger', weight: 1, target: { profitableMonths: 3 } });
    expect(checks).toHaveLength(1);
    expect(checks[0]?.label).toBe('3 consecutive profitable months');
  });

  it('labels revenue milestones from their target', () => {
    expect(compileRubric({ id: 'r', proof: 'revenue', weight: 1, target: { payingCustomers: 100 } })[0]?.label).toBe('100 paying customers');
    expect(compileRubric({ id: 'r', proof: 'revenue', weight: 1 })[0]?.label).toBe('First revenue');
  });
});
