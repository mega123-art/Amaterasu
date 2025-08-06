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
    pub challenge_id: String,           // 32 bytes
    pub waldo: Pubkey,                  // 32 bytes
    pub claimed_lat: i32,               // 4 bytes - latitude in micro-degrees
    pub claimed_lon: i32,               // 4 bytes - longitude in micro-degrees
    pub start_time: i64,                // 8 bytes
    pub deadline: i64,                  // 8 bytes
    pub reward_pool: u64,               // 8 bytes
    pub status: ChallengeStatus,        // 1 byte + padding
    pub participant_count: u32,         // 4 bytes
    pub vote_count: u32,                // 4 bytes
    pub valid_vote_count: u32,          // 4 bytes
    pub r_star: u32,                    // 4 bytes - final uncertainty in meters
    pub r_star_threshold: u32,          // 4 bytes - threshold for acceptance
    pub rewards_distributed: bool,      // 1 byte
    pub bump: u8,                       // 1 byte
    // Total: ~120 bytes + string padding
}

impl Challenge {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 4 + 4 + 8 + 8 + 8 + 4 + 4 + 4 + 4 + 4 + 4 + 1 + 1 + 64; // 200 bytes
}

#[account]
pub struct Stake {
    pub challenger: Pubkey,             // 32 bytes
    pub challenge_id: String,           // 32 bytes
    pub amount: u64,                    // 8 bytes
    pub timestamp: i64,                 // 8 bytes
    pub slashed: bool,                  // 1 byte
    pub bump: u8,                       // 1 byte
}

impl Stake {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1 + 32; // 120 bytes
}

#[account]
pub struct Vote {
    pub challenger: Pubkey,             // 32 bytes
    pub challenge_id: String,           // 32 bytes
    pub challenger_id: String,          // 32 bytes
    pub is_valid: bool,                 // 1 byte
    pub uncertainty: u32,               // 4 bytes - meters
    pub min_rtt: u32,                   // 4 bytes - microseconds
    pub timestamp: i64,                 // 8 bytes
    pub processed: bool,                // 1 byte
    pub bump: u8,                       // 1 byte
}

impl Vote {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 32 + 1 + 4 + 4 + 8 + 1 + 1 + 32; // 160 bytes
}