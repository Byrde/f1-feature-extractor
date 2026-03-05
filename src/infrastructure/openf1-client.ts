import type {
  Lap,
  Stint,
  PitStop,
  WeatherSnapshot,
  Driver,
  SessionMetadata,
  Compound,
} from "../domain/session.js";

const BASE_URL = "https://api.openf1.org/v1";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RawLap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
  date_start: string;
}

interface RawStint {
  driver_number: number;
  stint_number: number;
  compound: string;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number;
}

interface RawPit {
  driver_number: number;
  lap_number: number;
  pit_duration: number;
  duration: number | null;
  date: string;
}

interface RawWeather {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
  date: string;
}

interface RawDriver {
  driver_number: number;
  first_name: string;
  last_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
}

interface RawSession {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  circuit_short_name: string;
  country_name: string;
  date_start: string;
  date_end: string;
  year: number;
}

function mapLap(raw: RawLap): Lap {
  return {
    driverNumber: raw.driver_number,
    lapNumber: raw.lap_number,
    lapDuration: raw.lap_duration,
    sector1Duration: raw.duration_sector_1,
    sector2Duration: raw.duration_sector_2,
    sector3Duration: raw.duration_sector_3,
    i1Speed: raw.i1_speed,
    i2Speed: raw.i2_speed,
    stSpeed: raw.st_speed,
    isPitOutLap: raw.is_pit_out_lap,
    dateStart: raw.date_start,
  };
}

function mapStint(raw: RawStint): Stint {
  return {
    driverNumber: raw.driver_number,
    stintNumber: raw.stint_number,
    compound: raw.compound.toUpperCase() as Compound,
    lapStart: raw.lap_start,
    lapEnd: raw.lap_end,
    tyreAgeAtStart: raw.tyre_age_at_start,
    stintType: null,
  };
}

function mapPitStop(raw: RawPit): PitStop {
  return {
    driverNumber: raw.driver_number,
    lapNumber: raw.lap_number,
    laneDuration: raw.pit_duration,
    stopDuration: raw.duration,
    date: raw.date,
  };
}

function mapWeather(raw: RawWeather): WeatherSnapshot {
  return {
    airTemperature: raw.air_temperature,
    trackTemperature: raw.track_temperature,
    humidity: raw.humidity,
    pressure: raw.pressure,
    rainfall: raw.rainfall,
    windSpeed: raw.wind_speed,
    windDirection: raw.wind_direction,
    date: raw.date,
  };
}

function mapDriver(raw: RawDriver): Driver {
  return {
    driverNumber: raw.driver_number,
    firstName: raw.first_name,
    lastName: raw.last_name,
    nameAcronym: raw.name_acronym,
    teamName: raw.team_name,
    teamColour: raw.team_colour,
  };
}

function mapSession(raw: RawSession): SessionMetadata {
  return {
    sessionKey: raw.session_key,
    meetingKey: raw.meeting_key,
    sessionName: raw.session_name,
    sessionType: raw.session_type,
    circuitShortName: raw.circuit_short_name,
    countryName: raw.country_name,
    dateStart: raw.date_start,
    dateEnd: raw.date_end,
    year: raw.year,
  };
}

function buildUrl(endpoint: string, params: QueryParams): string {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenF1 API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T[]>;
}

export interface OpenF1Client {
  fetchSession(sessionKey: number): Promise<SessionMetadata | null>;
  fetchDrivers(sessionKey: number): Promise<Driver[]>;
  fetchLaps(sessionKey: number): Promise<Lap[]>;
  fetchStints(sessionKey: number): Promise<Stint[]>;
  fetchPitStops(sessionKey: number): Promise<PitStop[]>;
  fetchWeather(sessionKey: number): Promise<WeatherSnapshot[]>;
}

export function createOpenF1Client(): OpenF1Client {
  return {
    async fetchSession(sessionKey: number): Promise<SessionMetadata | null> {
      const url = buildUrl("sessions", { session_key: sessionKey });
      const results = await fetchJson<RawSession>(url);
      return results.length > 0 ? mapSession(results[0]) : null;
    },

    async fetchDrivers(sessionKey: number): Promise<Driver[]> {
      const url = buildUrl("drivers", { session_key: sessionKey });
      const results = await fetchJson<RawDriver>(url);
      return results.map(mapDriver);
    },

    async fetchLaps(sessionKey: number): Promise<Lap[]> {
      const url = buildUrl("laps", { session_key: sessionKey });
      const results = await fetchJson<RawLap>(url);
      return results.map(mapLap);
    },

    async fetchStints(sessionKey: number): Promise<Stint[]> {
      const url = buildUrl("stints", { session_key: sessionKey });
      const results = await fetchJson<RawStint>(url);
      return results.map(mapStint);
    },

    async fetchPitStops(sessionKey: number): Promise<PitStop[]> {
      const url = buildUrl("pit", { session_key: sessionKey });
      const results = await fetchJson<RawPit>(url);
      return results.map(mapPitStop);
    },

    async fetchWeather(sessionKey: number): Promise<WeatherSnapshot[]> {
      const url = buildUrl("weather", { session_key: sessionKey });
      const results = await fetchJson<RawWeather>(url);
      return results.map(mapWeather);
    },
  };
}
