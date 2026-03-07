import type { Compound } from "./session.js";

export interface PaceMetrics {
  readonly bestLapByCompound: Readonly<Partial<Record<Compound, number>>>;
  readonly longRunAveragePace: number | null;
  readonly longRunSampleSize: number;
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
  readonly fuelCorrectedSampleSize: number;
}

export interface StintDegradation {
  readonly stintNumber: number;
  readonly compound: Compound | null;
  readonly degradationRate: number;
  readonly rSquared: number;
  readonly lapCount: number;
}

export interface SpeedMetrics {
  readonly bestStSpeed: number | null;
  readonly meanStSpeed: number | null;
  readonly bestI1Speed: number | null;
  readonly meanI1Speed: number | null;
  readonly bestI2Speed: number | null;
  readonly meanI2Speed: number | null;
}

export interface ConsistencyMetrics {
  readonly longRunLapTimeStdDev: number | null;
  readonly consistencySampleSize: number;
}

export interface StintSummary {
  readonly stintNumber: number;
  readonly compound: Compound | null;
  readonly lapCount: number;
  readonly bestLap: number | null;
  readonly meanLap: number | null;
  readonly degradationRate: number | null;
  readonly weather: WeatherSummary | null;
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

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface MetricConfidence {
  readonly level: ConfidenceLevel;
  readonly sampleSize: number;
}

export interface DegradationConfidence {
  readonly level: ConfidenceLevel;
  readonly sampleSize: number;
  readonly meanRSquared: number | null;
}

export interface ConfidenceMetrics {
  readonly overall: ConfidenceLevel;
  readonly longRunPace: MetricConfidence;
  readonly fuelCorrectedPace: MetricConfidence;
  readonly degradation: DegradationConfidence;
  readonly consistency: MetricConfidence;
}

export interface DriverFeatures {
  readonly driverNumber: number;
  readonly nameAcronym: string;
  readonly teamName: string;
  readonly teamColour: string;
  readonly sessionKey: number;
  readonly pace: PaceMetrics;
  readonly degradation: DegradationMetrics;
  readonly speed: SpeedMetrics;
  readonly consistency: ConsistencyMetrics;
  readonly confidence: ConfidenceMetrics;
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

export interface SessionDeltas {
  readonly longRunPaceDelta: number | null;
  readonly consistencyDelta: number | null;
  readonly bestLapDelta: number | null;
  readonly bestStSpeedDelta: number | null;
}

export interface CrossSessionDriverFeatures {
  readonly driverNumber: number;
  readonly nameAcronym: string;
  readonly teamName: string;
  readonly teamColour: string;
  readonly sessionsIncluded: readonly string[];
  readonly pace: PaceMetrics;
  readonly degradation: DegradationMetrics;
  readonly speed: SpeedMetrics;
  readonly consistency: ConsistencyMetrics;
  readonly confidence: ConfidenceMetrics;
  readonly totalLaps: number;
  readonly rankings: DriverRanking;
  readonly deltas: SessionDeltas | null;
}

export interface CrossSessionFeatures {
  readonly circuitShortName: string;
  readonly sessionsIncluded: readonly string[];
  readonly drivers: readonly CrossSessionDriverFeatures[];
}
