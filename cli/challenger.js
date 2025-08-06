#!/usr/bin/env node
/**
 * challenger.js - Location challenger CLI implementation
 * Performs RTT measurements, filtering, and submits votes to smart contract
 */

const dgram = require("dgram");
const fs = require("fs").promises;
const { Command } = require("commander");
const crypto = require("crypto");
const GeometryEngine = require("./geometry.js");
const DelayMapper = require("./delayMapper.js");
const RobustFilters = require("./filters.js");
const AnchorClient = require("./anchorClient.js");

class Challenger {
  constructor(challengerId) {
    this.challengerId = challengerId || crypto.randomUUID();
    this.geometry = new GeometryEngine();
    this.delayMapper = new DelayMapper();
    this.filters = new RobustFilters();
    this.anchorClient = new AnchorClient();

    this.location = null;
    this.measurements = new Map(); // challengeId -> measurements
    this.isRunning = false;

    // RTT measurement settings
    this.PING_COUNT = 20; // Pings per measurement round
    this.PING_INTERVAL = 50; // ms between pings
    this.MEASUREMENT_ROUNDS = 5; // Rounds of measurements
    this.TIMEOUT_MS = 5000; // Ping timeout
  }

  /**
   * Initialize challenger with location and settings
   * @param {Object} challengerLocation - {lat, lon} coordinates
   */
  async initialize(challengerLocation) {
    this.location = challengerLocation;

    console.log(`🔍 Challenger ${this.challengerId} initialized`);
    console.log(
      `📍 Location: ${challengerLocation.lat}, ${challengerLocation.lon}`
    );

    await this.anchorClient.initialize();
    await this.delayMapper.loadMappings("data/mappings.json");
  }

  /**
   * Discover and join available challenges
   */
  async discoverChallenges() {
    try {
      console.log("🔎 Discovering active challenges...");

      const activeChallenges = await this.anchorClient.getActiveChallenges();

      if (activeChallenges.length === 0) {
        console.log("ℹ️  No active challenges found");
        return [];
      }

      console.log(`📋 Found ${activeChallenges.length} active challenges:`);

      for (const challenge of activeChallenges) {
        const distance = this.geometry.calculateDistance(
          this.location,
          challenge.claimedLocation
        );

        console.log(`   Challenge ${challenge.id}:`);
        console.log(
          `     Location: ${challenge.claimedLocation.lat}, ${challenge.claimedLocation.lon}`
        );
        console.log(`     Distance: ${Math.round(distance / 1000)} km`);
        console.log(`     Reward pool: ${challenge.rewardPool / 1000000} SOL`);
        console.log(
          `     Time remaining: ${Math.round(
            (challenge.deadline - Date.now()) / 1000
          )}s`
        );
      }

      return activeChallenges;
    } catch (error) {
      console.error("❌ Error discovering challenges:", error);
      return [];
    }
  }

  /**
   * Stake tokens and join a challenge
   * @param {string} challengeId - Challenge to join
   * @param {number} stakeAmount - Amount to stake in lamports
   */
  async joinChallenge(challengeId, stakeAmount = 100000) {
    try {
      console.log(
        `💰 Staking ${stakeAmount / 1000000} SOL for challenge ${challengeId}`
      );

      await this.anchorClient.stakeForChallenge(challengeId, stakeAmount);

      console.log("✅ Successfully joined challenge!");

      return true;
    } catch (error) {
      console.error("❌ Error joining challenge:", error);
      return false;
    }
  }

  /**
   * Perform RTT measurements to target Waldo
   * @param {string} challengeId - Challenge ID
   * @param {string} waldoAddress - Waldo's IP address
   * @param {number} waldoPort - Waldo's UDP port
   * @returns {Array} Array of RTT measurements
   */
  async measureRTT(challengeId, waldoAddress, waldoPort = 8888) {
    console.log(`📡 Starting RTT measurements to ${waldoAddress}:${waldoPort}`);

    const allMeasurements = [];

    for (let round = 0; round < this.MEASUREMENT_ROUNDS; round++) {
      console.log(`   Round ${round + 1}/${this.MEASUREMENT_ROUNDS}`);

      const roundMeasurements = await this.performRTTRound(
        challengeId,
        waldoAddress,
        waldoPort,
        round
      );

      allMeasurements.push(...roundMeasurements);

      // Brief pause between rounds
      if (round < this.MEASUREMENT_ROUNDS - 1) {
        await this.sleep(1000);
      }
    }

    // Filter and process measurements
    const processedMeasurements = this.processMeasurements(allMeasurements);

    console.log(`📊 Measurement summary:`);
    console.log(`   Total pings: ${allMeasurements.length}`);
    console.log(`   Successful: ${processedMeasurements.successful.length}`);
    console.log(`   Failed: ${processedMeasurements.failed.length}`);
    console.log(`   Min RTT: ${processedMeasurements.minRTT}ms`);
    console.log(`   Avg RTT: ${processedMeasurements.avgRTT}ms`);

    return processedMeasurements;
  }

