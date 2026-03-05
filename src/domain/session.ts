export type Compound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET";

export type StintType = "quali_sim" | "long_run" | "aero_check" | "installation";

export interface Lap {
  readonly driverNumber: number;
  readonly lapNumber: number;
  readonly lapDuration: number | null;
  readonly sector1Duration: number | null;
  readonly sector2Duration: number | null;
  readonly sector3Duration: number | null;
  readonly i1Speed: number | null;
  readonly i2Speed: number | null;
  readonly stSpeed: number | null;
  readonly isPitOutLap: boolean;
  readonly dateStart: string;
}

export interface Stint {
  readonly driverNumber: number;
  readonly stintNumber: number;
  readonly compound: Compound;
  readonly lapStart: number;
  readonly lapEnd: number;
  readonly tyreAgeAtStart: number;
  readonly stintType: StintType | null;
}

export interface PitStop {
  readonly driverNumber: number;
  readonly lapNumber: number;
  readonly laneDuration: number;
  readonly stopDuration: number | null;
  readonly date: string;
}

export interface WeatherSnapshot {
  readonly airTemperature: number;
  readonly trackTemperature: number;
  readonly humidity: number;
  readonly pressure: number;
  readonly rainfall: number;
  readonly windSpeed: number;
  readonly windDirection: number;
  readonly date: string;
}

export interface Driver {
  readonly driverNumber: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly nameAcronym: string;
  readonly teamName: string;
  readonly teamColour: string;
}

export interface SessionMetadata {
  readonly sessionKey: number;
  readonly meetingKey: number;
  readonly sessionName: string;
  readonly sessionType: string;
  readonly circuitShortName: string;
  readonly countryName: string;
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly year: number;
}

export interface DriverSession {
  readonly driver: Driver;
  readonly laps: readonly Lap[];
  readonly stints: readonly Stint[];
  readonly pitStops: readonly PitStop[];
}

export interface Session {
  readonly metadata: SessionMetadata;
  readonly drivers: readonly DriverSession[];
  readonly weather: readonly WeatherSnapshot[];
}
