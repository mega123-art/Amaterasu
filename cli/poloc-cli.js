#!/usr/bin/env node

const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const PolocClient = require('./poloc-client');

/**
 * Simple CLI interface for the Poloc program
 */
class PolocCLI {
    constructor() {
        this.connection = null;
        this.wallet = null;
        this.client = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Initialize the CLI
     */
    async init() {
        console.log('🚀 Poloc CLI - Location-Based Challenge System');
        console.log('=============================================\n');

        // Setup connection
        await this.setupConnection();
        
        // Setup wallet
        await this.setupWallet();
        
        // Initialize client
        this.client = new PolocClient(this.connection, this.wallet);
        console.log(`✅ Connected to Poloc program: ${this.client.programId.toString()}\n`);
    }

    /**
     * Setup connection to Solana
     */
    async setupConnection() {
        const endpoints = [
            { name: 'Localhost', url: 'http://localhost:8899' },
            { name: 'Devnet', url: 'https://api.devnet.solana.com' },
            { name: 'Mainnet', url: 'https://api.mainnet-beta.solana.com' },
            { name: 'Custom', url: null }
        ];

        console.log('🌐 Select Solana endpoint:');
        endpoints.forEach((endpoint, index) => {
            console.log(`   ${index + 1}. ${endpoint.name}`);
        });

        const choice = await this.question('Enter your choice (1-4): ');
        let endpoint;

        if (choice === '4') {
            endpoint = await this.question('Enter custom RPC URL: ');
        } else {
            endpoint = endpoints[parseInt(choice) - 1]?.url;
        }

        this.connection = new Connection(endpoint, 'confirmed');
        console.log(`✅ Connected to: ${endpoint}\n`);
    }

    /**
     * Setup wallet
     */
    async setupWallet() {
        console.log('💳 Wallet Setup:');
        console.log('   1. Load from file');
        console.log('   2. Generate new wallet');
        console.log('   3. Enter private key');

        const choice = await this.question('Enter your choice (1-3): ');

        switch (choice) {
            case '1':
                await this.loadWalletFromFile();
                break;
            case '2':
                this.wallet = Keypair.generate();
                console.log(`🆕 New wallet created: ${this.wallet.publicKey.toString()}`);
                break;
            case '3':
                await this.loadWalletFromPrivateKey();
                break;
            default:
                console.log('Invalid choice, generating new wallet...');
                this.wallet = Keypair.generate();
                console.log(`🆕 New wallet created: ${this.wallet.publicKey.toString()}`);
        }

        // Show balance
        const balance = await this.connection.getBalance(this.wallet.publicKey);
        console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
    }

    /**
     * Load wallet from file
     */
    async loadWalletFromFile() {
        try {
            const walletPath = await this.question('Enter wallet file path (default: ../wallet.json): ') || '../wallet.json';
            const walletData = JSON.parse(fs.readFileSync(path.join(__dirname, walletPath), 'utf8'));
            this.wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
            console.log(`✅ Wallet loaded: ${this.wallet.publicKey.toString()}`);
        } catch (error) {
            console.log('❌ Failed to load wallet, generating new one...');
            this.wallet = Keypair.generate();
            console.log(`🆕 New wallet created: ${this.wallet.publicKey.toString()}`);
        }
    }

    /**
     * Load wallet from private key
     */
    async loadWalletFromPrivateKey() {
        try {
            const privateKey = await this.question('Enter private key (base58): ');
            const secretKey = new Uint8Array(JSON.parse(privateKey));
            this.wallet = Keypair.fromSecretKey(secretKey);
            console.log(`✅ Wallet loaded: ${this.wallet.publicKey.toString()}`);
        } catch (error) {
            console.log('❌ Failed to load wallet, generating new one...');
            this.wallet = Keypair.generate();
            console.log(`🆕 New wallet created: ${this.wallet.publicKey.toString()}`);
        }
    }

    /**
     * Show main menu
     */
    async showMainMenu() {
        while (true) {
            console.log('\n📋 Main Menu:');
            console.log('   1. 🎯 Create Challenge');
            console.log('   2. 💰 Stake in Challenge');
            console.log('   3. 🗳️  Submit Vote');
            console.log('   4. 🏁 Finalize Challenge');
            console.log('   5. 🏆 Claim Reward');
            console.log('   6. 💸 Refund Failed Challenge');
            console.log('   7. ⚡ Slash Challenger');
            console.log('   8. 📊 View Challenge');
            console.log('   9. 💎 View Stake');
            console.log('   10. 🗳️  View Vote');
            console.log('   11. 📚 View All Challenges');
            console.log('   12. 📈 Program Statistics');
            console.log('   13. 🔄 Refresh Balance');
            console.log('   0. 🚪 Exit');

            const choice = await this.question('\nEnter your choice (0-13): ');

            switch (choice) {
                case '0':
                    console.log('👋 Goodbye!');
                    this.rl.close();
                    return;
                case '1':
                    await this.createChallenge();
                    break;
                case '2':
                    await this.stakeInChallenge();
                    break;
                case '3':
                    await this.submitVote();
                    break;
                case '4':
                    await this.finalizeChallenge();
                    break;
                case '5':
                    await this.claimReward();
                    break;
                case '6':
                    await this.refundFailedChallenge();
                    break;
                case '7':
                    await this.slashChallenger();
                    break;
                case '8':
                    await this.viewChallenge();
                    break;
                case '9':
                    await this.viewStake();
                    break;
                case '10':
                    await this.viewVote();
                    break;
                case '11':
                    await this.viewAllChallenges();
                    break;
                case '12':
                    await this.showProgramStats();
                    break;
                case '13':
                    await this.refreshBalance();
                    break;
                default:
                    console.log('❌ Invalid choice');
            }
        }
    }

    /**
     * Create a new challenge
     */
    async createChallenge() {
        console.log('\n🎯 Create New Challenge:');
        
        const challengeId = await this.question('Challenge ID: ');
        const lat = parseFloat(await this.question('Latitude (decimal degrees): '));
        const lon = parseFloat(await this.question('Longitude (decimal degrees): '));
        const duration = parseInt(await this.question('Duration (seconds): '));
        const rewardPool = parseFloat(await this.question('Reward Pool (SOL): ')) * LAMPORTS_PER_SOL;

        try {
            const microLat = this.client.decimalToMicroDegrees(lat);
            const microLon = this.client.decimalToMicroDegrees(lon);

            const tx = await this.client.initializeChallenge({
                challengeId,
                claimedLat: microLat,
                claimedLon: microLon,
                duration,
                rewardPool
            });

            console.log(`✅ Challenge created successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to create challenge: ${error.message}`);
        }
    }

    /**
     * Stake in a challenge
     */
    async stakeInChallenge() {
        console.log('\n💰 Stake in Challenge:');
        
        const challengeId = await this.question('Challenge ID: ');
        const amount = parseFloat(await this.question('Amount (SOL): ')) * LAMPORTS_PER_SOL;

        try {
            const tx = await this.client.stake({ challengeId, amount });
            console.log(`✅ Staked successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to stake: ${error.message}`);
        }
    }

    /**
     * Submit a vote
     */
    async submitVote() {
        console.log('\n🗳️  Submit Vote:');
        
        const challengeId = await this.question('Challenge ID: ');
        const challengerId = await this.question('Challenger ID: ');
        const isValid = (await this.question('Is valid (y/n): ')).toLowerCase() === 'y';
        const uncertainty = parseInt(await this.question('Uncertainty (meters): '));
        const minRtt = parseInt(await this.question('Min RTT (microseconds): '));

        try {
            const tx = await this.client.submitVote({
                challengeId,
                challengerId,
                isValid,
                uncertainty,
                minRtt
            });
            console.log(`✅ Vote submitted successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to submit vote: ${error.message}`);
        }
    }

    /**
     * Finalize a challenge
     */
    async finalizeChallenge() {
        console.log('\n🏁 Finalize Challenge:');
        
        const challengeId = await this.question('Challenge ID: ');
        const rStar = parseInt(await this.question('Final uncertainty (meters): '));

        try {
            const tx = await this.client.finalizeChallenge({ challengeId, rStar });
            console.log(`✅ Challenge finalized successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to finalize challenge: ${error.message}`);
        }
    }

    /**
     * Claim reward
     */
    async claimReward() {
        console.log('\n🏆 Claim Reward:');
        
        const challengeId = await this.question('Challenge ID: ');

        try {
            const tx = await this.client.claimReward({ challengeId });
            console.log(`✅ Reward claimed successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to claim reward: ${error.message}`);
        }
    }

    /**
     * Refund failed challenge
     */
    async refundFailedChallenge() {
        console.log('\n💸 Refund Failed Challenge:');
        
        const challengeId = await this.question('Challenge ID: ');

        try {
            const tx = await this.client.refundFailedChallenge({ challengeId });
            console.log(`✅ Challenge refunded successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to refund challenge: ${error.message}`);
        }
    }

    /**
     * Slash challenger
     */
    async slashChallenger() {
        console.log('\n⚡ Slash Challenger:');
        
        const challengeId = await this.question('Challenge ID: ');
        const challengerPubkey = new PublicKey(await this.question('Challenger Public Key: '));

        try {
            const tx = await this.client.slash({ challengeId, challengerPubkey });
            console.log(`✅ Challenger slashed successfully! TX: ${tx}`);
        } catch (error) {
            console.log(`❌ Failed to slash challenger: ${error.message}`);
        }
    }

    /**
     * View challenge details
     */
    async viewChallenge() {
        console.log('\n📊 View Challenge:');
        
        const challengeId = await this.question('Challenge ID: ');
        const challenge = await this.client.getChallenge(challengeId);

        if (challenge) {
            console.log('\n📋 Challenge Details:');
            console.log(`   Challenge ID: ${challenge.challengeId}`);
            console.log(`   Waldo: ${challenge.waldo.toString()}`);
            console.log(`   Location: ${this.client.microDegreesToDecimal(challenge.claimedLat)}, ${this.client.microDegreesToDecimal(challenge.claimedLon)}`);
            console.log(`   Start Time: ${new Date(challenge.startTime * 1000).toISOString()}`);
            console.log(`   Deadline: ${new Date(challenge.deadline * 1000).toISOString()}`);
            console.log(`   Reward Pool: ${challenge.rewardPool / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Status: ${Object.keys(challenge.status)[0]}`);
            console.log(`   Participant Count: ${challenge.participantCount}`);
            console.log(`   Vote Count: ${challenge.voteCount}`);
        } else {
            console.log('❌ Challenge not found');
        }
    }

    /**
     * View stake details
     */
    async viewStake() {
        console.log('\n💎 View Stake:');
        
        const challengeId = await this.question('Challenge ID: ');
        const stake = await this.client.getStake(challengeId, this.wallet.publicKey);

        if (stake) {
            console.log('\n💎 Stake Details:');
            console.log(`   Challenger: ${stake.challenger.toString()}`);
            console.log(`   Challenge ID: ${stake.challengeId}`);
            console.log(`   Amount: ${stake.amount / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Timestamp: ${new Date(stake.timestamp * 1000).toISOString()}`);
            console.log(`   Slashed: ${stake.slashed}`);
        } else {
            console.log('❌ Stake not found');
        }
    }

    /**
     * View vote details
     */
    async viewVote() {
        console.log('\n🗳️  View Vote:');
        
        const challengeId = await this.question('Challenge ID: ');
        const vote = await this.client.getVote(challengeId, this.wallet.publicKey);

        if (vote) {
            console.log('\n🗳️  Vote Details:');
            console.log(`   Challenger: ${vote.challenger.toString()}`);
            console.log(`   Challenge ID: ${vote.challengeId}`);
            console.log(`   Challenger ID: ${vote.challengerId}`);
            console.log(`   Valid: ${vote.isValid}`);
            console.log(`   Uncertainty: ${vote.uncertainty}m`);
            console.log(`   Min RTT: ${vote.minRtt}μs`);
            console.log(`   Timestamp: ${new Date(vote.timestamp * 1000).toISOString()}`);
            console.log(`   Processed: ${vote.processed}`);
        } else {
            console.log('❌ Vote not found');
        }
    }

    /**
     * View all challenges
     */
    async viewAllChallenges() {
        console.log('\n📚 All Challenges:');
        
        const challenges = await this.client.getChallengesByWallet(this.wallet.publicKey);
        
        if (challenges.length > 0) {
            console.log(`\nFound ${challenges.length} challenges:\n`);
            challenges.forEach((challenge, index) => {
                const account = challenge.account;
                console.log(`${index + 1}. ${account.challengeId}`);
                console.log(`   Location: ${this.client.microDegreesToDecimal(account.claimedLat)}, ${this.client.microDegreesToDecimal(account.claimedLon)}`);
                console.log(`   Status: ${Object.keys(account.status)[0]}`);
                console.log(`   Reward Pool: ${account.rewardPool / LAMPORTS_PER_SOL} SOL`);
                console.log(`   Participants: ${account.participantCount}`);
                console.log('');
            });
        } else {
            console.log('No challenges found');
        }
    }

    /**
     * Show program statistics
     */
    async showProgramStats() {
        console.log('\n📈 Program Statistics:');
        
        const stats = await this.client.getProgramStats();
        
        if (stats) {
            console.log(`   Total Challenges: ${stats.totalChallenges}`);
            console.log(`   Total Stakes: ${stats.totalStakes}`);
            console.log(`   Total Votes: ${stats.totalVotes}`);
            console.log(`   Active Challenges: ${stats.activeChallenges}`);
            console.log(`   Finalized Challenges: ${stats.finalizedChallenges}`);
            console.log(`   Expired Challenges: ${stats.expiredChallenges}`);
            console.log(`   Total Reward Pool: ${stats.totalRewardPool / LAMPORTS_PER_SOL} SOL`);
        } else {
            console.log('❌ Failed to get program statistics');
        }
    }

    /**
     * Refresh wallet balance
     */
    async refreshBalance() {
        const balance = await this.connection.getBalance(this.wallet.publicKey);
        console.log(`💰 Current Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    /**
     * Helper method to ask questions
     */
    question(query) {
        return new Promise((resolve) => {
            this.rl.question(query, resolve);
        });
    }

    /**
     * Run the CLI
     */
    async run() {
        await this.init();
        await this.showMainMenu();
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new PolocCLI();
    cli.run().catch(console.error);
}

module.exports = PolocCLI;
