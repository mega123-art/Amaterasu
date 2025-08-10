const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const PolocClient = require('./poloc-client');

/**
 * Demo script showing how to use the PolocClient
 */
async function main() {
    console.log('🚀 Poloc Client Demo');
    console.log('=====================\n');

    // Setup connection (use your preferred RPC endpoint)
    const connection = new Connection('http://localhost:8899', 'confirmed');
    
    // Load wallet from file or create a new one for testing
    let wallet;
    try {
        const walletData = JSON.parse(fs.readFileSync(path.join(__dirname, '../wallet.json'), 'utf8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        console.log(`✅ Wallet loaded: ${wallet.publicKey.toString()}`);
    } catch (error) {
        console.log('Creating new wallet for demo...');
        wallet = Keypair.generate();
        console.log(`🆕 New wallet created: ${wallet.publicKey.toString()}`);
        
        // Airdrop some SOL for testing (only works on localnet/devnet)
        try {
            const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            console.log('💰 Airdropped 2 SOL for testing');
        } catch (error) {
            console.log('⚠️  Airdrop failed (this is normal on mainnet)');
        }
    }

    // Initialize PolocClient
    const polocClient = new PolocClient(connection, wallet);
    console.log(`🔗 Connected to Poloc program: ${polocClient.programId.toString()}\n`);

    try {
        // Demo 1: Get program statistics
        console.log('📊 Program Statistics:');
        const stats = await polocClient.getProgramStats();
        if (stats) {
            console.log(`   Total Challenges: ${stats.totalChallenges}`);
            console.log(`   Total Stakes: ${stats.totalStakes}`);
            console.log(`   Total Votes: ${stats.totalVotes}`);
            console.log(`   Active Challenges: ${stats.activeChallenges}`);
            console.log(`   Finalized Challenges: ${stats.finalizedChallenges}`);
            console.log(`   Total Reward Pool: ${stats.totalRewardPool / LAMPORTS_PER_SOL} SOL\n`);
        }

        // Demo 2: Create a new challenge
        const challengeId = `demo-challenge-${Date.now()}`;
        const lat = 37.7749; // San Francisco
        const lon = -122.4194;
        const microLat = polocClient.decimalToMicroDegrees(lat);
        const microLon = polocClient.decimalToMicroDegrees(lon);
        const duration = 3600; // 1 hour
        const rewardPool = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL

        console.log('🎯 Creating New Challenge:');
        console.log(`   Challenge ID: ${challengeId}`);
        console.log(`   Location: ${lat}, ${lon}`);
        console.log(`   Duration: ${duration} seconds (${duration/3600} hours)`);
        console.log(`   Reward Pool: ${rewardPool / LAMPORTS_PER_SOL} SOL`);

        try {
            const tx = await polocClient.initializeChallenge({
                challengeId,
                claimedLat: microLat,
                claimedLon: microLon,
                duration,
                rewardPool
            });
            console.log(`   ✅ Challenge created! TX: ${tx}\n`);
        } catch (error) {
            console.log(`   ❌ Failed to create challenge: ${error.message}\n`);
        }

        // Demo 3: Stake in the challenge
        console.log('💰 Staking in Challenge:');
        const stakeAmount = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
        console.log(`   Amount: ${stakeAmount / LAMPORTS_PER_SOL} SOL`);

        try {
            const tx = await polocClient.stake({
                challengeId,
                amount: stakeAmount
            });
            console.log(`   ✅ Staked successfully! TX: ${tx}\n`);
        } catch (error) {
            console.log(`   ❌ Failed to stake: ${error.message}\n`);
        }

        // Demo 4: Submit a vote
        console.log('🗳️  Submitting Vote:');
        const challengerId = 'demo-challenger';
        const isValid = true;
        const uncertainty = 50; // 50 meters
        const minRtt = 1000; // 1000 microseconds

        console.log(`   Challenger ID: ${challengerId}`);
        console.log(`   Valid: ${isValid}`);
        console.log(`   Uncertainty: ${uncertainty}m`);
        console.log(`   Min RTT: ${minRtt}μs`);

        try {
            const tx = await polocClient.submitVote({
                challengeId,
                challengerId,
                isValid,
                uncertainty,
                minRtt
            });
            console.log(`   ✅ Vote submitted! TX: ${tx}\n`);
        } catch (error) {
            console.log(`   ❌ Failed to submit vote: ${error.message}\n`);
        }

        // Demo 5: Get challenge details
        console.log('📋 Challenge Details:');
        const challenge = await polocClient.getChallenge(challengeId);
        if (challenge) {
            console.log(`   Challenge ID: ${challenge.challengeId}`);
            console.log(`   Waldo: ${challenge.waldo.toString()}`);
            console.log(`   Location: ${polocClient.microDegreesToDecimal(challenge.claimedLat)}, ${polocClient.microDegreesToDecimal(challenge.claimedLon)}`);
            console.log(`   Start Time: ${new Date(challenge.startTime * 1000).toISOString()}`);
            console.log(`   Deadline: ${new Date(challenge.deadline * 1000).toISOString()}`);
            console.log(`   Reward Pool: ${challenge.rewardPool / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Status: ${Object.keys(challenge.status)[0]}`);
            console.log(`   Participant Count: ${challenge.participantCount}`);
            console.log(`   Vote Count: ${challenge.voteCount}\n`);
        } else {
            console.log(`   ❌ Challenge not found\n`);
        }

        // Demo 6: Get stake details
        console.log('💎 Stake Details:');
        const stake = await polocClient.getStake(challengeId, wallet.publicKey);
        if (stake) {
            console.log(`   Challenger: ${stake.challenger.toString()}`);
            console.log(`   Challenge ID: ${stake.challengeId}`);
            console.log(`   Amount: ${stake.amount / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Timestamp: ${new Date(stake.timestamp * 1000).toISOString()}`);
            console.log(`   Slashed: ${stake.slashed}\n`);
        } else {
            console.log(`   ❌ Stake not found\n`);
        }

        // Demo 7: Get vote details
        console.log('🗳️  Vote Details:');
        const vote = await polocClient.getVote(challengeId, wallet.publicKey);
        if (vote) {
            console.log(`   Challenger: ${vote.challenger.toString()}`);
            console.log(`   Challenge ID: ${vote.challengeId}`);
            console.log(`   Challenger ID: ${vote.challengerId}`);
            console.log(`   Valid: ${vote.isValid}`);
            console.log(`   Uncertainty: ${vote.uncertainty}m`);
            console.log(`   Min RTT: ${vote.minRtt}μs`);
            console.log(`   Timestamp: ${new Date(vote.timestamp * 1000).toISOString()}`);
            console.log(`   Processed: ${vote.processed}\n`);
        } else {
            console.log(`   ❌ Vote not found\n`);
        }

        // Demo 8: Get all challenges for wallet
        console.log('📚 All Challenges for Wallet:');
        const challenges = await polocClient.getChallengesByWallet(wallet.publicKey);
        console.log(`   Found ${challenges.length} challenges\n`);

        // Demo 9: Get all stakes for challenge
        console.log('💎 All Stakes for Challenge:');
        const stakes = await polocClient.getStakesByChallenge(challengeId);
        console.log(`   Found ${stakes.length} stakes\n`);

        // Demo 10: Get all votes for challenge
        console.log('🗳️  All Votes for Challenge:');
        const votes = await polocClient.getVotesByChallenge(challengeId);
        console.log(`   Found ${votes.length} votes\n`);

        // Demo 11: Distance calculation example
        console.log('📏 Distance Calculation Example:');
        const lat1 = 37.7749; // San Francisco
        const lon1 = -122.4194;
        const lat2 = 34.0522; // Los Angeles
        const lon2 = -118.2437;
        
        const distance = polocClient.calculateDistance(lat1, lon1, lat2, lon2);
        console.log(`   Distance from SF to LA: ${Math.round(distance/1000)}km (${Math.round(distance)}m)\n`);

        // Demo 12: Finalize challenge (only if you have authority)
        console.log('🏁 Finalizing Challenge:');
        try {
            const tx = await polocClient.finalizeChallenge({
                challengeId,
                rStar: 100 // 100 meters final uncertainty
            });
            console.log(`   ✅ Challenge finalized! TX: ${tx}\n`);
        } catch (error) {
            console.log(`   ❌ Failed to finalize challenge: ${error.message}\n`);
        }

        // Demo 13: Claim reward (only if challenge is finalized and you're a winner)
        console.log('🏆 Claiming Reward:');
        try {
            const tx = await polocClient.claimReward({ challengeId });
            console.log(`   ✅ Reward claimed! TX: ${tx}\n`);
        } catch (error) {
            console.log(`   ❌ Failed to claim reward: ${error.message}\n`);
        }

        console.log('🎉 Demo completed successfully!');
        console.log('\n💡 Tips:');
        console.log('   - Use this client in your own applications');
        console.log('   - Handle errors appropriately in production');
        console.log('   - Add proper logging and monitoring');
        console.log('   - Consider adding retry logic for failed transactions');
        console.log('   - Add proper input validation');

    } catch (error) {
        console.error('❌ Demo failed:', error);
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
