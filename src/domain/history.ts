export type RaceStatus = "Finished" | "DNF" | "DNS" | "DSQ";

export interface DriverRaceResult {
  readonly driverNumber: number;
  readonly gridPosition: number | null;
  readonly finishPosition: number | null;
  readonly status: RaceStatus;
  readonly lapsCompleted: number;
}

export interface MeetingRaceResult {
  readonly meetingKey: number;
  readonly meetingName: string;
  readonly countryName: string;
  readonly dateStart: string;
  readonly results: readonly DriverRaceResult[];
}
