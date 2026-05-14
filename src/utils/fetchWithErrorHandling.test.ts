import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchWithErrorHandling,
  RemoteAuthError,
} from "./fetchWithErrorHandling";

const buildResponse = (overrides: Partial<Response> = {}): Response => {
  const headers = new Headers();
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    type: "basic",
    redirected: false,
    url: "https://example.com/api/foo",
    headers,
    json: async () => ({}),
    text: async () => "",
    ...overrides,
  } as Response;
};

describe("fetchWithErrorHandling", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("requests with redirect: 'manual' by default", async () => {
    fetchSpy.mockResolvedValueOnce(
      buildResponse({
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ ok: true }),
      }),
    );

    await fetchWithErrorHandling("https://example.com/api/foo");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/api/foo",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("throws RemoteAuthError when the response is an opaque redirect", async () => {
    fetchSpy.mockResolvedValueOnce(
      buildResponse({
        type: "opaqueredirect",
        ok: false,
        status: 0,
      }),
    );

    await expect(
      fetchWithErrorHandling("https://example.com/api/foo"),
    ).rejects.toBeInstanceOf(RemoteAuthError);
  });

  it("preserves the request URL on RemoteAuthError", async () => {
    fetchSpy.mockResolvedValueOnce(
      buildResponse({
        type: "opaqueredirect",
        ok: false,
        status: 0,
      }),
    );

    await expect(
      fetchWithErrorHandling("https://example.com/api/bar"),
    ).rejects.toMatchObject({ url: "https://example.com/api/bar" });
  });

  it("returns parsed JSON on success", async () => {
    fetchSpy.mockResolvedValueOnce(
      buildResponse({
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ value: 42 }),
      }),
    );

    const result = await fetchWithErrorHandling("https://example.com/api/foo");

    expect(result).toEqual({ value: 42 });
  });

  it("wraps network failures with the request URL", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      fetchWithErrorHandling("https://example.com/api/foo"),
    ).rejects.toThrow(/Network error.*example.com\/api\/foo/);
  });

  it("allows callers to override the redirect option", async () => {
    fetchSpy.mockResolvedValueOnce(
      buildResponse({
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
      }),
    );

    await fetchWithErrorHandling("https://example.com/api/foo", {
      redirect: "follow",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/api/foo",
      expect.objectContaining({ redirect: "follow" }),
    );
  });
});
