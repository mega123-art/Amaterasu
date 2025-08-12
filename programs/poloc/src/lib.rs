use anchor_lang::prelude::*;
pub mod instructions;
pub mod state;
pub mod errors;
use instructions::*;

declare_id!("DD4EFbG6h1HNNGm51wS4HWBvsquEhPZbC2qcCnYBRmQ");

#[program]  
pub mod poloc {
    use super::*;
     pub fn initialize_challenge(
        ctx: Context<InitializeChallenge>,
        challenge_id: String,
        claimed_lat: i32,      // Latitude in micro-degrees (lat * 1e6)
        claimed_lon: i32,      // Longitude in micro-degrees (lon * 1e6)
        duration: u64,         // Duration in seconds
        reward_pool: u64,      // Reward pool in lamports
    ) -> Result<()> {
        instructions::initialize_challenge::handler(
            ctx,
            challenge_id,
            claimed_lat,
            claimed_lon,
            duration,
            reward_pool,
        )
    }

    /// Stake tokens to participate in a challenge
    pub fn stake(
        ctx: Context<StakeCtx>,
        challenge_id: String,
        amount: u64,
    ) -> Result<()> {
        instructions::stake::handler(ctx, challenge_id, amount)
    }

    /// Submit vote with delay estimates and validity assessment
    pub fn submit_vote(
        ctx: Context<SubmitVote>,
        challenge_id: String,
        challenger_id: String,
        is_valid: bool,
        uncertainty: u32,      // Uncertainty in meters
        min_rtt: u32,         // Minimum RTT in microseconds
    ) -> Result<()> {
        instructions::vote::handler(
            ctx,
            challenge_id,
            challenger_id,
            is_valid,
            uncertainty,
            min_rtt,
        )
    }

    /// Finalize challenge and compute results
    pub fn finalize_challenge(
        ctx: Context<FinalizeChallenge>,
        challenge_id: String,
        r_star: u32,           // Final uncertainty in meters
    ) -> Result<()> {
        instructions::finalize::handler(ctx, challenge_id, r_star)
    }

    /// Distribute rewards to honest participants
  pub fn claim_reward(
        ctx: Context<ClaimReward>,
        challenge_id: String,
    ) -> Result<()> {
        instructions::claim_reward::handler(ctx, challenge_id)
    }

    /// Refunds the reward pool to the creator if a challenge failed.
    pub fn refund_failed_challenge(
        ctx: Context<RefundFailedChallenge>,
        _challenge_id: String,
    ) -> Result<()> {
        instructions::refund_failed_challenge::handler(ctx,)
    }

    /// Slash dishonest challengers
    pub fn slash(
        ctx: Context<Slash>,
        challenge_id: String,
        challenger_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::slash::handler(ctx, challenge_id, challenger_pubkey)
    }
    

  
}

