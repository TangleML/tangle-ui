import { describe, expect, it } from "vitest";

import {
  readTangentOpenParam,
  readTangentSessionParam,
  tangentOpenSearch,
  withoutTangentArrivalSearch,
  withoutTangentOpenSearch,
} from "./tangentSearch";

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

describe("readTangentOpenParam", () => {
  it("reads back the view a link asked to open", () => {
    const search = tangentOpenSearch({ type: "run", identity: "id/run-7" });

    expect(readTangentOpenParam(search)).toEqual({
      type: "run",
      identity: "id/run-7",
    });
  });

  it("ignores anything that is not a view Tangent can open", () => {
    expect(readTangentOpenParam({ open: "run://name/x" })).toBeUndefined();
    expect(readTangentOpenParam({ open: "run://id/" })).toBeUndefined();
    expect(readTangentOpenParam({ open: "nonsense" })).toBeUndefined();
    expect(readTangentOpenParam({ open: 42 })).toBeUndefined();
    expect(readTangentOpenParam(undefined)).toBeUndefined();
  });
});

describe("withoutTangentOpenSearch", () => {
  it("drops only the view to open", () => {
    expect(
      withoutTangentOpenSearch({ session: "sess-a", open: "run://id/run-7" }),
    ).toEqual({ session: "sess-a" });
  });
});

describe("withoutTangentArrivalSearch", () => {
  it("drops what the arrival acts on and keeps the rest", () => {
    expect(
      withoutTangentArrivalSearch({
        session: "new",
        open: "run://id/run-7",
        other: "kept",
      }),
    ).toEqual({ other: "kept" });
  });
});
