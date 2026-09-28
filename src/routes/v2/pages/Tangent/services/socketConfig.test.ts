import { describe, expect, it } from "vitest";

import { getTangentSocketConfig } from "./socketConfig";

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
