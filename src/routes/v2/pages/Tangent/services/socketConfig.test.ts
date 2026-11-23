import { io } from "socket.io-client";
import { describe, expect, it, vi } from "vitest";

import { connectTangentSocket, getTangentSocketConfig } from "./socketConfig";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

describe("getTangentSocketConfig", () => {
  it("splits a mounted-prefix baseUrl into origin and prefixed socket path", () => {
    expect(
      getTangentSocketConfig("https://oasis-staging.shopify.io/tangent"),
    ).toEqual({
      socketUrl: "https://oasis-staging.shopify.io",
      socketPath: "/tangent/socket.io",
    });
  });

  it("uses the default socket path for a bare origin", () => {
    expect(getTangentSocketConfig("http://localhost:5173")).toEqual({
      socketUrl: "http://localhost:5173",
      socketPath: "/socket.io",
    });
  });

  it("normalizes trailing slashes on the baseUrl path", () => {
    expect(
      getTangentSocketConfig("https://oasis-staging.shopify.io/tangent/"),
    ).toEqual({
      socketUrl: "https://oasis-staging.shopify.io",
      socketPath: "/tangent/socket.io",
    });
  });
});

describe("connectTangentSocket", () => {
  it("reads the token afresh on each connection attempt", () => {
    const getAuthToken = vi
      .fn<() => string | undefined>()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("assertion");
    connectTangentSocket("http://tangent/prefix", getAuthToken);

    const options = vi.mocked(io).mock.calls[0]?.[1];
    if (typeof options?.auth !== "function") {
      throw new Error("Expected the socket to take an auth callback");
    }
    const payloads: object[] = [];
    options.auth((data) => payloads.push(data));
    options.auth((data) => payloads.push(data));

    expect(vi.mocked(io)).toHaveBeenCalledWith(
      "http://tangent",
      expect.objectContaining({ path: "/prefix/socket.io" }),
    );
    expect(payloads).toEqual([{}, { token: "assertion" }]);
  });
});
