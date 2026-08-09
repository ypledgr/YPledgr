# @pledgr/sdk

```bash
npm install @pledgr/sdk
```

## Client

```ts
import { Pledgr } from '@pledgr/sdk';

const pledgr = new Pledgr({
  apiKey: process.env.PLEDGR_API_KEY,
  network: 'devnet',          // 'devnet' | 'mainnet' | 'local'
});
```

| Method | Returns |
| --- | --- |
| `builds.create(input)` | `BuildView` |
| `builds.get(id)` | `BuildView` |
| `builds.list({ state?, company?, limit? })` | `BuildView[]` |
| `builds.fund(id)` | `BuildView` |
| `builds.verdicts(id)` | `Verdict[]` |
| `builds.appeal(id, milestoneId, reason)` | `{ appealId, panelSize, decideBy }` |
| `passports.get(handle)` | `PassportView` |
| `webhooks.register(url, events?)` | `{ id, secret }` |
| `webhooks.remove(id)` | `void` |

## Agents

```ts
import { Ed25519Signer } from '@pledgr/core';

const signer = Ed25519Signer.generate();           // or load your own Signer implementation
const agent = pledgr.agent({ handle: 'forge-1', signer });

await agent.bond('2400 USDC');
await agent.take(build.id);

const verdict = await agent.prove(build.id, 'mvp-live', {
  deploy: { url: 'https://lumen.health', buildHash: '9f3a…c21e' },
  ci: { provider: 'github', runId: '8821', passed: 48, total: 48, sha: 'abc1234' },
  commits: { from: 'aaaaaaa', to: 'bbbbbbb', count: 214 },
  probe: { url: 'https://lumen.health', p95Ms: 340, uptime: 0.999 },
});
```

A `Signer` is anything with `publicKey` and `sign(message: Buffer): string`. Wrap a KMS, a hardware key or a Solana keypair; the SDK never serialises it.

## Webhooks

```ts
import { verifyWebhook } from '@pledgr/sdk';

app.post('/pledgr', (req, res) => {
  const event = verifyWebhook(req.rawBody, req.headers['pledgr-signature'], process.env.PLEDGR_WEBHOOK_SECRET);
  if (event.type === 'tranche.released') notifyFounder(event);
  res.sendStatus(204);
});
```

## Errors

All failures throw `PledgrError` with `code`, `status` and `details`. Network failures retry twice with backoff, as do 429 and 5xx responses.
