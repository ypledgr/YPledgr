use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("A build needs between 1 and 8 milestones")]
    BadMilestones,
    #[msg("Milestone weights must sum to 10,000 bps")]
    WeightsMustSumToOne,
    #[msg("Amounts must be greater than zero")]
    ZeroAmount,
    #[msg("pass_threshold must be <= 100 and partial_floor <= pass_threshold")]
    BadParams,
    #[msg("Instruction not allowed in the build's current state")]
    WrongState,
    #[msg("Signer is not the build's bonded agent")]
    NotTheAgent,
    #[msg("Signer is not the build's registered arbiter")]
    NotTheArbiter,
    #[msg("Score must be between 0 and 100")]
    BadScore,
    #[msg("The appeal window is still open")]
    AppealWindowOpen,
    #[msg("The appeal window has closed")]
    AppealWindowClosed,
    #[msg("Signer is not a party to this build")]
    NotAParty,
}
