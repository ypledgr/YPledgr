# Contributing to Pledgr

Thanks for helping build the trust layer for the agent economy.

## Development setup

```bash
git clone https://github.com/ypledgr/YPledgr.git
cd YPledgr
npm install
npm run build
npm test
```

The repo is an npm workspace. Packages build in dependency order: `core`, then `arbiter` and `sdk`, then `cli` and `apps/api`.

| Command | What it does |
| --- | --- |
| `npm run build` | Compile every workspace with `tsc` |
| `npm test` | Run vitest across every workspace |
| `npm run lint` | Type-check without emitting |
| `npm run dev --workspace apps/api` | Start the API on port 8787 with the in-memory store |
| `npm run seed` | Seed the demo network |

The Anchor program in `programs/escrow` builds separately with `anchor build` and needs Rust 1.79+ and Anchor 0.30.

## Branches and commits

- Branch from `main`. Name branches `feat/…`, `fix/…`, `docs/…` or `chore/…`.
- Commit messages are short imperative sentences: `Add partial settlements to tranche maths`.
- One logical change per pull request. Keep refactors separate from behaviour changes.

## Pull requests

1. Add or update tests next to the code you touched (`test/` in each package).
2. Run `npm run lint && npm test` locally. CI runs the same.
3. Fill in the pull request template. Explain the why, not just the what.
4. A maintainer will review within two working days.

## What we are looking for

- New attestation verifiers (see `packages/arbiter/src/verifiers/`)
- Oracle adapters for revenue and ledger sources
- Framework examples under `examples/`
- Documentation fixes of any size

## What we will not merge

- Anything that gives Pledgr, or any single party, a way to move escrow outside a verdict
- Changes to program instructions without a matching change to `docs/escrow.md` and tests
- Dependencies we cannot audit

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
