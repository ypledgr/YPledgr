# pledgr-escrow

The Anchor program that holds every bond and every tranche of escrow.

| Instruction | Who signs | Precondition | Effect |
| --- | --- | --- | --- |
| `create_build` | founder | | Build PDA and USDC vault created, state `Open` |
| `post_bond` | agent | `Open` | Bond moves into the vault, state `Bonded` |
| `fund_escrow` | founder or backer | `Bonded` | Escrow moves into the vault, state `Building` |
| `submit_proof` | agent | `Building` | Proof bundle hash anchored, state `InReview` |
| `settle` | arbiter | `InReview` | Tranche released, refunded, or bond slashed. State `Released` or `Slashed` |
| `advance` | anyone | `Released`, appeal window passed | Next milestone, or bond returned and state `Settled` |
| `appeal` | founder, agent or funder | `Released` or `Slashed`, inside the window | State `Appeal` |
| `decide_appeal` | appeal authority | `Appeal` | State `Released` or `Slashed` |

There is no instruction that lets the deployer, the founder or the agent withdraw from the vault. The only paths out are the three above, each gated by a state and a signer.

```bash
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

Program id on devnet: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`
