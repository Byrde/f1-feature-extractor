import type {
  Session,
  DriverSession,
  Lap,
  Stint,
  Driver,
} from "./session.js";
import type {
  CrossSessionDriverFeatures,
  CrossSessionFeatures,
  DriverFeatures,
  DriverRanking,
  SessionDeltas,
  SessionFeatures,
} from "./features.js";
import {
  computeBestLapByCompound,
  computeLongRunAveragePace,
  computeFuelCorrectedLongRunPace,
  computeSectorPerformance,
  computeDegradationRate,
  computeConsistency,
} from "./pace-analyzer.js";
import { computeSpeedMetrics } from "./speed-analyzer.js";
import { computeDriverRankings } from "./ranking.js";
import { computeConfidence } from "./confidence.js";

const UNRANKED: DriverRanking = {
  longRunPace: null,
  bestLap: null,
  degradationRate: null,
  consistency: null,
};

export function assembleWeekendFeatures(
  sessions: readonly Session[],
  perSessionFeatures: readonly SessionFeatures[],
): CrossSessionFeatures {
  const driverMap = collectDrivers(sessions);
  const sessionNames = sessions.map((s) => s.metadata.sessionName);

  const unranked = [...driverMap.entries()].map(([driverNumber, driver]) => {
    const pooled = poolDriverData(driverNumber, sessions);
    const deltas = computeDeltas(driverNumber, perSessionFeatures);
    const included = sessionsContainingDriver(driverNumber, sessions);
    return assembleCombinedDriver(driver, pooled, included, deltas);
  });

  const rankings = computeDriverRankings(unranked as unknown as DriverFeatures[]);
  const drivers = unranked.map((d) => ({
    ...d,
    rankings: rankings.get(d.driverNumber) ?? UNRANKED,
  }));

  return {
    circuitShortName: sessions[0]?.metadata.circuitShortName ?? "",
    sessionsIncluded: sessionNames,
    drivers,
  };
}

function collectDrivers(sessions: readonly Session[]): Map<number, Driver> {
  const map = new Map<number, Driver>();
  for (const session of sessions) {
    for (const ds of session.drivers) {
      if (!map.has(ds.driver.driverNumber)) {
        map.set(ds.driver.driverNumber, ds.driver);
      }
    }
  }
  return map;
}

function sessionsContainingDriver(
  driverNumber: number,
  sessions: readonly Session[],
): string[] {
  return sessions
    .filter((s) => s.drivers.some((ds) => ds.driver.driverNumber === driverNumber))
    .map((s) => s.metadata.sessionName);
}

interface PooledData {
  readonly laps: readonly Lap[];
  readonly stints: readonly Stint[];
}

export function poolDriverData(
  driverNumber: number,
  sessions: readonly Session[],
): PooledData {
  const allLaps: Lap[] = [];
  const allStints: Stint[] = [];
  let lapOffset = 0;
  let stintOffset = 0;

  for (const session of sessions) {
    const ds = session.drivers.find((d) => d.driver.driverNumber === driverNumber);
    if (!ds) continue;

    const maxLap = maxLapNumber(ds.laps);
    const maxStint = maxStintNumber(ds.stints);

    for (const lap of ds.laps) {
      allLaps.push({ ...lap, lapNumber: lap.lapNumber + lapOffset });
    }

    for (const stint of ds.stints) {
      allStints.push({
        ...stint,
        stintNumber: stint.stintNumber + stintOffset,
        lapStart: stint.lapStart + lapOffset,
        lapEnd: stint.lapEnd + lapOffset,
      });
    }

    lapOffset += maxLap;
    stintOffset += maxStint;
  }

  return { laps: allLaps, stints: allStints };
}

function maxLapNumber(laps: readonly Lap[]): number {
  if (laps.length === 0) return 0;
  return Math.max(...laps.map((l) => l.lapNumber));
}

function maxStintNumber(stints: readonly Stint[]): number {
  if (stints.length === 0) return 0;
  return Math.max(...stints.map((s) => s.stintNumber));
}

function assembleCombinedDriver(
  driver: Driver,
  pooled: PooledData,
  sessionsIncluded: readonly string[],
  deltas: SessionDeltas | null,
): CrossSessionDriverFeatures {
  const { laps, stints } = pooled;

  const sectorPerf = computeSectorPerformance(laps);
  const degradationRates = computeDegradationRate(laps, stints);
  const longRunPace = computeLongRunAveragePace(laps, stints);
  const fuelCorrectedPace = computeFuelCorrectedLongRunPace(laps, stints);
  const consistency = computeConsistency(laps, stints);

  return {
    driverNumber: driver.driverNumber,
    nameAcronym: driver.nameAcronym,
    teamName: driver.teamName,
    teamColour: driver.teamColour,
    sessionsIncluded,
    pace: {
      bestLapByCompound: computeBestLapByCompound(laps, stints),
      longRunAveragePace: longRunPace.value,
      longRunSampleSize: longRunPace.sampleSize,
      bestSector1: sectorPerf.bestSector1,
      bestSector2: sectorPerf.bestSector2,
      bestSector3: sectorPerf.bestSector3,
      meanSector1: sectorPerf.meanSector1,
      meanSector2: sectorPerf.meanSector2,
      meanSector3: sectorPerf.meanSector3,
    },
    degradation: {
      degradationRateByStint: degradationRates,
      fuelCorrectedLongRunPace: fuelCorrectedPace.value,
      fuelCorrectedSampleSize: fuelCorrectedPace.sampleSize,
    },
    speed: computeSpeedMetrics(laps),
    consistency: {
      longRunLapTimeStdDev: consistency.value,
      consistencySampleSize: consistency.sampleSize,
    },
    confidence: computeConfidence(
      longRunPace.sampleSize,
      fuelCorrectedPace.sampleSize,
      consistency.sampleSize,
      degradationRates,
    ),
    totalLaps: laps.length,
    rankings: UNRANKED,
    deltas,
  };
}

function computeDeltas(
  driverNumber: number,
  perSessionFeatures: readonly SessionFeatures[],
): SessionDeltas | null {
  const appearances = perSessionFeatures
    .map((sf) => sf.drivers.find((d) => d.driverNumber === driverNumber))
    .filter((d): d is DriverFeatures => d !== undefined);

  if (appearances.length < 2) return null;

  const first = appearances[0];
  const last = appearances[appearances.length - 1];

  return {
    longRunPaceDelta: delta(first.pace.longRunAveragePace, last.pace.longRunAveragePace),
    consistencyDelta: delta(
      first.consistency.longRunLapTimeStdDev,
      last.consistency.longRunLapTimeStdDev,
    ),
    bestLapDelta: delta(overallBestLap(first), overallBestLap(last)),
    bestStSpeedDelta: delta(first.speed.bestStSpeed, last.speed.bestStSpeed),
  };
}

function delta(first: number | null, last: number | null): number | null {
  if (first === null || last === null) return null;
  return last - first;
}

function overallBestLap(driver: DriverFeatures): number | null {
  const times = Object.values(driver.pace.bestLapByCompound).filter(
    (t): t is number => t !== undefined,
  );
  return times.length > 0 ? Math.min(...times) : null;
}
