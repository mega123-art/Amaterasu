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
        // Closing the account automatically sends the lamports (rent + remaining reward_pool) to waldo_account.
        close = waldo_account
    )]
    pub challenge: Account<'info, Challenge>,

    // The original creator of the challenge who gets the refund.
    #[account(mut)]
    pub waldo_account: SystemAccount<'info>,

    // Only the waldo (original creator) should be able to trigger the refund.
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<RefundFailedChallenge>) -> Result<()> {
    let challenge = &ctx.accounts.challenge;
    let waldo_account = &ctx.accounts.waldo_account;
    let authority = &ctx.accounts.authority;

    // Ensure the caller is the original creator (signer must match waldo).
    require_keys_eq!(authority.key(), waldo_account.key(), PolocError::Unauthorized);
    // Ensure waldo_account equals recorded waldo
    require_keys_eq!(waldo_account.key(), challenge.waldo, PolocError::Unauthorized);

    // Accept either Finalized (but failed) OR InsufficientParticipants status.
    require!(
        challenge.status == ChallengeStatus::Finalized || challenge.status == ChallengeStatus::InsufficientParticipants,
        PolocError::ChallengeNotFinalized
    );

    require!(!challenge.rewards_distributed, PolocError::RewardsAlreadyDistributed);

    // If Finalized, ensure it actually failed.
    if challenge.status == ChallengeStatus::Finalized {
        let passed = challenge.r_star <= challenge.r_star_threshold;
        require!(!passed, PolocError::CannotRefundSuccessfulChallenge);
    }

    // Closing the challenge account (close = waldo_account) will automatically transfer lamports.
    msg!("Challenge failed. Refunding remaining reward pool and closing account for challenge: {}", challenge.challenge_id);
    Ok(())
}
