// anchorclient.js

const fs = require("fs").promises;
const path = require("path");
const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
} = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const BN = require("bn.js");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

/**
 * A client for interacting with the Poloc Anchor smart contract.
 */
class AnchorClient {
  /**
   * @param {Connection} connection
   * @param {anchor.Wallet} wallet
   * @param {anchor.Program} program
   */
  constructor(connection, wallet, program) {
    this.connection = connection;
    this.wallet = wallet;
    this.program = program;
  }

  /**
   * Creates and initializes a new AnchorClient.
   * @param {string} [walletPath] - Optional path to the wallet keypair file.
   * @param {string} [rpcEndpoint] - Optional URL for the Solana RPC endpoint.
   * @returns {Promise<AnchorClient>} A new instance of the AnchorClient.
   */
  static async create(walletPath, rpcEndpoint) {
    try {
      // --- 1. Establish Connection ---
      const endpoint = rpcEndpoint || "http://127.0.0.1:8899";
      const connection = new Connection(endpoint, "confirmed");
      const networkType = endpoint.includes("devnet") ? "devnet" : "localnet";
      console.log(`✅ Connected to Solana ${networkType} at ${endpoint}`);

      // --- 2. Load Wallet ---
      const keypairPath =
        walletPath || path.join(process.env.HOME, ".config", "solana", "id.json");
      const secretKey = JSON.parse(await fs.readFile(keypairPath, "utf8"));
      const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
      const wallet = new anchor.Wallet(keypair);
      console.log(`✅ Wallet loaded: ${wallet.publicKey.toString()}`);

      // --- 3. Load and Validate IDL ---
      const idlPath = path.join(__dirname, "polocfinal.json");
      console.log(`📁 Loading IDL from: ${idlPath}`);
      
      let idl;
      try {
        idl = JSON.parse(await fs.readFile(idlPath, "utf8"));
        console.log(`✅ IDL loaded successfully`);
      } catch (err) {
        console.error(`❌ Failed to load IDL from ${idlPath}:`, err.message);
        throw new Error(`Could not load IDL file: ${err.message}`);
      }

      // Validate IDL structure for the new format
      console.log(`🔍 Validating IDL structure...`);
      console.log(`   - Name: ${idl.metadata?.name || 'undefined'}`);
      console.log(`   - Version: ${idl.metadata?.version || 'undefined'}`);
      console.log(`   - Spec: ${idl.metadata?.spec || 'undefined'}`);
      console.log(`   - Instructions: ${idl.instructions ? idl.instructions.length : 0}`);
      console.log(`   - Accounts: ${idl.accounts ? idl.accounts.length : 0}`);
      console.log(`   - Types: ${idl.types ? idl.types.length : 0}`);

      // Get program ID from the address field (new IDL format)
      let programId;
      if (idl.address) {
        programId = new PublicKey(idl.address);
        console.log(`✅ Program ID: ${programId.toString()}`);
      } else {
        throw new Error("Program ID not found in IDL. Expected idl.address field");
      }

      // --- 4. Create Provider and Program ---
      const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      
      // Set the provider as default
      anchor.setProvider(provider);

      // For the new IDL format, we don't need to modify the accounts structure
      // The new Anchor version handles this automatically

      console.log(`🔧 Creating Anchor program...`);
      const program = new anchor.Program(idl, programId, provider);
      console.log(`✅ Program loaded: ${program.programId.toString()}`);

      // Log available methods for debugging
      console.log(`📋 Available methods: ${Object.keys(program.methods).join(', ')}`);

      return new AnchorClient(connection, wallet, program);
      
    } catch (error) {
      console.error("❌ Failed to create AnchorClient:", error);
      console.error("Stack trace:", error.stack);
      throw error;
    }
  }

  // --- Public Utility Methods ---