  /**
   * Perform single round of RTT measurements
   */
  async performRTTRound(challengeId, address, port, round) {
    const measurements = [];

    for (let i = 0; i < this.PING_COUNT; i++) {
      const measurement = await this.sendPing(
        challengeId,
        address,
        port,
        i,
        round
      );
      measurements.push(measurement);

      if (i < this.PING_COUNT - 1) {
        await this.sleep(this.PING_INTERVAL);
      }
    }

    return measurements;
  }

  /**
   * Send single ping and measure RTT
   */
  async sendPing(challengeId, address, port, sequence, round) {
    return new Promise((resolve) => {
      const client = dgram.createSocket("udp4");
      const startTime = process.hrtime.bigint();
      const nonce = crypto.randomBytes(16).toString("hex");

      const pingData = {
        challengeId,
        challengerId: this.challengerId,
        sequence: sequence + round * this.PING_COUNT,
        timestamp: Number(startTime / 1000000n), // Convert to milliseconds
        nonce,
      };

      const message = Buffer.from(JSON.stringify(pingData));
      let resolved = false;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          client.close();
          resolve({
            sequence: pingData.sequence,
            success: false,
            error: "timeout",
            rtt: null,
            timestamp: pingData.timestamp,
          });
        }
      }, this.TIMEOUT_MS);

      // Handle response
      client.on("message", (response) => {
        if (resolved) return;

        const endTime = process.hrtime.bigint();
        const rtt = Number((endTime - startTime) / 1000000n); // Convert to milliseconds

        try {
          const responseData = JSON.parse(response.toString());

          // Verify response matches ping
          if (
            responseData.nonce === nonce &&
            responseData.sequence === pingData.sequence
          ) {
            resolved = true;
            clearTimeout(timeout);
            client.close();

            resolve({
              sequence: pingData.sequence,
              success: true,
              rtt,
              timestamp: pingData.timestamp,
              responseData,
              waldoLocation: responseData.waldoLocation,
            });
          }
        } catch (error) {
          // Invalid response format
        }
      });

