import type {
  ConfidenceLevel,
  ConfidenceMetrics,
  MetricConfidence,
  DegradationConfidence,
  StintDegradation,
} from "./features.js";

const HIGH_SAMPLE_THRESHOLD = 15;
const MEDIUM_SAMPLE_THRESHOLD = 10;
const LOW_SAMPLE_THRESHOLD = 5;

const HIGH_R_SQUARED_THRESHOLD = 0.7;
const MEDIUM_R_SQUARED_THRESHOLD = 0.4;

function sampleSizeLevel(sampleSize: number): ConfidenceLevel {
  if (sampleSize >= HIGH_SAMPLE_THRESHOLD) return "HIGH";
  if (sampleSize >= MEDIUM_SAMPLE_THRESHOLD) return "MEDIUM";
  if (sampleSize >= LOW_SAMPLE_THRESHOLD) return "LOW";
  return "INSUFFICIENT";
}

function degradationLevel(
  totalLapCount: number,
  meanRSquared: number | null
): ConfidenceLevel {
  if (totalLapCount < LOW_SAMPLE_THRESHOLD || meanRSquared === null) {
    return "INSUFFICIENT";
  }
  if (totalLapCount >= HIGH_SAMPLE_THRESHOLD && meanRSquared >= HIGH_R_SQUARED_THRESHOLD) {
    return "HIGH";
  }
  if (totalLapCount >= MEDIUM_SAMPLE_THRESHOLD && meanRSquared >= MEDIUM_R_SQUARED_THRESHOLD) {
    return "MEDIUM";
  }
  if (totalLapCount >= LOW_SAMPLE_THRESHOLD) {
    return "LOW";
  }
  return "INSUFFICIENT";
}

const LEVEL_RANK: Record<ConfidenceLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INSUFFICIENT: 0,
};

function worstLevel(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return "INSUFFICIENT";
  let worst: ConfidenceLevel = levels[0];
  for (const level of levels) {
    if (LEVEL_RANK[level] < LEVEL_RANK[worst]) {
      worst = level;
    }
  }
  return worst;
}

export function computeConfidence(
  longRunSampleSize: number,
  fuelCorrectedSampleSize: number,
  consistencySampleSize: number,
  degradationStints: readonly StintDegradation[]
): ConfidenceMetrics {
  const longRunPace: MetricConfidence = {
    level: sampleSizeLevel(longRunSampleSize),
    sampleSize: longRunSampleSize,
  };

  const fuelCorrectedPace: MetricConfidence = {
    level: sampleSizeLevel(fuelCorrectedSampleSize),
    sampleSize: fuelCorrectedSampleSize,
  };

  const consistencyConf: MetricConfidence = {
    level: sampleSizeLevel(consistencySampleSize),
    sampleSize: consistencySampleSize,
  };

  const totalDegLaps = degradationStints.reduce((sum, s) => sum + s.lapCount, 0);
  const meanRSquared = degradationStints.length > 0
    ? degradationStints.reduce((sum, s) => sum + s.rSquared, 0) / degradationStints.length
    : null;

  const degradation: DegradationConfidence = {
    level: degradationLevel(totalDegLaps, meanRSquared),
    sampleSize: totalDegLaps,
    meanRSquared,
  };

  const overall = worstLevel([
    longRunPace.level,
    fuelCorrectedPace.level,
    degradation.level,
    consistencyConf.level,
  ]);

  return {
    overall,
    longRunPace,
    fuelCorrectedPace,
    degradation,
    consistency: consistencyConf,
  };
}
