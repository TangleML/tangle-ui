import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  rememberSeen,
  runStatesToShow,
  statusesFromSnapshot,
  useSessionRunStates,
  withBaseline,
  withStatus,
} from "./useSessionRunStates";

const socketHandlers = new Map<string, (payload: unknown) => void>();

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, handler: (payload: unknown) => void) => {
      socketHandlers.set(event, handler);
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: () => undefined,
}));

const SEEN_KEY = "tangent-sessions-seen";
const EARLIER = "2026-11-10T09:00:00.000Z";
const LATER = "2026-11-10T10:00:00.000Z";

function send(event: string, payload: unknown) {
  act(() => socketHandlers.get(event)?.(payload));
}

describe("session run states", () => {
  it("keeps the sessions working or that have stopped, and says when", () => {
    const statuses = statusesFromSnapshot({
      statuses: [
        { sessionId: "s-busy", status: "busy" },
        { sessionId: "s-quiet", status: "active" },
        { sessionId: "s-done", status: "active", endedAt: EARLIER },
        { sessionId: "s-failed", status: "idle", failed: true, endedAt: LATER },
        { status: "busy" },
      ],
    });

    expect([...statuses]).toEqual([
      ["s-busy", { working: true }],
      ["s-done", { working: false, failed: false, endedAt: EARLIER }],
      ["s-failed", { working: false, failed: true, endedAt: LATER }],
    ]);
  });

  it("follows a session as it works, stops, and goes quiet", () => {
    const working = withStatus(new Map(), { sessionId: "s-1", status: "busy" });
    expect(working.get("s-1")).toEqual({ working: true });

    const done = withStatus(working, {
      sessionId: "s-1",
      status: "active",
      endedAt: EARLIER,
    });
    expect(done.get("s-1")).toEqual({
      working: false,
      failed: false,
      endedAt: EARLIER,
    });

    const quiet = withStatus(done, { sessionId: "s-1", status: "active" });
    expect(quiet.has("s-1")).toBe(false);
    expect(withStatus(quiet, "not a status")).toBe(quiet);
  });

  it("marks a run that ended since its chat was last open, but not the chat in view", () => {
    const statuses = statusesFromSnapshot({
      statuses: [
        { sessionId: "s-busy", status: "busy" },
        { sessionId: "s-new", status: "active", endedAt: LATER },
        { sessionId: "s-seen", status: "active", endedAt: EARLIER },
        { sessionId: "s-failed", status: "idle", failed: true, endedAt: LATER },
        { sessionId: "s-open", status: "active", endedAt: LATER },
      ],
    });
    const seen = { chats: { "s-new": EARLIER, "s-seen": EARLIER } };

    expect([...runStatesToShow(statuses, seen, "s-open")]).toEqual([
      ["s-busy", "working"],
      ["s-new", "finished"],
      ["s-failed", "failed"],
    ]);
  });

  it("remembers each chat once, newest last, and only so many", () => {
    const seen = rememberSeen(
      { baseline: EARLIER, chats: { a: EARLIER, b: EARLIER } },
      "a",
      LATER,
    );
    expect(seen.baseline).toBe(EARLIER);
    expect(Object.entries(seen.chats)).toEqual([
      ["b", EARLIER],
      ["a", LATER],
    ]);

    let many = { chats: {} };
    for (let i = 0; i < 510; i++) many = rememberSeen(many, `s-${i}`, LATER);
    expect(Object.keys(many.chats)).toHaveLength(500);
    expect(Object.keys(many.chats)[0]).toBe("s-10");
  });

  it("counts everything that had already stopped as seen the first time, and only then", () => {
    const statuses = statusesFromSnapshot({
      statuses: [
        { sessionId: "s-busy", status: "busy" },
        { sessionId: "s-old", status: "active", endedAt: EARLIER },
        { sessionId: "s-done", status: "active", endedAt: LATER },
      ],
    });

    const first = withBaseline({ chats: {} }, statuses);
    expect(first.baseline).toBe(LATER);
    expect(withBaseline(first, new Map())).toBe(first);
    expect(withBaseline({ chats: {} }, new Map()).baseline).toBe("");
  });
});

describe("useSessionRunStates", () => {
  beforeEach(() => {
    socketHandlers.clear();
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it("doesn't mark what had already ended the first time this browser looks", () => {
    const { result } = renderHook(() =>
      useSessionRunStates("http://tangent", undefined),
    );

    send("session:status:snapshot", {
      statuses: [
        { sessionId: "s-1", status: "active", endedAt: EARLIER },
        { sessionId: "s-2", status: "busy" },
      ],
    });

    expect([...result.current]).toEqual([["s-2", "working"]]);
  });

  it("marks a finished run until its chat is opened, and remembers that", () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ baseline: "", chats: {} }));
    const { result, rerender } = renderHook(
      ({ active }) => useSessionRunStates("http://tangent", active),
      { initialProps: { active: undefined as string | undefined } },
    );

    send("session:status:snapshot", { statuses: [] });
    send("session:status", { sessionId: "s-1", status: "busy" });
    expect(result.current.get("s-1")).toBe("working");

    send("session:status", {
      sessionId: "s-1",
      status: "active",
      endedAt: LATER,
    });
    expect(result.current.get("s-1")).toBe("finished");

    rerender({ active: "s-1" });
    expect(result.current.has("s-1")).toBe(false);

    rerender({ active: undefined });
    expect(result.current.has("s-1")).toBe(false);
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}")).toEqual({
      baseline: "",
      chats: { "s-1": LATER },
    });
  });

  it("marks a failed run the same way, and doesn't mark one that ended in view", () => {
    localStorage.setItem(
      SEEN_KEY,
      JSON.stringify({ baseline: "", chats: { "s-1": EARLIER } }),
    );
    const { result, rerender } = renderHook(
      ({ active }) => useSessionRunStates("http://tangent", active),
      { initialProps: { active: "s-2" as string | undefined } },
    );

    send("session:status:snapshot", {
      statuses: [
        { sessionId: "s-1", status: "idle", failed: true, endedAt: LATER },
        { sessionId: "s-2", status: "busy" },
      ],
    });
    expect(result.current.get("s-1")).toBe("failed");

    send("session:status", {
      sessionId: "s-2",
      status: "active",
      endedAt: LATER,
    });
    rerender({ active: "s-1" });

    expect([...result.current]).toEqual([]);
  });
});
