/**
 * coordinator.js - Challenge coordination and orchestration
 * Manages the full lifecycle of PoLoc challenges
 */

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");

class ChallengeCoordinator extends EventEmitter {
  constructor(anchorClient) {
    super();
    this.anchorClient = anchorClient;
    this.activeChallenges = new Map();
    this.challengeHistory = [];

    // Configuration
    this.config = {
      challengeDuration: 300, // 5 minutes in seconds
      minStakeAmount: 1000000, // 0.001 SOL in lamports
      rewardPool: 10000000, // 0.01 SOL in lamports
      minChallengers: 3,
      maxChallengers: 20,
      votingWindow: 60, // 1 minute after challenge ends
      rStarThreshold: 1000, // meters
    };

    this.dataPath = "data/challenges.json";
    this.loadChallenges();
  }

  /**
   * Initialize a new location proof challenge
   */
  async initializeChallenge(params) {
    const {
      waldoId,
      waldoPublicKey,
      claimedLocation,
      duration = this.config.challengeDuration,
      rewardPool = this.config.rewardPool,
    } = params;

    try {
      console.log("🚀 Initializing new PoLoc challenge...");
      console.log(`   Waldo: ${waldoId}`);
      console.log(
        `   Location: ${claimedLocation.lat}, ${claimedLocation.lon}`
      );
      console.log(`   Duration: ${duration}s`);

      // Create challenge ID
      const challengeId = crypto.randomUUID();
      const startTime = Date.now();
      const deadline = startTime + duration * 1000;

      // Initialize challenge on blockchain
      const blockchainChallengeId = await this.anchorClient.initializeChallenge(
        {
          location: claimedLocation,
          duration,
          rewardPool,
          waldoPublicKey,
        }
      );

      // Create local challenge record
      const challenge = {
        id: challengeId,
        blockchainId: blockchainChallengeId,
        waldoId,
        waldoPublicKey,
        claimedLocation,
        startTime,
        deadline,
        duration,
        rewardPool,
        status: "active",
        phase: "staking",
        participants: new Map(),
        votes: new Map(),
        results: null,
        metadata: {
          minRTTs: new Map(),
          uncertainties: new Map(),
          geometryData: null,
        },
      };

      this.activeChallenges.set(challengeId, challenge);
      await this.saveChallenges();

      // Emit challenge started event
      this.emit("challengeStarted", {
        challengeId,
        claimedLocation,
        deadline,
      });

      // Schedule phase transitions
      this.schedulePhaseTransitions(challengeId);

      console.log(`✅ Challenge ${challengeId} initialized successfully`);
      console.log(`   Blockchain ID: ${blockchainChallengeId}`);
      console.log(`   Deadline: ${new Date(deadline).toISOString()}`);

      return challengeId;
    } catch (error) {
      console.error("❌ Failed to initialize challenge:", error);
      throw error;
    }
  }

