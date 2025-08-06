/**
 * matrixCompletion.js - Robust Matrix Completion for Byzantine Fault Tolerance
 * Implements Low-Rank + Sparse decomposition (M = L + C) using Augmented Lagrange Multiplier
 */

const math = require('mathjs');

class MatrixCompletion {
    constructor() {
        this.config = {
            maxIterations: 100,
            tolerance: 1e-6,
            lambda: 0.1,        // Sparse regularization parameter
            mu: 1.0,            // Lagrange multiplier step size
            rho: 1.6,           // Penalty parameter growth rate
            maxMu: 1e10,        // Maximum penalty parameter
            verbose: false
        };
    }

    /**
     * Robust Principal Component Analysis via Exact Augmented Lagrange Multiplier
     * Solves: min ||L||_* + λ||S||_1 subject to M = L + S
     * Where M is observed matrix, L is low-rank component, S is sparse corruption
     */
    async robustPCA(M, options = {}) {
        const config = { ...this.config, ...options };
        
        console.log('🔢 Starting Robust PCA matrix completion...');
        console.log(`   Matrix size: ${M.length} × ${M[0].length}`);
        
        // Convert to math.js matrices
        const MMatrix = math.matrix(M);
        const [m, n] = [M.length, M[0].length];
        
        // Initialize variables
        let L = math.zeros(m, n);      // Low-rank component
        let S = math.zeros(m, n);      // Sparse component  
        let Y = math.zeros(m, n);      // Lagrange multipliers
        let mu = config.mu;            // Penalty parameter
        
        // Compute initial parameters
        const normM = this.frobeniusNorm(MMatrix);
        const normInfM = this.infinityNorm(MMatrix);
        const lambda = config.lambda / Math.sqrt(Math.max(m, n));
        
        console.log(`   ||M||_F: ${normM.toFixed(4)}`);
        console.log(`   λ: ${lambda.toFixed(6)}`);
        
        let converged = false;
        let iteration = 0;
        const convergenceHistory = [];
        
        while (!converged && iteration < config.maxIterations) {
            iteration++;
            
            // Store previous values for convergence check
            const L_prev = math.clone(L);
            const S_prev = math.clone(S);
            
            // Update L: Singular Value Thresholding
            const tempL = math.subtract(math.subtract(MMatrix, S), math.divide(Y, mu));
            L = this.singularValueThresholding(tempL, 1 / mu);
            
            // Update S: Soft Thresholding
            const tempS = math.subtract(math.subtract(MMatrix, L), math.divide(Y, mu));
            S = this.softThresholding(tempS, lambda / mu);
            
            // Update Y: Lagrange multipliers
            const residual = math.subtract(math.subtract(MMatrix, L), S);
            Y = math.add(Y, math.multiply(mu, residual));
            
            // Check convergence
            const residualNorm = this.frobeniusNorm(residual);
            const changeL = this.frobeniusNorm(math.subtract(L, L_prev));
            const changeS = this.frobeniusNorm(math.subtract(S, S_prev));
            const relativeChange = Math.max(changeL, changeS) / normM;
            
            convergenceHistory.push({
                iteration,
                residualNorm,
                relativeChange,
                mu,
                rankL: this.estimateRank(L),
                sparsityS: this.sparsityRatio(S)
            });
            
            if (config.verbose) {
                console.log(`   Iter ${iteration}: residual=${residualNorm.toFixed(6)}, ` +
                          `change=${relativeChange.toFixed(6)}, rank≈${this.estimateRank(L)}, ` +
                          `sparsity=${(this.sparsityRatio(S) * 100).toFixed(1)}%`);
            }
            
            // Convergence check
            if (residualNorm < config.tolerance && relativeChange < config.tolerance) {
                converged = true;
                console.log(`✅ RPCA converged in ${iteration} iterations`);
            }
            
            // Update penalty parameter
            if (residualNorm > config.tolerance * 10) {
                mu = Math.min(config.rho * mu, config.maxMu);
            }
        }
        
        if (!converged) {
            console.warn(`⚠️  RPCA did not converge after ${config.maxIterations} iterations`);
        }
        
        // Convert back to regular arrays
        const L_array = L.toArray();
        const S_array = S.toArray();
        const recovered = math.add(L, S).toArray();
        
        const results = {
            lowRank: L_array,
            sparse: S_array, 
            recovered: recovered,
            converged,
            iterations: iteration,
            finalResidual: this.frobeniusNorm(math.subtract(math.subtract(MMatrix, L), S)),
            rank: this.estimateRank(L),
            sparsity: this.sparsityRatio(S),
            convergenceHistory
        };
        
        console.log(`📊 RPCA Results:`);
        console.log(`   Final residual: ${results.finalResidual.toFixed(6)}`);
        console.log(`   Estimated rank: ${results.rank}`);
        console.log(`   Sparsity ratio: ${(results.sparsity * 100).toFixed(1)}%`);
        
        return results;
    }

