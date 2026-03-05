import type { DriverFeatures, DriverRanking } from "./features.js";

interface RankEntry {
  readonly driverNumber: number;
  readonly value: number;
}

function assignRanks(entries: RankEntry[]): Map<number, number> {
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const ranks = new Map<number, number>();

  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].value !== sorted[i - 1].value) {
      rank = i + 1;
    }
    ranks.set(sorted[i].driverNumber, rank);
  }

  return ranks;
}

function overallBestLap(driver: DriverFeatures): number | null {
  const times = Object.values(driver.pace.bestLapByCompound).filter(
    (t): t is number => t !== undefined
  );
  return times.length > 0 ? Math.min(...times) : null;
}

function meanDegradationRate(driver: DriverFeatures): number | null {
  const stintDegs = driver.degradation.degradationRateByStint;
  if (stintDegs.length === 0) return null;
  const sum = stintDegs.reduce((acc, s) => acc + s.degradationRate, 0);
  return sum / stintDegs.length;
}

type Extractor = (driver: DriverFeatures) => number | null;

function rankDimension(
  drivers: readonly DriverFeatures[],
  extract: Extractor
): Map<number, number> {
  const entries: RankEntry[] = [];
  for (const driver of drivers) {
    const value = extract(driver);
    if (value !== null) {
      entries.push({ driverNumber: driver.driverNumber, value });
    }
  }
  return assignRanks(entries);
}

export function computeDriverRankings(
  drivers: readonly DriverFeatures[]
): Map<number, DriverRanking> {
  const longRunPace = rankDimension(drivers, (d) => d.pace.longRunAveragePace);
  const bestLap = rankDimension(drivers, overallBestLap);
  const degradation = rankDimension(drivers, meanDegradationRate);
  const consistency = rankDimension(
    drivers,
    (d) => d.consistency.longRunLapTimeStdDev
  );

  const result = new Map<number, DriverRanking>();
  for (const driver of drivers) {
    result.set(driver.driverNumber, {
      longRunPace: longRunPace.get(driver.driverNumber) ?? null,
      bestLap: bestLap.get(driver.driverNumber) ?? null,
      degradationRate: degradation.get(driver.driverNumber) ?? null,
      consistency: consistency.get(driver.driverNumber) ?? null,
    });
  }

  return result;
}
