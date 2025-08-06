





// test/test-system.js - System Integration Test
const chalk = require('chalk');
const { AnchorClient } = require('../cli/anchorClient');
const { ChallengeCoordinator } = require('../cli/coordinator');
const { GeometryCalculator } = require('../cli/geometry');
const { MatrixCompletion } = require('../cli/matrixCompletion');

async function testSystem() {
  console.log(chalk.blue('🧪 Running PoLoc System Integration Test\n'));
  
  let testsPassed = 0;
  let totalTests = 0;
  
  function test(name, testFn) {
    totalTests++;
    try {
      console.log(chalk.blue(`📋 Testing: ${name}`));
      testFn();
      console.log(chalk.green(`   ✅ PASS\n`));
      testsPassed++;
    } catch (error) {
      console.log(chalk.red(`   ❌ FAIL: ${error.message}\n`));
    }
  }
  
  // Test 1: Anchor Client Initialization
  test('Anchor Client Initialization', async () => {
    const client = new AnchorClient();
    await client.initialize();
    
    if (!client.wallet) throw new Error('Wallet not initialized');
    if (!client.connection) throw new Error('Connection not established');
    console.log(`     Wallet: ${client.wallet.publicKey.toString()}`);
  });
  
  // Test 2: Challenge Coordinator
  test('Challenge Coordinator', async () => {
    const client = new AnchorClient();
    await client.initialize();
    
    const coordinator = new ChallengeCoordinator(client);
    const challengeId = await coordinator.initializeChallenge({
      waldoId: 'test-waldo',
      waldoPublicKey: client.wallet.publicKey,
      claimedLocation: { lat: 40.7128, lon: -74.0060 },
      duration: 60,
      rewardPool: 1000000
    });
    
    if (!challengeId) throw new Error('Challenge not created');
    console.log(`     Challenge ID: ${challengeId}`);
    
    const status = coordinator.getChallengeStatus(challengeId);
    if (!status) throw new Error('Challenge status not available');
  });
  
  // Test 3: Geometry Calculator
  test('Geometry Calculator', async () => {
    const geometry = new GeometryCalculator();
    
    const claimedLocation = { lat: 40.7128, lon: -74.0060 }; // NYC
    const challengers = [
      { id: 'c1', location: { lat: 40.7580, lon: -73.9855 }, uncertainty: 500 }, // Manhattan
      { id: 'c2', location: { lat: 40.6782, lon: -73.9442 }, uncertainty: 800 }, // Brooklyn
      { id: 'c3', location: { lat: 40.7505, lon: -73.9934 }, uncertainty: 600 }  // Midtown
    ];
    
    const rStar = await geometry.computeRStar(claimedLocation, challengers);
    
    if (typeof rStar !== 'number' || rStar < 0) {
      throw new Error('Invalid R* calculation');
    }
    
    console.log(`     R*: ${rStar.toFixed(2)}m`);
  });
  
  // Test 4: Matrix Completion
  test('Matrix Completion', async () => {
    const matrixCompletion = new MatrixCompletion();
    
    // Create test delay matrix with some corruption
    const testMatrix = [
      [50, 75, 100, 125, 150],
      [60, 85, 110, 135, 160],
      [70, 95, 120, 145, 170],
      [55, 80, 105, 130, 155]
    ];
    
    // Add corruption
    testMatrix[1][2] = 500; // Outlier
    testMatrix[3][4] = 1000; // Outlier
    
    const results = await matrixCompletion.robustPCA(testMatrix);
    
    if (!results.converged) {
      throw new Error('Matrix completion did not converge');
    }
    
    console.log(`     Convergence: ${results.iterations} iterations`);
    console.log(`     Estimated rank: ${results.rank}`);
    console.log(`     Sparsity: ${(results.sparsity * 100).toFixed(1)}%`);
  });
  
  // Test 5: End-to-End Challenge Flow
  test('End-to-End Challenge Flow', async () => {
    const client = new AnchorClient();
    await client.initialize();
    
    const coordinator = new ChallengeCoordinator(client);
    
    // Create challenge
    const challengeId = await coordinator.initializeChallenge({
      waldoId: 'test-e2e',
      waldoPublicKey: client.wallet.publicKey,
      claimedLocation: { lat: 40.7128, lon: -74.0060 },
      duration: 60,
      rewardPool: 5000000
    });
    
    // Register multiple challengers
    const challengerIds = [];
    for (let i = 0; i < 3; i++) {
      const challengerId = `test-challenger-${i}`;
      await coordinator.registerChallenger(challengeId, {
        challengerId,
        publicKey: client.wallet.publicKey,
        location: { 
          lat: 40.7128 + (Math.random() - 0.5) * 0.1, 
          lon: -74.0060 + (Math.random() - 0.5) * 0.1 
        },
        stakeAmount: 1000000
      });
      challengerIds.push(challengerId);
    }
    
    // Simulate ping results
    for (const challengerId of challengerIds) {
      await coordinator.submitPingResults(challengeId, challengerId, {
        minRTT: 50 + Math.random() * 50,
        avgRTT: 80 + Math.random() * 40,
        measurements: Array(10).fill(0).map(() => 50 + Math.random() * 100),
        uncertainty: 500 + Math.random() * 500
      });
    }
    
    // Simulate votes
    for (const challengerId of challengerIds) {
      await coordinator.submitVote(challengeId, challengerId, {
        isValid: Math.random() > 0.3,
        confidence: 0.7 + Math.random() * 0.3,
        uncertainty: 600 + Math.random() * 400,
        reasoning: 'Test vote'
      });
    }
    
    // Finalize challenge
    const results = await coordinator.finalizeChallenge(challengeId);
    
    if (!results) throw new Error('Challenge finalization failed');
    
    console.log(`     Result: ${results.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`     R*: ${results.rStar}m`);
    console.log(`     Valid votes: ${results.validVotes}/${results.totalVotes}`);
  });
  
  // Test Results
  console.log(chalk.blue('📊 Test Results:'));
  console.log(`   Tests passed: ${testsPassed}/${totalTests}`);
  
  if (testsPassed === totalTests) {
    console.log(chalk.green('🎉 All tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red('❌ Some tests failed'));
    process.exit(1);
  }
}

if (require.main === module) {
  testSystem().catch(error => {
    console.error(chalk.red('❌ Test suite failed:'), error.message);
    process.exit(1);
  });
}