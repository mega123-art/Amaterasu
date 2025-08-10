// cli/index.js - Main CLI Entry Point


const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { AnchorClient } = require('./anchorclient');
const { ChallengeCoordinator } = require('./coordinator');

const program = new Command();

// Global configuration
let anchorClient = null;
let coordinator = null;

program
  .name('poloc')
  .description('Byzantine Fault-Tolerant Proof-of-Location System')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the PoLoc system')
  .option('-w, --wallet <path>', 'Wallet file path', 'wallet.json')
  .option('-r, --rpc <url>', 'RPC endpoint URL')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing Byzantine PoLoc System...'));
      
      // Initialize Anchor client
      anchorClient = await AnchorClient.create(options.wallet, options.rpc);
      
      // Initialize coordinator
      coordinator = new ChallengeCoordinator(anchorClient);
      
      // Check balance and offer airdrop if needed
      const balance = await anchorClient.getWalletBalance();
      if (balance < 0.01) {
        console.log(chalk.yellow(`💰 Low balance: ${balance.toFixed(4)} SOL`));
        
        const { requestAirdrop } = await inquirer.prompt([{
          type: 'confirm',
          name: 'requestAirdrop',
          message: 'Request devnet airdrop?',
          default: true
        }]);
        
        if (requestAirdrop) {
          await anchorClient.requestAirdrop(1);
        }
      }
      
      // Display status
      const status = await anchorClient.getStatus();
      console.log(chalk.green('\n✅ System initialized successfully!'));
      console.log(`   Wallet: ${status.wallet}`);
      console.log(`   Balance: ${status.balanceFormatted}`);
      console.log(`   Network: ${status.network}`);
      console.log(`   Program: ${status.programId}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show system status')
  .action(async () => {
    try {
      if (!anchorClient) {
        anchorClient = new AnchorClient();
        await anchorClient.initialize();
      }
      
      const status = await anchorClient.getStatus();
      const activeChallenges = await anchorClient.getActiveChallenges();
      
      console.log(chalk.blue('📊 PoLoc System Status\n'));
      console.log(`   Wallet: ${status.wallet}`);
      console.log(`   Balance: ${status.balanceFormatted}`);
      console.log(`   Network: ${status.network}`);
      console.log(`   Program: ${status.programId}`);
      console.log(`   Blockchain: ${status.isRealBlockchain ? 'Live' : 'Mock'}`);
      console.log(`   Active Challenges: ${activeChallenges.length}`);
      
      if (status.mockStats) {
        console.log(chalk.gray('\n   Mock Storage:'));
        console.log(`     Challenges: ${status.mockStats.challenges}`);
        console.log(`     Stakes: ${status.mockStats.stakes}`);
        console.log(`     Votes: ${status.mockStats.votes}`);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error.message);
    }
  });

// Create challenge command
program
  .command('challenge')
  .description('Create a new location proof challenge')
  .option('-lat, --latitude <lat>', 'Claimed latitude')
  .option('-lon, --longitude <lon>', 'Claimed longitude') 
  .option('-d, --duration <seconds>', 'Challenge duration in seconds', '300')
  .option('-r, --reward <lamports>', 'Reward pool in lamports', '10000000')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🎯 Creating new PoLoc challenge...'));
      
      // Initialize if needed
      if (!coordinator) {
        anchorClient = new AnchorClient();
        await anchorClient.initialize();
        coordinator = new ChallengeCoordinator(anchorClient);
      }
      
      // Get location from user if not provided
      let lat = parseFloat(options.latitude);
      let lon = parseFloat(options.longitude);
      
      if (isNaN(lat) || isNaN(lon)) {
        const location = await inquirer.prompt([
          {
            type: 'input',
            name: 'lat',
            message: 'Enter claimed latitude:',
            validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
          },
          {
            type: 'input', 
            name: 'lon',
            message: 'Enter claimed longitude:',
            validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
          }
        ]);
        
        lat = parseFloat(location.lat);
        lon = parseFloat(location.lon);
      }
      
      // Create challenge
      const challengeId = await coordinator.initializeChallenge({
        waldoId: 'cli-waldo',
        waldoPublicKey: anchorClient.wallet.publicKey,
        claimedLocation: { lat, lon },
        duration: parseInt(options.duration),
        rewardPool: parseInt(options.reward)
      });
      
      console.log(chalk.green(`✅ Challenge created: ${challengeId}`));
      console.log(`   Location: ${lat}, ${lon}`);
      console.log(`   Duration: ${options.duration}s`);
      console.log(`   Reward: ${anchorClient.formatSOL(options.reward)}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create challenge:'), error.message);
    }
  });

