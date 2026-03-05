import type { Lap, Stint } from "./session.js";
import type { SpeedMetrics } from "./features.js";

export function computeSpeedMetrics(
  laps: readonly Lap[],
  stints: readonly Stint[]
): SpeedMetrics {
  const timedLaps = laps.filter((lap) => !lap.isPitOutLap);

  const stSpeeds = extractValues(timedLaps, (l) => l.stSpeed);
  const i1Speeds = extractValues(timedLaps, (l) => l.i1Speed);
  const i2Speeds = extractValues(timedLaps, (l) => l.i2Speed);

  const qualiSimStSpeeds = extractSpeedsForStintType(
    timedLaps,
    stints,
    "quali_sim",
    (l) => l.stSpeed
  );
  const longRunStSpeeds = extractSpeedsForStintType(
    timedLaps,
    stints,
    "long_run",
    (l) => l.stSpeed
  );

  return {
    bestStSpeed: bestSpeed(stSpeeds),
    meanStSpeed: meanSpeed(stSpeeds),
    bestI1Speed: bestSpeed(i1Speeds),
    meanI1Speed: meanSpeed(i1Speeds),
    bestI2Speed: bestSpeed(i2Speeds),
    meanI2Speed: meanSpeed(i2Speeds),
    qualiSimMeanStSpeed: meanSpeed(qualiSimStSpeeds),
    longRunMeanStSpeed: meanSpeed(longRunStSpeeds),
  };
}

function extractValues(
  laps: Lap[],
  accessor: (lap: Lap) => number | null
): number[] {
  return laps
    .map(accessor)
    .filter((v): v is number => v !== null);
}

function extractSpeedsForStintType(
  laps: Lap[],
  stints: readonly Stint[],
  stintType: string,
  accessor: (lap: Lap) => number | null
): number[] {
  const matchingStints = stints.filter((s) => s.stintType === stintType);
  const lapsInStints = laps.filter((lap) =>
    matchingStints.some(
      (s) => lap.lapNumber >= s.lapStart && lap.lapNumber <= s.lapEnd
    )
  );
  return extractValues(lapsInStints, accessor);
}

function bestSpeed(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function meanSpeed(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
