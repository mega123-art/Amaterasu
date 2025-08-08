# PoLoc - Byzantine Fault-Tolerant Proof-of-Location System

A decentralized, trustless location verification system built on Solana blockchain using Byzantine fault-tolerant consensus algorithms.

## 🎯 Overview

PoLoc (Proof-of-Location) is a sophisticated system that verifies geographic locations in a decentralized manner while being resistant to malicious actors. It combines blockchain technology with advanced mathematical algorithms to create a Byzantine fault-tolerant location proof system.

## 🏗️ Architecture

### Core Components

- **Smart Contracts (Rust/Anchor)**: Solana blockchain logic for challenge management
- **CLI Interface (Node.js)**: Command-line tools for system interaction
- **Mathematical Engine**: Advanced algorithms for location verification and Byzantine fault tolerance
- **Network Layer**: UDP-based pinging for RTT measurements

### Key Features

- **Byzantine Fault Tolerance**: Resistant to up to 1/3 malicious participants
- **Monotonic Curve Mapping**: Advanced delay-to-distance mapping algorithms
- **Matrix Completion**: Robust data analysis for corrupted measurements
- **Economic Incentives**: Stake-based participation with reward/slashing mechanisms

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Rust and Cargo
- Solana CLI tools
- Anchor Framework

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd poloc

# Install dependencies
npm install

# Build the smart contract
anchor build

# Generate TypeScript types
anchor build
```

### Running the System

#### 1. Start Local Validator (Optional)

```bash
# Start Solana local validator
solana-test-validator

# In another terminal, set cluster to localnet
solana config set --url localhost
```

#### 2. Deploy Smart Contract

```bash
# Deploy to localnet
anchor deploy

# Or deploy to devnet
anchor deploy --provider.cluster devnet
```

#### 3. Initialize CLI

```bash
# Initialize the PoLoc system
node cli/index.js init

# Check system status
node cli/index.js status
```

#### 4. Create a Challenge

```bash
# Create a new location challenge
node cli/index.js challenge --lat 40.7128 --lon -74.0060 --duration 3600 --reward 1.0
```

#### 5. Participate as Challenger

```bash
# List active challenges
node cli/index.js list

# Participate in a challenge
node cli/index.js participate <challenge-id> --stake 0.1
```

## 🧪 Testing

### Smart Contract Tests

```bash
# Run comprehensive smart contract tests
anchor test

# Run tests with local validator
anchor test --skip-local-validator

# Run specific test file
anchor test tests/basic-tests.ts
```

### CLI Tests

```bash
# Test CLI functionality
node cli/index.js --help
node cli/index.js status
node cli/index.js list

# Test challenger functionality
node cli/challenger.js ping --waldo 127.0.0.1 --port 8888 --count 10
```

### Test Coverage

The test suite includes:

- **Unit Tests**: Individual instruction testing
- **Integration Tests**: Full challenge lifecycle
- **Error Handling**: Invalid parameters and edge cases
- **Performance Tests**: RTT measurement accuracy
- **Byzantine Tests**: Malicious participant scenarios

## 📊 System Components

### Smart Contract Instructions

1. **`initialize_challenge`**: Create new location verification challenge
2. **`stake`**: Participants stake tokens to join challenge
3. **`submit_vote`**: Submit location verification votes with uncertainty data
4. **`finalize_challenge`**: Compute final results using consensus
5. **`distribute_rewards`**: Reward honest participants
6. **`slash`**: Penalize dishonest participants

### CLI Commands

- `init`: Initialize PoLoc system
- `status`: Show system status
- `challenge`: Create new challenge
- `list`: List active challenges
- `participate`: Join challenge as challenger
- `interactive`: Start interactive mode

### Mathematical Algorithms

- **Monotonic Envelope**: Delay-to-distance mapping
- **Robust PCA**: Matrix completion for corrupted data
- **R* Calculation**: Uncertainty threshold computation
- **Ratio-based Filtering**: Outlier detection

## 🔧 Configuration

### Environment Variables

```bash
# Solana cluster
SOLANA_CLUSTER=devnet  # or localnet, mainnet-beta

# RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Wallet path
WALLET_PATH=~/.config/solana/id.json
```

### Challenge Parameters

- **Duration**: 300-86400 seconds (5 minutes to 24 hours)
- **Reward Pool**: 0.001-10 SOL
- **Min Stake**: 0.001 SOL
- **Min Participants**: 3 challengers
- **R* Threshold**: 1000 meters (configurable)

## 📈 Performance Optimization

### RTT Measurement Settings

```javascript
// Optimized for speed (default)
this.PING_COUNT = 10;           // Pings per round
this.PING_INTERVAL = 25;        // ms between pings
this.MEASUREMENT_ROUNDS = 3;    // Rounds of measurements
this.TIMEOUT_MS = 2000;         // Ping timeout

// High accuracy (slower)
this.PING_COUNT = 20;           // More pings
this.PING_INTERVAL = 50;        // Longer intervals
this.MEASUREMENT_ROUNDS = 5;    // More rounds
this.TIMEOUT_MS = 5000;         // Longer timeout
```

### Phase Timing

```javascript
// Fast testing
setTimeout(() => {
  this.transitionToPhase(challengeId, "pinging");
}, 10000); // 10 seconds

// Production
setTimeout(() => {
  this.transitionToPhase(challengeId, "pinging");
}, 30000); // 30 seconds
```

## 🛠️ Development

### Project Structure

```
poloc/
├── programs/poloc/          # Smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs          # Main program
│   │   ├── state.rs        # Data structures
│   │   ├── errors.rs       # Error definitions
│   │   └── instructions/   # Smart contract instructions
├── cli/                     # Command-line interface
│   ├── index.js            # Main CLI
│   ├── anchorclient.js     # Blockchain client
│   ├── coordinator.js      # Challenge coordination
│   ├── challenger.js       # Challenger logic
│   ├── waldo.js           # Target logic
│   ├── geometry.js         # Geometric calculations
│   ├── matrixcompletion.js # Matrix algorithms
│   └── filters.js         # Data filtering
├── tests/                  # Test files
│   ├── poloc.ts           # Comprehensive tests
│   ├── basic-tests.ts     # Basic functionality
│   └── test-config.ts     # Test utilities
└── data/                   # Data storage
```

### Building

```bash
# Build smart contract
anchor build

# Build CLI
npm run build

# Run linter
npm run lint
npm run lint:fix
```

### Debugging

```bash
# Enable debug logging
DEBUG=poloc:* node cli/index.js

# Run with verbose output
node cli/index.js --verbose

# Test specific component
node cli/challenger.js ping --debug
```

## 🔒 Security Considerations

### Byzantine Fault Tolerance

- System tolerates up to 1/3 malicious participants
- Robust filtering removes outlier measurements
- Economic incentives discourage dishonest behavior
- Cryptographic verification of all transactions

### Network Security

- UDP-based pinging with nonce verification
- Timeout mechanisms prevent DoS attacks
- Rate limiting on challenge participation
- Stake-based sybil resistance

### Smart Contract Security

- Input validation on all parameters
- Access control for privileged operations
- Reentrancy protection
- Comprehensive error handling

## 📚 API Reference

### Smart Contract

See `programs/poloc/src/` for detailed instruction documentation.

### CLI API

```bash
# Challenge management
node cli/index.js challenge [options]
node cli/index.js list
node cli/index.js participate <id> [options]

# System management
node cli/index.js init [options]
node cli/index.js status
node cli/index.js interactive
```

### JavaScript API

```javascript
const { AnchorClient } = require('./cli/anchorclient');
const { ChallengeCoordinator } = require('./cli/coordinator');

// Initialize client
const client = new AnchorClient();
await client.initialize();

// Create challenge
const coordinator = new ChallengeCoordinator(client);
const challengeId = await coordinator.initializeChallenge({
  waldoId: 'waldo-1',
  claimedLocation: { lat: 40.7128, lon: -74.0060 },
  duration: 3600,
  rewardPool: 1000000
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Guidelines

- Follow Rust and JavaScript best practices
- Add comprehensive tests for new features
- Update documentation for API changes
- Ensure Byzantine fault tolerance is maintained
- Optimize for performance and security

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Solana Foundation for blockchain infrastructure
- Anchor Framework for smart contract development
- Academic research on Byzantine fault tolerance
- Community contributors and testers

## 📞 Support

For questions, issues, or contributions:

- Open an issue on GitHub
- Join our community discussions
- Check the documentation
- Review the test suite for examples

---

**PoLoc** - Decentralized, Trustless, Byzantine Fault-Tolerant Location Verification
