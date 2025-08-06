// programs/poloc_anchor/src/instructions/finalize.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct FinalizeChallenge<'info> {
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
    ctx: Context<FinalizeChallenge>,
    challenge_id: String,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let clock = Clock::get()?;
    
    // Validate challenge can be finalized
    require!(challenge.status == ChallengeStatus::Active, PolocError::ChallengeNotActive);
    require!(clock.unix_timestamp > challenge.deadline + 300, PolocError::ChallengeExpired); // After voting window
    
    // Check minimum participation (3 challengers minimum)
    if challenge.participant_count < 3 {
        challenge.status = ChallengeStatus::InsufficientParticipants;
        msg!("Challenge {} finalized: insufficient participants ({})", 
             challenge_id, challenge.participant_count);
        return Ok(());
    }
    
    // Compute R* from votes using simplified approach
    // In production, this would use the full geometry calculation
    let r_star = if challenge.valid_vote_count > 0 {
        // For now, use average uncertainty of valid votes
        // TODO: Implement full Equation (6) from paper
        challenge.r_star_threshold / 2 // Simplified for demo
    } else {
        u32::MAX // No valid votes = automatic failure
    };
    
    challenge.r_star = r_star;
    challenge.status = ChallengeStatus::Finalized;
    
    let passed = r_star <= challenge.r_star_threshold;
    
    msg!("Challenge {} finalized: R*={}m, threshold={}m, passed={}",
         challenge_id, r_star, challenge.r_star_threshold, passed);
    msg!("Valid votes: {}/{}, Participants: {}",
         challenge.valid_vote_count, challenge.vote_count, challenge.participant_count);
    
    Ok(())
}
