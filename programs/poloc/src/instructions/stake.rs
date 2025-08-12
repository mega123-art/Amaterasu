use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct StakeCtx<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(
        init,
        payer = challenger,
        space = 8 + Stake::MAX_SIZE,
        seeds = [b"stake", challenge_id.as_bytes(), challenger.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, Stake>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<StakeCtx>,
    challenge_id: String,
    amount: u64,
) -> Result<()> {
    let stake_account = &mut ctx.accounts.stake_account;
    let clock = Clock::get()?;

    // Validate challenge is active
    require!(ctx.accounts.challenge.status == ChallengeStatus::Active, PolocError::ChallengeNotActive);
    require!(clock.unix_timestamp <= ctx.accounts.challenge.deadline, PolocError::ChallengeExpired);

    // Validate stake amount (minimum 0.001 SOL)
    require!(amount >= 1_000_000, PolocError::InsufficientStake);

    // Check maximum participants (20 max)
    require!(ctx.accounts.challenge.participant_count < 20, PolocError::MaxParticipantsReached);

    // Transfer stake amount to challenge PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.challenge.to_account_info(),
            }
        ),
        amount,
    )?;

    // Now take a mutable reference after the transfer
    let challenge = &mut ctx.accounts.challenge;

    // --- Ensure on-chain accounting matches actual lamports in the PDA ---
    challenge.reward_pool = challenge.reward_pool
        .checked_add(amount)
        .ok_or(PolocError::ArithmeticOverflow)?;

    // Initialize stake account
    stake_account.challenger = ctx.accounts.challenger.key();
    stake_account.challenge_id = challenge_id.clone();
    stake_account.amount = amount;
    stake_account.timestamp = clock.unix_timestamp;
    stake_account.slashed = false;
    stake_account.bump = ctx.bumps.stake_account;

    // Update challenge participant count
    challenge.participant_count = challenge.participant_count
        .checked_add(1)
        .ok_or(PolocError::ArithmeticOverflow)?;

    msg!("Challenger {} staked {} lamports for challenge {}", 
         ctx.accounts.challenger.key(), amount, challenge_id);

    Ok(())
}
