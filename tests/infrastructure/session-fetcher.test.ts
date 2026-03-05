import { describe, it, expect, vi } from "vitest";
import { createSessionFetcher } from "../../src/infrastructure/session-fetcher.js";
import type { OpenF1Client } from "../../src/infrastructure/openf1-client.js";
import type {
  SessionMetadata,
  Driver,
  Lap,
  Stint,
  PitStop,
  WeatherSnapshot,
} from "../../src/domain/session.js";

function createMockClient(overrides: Partial<OpenF1Client> = {}): OpenF1Client {
  return {
    fetchSession: vi.fn().mockResolvedValue(null),
    fetchDrivers: vi.fn().mockResolvedValue([]),
    fetchLaps: vi.fn().mockResolvedValue([]),
    fetchStints: vi.fn().mockResolvedValue([]),
    fetchPitStops: vi.fn().mockResolvedValue([]),
    fetchWeather: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const mockMetadata: SessionMetadata = {
  sessionKey: 9158,
  meetingKey: 1219,
  sessionName: "Practice 1",
  sessionType: "Practice",
  circuitShortName: "Bahrain",
  countryName: "Bahrain",
  dateStart: "2024-02-29T11:30:00",
  dateEnd: "2024-02-29T12:30:00",
  year: 2024,
};

const mockDriver: Driver = {
  driverNumber: 1,
  firstName: "Max",
  lastName: "Verstappen",
  nameAcronym: "VER",
  teamName: "Red Bull Racing",
  teamColour: "3671C6",
};

const mockLap: Lap = {
  driverNumber: 1,
  lapNumber: 5,
  lapDuration: 92.5,
  sector1Duration: 30.1,
  sector2Duration: 32.2,
  sector3Duration: 30.2,
  i1Speed: 295,
  i2Speed: 310,
  stSpeed: 320,
  isPitOutLap: false,
  dateStart: "2024-02-29T11:45:00",
};

const mockStint: Stint = {
  driverNumber: 1,
  stintNumber: 1,
  compound: "SOFT",
  lapStart: 1,
  lapEnd: 10,
  tyreAgeAtStart: 0,
  stintType: null,
};

const mockPitStop: PitStop = {
  driverNumber: 1,
  lapNumber: 10,
  laneDuration: 22.5,
  stopDuration: 2.3,
  date: "2024-02-29T11:55:00",
};

const mockWeather: WeatherSnapshot = {
  airTemperature: 28,
  trackTemperature: 35,
  humidity: 45,
  pressure: 1013,
  rainfall: 0,
  windSpeed: 3.5,
  windDirection: 180,
  date: "2024-02-29T11:30:00",
};

describe("createSessionFetcher", () => {
  it("assembles session from API data with driver-grouped laps, stints, and pit stops", async () => {
    const client = createMockClient({
      fetchSession: vi.fn().mockResolvedValue(mockMetadata),
      fetchDrivers: vi.fn().mockResolvedValue([mockDriver]),
      fetchLaps: vi.fn().mockResolvedValue([mockLap]),
      fetchStints: vi.fn().mockResolvedValue([mockStint]),
      fetchPitStops: vi.fn().mockResolvedValue([mockPitStop]),
      fetchWeather: vi.fn().mockResolvedValue([mockWeather]),
    });

    const fetcher = createSessionFetcher(client);
    const session = await fetcher.fetchSession(9158);

    expect(session.metadata).toEqual(mockMetadata);
    expect(session.weather).toEqual([mockWeather]);
    expect(session.drivers).toHaveLength(1);
    expect(session.drivers[0].driver).toEqual(mockDriver);
    expect(session.drivers[0].laps).toEqual([mockLap]);
    expect(session.drivers[0].stints).toEqual([mockStint]);
    expect(session.drivers[0].pitStops).toEqual([mockPitStop]);
  });

  it("throws error when session not found", async () => {
    const client = createMockClient({
      fetchSession: vi.fn().mockResolvedValue(null),
    });

    const fetcher = createSessionFetcher(client);

    await expect(fetcher.fetchSession(99999)).rejects.toThrow(
      "Session not found: 99999"
    );
  });

  it("handles drivers with no laps, stints, or pit stops", async () => {
    const client = createMockClient({
      fetchSession: vi.fn().mockResolvedValue(mockMetadata),
      fetchDrivers: vi.fn().mockResolvedValue([mockDriver]),
      fetchLaps: vi.fn().mockResolvedValue([]),
      fetchStints: vi.fn().mockResolvedValue([]),
      fetchPitStops: vi.fn().mockResolvedValue([]),
      fetchWeather: vi.fn().mockResolvedValue([]),
    });

    const fetcher = createSessionFetcher(client);
    const session = await fetcher.fetchSession(9158);

    expect(session.drivers[0].laps).toEqual([]);
    expect(session.drivers[0].stints).toEqual([]);
    expect(session.drivers[0].pitStops).toEqual([]);
  });
});
