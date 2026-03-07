import type {
  Session,
  DriverSession,
  Lap,
  Stint,
  WeatherSnapshot,
} from "./session.js";
import type {
  DriverFeatures,
  DriverRanking,
  SessionFeatures,
  StintSummary,
  WeatherSummary,
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
import { computeWeatherSummary } from "./weather-analyzer.js";
import { computeDriverRankings } from "./ranking.js";
import { computeConfidence } from "./confidence.js";

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
    assembleDriverFeatures(ds, session.metadata.sessionKey, weather, session.weather)
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
  weather: WeatherSummary,
  weatherSnapshots: readonly WeatherSnapshot[]
): DriverFeatures {
  const { laps, stints } = ds;

  const sectorPerf = computeSectorPerformance(laps);
  const degradationRates = computeDegradationRate(laps, stints);
  const longRunPace = computeLongRunAveragePace(laps, stints);
  const fuelCorrectedPace = computeFuelCorrectedLongRunPace(laps, stints);
  const consistency = computeConsistency(laps, stints);

  const stintSummaries = stints.map((stint) =>
    buildStintSummary(stint, laps, degradationRates, weatherSnapshots)
  );

  return {
    driverNumber: ds.driver.driverNumber,
    nameAcronym: ds.driver.nameAcronym,
    teamName: ds.driver.teamName,
    teamColour: ds.driver.teamColour,
    sessionKey,
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
      degradationRates
    ),
    stints: stintSummaries,
    weather,
    totalLaps: laps.length,
    rankings: UNRANKED,
  };
}

function buildStintSummary(
  stint: Stint,
  laps: readonly Lap[],
  degradationRates: readonly { stintNumber: number; degradationRate: number }[],
  weatherSnapshots: readonly WeatherSnapshot[]
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
    compound: stint.compound,
    lapCount: stintLaps.length,
    bestLap: timedLaps.length > 0 ? Math.min(...timedLaps) : null,
    meanLap: timedLaps.length > 0
      ? timedLaps.reduce((sum, t) => sum + t, 0) / timedLaps.length
      : null,
    degradationRate: deg?.degradationRate ?? null,
    weather: computeStintWeather(stintLaps, weatherSnapshots),
  };
}

function computeStintWeather(
  stintLaps: readonly Lap[],
  snapshots: readonly WeatherSnapshot[]
): WeatherSummary | null {
  if (snapshots.length === 0 || stintLaps.length === 0) return null;

  const firstLapTime = new Date(stintLaps[0].dateStart).getTime();
  const lastLap = stintLaps[stintLaps.length - 1];
  const lastLapEnd = new Date(lastLap.dateStart).getTime()
    + (lastLap.lapDuration ?? 90) * 1000;

  const overlapping = snapshots.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= firstLapTime && t <= lastLapEnd;
  });

  if (overlapping.length > 0) {
    return computeWeatherSummary(overlapping)!;
  }

  let nearest = snapshots[0];
  let minDist = Math.abs(new Date(nearest.date).getTime() - firstLapTime);
  for (const s of snapshots) {
    const dist = Math.abs(new Date(s.date).getTime() - firstLapTime);
    if (dist < minDist) {
      nearest = s;
      minDist = dist;
    }
  }
  return computeWeatherSummary([nearest])!;
}
