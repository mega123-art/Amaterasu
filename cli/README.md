# Poloc Client - Location-Based Challenge System

A comprehensive, modern client for the Poloc Solana program that provides clean interfaces for all program instructions and account management.

## 🚀 Features

- **Complete IDL Integration**: Full support for all program instructions
- **Clean API**: Modern, promise-based interface with proper error handling
- **PDA Management**: Automatic Program Derived Address generation
- **Account Queries**: Easy access to challenge, stake, and vote data
- **CLI Interface**: Interactive command-line tool for testing and management
- **Utility Functions**: Geographic calculations and data conversions
- **Comprehensive Examples**: Demo scripts and usage patterns

## 📦 Installation

The client is already included in your project. Make sure you have the required dependencies:

```bash
npm install @coral-xyz/anchor @solana/web3.js
```

## 🔧 Usage

### Basic Client Setup

```javascript
const { Connection, Keypair } = require('@solana/web3.js');
const PolocClient = require('./poloc-client');

// Setup connection and wallet
const connection = new Connection('http://localhost:8899', 'confirmed');
const wallet = Keypair.fromSecretKey(/* your private key */);

// Initialize client
const polocClient = new PolocClient(connection, wallet);
```

### Creating a Challenge

```javascript
const challengeId = 'my-challenge-123';
const lat = 37.7749; // San Francisco
const lon = -122.4194;
const duration = 3600; // 1 hour
const rewardPool = 0.1 * 1e9; // 0.1 SOL in lamports

const tx = await polocClient.initializeChallenge({
    challengeId,
    claimedLat: polocClient.decimalToMicroDegrees(lat),
    claimedLon: polocClient.decimalToMicroDegrees(lon),
    duration,
    rewardPool
});

console.log(`Challenge created: ${tx}`);
```

### Staking in a Challenge

```javascript
const tx = await polocClient.stake({
    challengeId: 'my-challenge-123',
    amount: 0.05 * 1e9 // 0.05 SOL in lamports
});

console.log(`Staked successfully: ${tx}`);
```

### Submitting a Vote

```javascript
const tx = await polocClient.submitVote({
    challengeId: 'my-challenge-123',
    challengerId: 'challenger-456',
    isValid: true,
    uncertainty: 50, // 50 meters
    minRtt: 1000 // 1000 microseconds
});

console.log(`Vote submitted: ${tx}`);
```

### Querying Account Data

```javascript
// Get challenge details
const challenge = await polocClient.getChallenge('my-challenge-123');
if (challenge) {
    console.log(`Location: ${polocClient.microDegreesToDecimal(challenge.claimedLat)}, ${polocClient.microDegreesToDecimal(challenge.claimedLon)}`);
    console.log(`Status: ${Object.keys(challenge.status)[0]}`);
    console.log(`Reward Pool: ${challenge.rewardPool / 1e9} SOL`);
}

// Get stake information
const stake = await polocClient.getStake('my-challenge-123', wallet.publicKey);
if (stake) {
    console.log(`Staked Amount: ${stake.amount / 1e9} SOL`);
    console.log(`Timestamp: ${new Date(stake.timestamp * 1000).toISOString()}`);
}

// Get vote information
const vote = await polocClient.getVote('my-challenge-123', wallet.publicKey);
if (vote) {
    console.log(`Vote Valid: ${vote.isValid}`);
    console.log(`Uncertainty: ${vote.uncertainty}m`);
    console.log(`Min RTT: ${vote.minRtt}μs`);
}
```

### Program Statistics

```javascript
const stats = await polocClient.getProgramStats();
console.log(`Total Challenges: ${stats.totalChallenges}`);
console.log(`Active Challenges: ${stats.activeChallenges}`);
console.log(`Total Reward Pool: ${stats.totalRewardPool / 1e9} SOL`);
```

## 🖥️ CLI Interface

The project includes an interactive CLI tool for easy program interaction:

```bash
node cli/poloc-cli.js
```

### CLI Features

- **Connection Management**: Choose between localhost, devnet, mainnet, or custom RPC
- **Wallet Setup**: Load from file, generate new, or enter private key
- **Interactive Menus**: Easy navigation through all program functions
- **Real-time Feedback**: Immediate transaction results and error messages
- **Balance Tracking**: Monitor wallet balance during operations

### CLI Menu Options

