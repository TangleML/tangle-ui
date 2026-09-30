import { describe, expect, it } from "vitest";

import { readTangentSessionParam } from "./tangentSearch";

describe("readTangentSessionParam", () => {
  it("reads the session a link asked for", () => {
    expect(readTangentSessionParam({ session: "sess-1" })).toEqual({
      kind: "existing",
      sessionId: "sess-1",
    });
  });

  /** The router JSON-parses search params, so an id of digits arrives as one. */
  it("reads an all-digit id that arrived as a number", () => {
    expect(readTangentSessionParam({ session: 123 })).toEqual({
      kind: "existing",
      sessionId: "123",
    });
  });

  it("recognises the request for a session that does not exist yet", () => {
    expect(readTangentSessionParam({ session: "new" })).toEqual({
      kind: "new",
    });
  });

  it("asks for nothing when the param is absent", () => {
    expect(readTangentSessionParam({})).toBeUndefined();
    expect(readTangentSessionParam(undefined)).toBeUndefined();
    expect(readTangentSessionParam(null)).toBeUndefined();
  });

  it("ignores a param that is not something a session id could be", () => {
    expect(readTangentSessionParam({ session: "   " })).toBeUndefined();
    expect(readTangentSessionParam({ session: ["a"] })).toBeUndefined();
    expect(readTangentSessionParam({ session: { id: "a" } })).toBeUndefined();
    expect(readTangentSessionParam({ session: true })).toBeUndefined();
  });
});
