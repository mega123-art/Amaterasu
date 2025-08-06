/**
 * delayMapper.js - Proof-of-Internet-Geometry (PoIG) delay-to-distance mapping
 * Implements monotone envelope construction and robust filtering
 */

const fs = require("fs").promises;
const GeometryEngine = require("./geometry.js");

class DelayMapper {
  constructor() {
    this.geometry = new GeometryEngine();
    this.mappings = new Map(); // challenger_id -> Fi(t) mapping
    this.calibrationData = new Map(); // challenger_id -> {delays, distances}
    this.LIGHT_SPEED = 299792458; // m/s
    this.MIN_DELAY_MS = 0.1; // 0.1ms minimum realistic delay
  }

  /**
   * Add calibration measurement for a challenger
   * @param {string} challengerId - Unique challenger identifier
   * @param {number} delay - RTT delay in milliseconds
   * @param {number} distance - True geodesic distance in meters
   */
  addCalibrationPoint(challengerId, delay, distance) {
    if (!this.calibrationData.has(challengerId)) {
      this.calibrationData.set(challengerId, {
        delays: [],
        distances: [],
        ratios: [],
      });
    }

    const data = this.calibrationData.get(challengerId);
    data.delays.push(delay);
    data.distances.push(distance);
    data.ratios.push(distance / delay); // distance per ms
  }

  /**
   * Apply robust filtering to remove β-fraction of outliers
   * @param {Array} ratios - Array of distance/delay ratios
   * @param {number} beta - Fraction to filter (0.1 = remove 10% outliers)
   * @returns {Array} Filtered ratios
   */
  applyRobustFiltering(ratios, beta = 0.1) {
    if (ratios.length === 0) return [];

    // Sort ratios and remove β-fraction of extreme values
    const sorted = [...ratios].sort((a, b) => a - b);
    const removeCount = Math.floor(beta * sorted.length);

    // Remove β/2 from each tail
    const startIndex = Math.floor(removeCount / 2);
    const endIndex = sorted.length - Math.ceil(removeCount / 2);

    return sorted.slice(startIndex, endIndex);
  }

  /**
   * Build monotone envelope (outer periphery) for delay-to-distance mapping
   * @param {Array} delays - Array of delay values (ms)
   * @param {Array} distances - Array of corresponding distances (m)
   * @returns {Function} Monotone mapping function Fi(t)
   */
  buildMonotoneEnvelope(delays, distances) {
    if (delays.length !== distances.length || delays.length === 0) {
      throw new Error(
        "Invalid calibration data: delays and distances must have same non-zero length"
      );
    }

    // Create (delay, distance) pairs and sort by delay
    const points = delays
      .map((delay, i) => ({ delay, distance: distances[i] }))
      .sort((a, b) => a.delay - b.delay);

    // Build monotone envelope using convex hull approach
    const envelope = [];

    // Forward pass: find upper envelope
    for (const point of points) {
      // Remove points that would create non-monotone behavior
      while (envelope.length >= 2) {
        const prev2 = envelope[envelope.length - 2];
        const prev1 = envelope[envelope.length - 1];

        // Check if current point creates better (higher) distance/delay ratio
        const slope1 =
          (prev1.distance - prev2.distance) / (prev1.delay - prev2.delay);
        const slope2 =
          (point.distance - prev1.distance) / (point.delay - prev1.delay);

        if (slope2 > slope1) {
          envelope.pop(); // Remove dominated point
        } else {
          break;
        }
      }
      envelope.push(point);
    }

    // Create interpolation function
    return (queryDelay) => {
      if (queryDelay <= 0) return 0;
      if (envelope.length === 0) return (queryDelay * this.LIGHT_SPEED) / 1000; // Fallback to speed of light

      // Find bounding points
      let leftPoint = envelope[0];
      let rightPoint = envelope[envelope.length - 1];

      for (let i = 0; i < envelope.length - 1; i++) {
        if (
          envelope[i].delay <= queryDelay &&
          envelope[i + 1].delay >= queryDelay
        ) {
          leftPoint = envelope[i];
          rightPoint = envelope[i + 1];
          break;
        }
      }

      // Handle edge cases
      if (queryDelay <= leftPoint.delay) return leftPoint.distance;
      if (queryDelay >= rightPoint.delay) {
        // Extrapolate using last segment slope
        const slope =
          (rightPoint.distance - leftPoint.distance) /
          (rightPoint.delay - leftPoint.delay);
        return rightPoint.distance + slope * (queryDelay - rightPoint.delay);
      }

      // Linear interpolation between bounding points
      const t =
        (queryDelay - leftPoint.delay) / (rightPoint.delay - leftPoint.delay);
      return (
        leftPoint.distance + t * (rightPoint.distance - leftPoint.distance)
      );
    };
  }

