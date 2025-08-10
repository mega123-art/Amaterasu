const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

/**
 * Poloc Client - A comprehensive client for the Poloc location-based challenge program
 */
class PolocClient {
    constructor(connection, wallet, programId = null) {
        this.connection = connection;
        this.wallet = wallet;
        
        // Load IDL
        const idlPath = path.join(__dirname, 'polocfinal.json');
        this.idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Set program ID
        this.programId = programId || new PublicKey(this.idl.address);
        
        // Create provider
        this.provider = new anchor.AnchorProvider(
            connection,
            wallet,
            { commitment: 'confirmed' }
        );
        
        // Create program instance
        this.program = new anchor.Program(this.idl, this.programId, this.provider);
        
        // Set anchor provider
        anchor.setProvider(this.provider);
    }

    /**
     * Get PDA for challenge account
     * @param {string} challengeId - The challenge identifier
     * @returns {Promise<[PublicKey, number]>} - [PDA, bump]
     */
    async getChallengePda(challengeId) {
        return PublicKey.findProgramAddress(
            [
                Buffer.from('challenge'),
                Buffer.from(challengeId)
            ],
            this.programId
        );
    }

    /**
     * Get PDA for stake account
     * @param {string} challengeId - The challenge identifier
     * @param {PublicKey} challenger - The challenger's public key
     * @returns {Promise<[PublicKey, number]>} - [PDA, bump]
     */
    async getStakePda(challengeId, challenger) {
        return PublicKey.findProgramAddress(
            [
                Buffer.from('stake'),
                Buffer.from(challengeId),
                challenger.toBuffer()
            ],
            this.programId
        );
    }

    /**
     * Get PDA for vote account
     * @param {string} challengeId - The challenge identifier
     * @param {PublicKey} challenger - The challenger's public key
     * @returns {Promise<[PublicKey, number]>} - [PDA, bump]
     */
    async getVotePda(challengeId, challenger) {
        return PublicKey.findProgramAddress(
            [
                Buffer.from('vote'),
                Buffer.from(challengeId),
                challenger.toBuffer()
            ],
            this.programId
        );
    }

