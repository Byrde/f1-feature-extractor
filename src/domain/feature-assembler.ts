import type {
  Session,
  DriverSession,
  Lap,
  WeatherSnapshot,
} from "./session.js";
import type {
  DriverFeatures,
  DriverRanking,
  SessionFeatures,
  StintSummary,
  WeatherSummary,
} from "./features.js";
import type { ClassifiedStint } from "./stint-classifier.js";
import { classifyStints } from "./stint-classifier.js";
import {
  computeBestLapByCompound,
  computeLongRunAveragePace,
  computeFuelCorrectedLongRunPace,
  computeSectorPerformance,
  computeDegradationRate,
  computeConsistency,
} from "./pace-analyzer.js";
import { computeSpeedMetrics } from "./speed-analyzer.js";
import { computeWeatherSummary } from "./weather-analyzer.js";
import { computeDriverRankings } from "./ranking.js";

const DEFAULT_WEATHER: WeatherSummary = {
  meanTrackTemperature: 0,
  meanAirTemperature: 0,
  meanHumidity: 0,
  rainfall: false,
  meanWindSpeed: 0,
};

const UNRANKED: DriverRanking = {
  longRunPace: null,
  bestLap: null,
  degradationRate: null,
  consistency: null,
};

export function assembleSessionFeatures(session: Session): SessionFeatures {
  const weather = computeWeatherSummary(session.weather) ?? DEFAULT_WEATHER;

  const unrankedDrivers = session.drivers.map((ds) =>
    assembleDriverFeatures(ds, session.metadata.sessionKey, weather)
  );

  const rankings = computeDriverRankings(unrankedDrivers);
  const drivers = unrankedDrivers.map((d) => ({
    ...d,
    rankings: rankings.get(d.driverNumber) ?? UNRANKED,
  }));

  return {
    sessionKey: session.metadata.sessionKey,
    circuitShortName: session.metadata.circuitShortName,
    sessionName: session.metadata.sessionName,
    drivers,
  };
}

function assembleDriverFeatures(
  ds: DriverSession,
  sessionKey: number,
  weather: WeatherSummary
): DriverFeatures {
  const classified = classifyStints(ds.stints, ds.laps);
  const { laps } = ds;

  const sectorPerf = computeSectorPerformance(laps);
  const degradationRates = computeDegradationRate(laps, classified);

  const stints = classified.map((stint) =>
    buildStintSummary(stint, laps, degradationRates)
  );

  return {
    driverNumber: ds.driver.driverNumber,
    nameAcronym: ds.driver.nameAcronym,
    teamName: ds.driver.teamName,
    sessionKey,
    pace: {
      bestLapByCompound: computeBestLapByCompound(laps, classified),
      longRunAveragePace: computeLongRunAveragePace(laps, classified),
      bestSector1: sectorPerf.bestSector1,
      bestSector2: sectorPerf.bestSector2,
      bestSector3: sectorPerf.bestSector3,
      meanSector1: sectorPerf.meanSector1,
      meanSector2: sectorPerf.meanSector2,
      meanSector3: sectorPerf.meanSector3,
    },
    degradation: {
      degradationRateByStint: degradationRates,
      fuelCorrectedLongRunPace: computeFuelCorrectedLongRunPace(laps, classified),
    },
    speed: computeSpeedMetrics(laps, classified),
    consistency: {
      longRunLapTimeStdDev: computeConsistency(laps, classified),
    },
    stints,
    weather,
    totalLaps: laps.length,
    rankings: UNRANKED,
  };
}

function buildStintSummary(
  stint: ClassifiedStint,
  laps: readonly Lap[],
  degradationRates: readonly { stintNumber: number; degradationRate: number }[]
): StintSummary {
  const stintLaps = laps.filter(
    (lap) => lap.lapNumber >= stint.lapStart && lap.lapNumber <= stint.lapEnd
  );
  const timedLaps = stintLaps
    .filter((lap) => !lap.isPitOutLap && lap.lapDuration !== null)
    .map((lap) => lap.lapDuration as number);

  const deg = degradationRates.find((d) => d.stintNumber === stint.stintNumber);

  return {
    stintNumber: stint.stintNumber,
    stintType: stint.stintType,
    compound: stint.compound,
    lapCount: stintLaps.length,
    bestLap: timedLaps.length > 0 ? Math.min(...timedLaps) : null,
    meanLap: timedLaps.length > 0
      ? timedLaps.reduce((sum, t) => sum + t, 0) / timedLaps.length
      : null,
    degradationRate: deg?.degradationRate ?? null,
  };
}
