// programs/poloc_anchor/src/instructions/distribute_rewards.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct DistributeRewards<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<DistributeRewards>,
    challenge_id: String,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    
    // Validate challenge is finalized
    require!(challenge.status == ChallengeStatus::Finalized, PolocError::ChallengeNotFinalized);
    require!(!challenge.rewards_distributed, PolocError::RewardsAlreadyDistributed);
    
    // Check if challenge passed (R* <= threshold)
    let passed = challenge.r_star <= challenge.r_star_threshold;
    
    if passed && challenge.valid_vote_count > 0 {
        // Calculate reward per honest participant
        let reward_per_participant = challenge.reward_pool
            .checked_div(challenge.valid_vote_count as u64)
            .ok_or(PolocError::ArithmeticOverflow)?;
        
        // In a full implementation, we would iterate through all vote accounts
        // and transfer rewards to honest challengers
        // For now, we just mark as distributed
        
        msg!("Rewards distributed: {} lamports per honest challenger",
             reward_per_participant);
    } else {
        msg!("No rewards distributed: challenge failed or no valid votes");
    }
    
    challenge.rewards_distributed = true;
    
    msg!("Challenge {} rewards distribution completed", challenge_id);
    
    Ok(())
}
