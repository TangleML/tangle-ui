import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import type { TangentEnvironment } from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";
import { listTangentEnvironments } from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";

import { useProjectLocalEnv } from "./useProjectLocalEnv";

vi.mock("@/routes/v2/pages/Tangent/services/listTangentEnvironments", () => ({
  listTangentEnvironments: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: vi.fn(() => undefined),
}));

const socketHandlers = new Map<string, (payload: unknown) => void>();
const disconnect = vi.fn();
let connections = 0;

vi.mock("socket.io-client", () => ({
  io: () => {
    connections += 1;
    return {
      on: (event: string, handler: (payload: unknown) => void) => {
        socketHandlers.set(event, handler);
      },
      disconnect,
    };
  },
}));

const USER_ID = "me@example.com";
const BASE_URL = "http://tangent";

function env(overrides: Partial<TangentEnvironment>): TangentEnvironment {
  return {
    environmentId: "env-1",
    scoped: true,
    toolCount: 0,
    subagentCount: 0,
    ...overrides,
  };
}

function makeClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["user"], { id: USER_ID, permissions: [] });
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function mockEnvironments(environments: TangentEnvironment[]) {
  vi.mocked(listTangentEnvironments).mockResolvedValue(environments);
}

beforeEach(() => {
  socketHandlers.clear();
  connections = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("useProjectLocalEnv", () => {
  it("keeps only the viewer's own VS Code windows", async () => {
    mockEnvironments([
      env({
        environmentId: "s1:vscode-a",
        owner: USER_ID,
        metadata: { editor: "Cursor" },
      }),
      env({
        environmentId: "s1:vscode-b",
        owner: "teammate@example.com",
        metadata: { editor: "Cursor" },
      }),
      env({ environmentId: "s1:workarea", owner: USER_ID }),
    ]);

    const { result } = renderHook(() => useProjectLocalEnv(BASE_URL, ["s1"]), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isLocalEnvConnected).toBe(true));
    expect(
      result.current.localEnvironments.map((e) => e.environmentId),
    ).toEqual(["s1:vscode-a"]);
  });

  it("treats a browser host as no local environment", async () => {
    mockEnvironments([
      env({
        environmentId: "s1:vscode-browser",
        owner: USER_ID,
        metadata: { editor: "browser" },
      }),
    ]);

    const { result } = renderHook(() => useProjectLocalEnv(BASE_URL, ["s1"]), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() =>
      expect(listTangentEnvironments).toHaveBeenCalledTimes(1),
    );
    expect(result.current.isLocalEnvConnected).toBe(false);
    expect(result.current.localEnvironments).toEqual([]);
  });

  it("connects again as this person once there is a token", async () => {
    mockEnvironments([]);
    const sessionIds = ["s1"];

    const { rerender } = renderHook(
      () => useProjectLocalEnv(BASE_URL, sessionIds),
      { wrapper: wrapperFor(makeClient()) },
    );
    await waitFor(() => expect(connections).toBe(1));

    vi.mocked(useRemoteEnvAuthToken).mockReturnValue("token-1");
    rerender();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(connections).toBe(2);
  });

  it("keeps its socket when the token is refreshed", async () => {
    mockEnvironments([]);
    vi.mocked(useRemoteEnvAuthToken).mockReturnValue("token-1");
    const sessionIds = ["s1"];

    const { rerender } = renderHook(
      () => useProjectLocalEnv(BASE_URL, sessionIds),
      { wrapper: wrapperFor(makeClient()) },
    );
    await waitFor(() => expect(connections).toBe(1));

    vi.mocked(useRemoteEnvAuthToken).mockReturnValue("token-2");
    rerender();

    expect(disconnect).not.toHaveBeenCalled();
    expect(connections).toBe(1);
  });

  it("refetches only for environment:update broadcasts within the project", async () => {
    mockEnvironments([
      env({
        environmentId: "s1:vscode-a",
        owner: USER_ID,
        metadata: { editor: "Cursor" },
      }),
    ]);

    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useProjectLocalEnv(BASE_URL, ["s1"]), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isLocalEnvConnected).toBe(true));
    invalidate.mockClear();

    const handler = socketHandlers.get("environment:update");
    if (!handler)
      throw new Error("environment:update handler was not registered");

    act(() => handler({ sessionId: "not-in-project" }));
    expect(invalidate).not.toHaveBeenCalled();

    act(() => handler({ sessionId: "s1" }));
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() => handler({}));
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
