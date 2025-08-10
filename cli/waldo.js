#!/usr/bin/env node
/**
 * waldo.js - Location prover (Waldo) CLI implementation
 * Handles location claims, RTT responses, and challenge management
 */

const dgram = require("dgram");
const fs = require("fs").promises;
const { Command } = require("commander");
const GeometryEngine = require("./geometry.js");
const {AnchorClient} = require("./anchorclient.js");

class Waldo {
  constructor() {
    this.geometry = new GeometryEngine();
    this.anchorClient = new AnchorClient();
    this.server = null;
    this.location = null;
    this.challenges = new Map(); // challengeId -> challenge data
    this.port = 8888; // Default Waldo listening port
    this.isRunning = false;
    this.responseStats = {
      totalPings: 0,
      totalResponses: 0,
      avgResponseTime: 0,
    };
  }

  /**
   * Initialize Waldo with location claim
   * @param {Object} claimedLocation - {lat, lon} coordinates
   * @param {number} port - UDP port for ping responses
   */
  async initialize(claimedLocation, port = 8888) {
    this.location = claimedLocation;
    this.port = port;

    console.log(
      `🎯 Waldo initialized at location: ${claimedLocation.lat}, ${claimedLocation.lon}`
    );
    console.log(`📡 Listening on UDP port: ${port}`);

    await this.startUDPServer();
    // await this.anchorClient.initialize();
  }

