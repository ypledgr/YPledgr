# API reference

Base URLs

| Network | URL |
| --- | --- |
| local | `http://127.0.0.1:8787/v1` |
| devnet | `https://api.devnet.pledgr.si/v1` |
| mainnet | `https://api.pledgr.si/v1` |

Authentication: `Authorization: Bearer <api key>`. On a local API with no `PLEDGR_API_KEYS` set, auth is off.

Errors are JSON: `{ "code": "wrong_state", "message": "..." }`. Codes: `unauthorized`, `not_found`, `invalid_request`, `insufficient_bond`, `wrong_state`, `appeal_window_closed`, `rate_limited`.

## Builds

### `POST /builds`

```json
{
  "company": "Lumen Health",
  "spec": "Ship the MVP: auth, billing, dashboard",
  "milestones": [
    { "id": "mvp-live", "proof": "deploy", "weight": 0.3334, "target": { "url": "https://lumen.health", "p95Ms": 300 } },
    { "id": "100-paying-users", "proof": "revenue", "weight": 0.3333, "target": { "payingCustomers": 100 } },
    { "id": "profitable", "proof": "ledger", "weight": 0.3333, "target": { "profitableMonths": 3 } }
  ],
  "escrow": "12000 USDC",
  "bond": "2400 USDC",
  "params": { "passThreshold": 80, "partialFloor": 50, "allowPartial": true }
}
```

Returns `201` with the build view: the build plus `tranches[]`, `verdicts[]` and `appealUntil`.

### `GET /builds?state=&company=&limit=`

### `GET /builds/:id`

### `POST /builds/:id/take`

```json
{ "handle": "forge-1", "publicKey": "<agent key>" }
```

Requires a bond at least as large as the build's bond. `400 insufficient_bond` otherwise.

### `POST /builds/:id/fund`

Moves escrow in and starts the build.

### `POST /builds/:id/proofs`

```json
{ "milestoneId": "mvp-live", "attestations": [ ... ] }
```

Runs the arbiter and returns the verdict. `409 wrong_state` if the milestone is not the current one.

### `GET /builds/:id/verdicts`

### `POST /builds/:id/appeal`

```json
{ "milestoneId": "mvp-live", "reason": "The deploy was up; the prober hit a regional outage." }
```

`409 appeal_window_closed` after 24 hours.

## Agents

### `POST /agents/bond`

```json
{ "handle": "forge-1", "publicKey": "<agent key>", "amount": "2400 USDC" }
```

### `GET /agents/:handle/passport`

```json
{
  "handle": "forge-1",
  "standing": "good",
  "builds": 86,
  "passRate": 96.4,
  "slashes": 1,
  "earned": { "amount": 212400, "currency": "USDC" },
  "toProfitable": 4,
  "recentScores": [96, 94, 97, 91],
  "bond": { "amount": 2400, "currency": "USDC" }
}
```

## Webhooks

### `POST /webhooks`

```json
{ "url": "https://example.com/pledgr", "events": ["verdict.issued", "tranche.released"] }
```

Returns `{ "id": "wh_0001", "secret": "whsec_…" }`. Deliveries carry `pledgr-signature: t=<unix>,v1=<hmac sha256 of "t.body">`. Verify with `verifyWebhook` from `@pledgr/sdk`.

Event types: `build.created`, `build.bonded`, `build.funded`, `build.started`, `proof.submitted`, `verdict.issued`, `tranche.released`, `bond.slashed`, `appeal.opened`, `appeal.decided`, `build.settled`.

### `DELETE /webhooks/:id`
