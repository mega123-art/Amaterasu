/**
 * filters.js - Robust filtering and matrix completion for Byzantine fault tolerance
 * Implements ratio-based filtering, β-cut logic, and low-rank matrix recovery
 */

const math = require("mathjs");

class RobustFilters {
  constructor() {
    this.CONVERGENCE_THRESHOLD = 1e-6;
    this.MAX_ITERATIONS = 1000;
    this.DEFAULT_LAMBDA = 0.1; // Regularization parameter for matrix completion
  }

  /**
   * Ratio-based filtering: Remove outliers based on distance/delay ratios
   * @param {Array} measurements - Array of {delay, distance, challengerId}
   * @param {number} beta - Fraction of outliers to remove (0.1 = 10%)
   * @param {string} method - 'global' or 'per_bin'
   * @returns {Object} {filtered, outliers, statistics}
   */
  ratioBasedFiltering(measurements, beta = 0.1, method = "global") {
    if (measurements.length === 0) {
      return { filtered: [], outliers: [], statistics: null };
    }

    // Calculate ratios
    const ratios = measurements.map((m, i) => ({
      ratio: m.distance / m.delay,
      index: i,
      measurement: m,
    }));

    let filtered = [];
    let outliers = [];

    if (method === "global") {
      // Global ratio-based filtering
      const result = this._globalRatioFilter(ratios, beta);
      filtered = result.filtered.map((r) => r.measurement);
      outliers = result.outliers.map((r) => r.measurement);
    } else if (method === "per_bin") {
      // Per-delay-bin filtering
      const result = this._perBinRatioFilter(ratios, beta);
      filtered = result.filtered.map((r) => r.measurement);
      outliers = result.outliers.map((r) => r.measurement);
    }

    // Calculate statistics
    const validRatios = filtered.map((m) => m.distance / m.delay);
    const statistics = {
      totalMeasurements: measurements.length,
      filteredCount: filtered.length,
      outlierCount: outliers.length,
      meanRatio: validRatios.reduce((a, b) => a + b, 0) / validRatios.length,
      medianRatio: this._median(validRatios),
      stdRatio: this._standardDeviation(validRatios),
    };

    return { filtered, outliers, statistics };
  }

  /**
   * Global ratio filtering - remove β-fraction globally
   */
  _globalRatioFilter(ratios, beta) {
    const sorted = [...ratios].sort((a, b) => a.ratio - b.ratio);
    const removeCount = Math.floor(beta * sorted.length);
    const keepStart = Math.floor(removeCount / 2);
    const keepEnd = sorted.length - Math.ceil(removeCount / 2);

    const filtered = sorted.slice(keepStart, keepEnd);
    const outliers = [...sorted.slice(0, keepStart), ...sorted.slice(keepEnd)];

    return { filtered, outliers };
  }

  /**
   * Per-bin ratio filtering - remove outliers within delay bins
   */
  _perBinRatioFilter(ratios, beta, binCount = 10) {
    if (ratios.length === 0) return { filtered: [], outliers: [] };

    // Create delay bins
    const delays = ratios.map((r) => r.measurement.delay);
    const minDelay = Math.min(...delays);
    const maxDelay = Math.max(...delays);
    const binSize = (maxDelay - minDelay) / binCount;

    const bins = new Map();

    // Assign ratios to bins
    for (const ratioObj of ratios) {
      const binIndex = Math.min(
        Math.floor((ratioObj.measurement.delay - minDelay) / binSize),
        binCount - 1
      );

      if (!bins.has(binIndex)) {
        bins.set(binIndex, []);
      }
      bins.get(binIndex).push(ratioObj);
    }

    let filtered = [];
    let outliers = [];

    // Filter each bin separately
    for (const binRatios of bins.values()) {
      if (binRatios.length <= 2) {
        // Keep all if too few samples
        filtered.push(...binRatios);
        continue;
      }

      const binResult = this._globalRatioFilter(binRatios, beta);
      filtered.push(...binResult.filtered);
      outliers.push(...binResult.outliers);
    }

    return { filtered, outliers };
  }

  /**
   * β-cut filtering: Keep only β-fraction of best measurements
   * @param {Array} measurements - Measurements with quality scores
   * @param {number} beta - Fraction to keep (0.5 = keep best 50%)
   * @returns {Array} Filtered measurements
   */
  betaCutFiltering(measurements, beta = 0.5) {
    if (measurements.length === 0) return [];

    // Sort by quality (lower is better for error metrics)
    const sorted = [...measurements].sort((a, b) => {
      const qualityA = a.qualityScore || a.error || Infinity;
      const qualityB = b.qualityScore || b.error || Infinity;
      return qualityA - qualityB;
    });

    const keepCount = Math.ceil(beta * sorted.length);
    return sorted.slice(0, keepCount);
  }