    /**
     * Singular Value Thresholding for nuclear norm minimization
     */
    singularValueThresholding(X, threshold) {
        try {
            // Convert to regular array for SVD
            const A = X.toArray();
            
            // Compute SVD: A = U * Σ * V^T
            const svd = this.computeSVD(A);
            const { U, s, V } = svd;
            
            // Apply soft thresholding to singular values
            const s_thresh = s.map(sigma => Math.max(0, sigma - threshold));
            
            // Reconstruct matrix with thresholded singular values
            const result = this.reconstructFromSVD(U, s_thresh, V);
            
            return math.matrix(result);
            
        } catch (error) {
            console.warn('⚠️  SVT fallback to soft thresholding:', error.message);
            return this.softThresholding(X, threshold);
        }
    }

    /**
     * Element-wise soft thresholding
     */
    softThresholding(X, threshold) {
        const thresholdFunc = (x) => {
            if (x > threshold) return x - threshold;
            if (x < -threshold) return x + threshold;
            return 0;
        };
        
        return math.map(X, thresholdFunc);
    }

    /**
     * Compute SVD using simplified approach for JavaScript
     */
    computeSVD(A) {
        const m = A.length;
        const n = A[0].length;
        
        try {
            // For small matrices, use eigendecomposition approach
            if (m <= 20 && n <= 20) {
                return this.svdEigenApproach(A);
            } else {
                // For larger matrices, use iterative approach
                return this.svdIterativeApproach(A);
            }
        } catch (error) {
            console.warn('⚠️  SVD computation failed, using identity approximation');
            return this.svdIdentityFallback(A);
        }
    }

    /**
     * SVD via eigendecomposition for small matrices
     */
    svdEigenApproach(A) {
        const m = A.length;
        const n = A[0].length;
        
        // Compute A^T * A for V and singular values
        const AT = this.transpose(A);
        const ATA = this.matrixMultiply(AT, A);
        
        // Eigendecomposition of A^T * A
        const { eigenvalues, eigenvectors } = this.eigenDecomposition(ATA);
        
        // Sort by eigenvalues (descending)
        const sorted = eigenvalues
            .map((val, idx) => ({ value: val, vector: eigenvectors[idx] }))
            .filter(item => item.value > 1e-10)
            .sort((a, b) => b.value - a.value);
        
        const singularValues = sorted.map(item => Math.sqrt(Math.max(0, item.value)));
        const V = sorted.map(item => item.vector);
        
        // Compute U = A * V / σ
        const U = [];
        for (let i = 0; i < Math.min(m, singularValues.length); i++) {
            if (singularValues[i] > 1e-10) {
                const Av = this.matrixVectorMultiply(A, V[i]);
                const u = Av.map(x => x / singularValues[i]);
                U.push(u);
            }
        }
        
        // Pad with orthogonal vectors if needed
        while (U.length < Math.min(m, n)) {
            U.push(new Array(m).fill(0));
        }
        
        return {
            U: this.transpose(U),
            s: singularValues,
            V: this.transpose(V)
        };
    }

