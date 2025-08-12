use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::PolocError;

#[derive(Accounts)]
#[instruction(challenge_id: String, challenger_pubkey: Pubkey)]
pub struct Slash<'info> {
    #[account(
        mut, // The challenge account must be mutable to receive accounting updates.
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        // Use the same stake PDA derivation as in `stake.rs`.
        seeds = [b"stake", challenge_id.as_bytes(), challenger_pubkey.as_ref()],
        bump = stake_account.bump,
        // Do not close here: stake lamports are stored in the challenge PDA.
    )]
    pub stake_account: Account<'info, Stake>,

    // This authority MUST be the original creator of the challenge ('waldo').
    #[account(address = challenge.waldo @ PolocError::Unauthorized)]
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<Slash>,
    _challenge_id: String,
    challenger_pubkey: Pubkey,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let stake_account = &mut ctx.accounts.stake_account;

    // 1. Ensure the challenge is in a state where slashing is allowed.
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);

    // Prevent double-slash
    require!(!stake_account.slashed, PolocError::AlreadySlashed);

    // Mark the stake as slashed. The actual lamports were moved into the challenge PDA during `stake`.
    stake_account.slashed = true;

    // If you did not already add stake to reward_pool at stake time, you would add it here.
    // Our flow adds it during stake(), so we do not add it here to avoid double-counting.

    msg!(
        "Challenger {} slashed. Stake of {} lamports forfeited (account marked slashed).",
        challenger_pubkey,
        stake_account.amount
    );
    msg!("Reward pool currently: {}", challenge.reward_pool);

    Ok(())
}
