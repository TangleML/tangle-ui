import { act, renderHook, waitFor } from "@testing-library/react";
import { action, observable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_TAB_VALUE,
  TangentProjectStore,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { useTangentSessionParam } from "./useTangentSessionParam";

const navigate = vi.fn();
const notify = vi.fn();
const client = { fetchQuery: vi.fn() };

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => client,
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
}));

function makeStore(defaultSessionId?: string) {
  const selected = observable.box<string>();
  return {
    projectId: "project-1",
    get selectedSessionId() {
      return selected.get();
    },
    get activeSessionId() {
      return selected.get() ?? defaultSessionId;
    },
    selectSession: vi.fn(action((id: string | undefined) => selected.set(id))),
    startSession: vi.fn().mockResolvedValue(true),
  } as unknown as TangentProjectStore;
}

describe("useTangentSessionParam", () => {
  beforeEach(() => {
    search = {};
    client.fetchQuery.mockResolvedValue({
      items: ["sess-a", "sess-b", "s"].map((entityId) => ({ entityId })),
      nextPageToken: null,
    });
  });
  afterEach(() => vi.resetAllMocks());

  it("opens the session the project page linked to", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).toHaveBeenCalledWith("sess-a");
    expect(store.startSession).not.toHaveBeenCalled();
  });

  it("keeps a shared link available for reload until another chat is selected", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(navigate).not.toHaveBeenCalled();
    store.selectSession("sess-b");
    const { search: rewrite, replace } = navigate.mock.calls[0][0];
    expect(replace).toBe(true);
    expect(rewrite({ session: "sess-a", other: "kept" })).toEqual({
      other: "kept",
    });
  });

  it("opens a second shared link in the same mounted project", () => {
    const store = makeStore();
    search = { session: "sess-a" };
    const { rerender } = renderHook(() => useTangentSessionParam(store));
    search = { session: "sess-b" };
    rerender();

    expect(store.activeSessionId).toBe("sess-b");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens the named agent and clears just the message link when its tab is left", () => {
    const store = new TangentProjectStore("p");
    search = { session: "s", message: "m", agent: "a" };
    renderHook(() => useTangentSessionParam(store));
    expect(store.chatTabs).toEqual([]);
    // The embed identifies the agent once it has received this session's roster.
    store.openAgent({
      id: "a",
      kind: "subagent",
      name: "Researcher",
      conversationId: "thread",
      status: "active",
    });
    expect(navigate).not.toHaveBeenCalled();
    store.closeChatTab("a");
    const { search: rewrite } = navigate.mock.calls[0][0];
    expect(
      rewrite({ session: "s", message: "m", agent: "a", other: "kept" }),
    ).toEqual({ session: "s", other: "kept" });
  });

  it("selects Prime for a linked message when the project already shows another agent", () => {
    const store = new TangentProjectStore("p");
    store.selectSession("s");
    store.openAgent({
      id: "a",
      kind: "subagent",
      name: "Researcher",
      conversationId: "thread",
      status: "active",
    });
    search = { session: "s", message: "m" };
    const { result } = renderHook(() => useTangentSessionParam(store));
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);
    expect(result.current?.messageId).toBe("m");
  });

  it("acts once however often it re-renders", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    rerender();
    rerender();

    expect(store.selectSession).toHaveBeenCalledTimes(1);
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

  it("restores the default chat on Back and the linked chat on Forward", () => {
    const store = makeStore("sess-a");
    const { rerender } = renderHook(() => useTangentSessionParam(store));
    search = { session: "sess-b" };
    rerender();
    expect(store.activeSessionId).toBe("sess-b");

    search = {};
    rerender();
    expect(store.activeSessionId).toBe("sess-a");

    search = { session: "sess-b" };
    rerender();
    expect(store.activeSessionId).toBe("sess-b");
  });

  it("leaves the current chat open while a requested new chat starts", () => {
    const store = makeStore("sess-a");
    search = { session: "sess-b" };
    const { rerender } = renderHook(() => useTangentSessionParam(store));
    search = { session: "new" };
    rerender();
    search = {};
    rerender();

    expect(store.activeSessionId).toBe("sess-b");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps a newly selected chat when removing the previous chat's link", async () => {
    const pending = Promise.withResolvers<{
      items: never[];
      nextPageToken: null;
    }>();
    client.fetchQuery.mockReturnValueOnce(pending.promise);
    const store = makeStore("sess-a");
    search = { session: "old" };
    const { rerender } = renderHook(() => useTangentSessionParam(store));

    store.selectSession("newly-started");
    search = {};
    rerender();
    await act(() => pending.resolve({ items: [], nextPageToken: null }));

    expect(store.activeSessionId).toBe("newly-started");
    expect(notify).not.toHaveBeenCalled();
  });

  it("returns to the latest chat when the linked chat is missing", async () => {
    const store = makeStore("sess-a");
    search = { session: "gone" };
    renderHook(() => useTangentSessionParam(store));

    await waitFor(() => expect(store.activeSessionId).toBe("sess-a"));
    expect(notify).toHaveBeenCalledWith(
      "That chat isn't available in this project.",
      "warning",
    );
    const { search: rewrite, replace } = navigate.mock.calls[0][0];
    expect(replace).toBe(true);
    expect(rewrite({ session: "gone", other: "kept" })).toEqual({
      other: "kept",
    });
  });

  it("keeps an older linked chat found beyond the first page", async () => {
    client.fetchQuery
      .mockResolvedValueOnce({ items: [], nextPageToken: "more" })
      .mockResolvedValueOnce([{ entityId: "older" }]);
    const store = makeStore("sess-a");
    search = { session: "older" };
    await act(() => {
      renderHook(() => useTangentSessionParam(store));
    });

    expect(client.fetchQuery).toHaveBeenCalledTimes(2);
    expect(store.activeSessionId).toBe("older");
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("keeps the link when the server cannot confirm which chats exist", async () => {
    client.fetchQuery.mockRejectedValueOnce(new Error("Offline"));
    const store = makeStore("sess-a");
    search = { session: "maybe" };
    await act(() => {
      renderHook(() => useTangentSessionParam(store));
    });

    expect(store.activeSessionId).toBe("maybe");
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
