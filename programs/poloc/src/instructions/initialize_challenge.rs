use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct InitializeChallenge<'info> {
    #[account(
        init,
        payer = waldo,
        space = Challenge::MAX_SIZE,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(mut)]
    pub waldo: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeChallenge>,
    challenge_id: String,
    claimed_lat: i32,
    claimed_lon: i32,
    duration: u64,
    reward_pool: u64,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let clock = Clock::get()?;
    
    // Validate parameters
    require!(duration > 0 && duration <= 86400, PolocError::InvalidParameters); // Max 24 hours
    require!(reward_pool > 0, PolocError::InvalidParameters);
    require!(claimed_lat.abs() <= 90_000_000, PolocError::InvalidParameters); // Valid latitude
    require!(claimed_lon.abs() <= 180_000_000, PolocError::InvalidParameters); // Valid longitude
    
    // Initialize state fields
    challenge.challenge_id = challenge_id.clone();
    challenge.waldo = ctx.accounts.waldo.key();
    challenge.claimed_lat = claimed_lat;
    challenge.claimed_lon = claimed_lon;
    challenge.start_time = clock.unix_timestamp;
    challenge.deadline = clock.unix_timestamp + duration as i64;
    // reward_pool field is set below after funds are transferred
    challenge.status = ChallengeStatus::Active;
    challenge.participant_count = 0;
    challenge.vote_count = 0;
    challenge.valid_vote_count = 0;
    challenge.r_star = 0;
    challenge.r_star_threshold = 1000; // 1km default threshold
    challenge.rewards_distributed = false;
    challenge.bump = ctx.bumps.challenge;

    // Transfer the initial reward_pool lamports from waldo -> challenge PDA
    // This ensures the PDA actually holds the funds.
    if reward_pool > 0 {
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.waldo.to_account_info(),
            to: challenge.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        anchor_lang::system_program::transfer(cpi_ctx, reward_pool)?;
        // Update the on-chain accounting to match the actual lamports in the PDA
        challenge.reward_pool = reward_pool;
    } else {
        challenge.reward_pool = 0;
    }

    msg!("Challenge {} initialized by {}", challenge.challenge_id, challenge.waldo);
    msg!("Location: ({}, {})", claimed_lat, claimed_lon);
    msg!("Deadline: {}", challenge.deadline);
    
    Ok(())
}
