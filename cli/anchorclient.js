/**
 * anchorClient.js - Complete Solana Anchor smart contract client
 * Interfaces with Byzantine Fault-Tolerant PoLoc smart contract
 */

const anchor = require("@coral-xyz/anchor");
const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const fs = require("fs").promises;
const crypto = require("crypto");

class AnchorClient {
  constructor() {
    this.connection = null;
    this.wallet = null;
    this.provider = null;
    this.program = null;
    this.programId = null;

    // Mock storage for development
    this.mockStorage = {
      challenges: new Map(),
      stakes: new Map(),
      votes: new Map(),
    };

    // Default configuration
    this.config = {
      network: "devnet",
      rpcEndpoint: "https://api.devnet.solana.com",
      programIdString: "td2uRx67WzLnHVzvb1jJ7VkM6uzKo6MndjuPW92pmDr", // From IDL
    };
  }

  /**
   * Initialize Anchor client with wallet and connection
   */
  async initialize(walletPath = null, rpcEndpoint = null) {
    try {
      // Setup connection
      this.connection = new Connection(
        rpcEndpoint || this.config.rpcEndpoint,
        "confirmed"
      );

      // Load or create wallet
      await this.loadWallet(walletPath || "wallet.json");

      // Setup provider
      this.provider = new anchor.AnchorProvider(this.connection, this.wallet, {
        commitment: "confirmed",
      });
      anchor.setProvider(this.provider);

      // Load program IDL and initialize program
      await this.loadProgram();

      // Load mock storage if using mock program
      if (!this.isRealBlockchain()) {
        await this.loadMockStorage("data/mock-blockchain.json");
      }

      console.log("🔗 Anchor client initialized");
      console.log(`   Network: ${this.config.network}`);
      console.log(`   Wallet: ${this.wallet.publicKey.toString()}`);
      console.log(
        `   Program ID: ${this.programId ? this.programId.toString() : "Mock"}`
      );

      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Anchor client:", error);
      throw error;
    }
  }

  /**
   * Load wallet from file or create new one
   */
  async loadWallet(walletPath = "wallet.json") {
    try {
      const walletData = await fs.readFile(walletPath);
      const secretKey = JSON.parse(walletData.toString());
      this.wallet = new anchor.Wallet(
        Keypair.fromSecretKey(new Uint8Array(secretKey))
      );

      console.log("📁 Wallet loaded from file");
    } catch (error) {
      // Create new wallet if file doesn't exist
      console.log("🔑 Creating new wallet...");

      const keypair = Keypair.generate();
      this.wallet = new anchor.Wallet(keypair);

      // Save wallet to file
      await fs.writeFile(
        walletPath,
        JSON.stringify(Array.from(keypair.secretKey))
      );
      console.log(`💾 New wallet saved to ${walletPath}`);
      console.log(
        `🚨 Please fund this wallet with SOL: ${this.wallet.publicKey.toString()}`
      );
    }
  }

  /**
   * Load program IDL and create program instance
   */
  async loadProgram() {
    try {
      // Try to load IDL from file first
      let idl;
      try {
        const idlData = await fs.readFile(
          "target/idl/messi.json"
        );
        idl = JSON.parse(idlData.toString());
      } catch (fileError) {
        // If file doesn't exist, use the IDL structure from the provided data
        idl = this.getDefaultIDL();
      }

      this.programId = new PublicKey(this.config.programIdString);
      this.program = new anchor.Program(idl, this.programId, this.provider);

      console.log("📜 Program IDL loaded successfully");
    } catch (error) {
      console.warn("⚠️  Could not load IDL, using mock program interface");
      this.setupMockProgram();
    }
  }

