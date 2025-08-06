use anchor_lang::prelude::*;

#[error_code]
pub enum PolocError {
    #[msg("Challenge not found")]
    ChallengeNotFound,
    #[msg("Challenge has expired")]
    ChallengeExpired,
    #[msg("Challenge is not active")]
    ChallengeNotActive,
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Already staked for this challenge")]
    AlreadyStaked,
    #[msg("Maximum participants reached")]
    MaxParticipantsReached,
    #[msg("Challenger not staked")]
    ChallengerNotStaked,
    #[msg("Already voted")]
    AlreadyVoted,
    #[msg("Challenge not finalized")]
    ChallengeNotFinalized,
    #[msg("Rewards already distributed")]
    RewardsAlreadyDistributed,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid parameters")]
    InvalidParameters,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Insufficient participants for finalization")]
    InsufficientParticipants,
}