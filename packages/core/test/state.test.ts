import { describe, expect, it } from 'vitest';
import { canTransition, eventsFrom, InvalidTransition, transition, FUND_MOVING_STATES } from '../src/state.js';

describe('escrow state machine', () => {
  it('walks the happy path', () => {
    let s = transition('open', 'post_bond');
    s = transition(s, 'fund_escrow');
    s = transition(s, 'start');
    s = transition(s, 'submit_proof');
    s = transition(s, 'verdict_pass');
    expect(s).toBe('released');
    s = transition(s, 'next_milestone');
    expect(s).toBe('building');
  });

  it('refuses to release money from building', () => {
    expect(canTransition('building', 'verdict_pass')).toBe(false);
    expect(() => transition('building', 'verdict_pass')).toThrow(InvalidTransition);
  });

  it('routes appeals back to a terminal outcome', () => {
    expect(transition('in_review', 'appeal')).toBe('appeal');
    expect(transition('appeal', 'appeal_upheld')).toBe('released');
    expect(transition('appeal', 'appeal_overturned')).toBe('slashed');
  });

  it('is terminal once settled', () => {
    expect(eventsFrom('settled')).toEqual([]);
  });

  it('only moves funds in the expected states', () => {
    expect([...FUND_MOVING_STATES].sort()).toEqual(['released', 'settled', 'slashed']);
  });
});
