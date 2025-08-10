// programs/poloc_anchor/src/instructions/slash.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::PolocError;

#[derive(Accounts)]
#[instruction(challenge_id: String, challenger_pubkey: Pubkey)]
pub struct Slash<'info> {
    #[account(
        mut, // The challenge account must be mutable to receive the slashed funds.
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        // The seeds now directly use the `challenger_pubkey` argument.
        seeds = [b"stake", challenge.key().as_ref(), challenger_pubkey.as_ref()],
        bump = stake_account.bump,
        // This is the key change: close the stake account and transfer all its lamports
        // (the stake amount + rent) to the `challenge` account.
        close = challenge
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
    let stake_account = &ctx.accounts.stake_account;

    // 1. Ensure the challenge is in a state where slashing is allowed.
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);

    // Note: An "already slashed" check (`!stake_account.slashed`) is no longer needed.
    // Because we now close the account, any attempt to slash a second time will fail
    // as Anchor will be unable to find the `stake_account`, providing a stronger guarantee.

    // 2. Add the forfeited stake amount from the closed account to the main reward pool.
    let slashed_amount = stake_account.amount;
    challenge.reward_pool = challenge.reward_pool
        .checked_add(slashed_amount)
        .ok_or(PolocError::ArithmeticOverflow)?;

    msg!(
        "Challenger {} slashed. Stake of {} lamports forfeited and added to the reward pool.",
        challenger_pubkey,
        slashed_amount
    );
    msg!("New reward pool size: {}", challenge.reward_pool);

    Ok(())
}