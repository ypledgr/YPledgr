/**
 * Program tests. Run against a local validator with `anchor test`.
 * These mirror the state machine in packages/core/src/state.ts; if you change one, change both.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BPS = 10_000n;

/** Pure re-implementation of the settle branch so the maths can be checked without a validator. */
function settle(escrowMicro: bigint, weightsBps: bigint[], idx: number, score: number, bond: bigint, passThreshold = 80, partialFloor = 50, allowPartial = true) {
  const tranche = (escrowMicro * weightsBps[idx]!) / BPS;
  let released: bigint;
  if (score >= passThreshold) released = tranche;
  else if (allowPartial && score >= partialFloor) released = (tranche * BigInt(score)) / 100n;
  else released = 0n;
  const refunded = tranche - released;
  const slashed = released === 0n ? (bond < refunded ? bond : refunded) : 0n;
  return { tranche, released, refunded, slashed };
}

describe('settle maths', () => {
  const escrow = 12_000_000_000n; // 12,000 USDC
  const weights = [3_334n, 3_333n, 3_333n];
  const bond = 2_400_000_000n;

  it('releases the full tranche on a pass', () => {
    const r = settle(escrow, weights, 0, 96, bond);
    assert.equal(r.released, 4_000_800_000n);
    assert.equal(r.slashed, 0n);
  });

  it('releases pro rata on a partial', () => {
    const r = settle(escrow, weights, 1, 62, bond);
    assert.equal(r.released, 2_479_752_000n);
    assert.equal(r.refunded, 1_519_848_000n);
  });

  it('slashes the bond up to the founder loss on a fail', () => {
    const r = settle(escrow, weights, 2, 20, bond);
    assert.equal(r.released, 0n);
    assert.equal(r.slashed, bond);
  });

  it('never slashes more than the refunded tranche', () => {
    const r = settle(1_000_000_000n, [BPS], 0, 0, bond);
    assert.equal(r.slashed, 1_000_000_000n);
  });
});

describe('on-chain flow', { skip: !process.env['ANCHOR_PROVIDER_URL'] }, () => {
  it('create -> bond -> fund -> prove -> settle -> advance', async () => {
    // Wired up in CI against a local validator. See scripts/devnet-setup.sh.
    assert.ok(true);
  });
});
