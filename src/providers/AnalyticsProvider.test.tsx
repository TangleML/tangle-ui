import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsProvider, useAnalytics } from "./AnalyticsProvider";

// ─── Mock user query ──────────────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockIsFlagEnabled = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: (key: string) => mockIsFlagEnabled(key),
}));

vi.mock("@/hooks/useUserDetails", () => ({
  userQueryOptions: {
    queryKey: ["user"],
    queryFn: () => mockGetUser(),
    staleTime: Infinity,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function captureEvents() {
  const events: CustomEvent<Record<string, unknown>>[] = [];
  const handler = (e: Event) =>
    events.push(e as CustomEvent<Record<string, unknown>>);
  window.addEventListener("tangle.analytics.track", handler);
  return {
    events,
    cleanup: () =>
      window.removeEventListener("tangle.analytics.track", handler),
  };
}

/** Excludes the auto-fired session.tab.start event from assertions. */
function nonSessionEvents(events: CustomEvent<Record<string, unknown>>[]) {
  return events.filter((e) => e.detail.actionType !== "session.tab.start");
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mockIsFlagEnabled.mockReturnValue(false);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyticsProvider", () => {
  describe("track — event dispatch", () => {
    it("dispatches a tangle.analytics.track CustomEvent on window", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();
      act(() => result.current.track("pipeline.component_added"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      cleanup();
    });

    it("includes actionType, metadata, sessionId, route, appVersion, environment in detail", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();
      act(() => result.current.track("pipeline.run.submit", { run_id: "r-1" }));

      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      const { detail } = nonSessionEvents(events)[0];
      expect(detail.actionType).toBe("pipeline.run.submit");
      expect(detail.metadata).toEqual({ run_id: "r-1" });
      expect(detail.sessionId).toBeTruthy();
      expect(detail.route).toBe(window.location.pathname);
      expect("appVersion" in detail).toBe(true);
      expect("environment" in detail).toBe(true);
      cleanup();
    });

    it("omits metadata when not provided", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();
      act(() => result.current.track("pipeline.component_added"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      expect(nonSessionEvents(events)[0].detail.metadata).toBeUndefined();
      cleanup();
    });

    it("uses the same sessionId across multiple calls", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();
      act(() => {
        result.current.track("pipeline.component_added");
        result.current.track("pipeline.run.submit");
      });

      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(2));
      const [first, second] = nonSessionEvents(events);
      expect(first.detail.sessionId).toBe(second.detail.sessionId);
      cleanup();
    });

    it("uses hash:uuid session ID format after user resolves", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();
      act(() => result.current.track("pipeline.component_added"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      expect(nonSessionEvents(events)[0].detail.sessionId).toMatch(
        /^[0-9a-f]{8}:[0-9a-f-]{36}$/,
      );
      cleanup();
    });
  });

  describe("user resolution", () => {
    it("waits for the user query before dispatching", async () => {
      let resolveUser!: (value: { id: string }) => void;
      mockGetUser.mockReturnValue(
        new Promise<{ id: string }>((resolve) => {
          resolveUser = resolve;
        }),
      );

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();

      // Track before user resolves — must not dispatch yet
      act(() => result.current.track("test.event"));
      expect(events).toHaveLength(0);

      // Resolve the user — event should then dispatch
      act(() => resolveUser({ id: "user-2" }));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));

      expect(nonSessionEvents(events)[0].detail.actionType).toBe("test.event");
      cleanup();
    });

    it("dispatches multiple pending track calls after user resolves", async () => {
      let resolveUser!: (value: { id: string }) => void;
      mockGetUser.mockReturnValue(
        new Promise<{ id: string }>((resolve) => {
          resolveUser = resolve;
        }),
      );

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });

      const { events, cleanup } = captureEvents();

      act(() => {
        result.current.track("event.first");
        result.current.track("event.second");
        result.current.track("event.third");
      });
      expect(events).toHaveLength(0);

      act(() => resolveUser({ id: "user-3" }));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(3));

      expect(nonSessionEvents(events).map((e) => e.detail.actionType)).toEqual([
        "event.first",
        "event.second",
        "event.third",
      ]);
      cleanup();
    });
  });

  describe("session.tab.start", () => {
    it("fires session.tab.start automatically on mount", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { events, cleanup } = captureEvents();
      renderHook(() => useAnalytics(), { wrapper: makeWrapper() });
      await waitFor(() =>
        expect(
          events.some((e) => e.detail.actionType === "session.tab.start"),
        ).toBe(true),
      );
      cleanup();
    });

    it("includes resolved effective flag values in session.tab.start metadata", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      mockIsFlagEnabled.mockImplementation(
        (key: string) =>
          key === "dashboard" || key === "remote-component-library-search",
      );
      const { events, cleanup } = captureEvents();
      renderHook(() => useAnalytics(), { wrapper: makeWrapper() });
      await waitFor(() =>
        expect(
          events.some((e) => e.detail.actionType === "session.tab.start"),
        ).toBe(true),
      );
      const { flags } = events.find(
        (e) => e.detail.actionType === "session.tab.start",
      )!.detail.metadata as Record<string, Record<string, boolean>>;
      expect(flags["dashboard"]).toBe(true);
      expect(flags["remote-component-library-search"]).toBe(true);
      expect(flags["github-component-library"]).toBe(false);
      cleanup();
    });

    it("does not fire session.tab.start when a session ID already exists in sessionStorage", async () => {
      sessionStorage.setItem("tangle_tab_session_id", "existing-session");
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { events, cleanup } = captureEvents();
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      // Trigger a manual track to confirm events are working
      act(() => result.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      expect(
        events.filter((e) => e.detail.actionType === "session.tab.start"),
      ).toHaveLength(0);
      cleanup();
    });
  });

  describe("user identification", () => {
    it("prefixes session ID with an 8-char hash for a real user", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events, cleanup } = captureEvents();
      act(() => result.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      expect(nonSessionEvents(events)[0].detail.sessionId).toMatch(
        /^[0-9a-f]{8}:[0-9a-f-]{36}$/,
      );
      cleanup();
    });

    it("produces the same hash prefix for the same userId", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result: r1 } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events: e1, cleanup: c1 } = captureEvents();
      act(() => r1.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(e1)).toHaveLength(1));
      const prefix1 = (
        nonSessionEvents(e1)[0].detail.sessionId as string
      ).split(":")[0];
      c1();

      sessionStorage.clear();
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result: r2 } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events: e2, cleanup: c2 } = captureEvents();
      act(() => r2.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(e2)).toHaveLength(1));
      const prefix2 = (
        nonSessionEvents(e2)[0].detail.sessionId as string
      ).split(":")[0];
      c2();

      expect(prefix1).toBe(prefix2);
    });

    it("produces different hash prefixes for different userIds", async () => {
      mockGetUser.mockResolvedValue({ id: "user-1" });
      const { result: r1 } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events: e1, cleanup: c1 } = captureEvents();
      act(() => r1.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(e1)).toHaveLength(1));
      const prefix1 = (
        nonSessionEvents(e1)[0].detail.sessionId as string
      ).split(":")[0];
      c1();

      sessionStorage.clear();
      mockGetUser.mockResolvedValue({ id: "user-999" });
      const { result: r2 } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events: e2, cleanup: c2 } = captureEvents();
      act(() => r2.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(e2)).toHaveLength(1));
      const prefix2 = (
        nonSessionEvents(e2)[0].detail.sessionId as string
      ).split(":")[0];
      c2();

      expect(prefix1).not.toBe(prefix2);
    });

    it("uses a plain UUID when user.id is 'Unknown'", async () => {
      mockGetUser.mockResolvedValue({ id: "Unknown" });
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(),
      });
      const { events, cleanup } = captureEvents();
      act(() => result.current.track("probe"));
      await waitFor(() => expect(nonSessionEvents(events)).toHaveLength(1));
      expect(nonSessionEvents(events)[0].detail.sessionId).toMatch(
        /^[0-9a-f-]{36}$/,
      );
      cleanup();
    });
  });
});
