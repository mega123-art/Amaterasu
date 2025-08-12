use anchor_lang::prelude::*;

#[error_code]
pub enum PolocError {
    #[msg("Challenge not found")]
    ChallengeNotFound,

    #[msg("Challenge has expired")]
    ChallengeExpired,

    #[msg("Challenge is not active")]
    ChallengeNotActive,

    #[msg("Voting has not yet started")]
    VotingNotOpen,

    #[msg("Voting period has ended")]
    VotingClosed,

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

    #[msg("No valid votes found for this challenge")]
    NoValidVotes,

    #[msg("This reward has already been claimed.")]
    AlreadyClaimed,

    #[msg("The challenge failed, no rewards are available.")]
    ChallengeFailed,

    #[msg("Your vote was incorrect, no reward for you.")]
    VotedIncorrectly,

    #[msg("Cannot refund a challenge that was successful.")]
    CannotRefundSuccessfulChallenge,

    #[msg("This stake has already been slashed.")]
    AlreadySlashed,

    #[msg("Stake has been slashed; cannot perform this action.")]
    StakeSlashed,
}
