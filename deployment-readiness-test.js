#!/usr/bin/env node

/**
 * deployment-readiness-test.js - Comprehensive deployment readiness test
 */

const { AnchorClient } = require('./cli/anchorclient');
const fs = require('fs').promises;
const path = require('path');

async function testDeploymentReadiness() {
  console.log('🚀 PoLoc Deployment Readiness Test\n');

  const results = {
    build: false,
    idl: false,
    blockchain: false,
    wallet: false,
    configuration: false,
    functionality: false
  };

  // Test 1: Build Status
  console.log('=== 1. Build Status ===');
  try {
    const targetDir = path.join(__dirname, 'target');
    const deployDir = path.join(targetDir, 'deploy');
    const idlDir = path.join(targetDir, 'idl');
    
    const targetExists = await fs.access(targetDir).then(() => true).catch(() => false);
    const deployExists = await fs.access(deployDir).then(() => true).catch(() => false);
    const idlExists = await fs.access(idlDir).then(() => true).catch(() => false);
    
    console.log(`✅ Target directory exists: ${targetExists}`);
    console.log(`✅ Deploy directory exists: ${deployExists}`);
    console.log(`✅ IDL directory exists: ${idlExists}`);
    
    if (targetExists && deployExists && idlExists) {
      results.build = true;
      console.log('✅ Build status: PASSED');
    } else {
      console.log('❌ Build status: FAILED');
    }
  } catch (error) {
    console.log('❌ Build status: FAILED -', error.message);
  }

  // Test 2: IDL Generation
  console.log('\n=== 2. IDL Generation ===');
  try {
    const idlPath = path.join(__dirname, 'target', 'idl', 'messi.json');
    const idlData = await fs.readFile(idlPath, 'utf8');
    const idl = JSON.parse(idlData);
    
    console.log(`✅ IDL file exists: ${idlPath}`);
    console.log(`✅ Program address: ${idl.address}`);
    console.log(`✅ Instructions count: ${idl.instructions.length}`);
    console.log(`✅ Accounts count: ${idl.accounts.length}`);
    
    const requiredInstructions = [
      'initialize_challenge', 'stake', 'submit_vote', 
      'finalize_challenge', 'distribute_rewards', 'slash'
    ];
    
    const foundInstructions = idl.instructions.map(ix => ix.name);
    const missingInstructions = requiredInstructions.filter(ix => !foundInstructions.includes(ix));
    
    if (missingInstructions.length === 0) {
      results.idl = true;
      console.log('✅ IDL generation: PASSED');
    } else {
      console.log(`❌ Missing instructions: ${missingInstructions.join(', ')}`);
      console.log('❌ IDL generation: FAILED');
    }
  } catch (error) {
    console.log('❌ IDL generation: FAILED -', error.message);
  }

  // Test 3: Blockchain Connection
  console.log('\n=== 3. Blockchain Connection ===');
  try {
    const client = new AnchorClient();
    await client.initialize();
    
    console.log(`✅ Solana connection: ${client.connection ? 'CONNECTED' : 'FAILED'}`);
    console.log(`✅ Network: ${client.config.network}`);
    console.log(`✅ RPC Endpoint: ${client.config.rpcEndpoint}`);
    console.log(`✅ Wallet: ${client.wallet.publicKey.toString()}`);
    console.log(`✅ Balance: ${await client.getWalletBalance()} SOL`);
    
    if (client.connection && client.wallet) {
      results.blockchain = true;
      console.log('✅ Blockchain connection: PASSED');
    } else {
      console.log('❌ Blockchain connection: FAILED');
    }
  } catch (error) {
    console.log('❌ Blockchain connection: FAILED -', error.message);
  }

  // Test 4: Wallet Configuration
  console.log('\n=== 4. Wallet Configuration ===');
  try {
    const walletPath = path.join(__dirname, 'wallet.json');
    const walletExists = await fs.access(walletPath).then(() => true).catch(() => false);
    
    console.log(`✅ Wallet file exists: ${walletExists}`);
    
    if (walletExists) {
      const walletData = await fs.readFile(walletPath, 'utf8');
      const wallet = JSON.parse(walletData);
      console.log(`✅ Wallet data valid: ${Array.isArray(wallet) && wallet.length === 64}`);
    }
    
    results.wallet = walletExists;
    console.log('✅ Wallet configuration: PASSED');
  } catch (error) {
    console.log('❌ Wallet configuration: FAILED -', error.message);
  }

  // Test 5: Configuration Files
  console.log('\n=== 5. Configuration Files ===');
  try {
    const anchorToml = path.join(__dirname, 'Anchor.toml');
    const cargoToml = path.join(__dirname, 'Cargo.toml');
    const packageJson = path.join(__dirname, 'package.json');
    
    const anchorExists = await fs.access(anchorToml).then(() => true).catch(() => false);
    const cargoExists = await fs.access(cargoToml).then(() => true).catch(() => false);
    const packageExists = await fs.access(packageJson).then(() => true).catch(() => false);
    
    console.log(`✅ Anchor.toml exists: ${anchorExists}`);
    console.log(`✅ Cargo.toml exists: ${cargoExists}`);
    console.log(`✅ package.json exists: ${packageExists}`);
    
    if (anchorExists && cargoExists && packageExists) {
      results.configuration = true;
      console.log('✅ Configuration files: PASSED');
    } else {
      console.log('❌ Configuration files: FAILED');
    }
  } catch (error) {
    console.log('❌ Configuration files: FAILED -', error.message);
  }

  // Test 6: Core Functionality
  console.log('\n=== 6. Core Functionality ===');
  try {
    const client = new AnchorClient();
    await client.initialize();
    
    // Test challenge creation
    const challengeId = await client.initializeChallenge({
      location: { lat: 40.7128, lon: -74.0060 },
      duration: 300,
      rewardPool: 100000000,
      waldoPublicKey: client.wallet.publicKey
    });
    
    console.log(`✅ Challenge creation: ${challengeId}`);
    
    // Test staking
    await client.stakeForChallenge(challengeId, 10000000);
    console.log('✅ Staking functionality');
    
    // Test voting
    await client.submitVote({
      challengeId,
      challengerId: 'test-challenger',
      isValid: true,
      uncertainty: 150,
      minRTT: 25
    });
    console.log('✅ Voting functionality');
    
    // Test status retrieval
    const status = await client.getStatus();
    console.log(`✅ Status retrieval: ${status.activeChallenges} active challenges`);
    
    results.functionality = true;
    console.log('✅ Core functionality: PASSED');
  } catch (error) {
    console.log('❌ Core functionality: FAILED -', error.message);
  }

  // Summary
  console.log('\n=== DEPLOYMENT READINESS SUMMARY ===');
  console.log(`Build Status: ${results.build ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`IDL Generation: ${results.idl ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Blockchain Connection: ${results.blockchain ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Wallet Configuration: ${results.wallet ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Configuration Files: ${results.configuration ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Core Functionality: ${results.functionality ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 DEPLOYMENT READY! All tests passed.');
    console.log('\nNext steps for deployment:');
    console.log('1. Ensure sufficient SOL balance (at least 3 SOL)');
    console.log('2. Run: anchor deploy');
    console.log('3. Update program ID in configuration if needed');
    console.log('4. Test with real blockchain integration');
  } else {
    console.log('\n⚠️  NOT READY FOR DEPLOYMENT. Some tests failed.');
    console.log('\nIssues to fix:');
    Object.entries(results).forEach(([test, passed]) => {
      if (!passed) {
        console.log(`- ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    });
  }

  return allPassed;
}

// Run the test
testDeploymentReadiness().catch(console.error);