  /**
   * Matrix completion using Augmented Lagrange Multiplier (ALM) method
   * Solves: min ||L||_* + λ||S||_1 subject to M = L + S
   * @param {Array} matrix - 2D array representing delay matrix M
   * @param {number} lambda - Regularization parameter
   * @returns {Object} {L: low-rank, S: sparse, converged, iterations}
   */
  matrixCompletion(matrix, lambda = null) {
    if (!matrix || matrix.length === 0) {
      throw new Error("Invalid matrix for completion");
    }

    const M = math.matrix(matrix);
    const [m, n] = [matrix.length, matrix[0].length];

    // Auto-tune lambda if not provided
    if (lambda === null) {
      lambda = 1 / Math.sqrt(Math.max(m, n));
    }

    // Initialize variables
    let L = math.zeros([m, n]);
    let S = math.zeros([m, n]);
    let Y = math.zeros([m, n]); // Lagrange multipliers
    let mu = 1.25 / this._spectralNorm(M); // Step size
    let rho = 1.5; // Step size increase factor

    let converged = false;
    let iteration = 0;

    while (!converged && iteration < this.MAX_ITERATIONS) {
      // Update L using SVD soft thresholding
      const L_temp = math.subtract(math.subtract(M, S), math.divide(Y, mu));
      L = this._softThresholdSVD(L_temp, 1 / mu);

      // Update S using soft thresholding
      const S_temp = math.subtract(math.subtract(M, L), math.divide(Y, mu));
      S = this._softThreshold(S_temp, lambda / mu);

      // Update Lagrange multipliers
      const residual = math.subtract(math.subtract(M, L), S);
      Y = math.subtract(Y, math.multiply(mu, residual));

      // Check convergence
      const residualNorm = this._frobeniusNorm(residual);
      const matrixNorm = this._frobeniusNorm(M);

      if (residualNorm / matrixNorm < this.CONVERGENCE_THRESHOLD) {
        converged = true;
      }

      // Update step size
      mu = Math.min(mu * rho, 1e10);
      iteration++;
    }

    return {
      L: L.toArray(),
      S: S.toArray(),
      converged,
      iterations: iteration,
      finalResidual: this._frobeniusNorm(math.subtract(math.subtract(M, L), S)),
    };
  }

  /**
   * Soft thresholding for SVD (nuclear norm minimization)
   */
  _softThresholdSVD(matrix, threshold) {
    try {
      const svd = math.usolve
        ? this._customSVD(matrix)
        : this._approximateSVD(matrix);

      const { U, s, V } = svd;

      // Apply soft thresholding to singular values
      const s_thresh = s.map((val) => Math.max(0, val - threshold));

      // Reconstruct matrix
      const S_diag = math.diag(s_thresh);
      const result = math.multiply(math.multiply(U, S_diag), math.transpose(V));

      return result;
    } catch (error) {
      console.warn("SVD failed, using identity:", error.message);
      return matrix;
    }
  }

  /**
   * Approximate SVD using power iteration method
   */
  _approximateSVD(matrix) {
    const A = math.matrix(matrix);
    const [m, n] = A.size();
    const k = Math.min(5, Math.min(m, n)); // Rank approximation

    // Power iteration for top-k singular values
    const U = [];
    const s = [];
    const V = [];

    let A_work = math.clone(A);

    for (let i = 0; i < k; i++) {
      // Random initialization
      let v = math.random([n, 1]);
      v = math.divide(v, this._frobeniusNorm(v));

      // Power iterations
      for (let iter = 0; iter < 10; iter++) {
        let u = math.multiply(A_work, v);
        u = math.divide(u, this._frobeniusNorm(u));

        let v_new = math.multiply(math.transpose(A_work), u);
        v_new = math.divide(v_new, this._frobeniusNorm(v_new));

        // Check convergence
        const diff = this._frobeniusNorm(math.subtract(v, v_new));
        v = v_new;

        if (diff < 1e-6) break;
      }

      const u = math.multiply(A_work, v);
      const sigma = this._frobeniusNorm(u);

      if (sigma < 1e-10) break;

      U.push(math.divide(u, sigma));
      s.push(sigma);
      V.push(v);

      // Deflate matrix
      const outer = math.multiply(math.multiply(u, math.transpose(v)), sigma);
      A_work = math.subtract(A_work, outer);
    }

    return {
      U: math.transpose(math.concat(...U.map((u) => math.transpose(u)))),
      s: s,
      V: math.transpose(math.concat(...V.map((v) => math.transpose(v)))),
    };
  }

  /**
   * Element-wise soft thresholding
   */
  _softThreshold(matrix, threshold) {
    return math.map(matrix, (value) => {
      if (value > threshold) return value - threshold;
      if (value < -threshold) return value + threshold;
      return 0;
    });
  }

  /**
   * Calculate Frobenius norm
   */
  _frobeniusNorm(matrix) {
    let sum = 0;
    math.forEach(matrix, (value) => {
      sum += value * value;
    });
    return Math.sqrt(sum);
  }

  /**
   * Calculate spectral norm (largest singular value)
   */
  _spectralNorm(matrix) {
    try {
      const svd = this._approximateSVD(matrix);
      return svd.s.length > 0 ? svd.s[0] : 1;
    } catch (error) {
      return this._frobeniusNorm(matrix);
    }
  }

