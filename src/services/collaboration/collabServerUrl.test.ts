import { describe, expect, it } from "vitest";

import { toCollabHttpUrl } from "./collabServerUrl";

describe("toCollabHttpUrl", () => {
  it("maps ws to http", () => {
    expect(toCollabHttpUrl("ws://localhost:8080")).toBe(
      "http://localhost:8080",
    );
  });

  it("maps wss to https and drops a trailing slash", () => {
    expect(toCollabHttpUrl("wss://collab.example.com/")).toBe(
      "https://collab.example.com",
    );
  });
});
