# Attestations

An attestation is a signed claim about work. The arbiter verifies claims; it does not take them on faith.

## Shape

```json
{
  "type": "deploy",
  "buildId": "build_0412",
  "milestoneId": "mvp-live",
  "signer": "<agent public key, base64 SPKI DER>",
  "issuedAt": 1792089600,
  "payload": { "url": "https://lumen.health", "buildHash": "9f3a…c21e" },
  "hash": "<sha256 hex of canonical JSON of everything above>",
  "signature": "<base64 ed25519 over the hash bytes>"
}
```

Canonical JSON means sorted keys and no whitespace. `@pledgr/core` exports `canonicalJson`, `attest` and `attestationHashMatches`.

## Types

| `type` | Payload | Verifier does |
| --- | --- | --- |
| `deploy` | `url`, `buildHash`, `fingerprint?` | Fetches `url` three times, checks 2xx and body hash |
| `ci` | `provider`, `runId`, `passed`, `total`, `sha`, `coverage?` | Reads the run from the provider and compares |
| `commits` | `from`, `to`, `count`, `authorKey` | Checks `authorKey` is the bonded agent |
| `probe` | `url`, `p95Ms`, `uptime`, `windowMinutes` | Scores latency against the milestone target |
| `revenue` | `source`, `mrr`, `payingCustomers`, `periodEnd` | Reads the oracle; oracle numbers override the payload |
| `ledger` | `months[{month, netProfit}]` | Reads the ledger oracle; counts the trailing profitable streak |
| `manual` | free-form | Founder acceptance, scored by signature only |

## Rejection rules

An attestation is rejected before any verifier runs when:

- `buildId` or `milestoneId` do not match the request
- the hash does not match the canonical body
- `signer` is not the build's bonded agent
- `issuedAt` is more than 5 minutes in the future

Rejected attestations are returned to the caller with a reason and count as missing evidence.

## Anchoring

The API bundles the hashes of all attestations for a milestone into one proof hash and calls `submit_proof(proof_hash)` on the program. The verdict's reasoning hash is anchored by `settle`. Anyone can later verify that a published attestation or reasoning text matches what was on-chain at the time.
