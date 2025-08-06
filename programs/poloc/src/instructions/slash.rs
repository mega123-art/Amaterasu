// programs/poloc_anchor/src/instructions/slash.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct Slash<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(
        mut,
        seeds = [b"stake", challenge.key().as_ref(), challenger_to_slash.as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, Stake>,
    
    /// CHECK: This is the challenger being slashed
    pub challenger_to_slash: AccountInfo<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<Slash>,
    challenge_id: String,
    challenger_pubkey: Pubkey,
) -> Result<()> {
    let challenge = &ctx.accounts.challenge;
    let stake_account = &mut ctx.accounts.stake_account;
    
    // Validate challenge is finalized
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);
    require!(!stake_account.slashed, PolocError::AlreadyVoted); // Reusing error for "already slashed"
    
    // Validate challenger matches
    require!(stake_account.challenger == challenger_pubkey, PolocError::Unauthorized);
    
    // Mark as slashed (forfeit stake)
    stake_account.slashed = true;
    
    msg!("Challenger {} slashed for challenge {}, stake forfeited: {} lamports",
         challenger_pubkey, challenge_id, stake_account.amount);
    
    Ok(())
}