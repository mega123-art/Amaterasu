import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Poloc } from "../target/types/poloc";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("PoLoc Smart Contract Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.poloc as Program<Poloc>;
  const provider = anchor.getProvider();

  // Test accounts
  let waldo: Keypair;
  let challenger1: Keypair;
  let challenger2: Keypair;
  let challenger3: Keypair;
  let challengePda: PublicKey;
  let stakePda1: PublicKey;
  let stakePda2: PublicKey;
  let stakePda3: PublicKey;
  let votePda1: PublicKey;
  let votePda2: PublicKey;
  let votePda3: PublicKey;

  // Test data
  const challengeId = "test-challenge-001";
  const claimedLat = 40000000; // 40 degrees in micro-degrees
  const claimedLon = -74000000; // -74 degrees in micro-degrees
  const duration = 3600; // 1 hour
  const rewardPool = LAMPORTS_PER_SOL; // 1 SOL
  const stakeAmount = 100000000; // 0.1 SOL

  before(async () => {
    // Generate test keypairs
    waldo = Keypair.generate();
    challenger1 = Keypair.generate();
    challenger2 = Keypair.generate();
    challenger3 = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropAmount = 2 * LAMPORTS_PER_SOL;
    await provider.connection.requestAirdrop(waldo.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(challenger1.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(challenger2.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(challenger3.publicKey, airdropAmount);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Derive PDAs
    [challengePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("challenge"), Buffer.from(challengeId)],
      program.programId
    );

    [stakePda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), Buffer.from(challengeId), challenger1.publicKey.toBuffer()],
      program.programId
    );

    [stakePda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), Buffer.from(challengeId), challenger2.publicKey.toBuffer()],
      program.programId
    );

    [stakePda3] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), Buffer.from(challengeId), challenger3.publicKey.toBuffer()],
      program.programId
    );

    [votePda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), Buffer.from(challengeId), challenger1.publicKey.toBuffer()],
      program.programId
    );

    [votePda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), Buffer.from(challengeId), challenger2.publicKey.toBuffer()],
      program.programId
    );

    [votePda3] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), Buffer.from(challengeId), challenger3.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Challenge Initialization", () => {
    it("Should initialize a new challenge successfully", async () => {
      try {
        const tx = await program.methods
          .initializeChallenge(
            challengeId,
            claimedLat,
            claimedLon,
            duration,
            rewardPool
          )
          .accounts({
            challenge: challengePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Challenge initialized successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify challenge account was created
        const challengeAccount = await program.account.challenge.fetch(challengePda);
        expect(challengeAccount.challengeId).to.equal(challengeId);
        expect(challengeAccount.waldo.toString()).to.equal(waldo.publicKey.toString());
        expect(challengeAccount.claimedLat).to.equal(claimedLat);
        expect(challengeAccount.claimedLon).to.equal(claimedLon);
        expect(challengeAccount.rewardPool).to.equal(rewardPool);
        expect(challengeAccount.status.toString()).to.equal("Active");

        console.log("✅ Challenge account verification passed");
      } catch (error) {
        console.error("❌ Challenge initialization failed:", error);
        throw error;
      }
    });

    it("Should reject invalid challenge parameters", async () => {
      const invalidChallengeId = "invalid-challenge-002";
      const [invalidPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(invalidChallengeId)],
        program.programId
      );

      try {
        await program.methods
          .initializeChallenge(
            invalidChallengeId,
            91000000, // Invalid latitude (> 90 degrees)
            claimedLon,
            duration,
            rewardPool
          )
          .accounts({
            challenge: invalidPda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        throw new Error("Should have failed with invalid latitude");
      } catch (error) {
        console.log("✅ Invalid parameters correctly rejected");
        expect(error.toString()).to.include("InvalidParameters");
      }
    });
  });

  describe("Staking", () => {
    it("Should allow challengers to stake tokens", async () => {
      try {
        // Challenger 1 stakes
        const tx1 = await program.methods
          .stake(challengeId, stakeAmount)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda1,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        console.log("✅ Challenger 1 staked successfully");
        console.log(`   Transaction signature: ${tx1}`);

        // Challenger 2 stakes
        const tx2 = await program.methods
          .stake(challengeId, stakeAmount)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda2,
            challenger: challenger2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger2])
          .rpc();

        console.log("✅ Challenger 2 staked successfully");
        console.log(`   Transaction signature: ${tx2}`);

        // Verify stake accounts
        const stake1Account = await program.account.stake.fetch(stakePda1);
        const stake2Account = await program.account.stake.fetch(stakePda2);

        expect(stake1Account.challenger.toString()).to.equal(challenger1.publicKey.toString());
        expect(stake1Account.challengeId).to.equal(challengeId);
        expect(stake1Account.amount).to.equal(stakeAmount);
        expect(stake1Account.slashed).to.be.false;

        expect(stake2Account.challenger.toString()).to.equal(challenger2.publicKey.toString());
        expect(stake2Account.challengeId).to.equal(challengeId);
        expect(stake2Account.amount).to.equal(stakeAmount);
        expect(stake2Account.slashed).to.be.false;

        console.log("✅ Stake account verification passed");
      } catch (error) {
        console.error("❌ Staking failed:", error);
        throw error;
      }
    });

    it("Should reject duplicate staking from same challenger", async () => {
      try {
        await program.methods
          .stake(challengeId, stakeAmount)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda1,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        throw new Error("Should have failed with duplicate stake");
      } catch (error) {
        console.log("✅ Duplicate staking correctly rejected");
        expect(error.toString()).to.include("AccountInUse");
      }
    });
  });

  describe("Voting", () => {
    it("Should allow challengers to submit votes", async () => {
      try {
        // Challenger 1 votes
        const tx1 = await program.methods
          .submitVote(
            challengeId,
            "challenger-1",
            true, // Valid vote
            500,  // Uncertainty in meters
            50000 // Min RTT in microseconds
          )
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda1,
            voteAccount: votePda1,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        console.log("✅ Challenger 1 voted successfully");
        console.log(`   Transaction signature: ${tx1}`);

        // Challenger 2 votes
        const tx2 = await program.methods
          .submitVote(
            challengeId,
            "challenger-2",
            false, // Invalid vote
            800,   // Uncertainty in meters
            75000  // Min RTT in microseconds
          )
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda2,
            voteAccount: votePda2,
            challenger: challenger2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger2])
          .rpc();

        console.log("✅ Challenger 2 voted successfully");
        console.log(`   Transaction signature: ${tx2}`);

        // Verify vote accounts
        const vote1Account = await program.account.vote.fetch(votePda1);
        const vote2Account = await program.account.vote.fetch(votePda2);

        expect(vote1Account.challenger.toString()).to.equal(challenger1.publicKey.toString());
        expect(vote1Account.challengeId).to.equal(challengeId);
        expect(vote1Account.isValid).to.be.true;
        expect(vote1Account.uncertainty).to.equal(500);
        expect(vote1Account.minRtt).to.equal(50000);

        expect(vote2Account.challenger.toString()).to.equal(challenger2.publicKey.toString());
        expect(vote2Account.challengeId).to.equal(challengeId);
        expect(vote2Account.isValid).to.be.false;
        expect(vote2Account.uncertainty).to.equal(800);
        expect(vote2Account.minRtt).to.equal(75000);

        console.log("✅ Vote account verification passed");
      } catch (error) {
        console.error("❌ Voting failed:", error);
        throw error;
      }
    });

    it("Should reject voting without staking", async () => {
      try {
        await program.methods
          .submitVote(
            challengeId,
            "challenger-3",
            true,
            600,
            60000
          )
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda3,
            voteAccount: votePda3,
            challenger: challenger3.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger3])
          .rpc();

        throw new Error("Should have failed without staking");
      } catch (error) {
        console.log("✅ Voting without staking correctly rejected");
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });
  });

  describe("Challenge Finalization", () => {
    it("Should finalize challenge after deadline", async () => {
      try {
        // Wait for challenge deadline (in real scenario)
        // For testing, we'll simulate by advancing time or using a short duration
        console.log("⏰ Waiting for challenge deadline...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        const tx = await program.methods
          .finalizeChallenge(challengeId)
          .accounts({
            challenge: challengePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Challenge finalized successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify challenge status
        const challengeAccount = await program.account.challenge.fetch(challengePda);
        expect(challengeAccount.status.toString()).to.equal("Finalized");
        expect(challengeAccount.voteCount).to.equal(2);
        expect(challengeAccount.validVoteCount).to.equal(1);

        console.log("✅ Challenge finalization verification passed");
      } catch (error) {
        console.error("❌ Challenge finalization failed:", error);
        throw error;
      }
    });
  });

  describe("Reward Distribution", () => {
    it("Should distribute rewards to honest participants", async () => {
      try {
        const tx = await program.methods
          .distributeRewards(challengeId)
          .accounts({
            challenge: challengePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Rewards distributed successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify challenge rewards distributed flag
        const challengeAccount = await program.account.challenge.fetch(challengePda);
        expect(challengeAccount.rewardsDistributed).to.be.true;

        console.log("✅ Reward distribution verification passed");
      } catch (error) {
        console.error("❌ Reward distribution failed:", error);
        throw error;
      }
    });
  });

  describe("Slashing", () => {
    it("Should slash dishonest challengers", async () => {
      try {
        const tx = await program.methods
          .slash(challengeId, challenger2.publicKey)
          .accounts({
            challenge: challengePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Challenger slashed successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify stake account is slashed
        const stakeAccount = await program.account.stake.fetch(stakePda2);
        expect(stakeAccount.slashed).to.be.true;

        console.log("✅ Slashing verification passed");
      } catch (error) {
        console.error("❌ Slashing failed:", error);
        throw error;
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("Should handle insufficient participants", async () => {
      const insufficientChallengeId = "insufficient-challenge-003";
      const [insufficientPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(insufficientChallengeId)],
        program.programId
      );

      try {
        // Initialize challenge
        await program.methods
          .initializeChallenge(
            insufficientChallengeId,
            claimedLat,
            claimedLon,
            60, // Short duration for testing
            rewardPool
          )
          .accounts({
            challenge: insufficientPda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        // Wait for deadline
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to finalize with insufficient participants
        await program.methods
          .finalizeChallenge(insufficientChallengeId)
          .accounts({
            challenge: insufficientPda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        // Verify status
        const challengeAccount = await program.account.challenge.fetch(insufficientPda);
        expect(challengeAccount.status.toString()).to.equal("InsufficientParticipants");

        console.log("✅ Insufficient participants handled correctly");
      } catch (error) {
        console.error("❌ Insufficient participants test failed:", error);
        throw error;
      }
    });

    it("Should reject operations on expired challenges", async () => {
      const expiredChallengeId = "expired-challenge-004";
      const [expiredPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(expiredChallengeId)],
        program.programId
      );

      try {
        // Initialize challenge with very short duration
        await program.methods
          .initializeChallenge(
            expiredChallengeId,
            claimedLat,
            claimedLon,
            1, // 1 second duration
            rewardPool
          )
          .accounts({
            challenge: expiredPda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try to stake on expired challenge
        const [expiredStakePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("stake"), Buffer.from(expiredChallengeId), challenger1.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .stake(expiredChallengeId, stakeAmount)
          .accounts({
            challenge: expiredPda,
            stakeAccount: expiredStakePda,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        throw new Error("Should have failed with expired challenge");
      } catch (error) {
        console.log("✅ Expired challenge operations correctly rejected");
        expect(error.toString()).to.include("ChallengeExpired");
      }
    });
  });

  describe("Integration Tests", () => {
    it("Should complete full challenge lifecycle", async () => {
      const lifecycleChallengeId = "lifecycle-challenge-005";
      const [lifecyclePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(lifecycleChallengeId)],
        program.programId
      );

      try {
        console.log("🔄 Starting full challenge lifecycle test...");

        // 1. Initialize challenge
        await program.methods
          .initializeChallenge(
            lifecycleChallengeId,
            claimedLat,
            claimedLon,
            60, // 1 minute for testing
            rewardPool
          )
          .accounts({
            challenge: lifecyclePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 1: Challenge initialized");

        // 2. Multiple challengers stake
        const [lifecycleStake1] = PublicKey.findProgramAddressSync(
          [Buffer.from("stake"), Buffer.from(lifecycleChallengeId), challenger1.publicKey.toBuffer()],
          program.programId
        );

        const [lifecycleStake2] = PublicKey.findProgramAddressSync(
          [Buffer.from("stake"), Buffer.from(lifecycleChallengeId), challenger2.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .stake(lifecycleChallengeId, stakeAmount)
          .accounts({
            challenge: lifecyclePda,
            stakeAccount: lifecycleStake1,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        await program.methods
          .stake(lifecycleChallengeId, stakeAmount)
          .accounts({
            challenge: lifecyclePda,
            stakeAccount: lifecycleStake2,
            challenger: challenger2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger2])
          .rpc();

        console.log("✅ Step 2: Challengers staked");

        // 3. Challengers vote
        const [lifecycleVote1] = PublicKey.findProgramAddressSync(
          [Buffer.from("vote"), Buffer.from(lifecycleChallengeId), challenger1.publicKey.toBuffer()],
          program.programId
        );

        const [lifecycleVote2] = PublicKey.findProgramAddressSync(
          [Buffer.from("vote"), Buffer.from(lifecycleChallengeId), challenger2.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .submitVote(
            lifecycleChallengeId,
            "challenger-1",
            true,
            400,
            45000
          )
          .accounts({
            challenge: lifecyclePda,
            stakeAccount: lifecycleStake1,
            voteAccount: lifecycleVote1,
            challenger: challenger1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger1])
          .rpc();

        await program.methods
          .submitVote(
            lifecycleChallengeId,
            "challenger-2",
            true,
            600,
            55000
          )
          .accounts({
            challenge: lifecyclePda,
            stakeAccount: lifecycleStake2,
            voteAccount: lifecycleVote2,
            challenger: challenger2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger2])
          .rpc();

        console.log("✅ Step 3: Challengers voted");

        // 4. Wait and finalize
        await new Promise(resolve => setTimeout(resolve, 3000));

        await program.methods
          .finalizeChallenge(lifecycleChallengeId)
          .accounts({
            challenge: lifecyclePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 4: Challenge finalized");

        // 5. Distribute rewards
        await program.methods
          .distributeRewards(lifecycleChallengeId)
          .accounts({
            challenge: lifecyclePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 5: Rewards distributed");

        // Verify final state
        const finalChallenge = await program.account.challenge.fetch(lifecyclePda);
        expect(finalChallenge.status.toString()).to.equal("Finalized");
        expect(finalChallenge.participantCount).to.equal(2);
        expect(finalChallenge.voteCount).to.equal(2);
        expect(finalChallenge.validVoteCount).to.equal(2);
        expect(finalChallenge.rewardsDistributed).to.be.true;

        console.log("🎉 Full challenge lifecycle completed successfully!");
      } catch (error) {
        console.error("❌ Full lifecycle test failed:", error);
        throw error;
      }
    });
  });
});
