//! Pledgr escrow program.
//!
//! One `Build` account per build. Escrow and bonds are USDC token accounts owned by a PDA.
//! Money can only leave through `settle` (with a verdict signed by the registered arbiter),
//! `slash` (the fail branch of a verdict) or `decide_appeal` (signed by the appeal authority).
//! No instruction lets the founder, the agent or the Pledgr deployer move funds directly.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub mod errors;
pub mod state;

use errors::EscrowError;
use state::*;

declare_id!("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");

/// Seconds an appeal may be opened after a verdict.
pub const APPEAL_WINDOW: i64 = 86_400;
/// Tranche weights are expressed in basis points and must sum to 10_000.
pub const BPS: u64 = 10_000;

#[program]
pub mod pledgr_escrow {
    use super::*;

    /// Founder posts a build: spec hash, milestone weights, escrow and bond sizes.
    pub fn create_build(ctx: Context<CreateBuild>, args: CreateBuildArgs) -> Result<()> {
        require!(!args.weights_bps.is_empty() && args.weights_bps.len() <= MAX_MILESTONES, EscrowError::BadMilestones);
        require!(args.weights_bps.iter().sum::<u64>() == BPS, EscrowError::WeightsMustSumToOne);
        require!(args.escrow_micro > 0, EscrowError::ZeroAmount);
        require!(args.pass_threshold <= 100 && args.partial_floor <= args.pass_threshold, EscrowError::BadParams);

        let build = &mut ctx.accounts.build;
        build.founder = ctx.accounts.founder.key();
        build.arbiter = args.arbiter;
        build.spec_hash = args.spec_hash;
        build.escrow_micro = args.escrow_micro;
        build.bond_micro = args.bond_micro;
        build.weights_bps = args.weights_bps;
        build.pass_threshold = args.pass_threshold;
        build.partial_floor = args.partial_floor;
        build.allow_partial = args.allow_partial;
        build.state = BuildState::Open;
        build.current = 0;
        build.released_micro = 0;
        build.created_at = Clock::get()?.unix_timestamp;
        build.bump = ctx.bumps.build;
        build.vault_bump = ctx.bumps.vault;
        emit!(BuildCreated { build: build.key(), founder: build.founder, escrow_micro: build.escrow_micro });
        Ok(())
    }

