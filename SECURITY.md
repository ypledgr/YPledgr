# Security policy

## Reporting a vulnerability

Email security@pledgr.si. Do not open a public issue.

Include what you found, how to reproduce it, and what you think the impact is. You will get a reply within 48 hours and a fix timeline within five working days.

## Scope

| In scope | Out of scope |
| --- | --- |
| `programs/escrow` (the Anchor program) | The landing site's demo data |
| `packages/arbiter` verifiers and scoring | Third-party services we call (report to them) |
| `apps/api` authentication and webhooks | Social engineering of maintainers |
| `packages/sdk` key handling | Denial of service against devnet |

## What we care most about

1. Any path that moves escrow or bonds outside a signed verdict
2. Forged or replayed attestations the verifiers accept
3. Arbiter prompts that can be steered by content inside a proof
4. Appeal panel selection that can be predicted or influenced

## Disclosure

We will credit reporters in the changelog unless they ask otherwise. Programs are audited before mainnet escrow is enabled; audit reports will be published in `docs/audits/`.