    /**
     * Iterative SVD approximation for larger matrices
     */
    svdIterativeApproach(A, rank = 10) {
        const m = A.length;
        const n = A[0].length;
        const r = Math.min(rank, Math.min(m, n));
        
        const U = [];
        const s = [];
        const V = [];
        
        let residual = A.map(row => [...row]); // Deep copy
        
        for (let k = 0; k < r; k++) {
            // Power iteration to find dominant singular vector
            let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
            
            for (let iter = 0; iter < 10; iter++) {
                // v = A^T * u, normalize
                const ATv = this.matrixVectorMultiply(this.transpose(residual), v);
                v = this.normalizeVector(ATv);
                
                // u = A * v, normalize  
                const u = this.normalizeVector(this.matrixVectorMultiply(residual, v));
                
                // Recompute v = A^T * u
                v = this.normalizeVector(this.matrixVectorMultiply(this.transpose(residual), u));
            }
            
            const u = this.normalizeVector(this.matrixVectorMultiply(residual, v));
            const sigma = this.vectorNorm(this.matrixVectorMultiply(residual, v));
            
            if (sigma < 1e-10) break;
            
            U.push(u);
            s.push(sigma);
            V.push(v);
            
            // Update residual: R = R - σ * u * v^T
            for (let i = 0; i < m; i++) {
                for (let j = 0; j < n; j++) {
                    residual[i][j] -= sigma * u[i] * v[j];
                }
            }
        }
        
        return {
            U: this.transpose(U),
            s: s,
            V: this.transpose(V)
        };
    }

    /**
     * Fallback SVD when computation fails
     */
    svdIdentityFallback(A) {
        const m = A.length;
        const n = A[0].length;
        const r = Math.min(m, n);
        
        // Create identity-like decomposition
        const U = this.identityMatrix(m).slice(0, r);
        const s = new Array(r).fill(1.0);
        const V = this.identityMatrix(n).slice(0, r);
        
        return { U: this.transpose(U), s, V: this.transpose(V) };
    }

    /**
     * Reconstruct matrix from SVD components
     */
    reconstructFromSVD(U, s, V) {
        const m = U.length;
        const n = V.length;
        const result = Array(m).fill().map(() => Array(n).fill(0));
        
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < s.length; k++) {
                    if (s[k] > 0) {
                        result[i][j] += U[i][k] * s[k] * V[j][k];
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * Simple eigendecomposition for symmetric matrices
     */
    eigenDecomposition(A) {
        const n = A.length;
        
        // Simplified Jacobi method for small symmetric matrices
        let eigenvalues = [];
        let eigenvectors = [];
        
        try {
            // Use math.js if available for eigenvalues
            const eigs = math.eigs(math.matrix(A));
            
            eigenvalues = eigs.values.map(v => math.re(v));
            eigenvectors = eigs.vectors.toArray().map((_, i) => 
                eigs.vectors.toArray().map(row => math.re(row[i]))
            );
            
        } catch (error) {
            // Fallback: approximate with diagonal
            eigenvalues = A.map((row, i) => row[i]);
            eigenvectors = this.identityMatrix(n);
        }
        
        return { eigenvalues, eigenvectors };
    }

    /**
     * Matrix utility functions
     */
    transpose(A) {
        const m = A.length;
        const n = A[0].length;
        const result = Array(n).fill().map(() => Array(m).fill(0));
        
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                result[j][i] = A[i][j];
            }
        }
        
        return result;
    }

    matrixMultiply(A, B) {
        const m = A.length;
        const n = B[0].length;
        const p = B.length;
        const result = Array(m).fill().map(() => Array(n).fill(0));
        
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < p; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        
        return result;
    }

