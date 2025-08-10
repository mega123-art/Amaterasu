// programs/poloc_anchor/src/instructions/claim_reward.rs
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::PolocError;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,

    // The vote account of the participant claiming their reward.
    // This proves they were an honest voter.
    #[account(
        mut, // We mark the vote as processed to prevent double-claims.
        seeds = [b"vote", challenge_id.as_bytes(), winner.key().as_ref()],
        bump = vote.bump,
        constraint = vote.challenger == winner.key() @ PolocError::Unauthorized,
        constraint = !vote.processed @ PolocError::AlreadyClaimed,
    )]
    pub vote: Account<'info, Vote>,

    #[account(mut)]
    pub winner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimReward>, _challenge_id: String) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let vote = &mut ctx.accounts.vote;
    let winner = &ctx.accounts.winner;

    // 1. Check that the challenge is finalized and was successful.
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);
    let passed = challenge.r_star <= challenge.r_star_threshold;
    require!(passed, PolocError::ChallengeFailed);

    // 2. Check that the voter voted correctly (i.e., voted 'valid' for a successful challenge).
    require!(vote.is_valid, PolocError::VotedIncorrectly);

    // 3. Calculate reward and transfer funds from the Challenge PDA to the winner.
    require!(challenge.valid_vote_count > 0, PolocError::ArithmeticOverflow);
    let reward_per_participant = challenge.reward_pool
        .checked_div(challenge.valid_vote_count as u64)
        .ok_or(PolocError::ArithmeticOverflow)?;

    // Perform the transfer via CPI to the System Program
    let cpi_accounts = system_program::Transfer {
        from: challenge.to_account_info(),
        to: winner.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    system_program::transfer(cpi_context, reward_per_participant)?;

    // 4. Update state to prevent double-claiming
    vote.processed = true;
    challenge.reward_pool = challenge.reward_pool.checked_sub(reward_per_participant).unwrap();

    msg!("Reward of {} lamports claimed by {}", reward_per_participant, winner.key());
    Ok(())
}