import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { Poloc } from "../target/types/polo          // Initialize third challenge
          await program.methods
          .initializeChallenge(
            challengeId,
            40000000,
            -74000000,
            new BN(3600),
            new BN(LAMPORTS_PER_SOL)
          )ribe("PoLoc Basic Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.poloc as Program<Poloc>;
  const provider = anchor.getProvider();

  // Test accounts
  let waldo: Keypair;
  let challenger: Keypair;

  before(async () => {
    // Generate test keypairs
    waldo = Keypair.generate();
    challenger = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropAmount = 2 * LAMPORTS_PER_SOL;
    await provider.connection.requestAirdrop(waldo.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(
      challenger.publicKey,
      airdropAmount
    );

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  describe("Program Initialization", () => {
    it("Should have correct program ID", () => {
      expect(program.programId.toString()).to.equal(
        "7Nvgy5gA716LrWo76Xha9NDaCsJT81JFPFKB23BHJzrn"
      );
      console.log("✅ Program ID verification passed");
    });

    it("Should have provider configured", () => {
      expect(provider).to.not.be.undefined;
      expect(provider.connection).to.not.be.undefined;
      console.log("✅ Provider configuration verified");
    });
  });

  describe("Account Generation", () => {
    it("Should generate valid keypairs", () => {
      expect(waldo.publicKey).to.not.be.undefined;
      expect(challenger.publicKey).to.not.be.undefined;
      expect(waldo.publicKey.toString()).to.not.equal(
        challenger.publicKey.toString()
      );
      console.log("✅ Keypair generation verified");
    });

    it("Should derive valid PDAs", () => {
      const challengeId = "test-challenge-basic";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const [stakePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stake"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      expect(challengePda).to.not.be.undefined;
      expect(stakePda).to.not.be.undefined;
      expect(votePda).to.not.be.undefined;
      console.log("✅ PDA derivation verified");
    });
  });

  describe("Challenge Initialization Test", () => {
    it("Should initialize a challenge successfully", async () => {
      const challengeId = "basic-challenge-001";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const claimedLat = new BN(40000000); // 40 degrees in micro-degrees
      const claimedLon = new BN(-74000000); // -74 degrees in micro-degrees
      const duration = 3600; // 1 hour
      const rewardPool = LAMPORTS_PER_SOL; // 1 SOL

      try {
        const tx = await program.methods
          .initializeChallenge(
            challengeId,
            claimedLat,
            claimedLon,
            new BN(duration),
            new BN(rewardPool)
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
        const challengeAccount = await program.account.challenge.fetch(
          challengePda
        );
        expect(challengeAccount.challengeId).to.equal(challengeId);
        expect(challengeAccount.waldo.toString()).to.equal(
          waldo.publicKey.toString()
        );
        expect(challengeAccount.claimedLat).to.equal(claimedLat);
        expect(challengeAccount.claimedLon).to.equal(claimedLon);
        expect(challengeAccount.rewardPool).to.equal(rewardPool);

        console.log("✅ Challenge account verification passed");
      } catch (error) {
        console.error("❌ Challenge initialization failed:", error);
        throw error;
      }
    });
  });

  describe("Staking Test", () => {
    it("Should allow challenger to stake tokens", async () => {
      const challengeId = "basic-challenge-002";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const [stakePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stake"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      const stakeAmount = 100000000; // 0.1 SOL

      try {
        // First initialize the challenge
        await program.methods
          .initializeChallenge(
            challengeId,
            40000000,
            -74000000,
            new BN(3600),
            new BN(LAMPORTS_PER_SOL)
          )
          .accounts({
            challenge: challengePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        // Then stake
        const tx = await program.methods
          .stake(challengeId, new BN(stakeAmount))
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        console.log("✅ Challenger staked successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify stake account
        const stakeAccount = await program.account.stake.fetch(stakePda);
        expect(stakeAccount.challenger.toString()).to.equal(
          challenger.publicKey.toString()
        );
        expect(stakeAccount.challengeId).to.equal(challengeId);
        expect(stakeAccount.amount).to.equal(stakeAmount);
        expect(stakeAccount.slashed).to.be.false;

        console.log("✅ Stake account verification passed");
      } catch (error) {
        console.error("❌ Staking failed:", error);
        throw error;
      }
    });
  });

  describe("Voting Test", () => {
    it("Should allow challenger to submit vote", async () => {
      const challengeId = "basic-challenge-003";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const [stakePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stake"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        // Initialize challenge
        await program.methods
          .initializeChallenge(
            challengeId,
            40000000,
            -74000000,
            3600,
            LAMPORTS_PER_SOL
          )
          .accounts({
            challenge: challengePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        // Stake
        await program.methods
          .stake(challengeId, 100000000)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        // Vote
        const tx = await program.methods
          .submitVote(
            challengeId,
            "challenger-1",
            true, // Valid vote
            500, // Uncertainty in meters
            50000 // Min RTT in microseconds
          )
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            voteAccount: votePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        console.log("✅ Challenger voted successfully");
        console.log(`   Transaction signature: ${tx}`);

        // Verify vote account
        const voteAccount = await program.account.vote.fetch(votePda);
        expect(voteAccount.challenger.toString()).to.equal(
          challenger.publicKey.toString()
        );
        expect(voteAccount.challengeId).to.equal(challengeId);
        expect(voteAccount.isValid).to.be.true;
        expect(voteAccount.uncertainty).to.equal(500);
        expect(voteAccount.minRtt).to.equal(50000);

        console.log("✅ Vote account verification passed");
      } catch (error) {
        console.error("❌ Voting failed:", error);
        throw error;
      }
    });
  });

  describe("Error Handling", () => {
    it("Should reject invalid challenge parameters", async () => {
      const challengeId = "invalid-challenge-001";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      try {
        await program.methods
          .initializeChallenge(
            challengeId,
            91000000, // Invalid latitude (> 90 degrees)
            -74000000,
            3600,
            LAMPORTS_PER_SOL
          )
          .accounts({
            challenge: challengePda,
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

    it("Should reject voting without staking", async () => {
      const challengeId = "no-stake-challenge-001";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        // Initialize challenge
        await program.methods
          .initializeChallenge(
            challengeId,
            40000000,
            -74000000,
            3600,
            LAMPORTS_PER_SOL
          )
          .accounts({
            challenge: challengePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        // Try to vote without staking
        await program.methods
          .submitVote(challengeId, "challenger-1", true, 500, 50000)
          .accounts({
            challenge: challengePda,
            stakeAccount: PublicKey.unique(), // Random account that doesn't exist
            voteAccount: votePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        throw new Error("Should have failed without staking");
      } catch (error) {
        console.log("✅ Voting without staking correctly rejected");
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });
  });

  describe("Integration Test", () => {
    it("Should complete basic challenge lifecycle", async () => {
      const challengeId = "lifecycle-challenge-001";
      const [challengePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("challenge"), Buffer.from(challengeId)],
        program.programId
      );

      const [stakePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stake"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          Buffer.from(challengeId),
          challenger.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        console.log("🔄 Starting basic challenge lifecycle test...");

        // 1. Initialize challenge
        await program.methods
          .initializeChallenge(
            challengeId,
            40000000,
            -74000000,
            60, // Short duration for testing
            LAMPORTS_PER_SOL
          )
          .accounts({
            challenge: challengePda,
            waldo: waldo.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 1: Challenge initialized");

        // 2. Stake
        await program.methods
          .stake(challengeId, 100000000)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        console.log("✅ Step 2: Challenger staked");

        // 3. Vote
        await program.methods
          .submitVote(challengeId, "challenger-1", true, 400, 45000)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            voteAccount: votePda,
            challenger: challenger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();

        console.log("✅ Step 3: Challenger voted");

        // 4. Wait and finalize
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await program.methods
          .finalizeChallenge(challengeId)
          .accounts({
            challenge: challengePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 4: Challenge finalized");

        // 5. Distribute rewards
        await program.methods
          .distributeRewards(challengeId)
          .accounts({
            challenge: challengePda,
            authority: waldo.publicKey,
          })
          .signers([waldo])
          .rpc();

        console.log("✅ Step 5: Rewards distributed");

        // Verify final state
        const finalChallenge = await program.account.challenge.fetch(
          challengePda
        );
        expect(finalChallenge.status.toString()).to.equal("Finalized");
        expect(finalChallenge.participantCount).to.equal(1);
        expect(finalChallenge.voteCount).to.equal(1);
        expect(finalChallenge.validVoteCount).to.equal(1);
        expect(finalChallenge.rewardsDistributed).to.be.true;

        console.log("🎉 Basic challenge lifecycle completed successfully!");
      } catch (error) {
        console.error("❌ Basic lifecycle test failed:", error);
        throw error;
      }
    });
  });
});