  /**
   * Detect Byzantine challengers using matrix completion
   * @param {Array} delayMatrix - n×m matrix of RTT measurements
   * @param {number} threshold - Corruption threshold
   * @returns {Object} {byzantineChallengers, cleanMatrix, corruptionLevel}
   */
  detectByzantineChallengers(delayMatrix, threshold = 0.3) {
    if (!delayMatrix || delayMatrix.length === 0) {
      return { byzantineChallengers: [], cleanMatrix: [], corruptionLevel: 0 };
    }

    // Apply matrix completion
    const completion = this.matrixCompletion(delayMatrix);
    const { L, S } = completion;

    // Identify Byzantine challengers based on sparse component
    const byzantineChallengers = [];
    const [m, n] = [delayMatrix.length, delayMatrix[0].length];

    for (let i = 0; i < m; i++) {
      let corruptionScore = 0;
      for (let j = 0; j < n; j++) {
        corruptionScore += Math.abs(S[i][j]);
      }
      corruptionScore /= n; // Average corruption per challenger

      if (corruptionScore > threshold) {
        byzantineChallengers.push({
          challengerIndex: i,
          corruptionScore,
          isbyzantine: true,
        });
      }
    }

    return {
      byzantineChallengers,
      cleanMatrix: L,
      corruptionLevel: byzantineChallengers.length / m,
      sparseComponent: S,
      converged: completion.converged,
    };
  }

  /**
   * Combine multiple filtering methods for robust challenger selection
   * @param {Array} measurements - Challenger measurements
   * @param {Object} options - Filtering options
   * @returns {Object} Comprehensive filtering results
   */
  robustChallengerFiltering(measurements, options = {}) {
    const {
      ratioFilterBeta = 0.15,
      betaCutFraction = 0.6,
      matrixThreshold = 0.3,
      useMatrixCompletion = true,
    } = options;

    let results = {
      original: measurements,
      filtered: [...measurements],
      outliers: [],
      byzantineDetected: [],
      stages: [],
    };

    // Stage 1: Ratio-based filtering
    const ratioResult = this.ratioBasedFiltering(
      results.filtered,
      ratioFilterBeta
    );
    results.filtered = ratioResult.filtered;
    results.outliers.push(...ratioResult.outliers);
    results.stages.push({
      stage: "ratio_filtering",
      removed: ratioResult.outliers.length,
      remaining: ratioResult.filtered.length,
    });

    // Stage 2: Matrix completion for Byzantine detection
    if (useMatrixCompletion && results.filtered.length >= 3) {
      try {
        // Convert to delay matrix (simplified - assumes single target)
        const delayMatrix = this._measurementsToMatrix(results.filtered);
        const byzantineResult = this.detectByzantineChallengers(
          delayMatrix,
          matrixThreshold
        );

        results.byzantineDetected = byzantineResult.byzantineChallengers;

        // Remove Byzantine challengers
        const byzantineIndices = new Set(
          byzantineResult.byzantineChallengers.map((b) => b.challengerIndex)
        );
        results.filtered = results.filtered.filter(
          (_, i) => !byzantineIndices.has(i)
        );

        results.stages.push({
          stage: "byzantine_detection",
          removed: byzantineResult.byzantineChallengers.length,
          remaining: results.filtered.length,
        });
      } catch (error) {
        console.warn("Matrix completion failed:", error.message);
      }
    }

    // Stage 3: β-cut filtering (keep best measurements)
    if (results.filtered.length > 3) {
      const beforeCount = results.filtered.length;
      results.filtered = this.betaCutFiltering(
        results.filtered,
        betaCutFraction
      );
      results.stages.push({
        stage: "beta_cut",
        removed: beforeCount - results.filtered.length,
        remaining: results.filtered.length,
      });
    }

    // Calculate final statistics
    results.finalStats = {
      originalCount: measurements.length,
      finalCount: results.filtered.length,
      filteringRatio: results.filtered.length / measurements.length,
      totalOutliers: results.outliers.length,
      byzantineCount: results.byzantineDetected.length,
    };

    return results;
  }

  /**
   * Convert measurements to delay matrix format
   */
  _measurementsToMatrix(measurements) {
    // Group by challenger
    const challengerMap = new Map();
    for (const m of measurements) {
      if (!challengerMap.has(m.challengerId)) {
        challengerMap.set(m.challengerId, []);
      }
      challengerMap.get(m.challengerId).push(m.delay);
    }

    // Create matrix
    const challengers = Array.from(challengerMap.keys());
    const maxMeasurements = Math.max(
      ...Array.from(challengerMap.values()).map((arr) => arr.length)
    );

    const matrix = [];
    for (const challengerId of challengers) {
      const delays = challengerMap.get(challengerId);
      const row = new Array(maxMeasurements).fill(0);
      for (let i = 0; i < delays.length && i < maxMeasurements; i++) {
        row[i] = delays[i];
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Utility functions
   */
  _median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  _standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }
}

module.exports = RobustFilters;
