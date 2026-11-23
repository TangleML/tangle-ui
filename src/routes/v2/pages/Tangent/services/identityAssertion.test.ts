import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readJWT } from "@/components/shared/Authentication/helpers";
import { MINUTES } from "@/utils/constants";

type IdentityAssertionModule = typeof import("./identityAssertion");

const BACKEND_URL = "http://backend.example";
const NOW = new Date("2026-01-01T12:00:00.000Z");

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  };
}

function assertionResponse(expiresInMs: number, token = "assertion") {
  return jsonResponse(200, {
    token,
    expires_at: new Date(NOW.getTime() + expiresInMs).toISOString(),
  });
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const init = fetchMock.mock.calls[call]?.[1];
  if (!init || typeof init.body !== "string") {
    throw new Error("Expected a POST request with a JSON body");
  }
  return JSON.parse(init.body);
}

let service: IdentityAssertionModule;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  service = await import("./identityAssertion");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("instanceIdFromTangentBaseUrl", () => {
  it("reads the instance id from a backend-proxied Tangent url", () => {
    expect(
      service.instanceIdFromTangentBaseUrl(
        "https://backend.example/api/tangent/instances/inst-42",
      ),
    ).toBe("inst-42");
  });

  it("accepts any host and a path below the instance", () => {
    expect(
      service.instanceIdFromTangentBaseUrl(
        "http://localhost:8000/api/tangent/instances/inst-42/embed/",
      ),
    ).toBe("inst-42");
  });

  it("decodes a percent-encoded id", () => {
    expect(
      service.instanceIdFromTangentBaseUrl(
        "https://backend.example/api/tangent/instances/team%2Fone",
      ),
    ).toBe("team/one");
  });

  it.each([
    "http://localhost:5173",
    "https://tangent.example/instances/inst-42",
    "https://backend.example/api/tangent/instances/",
    "https://backend.example/api/tangent/instances",
    "https://backend.example/prefix/api/tangent/instances/inst-42",
    "not a url",
  ])("has no id for %s", (url) => {
    expect(service.instanceIdFromTangentBaseUrl(url)).toBeUndefined();
  });
});

describe("fetchIdentityAssertion", () => {
  it("posts the instance id to the backend's identity assertion route", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    const assertion = await service.fetchIdentityAssertion(
      BACKEND_URL,
      "inst-42",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/tangent/identity_assertion`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(requestBody(fetchMock)).toEqual({ instance_id: "inst-42" });
    expect(assertion).toEqual({
      token: "assertion",
      expiresAtMs: NOW.getTime() + 60 * MINUTES,
    });
  });

  it("keeps a path prefix on the backend url", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    await service.fetchIdentityAssertion("https://host/prefix", "inst-42");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://host/prefix/api/tangent/identity_assertion",
      expect.anything(),
    );
  });

  it("sends an empty body when the Tangent url names no instance", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    await service.fetchIdentityAssertion(BACKEND_URL);

    expect(requestBody(fetchMock)).toEqual({});
  });

  it("reuses an assertion that is not close to expiry", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    const first = await service.fetchIdentityAssertion(BACKEND_URL, "inst-42");
    vi.setSystemTime(new Date(NOW.getTime() + 54 * MINUTES));
    const second = await service.fetchIdentityAssertion(BACKEND_URL, "inst-42");

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a new assertion within five minutes of expiry", async () => {
    fetchMock
      .mockResolvedValueOnce(assertionResponse(60 * MINUTES, "first"))
      .mockResolvedValueOnce(assertionResponse(120 * MINUTES, "second"));

    await service.fetchIdentityAssertion(BACKEND_URL, "inst-42");
    vi.setSystemTime(new Date(NOW.getTime() + 56 * MINUTES));
    const refreshed = await service.fetchIdentityAssertion(
      BACKEND_URL,
      "inst-42",
    );

    expect(refreshed.token).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps separate assertions per backend and instance", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    await service.fetchIdentityAssertion(BACKEND_URL, "inst-1");
    await service.fetchIdentityAssertion(BACKEND_URL, "inst-2");
    await service.fetchIdentityAssertion("http://other.example", "inst-1");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one request between concurrent callers", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    const [first, second] = await Promise.all([
      service.fetchIdentityAssertion(BACKEND_URL, "inst-42"),
      service.fetchIdentityAssertion(BACKEND_URL, "inst-42"),
    ]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(assertionResponse(60 * MINUTES));

    await expect(
      service.fetchIdentityAssertion(BACKEND_URL, "inst-42"),
    ).rejects.toThrow("500");
    await expect(
      service.fetchIdentityAssertion(BACKEND_URL, "inst-42"),
    ).resolves.toMatchObject({ token: "assertion" });
  });

  it("rejects a response without a token or expiry", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { token: "assertion" }));

    await expect(
      service.fetchIdentityAssertion(BACKEND_URL, "inst-42"),
    ).rejects.toThrow("malformed");
  });
});

describe("identityToken", () => {
  const params = {
    backendUrl: BACKEND_URL,
    instanceId: "inst-42",
    email: "user@example.com",
  };

  it("hands back the assertion with a refresh time five minutes before expiry", async () => {
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    await expect(service.identityToken(params)).resolves.toEqual({
      token: "assertion",
      refreshAtMs: NOW.getTime() + 55 * MINUTES,
    });
  });

  it("falls back to an unsigned identity when the backend lacks the route", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "Not Found" }));

    const { token, refreshAtMs } = await service.identityToken(params);

    expect(readJWT(token)).toEqual({ email: "user@example.com" });
    expect(refreshAtMs).toBeUndefined();
  });

  it("asks a backend without the route only once and warns once", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "Not Found" }));

    await service.identityToken(params);
    await service.identityToken({ ...params, instanceId: "inst-43" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("does not issue identity assertions"),
    );
  });

  it("propagates other failures instead of falling back", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    await expect(service.identityToken(params)).rejects.toThrow("500");
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("for an embed url that names no backend instance", () => {
    const unscoped = { ...params, instanceId: undefined };

    it("presents the unsigned identity without asking the backend", async () => {
      vi.stubEnv("DEV", false);

      const { token, refreshAtMs } = await service.identityToken(unscoped);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(readJWT(token)).toEqual({ email: "user@example.com" });
      expect(refreshAtMs).toBeUndefined();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("still mints an assertion in development", async () => {
      vi.stubEnv("DEV", true);
      fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

      await expect(service.identityToken(unscoped)).resolves.toMatchObject({
        token: "assertion",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(requestBody(fetchMock)).toEqual({});
    });
  });

  it("mints an assertion for a proxied instance outside development", async () => {
    vi.stubEnv("DEV", false);
    fetchMock.mockResolvedValue(assertionResponse(60 * MINUTES));

    await expect(service.identityToken(params)).resolves.toMatchObject({
      token: "assertion",
    });
    expect(requestBody(fetchMock)).toEqual({ instance_id: "inst-42" });
  });
});
