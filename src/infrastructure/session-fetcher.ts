import type { OpenF1Client } from "./openf1-client.js";
import type {
  Session,
  DriverSession,
  Driver,
  Lap,
  Stint,
  PitStop,
} from "../domain/session.js";

export interface SessionFetcher {
  fetchSession(sessionKey: number): Promise<Session>;
}

function groupByDriver<T extends { driverNumber: number }>(
  items: T[]
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const existing = map.get(item.driverNumber) ?? [];
    existing.push(item);
    map.set(item.driverNumber, existing);
  }
  return map;
}

function assembleDriverSessions(
  drivers: Driver[],
  laps: Lap[],
  stints: Stint[],
  pitStops: PitStop[]
): DriverSession[] {
  const lapsByDriver = groupByDriver(laps);
  const stintsByDriver = groupByDriver(stints);
  const pitStopsByDriver = groupByDriver(pitStops);

  return drivers.map((driver) => ({
    driver,
    laps: lapsByDriver.get(driver.driverNumber) ?? [],
    stints: stintsByDriver.get(driver.driverNumber) ?? [],
    pitStops: pitStopsByDriver.get(driver.driverNumber) ?? [],
  }));
}

export function createSessionFetcher(client: OpenF1Client): SessionFetcher {
  return {
    async fetchSession(sessionKey: number): Promise<Session> {
      const [metadata, drivers, laps, stints, pitStops, weather] =
        await Promise.all([
          client.fetchSession(sessionKey),
          client.fetchDrivers(sessionKey),
          client.fetchLaps(sessionKey),
          client.fetchStints(sessionKey),
          client.fetchPitStops(sessionKey),
          client.fetchWeather(sessionKey),
        ]);

      if (!metadata) {
        throw new Error(`Session not found: ${sessionKey}`);
      }

      return {
        metadata,
        drivers: assembleDriverSessions(drivers, laps, stints, pitStops),
        weather,
      };
    },
  };
}
