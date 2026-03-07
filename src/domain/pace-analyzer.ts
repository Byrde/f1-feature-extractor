import type { Compound, Lap, Stint } from "./session.js";
import type { StintDegradation } from "./features.js";

const LONG_RUN_MIN_LAPS = 5;

export interface MetricWithSampleSize {
  readonly value: number | null;
  readonly sampleSize: number;
}

export interface SectorPerformance {
  readonly bestSector1: number | null;
  readonly bestSector2: number | null;
  readonly bestSector3: number | null;
  readonly meanSector1: number | null;
  readonly meanSector2: number | null;
  readonly meanSector3: number | null;
}

export function computeBestLapByCompound(
  laps: readonly Lap[],
  stints: readonly Stint[]
): Partial<Record<Compound, number>> {
  const result: Partial<Record<Compound, number>> = {};

  for (const lap of laps) {
    if (lap.isPitOutLap || lap.lapDuration === null) {
      continue;
    }

    const stint = findStintForLap(lap.lapNumber, stints);
    if (!stint || !stint.compound) {
      continue;
    }

    const current = result[stint.compound];
    if (current === undefined || lap.lapDuration < current) {
      result[stint.compound] = lap.lapDuration;
    }
  }

  return result;
}

export function computeLongRunAveragePace(
  laps: readonly Lap[],
  stints: readonly Stint[]
): MetricWithSampleSize {
  const longRunStints = stints.filter((s) => isLongRun(s, laps));
  if (longRunStints.length === 0) {
    return { value: null, sampleSize: 0 };
  }

  const validLapTimes: number[] = [];

  for (const stint of longRunStints) {
    const stintLaps = getLapsForStint(laps, stint);
    const stintTimes = stintLaps
      .filter((lap) => !lap.isPitOutLap && lap.lapDuration !== null)
      .map((lap) => lap.lapDuration as number);

    if (stintTimes.length === 0) {
      continue;
    }

    const stintMean = mean(stintTimes);
    const outlierThreshold = stintMean * 1.07;

    for (const time of stintTimes) {
      if (time <= outlierThreshold) {
        validLapTimes.push(time);
      }
    }
  }

  if (validLapTimes.length === 0) {
    return { value: null, sampleSize: 0 };
  }

  return { value: mean(validLapTimes), sampleSize: validLapTimes.length };
}

const FUEL_CORRECTION_PER_LAP = 0.06;

export function computeFuelCorrectedLongRunPace(
  laps: readonly Lap[],
  stints: readonly Stint[]
): MetricWithSampleSize {
  const longRunStints = stints.filter((s) => isLongRun(s, laps));
  if (longRunStints.length === 0) {
    return { value: null, sampleSize: 0 };
  }

  const correctedLapTimes: number[] = [];

  for (const stint of longRunStints) {
    const stintLaps = getLapsForStint(laps, stint);
    const timedLaps = stintLaps.filter(
      (lap) => !lap.isPitOutLap && lap.lapDuration !== null
    );

    if (timedLaps.length === 0) {
      continue;
    }

    const rawTimes = timedLaps.map((lap) => lap.lapDuration as number);
    const stintMean = mean(rawTimes);
    const outlierThreshold = stintMean * 1.07;

    timedLaps.forEach((lap, lapIndex) => {
      const rawTime = lap.lapDuration as number;
      if (rawTime <= outlierThreshold) {
        const correctedTime = rawTime - FUEL_CORRECTION_PER_LAP * lapIndex;
        correctedLapTimes.push(correctedTime);
      }
    });
  }

  if (correctedLapTimes.length === 0) {
    return { value: null, sampleSize: 0 };
  }

  return { value: mean(correctedLapTimes), sampleSize: correctedLapTimes.length };
}

export function computeSectorPerformance(laps: readonly Lap[]): SectorPerformance {
  const timedLaps = laps.filter((lap) => !lap.isPitOutLap);

  const sector1Times = timedLaps
    .map((lap) => lap.sector1Duration)
    .filter((t): t is number => t !== null);
  const sector2Times = timedLaps
    .map((lap) => lap.sector2Duration)
    .filter((t): t is number => t !== null);
  const sector3Times = timedLaps
    .map((lap) => lap.sector3Duration)
    .filter((t): t is number => t !== null);

  return {
    bestSector1: sector1Times.length > 0 ? Math.min(...sector1Times) : null,
    bestSector2: sector2Times.length > 0 ? Math.min(...sector2Times) : null,
    bestSector3: sector3Times.length > 0 ? Math.min(...sector3Times) : null,
    meanSector1: sector1Times.length > 0 ? mean(sector1Times) : null,
    meanSector2: sector2Times.length > 0 ? mean(sector2Times) : null,
    meanSector3: sector3Times.length > 0 ? mean(sector3Times) : null,
  };
}

