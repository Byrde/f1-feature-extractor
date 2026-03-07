import type { SessionFeatures } from "../domain/features.js";

export function formatLapTime(seconds: number | null): string | null {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  const wholeSec = Math.floor(remaining);
  const millis = Math.round((remaining - wholeSec) * 1000);
  return `${minutes}:${String(wholeSec).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function formatSessionOutput(
  sessions: readonly SessionFeatures[]
): unknown[] {
  return sessions.map((session) => ({
    ...session,
    drivers: session.drivers.map((driver) => ({
      ...driver,
      pace: {
        bestLapByCompound: Object.fromEntries(
          Object.entries(driver.pace.bestLapByCompound).map(([k, v]) => [
            k,
            formatLapTime(v ?? null),
          ])
        ),
        longRunAveragePace: formatLapTime(driver.pace.longRunAveragePace),
        longRunSampleSize: driver.pace.longRunSampleSize,
        bestSector1: formatLapTime(driver.pace.bestSector1),
        bestSector2: formatLapTime(driver.pace.bestSector2),
        bestSector3: formatLapTime(driver.pace.bestSector3),
        meanSector1: formatLapTime(driver.pace.meanSector1),
        meanSector2: formatLapTime(driver.pace.meanSector2),
        meanSector3: formatLapTime(driver.pace.meanSector3),
      },
      degradation: {
        ...driver.degradation,
        fuelCorrectedLongRunPace: formatLapTime(
          driver.degradation.fuelCorrectedLongRunPace
        ),
      },
      stints: driver.stints.map((stint) => ({
        ...stint,
        bestLap: formatLapTime(stint.bestLap),
        meanLap: formatLapTime(stint.meanLap),
      })),
    })),
  }));
}
