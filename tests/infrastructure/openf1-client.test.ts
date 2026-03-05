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
    expect(stints[0].stintType).toBeNull();
  });

  it("throws on API error", async () => {
    const client = createOpenF1Client();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(client.fetchLaps(99999)).rejects.toThrow(
      "OpenF1 API error: 404 Not Found"
    );
  });
});
