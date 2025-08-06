// cli/run-waldo.js - Standalone Waldo Runner

const chalk = require('chalk');
const { AnchorClient } = require('./anchorClient');
const { ChallengeCoordinator } = require('./coordinator');

async function runWaldo() {
  try {
    console.log(chalk.blue('👤 Starting Waldo (Location Prover)...'));
    
    // Initialize system
    const anchorClient = new AnchorClient();
    await anchorClient.initialize();
    
    const coordinator = new ChallengeCoordinator(anchorClient);
    
    // Get location from command line or prompt
    const args = process.argv.slice(2);
    let lat, lon;
    
    if (args.length >= 2) {
      lat = parseFloat(args[0]);
      lon = parseFloat(args[1]);
    } else {
      console.log(chalk.yellow('Usage: node run-waldo.js <latitude> <longitude>'));
      console.log(chalk.yellow('Example: node run-waldo.js 40.7128 -74.0060'));
      process.exit(1);
    }
    
    if (isNaN(lat) || isNaN(lon)) {
      console.error(chalk.red('❌ Invalid coordinates'));
      process.exit(1);
    }
    
    console.log(chalk.green(`📍 Claiming location: ${lat}, ${lon}`));
    
    // Create challenge
    const challengeId = await coordinator.initializeChallenge({
      waldoId: 'waldo-runner',
      waldoPublicKey: anchorClient.wallet.publicKey,
      claimedLocation: { lat, lon },
      duration: 300, // 5 minutes
      rewardPool: 10000000 // 0.01 SOL
    });
    
    console.log(chalk.green(`✅ Challenge created: ${challengeId}`));
    
    // Monitor challenge progress
    coordinator.on('challengerRegistered', (data) => {
      console.log(chalk.blue(`🎯 New challenger registered: ${data.challengerId}`));
      console.log(`   Total participants: ${data.participantCount}`);
    });
    
    coordinator.on('pingResultsReceived', (data) => {
      console.log(chalk.blue(`📊 Ping results from ${data.challengerId}:`));
      console.log(`   Min RTT: ${data.minRTT}ms`);
      console.log(`   Uncertainty: ${data.uncertainty}m`);
    });
    
    coordinator.on('voteSubmitted', (data) => {
      console.log(chalk.blue(`🗳️  Vote from ${data.challengerId}: ${data.isValid ? 'VALID' : 'INVALID'}`));
      console.log(`   Total votes: ${data.voteCount}`);
    });
    
    coordinator.on('challengeFinalized', (data) => {
      console.log(chalk.green(`🏁 Challenge finalized!`));
      console.log(`   Result: ${data.results.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`   R*: ${data.results.rStar}m`);
      console.log(`   Valid votes: ${data.results.validVotes}/${data.results.totalVotes}`);
      
      if (data.results.passed) {
        console.log(chalk.green('🎉 Location proof successful!'));
      } else {
        console.log(chalk.red('❌ Location proof failed'));
      }
      
      process.exit(0);
    });
    
    // Keep running until challenge completes
    console.log(chalk.blue('⏳ Waiting for challengers and challenge completion...'));
    console.log(chalk.gray('   Press Ctrl+C to exit'));
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Shutting down Waldo...'));
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Waldo failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runWaldo();
}