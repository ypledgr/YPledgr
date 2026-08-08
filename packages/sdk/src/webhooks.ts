import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookEvent {
  id: string;
  type:
    | 'build.created'
    | 'build.bonded'
    | 'build.funded'
    | 'build.started'
    | 'proof.submitted'
    | 'verdict.issued'
    | 'tranche.released'
    | 'bond.slashed'
    | 'appeal.opened'
    | 'appeal.decided'
    | 'build.settled';
  buildId: string;
  at: number;
  data: Record<string, unknown>;
}

/**
 * Verify a webhook delivery. The API signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the
 * secret returned when the webhook was registered, and sends it in `pledgr-signature` as `t=…,v1=…`.
 * Deliveries older than `toleranceSeconds` are rejected to stop replays.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string, secret: string, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000)): WebhookEvent {
  const parts = Object.fromEntries(signatureHeader.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts['t']);
  const v1 = parts['v1'];
  if (!Number.isFinite(t) || !v1) throw new Error('Malformed signature header');
  if (Math.abs(now - t) > toleranceSeconds) throw new Error('Webhook timestamp outside tolerance');
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Webhook signature mismatch');
  return JSON.parse(rawBody) as WebhookEvent;
}

/** Used by the API and by tests to produce the header. */
export function signWebhook(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}