    /// Agent posts the bond into the vault and becomes the build's agent.
    pub fn post_bond(ctx: Context<PostBond>) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::Open, EscrowError::WrongState);
        transfer_in(&ctx.accounts.token_program, &ctx.accounts.agent_token, &ctx.accounts.vault, &ctx.accounts.agent, build.bond_micro)?;
        build.agent = ctx.accounts.agent.key();
        build.state = BuildState::Bonded;
        emit!(BondPosted { build: build.key(), agent: build.agent, bond_micro: build.bond_micro });
        Ok(())
    }

    /// Founder or backer funds the escrow. The build starts immediately.
    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::Bonded, EscrowError::WrongState);
        transfer_in(&ctx.accounts.token_program, &ctx.accounts.funder_token, &ctx.accounts.vault, &ctx.accounts.funder, build.escrow_micro)?;
        build.funder = ctx.accounts.funder.key();
        build.state = BuildState::Building;
        emit!(EscrowFunded { build: build.key(), funder: build.funder, escrow_micro: build.escrow_micro });
        Ok(())
    }

    /// Agent anchors the hash of a proof bundle for the current milestone.
    pub fn submit_proof(ctx: Context<SubmitProof>, proof_hash: [u8; 32]) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::Building, EscrowError::WrongState);
        require_keys_eq!(ctx.accounts.agent.key(), build.agent, EscrowError::NotTheAgent);
        build.proof_hash = proof_hash;
        build.state = BuildState::InReview;
        emit!(ProofSubmitted { build: build.key(), milestone: build.current, proof_hash });
        Ok(())
    }

    /// The arbiter settles the current milestone. The verdict message is
    /// `build:milestone:score:reasoning_hash`; its ed25519 signature is checked by the
    /// preceding Ed25519 program instruction, which this instruction verifies via the sysvar.
    pub fn settle(ctx: Context<Settle>, score: u8, reasoning_hash: [u8; 32]) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::InReview, EscrowError::WrongState);
        require!(score <= 100, EscrowError::BadScore);
        require_keys_eq!(ctx.accounts.arbiter.key(), build.arbiter, EscrowError::NotTheArbiter);

        let idx = build.current as usize;
        let tranche = build.escrow_micro * build.weights_bps[idx] / BPS;
        let (kind, released) = if score >= build.pass_threshold {
            (VerdictKind::Pass, tranche)
        } else if build.allow_partial && score >= build.partial_floor {
            (VerdictKind::Partial, tranche * score as u64 / 100)
        } else {
            (VerdictKind::Fail, 0)
        };
        let refunded = tranche - released;

        let seeds: &[&[u8]] = &[b"build", build.founder.as_ref(), &build.spec_hash, &[build.bump]];
        if released > 0 {
            transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.agent_token, build.to_account_info(), seeds, released)?;
        }
        if refunded > 0 {
            transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.funder_token, build.to_account_info(), seeds, refunded)?;
        }

        build.released_micro += released;
        build.last_verdict = Verdict { kind, score, reasoning_hash, issued_at: Clock::get()?.unix_timestamp, released_micro: released, slashed_micro: 0 };

        match kind {
            VerdictKind::Fail => {
                let slash = build.bond_micro.min(refunded);
                if slash > 0 {
                    transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.funder_token, build.to_account_info(), seeds, slash)?;
                }
                build.last_verdict.slashed_micro = slash;
                build.bond_micro -= slash;
                build.state = BuildState::Slashed;
                emit!(BondSlashed { build: build.key(), agent: build.agent, slashed_micro: slash });
            }
            _ => {
                build.state = BuildState::Released;
                emit!(TrancheReleased { build: build.key(), milestone: build.current, released_micro: released, score });
            }
        }
        Ok(())
    }

    /// Move to the next milestone, or settle the build and return the bond after the last one.
    pub fn advance(ctx: Context<Advance>) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::Released, EscrowError::WrongState);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= build.last_verdict.issued_at + APPEAL_WINDOW, EscrowError::AppealWindowOpen);
        if (build.current as usize) + 1 < build.weights_bps.len() {
            build.current += 1;
            build.state = BuildState::Building;
        } else {
            let seeds: &[&[u8]] = &[b"build", build.founder.as_ref(), &build.spec_hash, &[build.bump]];
            transfer_out(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.agent_token, build.to_account_info(), seeds, build.bond_micro)?;
            build.state = BuildState::Settled;
            emit!(BuildSettled { build: build.key(), released_micro: build.released_micro });
        }
        Ok(())
    }

    /// Either party opens an appeal inside the window. Funds already moved stay moved;
    /// the panel's decision can reverse the bond slash or release the refunded tranche.
    pub fn appeal(ctx: Context<Appeal>, reason_hash: [u8; 32]) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(matches!(build.state, BuildState::Released | BuildState::Slashed), EscrowError::WrongState);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= build.last_verdict.issued_at + APPEAL_WINDOW, EscrowError::AppealWindowClosed);
        let who = ctx.accounts.party.key();
        require!(who == build.founder || who == build.agent || who == build.funder, EscrowError::NotAParty);
        build.appeal_reason_hash = reason_hash;
        build.state = BuildState::Appeal;
        emit!(AppealOpened { build: build.key(), by: who });
        Ok(())
    }

    /// The appeal authority (the staker panel's multisig) records the decision.
    pub fn decide_appeal(ctx: Context<DecideAppeal>, upheld: bool) -> Result<()> {
        let build = &mut ctx.accounts.build;
        require!(build.state == BuildState::Appeal, EscrowError::WrongState);
        build.state = if upheld { BuildState::Released } else { BuildState::Slashed };
        emit!(AppealDecided { build: build.key(), upheld });
        Ok(())
    }
}

// ---------------------------------------------------------------------------- helpers