      client.on("error", (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          client.close();
          resolve({
            sequence: pingData.sequence,
            success: false,
            error: error.message,
            rtt: null,
            timestamp: pingData.timestamp,
          });
        }
      });

      // Send ping
      client.send(message, port, address);
    });
  }

  /**
   * Process and filter RTT measurements
   */
  processMeasurements(measurements) {
    const successful = measurements.filter((m) => m.success);
    const failed = measurements.filter((m) => !m.success);

    if (successful.length === 0) {
      return {
        successful: [],
        failed,
        minRTT: null,
        avgRTT: null,
        medianRTT: null,
        stdRTT: null,
      };
    }

    const rtts = successful.map((m) => m.rtt);
    const minRTT = Math.min(...rtts);
    const avgRTT = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    const sortedRTTs = [...rtts].sort((a, b) => a - b);
    const medianRTT = sortedRTTs[Math.floor(sortedRTTs.length / 2)];

    // Calculate standard deviation
    const variance =
      rtts.reduce((sum, rtt) => sum + (rtt - avgRTT) ** 2, 0) / rtts.length;
    const stdRTT = Math.sqrt(variance);

    return {
      successful,
      failed,
      minRTT: Math.round(minRTT * 100) / 100,
      avgRTT: Math.round(avgRTT * 100) / 100,
      medianRTT: Math.round(medianRTT * 100) / 100,
      stdRTT: Math.round(stdRTT * 100) / 100,
    };
  }

  /**
   * Verify location claim using measurements and filtering
   */
  async verifyLocationClaim(challengeId, waldoClaimedLocation, measurements) {
    console.log("🔬 Analyzing measurements and verifying location claim...");

    try {
      // Calculate actual distance to claimed location
      const actualDistance = this.geometry.calculateDistance(
        this.location,
        waldoClaimedLocation
      );

      // Use delay mapper to estimate distance from RTT
      const mapping = this.delayMapper.getMapping(this.challengerId);
      const estimatedDistance = mapping(measurements.minRTT);

      console.log(`📏 Distance Analysis:`);
      console.log(`   Actual distance: ${Math.round(actualDistance)} meters`);
      console.log(
        `   Estimated from RTT: ${Math.round(estimatedDistance)} meters`
      );
      console.log(
        `   Error: ${Math.round(
          Math.abs(estimatedDistance - actualDistance)
        )} meters`
      );

      // Create measurement data for uncertainty calculation
      const challengerReports = [
        {
          challengerLocation: this.location,
          minDelay: measurements.minRTT,
          avgDelay: measurements.avgRTT,
          measurements: measurements.successful,
        },
      ];

      // Estimate uncertainty using geometry engine
      const uncertaintyResult = this.geometry.estimateUncertainty(
        waldoClaimedLocation,
        challengerReports,
        mapping,
        0.5 // β parameter
      );

      console.log(`🎯 Uncertainty Analysis:`);
      console.log(
        `   R* (uncertainty): ${Math.round(uncertaintyResult.rStar)} meters`
      );
      console.log(`   Angular groups: ${uncertaintyResult.angleGroups.size}`);

      // Determine vote based on uncertainty threshold
      const THRESHOLD = 1000; // 1km threshold
      const isValid = this.geometry.isLocationValid(
        uncertaintyResult.rStar,
        THRESHOLD
      );

      const vote = {
        challengeId,
        challengerId: this.challengerId,
        isValid,
        uncertainty: uncertaintyResult.rStar,
        threshold: THRESHOLD,
        measurements: {
          minRTT: measurements.minRTT,
          avgRTT: measurements.avgRTT,
          successfulPings: measurements.successful.length,
          totalPings:
            measurements.successful.length + measurements.failed.length,
        },
        distances: {
          actual: actualDistance,
          estimated: estimatedDistance,
          error: Math.abs(estimatedDistance - actualDistance),
        },
      };

      console.log(`🗳️  Vote Decision: ${isValid ? "✅ VALID" : "❌ INVALID"}`);

      return vote;
    } catch (error) {
      console.error("❌ Error verifying location claim:", error);
      throw error;
    }
  }

  /**
   * Submit vote to Anchor smart contract
   */
  async submitVote(vote) {
    try {
      console.log("📤 Submitting vote to blockchain...");

      await this.anchorClient.submitVote({
        challengeId: vote.challengeId,
        challengerId: vote.challengerId,
        isValid: vote.isValid,
        uncertainty: vote.uncertainty,
        minRTT: vote.measurements.minRTT,
      });

      console.log("✅ Vote submitted successfully!");

      // Store vote locally
      if (!this.measurements.has(vote.challengeId)) {
        this.measurements.set(vote.challengeId, []);
      }
      this.measurements.get(vote.challengeId).push(vote);
    } catch (error) {
      console.error("❌ Error submitting vote:", error);
      throw error;
    }
  }

  /**
   * Full challenge participation workflow
   */
  async participateInChallenge(
    challengeId,
    waldoAddress,
    waldoPort = 8888,
    stakeAmount = 100000
  ) {
    try {
      console.log(`🎯 Starting challenge participation: ${challengeId}`);

      // Get challenge details
      const challengeInfo = await this.anchorClient.getChallengeInfo(
        challengeId
      );
      if (!challengeInfo) {
        throw new Error("Challenge not found");
      }

      console.log(
        `📍 Target location: ${challengeInfo.claimedLocation.lat}, ${challengeInfo.claimedLocation.lon}`
      );

      // Join challenge
      const joined = await this.joinChallenge(challengeId, stakeAmount);
      if (!joined) {
        throw new Error("Failed to join challenge");
      }

      // Perform measurements
      const measurements = await this.measureRTT(
        challengeId,
        waldoAddress,
        waldoPort
      );
      if (measurements.successful.length === 0) {
        throw new Error("No successful measurements obtained");
      }

      // Add calibration data for future mapping improvements
      const actualDistance = this.geometry.calculateDistance(
        this.location,
        challengeInfo.claimedLocation
      );
      this.delayMapper.addCalibrationPoint(
        this.challengerId,
        measurements.minRTT,
        actualDistance
      );

      // Verify location and create vote
      const vote = await this.verifyLocationClaim(
        challengeId,
        challengeInfo.claimedLocation,
        measurements
      );

      // Submit vote
      await this.submitVote(vote);

      console.log("🎉 Challenge participation completed successfully!");

      return vote;
    } catch (error) {
      console.error("❌ Error participating in challenge:", error);
      throw error;
    }
  }

  /**
   * Save measurement and mapping data
   */
  async saveData() {
    // Save measurements
    const measurementData = {
      challengerId: this.challengerId,
      location: this.location,
      measurements: Object.fromEntries(this.measurements),
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(
      `data/challenger_${this.challengerId}_measurements.json`,
      JSON.stringify(measurementData, null, 2)
    );

    // Save mapping data
    await this.delayMapper.saveMappings("data/mappings.json");

    console.log("💾 Data saved successfully");
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI Interface
const program = new Command();

program
  .name("challenger")
  .description("Byzantine Fault-Tolerant Proof-of-Location Challenger")
  .version("1.0.0");

program
  .command("discover")
  .description("Discover active challenges")
  .requiredOption("-lat, --latitude <lat>", "Challenger latitude", parseFloat)
  .requiredOption("-lon, --longitude <lon>", "Challenger longitude", parseFloat)
  .action(async (options) => {
    const challenger = new Challenger();

    try {
      await challenger.initialize({
        lat: options.latitude,
        lon: options.longitude,
      });
      const challenges = await challenger.discoverChallenges();

      if (challenges.length > 0) {
        console.log('\n💡 Use "challenger participate" to join a challenge');
      }
    } catch (error) {
      console.error("❌ Error:", error);
    }
  });

program
  .command("participate")
  .description("Participate in a specific challenge")
  .requiredOption("-lat, --latitude <lat>", "Challenger latitude", parseFloat)
  .requiredOption("-lon, --longitude <lon>", "Challenger longitude", parseFloat)
  .requiredOption(
    "-c, --challenge <challengeId>",
    "Challenge ID to participate in"
  )
  .requiredOption("-w, --waldo <address>", "Waldo IP address or hostname")
  .option("-p, --port <port>", "Waldo UDP port", parseInt, 8888)
  .option("-s, --stake <amount>", "Stake amount in lamports", parseInt, 100000)
  .action(async (options) => {
    const challenger = new Challenger();

    try {
      await challenger.initialize({
        lat: options.latitude,
        lon: options.longitude,
      });

      const vote = await challenger.participateInChallenge(
        options.challenge,
        options.waldo,
        options.port,
        options.stake
      );

      console.log(`\n🏆 Final vote: ${vote.isValid ? "VALID" : "INVALID"}`);
      console.log(
        `📊 Uncertainty: ${Math.round(vote.uncertainty)}m (threshold: ${
          vote.threshold
        }m)`
      );

      await challenger.saveData();
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  });

program
  .command("ping")
  .description("Test RTT measurements to Waldo (without blockchain)")
  .requiredOption("-w, --waldo <address>", "Waldo IP address or hostname")
  .option("-p, --port <port>", "Waldo UDP port", parseInt, 8888)
  .option("-c, --count <count>", "Number of pings", parseInt, 10)
  .action(async (options) => {
    const challenger = new Challenger();
    challenger.PING_COUNT = options.count;
    challenger.MEASUREMENT_ROUNDS = 1;

    try {
      const measurements = await challenger.measureRTT(
        "test-challenge",
        options.waldo,
        options.port
      );

      console.log("\n📊 Ping Test Results:");
      console.log(
        `   Success rate: ${(
          (measurements.successful.length /
            (measurements.successful.length + measurements.failed.length)) *
          100
        ).toFixed(1)}%`
      );
      console.log(`   Min RTT: ${measurements.minRTT}ms`);
      console.log(`   Avg RTT: ${measurements.avgRTT}ms`);
      console.log(`   Median RTT: ${measurements.medianRTT}ms`);
      console.log(`   Std deviation: ${measurements.stdRTT}ms`);
    } catch (error) {
      console.error("❌ Error:", error);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = Challenger;