// List challenges command
program
  .command('list')
  .description('List active challenges')
  .action(async () => {
    try {
      if (!anchorClient) {
        anchorClient = new AnchorClient();
        await anchorClient.initialize();
      }
      
      const challenges = await anchorClient.getActiveChallenges();
      
      if (challenges.length === 0) {
        console.log(chalk.yellow('📋 No active challenges found'));
        return;
      }
      
      console.log(chalk.blue(`📋 Active Challenges (${challenges.length})\n`));
      
      for (const challenge of challenges) {
        const timeRemaining = anchorClient.formatTimeRemaining(challenge.deadline);
        
        console.log(`   🎯 ${challenge.id.substring(0, 8)}...`);
        console.log(`      Location: ${challenge.claimedLocation.lat}, ${challenge.claimedLocation.lon}`);
        console.log(`      Participants: ${challenge.participantCount || 0}`);
        console.log(`      Votes: ${challenge.voteCount || 0}`);
        console.log(`      Time Remaining: ${timeRemaining}`);
        console.log(`      Reward: ${anchorClient.formatSOL(challenge.rewardPool)}`);
        console.log('');
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list challenges:'), error.message);
    }
  });

// Participate as challenger
program
  .command('participate <challengeId>')
  .description('Participate in a challenge as a challenger')
  .option('-lat, --latitude <lat>', 'Your latitude')
  .option('-lon, --longitude <lon>', 'Your longitude')
  .option('-s, --stake <lamports>', 'Stake amount in lamports', '1000000')
  .action(async (challengeId, options) => {
    try {
      console.log(chalk.blue(`🎯 Participating in challenge ${challengeId}...`));
      
      // Initialize if needed
      if (!coordinator) {
        anchorClient = new AnchorClient();
        await anchorClient.initialize();
        coordinator = new ChallengeCoordinator(anchorClient);
      }
      
      // Get location from user if not provided
      let lat = parseFloat(options.latitude);
      let lon = parseFloat(options.longitude);
      
      if (isNaN(lat) || isNaN(lon)) {
        const location = await inquirer.prompt([
          {
            type: 'input',
            name: 'lat',
            message: 'Enter your latitude:',
            validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
          },
          {
            type: 'input',
            name: 'lon', 
            message: 'Enter your longitude:',
            validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
          }
        ]);
        
        lat = parseFloat(location.lat);
        lon = parseFloat(location.lon);
      }
      
      // Register as challenger
      await coordinator.registerChallenger(challengeId, {
        challengerId: `cli-challenger-${Date.now()}`,
        publicKey: anchorClient.wallet.publicKey,
        location: { lat, lon },
        stakeAmount: parseInt(options.stake)
      });
      
      console.log(chalk.green('✅ Successfully registered as challenger'));
      console.log(`   Your location: ${lat}, ${lon}`);
      console.log(`   Stake: ${anchorClient.formatSOL(options.stake)}`);
      
      // TODO: Automatically start pinging process
      console.log(chalk.blue('🔄 Starting ping measurements...'));
      console.log(chalk.yellow('   (Automatic pinging implementation pending)'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to participate:'), error.message);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.blue('🎮 PoLoc Interactive Mode\n'));
    
    while (true) {
      try {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📊 Show Status', value: 'status' },
            { name: '🎯 Create Challenge', value: 'challenge' },
            { name: '📋 List Challenges', value: 'list' },
            { name: '🎯 Participate in Challenge', value: 'participate' },
            { name: '🔧 System Management', value: 'manage' },
            { name: '❌ Exit', value: 'exit' }
          ]
        }]);
        
        if (action === 'exit') {
          console.log(chalk.blue('👋 Goodbye!'));
          break;
        }
        
        // Execute the selected action
        switch (action) {
          case 'status':
            await program.parseAsync(['node', 'poloc', 'status']);
            break;
          case 'challenge':
            await createChallengeInteractive();
            break;
          case 'list':
            await program.parseAsync(['node', 'poloc', 'list']);
            break;
          case 'participate':
            await participateInteractive();
            break;
          case 'manage':
            await systemManagement();
            break;
        }
        
        console.log(''); // Add spacing
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
      }
    }
  });

// Helper functions for interactive mode
async function createChallengeInteractive() {
  const params = await inquirer.prompt([
    {
      type: 'input',
      name: 'lat',
      message: 'Enter claimed latitude:',
      validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
    },
    {
      type: 'input',
      name: 'lon',
      message: 'Enter claimed longitude:',
      validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
    },
    {
      type: 'input',
      name: 'duration',
      message: 'Challenge duration (seconds):',
      default: '300',
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid number'
    },
    {
      type: 'input',
      name: 'reward',
      message: 'Reward pool (lamports):',
      default: '10000000',
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid number'
    }
  ]);
  
  await program.parseAsync([
    'node', 'poloc', 'challenge',
    '--latitude', params.lat,
    '--longitude', params.lon,
    '--duration', params.duration,
    '--reward', params.reward
  ]);
}

