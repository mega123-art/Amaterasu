#!/usr/bin/env node
/**
 * debug.js - Diagnostic script for troubleshooting Anchor program issues
 */

const fs = require("fs").promises;
const path = require("path");
const { AnchorClient } = require("./anchorclient.js");

async function diagnoseIDL() {
  console.log("🔍 Diagnosing IDL structure...\n");
  
  try {
    const idlPath = path.join(__dirname, "polocfinal.json");
    const idl = JSON.parse(await fs.readFile(idlPath, "utf8"));
    
    console.log("📋 IDL Analysis:");
    console.log(`   Format: ${idl.metadata?.spec || 'legacy'}`);
    console.log(`   Name: ${idl.metadata?.name || idl.name}`);
    console.log(`   Version: ${idl.metadata?.version || idl.version}`);
    console.log(`   Program Address: ${idl.address || idl.metadata?.address}`);
    
    console.log("\n📝 Instructions:");
    if (idl.instructions) {
      idl.instructions.forEach(instruction => {
        console.log(`   - ${instruction.name}`);
        if (instruction.accounts) {
          instruction.accounts.forEach(account => {
            console.log(`     └─ ${account.name} (${account.writable ? 'writable' : 'readonly'})`);
          });
        }
      });
    }
    
    console.log("\n🏛️  Account Types:");
    if (idl.accounts) {
      idl.accounts.forEach(account => {
        console.log(`   - ${account.name}`);
      });
    }
    
    console.log("\n📊 Data Types:");
    if (idl.types) {
      idl.types.forEach(type => {
        console.log(`   - ${type.name} (${type.type.kind})`);
      });
    }
    
    console.log("\n⚠️  Error Codes:");
    if (idl.errors) {
      idl.errors.slice(0, 5).forEach(error => {
        console.log(`   - ${error.code}: ${error.name} - ${error.msg}`);
      });
      if (idl.errors.length > 5) {
        console.log(`   ... and ${idl.errors.length - 5} more errors`);
      }
    }
    
  } catch (error) {
    console.error("❌ Failed to analyze IDL:", error.message);
  }
}

async function testConnection() {
  console.log("\n🔗 Testing connection and program loading...\n");
  
  try {
    const client = await AnchorClient.create();
    console.log("✅ Successfully created AnchorClient");
    
    console.log(`   Program ID: ${client.program.programId.toString()}`);
    console.log(`   Wallet: ${client.wallet.publicKey.toString()}`);
    console.log(`   Balance: ${await client.getWalletBalance()} SOL`);
    
    console.log("\n📋 Available program methods:");
    const methods = Object.keys(client.program.methods);
    methods.forEach(method => {
      console.log(`   - ${method}`);
    });
    
    console.log("\n🏛️  Available account types:");
    const accountTypes = Object.keys(client.program.account);
    accountTypes.forEach(accountType => {
      console.log(`   - ${accountType}`);
    });
    
  } catch (error) {
    console.error("❌ Failed to create client:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

async function testPDAGeneration() {
  console.log("\n🔑 Testing PDA generation...\n");
  
  try {
    const client = await AnchorClient.create();
    
    const testChallengeId = "test_challenge_123";
    const testWallet = client.wallet.publicKey;
    
    console.log(`Test Challenge ID: ${testChallengeId}`);
    console.log(`Test Wallet: ${testWallet.toString()}`);
    
    const challengePda = client._findChallengePda(testChallengeId);
    console.log(`   Challenge PDA: ${challengePda.toString()}`);
    
    const stakePda = client._findStakePda(testChallengeId, testWallet);
    console.log(`   Stake PDA: ${stakePda.toString()}`);
    
    const votePda = client._findVotePda(testChallengeId, testWallet);
    console.log(`   Vote PDA: ${votePda.toString()}`);
    
  } catch (error) {
    console.error("❌ Failed to generate PDAs:", error.message);
  }
}

async function getAllChallenges() {
  console.log("\n📊 Fetching all challenges from blockchain...\n");
  
  try {
    const client = await AnchorClient.create();
    const challenges = await client.getAllChallenges();
    
    console.log(`Found ${challenges.length} challenges:`);
    
    if (challenges.length === 0) {
      console.log("   No challenges found on the blockchain");
    } else {
      challenges.forEach((challenge, index) => {
        console.log(`\n   ${index + 1}. Challenge: ${challenge.id}`);
        console.log(`      Status: ${JSON.stringify(challenge.status)}`);
        console.log(`      Location: ${challenge.claimedLocation.lat}, ${challenge.claimedLocation.lon}`);
        console.log(`      Participants: ${challenge.participantCount}`);
        console.log(`      Votes: ${challenge.voteCount}`);
        console.log(`      Reward: ${challenge.rewardPool / 1000000} SOL`);
      });
    }
    
  } catch (error) {
    console.error("❌ Failed to fetch challenges:", error.message);
  }
}

async function main() {
  console.log("🚀 Poloc Debug Tool\n");
  console.log("=".repeat(50));
  
  await diagnoseIDL();
  await testConnection();
  await testPDAGeneration();
  await getAllChallenges();
  
  console.log("\n" + "=".repeat(50));
  console.log("✅ Diagnostic complete!");
}

if (require.main === module) {
  main().catch(error => {
    console.error("❌ Diagnostic failed:", error);
    process.exit(1);
  });
}

module.exports = {
  diagnoseIDL,
  testConnection,
  testPDAGeneration,
  getAllChallenges
};