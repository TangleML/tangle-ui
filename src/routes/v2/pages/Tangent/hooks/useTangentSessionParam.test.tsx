import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { useTangentSessionParam } from "./useTangentSessionParam";

const navigate = vi.fn();
const notify = vi.fn();
let search: Record<string, unknown> = {};
let projectSessions: { sessions: { sessionId: string }[]; isLoaded: boolean };

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useProjectSessions: () => projectSessions,
}));

function makeStore() {
  const store = {
    projectId: "project-1",
    selectedSessionId: undefined as string | undefined,
    selectSession: vi.fn((sessionId: string) => {
      store.selectedSessionId = sessionId;
    }),
    clearSelectedSession: vi.fn(() => {
      store.selectedSessionId = undefined;
    }),
    startSession: vi.fn().mockResolvedValue(true),
  };
  return store as unknown as TangentProjectStore;
}

describe("useTangentSessionParam", () => {
  beforeEach(() => {
    search = {};
    projectSessions = { sessions: [{ sessionId: "sess-a" }], isLoaded: true };
  });
  afterEach(() => vi.resetAllMocks());

  it("opens the session the project page linked to", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).toHaveBeenCalledWith("sess-a");
    expect(store.startSession).not.toHaveBeenCalled();
  });

  /** Left in the url, it would fight the user for the selection later. */
  it("takes the request out of the url once it is done", () => {
    search = { session: "sess-a" };

    renderHook(() => useTangentSessionParam(makeStore()));

    expect(navigate).toHaveBeenCalled();
    const { search: rewrite, replace } = navigate.mock.calls[0][0];
    expect(replace).toBe(true);
    expect(rewrite({ session: "sess-a", other: "kept" })).toEqual({
      other: "kept",
    });
  });

  it("acts once however often it re-renders", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    rerender();
    rerender();

    expect(store.selectSession).toHaveBeenCalledTimes(1);
  });

  it("keeps a linked session once the project's sessions confirm it", () => {
    search = { session: "sess-a" };
    projectSessions = { sessions: [], isLoaded: false };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    projectSessions = { sessions: [{ sessionId: "sess-a" }], isLoaded: true };
    rerender();

    expect(store.clearSelectedSession).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  /** Left selected, it would leave the chat waiting on a session that never comes. */
  it("falls back to the latest session when the linked one isn't the project's", () => {
    search = { session: "sess-gone" };
    projectSessions = { sessions: [], isLoaded: false };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    expect(store.clearSelectedSession).not.toHaveBeenCalled();

    projectSessions = { sessions: [{ sessionId: "sess-a" }], isLoaded: true };
    rerender();

    expect(store.clearSelectedSession).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "That session isn't available, so the latest one is open instead.",
      "warning",
    );
  });

  it("leaves a session picked while the list was loading alone", () => {
    search = { session: "sess-gone" };
    projectSessions = { sessions: [], isLoaded: false };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    store.selectSession("sess-a");
    projectSessions = { sessions: [{ sessionId: "sess-a" }], isLoaded: true };
    rerender();

    expect(store.clearSelectedSession).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  /**
   * The arrival starts a new session alongside whatever else the project
   * arrives with; starting one here too raced it for the only start allowed.
   */
  it("leaves a request for a new session to the arrival", () => {
    search = { session: "new" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.startSession).not.toHaveBeenCalled();
    expect(store.selectSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing when no session was asked for", () => {
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).not.toHaveBeenCalled();
    expect(store.startSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
