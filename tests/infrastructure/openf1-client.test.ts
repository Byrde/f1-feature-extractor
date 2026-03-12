import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenF1Client } from "../../src/infrastructure/openf1-client.js";

describe("OpenF1Client", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  function mockResponse(data: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });
  }

  it("fetchLaps maps snake_case to camelCase", async () => {
    const client = createOpenF1Client();
    mockResponse([
      {
        driver_number: 1,
        lap_number: 5,
        lap_duration: 91.743,
        duration_sector_1: 26.966,
        duration_sector_2: 38.657,
        duration_sector_3: 26.12,
        i1_speed: 307,
        i2_speed: 277,
        st_speed: 298,
        is_pit_out_lap: false,
        date_start: "2023-09-16T13:59:07.606000+00:00",
      },
    ]);

    const laps = await client.fetchLaps(9158);

    expect(laps).toHaveLength(1);
    expect(laps[0]).toEqual({
      driverNumber: 1,
      lapNumber: 5,
      lapDuration: 91.743,
      sector1Duration: 26.966,
      sector2Duration: 38.657,
      sector3Duration: 26.12,
      i1Speed: 307,
      i2Speed: 277,
      stSpeed: 298,
      isPitOutLap: false,
      dateStart: "2023-09-16T13:59:07.606000+00:00",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/laps?session_key=9158"
    );
  });

  it("fetchStints normalizes compound to uppercase", async () => {
    const client = createOpenF1Client();
    mockResponse([
      {
        driver_number: 44,
        stint_number: 2,
        compound: "medium",
        lap_start: 8,
        lap_end: 20,
        tyre_age_at_start: 0,
      },
    ]);

    const stints = await client.fetchStints(9158);

    expect(stints[0].compound).toBe("MEDIUM");
  });

  it("queryMeetings maps snake_case to camelCase", async () => {
    const client = createOpenF1Client();
    mockResponse([
      {
        meeting_key: 1229,
        meeting_name: "Bahrain Grand Prix",
        country_name: "Bahrain",
        circuit_short_name: "Sakhir",
        date_start: "2024-02-29",
        year: 2024,
      },
    ]);

    const meetings = await client.queryMeetings({ year: 2024 });

    expect(meetings).toEqual([
      {
        meetingKey: 1229,
        meetingName: "Bahrain Grand Prix",
        countryName: "Bahrain",
        circuitShortName: "Sakhir",
        dateStart: "2024-02-29",
        year: 2024,
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/meetings?year=2024"
    );
  });

  it("queryMeetings passes country_name and circuit_short_name filters", async () => {
    const client = createOpenF1Client();
    mockResponse([]);

    await client.queryMeetings({
      year: 2024,
      countryName: "Bahrain",
      circuitShortName: "Sakhir",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/meetings?year=2024&country_name=Bahrain&circuit_short_name=Sakhir"
    );
  });

  it("fetchDriversByMeeting deduplicates by driver number", async () => {
    const client = createOpenF1Client();
    mockResponse([
      { driver_number: 1, first_name: "Max", last_name: "Verstappen", name_acronym: "VER", team_name: "Red Bull Racing", team_colour: "3671C6" },
      { driver_number: 1, first_name: null, last_name: null, name_acronym: null, team_name: null, team_colour: null },
      { driver_number: 44, first_name: "Lewis", last_name: "Hamilton", name_acronym: "HAM", team_name: "Ferrari", team_colour: "E80020" },
    ]);

    const drivers = await client.fetchDriversByMeeting(1279);

    expect(drivers).toHaveLength(2);
    expect(drivers[0].nameAcronym).toBe("VER");
    expect(drivers[1].nameAcronym).toBe("HAM");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/drivers?meeting_key=1279"
    );
  });

  it("fetchStartingGrid maps snake_case to camelCase", async () => {
    const client = createOpenF1Client();
    mockResponse([
      {
        driver_number: 1,
        position: 1,
        lap_duration: 76.732,
        meeting_key: 1143,
        session_key: 7783,
      },
      {
        driver_number: 63,
        position: 2,
        lap_duration: 76.968,
        meeting_key: 1143,
        session_key: 7783,
      },
    ]);

    const grid = await client.fetchStartingGrid(7783);

    expect(grid).toEqual([
      { driverNumber: 1, position: 1, lapDuration: 76.732 },
      { driverNumber: 63, position: 2, lapDuration: 76.968 },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/starting_grid?session_key=7783"
    );
  });

  it("fetchSessionResult maps fields including dnf/dns/dsq flags", async () => {
    const client = createOpenF1Client();
    mockResponse([
      {
        driver_number: 1,
        position: 1,
        dnf: false,
        dns: false,
        dsq: false,
        number_of_laps: 57,
        gap_to_leader: 0,
        duration: 5765.432,
        meeting_key: 1143,
        session_key: 7783,
      },
      {
        driver_number: 16,
        position: 18,
        dnf: true,
        dns: false,
        dsq: false,
        number_of_laps: 23,
        gap_to_leader: "+34 LAP(S)",
        duration: null,
        meeting_key: 1143,
        session_key: 7783,
      },
    ]);

    const results = await client.fetchSessionResult(7783);

    expect(results).toEqual([
      {
        driverNumber: 1,
        position: 1,
        dnf: false,
        dns: false,
        dsq: false,
        numberOfLaps: 57,
        gapToLeader: 0,
      },
      {
        driverNumber: 16,
        position: 18,
        dnf: true,
        dns: false,
        dsq: false,
        numberOfLaps: 23,
        gapToLeader: "+34 LAP(S)",
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openf1.org/v1/session_result?session_key=7783"
    );
  });

  it("returns empty array when API responds with a non-array body", async () => {
    const client = createOpenF1Client();
    mockResponse({ detail: "No results found." });

    const results = await client.fetchStartingGrid(99999);

    expect(results).toEqual([]);
  });

  it("throws on non-retryable API error", async () => {
    const client = createOpenF1Client();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(client.fetchLaps(99999)).rejects.toThrow(
      "OpenF1 API error: 403 Forbidden"
    );
  });
});