const OUTLIER_THRESHOLD = 1.07;

export function computeDegradationRate(
  laps: readonly Lap[],
  stints: readonly Stint[]
): StintDegradation[] {
  const longRunStints = stints.filter((s) => isLongRun(s, laps));
  const results: StintDegradation[] = [];

  for (const stint of longRunStints) {
    const stintLaps = getLapsForStint(laps, stint);
    const validLaps = getValidLapsForDegradation(stintLaps);

    if (validLaps.length < 2) {
      continue;
    }

    const regression = linearRegression(validLaps);
    if (regression === null) {
      continue;
    }

    results.push({
      stintNumber: stint.stintNumber,
      compound: stint.compound,
      degradationRate: regression.slope,
      rSquared: regression.rSquared,
      lapCount: validLaps.length,
    });
  }

  return results;
}

function getValidLapsForDegradation(
  laps: Lap[]
): Array<{ lapIndex: number; lapDuration: number }> {
  const timedLaps = laps
    .filter((lap) => !lap.isPitOutLap && lap.lapDuration !== null)
    .map((lap, index) => ({
      lapIndex: index,
      lapDuration: lap.lapDuration as number,
    }));

  if (timedLaps.length === 0) {
    return [];
  }

  const times = timedLaps.map((l) => l.lapDuration);
  const meanTime = mean(times);
  const threshold = meanTime * OUTLIER_THRESHOLD;

  return timedLaps.filter((l) => l.lapDuration <= threshold);
}

interface RegressionResult {
  readonly slope: number;
  readonly rSquared: number;
}

function linearRegression(
  points: Array<{ lapIndex: number; lapDuration: number }>
): RegressionResult | null {
  const n = points.length;
  if (n < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const { lapIndex, lapDuration } of points) {
    sumX += lapIndex;
    sumY += lapDuration;
    sumXY += lapIndex * lapDuration;
    sumXX += lapIndex * lapIndex;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const { lapIndex, lapDuration } of points) {
    ssTot += (lapDuration - meanY) ** 2;
    ssRes += (lapDuration - (intercept + slope * lapIndex)) ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, rSquared };
}

function findStintForLap(
  lapNumber: number,
  stints: readonly Stint[]
): Stint | undefined {
  return stints.find(
    (s) => lapNumber >= s.lapStart && lapNumber <= s.lapEnd
  );
}

function getLapsForStint(laps: readonly Lap[], stint: Stint): Lap[] {
  return laps.filter(
    (lap) => lap.lapNumber >= stint.lapStart && lap.lapNumber <= stint.lapEnd
  );
}

export function computeConsistency(
  laps: readonly Lap[],
  stints: readonly Stint[]
): MetricWithSampleSize {
  const longRunStints = stints.filter((s) => isLongRun(s, laps));
  if (longRunStints.length === 0) {
    return { value: null, sampleSize: 0 };
  }

  const validLapTimes: number[] = [];

  for (const stint of longRunStints) {
    const stintLaps = getLapsForStint(laps, stint);
    const stintTimes = stintLaps
      .filter((lap) => !lap.isPitOutLap && lap.lapDuration !== null)
      .map((lap) => lap.lapDuration as number);

    if (stintTimes.length === 0) {
      continue;
    }

    const stintMean = mean(stintTimes);
    const outlierThreshold = stintMean * OUTLIER_THRESHOLD;

    for (const time of stintTimes) {
      if (time <= outlierThreshold) {
        validLapTimes.push(time);
      }
    }
  }

  if (validLapTimes.length < 2) {
    return { value: null, sampleSize: validLapTimes.length };
  }

  return { value: standardDeviation(validLapTimes), sampleSize: validLapTimes.length };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}

function isLongRun(stint: Stint, laps: readonly Lap[]): boolean {
  const timedLaps = getLapsForStint(laps, stint).filter(
    (lap) => !lap.isPitOutLap && lap.lapDuration !== null
  );
  return timedLaps.length >= LONG_RUN_MIN_LAPS;
}
