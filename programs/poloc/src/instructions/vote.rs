
// programs/poloc_anchor/src/instructions/vote.rs
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
        seeds = [b"stake", challenge.key().as_ref(), challenger.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, Stake>,
    
    #[account(
        init,
        payer = challenger,
        space = Vote::MAX_SIZE,
        seeds = [b"vote", challenge.key().as_ref(), challenger.key().as_ref()],
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
    
    // Validate challenge is active and past deadline (voting phase)
    require!(challenge.status == ChallengeStatus::Active, PolocError::ChallengeNotActive);
    require!(clock.unix_timestamp > challenge.deadline, PolocError::ChallengeExpired);
    require!(clock.unix_timestamp <= challenge.deadline + 300, PolocError::ChallengeExpired); // 5min voting window
    
    // Validate challenger is staked and not slashed
    require!(!stake_account.slashed, PolocError::Unauthorized);
    
    // Validate vote parameters
    require!(uncertainty <= 50_000, PolocError::InvalidParameters); // Max 50km uncertainty
    require!(min_rtt > 0 && min_rtt <= 1_000_000, PolocError::InvalidParameters); // Max 1s RTT
    
    // Initialize vote account
    vote_account.challenger = ctx.accounts.challenger.key();
    vote_account.challenge_id = challenge_id;
    vote_account.challenger_id = challenger_id;
    vote_account.is_valid = is_valid;
    vote_account.uncertainty = uncertainty;
    vote_account.min_rtt = min_rtt;
    vote_account.timestamp = clock.unix_timestamp;
    vote_account.processed = false;
    vote_account.bump = *ctx.bumps.get("vote_account").unwrap();
    
    // Update challenge vote counts
    challenge.vote_count = challenge.vote_count
        .checked_add(1)
        .ok_or(PolocError::ArithmeticOverflow)?;
    
    if is_valid {
        challenge.valid_vote_count = challenge.valid_vote_count
            .checked_add(1)
            .ok_or(PolocError::ArithmeticOverflow)?;
    }
    
    msg!("Vote submitted by {} for challenge {}: valid={}, uncertainty={}m, rtt={}μs",
         ctx.accounts.challenger.key(), challenge_id, is_valid, uncertainty, min_rtt);
    
    Ok(())
}