  /**
   * Start UDP server to respond to challenger pings
   */
  async startUDPServer() {
    return new Promise((resolve, reject) => {
      this.server = dgram.createSocket("udp4");

      this.server.on("message", (msg, rinfo) => {
        this.handleIncomingPing(msg, rinfo);
      });

      this.server.on("error", (err) => {
        console.error("❌ UDP server error:", err);
        reject(err);
      });

      this.server.bind(this.port, () => {
        this.isRunning = true;
        console.log(`✅ Waldo UDP server running on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle incoming ping from challenger
   * @param {Buffer} message - Ping message
   * @param {Object} rinfo - Remote info (address, port)
   */
  handleIncomingPing(message, rinfo) {
    const receiveTime = process.hrtime.bigint();

    try {
      const pingData = JSON.parse(message.toString());
      const { challengeId, challengerId, sequence, timestamp, nonce } =
        pingData;

      this.responseStats.totalPings++;

      // Create response with minimal processing delay
      const response = {
        challengeId,
        challengerId,
        sequence,
        nonce,
        waldoLocation: this.location,
        timestamp: timestamp, // Echo original timestamp
        responseTime: Number(receiveTime / 1000000n), // Convert to milliseconds
      };

      // Send immediate response
      const responseBuffer = Buffer.from(JSON.stringify(response));
      this.server.send(responseBuffer, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error("❌ Failed to send ping response:", err);
        } else {
          this.responseStats.totalResponses++;
          this.updateResponseStats();
        }
      });

      // Log ping activity
      if (this.responseStats.totalPings % 100 === 0) {
        console.log(
          `📊 Ping stats: ${this.responseStats.totalPings} received, ${this.responseStats.totalResponses} responded`
        );
      }
    } catch (error) {
      console.error("❌ Error handling ping:", error);
    }
  }

  /**
   * Update response time statistics
   */
  updateResponseStats() {
    // Simple exponential moving average for response time
    const alpha = 0.1;
    this.responseStats.avgResponseTime =
      alpha * Date.now() + (1 - alpha) * this.responseStats.avgResponseTime;
  }

  /**
   * Submit location claim to Anchor smart contract
   * @param {Object} options - Challenge options
   */
  async submitLocationClaim(options = {}) {
    const {
      stakingAmount = 1000000, // 1 SOL in lamports
      challengeDuration = 300, // 5 minutes
      rewardPool = 500000, // 0.5 SOL rewards
    } = options;

    try {
      console.log("🚀 Submitting location claim to blockchain...");

      // Generate a unique challenge ID
      const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.anchorClient.initializeChallenge({
        challengeId: challengeId,
        location: this.location,
        duration: challengeDuration,
        rewardPool: rewardPool,
      });

      // Store challenge locally
      this.challenges.set(challengeId, {
        id: challengeId,
        location: this.location,
        startTime: Date.now(),
        duration: challengeDuration * 1000, // Convert to ms
        status: "active",
        participants: [],
      });

      console.log(`✅ Challenge submitted! ID: ${challengeId}`);
      console.log(`💰 Reward pool: ${rewardPool / 1000000} SOL`);
      console.log(`⏱️  Duration: ${challengeDuration} seconds`);

      return challengeId;
    } catch (error) {
      console.error("❌ Failed to submit location claim:", error);
      throw error;
    }
  }

  /**
   * Monitor active challenge progress
   * @param {string} challengeId - Challenge to monitor
   */
  async monitorChallenge(challengeId) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    console.log(`👀 Monitoring challenge ${challengeId}...`);

    const monitorInterval = setInterval(async () => {
      try {
        // Get challenge status from blockchain
        const onChainStatus = await this.anchorClient.getChallengeStatus(
          challengeId
        );

        const timeRemaining =
          challenge.startTime + challenge.duration - Date.now();

        if (timeRemaining <= 0) {
          console.log("⏰ Challenge time expired, finalizing...");
          clearInterval(monitorInterval);
          await this.finalizeChallenge(challengeId);
          return;
        }

        // Display progress
        console.log(`\n📈 Challenge Progress:`);
        console.log(`   Time remaining: ${Math.round(timeRemaining / 1000)}s`);
        console.log(`   Participants: ${onChainStatus.participantCount}`);
        console.log(`   Total votes: ${onChainStatus.voteCount}`);
        console.log(`   Ping responses: ${this.responseStats.totalResponses}`);
      } catch (error) {
        console.error("❌ Error monitoring challenge:", error);
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Finalize challenge and distribute rewards
   * @param {string} challengeId - Challenge to finalize
   */
  async finalizeChallenge(challengeId) {
    try {
      console.log("🏁 Finalizing challenge...");

      const result = await this.anchorClient.finalizeChallenge(challengeId);

      console.log("\n🎉 Challenge Results:");
      console.log(`   Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`   Final R*: ${result.finalRStar}`);
      console.log(`   Threshold: ${result.threshold}`);
      console.log(`   Valid votes: ${result.validVotes}/${result.totalVotes}`);

      if (result.passed) {
        console.log("💰 Distributing rewards to honest challengers...");
        await this.anchorClient.distributeRewards(challengeId);
        console.log("✅ Rewards distributed successfully!");
      } else {
        console.log("💸 Challenge failed - no rewards distributed");
      }

      // Update local challenge status
      const challenge = this.challenges.get(challengeId);
      if (challenge) {
        challenge.status = result.passed ? "passed" : "failed";
        challenge.finalRStar = result.finalRStar;
      }
    } catch (error) {
      console.error("❌ Error finalizing challenge:", error);
    }
  }

  /**
   * Save challenge data to file
   */
  async saveChallengeData() {
    const data = {
      challenges: Object.fromEntries(this.challenges),
      location: this.location,
      stats: this.responseStats,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(
      "data/waldo_challenges.json",
      JSON.stringify(data, null, 2)
    );
    console.log("💾 Challenge data saved");
  }

  /**
   * Load previous challenge data
   */
  async loadChallengeData() {
    try {
      const data = JSON.parse(
        await fs.readFile("data/waldo_challenges.json", "utf8")
      );
      this.challenges = new Map(Object.entries(data.challenges || {}));
      this.location = data.location;
      this.responseStats = { ...this.responseStats, ...data.stats };
      console.log("📁 Previous challenge data loaded");
    } catch (error) {
      console.log("📝 No previous challenge data found, starting fresh");
    }
  }

  /**
   * Stop Waldo server and cleanup
   */
  async stop() {
    if (this.server) {
      this.server.close();
      this.isRunning = false;
      console.log("🛑 Waldo server stopped");
    }

    await this.saveChallengeData();
  }

  /**
   * Generate location proof for verification
   */
  generateLocationProof() {
    return {
      claimedLocation: this.location,
      timestamp: Date.now(),
      signature: this.anchorClient.signMessage(JSON.stringify(this.location)),
      challengeHistory: Array.from(this.challenges.values()),
      responseStats: this.responseStats,
    };
  }
}

// CLI Interface
const program = new Command();

program
  .name("waldo")
  .description("Byzantine Fault-Tolerant Proof-of-Location Prover")
  .version("1.0.0");

program
  .command("claim")
  .description("Start location claim and challenge")
  .requiredOption("-lat, --latitude <lat>", "Latitude coordinate", parseFloat)
  .requiredOption("-lon, --longitude <lon>", "Longitude coordinate", parseFloat)
  .option("-p, --port <port>", "UDP port for ping responses", parseInt, 8888)
  .option(
    "-d, --duration <seconds>",
    "Challenge duration in seconds",
    parseInt,
    300
  )
  .option(
    "-r, --reward <lamports>",
    "Reward pool in lamports",
    parseInt,
    500000
  )
  .action(async (options) => {
    const waldo = new Waldo();

    try {
        waldo.anchorClient = await AnchorClient.create();
      await waldo.loadChallengeData();
      await waldo.initialize(
        { lat: options.latitude, lon: options.longitude },
        options.port
      );

      const challengeId = await waldo.submitLocationClaim({
        challengeDuration: options.duration,
        rewardPool: options.reward,
      });

      // Monitor challenge progress
      await waldo.monitorChallenge(challengeId);

      // Graceful shutdown
      process.on("SIGINT", async () => {
        console.log("\n🔄 Shutting down gracefully...");
        await waldo.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("respond")
  .description("Start ping response server only")
  .requiredOption("-lat, --latitude <lat>", "Latitude coordinate", parseFloat)
  .requiredOption("-lon, --longitude <lon>", "Longitude coordinate", parseFloat)
  .option("-p, --port <port>", "UDP port for ping responses", parseInt, 8888)
  .action(async (options) => {
    const waldo = new Waldo();

    try {
      await waldo.initialize(
        { lat: options.latitude, lon: options.longitude },
        options.port
      );

      console.log("🎯 Waldo ping response server started");
      console.log("Press Ctrl+C to stop");

      // Graceful shutdown
      process.on("SIGINT", async () => {
        console.log("\n🔄 Shutting down...");
        await waldo.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Check status of active challenges")
  .action(async () => {
    const waldo = new Waldo();

    try {
      await waldo.loadChallengeData();

      console.log("📊 Waldo Status:");
      console.log(
        `   Location: ${waldo.location?.lat}, ${waldo.location?.lon}`
      );
      console.log(`   Active challenges: ${waldo.challenges.size}`);
      console.log(`   Total pings: ${waldo.responseStats.totalPings}`);
      console.log(`   Total responses: ${waldo.responseStats.totalResponses}`);

      for (const [challengeId, challenge] of waldo.challenges) {
        console.log(`\n   Challenge ${challengeId}:`);
        console.log(`     Status: ${challenge.status}`);
        console.log(
          `     Started: ${new Date(challenge.startTime).toISOString()}`
        );
      }
    } catch (error) {
      console.error("❌ Error:", error);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = Waldo;
