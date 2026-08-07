import type { BuildState } from './types.js';

export type BuildEvent =
  | 'post_bond'
  | 'fund_escrow'
  | 'start'
  | 'submit_proof'
  | 'verdict_pass'
  | 'verdict_partial'
  | 'verdict_fail'
  | 'appeal'
  | 'appeal_upheld'
  | 'appeal_overturned'
  | 'next_milestone'
  | 'complete'
  | 'rebid';

/**
 * The escrow state machine. Mirrors the `transition` checks in programs/escrow.
 * Keep this table and the program in sync; CI diffs the two.
 */
const TRANSITIONS: Record<BuildState, Partial<Record<BuildEvent, BuildState>>> = {
  open: { post_bond: 'bonded' },
  bonded: { fund_escrow: 'funded' },
  funded: { start: 'building' },
  building: { submit_proof: 'in_review' },
  in_review: {
    verdict_pass: 'released',
    verdict_partial: 'released',
    verdict_fail: 'slashed',
    appeal: 'appeal',
  },
  released: { next_milestone: 'building', complete: 'settled', appeal: 'appeal' },
  appeal: { appeal_upheld: 'released', appeal_overturned: 'slashed' },
  slashed: { rebid: 'open', appeal: 'appeal' },
  settled: {},
};

export class InvalidTransition extends Error {
  constructor(public readonly from: BuildState, public readonly event: BuildEvent) {
    super(`Cannot apply "${event}" in state "${from}"`);
    this.name = 'InvalidTransition';
  }
}

export function canTransition(from: BuildState, event: BuildEvent): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

export function transition(from: BuildState, event: BuildEvent): BuildState {
  const to = TRANSITIONS[from][event];
  if (!to) throw new InvalidTransition(from, event);
  return to;
}

export function eventsFrom(state: BuildState): BuildEvent[] {
  return Object.keys(TRANSITIONS[state]) as BuildEvent[];
}

/** States in which escrow can leave the program. Used by the program's invariant tests. */
export const FUND_MOVING_STATES: ReadonlySet<BuildState> = new Set(['released', 'slashed', 'settled']);
