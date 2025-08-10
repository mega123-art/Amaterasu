// programs/poloc_anchor/src/instructions/refund_failed_challenge.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::PolocError;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct RefundFailedChallenge<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump,
        // Closing the account automatically sends the lamports (rent + reward_pool) to waldo.
        close = waldo
    )]
    pub challenge: Account<'info, Challenge>,

    // The original creator of the challenge who gets the refund.
    #[account(mut, address = challenge.waldo @ PolocError::Unauthorized)]
    pub waldo: SystemAccount<'info>,

    // Only the waldo should be able to trigger the refund.
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<RefundFailedChallenge>) -> Result<()> {
    let challenge = &ctx.accounts.challenge;
    let waldo = &ctx.accounts.waldo;
    let authority = &ctx.accounts.authority;

    // 1. Ensure the caller is authorized (is the original creator).
    require_keys_eq!(authority.key(), waldo.key(), PolocError::Unauthorized);

    // 2. Check that the challenge is finalized and has not been processed.
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);
    require!(!challenge.rewards_distributed, PolocError::RewardsAlreadyDistributed);

    // 3. Verify the challenge actually failed.
    let passed = challenge.r_star <= challenge.r_star_threshold;
    require!(!passed, PolocError::CannotRefundSuccessfulChallenge);

    // No transfer logic is needed here. The `close = waldo` attribute on the `challenge`
    // account handles the refund of all lamports automatically when the instruction succeeds.

    msg!("Challenge failed. Refunding reward pool and closing account for challenge: {}", challenge.challenge_id);
    Ok(())
}