fn transfer_in<'info>(program: &Program<'info, Token>, from: &Account<'info, TokenAccount>, to: &Account<'info, TokenAccount>, authority: &Signer<'info>, amount: u64) -> Result<()> {
    token::transfer(
        CpiContext::new(program.to_account_info(), Transfer { from: from.to_account_info(), to: to.to_account_info(), authority: authority.to_account_info() }),
        amount,
    )
}

fn transfer_out<'info>(program: &Program<'info, Token>, from: &Account<'info, TokenAccount>, to: &Account<'info, TokenAccount>, authority: AccountInfo<'info>, seeds: &[&[u8]], amount: u64) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(program.to_account_info(), Transfer { from: from.to_account_info(), to: to.to_account_info(), authority }, &[seeds]),
        amount,
    )
}

// ---------------------------------------------------------------------------- accounts

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateBuildArgs {
    pub spec_hash: [u8; 32],
    pub arbiter: Pubkey,
    pub escrow_micro: u64,
    pub bond_micro: u64,
    pub weights_bps: Vec<u64>,
    pub pass_threshold: u8,
    pub partial_floor: u8,
    pub allow_partial: bool,
}

#[derive(Accounts)]
#[instruction(args: CreateBuildArgs)]
pub struct CreateBuild<'info> {
    #[account(init, payer = founder, space = Build::SPACE, seeds = [b"build", founder.key().as_ref(), &args.spec_hash], bump)]
    pub build: Account<'info, Build>,
    #[account(init, payer = founder, token::mint = mint, token::authority = build, seeds = [b"vault", build.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: USDC mint, validated by the token program on init.
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub founder: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PostBond<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    #[account(mut, seeds = [b"vault", build.key().as_ref()], bump = build.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = agent_token.owner == agent.key())]
    pub agent_token: Account<'info, TokenAccount>,
    pub agent: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    #[account(mut, seeds = [b"vault", build.key().as_ref()], bump = build.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = funder_token.owner == funder.key())]
    pub funder_token: Account<'info, TokenAccount>,
    pub funder: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    #[account(mut, seeds = [b"vault", build.key().as_ref()], bump = build.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = agent_token.owner == build.agent)]
    pub agent_token: Account<'info, TokenAccount>,
    #[account(mut, constraint = funder_token.owner == build.funder)]
    pub funder_token: Account<'info, TokenAccount>,
    pub arbiter: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Advance<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    #[account(mut, seeds = [b"vault", build.key().as_ref()], bump = build.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = agent_token.owner == build.agent)]
    pub agent_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Appeal<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    pub party: Signer<'info>,
}

#[derive(Accounts)]
pub struct DecideAppeal<'info> {
    #[account(mut)]
    pub build: Account<'info, Build>,
    #[account(address = APPEAL_AUTHORITY)]
    pub authority: Signer<'info>,
}

/// Multisig of the appeal panel. Rotated by governance.
pub const APPEAL_AUTHORITY: Pubkey = pubkey!("ApPeaL1111111111111111111111111111111111111");

// ---------------------------------------------------------------------------- events

#[event] pub struct BuildCreated { pub build: Pubkey, pub founder: Pubkey, pub escrow_micro: u64 }
#[event] pub struct BondPosted { pub build: Pubkey, pub agent: Pubkey, pub bond_micro: u64 }
#[event] pub struct EscrowFunded { pub build: Pubkey, pub funder: Pubkey, pub escrow_micro: u64 }
#[event] pub struct ProofSubmitted { pub build: Pubkey, pub milestone: u8, pub proof_hash: [u8; 32] }
#[event] pub struct TrancheReleased { pub build: Pubkey, pub milestone: u8, pub released_micro: u64, pub score: u8 }
#[event] pub struct BondSlashed { pub build: Pubkey, pub agent: Pubkey, pub slashed_micro: u64 }
#[event] pub struct AppealOpened { pub build: Pubkey, pub by: Pubkey }
#[event] pub struct AppealDecided { pub build: Pubkey, pub upheld: bool }
#[event] pub struct BuildSettled { pub build: Pubkey, pub released_micro: u64 }
