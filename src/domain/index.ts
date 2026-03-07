export type {
  Compound,
  Lap,
  Stint,
  PitStop,
  WeatherSnapshot,
  Driver,
  Meeting,
  GridEntry,
  SessionResult,
  SessionMetadata,
  DriverSession,
  Session,
} from "./session.js";

export type {
  PaceMetrics,
  DegradationMetrics,
  StintDegradation,
  SpeedMetrics,
  ConsistencyMetrics,
  ConfidenceLevel,
  MetricConfidence,
  DegradationConfidence,
  ConfidenceMetrics,
  StintSummary,
  WeatherSummary,
  DriverRanking,
  DriverFeatures,
  SessionFeatures,
  SessionDeltas,
  CrossSessionDriverFeatures,
  CrossSessionFeatures,
} from "./features.js";

export { computeConfidence } from "./confidence.js";

export {
  computeBestLapByCompound,
  computeLongRunAveragePace,
  computeFuelCorrectedLongRunPace,
  computeSectorPerformance,
  computeDegradationRate,
  computeConsistency,
  type SectorPerformance,
  type MetricWithSampleSize,
} from "./pace-analyzer.js";

export { computeSpeedMetrics } from "./speed-analyzer.js";

export { computeWeatherSummary } from "./weather-analyzer.js";

export { assembleSessionFeatures } from "./feature-assembler.js";

export { assembleWeekendFeatures } from "./weekend-assembler.js";

export { computeDriverRankings } from "./ranking.js";

export type {
  RaceStatus,
  DriverRaceResult,
  MeetingRaceResult,
} from "./history.js";