1. 🎯 Create Challenge
2. 💰 Stake in Challenge
3. 🗳️ Submit Vote
4. 🏁 Finalize Challenge
5. 🏆 Claim Reward
6. 💸 Refund Failed Challenge
7. ⚡ Slash Challenger
8. 📊 View Challenge
9. 💎 View Stake
10. 🗳️ View Vote
11. 📚 View All Challenges
12. 📈 Program Statistics
13. 🔄 Refresh Balance
0. 🚪 Exit

## 🧪 Demo Script

Run the comprehensive demo to see all features in action:

```bash
node cli/poloc-client-demo.js
```

The demo covers:
- Program initialization
- Challenge creation
- Staking and voting
- Account queries
- Geographic calculations
- Error handling

## 🔍 Available Methods

### Core Instructions

- `initializeChallenge(params)` - Create a new location challenge
- `stake(params)` - Stake tokens to participate
- `submitVote(params)` - Submit vote with location validation
- `finalizeChallenge(params)` - Finalize challenge results
- `claimReward(params)` - Claim rewards for successful participation
- `refundFailedChallenge(params)` - Refund failed challenges
- `slash(params)` - Slash dishonest participants

### Account Queries

- `getChallenge(challengeId)` - Get challenge account data
- `getStake(challengeId, challenger)` - Get stake account data
- `getVote(challengeId, challenger)` - Get vote account data
- `getChallengesByWallet(wallet)` - Get all challenges for a wallet
- `getStakesByChallenge(challengeId)` - Get all stakes for a challenge
- `getVotesByChallenge(challengeId)` - Get all votes for a challenge

### Utility Functions

- `getChallengePda(challengeId)` - Generate challenge PDA
- `getStakePda(challengeId, challenger)` - Generate stake PDA
- `getVotePda(challengeId, challenger)` - Generate vote PDA
- `microDegreesToDecimal(microDegrees)` - Convert micro-degrees to decimal
- `decimalToMicroDegrees(decimalDegrees)` - Convert decimal to micro-degrees
- `calculateDistance(lat1, lon1, lat2, lon2)` - Calculate distance between points

### Program Management

- `getProgramStats()` - Get comprehensive program statistics

## 📍 Geographic Utilities

The client includes helpful geographic utilities:

```javascript
// Convert between coordinate formats
const lat = 37.7749;
const microLat = polocClient.decimalToMicroDegrees(lat);
const decimalLat = polocClient.microDegreesToDecimal(microLat);

// Calculate distances
const distance = polocClient.calculateDistance(
    37.7749, -122.4194, // San Francisco
    34.0522, -118.2437  // Los Angeles
);
console.log(`Distance: ${Math.round(distance/1000)}km`);
```

## 🛠️ Error Handling

All methods include comprehensive error handling:

```javascript
try {
    const tx = await polocClient.initializeChallenge(params);
    console.log(`✅ Success: ${tx}`);
} catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    // Handle specific error types
    if (error.message.includes('ChallengeNotFound')) {
        console.log('Challenge does not exist');
    } else if (error.message.includes('InsufficientStake')) {
        console.log('Not enough SOL to stake');
    }
}
```

## 🔐 Security Considerations

- **Private Keys**: Never hardcode private keys in production code
- **RPC Endpoints**: Use secure, trusted RPC endpoints
- **Transaction Signing**: Always verify transaction details before signing
- **Error Messages**: Be careful not to expose sensitive information in error logs

## 🚀 Production Usage

For production applications:

1. **Environment Variables**: Store RPC URLs and program IDs in environment variables
2. **Wallet Management**: Use secure wallet management solutions
3. **Rate Limiting**: Implement appropriate rate limiting for RPC calls
4. **Monitoring**: Add logging and monitoring for all transactions
5. **Retry Logic**: Implement retry logic for failed transactions
6. **Input Validation**: Validate all user inputs before sending transactions

## 📚 Examples

See the `poloc-client-demo.js` file for comprehensive examples of all features.

## 🤝 Contributing

The client is designed to be easily extensible. To add new features:

1. Add new methods to the `PolocClient` class
2. Update the CLI interface if needed
3. Add comprehensive error handling
4. Include JSDoc documentation
5. Add tests for new functionality

## 📄 License

This client is part of the Poloc project and follows the same license terms.
