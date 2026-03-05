import type { Lap, Stint, StintType } from "./session.js";

const OUTLIER_THRESHOLD = 1.07;
const QUALI_SIM_PACE_THRESHOLD = 1.03;
const LONG_RUN_MIN_LAPS = 5;
const QUALI_SIM_MAX_PUSH_LAPS = 3;

export interface ClassifiedStint extends Stint {
  readonly stintType: StintType;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function getStintLaps(stint: Stint, laps: readonly Lap[]): Lap[] {
  return laps.filter(
    (lap) => lap.lapNumber >= stint.lapStart && lap.lapNumber <= stint.lapEnd
  );
}

function getTimedLaps(laps: Lap[]): Lap[] {
  return laps.filter((lap) => lap.lapDuration !== null && !lap.isPitOutLap);
}

function getRepresentativeLaps(laps: Lap[]): Lap[] {
  const timed = getTimedLaps(laps);
  if (timed.length === 0) return [];

  const times = timed.map((lap) => lap.lapDuration as number);
  const medianTime = median(times);
  if (medianTime === null) return [];

  const threshold = medianTime * OUTLIER_THRESHOLD;
  return timed.filter((lap) => (lap.lapDuration as number) <= threshold);
}

function isInstallationLap(
  stint: Stint,
  representativeLaps: Lap[],
  sessionMedian: number | null
): boolean {
  if (stint.stintNumber !== 1) return false;
  if (representativeLaps.length !== 1) return false;
  if (sessionMedian === null) return false;

  const lapTime = representativeLaps[0].lapDuration as number;
  return lapTime > sessionMedian * OUTLIER_THRESHOLD;
}

function isQualiSim(
  stint: Stint,
  representativeLaps: Lap[],
  driverBestLap: number | null
): boolean {
  if (stint.compound !== "SOFT") return false;
  if (stint.tyreAgeAtStart !== 0) return false;
  if (representativeLaps.length === 0) return false;
  if (representativeLaps.length > QUALI_SIM_MAX_PUSH_LAPS) return false;
  if (driverBestLap === null) return false;

  const bestInStint = Math.min(
    ...representativeLaps.map((lap) => lap.lapDuration as number)
  );
  return bestInStint <= driverBestLap * QUALI_SIM_PACE_THRESHOLD;
}

function isLongRun(representativeLaps: Lap[]): boolean {
  return representativeLaps.length >= LONG_RUN_MIN_LAPS;
}

export function classifyStints(
  stints: readonly Stint[],
  laps: readonly Lap[]
): ClassifiedStint[] {
  const allRepresentativeLaps = stints.flatMap((stint) =>
    getRepresentativeLaps(getStintLaps(stint, laps))
  );
  const allTimes = allRepresentativeLaps.map((lap) => lap.lapDuration as number);
  const sessionMedian = median(allTimes);
  const driverBestLap = allTimes.length > 0 ? Math.min(...allTimes) : null;

  return stints.map((stint): ClassifiedStint => {
    const stintLaps = getStintLaps(stint, laps);
    const representativeLaps = getRepresentativeLaps(stintLaps);

    let stintType: StintType;

    if (isInstallationLap(stint, representativeLaps, sessionMedian)) {
      stintType = "installation";
    } else if (isQualiSim(stint, representativeLaps, driverBestLap)) {
      stintType = "quali_sim";
    } else if (isLongRun(representativeLaps)) {
      stintType = "long_run";
    } else {
      stintType = "aero_check";
    }

    return { ...stint, stintType };
  });
}