  /**
   * Train mapping for a specific challenger using collected calibration data
   * @param {string} challengerId - Challenger to train mapping for
   * @param {number} beta - Robust filtering parameter
   * @returns {Function} Trained Fi(t) mapping function
   */
  trainMapping(challengerId, beta = 0.1) {
    const calibData = this.calibrationData.get(challengerId);
    if (!calibData || calibData.delays.length < 3) {
      throw new Error(
        `Insufficient calibration data for challenger ${challengerId}`
      );
    }

    // Apply robust filtering to remove outliers
    const filteredRatios = this.applyRobustFiltering(calibData.ratios, beta);

    if (filteredRatios.length === 0) {
      throw new Error(
        `All calibration data filtered out for challenger ${challengerId}`
      );
    }

    // Rebuild filtered dataset
    const filteredIndices = [];
    for (let i = 0; i < calibData.ratios.length; i++) {
      if (filteredRatios.includes(calibData.ratios[i])) {
        filteredIndices.push(i);
      }
    }

    const filteredDelays = filteredIndices.map((i) => calibData.delays[i]);
    const filteredDistances = filteredIndices.map(
      (i) => calibData.distances[i]
    );

    // Build monotone envelope
    const mappingFunction = this.buildMonotoneEnvelope(
      filteredDelays,
      filteredDistances
    );

    // Cache the mapping
    this.mappings.set(challengerId, mappingFunction);

    return mappingFunction;
  }

  /**
   * Get or create mapping function for challenger
   * @param {string} challengerId - Challenger identifier
   * @returns {Function} Fi(t) mapping function
   */
  getMapping(challengerId) {
    if (this.mappings.has(challengerId)) {
      return this.mappings.get(challengerId);
    }

    // Try to train if calibration data exists
    if (this.calibrationData.has(challengerId)) {
      return this.trainMapping(challengerId);
    }

    // Fallback to speed-of-light mapping
    console.warn(
      `No mapping for challenger ${challengerId}, using speed-of-light fallback`
    );
    return (delay) => (delay * this.LIGHT_SPEED) / 1000; // Convert ms to meters
  }

  /**
   * Batch process multiple challengers' delay measurements
   * @param {Array} measurements - Array of {challengerId, delay, targetLocation}
   * @param {Object} waldoLocation - Waldo's claimed location {lat, lon}
   * @returns {Array} Array of {challengerId, estimatedDistance, actualDistance, error}
   */
  processDelayMeasurements(measurements, waldoLocation) {
    const results = [];

    for (const measurement of measurements) {
      const mapping = this.getMapping(measurement.challengerId);
      const estimatedDistance = mapping(measurement.delay);
      const actualDistance = this.geometry.calculateDistance(
        waldoLocation,
        measurement.targetLocation
      );

      results.push({
        challengerId: measurement.challengerId,
        delay: measurement.delay,
        estimatedDistance,
        actualDistance,
        error: Math.abs(estimatedDistance - actualDistance),
        relativeError:
          Math.abs(estimatedDistance - actualDistance) / actualDistance,
      });
    }

    return results;
  }

  /**
   * Save mapping data to file
   * @param {string} filepath - Path to save mappings
   */
  async saveMappings(filepath) {
    const data = {
      calibrationData: Object.fromEntries(this.calibrationData),
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * Load mapping data from file
   * @param {string} filepath - Path to load mappings from
   */
  async loadMappings(filepath) {
    try {
      const data = JSON.parse(await fs.readFile(filepath, "utf8"));
      this.calibrationData = new Map(Object.entries(data.calibrationData));

      // Rebuild mappings
      for (const challengerId of this.calibrationData.keys()) {
        this.trainMapping(challengerId);
      }
    } catch (error) {
      console.warn(`Failed to load mappings from ${filepath}:`, error.message);
    }
  }

  /**
   * Get mapping quality metrics for a challenger
   * @param {string} challengerId - Challenger to analyze
   * @returns {Object} Quality metrics
   */
  getMappingQuality(challengerId) {
    const calibData = this.calibrationData.get(challengerId);
    if (!calibData) return null;

    const mapping = this.getMapping(challengerId);
    let totalError = 0;
    let maxError = 0;

    for (let i = 0; i < calibData.delays.length; i++) {
      const predicted = mapping(calibData.delays[i]);
      const actual = calibData.distances[i];
      const error = Math.abs(predicted - actual);

      totalError += error;
      maxError = Math.max(maxError, error);
    }

    return {
      challengerId,
      dataPoints: calibData.delays.length,
      avgError: totalError / calibData.delays.length,
      maxError,
      rmse: Math.sqrt(
        calibData.delays.reduce((sum, delay, i) => {
          const error = mapping(delay) - calibData.distances[i];
          return sum + error * error;
        }, 0) / calibData.delays.length
      ),
    };
  }
}

module.exports = DelayMapper;
