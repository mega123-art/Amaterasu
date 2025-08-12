use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String, challenger_id: String)]
pub struct SubmitVote<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(
        seeds = [b"stake", challenge_id.as_bytes(), challenger.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, Stake>,
    
    #[account(
        init,
        payer = challenger,
        space = 8 + Vote::MAX_SIZE,
        seeds = [b"vote", challenge_id.as_bytes(), challenger.key().as_ref()],
        bump
    )]
    pub vote_account: Account<'info, Vote>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitVote>,
    challenge_id: String,
    challenger_id: String,
    is_valid: bool,
    uncertainty: u32,
    min_rtt: u32,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let vote_account = &mut ctx.accounts.vote_account;
    let stake_account = &ctx.accounts.stake_account;
    let clock = Clock::get()?;

    // Challenge must be active
    require!(
        challenge.status == ChallengeStatus::Active,
        PolocError::ChallengeNotActive
    );

    // Voting window: must be after deadline, but within 5 minutes
    if clock.unix_timestamp <= challenge.deadline {
        return err!(PolocError::VotingNotOpen);
    }
    if clock.unix_timestamp > challenge.deadline + 300 {
        return err!(PolocError::VotingClosed);
    }

    // Challenger must have an active stake and not be slashed
    require!(!stake_account.slashed, PolocError::StakeSlashed);

    // Validate parameters
    require!(uncertainty <= 50_000, PolocError::InvalidParameters); // Max 50 km
    require!(min_rtt > 0 && min_rtt <= 1_000_000, PolocError::InvalidParameters); // ≤ 1s RTT

    // Initialize vote account
    vote_account.challenger = ctx.accounts.challenger.key();
    vote_account.challenge_id = challenge_id.clone();
    vote_account.challenger_id = challenger_id;
    vote_account.is_valid = is_valid;
    vote_account.uncertainty = uncertainty;
    vote_account.min_rtt = min_rtt;
    vote_account.timestamp = clock.unix_timestamp;
    vote_account.processed = false;
    vote_account.bump = ctx.bumps.vote_account;

    // Update challenge vote counts
    challenge.vote_count = challenge.vote_count
        .checked_add(1)
        .ok_or(PolocError::ArithmeticOverflow)?;
    if is_valid {
        challenge.valid_vote_count = challenge.valid_vote_count
            .checked_add(1)
            .ok_or(PolocError::ArithmeticOverflow)?;
    }

    msg!(
        "Vote submitted by {} for challenge {}: valid={}, uncertainty={}m, rtt={}μs",
        ctx.accounts.challenger.key(),
        challenge_id,
        is_valid,
        uncertainty,
        min_rtt
    );

    Ok(())
}
