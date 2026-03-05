import type { Compound, StintType } from "./session.js";

export interface PaceMetrics {
  readonly bestLapByCompound: Readonly<Partial<Record<Compound, number>>>;
  readonly longRunAveragePace: number | null;
  readonly bestSector1: number | null;
  readonly bestSector2: number | null;
  readonly bestSector3: number | null;
  readonly meanSector1: number | null;
  readonly meanSector2: number | null;
  readonly meanSector3: number | null;
}

export interface DegradationMetrics {
  readonly degradationRateByStint: readonly StintDegradation[];
  readonly fuelCorrectedLongRunPace: number | null;
}

export interface StintDegradation {
  readonly stintNumber: number;
  readonly compound: Compound;
  readonly degradationRate: number;
  readonly lapCount: number;
}

export interface SpeedMetrics {
  readonly bestStSpeed: number | null;
  readonly meanStSpeed: number | null;
  readonly bestI1Speed: number | null;
  readonly meanI1Speed: number | null;
  readonly bestI2Speed: number | null;
  readonly meanI2Speed: number | null;
  readonly qualiSimMeanStSpeed: number | null;
  readonly longRunMeanStSpeed: number | null;
}

export interface ConsistencyMetrics {
  readonly longRunLapTimeStdDev: number | null;
}

export interface StintSummary {
  readonly stintNumber: number;
  readonly stintType: StintType | null;
  readonly compound: Compound;
  readonly lapCount: number;
  readonly bestLap: number | null;
  readonly meanLap: number | null;
  readonly degradationRate: number | null;
}

export interface WeatherSummary {
  readonly meanTrackTemperature: number;
  readonly meanAirTemperature: number;
  readonly meanHumidity: number;
  readonly rainfall: boolean;
  readonly meanWindSpeed: number;
}

export interface DriverRanking {
  readonly longRunPace: number | null;
  readonly bestLap: number | null;
  readonly degradationRate: number | null;
  readonly consistency: number | null;
}

export interface DriverFeatures {
  readonly driverNumber: number;
  readonly nameAcronym: string;
  readonly teamName: string;
  readonly sessionKey: number;
  readonly pace: PaceMetrics;
  readonly degradation: DegradationMetrics;
  readonly speed: SpeedMetrics;
  readonly consistency: ConsistencyMetrics;
  readonly stints: readonly StintSummary[];
  readonly weather: WeatherSummary;
  readonly totalLaps: number;
  readonly rankings: DriverRanking;
}

export interface SessionFeatures {
  readonly sessionKey: number;
  readonly circuitShortName: string;
  readonly sessionName: string;
  readonly drivers: readonly DriverFeatures[];
}
