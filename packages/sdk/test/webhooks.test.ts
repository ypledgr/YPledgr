import { describe, expect, it } from 'vitest';
import { signWebhook, verifyWebhook } from '../src/webhooks.js';

const body = JSON.stringify({ id: 'evt_1', type: 'tranche.released', buildId: 'build_0412', at: 1000, data: { amount: 4000 } });

describe('webhooks', () => {
  it('accepts a correctly signed delivery', () => {
    const header = signWebhook(body, 'whsec_test', 1000);
    const evt = verifyWebhook(body, header, 'whsec_test', 300, 1010);
    expect(evt.type).toBe('tranche.released');
  });

  it('rejects a wrong secret', () => {
    const header = signWebhook(body, 'whsec_other', 1000);
    expect(() => verifyWebhook(body, header, 'whsec_test', 300, 1010)).toThrow(/mismatch/);
  });

  it('rejects stale deliveries', () => {
    const header = signWebhook(body, 'whsec_test', 1000);
    expect(() => verifyWebhook(body, header, 'whsec_test', 300, 5000)).toThrow(/tolerance/);
  });

  it('rejects a tampered body', () => {
    const header = signWebhook(body, 'whsec_test', 1000);
    expect(() => verifyWebhook(body.replace('4000', '9000'), header, 'whsec_test', 300, 1010)).toThrow(/mismatch/);
  });
});