    matrixVectorMultiply(A, v) {
        const m = A.length;
        const result = new Array(m).fill(0);
        
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < v.length; j++) {
                result[i] += A[i][j] * v[j];
            }
        }
        
        return result;
    }

    normalizeVector(v) {
        const norm = this.vectorNorm(v);
        return norm > 1e-10 ? v.map(x => x / norm) : v;
    }

    vectorNorm(v) {
        return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    }

    identityMatrix(n) {
        const result = Array(n).fill().map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            result[i][i] = 1;
        }
        return result;
    }

    /**
     * Matrix norm computations
     */
    frobeniusNorm(X) {
        if (X.toArray) {
            const A = X.toArray();
            return Math.sqrt(A.flat().reduce((sum, x) => sum + x * x, 0));
        }
        return Math.sqrt(X.flat().reduce((sum, x) => sum + x * x, 0));
    }

    infinityNorm(X) {
        if (X.toArray) {
            const A = X.toArray();
            return Math.max(...A.map(row => row.reduce((sum, x) => sum + Math.abs(x), 0)));
        }
        return Math.max(...X.map(row => row.reduce((sum, x) => sum + Math.abs(x), 0)));
    }

    estimateRank(X, threshold = 1e-6) {
        try {
            const A = X.toArray ? X.toArray() : X;
            const svd = this.computeSVD(A);
            return svd.s.filter(sigma => sigma > threshold).length;
        } catch (error) {
            return Math.min(X.length || X.size()[0], (X[0] && X[0].length) || X.size()[1]);
        }
    }

    sparsityRatio(X) {
        const A = X.toArray ? X.toArray() : X;
        const total = A.length * A[0].length;
        const nonZero = A.flat().filter(x => Math.abs(x) > 1e-10).length;
        return nonZero / total;
    }

    /**
     * Apply matrix completion to RTT delay matrix
     */
    async completeDelayMatrix(delayMatrix, options = {}) {
        console.log('🔍 Applying robust matrix completion to delay measurements...');
        
        const config = {
            ...this.config,
            lambda: 0.05,  // Lower sparsity penalty for delay data
            maxIterations: 50,
            ...options
        };
        
        // Handle missing values (represented as NaN or negative)
        const processedMatrix = delayMatrix.map(row => 
            row.map(val => (isNaN(val) || val < 0) ? 0 : val)
        );
        
        // Apply robust PCA
        const results = await this.robustPCA(processedMatrix, config);
        
        // Post-process results
        const cleanDelays = results.lowRank.map(row => 
            row.map(val => Math.max(0, val)) // Ensure non-negative delays
        );
        
        // Identify corrupted measurements
        const corruptionMask = results.sparse.map(row =>
            row.map(val => Math.abs(val) > config.tolerance * 10)
        );
        
        console.log(`✅ Matrix completion completed`);
        console.log(`   Corruption detected: ${(this.sparsityRatio(results.sparse) * 100).toFixed(1)}% of entries`);
        
        return {
            cleanDelays,
            originalDelays: delayMatrix,
            corruptionMask,
            lowRankComponent: results.lowRank,
            sparseComponent: results.sparse,
            rank: results.rank,
            convergenceInfo: {
                converged: results.converged,
                iterations: results.iterations,
                finalResidual: results.finalResidual
            }
        };
    }

    /**
     * Detect Byzantine challengers using matrix completion
     */
    async detectByzantineChallengers(delayMatrix, challengerIds, options = {}) {
        console.log('🕵️ Detecting Byzantine challengers via matrix analysis...');
        
        const completionResults = await this.completeDelayMatrix(delayMatrix, options);
        const { corruptionMask, sparseComponent } = completionResults;
        
        // Analyze corruption patterns per challenger
        const challengerAnalysis = challengerIds.map((id, idx) => {
            const row = corruptionMask[idx];
            const sparseRow = sparseComponent[idx];
            
            const corruptionRatio = row.filter(Boolean).length / row.length;
            const corruptionMagnitude = sparseRow.reduce((sum, val) => sum + Math.abs(val), 0) / sparseRow.length;
            
            // Byzantine score based on corruption patterns
            const byzantineScore = corruptionRatio * 0.7 + Math.min(corruptionMagnitude / 100, 1) * 0.3;
            
            return {
                challengerId: id,
                corruptionRatio,
                corruptionMagnitude,
                byzantineScore,
                isByzantine: byzantineScore > 0.3 // Threshold for Byzantine detection
            };
        });
        
        const byzantineChallengers = challengerAnalysis.filter(c => c.isByzantine);
        
        console.log(`🚨 Byzantine detection results:`);
        console.log(`   Total challengers: ${challengerIds.length}`);
        console.log(`   Byzantine detected: ${byzantineChallengers.length}`);
        console.log(`   Byzantine IDs: [${byzantineChallengers.map(c => c.challengerId).join(', ')}]`);
        
        return {
            challengerAnalysis,
            byzantineChallengers: byzantineChallengers.map(c => c.challengerId),
            cleanedMatrix: completionResults.cleanDelays,
            detectionStats: {
                totalChallengers: challengerIds.length,
                byzantineCount: byzantineChallengers.length,
                byzantineRatio: byzantineChallengers.length / challengerIds.length,
                averageByzantineScore: byzantineChallengers.reduce((sum, c) => sum + c.byzantineScore, 0) / Math.max(1, byzantineChallengers.length)
            }
        };
    }

    /**
     * Filter delay measurements using matrix completion
     */
    async filterDelayMeasurements(measurements, challengerLocations, options = {}) {
        console.log('🧹 Filtering delay measurements with robust matrix completion...');
        
        // Convert measurements to matrix format
        const challengerIds = Object.keys(measurements);
        const delayMatrix = challengerIds.map(challengerId => {
            const challengerMeasurements = measurements[challengerId] || [];
            // Pad or truncate to consistent length
            const paddedMeasurements = challengerMeasurements.slice(0, 50); // Max 50 measurements
            while (paddedMeasurements.length < 50) {
                paddedMeasurements.push(NaN); // Fill missing with NaN
            }
            return paddedMeasurements;
        });
        
        // Apply matrix completion
        const completionResults = await this.completeDelayMatrix(delayMatrix, options);
        
        // Detect Byzantine challengers
        const byzantineResults = await this.detectByzantineChallengers(
            delayMatrix, 
            challengerIds, 
            options
        );
        
        // Reconstruct filtered measurements
        const filteredMeasurements = {};
        challengerIds.forEach((challengerId, idx) => {
            const isByzantine = byzantineResults.byzantineChallengers.includes(challengerId);
            
            if (isByzantine) {
                // Use cleaned measurements for Byzantine challengers
                filteredMeasurements[challengerId] = completionResults.cleanDelays[idx]
                    .filter(val => val > 0)  // Remove zeros (padding)
                    .map(val => Math.round(val * 1000) / 1000); // Round to ms precision
            } else {
                // Keep original measurements for honest challengers
                filteredMeasurements[challengerId] = measurements[challengerId] || [];
            }
        });
        
        console.log(`✅ Delay measurement filtering completed`);
        console.log(`   Byzantine challengers filtered: ${byzantineResults.byzantineChallengers.length}`);
        console.log(`   Matrix rank: ${completionResults.rank}`);
        
        return {
            filteredMeasurements,
            byzantineChallengers: byzantineResults.byzantineChallengers,
            matrixCompletionResults: completionResults,
            byzantineAnalysis: byzantineResults.challengerAnalysis,
            filteringStats: {
                originalChallengerCount: challengerIds.length,
                byzantineCount: byzantineResults.byzantineChallengers.length,
                matrixRank: completionResults.rank,
                convergenceInfo: completionResults.convergenceInfo
            }
        };
    }
}

module.exports = { MatrixCompletion };