/**
 * geometry.js - Core geometric calculations for Byzantine Fault-Tolerant PoLoc
 * Implements all equations from "Byzantine Fault-Tolerant Delay-Based Proof-of-Location via Internet Geometry"
 */

const math = require("mathjs");

class GeometryEngine {
  constructor() {
    this.EARTH_RADIUS = 6371000; // meters
    this.LIGHT_SPEED = 299792458; // m/s
    this.MIN_PROPAGATION_DELAY = 0.001; // 1ms minimum
  }

  /**
   * Calculate great circle distance between two geographic points
   * @param {Object} point1 - {lat, lon} in degrees
   * @param {Object} point2 - {lat, lon} in degrees
   * @returns {number} Distance in meters
   */
  calculateDistance(point1, point2) {
    const lat1Rad = math.unit(point1.lat, "deg").to("rad").value;
    const lon1Rad = math.unit(point1.lon, "deg").to("rad").value;
    const lat2Rad = math.unit(point2.lat, "deg").to("rad").value;
    const lon2Rad = math.unit(point2.lon, "deg").to("rad").value;

    const deltaLat = lat2Rad - lat1Rad;
    const deltaLon = lon2Rad - lon1Rad;

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }

  /**
   * Calculate bearing angle between two points
   * @param {Object} point1 - {lat, lon} in degrees
   * @param {Object} point2 - {lat, lon} in degrees
   * @returns {number} Bearing in radians [0, 2π]
   */
  calculateBearing(point1, point2) {
    const lat1 = math.unit(point1.lat, "deg").to("rad").value;
    const lat2 = math.unit(point2.lat, "deg").to("rad").value;
    const deltaLon = math.unit(point2.lon - point1.lon, "deg").to("rad").value;

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    let bearing = Math.atan2(y, x);
    // Normalize to [0, 2π]
    return bearing < 0 ? bearing + 2 * Math.PI : bearing;
  }

  /**
   * Equation (6) from paper: Calculate Ri for uncertainty estimation
   * Ri = di_hat² - di² sin²(αi) - di cos(αi)
   * @param {number} di_hat - Estimated distance from delay
   * @param {number} di - True distance (geodesic)
   * @param {number} alpha_i - Angle between claimed and actual location
   * @returns {number} Ri value for uncertainty computation
   */
  calculateRi(di_hat, di, alpha_i) {
    const sin_alpha = Math.sin(alpha_i);
    const cos_alpha = Math.cos(alpha_i);

    return di_hat * di_hat - di * di * sin_alpha * sin_alpha - di * cos_alpha;
  }

  /**
   * Equation (2): Calculate R*_θ for direction θ using β-quantile
   * R*_θ = β-th smallest Riθ per direction θ
   * @param {Array} ri_values - Array of Ri values for direction θ
   * @param {number} beta - Fraction for β-quantile (e.g., 0.5 for median)
   * @returns {number} R*_θ value
   */
  calculateRStarTheta(ri_values, beta = 0.5) {
    if (ri_values.length === 0) return Infinity;

    const sorted = [...ri_values].sort((a, b) => a - b);
    const index = Math.floor(beta * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * Equation (3): Calculate final R* = max over θ of R*_θ
   * @param {Map} rStarByTheta - Map of θ -> R*_θ values
   * @returns {number} Final R* uncertainty estimate
   */
  calculateFinalRStar(rStarByTheta) {
    if (rStarByTheta.size === 0) return Infinity;

    let maxRStar = -Infinity;
    for (const rStar of rStarByTheta.values()) {
      maxRStar = Math.max(maxRStar, rStar);
    }
    return maxRStar;
  }

  /**
   * Angle-based filtering: Group challengers by angular direction
   * @param {Object} claimedLocation - {lat, lon} of Waldo's claim
   * @param {Array} challengerData - Array of {location: {lat, lon}, delay, distance}
   * @param {number} angleResolution - Angular resolution in radians (default π/18 = 10°)
   * @returns {Map} Map of angle bucket -> array of challenger data
   */
  groupByAngle(
    claimedLocation,
    challengerData,
    angleResolution = Math.PI / 18
  ) {
    const angleGroups = new Map();

    for (const data of challengerData) {
      const bearing = this.calculateBearing(claimedLocation, data.location);
      const angleBucket =
        Math.floor(bearing / angleResolution) * angleResolution;

      if (!angleGroups.has(angleBucket)) {
        angleGroups.set(angleBucket, []);
      }
      angleGroups.get(angleBucket).push(data);
    }

    return angleGroups;
  }

  /**
   * Main uncertainty estimation algorithm
   * @param {Object} claimedLocation - Waldo's claimed location {lat, lon}
   * @param {Array} challengerReports - Array of challenger measurements
   * @param {Function} delayToDistanceMapper - Function mapping delay -> distance
   * @param {number} beta - β-quantile parameter
   * @returns {Object} {rStar, angleGroups, riValues}
   */
  estimateUncertainty(
    claimedLocation,
    challengerReports,
    delayToDistanceMapper,
    beta = 0.5
  ) {
    const angleGroups = this.groupByAngle(
      claimedLocation,
      challengerReports.map((report) => ({
        location: report.challengerLocation,
        delay: report.minDelay,
        distance: this.calculateDistance(
          claimedLocation,
          report.challengerLocation
        ),
      }))
    );

    const rStarByTheta = new Map();
    const riValuesByAngle = new Map();

    // Process each angular direction
    for (const [theta, challengersInDirection] of angleGroups) {
      const riValues = [];

      for (const challenger of challengersInDirection) {
        // Map delay to estimated distance using PoIG
        const di_hat = delayToDistanceMapper(challenger.delay);
        const di = challenger.distance;

        // Calculate angle between claimed and challenger location
        const alpha_i = this.calculateBearing(
          claimedLocation,
          challenger.location
        );

        // Apply Equation (6)
        const ri = this.calculateRi(di_hat, di, alpha_i);
        riValues.push(ri);
      }

      // Apply Equation (2): β-quantile
      const rStarTheta = this.calculateRStarTheta(riValues, beta);
      rStarByTheta.set(theta, rStarTheta);
      riValuesByAngle.set(theta, riValues);
    }

    // Apply Equation (3): max over all directions
    const rStar = this.calculateFinalRStar(rStarByTheta);

    return {
      rStar,
      angleGroups: rStarByTheta,
      riValues: riValuesByAngle,
      totalChallengers: challengerReports.length,
    };
  }

  /**
   * Check if location claim is valid based on R* threshold
   * @param {number} rStar - Computed R* uncertainty
   * @param {number} threshold - Acceptance threshold
   * @returns {boolean} True if claim is valid
   */
  isLocationValid(rStar, threshold = 1000) {
    // 1km default threshold
    return rStar <= threshold && rStar >= 0;
  }

  /**
   * Generate test points around a location for validation
   * @param {Object} center - {lat, lon} center point
   * @param {number} radius - Radius in meters
   * @param {number} count - Number of test points
   * @returns {Array} Array of test locations
   */
  generateTestPoints(center, radius, count = 8) {
    const points = [];
    const angleStep = (2 * Math.PI) / count;

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const lat =
        center.lat +
        (radius / this.EARTH_RADIUS) * (180 / Math.PI) * Math.cos(angle);
      const lon =
        center.lon +
        ((radius / this.EARTH_RADIUS) * (180 / Math.PI) * Math.sin(angle)) /
          Math.cos((center.lat * Math.PI) / 180);

      points.push({ lat, lon });
    }

    return points;
  }
}

module.exports = GeometryEngine;
