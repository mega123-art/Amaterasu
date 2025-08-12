use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChallengeStatus {
    Active,
    Finalized,
    Expired,
    InsufficientParticipants,
}

impl Default for ChallengeStatus {
    fn default() -> Self {
        ChallengeStatus::Active
    }
}

#[account]
pub struct Challenge {
    // NOTE: Strings are stored with a 4-byte length prefix + N bytes of content.
    // We cap strings at 32 bytes of content here for predictability.
    pub challenge_id: String,           // 4 + 32 = 36 bytes
    pub waldo: Pubkey,                  // 32 bytes
    pub claimed_lat: i32,               // 4 bytes - latitude in micro-degrees
    pub claimed_lon: i32,               // 4 bytes - longitude in micro-degrees
    pub start_time: i64,                // 8 bytes
    pub deadline: i64,                  // 8 bytes
    pub reward_pool: u64,               // 8 bytes
    pub status: ChallengeStatus,        // 1 byte (enum discriminant)
    pub participant_count: u32,         // 4 bytes
    pub vote_count: u32,                // 4 bytes
    pub valid_vote_count: u32,          // 4 bytes
    pub r_star: u32,                    // 4 bytes - final uncertainty in meters
    pub r_star_threshold: u32,          // 4 bytes - threshold for acceptance
    pub rewards_distributed: bool,      // 1 byte
    pub bump: u8,                       // 1 byte
    // Total payload size (without Anchor discriminator): 123 bytes
    // We'll include the 8-byte Anchor discriminator in MAX_SIZE below for direct use in init(space = Challenge::MAX_SIZE)
}

impl Challenge {
    // 8 bytes discriminator + 123 payload = 131 bytes
    pub const MAX_SIZE: usize = 8 + 123;
}

#[account]
pub struct Stake {
    pub challenger: Pubkey,             // 32 bytes
    pub challenge_id: String,           // 4 + 32 = 36 bytes
    pub amount: u64,                    // 8 bytes
    pub timestamp: i64,                 // 8 bytes
    pub slashed: bool,                  // 1 byte
    pub bump: u8,                       // 1 byte
    // Total payload size: 86 bytes
}

impl Stake {
    // NOTE: used as `space = 8 + Stake::MAX_SIZE` where the `8 +` is the Anchor discriminator
    pub const MAX_SIZE: usize = 86;
}

#[account]
pub struct Vote {
    pub challenger: Pubkey,             // 32 bytes
    pub challenge_id: String,           // 4 + 32 = 36 bytes
    pub challenger_id: String,          // 4 + 32 = 36 bytes
    pub is_valid: bool,                 // 1 byte
    pub uncertainty: u32,               // 4 bytes - meters
    pub min_rtt: u32,                   // 4 bytes - microseconds
    pub timestamp: i64,                 // 8 bytes
    pub processed: bool,                // 1 byte
    pub bump: u8,                       // 1 byte
    // Total payload size: 123 bytes
}

impl Vote {
    // NOTE: used as `space = 8 + Vote::MAX_SIZE` in `init`
    pub const MAX_SIZE: usize = 123;
}
