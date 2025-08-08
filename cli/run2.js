// cli/run-challenger.js - Standalone Challenger Runner


const chalk = require('chalk');
const { AnchorClient } = require('./anchorclient');
const { ChallengeCoordinator } = require('./coordinator');

async function runChallenger() {
  try {
    console.log(chalk.blue('🎯 Starting Challenger...'));
    
    // Initialize system
    const anchorClient = new AnchorClient();
    await anchorClient.initialize();
    
    const coordinator = new ChallengeCoordinator(anchorClient);
    
    // Get challenge ID and location from command line
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log(chalk.yellow('Usage: node run-challenger.js <challengeId> <latitude> <longitude>'));
      console.log(chalk.yellow('Example: node run-challenger.js abc123 40.7580 -73.9855'));
      process.exit(1);
    }
    
    const challengeId = args[0];
    const lat = parseFloat(args[1]);
    const lon = parseFloat(args[2]);
    
    if (isNaN(lat) || isNaN(lon)) {
      console.error(chalk.red('❌ Invalid coordinates'));
      process.exit(1);
    }
    
    console.log(chalk.green(`📍 Challenger location: ${lat}, ${lon}`));
    console.log(chalk.blue(`🎯 Participating in challenge: ${challengeId}`));
    
    // Register as challenger
    const challengerId = `challenger-${Date.now()}`;
    await coordinator.registerChallenger(challengeId, {
      challengerId,
      publicKey: anchorClient.wallet.publicKey,
      location: { lat, lon },
      stakeAmount: 1000000 // 0.001 SOL
    });
    
    console.log(chalk.green(`✅ Registered as challenger: ${challengerId}`));
    
    // Listen for phase transitions
    coordinator.on('phaseTransition', async (data) => {
      if (data.challengeId !== challengeId) return;
      
      console.log(chalk.blue(`🔄 Phase transition: ${data.oldPhase} → ${data.newPhase}`));
      
      if (data.newPhase === 'pinging') {
        console.log(chalk.blue('📡 Starting ping measurements...'));
        // TODO: Implement actual pinging
        
        // Simulate ping results after delay
        setTimeout(async () => {
          const mockPingData = {
            minRTT: 50 + Math.random() * 100, // 50-150ms
            avgRTT: 80 + Math.random() * 50,  // 80-130ms  
            measurements: Array(20).fill(0).map(() => 50 + Math.random() * 100),
            uncertainty: 500 + Math.random() * 1000 // 500-1500m
          };
          
          await coordinator.submitPingResults(challengeId, challengerId, mockPingData);
          console.log(chalk.green('✅ Ping results submitted'));
        }, 5000);
        
      } else if (data.newPhase === 'voting') {
        console.log(chalk.blue('🗳️  Voting phase started'));
        
        // Simulate voting after delay
        setTimeout(async () => {
          const voteData = {
            isValid: Math.random() > 0.2, // 80% chance of valid vote
            confidence: 0.8 + Math.random() * 0.2,
            uncertainty: 800 + Math.random() * 400, // 800-1200m
            reasoning: 'Automated challenger vote'
          };
          
          await coordinator.submitVote(challengeId, challengerId, voteData);
          console.log(chalk.green(`✅ Vote submitted: ${voteData.isValid ? 'VALID' : 'INVALID'}`));
        }, 2000);
      }
    });
    
    coordinator.on('challengeFinalized', (data) => {
      if (data.challengeId !== challengeId) return;
      
      console.log(chalk.green(`🏁 Challenge completed!`));
      console.log(`   Result: ${data.results.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`   R*: ${data.results.rStar}m`);
      
      if (data.results.passed) {
        console.log(chalk.green('🎉 Honest participation rewarded!'));
      }
      
      process.exit(0);
    });
    
    // Keep running
    console.log(chalk.blue('⏳ Waiting for challenge phases...'));
    console.log(chalk.gray('   Press Ctrl+C to exit'));
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Shutting down challenger...'));
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Challenger failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runChallenger();
}