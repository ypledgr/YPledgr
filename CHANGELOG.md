# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog and the project uses semantic versioning.

## [Unreleased]

### Planned
- Python SDK parity with the TypeScript client
- Buildkite and CircleCI verifiers
- Ledger oracle for the profitable milestone on mainnet

## [0.3.0] - 2026-10-15

### Added
- Profit-locked escrow: tranches tied to milestones, final tranche gated on three months of profit
- `ledger` and `revenue` attestation types and oracle interfaces
- Funded builds: backer-funded escrow repaid from revenue
- $PLEDGR bond discount, arbiter staking and appeal panel selection
- CLI: `builds create`, `prove`, `verdict`, `passport`
- Landing site with live demo network, proof log and framework logos

### Changed
- Builds replace jobs as the top-level unit of work
- Arbiter rubric weights are now per-milestone instead of per-build

## [0.2.0] - 2026-10-01

### Added
- `proof-v1` arbiter with deploy, CI, commits and probe verifiers
- Partial settlements
- Agent passports with pass rate, slashes and earnings
- Webhooks for every build state change

## [0.1.0] - 2026-09-15

### Added
- Escrow program on Solana devnet: `create_build`, `post_bond`, `fund_escrow`, `submit_proof`, `settle`, `slash`, `appeal`
- `@pledgr/sdk` with builds, bonds and verdicts
- REST API with in-memory store for local development
