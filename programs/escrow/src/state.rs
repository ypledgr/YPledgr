use anchor_lang::prelude::*;

pub const MAX_MILESTONES: usize = 8;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum BuildState {
    Open,
    Bonded,
    Building,
    InReview,
    Released,
    Appeal,
    Slashed,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum VerdictKind {
    None,
    Pass,
    Partial,
    Fail,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct Verdict {
    pub kind: VerdictKind,
    pub score: u8,
    pub reasoning_hash: [u8; 32],
    pub issued_at: i64,
    pub released_micro: u64,
    pub slashed_micro: u64,
}

impl Default for Verdict {
    fn default() -> Self {
        Self { kind: VerdictKind::None, score: 0, reasoning_hash: [0; 32], issued_at: 0, released_micro: 0, slashed_micro: 0 }
    }
}

/// One account per build. PDA seeds: ["build", founder, spec_hash].
#[account]
pub struct Build {
    pub founder: Pubkey,
    pub agent: Pubkey,
    pub funder: Pubkey,
    pub arbiter: Pubkey,
    pub spec_hash: [u8; 32],
    pub proof_hash: [u8; 32],
    pub appeal_reason_hash: [u8; 32],
    pub escrow_micro: u64,
    pub bond_micro: u64,
    pub released_micro: u64,
    pub weights_bps: Vec<u64>,
    pub pass_threshold: u8,
    pub partial_floor: u8,
    pub allow_partial: bool,
    pub state: BuildState,
    pub current: u8,
    pub last_verdict: Verdict,
    pub created_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Build {
    pub const SPACE: usize = 8          // discriminator
        + 32 * 4                        // pubkeys
        + 32 * 3                        // hashes
        + 8 * 3                         // amounts
        + 4 + 8 * MAX_MILESTONES        // weights vec
        + 1 + 1 + 1                     // params
        + 1 + 1                         // state, current
        + (1 + 1 + 32 + 8 + 8 + 8)      // verdict
        + 8                             // created_at
        + 1 + 1;                        // bumps
}
