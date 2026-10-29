import { api, ApiError, request, setUnauthorizedHandler, toApiError } from "./api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockImplementation(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe("toApiError", () => {
  it("keeps the backend's code, message and details", () => {
    const err = toApiError(409, {
      detail: "Morning on Mon 15 Jun 2026 would drop below its minimum of 2 (1 without you)",
      code: "COVERAGE_VIOLATION",
      details: [{ date: "2026-06-15", shift_name: "Morning" }],
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("COVERAGE_VIOLATION");
    expect(err.message).toMatch(/drop below/);
    expect(err.details).toHaveLength(1);
  });

  it("turns FastAPI 422 lists into one readable message", () => {
    const err = toApiError(422, {
      detail: [
        { loc: ["body", "start_date"], msg: "Input should be a valid date" },
        { loc: ["body", "leave_type_id"], msg: "Field required" },
      ],
    });
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("start_date: Input should be a valid date; leave_type_id: Field required");
  });

  it("falls back for bodies it doesn't recognise", () => {
    expect(toApiError(500, null).message).toBe("Something went wrong on the server");
    expect(toApiError(404, "nope").code).toBe("NOT_FOUND");
    expect(toApiError(409, {}).code).toBe("INVALID_STATE");
  });
});

describe("request", () => {
  it("sends JSON with the cookie and builds the query string", async () => {
    const fetchMock = mockFetch(200, []);
    await api.calendar("2026-06-01", "2026-06-30");
    expect(fetchMock).toHaveBeenCalledWith("/api/calendar?start=2026-06-01&end=2026-06-30",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }));
    await api.applyLeave({ leave_type_id: 1, start_date: "2026-06-15", end_date: "2026-06-16", reason: "" });
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ leave_type_id: 1, start_date: "2026-06-15", end_date: "2026-06-16", reason: "" });
  });

  it("returns undefined for 204", async () => {
    mockFetch(204, undefined);
    await expect(api.readAllNotifications()).resolves.toBeUndefined();
  });

  it("throws ApiError and calls the 401 handler (except for login)", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(401, { detail: "Not signed in", code: "NOT_AUTHENTICATED", details: [] });
    await expect(request("GET", "/dashboard")).rejects.toMatchObject({ status: 401, code: "NOT_AUTHENTICATED" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    mockFetch(401, { detail: "Invalid email or password", code: "NOT_AUTHENTICATED", details: [] });
    await expect(api.login("a@b.c", "x")).rejects.toThrow("Invalid email or password");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.me()).rejects.toMatchObject({ code: "NETWORK" });
  });
});