async function participateInteractive() {
  // First list challenges
  if (!anchorClient) {
    anchorClient = new AnchorClient();
    await anchorClient.initialize();
  }
  
  const challenges = await anchorClient.getActiveChallenges();
  
  if (challenges.length === 0) {
    console.log(chalk.yellow('📋 No active challenges found'));
    return;
  }
  
  const { challengeId } = await inquirer.prompt([{
    type: 'list',
    name: 'challengeId',
    message: 'Select challenge to participate in:',
    choices: challenges.map(c => ({
      name: `${c.id.substring(0, 8)}... (${c.claimedLocation.lat}, ${c.claimedLocation.lon})`,
      value: c.id
    }))
  }]);
  
  const params = await inquirer.prompt([
    {
      type: 'input',
      name: 'lat',
      message: 'Enter your latitude:',
      validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
    },
    {
      type: 'input',
      name: 'lon',
      message: 'Enter your longitude:',
      validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
    },
    {
      type: 'input',
      name: 'stake',
      message: 'Stake amount (lamports):',
      default: '1000000',
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid number'
    }
  ]);
  
  await program.parseAsync([
    'node', 'poloc', 'participate', challengeId,
    '--latitude', params.lat,
    '--longitude', params.lon,
    '--stake', params.stake
  ]);
}

async function systemManagement() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'System Management:',
    choices: [
      { name: '💰 Request Airdrop (Devnet)', value: 'airdrop' },
      { name: '🧹 Clear Mock Storage', value: 'clear' },
      { name: '💾 Save Mock Storage', value: 'save' },
      { name: '📁 Load Mock Storage', value: 'load' },
      { name: '🔄 Restart System', value: 'restart' },
      { name: '⬅️  Back', value: 'back' }
    ]
  }]);
  
  if (action === 'back') return;
  
  try {
    switch (action) {
      case 'airdrop':
        if (!anchorClient) {
          anchorClient = new AnchorClient();
          await anchorClient.initialize();
        }
        await anchorClient.requestAirdrop(1);
        break;
        
      case 'clear':
        if (anchorClient) {
          anchorClient.clearMockStorage();
        }
        break;
        
      case 'save':
        if (anchorClient) {
          await anchorClient.saveMockStorage();
        }
        break;
        
      case 'load':
        if (anchorClient) {
          await anchorClient.loadMockStorage();
        }
        break;
        
      case 'restart':
        anchorClient = null;
        coordinator = null;
        console.log(chalk.green('🔄 System restarted'));
        break;
    }
  } catch (error) {
    console.error(chalk.red('❌ Management action failed:'), error.message);
  }
}

// Help command
program
  .command('help')
  .description('Show detailed help')
  .action(() => {
    console.log(chalk.blue(`
🌟 Byzantine Fault-Tolerant Proof-of-Location System

OVERVIEW:
  This system implements a decentralized proof-of-location protocol where:
  - Waldo claims to be at a specific location
  - Multiple challengers ping Waldo and measure RTT
  - Byzantine fault tolerance filters out dishonest challengers
  - Geometry calculations compute uncertainty (R*)
  - Smart contracts manage staking, voting, and rewards

BASIC WORKFLOW:
  1. Initialize system: poloc init
  2. Create challenge: poloc challenge --latitude LAT --longitude LON
  3. Participate as challenger: poloc participate CHALLENGE_ID --latitude LAT --longitude LON
  4. System automatically handles pinging, voting, and finalization

COMMANDS:
  init                 Initialize the PoLoc system
  status              Show system status
  challenge           Create a new location proof challenge
  list                List active challenges
  participate <id>    Participate in a challenge as challenger
  interactive         Start interactive mode
  help                Show this help

EXAMPLES:
  poloc init
  poloc challenge --latitude 40.7128 --longitude -74.0060
  poloc participate abc123 --latitude 40.7580 --longitude -73.9855
  poloc interactive

TECHNICAL DETAILS:
  - Uses Solana blockchain with Anchor framework
  - Implements matrix completion for Byzantine detection
  - Applies angle-based geometry filtering
  - Computes R* uncertainty using Equation (6) from research paper
  - Automatic reward distribution to honest participants

For more information, see the research paper:
"Byzantine Fault-Tolerant Delay-Based Proof-of-Location via Internet Geometry"
`));
  });

// Error handling
program.exitOverride();

// Parse command line arguments
async function main() {
  try {
    await program.parseAsync();
  } catch (error) {
    if (error.code === 'commander.help') {
      // Help command was run, exit gracefully
      process.exit(0);
    } else if (error.code === 'commander.unknownCommand') {
      console.error(chalk.red('❌ Unknown command. Use "poloc help" for available commands.'));
      process.exit(1);
    } else {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { program };