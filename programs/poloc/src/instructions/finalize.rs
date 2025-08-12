use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::PolocError;

#[derive(Accounts)]
#[instruction(challenge_id: String)]
pub struct FinalizeChallenge<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_bytes()],
        bump = challenge.bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    // The authority is the trusted oracle (in this case, the challenge creator)
    // who runs the off-chain script and submits the result.
    #[account(address = challenge.waldo @ PolocError::Unauthorized)]
    pub authority: Signer<'info>,
}

// The handler now accepts the pre-calculated r_star from your JS script.
pub fn handler(
    ctx: Context<FinalizeChallenge>,
    challenge_id: String,
    r_star_from_js: u32, // <-- The result from your off-chain calculation
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let clock = Clock::get()?;
    #[cfg(not(test))]
const VOTING_WINDOW: i64 = 300; // 5 minutes for production
#[cfg(test)]
const VOTING_WINDOW: i64 = 3;   // 3 seconds for testing
    
    // 1. Validate that the challenge is in the correct state to be finalized.
    require!(challenge.status == ChallengeStatus::Active, PolocError::ChallengeNotActive);
    require!(clock.unix_timestamp > challenge.deadline + VOTING_WINDOW, PolocError::ChallengeExpired);

    // 2. You can still check for minimum participation.
    if challenge.participant_count < 3 {
        challenge.status = ChallengeStatus::InsufficientParticipants;
        msg!("Challenge {} finalized: insufficient participants ({})", 
             challenge_id, challenge.participant_count);
        return Ok(());
    }
    
    // 3. The on-chain program now TRUSTS the submitted r_star value.
    // All complex math is handled off-chain.
    challenge.r_star = r_star_from_js;
    
    // 4. Update the challenge status to Finalized.
    challenge.status = ChallengeStatus::Finalized;
    
    let passed = challenge.r_star <= challenge.r_star_threshold;
    
    msg!("Challenge {} finalized by oracle.", challenge_id);
    msg!("Submitted R*={}m, threshold={}m, passed={}",
         challenge.r_star, challenge.r_star_threshold, passed);
    
    Ok(())
}
