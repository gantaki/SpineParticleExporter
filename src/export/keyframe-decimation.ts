/**
 * Keyframe Decimation
 * Responsible for reducing keyframe density in high-density regions.
 * Single Responsibility: Analyze keyframe density and remove redundant keyframes
 *
 * Algorithm:
 * 1. Calculate local density for each keyframe (number of neighbors in time window)
 * 2. Identify high-density regions (above threshold)
 * 3. Remove specified percentage of keyframes uniformly in dense regions
 * 4. Preserve critical keyframes (first, last, stepped interpolation)
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Generic keyframe with time property
 * Following Interface Segregation Principle (ISP) - only requires time field
 */
interface TimeKeyframe {
  time: number;
  curve?: string;
  [key: string]: unknown;
}

/**
 * Density analysis result for a keyframe
 */
interface KeyframeDensity {
  index: number;
  density: number; // Number of keyframes within time window
  isHighDensity: boolean;
}

// ============================================================
// DENSITY CALCULATION
// ============================================================

/**
 * Calculates local density for each keyframe using a sliding time window
 *
 * @param keyframes - Array of keyframes sorted by time
 * @param timeWindow - Time window size for density calculation (in seconds)
 * @returns Array of density values for each keyframe
 */
function calculateKeyframeDensities(
  keyframes: TimeKeyframe[],
  timeWindow: number = 0.3 // Default: 300ms window (about 9 frames at 30fps)
): KeyframeDensity[] {
  if (keyframes.length === 0) return [];

  const densities: KeyframeDensity[] = [];
  const halfWindow = timeWindow / 2;

  // Calculate density for each keyframe
  for (let i = 0; i < keyframes.length; i++) {
    const currentTime = keyframes[i].time;
    const windowStart = currentTime - halfWindow;
    const windowEnd = currentTime + halfWindow;

    // Count keyframes within the time window
    let count = 0;
    for (const kf of keyframes) {
      if (kf.time >= windowStart && kf.time <= windowEnd) {
        count++;
      }
    }

    densities.push({
      index: i,
      density: count,
      isHighDensity: false, // Will be set later based on threshold
    });
  }

  // Calculate average density and threshold for high density
  const totalDensity = densities.reduce((sum, d) => sum + d.density, 0);
  const averageDensity = totalDensity / densities.length;
  const highDensityThreshold = averageDensity * 1.2; // 20% above average

  // Mark high-density keyframes
  for (const density of densities) {
    density.isHighDensity = density.density > highDensityThreshold;
  }

  return densities;
}

// ============================================================
// KEYFRAME IMPORTANCE EVALUATION
// ============================================================

/**
 * Determines if a keyframe is critical and should never be removed
 *
 * Critical keyframes include:
 * - First and last keyframes in the animation
 * - Keyframes with stepped interpolation
 * - Boundary keyframes of high-density regions
 */
function isCriticalKeyframe(
  index: number,
  keyframe: TimeKeyframe,
  totalKeyframes: number,
  densities: KeyframeDensity[]
): boolean {
  // First or last keyframe in animation
  if (index === 0 || index === totalKeyframes - 1) {
    return true;
  }

  // Keyframes with stepped interpolation are critical for visual accuracy
  if (keyframe.curve === "stepped") {
    return true;
  }

  // Check if this is a boundary of a high-density region
  const currentDensity = densities[index];
  const prevDensity = densities[index - 1];
  const nextDensity = densities[index + 1];

  // First keyframe in a high-density region
  if (currentDensity.isHighDensity && prevDensity && !prevDensity.isHighDensity) {
    return true;
  }

  // Last keyframe in a high-density region
  if (currentDensity.isHighDensity && nextDensity && !nextDensity.isHighDensity) {
    return true;
  }

  return false;
}

// ============================================================
// DECIMATION ALGORITHM
// ============================================================

/**
 * Removes keyframes from high-density regions based on removal percentage
 *
 * @param keyframes - Array of keyframes to decimate
 * @param removalPercentage - Percentage of keyframes to remove (0-100)
 * @param timeWindow - Time window for density calculation (in seconds)
 * @returns Decimated array of keyframes
 *
 * Algorithm:
 * - Calculates local density for each keyframe
 * - Identifies high-density regions (above average + 20%)
 * - Removes keyframes uniformly (every Nth) in dense regions
 * - Preserves critical keyframes (first, last, stepped, boundaries)
 */
export function decimateKeyframes<T extends TimeKeyframe>(
  keyframes: T[],
  removalPercentage: number,
  timeWindow: number = 0.3
): T[] {
  // Validate input
  if (keyframes.length <= 2) {
    return keyframes; // Don't decimate if only 2 or fewer keyframes
  }

  if (removalPercentage <= 0 || removalPercentage >= 100) {
    return keyframes; // No decimation needed
  }

  // Calculate densities
  const densities = calculateKeyframeDensities(keyframes, timeWindow);

  // Check if there are any high-density regions
  const hasHighDensity = densities.some(d => d.isHighDensity);
  if (!hasHighDensity) {
    return keyframes; // No high-density regions to decimate
  }

  // Calculate removal pattern (e.g., 50% = keep every 2nd, 66% = keep every 3rd)
  // We want to REMOVE removalPercentage, so we KEEP (100 - removalPercentage)
  const keepPercentage = 100 - removalPercentage;
  const keepEveryNth = Math.max(1, Math.round(100 / keepPercentage));

  // Filter keyframes
  const decimatedKeyframes: T[] = [];
  let densityRegionCounter = 0; // Counter for uniform removal within dense regions

  for (let i = 0; i < keyframes.length; i++) {
    const keyframe = keyframes[i];
    const density = densities[i];

    // Always keep critical keyframes
    if (isCriticalKeyframe(i, keyframe, keyframes.length, densities)) {
      decimatedKeyframes.push(keyframe);
      continue;
    }

    // If in high-density region, apply decimation
    if (density.isHighDensity) {
      // Keep every Nth keyframe for uniform removal
      if (densityRegionCounter % keepEveryNth === 0) {
        decimatedKeyframes.push(keyframe);
      }
      densityRegionCounter++;
    } else {
      // Keep all keyframes in low-density regions
      decimatedKeyframes.push(keyframe);
      densityRegionCounter = 0; // Reset counter when leaving dense region
    }
  }

  return decimatedKeyframes;
}

// ============================================================
// STATISTICS AND DEBUGGING
// ============================================================

/**
 * Analyzes keyframe density and returns statistics
 * Useful for debugging and understanding decimation behavior
 */
export function analyzeKeyframeDensity(
  keyframes: TimeKeyframe[],
  timeWindow: number = 0.3
): {
  totalKeyframes: number;
  averageDensity: number;
  highDensityKeyframes: number;
  highDensityPercentage: number;
  densities: KeyframeDensity[];
} {
  const densities = calculateKeyframeDensities(keyframes, timeWindow);
  const totalKeyframes = keyframes.length;
  const totalDensity = densities.reduce((sum, d) => sum + d.density, 0);
  const averageDensity = totalDensity / (totalKeyframes || 1);
  const highDensityKeyframes = densities.filter(d => d.isHighDensity).length;
  const highDensityPercentage = (highDensityKeyframes / (totalKeyframes || 1)) * 100;

  return {
    totalKeyframes,
    averageDensity,
    highDensityKeyframes,
    highDensityPercentage,
    densities,
  };
}
