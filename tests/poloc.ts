import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import { Poloc } from "../target/types/poloc"; // Ensure this type name matches your IDL file name

describe("poloc", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Poloc as Program<Poloc>;

  const waldo = Keypair.generate();
  const challenger1 = Keypair.generate();

  // --- Helper Functions ---
  const findPda = (seeds: (Buffer | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId)[0];

  // FIX: These helpers now use the challengeId STRING, which matches the IDL perfectly.
  const getChallengePda = (challengeId: string) =>
    findPda([Buffer.from("challenge"), Buffer.from(challengeId)]);
  const getStakePda = (challengeId: string, user: PublicKey) =>
    findPda([Buffer.from("stake"), Buffer.from(challengeId), user.toBuffer()]);
  const getVotePda = (challengeId: string, user: PublicKey) =>
    findPda([Buffer.from("vote"), Buffer.from(challengeId), user.toBuffer()]);

  before(async () => {
    await Promise.all([
      provider.connection
        .requestAirdrop(waldo.publicKey, 2 * LAMPORTS_PER_SOL)
        .then((sig) => provider.connection.confirmTransaction(sig)),
      provider.connection
        .requestAirdrop(challenger1.publicKey, 2 * LAMPORTS_PER_SOL)
        .then((sig) => provider.connection.confirmTransaction(sig)),
    ]);
  });

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  describe("Happy Path Workflow", () => {
    const challengeId = "happy-path-final";
    const challengePda = getChallengePda(challengeId);
    const rewardPool = new anchor.BN(1 * LAMPORTS_PER_SOL);
    const stakeAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);
    const testDuration = new anchor.BN(2);
    const testVotingWindow = 3; // Must match the #[cfg(test)] value in your Rust code

    it("Initializes a new challenge", async () => {
      await program.methods
        .initializeChallenge(
          challengeId,
          40712800,
          -74006000,
          testDuration,
          rewardPool
        )
        .accounts({
          challenge: challengePda,
          waldo: waldo.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([waldo])
        .rpc();
      const acc = await program.account.challenge.fetch(challengePda);
      assert.strictEqual(Object.keys(acc.status)[0], "active");
    });

    it("Allows challengers to stake", async () => {
      const stakePda = getStakePda(challengeId, challenger1.publicKey);
      await program.methods
        .stake(challengeId, stakeAmount)
        .accounts({
          challenge: challengePda,
          stakeAccount: stakePda,
          challenger: challenger1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger1])
        .rpc();
      const acc = await program.account.challenge.fetch(challengePda);
      assert.strictEqual(acc.participantCount, 1);
    });

    it("Allows staked challengers to vote", async () => {
      console.log("     Waiting for challenge duration to pass...");
      await sleep(testDuration.toNumber() * 1000 + 500);
      const stakePda = getStakePda(challengeId, challenger1.publicKey);
      const votePda = getVotePda(challengeId, challenger1.publicKey);
      await program.methods
        .submitVote(
          challengeId,
          challenger1.publicKey.toString(),
          true,
          800,
          60000
        )
        .accounts({
          challenge: challengePda,
          stakeAccount: stakePda,
          voteAccount: votePda,
          challenger: challenger1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger1])
        .rpc();
      const acc = await program.account.challenge.fetch(challengePda);
      assert.strictEqual(acc.voteCount, 1);
    });

    it("Finalizes a successful challenge", async () => {
      console.log(
        `     Waiting for test voting window (${testVotingWindow}s) to pass...`
      );
      await sleep(testVotingWindow * 1000 + 500);

      const rStarSuccess = 500;
      await program.methods
        .finalizeChallenge(challengeId, rStarSuccess)
        .accounts({ challenge: challengePda, authority: waldo.publicKey })
        .signers([waldo])
        .rpc();

      const challengeAccount = await program.account.challenge.fetch(
        challengePda
      );
      assert.strictEqual(Object.keys(challengeAccount.status)[0], "finalized");
    });

    it("Allows an honest voter to claim their reward", async () => {
      const balanceBefore = await provider.connection.getBalance(
        challenger1.publicKey
      );
      const votePda = getVotePda(challengeId, challenger1.publicKey);

      await program.methods
        .claimReward(challengeId)
        .accounts({
          challenge: challengePda,
          vote: votePda,
          winner: challenger1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger1])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(
        challenger1.publicKey
      );
      assert.isAbove(balanceAfter, balanceBefore);
    });
  });
});