  /**
   * Get default IDL structure based on the provided IDL file
   */
  getDefaultIDL() {
    return {
      "address": "td2uRx67WzLnHVzvb1jJ7VkM6uzKo6MndjuPW92pmDr",
      "metadata": {
        "name": "messi",
        "version": "0.1.0",
        "spec": "0.1.0",
        "description": "Created with Anchor"
      },
      "instructions": [
        {
          "name": "initialize_challenge",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "waldo", "isMut": true, "isSigner": true},
            {"name": "system_program", "isMut": false, "isSigner": false}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"},
            {"name": "claimed_lat", "type": "i32"},
            {"name": "claimed_lon", "type": "i32"},
            {"name": "duration", "type": "u64"},
            {"name": "reward_pool", "type": "u64"}
          ]
        },
        {
          "name": "stake",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "stake_account", "isMut": true, "isSigner": false},
            {"name": "challenger", "isMut": true, "isSigner": true},
            {"name": "system_program", "isMut": false, "isSigner": false}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"},
            {"name": "amount", "type": "u64"}
          ]
        },
        {
          "name": "submit_vote",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "stake_account", "isMut": false, "isSigner": false},
            {"name": "vote_account", "isMut": true, "isSigner": false},
            {"name": "challenger", "isMut": true, "isSigner": true},
            {"name": "system_program", "isMut": false, "isSigner": false}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"},
            {"name": "challenger_id", "type": "string"},
            {"name": "is_valid", "type": "bool"},
            {"name": "uncertainty", "type": "u32"},
            {"name": "min_rtt", "type": "u32"}
          ]
        },
        {
          "name": "finalize_challenge",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "authority", "isMut": true, "isSigner": true}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"}
          ]
        },
        {
          "name": "distribute_rewards",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "authority", "isMut": true, "isSigner": true}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"}
          ]
        },
        {
          "name": "slash",
          "accounts": [
            {"name": "challenge", "isMut": true, "isSigner": false},
            {"name": "stake_account", "isMut": true, "isSigner": false},
            {"name": "challenger_to_slash", "isMut": false, "isSigner": false},
            {"name": "authority", "isMut": true, "isSigner": true}
          ],
          "args": [
            {"name": "challenge_id", "type": "string"},
            {"name": "challenger_pubkey", "type": "publicKey"}
          ]
        }
      ],
      "accounts": [
        {"name": "Challenge", "type": {"kind": "struct", "fields": []}},
        {"name": "Stake", "type": {"kind": "struct", "fields": []}},
        {"name": "Vote", "type": {"kind": "struct", "fields": []}}
      ]
    };
  }

  /**
   * Setup mock program interface for development/testing
   */
  setupMockProgram() {
    this.programId = Keypair.generate().publicKey;

    // Mock program interface
    this.program = {
      _isMock: true, // Flag to identify this as a mock program
      methods: {
        initializeChallenge: this.createMockMethod("initializeChallenge"),
        stake: this.createMockMethod("stake"),
        submitVote: this.createMockMethod("submitVote"),
        finalizeChallenge: this.createMockMethod("finalizeChallenge"),
        distributeRewards: this.createMockMethod("distributeRewards"),
        slash: this.createMockMethod("slash"),
      },
      account: {
        challenge: {
          fetch: this.mockFetchChallenge.bind(this),
          all: this.mockFetchAllChallenges.bind(this),
        },
        stake: {
          fetch: this.mockFetchStake.bind(this),
        },
        vote: {
          fetch: this.mockFetchVote.bind(this),
        },
      },
    };

    console.log("🎭 Mock program interface initialized");
  }

  /**
   * Create mock method that returns a transaction-like object
   */
  createMockMethod(methodName) {
    return (...args) => ({
      accounts: (accounts) => ({
        signers: (signers) => ({
          rpc: async () => {
            return this.executeMockMethod(methodName, args, accounts, signers);
          },
        }),
      }),
    });
  }

  /**
   * Execute mock blockchain method
   */
  async executeMockMethod(methodName, args, accounts, signers) {
    const txId = crypto.randomBytes(32).toString("hex");

    switch (methodName) {
      case "initializeChallenge":
        // Create challenge params from the arguments
        const challengeParams = {
          challengeId: args[0],
          claimedLat: args[1],
          claimedLon: args[2],
          duration: args[3].toNumber(),
          rewardPool: args[4].toNumber(),
          deadline: Math.floor(Date.now() / 1000) + args[3].toNumber(),
        };
        return this.mockInitializeChallenge(challengeParams);
      case "stake":
        return this.mockStake(args[0], args[1].toNumber());
      case "submitVote":
        return this.mockSubmitVote(args[0], args[1], args[2], args[3], args[4]);
      case "finalizeChallenge":
        return this.mockFinalizeChallenge(args[0]);
      case "distributeRewards":
        return this.mockDistributeRewards(args[0]);
      case "slash":
        return this.mockSlash(args[0], args[1]);
      default:
        return txId;
    }
  }

  /**
   * Initialize new challenge on blockchain
   */
  async initializeChallenge(params) {
    const { location, duration, rewardPool, waldoPublicKey } = params;

    try {
      console.log("🚀 Initializing challenge on blockchain...");

      // Use a shorter, fixed-length challenge ID for PDA compatibility
      const challengeId = crypto.randomBytes(16).toString('hex');

      // Convert parameters for blockchain
      const challengeParams = {
        challengeId,
        claimedLat: Math.round(location.lat * 1e6), // Store as micro-degrees
        claimedLon: Math.round(location.lon * 1e6),
        duration: duration,
        rewardPool: rewardPool,
        deadline: Math.floor(Date.now() / 1000) + duration,
      };

      if (this.isRealBlockchain()) {
        // Real Anchor program call - Fixed to use correct PDA derivation
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const tx = await this.program.methods
          .initializeChallenge(
            challengeParams.challengeId,
            challengeParams.claimedLat,
            challengeParams.claimedLon,
            new anchor.BN(challengeParams.duration),
            new anchor.BN(challengeParams.rewardPool)
          )
          .accounts({
            challenge: challengePda,
            waldo: waldoPublicKey || this.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log(`✅ Challenge initialized! TX: ${tx}`);
      } else {
        // Mock implementation
        await this.mockInitializeChallenge(challengeParams);
        console.log(`✅ Challenge initialized! (Mock) ID: ${challengeId}`);
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
      }

      return challengeId;
    } catch (error) {
      console.error("❌ Failed to initialize challenge:", error);
      throw error;
    }
  }

  /**
   * Stake tokens for challenge participation
   */
  async stakeForChallenge(challengeId, amount) {
    try {
      console.log(`💰 Staking ${amount} lamports for challenge ${challengeId}`);

      if (this.isRealBlockchain()) {
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const [stakePda] = await PublicKey.findProgramAddress(
          [
            Buffer.from("stake"),
            challengePda.toBuffer(),
            this.wallet.publicKey.toBuffer(),
          ],
          this.programId
        );

        const tx = await this.program.methods
          .stake(challengeId, new anchor.BN(amount))
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            challenger: this.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log(`✅ Stake successful! TX: ${tx}`);
      } else {
        await this.mockStake(challengeId, amount);
        console.log("✅ Stake successful! (Mock)");
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
      }
    } catch (error) {
      console.error("❌ Failed to stake:", error);
      throw error;
    }
  }

  /**
   * Submit vote for challenge
   */
  async submitVote(voteData) {
    const { challengeId, challengerId, isValid, uncertainty, minRTT } =
      voteData;

    try {
      console.log(`🗳️  Submitting vote for challenge ${challengeId}`);

      if (this.isRealBlockchain()) {
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const [stakePda] = await PublicKey.findProgramAddress(
          [
            Buffer.from("stake"),
            challengePda.toBuffer(),
            this.wallet.publicKey.toBuffer(),
          ],
          this.programId
        );

        const [votePda] = await PublicKey.findProgramAddress(
          [
            Buffer.from("vote"),
            challengePda.toBuffer(),
            this.wallet.publicKey.toBuffer(),
          ],
          this.programId
        );

        const tx = await this.program.methods
          .submitVote(
            challengeId,
            challengerId,
            isValid,
            Math.round(uncertainty),
            Math.round(minRTT * 1000) // Convert ms to microseconds
          )
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            voteAccount: votePda,
            challenger: this.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log(`✅ Vote submitted! TX: ${tx}`);
      } else {
        await this.mockSubmitVote(
          challengeId,
          challengerId,
          isValid,
          uncertainty,
          minRTT
        );
        console.log("✅ Vote submitted! (Mock)");
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
      }
    } catch (error) {
      console.error("❌ Failed to submit vote:", error);
      throw error;
    }
  }

  /**
   * Finalize challenge and compute results
   */
  async finalizeChallenge(challengeId) {
    try {
      console.log(`🏁 Finalizing challenge ${challengeId}`);

      if (this.isRealBlockchain()) {
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const tx = await this.program.methods
          .finalizeChallenge(challengeId)
          .accounts({
            challenge: challengePda,
            authority: this.wallet.publicKey,
          })
          .rpc();

        console.log(`✅ Challenge finalized! TX: ${tx}`);

        // Fetch final results
        return await this.getChallengeResults(challengeId);
      } else {
        const result = await this.mockFinalizeChallenge(challengeId);
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
        
        return result;
      }
    } catch (error) {
      console.error("❌ Failed to finalize challenge:", error);
      throw error;
    }
  }

  /**
   * Distribute rewards to honest challengers
   */
  async distributeRewards(challengeId) {
    try {
      console.log(`💰 Distributing rewards for challenge ${challengeId}`);

      if (this.isRealBlockchain()) {
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const tx = await this.program.methods
          .distributeRewards(challengeId)
          .accounts({
            challenge: challengePda,
            authority: this.wallet.publicKey,
          })
          .rpc();

        console.log(`✅ Rewards distributed! TX: ${tx}`);
      } else {
        await this.mockDistributeRewards(challengeId);
        console.log("✅ Rewards distributed! (Mock)");
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
      }
    } catch (error) {
      console.error("❌ Failed to distribute rewards:", error);
      throw error;
    }
  }

  /**
   * Slash dishonest challenger
   */
  async slashChallenger(challengeId, challengerPublicKey) {
    try {
      console.log(`⚔️  Slashing challenger for challenge ${challengeId}`);

      if (this.isRealBlockchain()) {
        const [challengePda] = await PublicKey.findProgramAddress(
          [Buffer.from("challenge"), Buffer.from(challengeId)],
          this.programId
        );

        const [stakePda] = await PublicKey.findProgramAddress(
          [
            Buffer.from("stake"),
            challengePda.toBuffer(),
            challengerPublicKey.toBuffer(),
          ],
          this.programId
        );

        const tx = await this.program.methods
          .slash(challengeId, challengerPublicKey)
          .accounts({
            challenge: challengePda,
            stakeAccount: stakePda,
            challengerToSlash: challengerPublicKey,
            authority: this.wallet.publicKey,
          })
          .rpc();

        console.log(`✅ Challenger slashed! TX: ${tx}`);
      } else {
        await this.mockSlash(challengeId, challengerPublicKey);
        console.log("✅ Challenger slashed! (Mock)");
        
        // Save mock storage
        await this.saveMockStorage("data/mock-blockchain.json");
      }
    } catch (error) {
      console.error("❌ Failed to slash challenger:", error);
      throw error;
    }
  }

  /**
   * Find challenge account address (using proper PDA derivation)
   */
  async findChallengeAccount(challengeId) {
    const [challengeAddress] = await PublicKey.findProgramAddress(
      [Buffer.from("challenge"), Buffer.from(challengeId)],
      this.programId
    );
    return challengeAddress;
  }

  /**
   * Find stake account address (using proper PDA derivation)
   */
  async findStakeAccount(challengeId, challengerPubkey) {
    const challengeAddress = await this.findChallengeAccount(challengeId);
    const [stakeAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from("stake"),
        challengeAddress.toBuffer(),
        challengerPubkey.toBuffer(),
      ],
      this.programId
    );
    return stakeAddress;
  }

  /**
   * Find vote account address (using proper PDA derivation)
   */
  async findVoteAccount(challengeId, challengerPubkey) {
    const challengeAddress = await this.findChallengeAccount(challengeId);
    const [voteAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vote"),
        challengeAddress.toBuffer(),
        challengerPubkey.toBuffer(),
      ],
      this.programId
    );
    return voteAddress;
  }

  /**
   * Get active challenges
   */
  async getActiveChallenges() {
    try {
      if (this.isRealBlockchain()) {
        const challenges = await this.program.account.challenge.all();

        return challenges
          .filter(
            (c) =>
              c.account.status.active !== undefined &&
              c.account.deadline > Math.floor(Date.now() / 1000)
          )
          .map((c) => ({
            id: c.account.challengeId,
            claimedLocation: {
              lat: c.account.claimedLat / 1e6,
              lon: c.account.claimedLon / 1e6,
            },
            deadline: c.account.deadline * 1000,
            rewardPool: c.account.rewardPool,
            status: c.account.status,
            participantCount: c.account.participantCount,
            voteCount: c.account.voteCount,
          }));
      } else {
        return await this.mockFetchAllChallenges();
      }
    } catch (error) {
      console.error("❌ Failed to get active challenges:", error);
      return [];
    }
  }

  /**
   * Get challenge information
   */
  async getChallengeInfo(challengeId) {
    try {
      if (this.isRealBlockchain()) {
        const challengeAccount = await this.findChallengeAccount(challengeId);
        const challenge = await this.program.account.challenge.fetch(
          challengeAccount
        );

        return {
          id: challenge.challengeId,
          claimedLocation: {
            lat: challenge.claimedLat / 1e6,
            lon: challenge.claimedLon / 1e6,
          },
          deadline: challenge.deadline * 1000,
          rewardPool: challenge.rewardPool,
          status: challenge.status,
          participantCount: challenge.participantCount,
          voteCount: challenge.voteCount,
          validVoteCount: challenge.validVoteCount,
          rStar: challenge.rStar,
          rStarThreshold: challenge.rStarThreshold,
          rewardsDistributed: challenge.rewardsDistributed,
        };
      } else {
        return await this.mockFetchChallenge(challengeId);
      }
    } catch (error) {
      console.error("❌ Failed to get challenge info:", error);
      return null;
    }
  }

  /**
   * Get challenge status
   */
  async getChallengeStatus(challengeId) {
    const info = await this.getChallengeInfo(challengeId);
    return info
      ? {
          participantCount: info.participantCount,
          voteCount: info.voteCount,
          validVoteCount: info.validVoteCount,
          status: info.status,
          timeRemaining: Math.max(0, info.deadline - Date.now()),
          rStar: info.rStar,
          passed: info.rStar <= info.rStarThreshold,
        }
      : null;
  }

  /**
   * Get challenge results after finalization
   */
  async getChallengeResults(challengeId) {
    const info = await this.getChallengeInfo(challengeId);
    if (!info || (info.status.finalized === undefined)) {
      return null;
    }

    return {
      passed: info.rStar <= info.rStarThreshold,
      finalRStar: info.rStar,
      threshold: info.rStarThreshold,
      validVotes: info.validVoteCount,
      totalVotes: info.voteCount,
      participantCount: info.participantCount,
      rewardsDistributed: info.rewardsDistributed,
    };
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance() {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("❌ Failed to get wallet balance:", error);
      return 0;
    }
  }

  /**
   * Request airdrop for testing (devnet only)
   */
  async requestAirdrop(amount = 1) {
    try {
      if (this.config.network !== "devnet") {
        throw new Error("Airdrop only available on devnet");
      }

      console.log(`🪂 Requesting ${amount} SOL airdrop...`);

      const signature = await this.connection.requestAirdrop(
        this.wallet.publicKey,
        amount * LAMPORTS_PER_SOL
      );

      await this.connection.confirmTransaction(signature);

      console.log(`✅ Airdrop successful! TX: ${signature}`);

      const newBalance = await this.getWalletBalance();
      console.log(`💰 New balance: ${newBalance.toFixed(4)} SOL`);

      return signature;
    } catch (error) {
      console.error("❌ Airdrop failed:", error);
      throw error;
    }
  }

  // ===== MOCK IMPLEMENTATIONS =====

  /**
   * Mock challenge initialization
   */
  async mockInitializeChallenge(params) {
    const challenge = {
      challengeId: params.challengeId,
      claimedLat: params.claimedLat,
      claimedLon: params.claimedLon,
      startTime: Math.floor(Date.now() / 1000),
      deadline: params.deadline,
      rewardPool: params.rewardPool,
      status: "Active",
      participantCount: 0,
      voteCount: 0,
      validVoteCount: 0,
      rStar: 0,
      rStarThreshold: 1000,
      rewardsDistributed: false,
    };

    this.mockStorage.challenges.set(params.challengeId, challenge);
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Mock staking
   */
  async mockStake(challengeId, amount) {
    const challenge = this.mockStorage.challenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const stakeKey = `${challengeId}-${this.wallet.publicKey.toString()}`;
    const stake = {
      challenger: this.wallet.publicKey.toString(),
      challengeId,
      amount,
      timestamp: Math.floor(Date.now() / 1000),
      slashed: false,
    };

    this.mockStorage.stakes.set(stakeKey, stake);
    challenge.participantCount++;

    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Mock vote submission
   */
  async mockSubmitVote(
    challengeId,
    challengerId,
    isValid,
    uncertainty,
    minRTT
  ) {
    const challenge = this.mockStorage.challenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const voteKey = `${challengeId}-${this.wallet.publicKey.toString()}`;
    const vote = {
      challenger: this.wallet.publicKey.toString(),
      challengeId,
      challengerId,
      isValid,
      uncertainty,
      minRtt: minRTT,
      timestamp: Math.floor(Date.now() / 1000),
      processed: false,
    };

    this.mockStorage.votes.set(voteKey, vote);
    challenge.voteCount++;
    if (isValid) challenge.validVoteCount++;

    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Mock challenge finalization
   */
  async mockFinalizeChallenge(challengeId) {
    const challenge = this.mockStorage.challenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    // Simple R* calculation for mock
    const votes = Array.from(this.mockStorage.votes.values()).filter(
      (v) => v.challengeId === challengeId && v.isValid
    );

    if (votes.length > 0) {
      challenge.rStar = Math.round(
        votes.reduce((sum, v) => sum + v.uncertainty, 0) / votes.length
      );
    } else {
      challenge.rStar = 999999; // No valid votes = failure
    }

    challenge.status = "Finalized";

    return {
      passed: challenge.rStar <= challenge.rStarThreshold,
      finalRStar: challenge.rStar,
      threshold: challenge.rStarThreshold,
      validVotes: challenge.validVoteCount,
      totalVotes: challenge.voteCount,
      participantCount: challenge.participantCount,
      rewardsDistributed: false,
    };
  }

  /**
   * Mock reward distribution
   */
  async mockDistributeRewards(challengeId) {
    const challenge = this.mockStorage.challenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    challenge.rewardsDistributed = true;
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Mock slashing
   */
  async mockSlash(challengeId, challengerPubkey) {
    const stakeKey = `${challengeId}-${challengerPubkey.toString()}`;
    const stake = this.mockStorage.stakes.get(stakeKey);
    if (stake) {
      stake.slashed = true;
    }
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Mock fetch challenge
   */
  async mockFetchChallenge(challengeId) {
    const challenge = this.mockStorage.challenges.get(challengeId);
    if (!challenge) return null;

    return {
      id: challenge.challengeId,
      claimedLocation: {
        lat: challenge.claimedLat / 1e6,
        lon: challenge.claimedLon / 1e6,
      },
      deadline: challenge.deadline * 1000,
      rewardPool: challenge.rewardPool,
      status: challenge.status,
      participantCount: challenge.participantCount,
      voteCount: challenge.voteCount,
      validVoteCount: challenge.validVoteCount,
      rStar: challenge.rStar,
      rStarThreshold: challenge.rStarThreshold,
      rewardsDistributed: challenge.rewardsDistributed,
    };
  }

  /**
   * Mock fetch all challenges
   */
  async mockFetchAllChallenges() {
    const challenges = Array.from(this.mockStorage.challenges.values())
      .filter(
        (c) =>
          c.status === "Active" && c.deadline > Math.floor(Date.now() / 1000)
      )
      .map((c) => ({
        id: c.challengeId,
        claimedLocation: {
          lat: c.claimedLat / 1e6,
          lon: c.claimedLon / 1e6,
        },
        deadline: c.deadline * 1000,
        rewardPool: c.rewardPool,
        status: c.status,
        participantCount: c.participantCount,
        voteCount: c.voteCount,
      }));

    return challenges;
  }

  /**
   * Mock fetch stake
   */
  async mockFetchStake(challengeId, challengerPubkey) {
    const stakeKey = `${challengeId}-${challengerPubkey.toString()}`;
    return this.mockStorage.stakes.get(stakeKey) || null;
  }

  /**
   * Mock fetch vote
   */
  async mockFetchVote(challengeId, challengerPubkey) {
    const voteKey = `${challengeId}-${challengerPubkey.toString()}`;
    return this.mockStorage.votes.get(voteKey) || null;
  }

  /**
   * Get mock storage statistics
   */
  getMockStats() {
    return {
      challenges: this.mockStorage.challenges.size,
      stakes: this.mockStorage.stakes.size,
      votes: this.mockStorage.votes.size,
      activeChallenges: Array.from(this.mockStorage.challenges.values()).filter(
        (c) => c.status === "Active"
      ).length,
    };
  }

  /**
   * Clear mock storage
   */
  clearMockStorage() {
    this.mockStorage.challenges.clear();
    this.mockStorage.stakes.clear();
    this.mockStorage.votes.clear();
    console.log("🧹 Mock storage cleared");
  }

  /**
   * Save mock storage to file
   */
  async saveMockStorage(filepath = "data/mock-blockchain.json") {
    try {
      const data = {
        challenges: Object.fromEntries(this.mockStorage.challenges),
        stakes: Object.fromEntries(this.mockStorage.stakes),
        votes: Object.fromEntries(this.mockStorage.votes),
        timestamp: Date.now(),
      };

      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`💾 Mock storage saved to ${filepath}`);
    } catch (error) {
      console.error("❌ Failed to save mock storage:", error);
    }
  }

  /**
   * Load mock storage from file
   */
  async loadMockStorage(filepath = "data/mock-blockchain.json") {
    try {
      const data = JSON.parse(await fs.readFile(filepath, "utf8"));

      this.mockStorage.challenges = new Map(
        Object.entries(data.challenges || {})
      );
      this.mockStorage.stakes = new Map(Object.entries(data.stakes || {}));
      this.mockStorage.votes = new Map(Object.entries(data.votes || {}));

      console.log(`📁 Mock storage loaded from ${filepath}`);
      console.log(`   Challenges: ${this.mockStorage.challenges.size}`);
      console.log(`   Stakes: ${this.mockStorage.stakes.size}`);
      console.log(`   Votes: ${this.mockStorage.votes.size}`);
    } catch (error) {
      console.log("📁 No existing mock storage found, starting fresh");
    }
  }

  /**
   * Utility: Check if running on real blockchain
   */
  isRealBlockchain() {
    // Check if we have a real Anchor program (not mock)
    return this.program && 
           this.program.methods && 
           this.program.methods.initializeChallenge &&
           typeof this.program.methods.initializeChallenge === 'function' &&
           !this.program._isMock; // Add a flag to distinguish mock programs
  }

  /**
   * Utility: Format SOL amount
   */
  formatSOL(lamports) {
    return (lamports / LAMPORTS_PER_SOL).toFixed(4) + " SOL";
  }

  /**
   * Utility: Format time remaining
   */
  formatTimeRemaining(deadline) {
    const remaining = Math.max(0, deadline - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Get comprehensive status
   */
  async getStatus() {
    const balance = await this.getWalletBalance();
    const activeChallenges = await this.getActiveChallenges();

    return {
      connected: !!this.connection,
      wallet: this.wallet.publicKey.toString(),
      balance: balance,
      balanceFormatted: this.formatSOL(balance * LAMPORTS_PER_SOL),
      network: this.config.network,
      programId: this.programId ? this.programId.toString() : "Mock",
      isRealBlockchain: this.isRealBlockchain(),
      activeChallenges: activeChallenges.length,
      mockStats: this.isRealBlockchain() ? null : this.getMockStats(),
    };
  }
}

module.exports = { AnchorClient };