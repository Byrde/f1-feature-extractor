import type { Lap } from "./session.js";
import type { SpeedMetrics } from "./features.js";

export function computeSpeedMetrics(
  laps: readonly Lap[]
): SpeedMetrics {
  const timedLaps = laps.filter((lap) => !lap.isPitOutLap);

  const stSpeeds = extractValues(timedLaps, (l) => l.stSpeed);
  const i1Speeds = extractValues(timedLaps, (l) => l.i1Speed);
  const i2Speeds = extractValues(timedLaps, (l) => l.i2Speed);

  return {
    bestStSpeed: bestSpeed(stSpeeds),
    meanStSpeed: meanSpeed(stSpeeds),
    bestI1Speed: bestSpeed(i1Speeds),
    meanI1Speed: meanSpeed(i1Speeds),
    bestI2Speed: bestSpeed(i2Speeds),
    meanI2Speed: meanSpeed(i2Speeds),
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

function bestSpeed(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function meanSpeed(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
