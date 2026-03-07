import type {
  Lap,
  Stint,
  PitStop,
  WeatherSnapshot,
  Driver,
  SessionMetadata,
  Meeting,
  GridEntry,
  SessionResult,
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
  compound: string | null;
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

interface RawMeeting {
  meeting_key: number;
  meeting_name: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
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

interface RawGridEntry {
  driver_number: number;
  position: number;
  lap_duration: number | null;
  meeting_key: number;
  session_key: number;
}

interface RawSessionResult {
  driver_number: number;
  position: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  number_of_laps: number;
  gap_to_leader: number | string | null;
  duration: number | number[] | null;
  meeting_key: number;
  session_key: number;
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
    compound: raw.compound ? (raw.compound.toUpperCase() as Compound) : null,
    lapStart: raw.lap_start,
    lapEnd: raw.lap_end,
    tyreAgeAtStart: raw.tyre_age_at_start,
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

function mapMeeting(raw: RawMeeting): Meeting {
  return {
    meetingKey: raw.meeting_key,
    meetingName: raw.meeting_name,
    countryName: raw.country_name,
    circuitShortName: raw.circuit_short_name,
    dateStart: raw.date_start,
    year: raw.year,
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

function mapGridEntry(raw: RawGridEntry): GridEntry {
  return {
    driverNumber: raw.driver_number,
    position: raw.position,
    lapDuration: raw.lap_duration,
  };
}

function mapSessionResult(raw: RawSessionResult): SessionResult {
  return {
    driverNumber: raw.driver_number,
    position: raw.position,
    dnf: raw.dnf,
    dns: raw.dns,
    dsq: raw.dsq,
    numberOfLaps: raw.number_of_laps,
    gapToLeader: raw.gap_to_leader,
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

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

async function fetchJson<T>(url: string): Promise<T[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      return response.json() as Promise<T[]>;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000
        : BASE_DELAY_MS * 2 ** attempt;
      await delay(waitMs);
      continue;
    }

    throw new Error(`OpenF1 API error: ${response.status} ${response.statusText}`);
  }

  throw new Error("OpenF1 API error: max retries exceeded");
}

export interface MeetingSearchParams {
  year?: number;
  countryName?: string;
  circuitShortName?: string;
}

export interface SessionSearchParams {
  year?: number;
  meetingKey?: number;
  sessionType?: string;
}

export interface OpenF1Client {
  queryMeetings(params?: MeetingSearchParams): Promise<Meeting[]>;
  fetchSession(sessionKey: number): Promise<SessionMetadata | null>;
  querySessions(params?: SessionSearchParams): Promise<SessionMetadata[]>;
  fetchDrivers(sessionKey: number): Promise<Driver[]>;
  fetchDriversByMeeting(meetingKey: number): Promise<Driver[]>;
  fetchLaps(sessionKey: number): Promise<Lap[]>;
  fetchStints(sessionKey: number): Promise<Stint[]>;
  fetchPitStops(sessionKey: number): Promise<PitStop[]>;
  fetchWeather(sessionKey: number): Promise<WeatherSnapshot[]>;
  fetchStartingGrid(sessionKey: number): Promise<GridEntry[]>;
  fetchSessionResult(sessionKey: number): Promise<SessionResult[]>;
}

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>();
  for (const d of drivers) {
    const existing = map.get(d.driverNumber);
    if (!existing || (!existing.nameAcronym && d.nameAcronym)) {
      map.set(d.driverNumber, d);
    }
  }
  return [...map.values()];
}

export function createOpenF1Client(): OpenF1Client {
  return {
    async queryMeetings(params?: MeetingSearchParams): Promise<Meeting[]> {
      const query: QueryParams = {};
      if (params?.year !== undefined) query.year = params.year;
      if (params?.countryName !== undefined) query.country_name = params.countryName;
      if (params?.circuitShortName !== undefined) query.circuit_short_name = params.circuitShortName;
      const url = buildUrl("meetings", query);
      const results = await fetchJson<RawMeeting>(url);
      return results.map(mapMeeting);
    },

    async fetchSession(sessionKey: number): Promise<SessionMetadata | null> {
      const url = buildUrl("sessions", { session_key: sessionKey });
      const results = await fetchJson<RawSession>(url);
      return results.length > 0 ? mapSession(results[0]) : null;
    },

    async querySessions(params?: SessionSearchParams): Promise<SessionMetadata[]> {
      const query: QueryParams = {};
      if (params?.year !== undefined) query.year = params.year;
      if (params?.meetingKey !== undefined) query.meeting_key = params.meetingKey;
      if (params?.sessionType !== undefined) query.session_type = params.sessionType;
      const url = buildUrl("sessions", query);
      const results = await fetchJson<RawSession>(url);
      return results.map(mapSession);
    },

    async fetchDrivers(sessionKey: number): Promise<Driver[]> {
      const url = buildUrl("drivers", { session_key: sessionKey });
      const results = await fetchJson<RawDriver>(url);
      return results.map(mapDriver);
    },

    async fetchDriversByMeeting(meetingKey: number): Promise<Driver[]> {
      const url = buildUrl("drivers", { meeting_key: meetingKey });
      const results = await fetchJson<RawDriver>(url);
      return deduplicateDrivers(results.map(mapDriver));
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

    async fetchStartingGrid(sessionKey: number): Promise<GridEntry[]> {
      const url = buildUrl("starting_grid", { session_key: sessionKey });
      const results = await fetchJson<RawGridEntry>(url);
      return results.map(mapGridEntry);
    },

    async fetchSessionResult(sessionKey: number): Promise<SessionResult[]> {
      const url = buildUrl("session_result", { session_key: sessionKey });
      const results = await fetchJson<RawSessionResult>(url);
      return results.map(mapSessionResult);
    },
  };
}