    /**
     * Initialize a new challenge
     * @param {Object} params - Challenge parameters
     * @param {string} params.challengeId - Unique challenge identifier
     * @param {number} params.claimedLat - Latitude in micro-degrees (lat * 1e6)
     * @param {number} params.claimedLon - Longitude in micro-degrees (lon * 1e6)
     * @param {number} params.duration - Duration in seconds
     * @param {number} params.rewardPool - Reward pool in lamports
     * @returns {Promise<string>} - Transaction signature
     */
    async initializeChallenge({ challengeId, claimedLat, claimedLon, duration, rewardPool }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            
            const tx = await this.program.methods
                .initializeChallenge(
                    challengeId,
                    new anchor.BN(claimedLat),
                    new anchor.BN(claimedLon),
                    new anchor.BN(duration),
                    new anchor.BN(rewardPool)
                )
                .accounts({
                    challenge: challengePda,
                    waldo: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                })
                .rpc();

            console.log(`✅ Challenge initialized: ${challengeId}`);
            console.log(`📍 Location: ${claimedLat/1e6}, ${claimedLon/1e6}`);
            console.log(`⏱️  Duration: ${duration} seconds`);
            console.log(`💰 Reward Pool: ${rewardPool} lamports`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to initialize challenge: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stake tokens to participate in a challenge
     * @param {Object} params - Stake parameters
     * @param {string} params.challengeId - The challenge identifier
     * @param {number} params.amount - Amount to stake in lamports
     * @returns {Promise<string>} - Transaction signature
     */
    async stake({ challengeId, amount }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const [stakePda] = await this.getStakePda(challengeId, this.wallet.publicKey);

            const tx = await this.program.methods
                .stake(challengeId, new anchor.BN(amount))
                .accounts({
                    challenge: challengePda,
                    stakeAccount: stakePda,
                    challenger: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                })
                .rpc();

            console.log(`✅ Staked ${amount} lamports for challenge: ${challengeId}`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to stake: ${error.message}`);
            throw error;
        }
    }

    /**
     * Submit a vote for a challenge
     * @param {Object} params - Vote parameters
     * @param {string} params.challengeId - The challenge identifier
     * @param {string} params.challengerId - The challenger identifier
     * @param {boolean} params.isValid - Whether the challenge is valid
     * @param {number} params.uncertainty - Uncertainty in meters
     * @param {number} params.minRtt - Minimum RTT in microseconds
     * @returns {Promise<string>} - Transaction signature
     */
    async submitVote({ challengeId, challengerId, isValid, uncertainty, minRtt }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const [stakePda] = await this.getStakePda(challengeId, this.wallet.publicKey);
            const [votePda] = await this.getVotePda(challengeId, this.wallet.publicKey);

            const tx = await this.program.methods
                .submitVote(
                    challengeId,
                    challengerId,
                    isValid,
                    new anchor.BN(uncertainty),
                    new anchor.BN(minRtt)
                )
                .accounts({
                    challenge: challengePda,
                    stakeAccount: stakePda,
                    voteAccount: votePda,
                    challenger: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                })
                .rpc();

            console.log(`✅ Vote submitted for challenge: ${challengeId}`);
            console.log(`🎯 Valid: ${isValid}`);
            console.log(`📏 Uncertainty: ${uncertainty}m`);
            console.log(`⏱️  Min RTT: ${minRtt}μs`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to submit vote: ${error.message}`);
            throw error;
        }
    }

    /**
     * Finalize a challenge
     * @param {Object} params - Finalization parameters
     * @param {string} params.challengeId - The challenge identifier
     * @param {number} params.rStar - Final uncertainty in meters
     * @returns {Promise<string>} - Transaction signature
     */
    async finalizeChallenge({ challengeId, rStar }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);

            const tx = await this.program.methods
                .finalizeChallenge(challengeId, new anchor.BN(rStar))
                .accounts({
                    challenge: challengePda,
                    authority: this.wallet.publicKey
                })
                .rpc();

            console.log(`✅ Challenge finalized: ${challengeId}`);
            console.log(`📏 Final uncertainty (R*): ${rStar}m`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to finalize challenge: ${error.message}`);
            throw error;
        }
    }

    /**
     * Claim reward for a challenge
     * @param {Object} params - Reward claim parameters
     * @param {string} params.challengeId - The challenge identifier
     * @returns {Promise<string>} - Transaction signature
     */
    async claimReward({ challengeId }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const [votePda] = await this.getVotePda(challengeId, this.wallet.publicKey);

            const tx = await this.program.methods
                .claimReward(challengeId)
                .accounts({
                    challenge: challengePda,
                    vote: votePda,
                    winner: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                })
                .rpc();

            console.log(`✅ Reward claimed for challenge: ${challengeId}`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to claim reward: ${error.message}`);
            throw error;
        }
    }

    /**
     * Refund failed challenge
     * @param {Object} params - Refund parameters
     * @param {string} params.challengeId - The challenge identifier
     * @returns {Promise<string>} - Transaction signature
     */
    async refundFailedChallenge({ challengeId }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const [waldoPda] = await this.getChallengePda(challengeId);

            const tx = await this.program.methods
                .refundFailedChallenge(challengeId)
                .accounts({
                    challenge: challengePda,
                    waldo: waldoPda,
                    authority: this.wallet.publicKey
                })
                .rpc();

            console.log(`✅ Failed challenge refunded: ${challengeId}`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to refund challenge: ${error.message}`);
            throw error;
        }
    }

    /**
     * Slash dishonest challengers
     * @param {Object} params - Slash parameters
     * @param {string} params.challengeId - The challenge identifier
     * @param {PublicKey} params.challengerPubkey - The challenger's public key to slash
     * @returns {Promise<string>} - Transaction signature
     */
    async slash({ challengeId, challengerPubkey }) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const [stakePda] = await this.getStakePda(challengeId, challengerPubkey);

            const tx = await this.program.methods
                .slash(challengeId, challengerPubkey)
                .accounts({
                    challenge: challengePda,
                    stakeAccount: stakePda,
                    authority: this.wallet.publicKey
                })
                .rpc();

            console.log(`✅ Challenger slashed: ${challengerPubkey.toString()}`);
            console.log(`🔗 Transaction: ${tx}`);

            return tx;
        } catch (error) {
            console.error(`❌ Failed to slash challenger: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get challenge account data
     * @param {string} challengeId - The challenge identifier
     * @returns {Promise<Object|null>} - Challenge account data or null if not found
     */
    async getChallenge(challengeId) {
        try {
            const [challengePda] = await this.getChallengePda(challengeId);
            const challenge = await this.program.account.challenge.fetch(challengePda);
            return challenge;
        } catch (error) {
            console.log(`Challenge not found: ${challengeId}`);
            return null;
        }
    }

    /**
     * Get stake account data
     * @param {string} challengeId - The challenge identifier
     * @param {PublicKey} challenger - The challenger's public key
     * @returns {Promise<Object|null>} - Stake account data or null if not found
     */
    async getStake(challengeId, challenger) {
        try {
            const [stakePda] = await this.getStakePda(challengeId, challenger);
            const stake = await this.program.account.stake.fetch(stakePda);
            return stake;
        } catch (error) {
            console.log(`Stake not found for challenger: ${challenger.toString()}`);
            return null;
        }
    }

    /**
     * Get vote account data
     * @param {string} challengeId - The challenge identifier
     * @param {PublicKey} challenger - The challenger's public key
     * @returns {Promise<Object|null>} - Vote account data or null if not found
     */
    async getVote(challengeId, challenger) {
        try {
            const [votePda] = await this.getVotePda(challengeId, challenger);
            const vote = await this.program.account.vote.fetch(votePda);
            return vote;
        } catch (error) {
            console.log(`Vote not found for challenger: ${challenger.toString()}`);
            return null;
        }
    }

    /**
     * Get all challenges for a wallet
     * @param {PublicKey} wallet - The wallet public key
     * @returns {Promise<Array>} - Array of challenge accounts
     */
    async getChallengesByWallet(wallet) {
        try {
            const challenges = await this.program.account.challenge.all([
                {
                    memcmp: {
                        offset: 8, // Skip discriminator
                        bytes: wallet.toBase58()
                    }
                }
            ]);
            return challenges;
        } catch (error) {
            console.error(`Failed to get challenges for wallet: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all stakes for a challenge
     * @param {string} challengeId - The challenge identifier
     * @returns {Promise<Array>} - Array of stake accounts
     */
    async getStakesByChallenge(challengeId) {
        try {
            const stakes = await this.program.account.stake.all([
                {
                    memcmp: {
                        offset: 40, // Skip discriminator and challenger
                        bytes: challengeId
                    }
                }
            ]);
            return stakes;
        } catch (error) {
            console.error(`Failed to get stakes for challenge: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all votes for a challenge
     * @param {string} challengeId - The challenge identifier
     * @returns {Promise<Array>} - Array of vote accounts
     */
    async getVotesByChallenge(challengeId) {
        try {
            const votes = await this.program.account.vote.all([
                {
                    memcmp: {
                        offset: 32, // Skip discriminator and challenger
                        bytes: challengeId
                    }
                }
            ]);
            return votes;
        } catch (error) {
            console.error(`Failed to get votes for challenge: ${error.message}`);
            return [];
        }
    }

    /**
     * Get program statistics
     * @returns {Promise<Object>} - Program statistics
     */
    async getProgramStats() {
        try {
            const challenges = await this.program.account.challenge.all();
            const stakes = await this.program.account.stake.all();
            const votes = await this.program.account.vote.all();

            const stats = {
                totalChallenges: challenges.length,
                totalStakes: stakes.length,
                totalVotes: votes.length,
                activeChallenges: challenges.filter(c => c.account.status.active).length,
                finalizedChallenges: challenges.filter(c => c.account.status.finalized).length,
                expiredChallenges: challenges.filter(c => c.account.status.expired).length,
                totalRewardPool: challenges.reduce((sum, c) => sum + Number(c.account.rewardPool), 0)
            };

            return stats;
        } catch (error) {
            console.error(`Failed to get program stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Convert micro-degrees to decimal degrees
     * @param {number} microDegrees - Latitude or longitude in micro-degrees
     * @returns {number} - Decimal degrees
     */
    microDegreesToDecimal(microDegrees) {
        return microDegrees / 1e6;
    }

    /**
     * Convert decimal degrees to micro-degrees
     * @param {number} decimalDegrees - Latitude or longitude in decimal degrees
     * @returns {number} - Micro-degrees
     */
    decimalToMicroDegrees(decimalDegrees) {
        return Math.round(decimalDegrees * 1e6);
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - First latitude in decimal degrees
     * @param {number} lon1 - First longitude in decimal degrees
     * @param {number} lat2 - Second latitude in decimal degrees
     * @param {number} lon2 - Second longitude in decimal degrees
     * @returns {number} - Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}

module.exports = PolocClient;