  /**
   * Register challenger for a challenge
   */
  async registerChallenger(challengeId, challengerData) {
    const { challengerId, publicKey, location, stakeAmount } = challengerData;

    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      if (challenge.phase !== "staking") {
        throw new Error(`Challenge ${challengeId} is not in staking phase`);
      }

      console.log(
        `🎯 Registering challenger ${challengerId} for challenge ${challengeId}`
      );

      // Validate stake amount
      if (stakeAmount < this.config.minStakeAmount) {
        throw new Error(
          `Stake amount ${stakeAmount} below minimum ${this.config.minStakeAmount}`
        );
      }

      // Check if challenger already registered
      if (challenge.participants.has(challengerId)) {
        throw new Error(`Challenger ${challengerId} already registered`);
      }

      // Check maximum participants
      if (challenge.participants.size >= this.config.maxChallengers) {
        throw new Error(`Challenge ${challengeId} is full`);
      }

      // Stake on blockchain
      await this.anchorClient.stakeForChallenge(
        challenge.blockchainId,
        stakeAmount
      );

      // Register challenger locally
      challenge.participants.set(challengerId, {
        challengerId,
        publicKey,
        location,
        stakeAmount,
        registrationTime: Date.now(),
        status: "registered",
      });

      await this.saveChallenges();

      console.log(`✅ Challenger ${challengerId} registered successfully`);
      console.log(
        `   Participants: ${challenge.participants.size}/${this.config.maxChallengers}`
      );

      // Emit registration event
      this.emit("challengerRegistered", {
        challengeId,
        challengerId,
        participantCount: challenge.participants.size,
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to register challenger ${challengerId}:`, error);
      throw error;
    }
  }

  /**
   * Submit ping results from challenger
   */
  async submitPingResults(challengeId, challengerId, pingData) {
    const { minRTT, avgRTT, measurements, uncertainty } = pingData;

    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      if (challenge.phase !== "pinging") {
        throw new Error(`Challenge ${challengeId} is not in pinging phase`);
      }

      const participant = challenge.participants.get(challengerId);
      if (!participant) {
        throw new Error(
          `Challenger ${challengerId} not registered for challenge ${challengeId}`
        );
      }

      console.log(`📊 Receiving ping results from ${challengerId}`);
      console.log(`   Min RTT: ${minRTT}ms`);
      console.log(`   Avg RTT: ${avgRTT}ms`);
      console.log(`   Measurements: ${measurements.length}`);
      console.log(`   Uncertainty: ${uncertainty}m`);

      // Store ping results
      challenge.metadata.minRTTs.set(challengerId, minRTT);
      challenge.metadata.uncertainties.set(challengerId, uncertainty);

      // Update participant status
      participant.status = "pinged";
      participant.pingData = {
        minRTT,
        avgRTT,
        measurements,
        uncertainty,
        timestamp: Date.now(),
      };

      await this.saveChallenges();

      // Emit ping results event
      this.emit("pingResultsReceived", {
        challengeId,
        challengerId,
        minRTT,
        uncertainty,
      });

      console.log(`✅ Ping results from ${challengerId} recorded`);

      return true;
    } catch (error) {
      console.error(
        `❌ Failed to submit ping results from ${challengerId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Submit vote from challenger
   */
  async submitVote(challengeId, challengerId, voteData) {
    const { isValid, confidence, uncertainty, reasoning } = voteData;

    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      if (challenge.phase !== "voting") {
        throw new Error(`Challenge ${challengeId} is not in voting phase`);
      }

      const participant = challenge.participants.get(challengerId);
      if (!participant) {
        throw new Error(
          `Challenger ${challengerId} not registered for challenge ${challengeId}`
        );
      }

      if (!participant.pingData) {
        throw new Error(
          `Challenger ${challengerId} has not submitted ping results`
        );
      }

      console.log(`🗳️  Receiving vote from ${challengerId}`);
      console.log(`   Valid: ${isValid}`);
      console.log(`   Confidence: ${confidence}`);
      console.log(`   Uncertainty: ${uncertainty}m`);

      // Submit vote to blockchain
      await this.anchorClient.submitVote({
        challengeId: challenge.blockchainId,
        challengerId,
        isValid,
        uncertainty,
        minRTT: participant.pingData.minRTT,
      });

      // Store vote locally
      challenge.votes.set(challengerId, {
        challengerId,
        isValid,
        confidence,
        uncertainty,
        reasoning,
        timestamp: Date.now(),
      });

      // Update participant status
      participant.status = "voted";

      await this.saveChallenges();

      // Emit vote event
      this.emit("voteSubmitted", {
        challengeId,
        challengerId,
        isValid,
        voteCount: challenge.votes.size,
      });

      console.log(`✅ Vote from ${challengerId} recorded`);
      console.log(
        `   Total votes: ${challenge.votes.size}/${challenge.participants.size}`
      );

      return true;
    } catch (error) {
      console.error(`❌ Failed to submit vote from ${challengerId}:`, error);
      throw error;
    }
  }

  /**
   * Finalize challenge and compute results
   */
  async finalizeChallenge(challengeId) {
    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      if (challenge.status !== "active") {
        throw new Error(`Challenge ${challengeId} is not active`);
      }

      console.log(`🏁 Finalizing challenge ${challengeId}...`);

      // Check minimum participation
      if (challenge.participants.size < this.config.minChallengers) {
        console.log(
          `⚠️  Insufficient participants (${challenge.participants.size} < ${this.config.minChallengers})`
        );
        challenge.status = "insufficient_participants";
        challenge.results = {
          passed: false,
          reason: "insufficient_participants",
          participantCount: challenge.participants.size,
          finalizationTime: Date.now(),
        };
        await this.saveChallenges();
        return challenge.results;
      }

      // Compute geometry-based results
      const geometryResults = await this.computeGeometryResults(challenge);

      // Finalize on blockchain
      const blockchainResults = await this.anchorClient.finalizeChallenge(
        challenge.blockchainId
      );

      // Combine results
      const finalResults = {
        passed: geometryResults.rStar <= this.config.rStarThreshold,
        rStar: geometryResults.rStar,
        threshold: this.config.rStarThreshold,
        participantCount: challenge.participants.size,
        validVotes: Array.from(challenge.votes.values()).filter(
          (v) => v.isValid
        ).length,
        totalVotes: challenge.votes.size,
        geometryData: geometryResults,
        blockchainResults,
        finalizationTime: Date.now(),
      };

      challenge.status = "finalized";
      challenge.results = finalResults;
      challenge.phase = "rewards";

      await this.saveChallenges();

      // Distribute rewards if challenge passed
      if (finalResults.passed) {
        await this.distributeRewards(challengeId);
      }

      // Emit finalization event
      this.emit("challengeFinalized", {
        challengeId,
        results: finalResults,
      });

      console.log(`✅ Challenge ${challengeId} finalized`);
      console.log(`   Result: ${finalResults.passed ? "PASSED" : "FAILED"}`);
      console.log(
        `   R*: ${finalResults.rStar}m (threshold: ${finalResults.threshold}m)`
      );
      console.log(
        `   Valid votes: ${finalResults.validVotes}/${finalResults.totalVotes}`
      );

      return finalResults;
    } catch (error) {
      console.error(`❌ Failed to finalize challenge ${challengeId}:`, error);
      throw error;
    }
  }

  /**
   * Compute geometry-based uncertainty results
   */
  async computeGeometryResults(challenge) {
    try {
      // Import geometry module
      const { GeometryCalculator } = require("./geometry");
      const geometry = new GeometryCalculator();

      // Prepare challenger data
      const challengers = Array.from(challenge.participants.values()).map(
        (participant) => {
          const vote = challenge.votes.get(participant.challengerId);
          return {
            id: participant.challengerId,
            location: participant.location,
            minRTT: participant.pingData?.minRTT || 0,
            uncertainty:
              vote?.uncertainty || participant.pingData?.uncertainty || 0,
            isValid: vote?.isValid ?? true,
          };
        }
      );

      // Compute R* using angle-based filtering and Equation (6)
      const rStar = await geometry.computeRStar(
        challenge.claimedLocation,
        challengers
      );

      return {
        rStar,
        challengerCount: challengers.length,
        validChallengerCount: challengers.filter((c) => c.isValid).length,
        computationTime: Date.now(),
      };
    } catch (error) {
      console.error("❌ Failed to compute geometry results:", error);

      // Fallback to simple average uncertainty
      const uncertainties = Array.from(challenge.votes.values())
        .filter((v) => v.isValid)
        .map((v) => v.uncertainty);

      const avgUncertainty =
        uncertainties.length > 0
          ? uncertainties.reduce((a, b) => a + b) / uncertainties.length
          : 999999;

      return {
        rStar: avgUncertainty,
        challengerCount: challenge.participants.size,
        validChallengerCount: uncertainties.length,
        fallback: true,
        computationTime: Date.now(),
      };
    }
  }

  /**
   * Distribute rewards to honest participants
   */
  async distributeRewards(challengeId) {
    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      console.log(`💰 Distributing rewards for challenge ${challengeId}...`);

      // Distribute rewards on blockchain
      await this.anchorClient.distributeRewards(challenge.blockchainId);

      // Update local records
      challenge.phase = "completed";
      challenge.results.rewardsDistributed = true;
      challenge.results.rewardDistributionTime = Date.now();

      await this.saveChallenges();

      // Move to history
      this.challengeHistory.push(challenge);
      this.activeChallenges.delete(challengeId);

      // Emit rewards distributed event
      this.emit("rewardsDistributed", {
        challengeId,
        rewardPool: challenge.rewardPool,
        participantCount: challenge.participants.size,
      });

      console.log(`✅ Rewards distributed for challenge ${challengeId}`);

      return true;
    } catch (error) {
      console.error(
        `❌ Failed to distribute rewards for challenge ${challengeId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Schedule automatic phase transitions
   */
  schedulePhaseTransitions(challengeId) {
    const challenge = this.activeChallenges.get(challengeId);
    if (!challenge) return;

    // Schedule staking -> pinging transition (30 seconds after start)
    setTimeout(() => {
      this.transitionToPhase(challengeId, "pinging");
    }, 30000);

    // Schedule pinging -> voting transition (at challenge deadline)
    setTimeout(() => {
      this.transitionToPhase(challengeId, "voting");
    }, challenge.duration * 1000);

    // Schedule voting -> finalization (voting window after deadline)
    setTimeout(() => {
      this.finalizeChallenge(challengeId).catch(console.error);
    }, (challenge.duration + this.config.votingWindow) * 1000);
  }

  /**
   * Transition challenge to new phase
   */
  async transitionToPhase(challengeId, newPhase) {
    try {
      const challenge = this.activeChallenges.get(challengeId);
      if (!challenge || challenge.status !== "active") return;

      const oldPhase = challenge.phase;
      challenge.phase = newPhase;

      await this.saveChallenges();

      console.log(`🔄 Challenge ${challengeId}: ${oldPhase} -> ${newPhase}`);

      // Emit phase transition event
      this.emit("phaseTransition", {
        challengeId,
        oldPhase,
        newPhase,
        participantCount: challenge.participants.size,
      });
    } catch (error) {
      console.error(
        `❌ Failed to transition challenge ${challengeId} to ${newPhase}:`,
        error
      );
    }
  }

  /**
   * Get challenge status
   */
  getChallengeStatus(challengeId) {
    const challenge = this.activeChallenges.get(challengeId);
    if (!challenge) return null;

    const now = Date.now();
    const timeRemaining = Math.max(0, challenge.deadline - now);

    return {
      id: challengeId,
      status: challenge.status,
      phase: challenge.phase,
      participantCount: challenge.participants.size,
      voteCount: challenge.votes.size,
      timeRemaining,
      deadline: challenge.deadline,
      results: challenge.results,
    };
  }

  /**
   * Get all active challenges
   */
  getActiveChallenges() {
    return Array.from(this.activeChallenges.values()).map((challenge) => ({
      id: challenge.id,
      waldoId: challenge.waldoId,
      claimedLocation: challenge.claimedLocation,
      status: challenge.status,
      phase: challenge.phase,
      participantCount: challenge.participants.size,
      voteCount: challenge.votes.size,
      timeRemaining: Math.max(0, challenge.deadline - Date.now()),
      deadline: challenge.deadline,
    }));
  }

  /**
   * Load challenges from disk
   */
  async loadChallenges() {
    try {
      const data = await fs.readFile(this.dataPath, "utf8");
      const parsed = JSON.parse(data);

      // Restore Map objects
      if (parsed.activeChallenges) {
        for (const [id, challenge] of Object.entries(parsed.activeChallenges)) {
          challenge.participants = new Map(
            Object.entries(challenge.participants || {})
          );
          challenge.votes = new Map(Object.entries(challenge.votes || {}));
          challenge.metadata.minRTTs = new Map(
            Object.entries(challenge.metadata.minRTTs || {})
          );
          challenge.metadata.uncertainties = new Map(
            Object.entries(challenge.metadata.uncertainties || {})
          );
          this.activeChallenges.set(id, challenge);
        }
      }

      this.challengeHistory = parsed.challengeHistory || [];

      console.log(`📁 Loaded ${this.activeChallenges.size} active challenges`);
    } catch (error) {
      console.log("📁 No existing challenge data found, starting fresh");
    }
  }

  /**
   * Save challenges to disk
   */
  async saveChallenges() {
    try {
      // Convert Maps to Objects for JSON serialization
      const activeChallengesObj = {};
      for (const [id, challenge] of this.activeChallenges.entries()) {
        const challengeCopy = { ...challenge };
        challengeCopy.participants = Object.fromEntries(challenge.participants);
        challengeCopy.votes = Object.fromEntries(challenge.votes);
        challengeCopy.metadata.minRTTs = Object.fromEntries(
          challenge.metadata.minRTTs
        );
        challengeCopy.metadata.uncertainties = Object.fromEntries(
          challenge.metadata.uncertainties
        );
        activeChallengesObj[id] = challengeCopy;
      }

      const data = {
        activeChallenges: activeChallengesObj,
        challengeHistory: this.challengeHistory,
        lastSaved: Date.now(),
      };

      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("❌ Failed to save challenges:", error);
    }
  }

  /**
   * Cleanup expired challenges
   */
  async cleanupExpiredChallenges() {
    const now = Date.now();
    const expiredChallenges = [];

    for (const [id, challenge] of this.activeChallenges.entries()) {
      // Consider challenges expired if they're 1 hour past deadline
      if (now > challenge.deadline + 3600 * 1000) {
        expiredChallenges.push(id);
      }
    }

    for (const id of expiredChallenges) {
      const challenge = this.activeChallenges.get(id);

      // Try to finalize if not already done
      if (challenge.status === "active") {
        try {
          await this.finalizeChallenge(id);
        } catch (error) {
          console.error(`Failed to finalize expired challenge ${id}:`, error);

          // Force expiration
          challenge.status = "expired";
          challenge.results = {
            passed: false,
            reason: "expired",
            finalizationTime: now,
          };
        }
      }

      // Move to history
      this.challengeHistory.push(challenge);
      this.activeChallenges.delete(id);
    }

    if (expiredChallenges.length > 0) {
      await this.saveChallenges();
      console.log(
        `🧹 Cleaned up ${expiredChallenges.length} expired challenges`
      );
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.cleanupExpiredChallenges().catch(console.error);
    }, 10 * 60 * 1000);
  }
}

module.exports = { ChallengeCoordinator };
