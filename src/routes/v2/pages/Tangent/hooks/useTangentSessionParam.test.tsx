import { renderHook } from "@testing-library/react";
import { action, observable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_TAB_VALUE,
  TangentProjectStore,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { useTangentSessionParam } from "./useTangentSessionParam";

const navigate = vi.fn();
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
}));

function makeStore() {
  const selected = observable.box<string>();
  return {
    get activeSessionId() {
      return selected.get();
    },
    selectSession: vi.fn(action((id: string) => selected.set(id))),
    startSession: vi.fn().mockResolvedValue(true),
  } as unknown as TangentProjectStore;
}

describe("useTangentSessionParam", () => {
  beforeEach(() => {
    search = {};
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
});
