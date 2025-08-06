
// programs/poloc_anchor/src/instructions/stake.rs
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(
        init,
        payer = challenger,
        space = Stake::MAX_SIZE,
        seeds = [b"stake", challenge.key().as_ref(), challenger.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, Stake>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Stake>,
    challenge_id: String,
    amount: u64,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let stake_account = &mut ctx.accounts.stake_account;
    let clock = Clock::get()?;
    
    // Validate challenge is active
    require!(challenge.status == ChallengeStatus::Active, PolocError::ChallengeNotActive);
    require!(clock.unix_timestamp <= challenge.deadline, PolocError::ChallengeExpired);
    
    // Validate stake amount (minimum 0.001 SOL)
    require!(amount >= 1_000_000, PolocError::InsufficientStake);
    
    // Check maximum participants (20 max)
    require!(challenge.participant_count < 20, PolocError::MaxParticipantsReached);
    
    // Transfer stake amount to challenge account
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
    
    // Initialize stake account
    stake_account.challenger = ctx.accounts.challenger.key();
    stake_account.challenge_id = challenge_id;
    stake_account.amount = amount;
    stake_account.timestamp = clock.unix_timestamp;
    stake_account.slashed = false;
    stake_account.bump = *ctx.bumps.get("stake_account").unwrap();
    
    // Update challenge participant count
    challenge.participant_count = challenge.participant_count
        .checked_add(1)
        .ok_or(PolocError::ArithmeticOverflow)?;
    
    msg!("Challenger {} staked {} lamports for challenge {}", 
         ctx.accounts.challenger.key(), amount, challenge_id);
    
    Ok(())
}