  /**
   * Requests a devnet airdrop for the connected wallet.
   * @param {number} amountSOL - The amount of SOL to request.
   */
  async requestAirdrop(amountSOL = 1) {
    console.log(
      `💰 Requesting ${amountSOL} SOL airdrop for ${this.wallet.publicKey.toString()}...`
    );
    const signature = await this.connection.requestAirdrop(
      this.wallet.publicKey,
      amountSOL * LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(signature, "confirmed");
    console.log(
      `✅ Airdrop successful! New balance: ${await this.getWalletBalance()} SOL`
    );
  }

  /**
   * Signs a message with the wallet's keypair.
   * @param {string} message - The message to sign.
   * @returns {string} The signature as a base58 string.
   */
  signMessage(message) {
    const messageBuffer = Buffer.from(message, 'utf8');
    const signature = nacl.sign.detached(messageBuffer, this.wallet.payer.secretKey);
    return bs58.encode(signature);
  }

  /**
   * Gets the current balance of the connected wallet in SOL.
   * @returns {Promise<number>} The balance in SOL.
   */
  async getWalletBalance() {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  // --- On-Chain Instruction Methods ---

  /**
   * Initializes a new challenge on the blockchain.
   * @param {object} params
   * @param {string} params.challengeId - A unique string identifier for the challenge.
   * @param {{lat: number, lon: number}} params.location - The claimed location.
   * @param {number} params.duration - The duration of the challenge in seconds.
   * @param {number} params.rewardPool - The reward pool in lamports.
   * @returns {Promise<string>} The transaction signature.
   */
  async initializeChallenge({ challengeId, location, duration, rewardPool }) {
    try {
      console.log(`🚀 Initializing challenge: ${challengeId}`);
      console.log(`   Location: ${location.lat}, ${location.lon}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Reward: ${rewardPool / LAMPORTS_PER_SOL} SOL`);

      const challengePda = this._findChallengePda(challengeId);
      console.log(`📍 Challenge PDA: ${challengePda.toString()}`);

      // Use the correct method name from your IDL
      const tx = await this.program.methods
        .initializeChallenge(
          challengeId,
          Math.round(location.lat * 1e6), // Convert to micro-degrees
          Math.round(location.lon * 1e6),
          new BN(duration),
          new BN(rewardPool)
        )
        .accounts({
          challenge: challengePda,
          waldo: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Challenge '${challengeId}' created successfully. Tx: ${tx}`);
      return tx;

    } catch (error) {
      console.error("❌ Failed to initialize challenge:", error);
      console.error("Error details:", error.message);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Stakes lamports for a specific challenge.
   * @param {string} challengeId - The ID of the challenge to stake in.
   * @param {number} amount - The amount to stake in lamports.
   * @returns {Promise<string>} The transaction signature.
   */
  async stakeForChallenge(challengeId, amount) {
    try {
      console.log(`🎯 Staking ${amount / LAMPORTS_PER_SOL} SOL for challenge: ${challengeId}`);

      const challengePda = this._findChallengePda(challengeId);
      const stakePda = this._findStakePda(challengeId, this.wallet.publicKey);

      console.log(`📍 Challenge PDA: ${challengePda.toString()}`);
      console.log(`📍 Stake PDA: ${stakePda.toString()}`);

      const tx = await this.program.methods
        .stake(challengeId, new BN(amount))
        .accounts({
          challenge: challengePda,
          stakeAccount: stakePda,
          challenger: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Staked ${amount / LAMPORTS_PER_SOL} SOL for challenge '${challengeId}'. Tx: ${tx}`);
      return tx;
    } catch (error) {
      console.error("❌ Failed to stake for challenge:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Submits a vote for a challenge.
   * @param {object} params
   * @param {string} params.challengeId
   * @param {boolean} params.isValid - The voter's decision.
   * @param {number} params.uncertainty - The voter's calculated uncertainty in meters.
   * @param {number} params.minRtt - The voter's measured minimum RTT in microseconds.
   * @returns {Promise<string>} The transaction signature.
   */
  async submitVote({ challengeId, isValid, uncertainty, minRtt }) {
    try {
      console.log(`🗳️  Submitting vote for challenge: ${challengeId}`);
      console.log(`   Valid: ${isValid}, Uncertainty: ${uncertainty}m, Min RTT: ${minRtt}μs`);

      const challengePda = this._findChallengePda(challengeId);
      const stakePda = this._findStakePda(challengeId, this.wallet.publicKey);
      const votePda = this._findVotePda(challengeId, this.wallet.publicKey);

      const tx = await this.program.methods
        .submitVote(
          challengeId,
          this.wallet.publicKey.toString(), // Using wallet pubkey as challenger_id
          isValid,
          uncertainty,
          minRtt
        )
        .accounts({
          challenge: challengePda,
          stakeAccount: stakePda,
          voteAccount: votePda,
          challenger: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Vote submitted for challenge '${challengeId}'. Tx: ${tx}`);
      return tx;
    } catch (error) {
      console.error("❌ Failed to submit vote:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Finalizes a challenge by submitting the off-chain calculated result.
   * @param {string} challengeId - The ID of the challenge to finalize.
   * @param {number} rStar - The final R* uncertainty value calculated off-chain.
   * @returns {Promise<string>} The transaction signature.
   */
  async finalizeChallenge(challengeId, rStar) {
    try {
      console.log(`🏁 Finalizing challenge: ${challengeId} with R*: ${rStar}`);

      const challengePda = this._findChallengePda(challengeId);

      const tx = await this.program.methods
        .finalizeChallenge(challengeId, rStar)
        .accounts({
          challenge: challengePda,
          authority: this.wallet.publicKey,
        })
        .rpc();

      console.log(`✅ Challenge '${challengeId}' finalized. Tx: ${tx}`);
      return tx;
    } catch (error) {
      console.error("❌ Failed to finalize challenge:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Gets the status of a specific challenge.
   * @param {string} challengeId - The ID of the challenge to check.
   * @returns {Promise<object>} The challenge status data.
   */
  async getChallengeStatus(challengeId) {
    try {
      const challengePda = this._findChallengePda(challengeId);
      const challengeAccount = await this.program.account.challenge.fetch(challengePda);
      
      return {
        challengeId: challengeAccount.challengeId,
        waldo: challengeAccount.waldo.toString(),
        participantCount: challengeAccount.participantCount,
        voteCount: challengeAccount.voteCount,
        validVoteCount: challengeAccount.validVoteCount,
        status: challengeAccount.status,
        deadline: challengeAccount.deadline.toNumber(),
        startTime: challengeAccount.startTime.toNumber(),
        rStar: challengeAccount.rStar,
        rStarThreshold: challengeAccount.rStarThreshold,
        rewardPool: challengeAccount.rewardPool.toNumber(),
        rewardsDistributed: challengeAccount.rewardsDistributed,
        claimedLocation: {
          lat: challengeAccount.claimedLat / 1e6,
          lon: challengeAccount.claimedLon / 1e6,
        },
      };
    } catch (error) {
      console.error("❌ Failed to get challenge status:", error);
      throw error;
    }
  }

  /**
   * Claims reward for participating in a successful challenge.
   * @param {string} challengeId - The ID of the challenge.
   * @returns {Promise<string>} The transaction signature.
   */
  async claimReward(challengeId) {
    try {
      console.log(`💰 Claiming reward for challenge: ${challengeId}`);

      const challengePda = this._findChallengePda(challengeId);
      const votePda = this._findVotePda(challengeId, this.wallet.publicKey);
      
      const tx = await this.program.methods
        .claimReward(challengeId)
        .accounts({
          challenge: challengePda,
          vote: votePda,
          winner: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Reward claimed for challenge '${challengeId}'. Tx: ${tx}`);
      return tx;
    } catch (error) {
      console.error("❌ Failed to claim reward:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Refunds a failed challenge to the creator.
   * @param {string} challengeId - The ID of the challenge.
   * @returns {Promise<string>} The transaction signature.
   */
  async refundFailedChallenge(challengeId) {
    try {
      console.log(`💸 Refunding failed challenge: ${challengeId}`);

      const challengePda = this._findChallengePda(challengeId);
      
      const tx = await this.program.methods
        .refundFailedChallenge(challengeId)
        .accounts({
          challenge: challengePda,
          waldo: this.wallet.publicKey,
          authority: this.wallet.publicKey,
        })
        .rpc();

      console.log(`✅ Refund processed for challenge '${challengeId}'. Tx: ${tx}`);
      return tx;
    } catch (error) {
      console.error("❌ Failed to refund challenge:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Fetches all active challenge accounts from the blockchain.
   * @returns {Promise<object[]>} An array of challenge data objects.
   */
  async getActiveChallenges() {
    try {
      const allChallenges = await this.program.account.challenge.all();

      // Filter for only active challenges and map to a clean JS object
      return allChallenges
        .filter((c) => c.account.status.active !== undefined)
        .map((c) => ({
          id: c.account.challengeId,
          publicKey: c.publicKey.toString(),
          waldo: c.account.waldo.toString(),
          claimedLocation: {
            lat: c.account.claimedLat / 1e6,
            lon: c.account.claimedLon / 1e6,
          },
          rewardPool: c.account.rewardPool.toNumber(),
          deadline: new Date(c.account.deadline.toNumber() * 1000),
          startTime: new Date(c.account.startTime.toNumber() * 1000),
          participantCount: c.account.participantCount,
          voteCount: c.account.voteCount,
          validVoteCount: c.account.validVoteCount,
        }));
    } catch (error) {
      console.error("❌ Failed to get active challenges:", error);
      throw error;
    }
  }

  /**
   * Gets all challenges (regardless of status).
   * @returns {Promise<object[]>} An array of all challenge data objects.
   */
  async getAllChallenges() {
    try {
      const allChallenges = await this.program.account.challenge.all();
      
      return allChallenges.map((c) => ({
        id: c.account.challengeId,
        publicKey: c.publicKey.toString(),
        waldo: c.account.waldo.toString(),
        claimedLocation: {
          lat: c.account.claimedLat / 1e6,
          lon: c.account.claimedLon / 1e6,
        },
        rewardPool: c.account.rewardPool.toNumber(),
        deadline: new Date(c.account.deadline.toNumber() * 1000),
        startTime: new Date(c.account.startTime.toNumber() * 1000),
        participantCount: c.account.participantCount,
        voteCount: c.account.voteCount,
        validVoteCount: c.account.validVoteCount,
        status: c.account.status,
        rStar: c.account.rStar,
        rStarThreshold: c.account.rStarThreshold,
        rewardsDistributed: c.account.rewardsDistributed,
      }));
    } catch (error) {
      console.error("❌ Failed to get all challenges:", error);
      throw error;
    }
  }

  // --- Private Helper Methods for Finding PDAs ---

  _findChallengePda(challengeId) {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("challenge"), Buffer.from(challengeId)],
      this.program.programId
    );
    return pda;
  }

  _findStakePda(challengeId, userPublicKey) {
    // Based on your IDL: seeds = ["stake", challenge_id, challenger]
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake"),
        Buffer.from(challengeId),
        userPublicKey.toBuffer(),
      ],
      this.program.programId
    );
    return pda;
  }

  _findVotePda(challengeId, userPublicKey) {
    // Based on your IDL: seeds = ["vote", challenge_id, challenger]
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        Buffer.from(challengeId),
        userPublicKey.toBuffer(),
      ],
      this.program.programId
    );
    return pda;
  }
}

module.exports = { AnchorClient };