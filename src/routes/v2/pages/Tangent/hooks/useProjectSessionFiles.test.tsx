import type { EmbedResource, Tangent } from "@tangent/embed-react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";

import { useProjectSessionFiles } from "./useProjectSessionFiles";

const tangent = vi.hoisted((): Tangent => ({
  newSession: vi.fn(),
  listResources: vi.fn(async (sessionId: string) => [
    {
      id: `${sessionId}-report`,
      sessionId,
      kind: "artifact",
      name: `${sessionId} report`,
      uri: "artifacts/report.html",
      createdAt:
        sessionId === "chat-2"
          ? "2026-11-07T00:00:00.000Z"
          : "2026-11-06T00:00:00.000Z",
    } satisfies EmbedResource,
  ]),
  addResource: vi.fn(),
  removeResource: vi.fn(),
}));

vi.mock("@tangent/embed-react", () => ({ useTangent: () => tangent }));
vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: () => ({ baseUrl: "https://tangent.example" }),
}));
const chatList = vi.hoisted(() => ({
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useProjectSessions: () => ({
    ...chatList,
    sessions:
      chatList.isLoading || chatList.error
        ? []
        : [{ sessionId: "chat-1" }, { sessionId: "chat-2" }],
  }),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: () => "token",
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

function renderFiles(client: QueryClient) {
  return renderHook(() => useProjectSessionFiles("project-1"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useProjectSessionFiles", () => {
  beforeEach(() => {
    vi.mocked(tangent.listResources).mockClear();
    chatList.isLoading = false;
    chatList.error = null;
  });

  it("lists every chat's files newest first, and settles", async () => {
    const { result } = renderFiles(newClient());

    await waitFor(() => expect(result.current.files).toHaveLength(2));
    expect(result.current.reports.map(({ title }) => title)).toEqual([
      "chat-2 report",
      "chat-1 report",
    ]);
    expect(result.current.files[0].url).toBe(
      "https://tangent.example/api/sessions/chat-2/files/artifacts/report.html",
    );
  });

  it("doesn't read the chats again when the card reopens soon after", async () => {
    const client = newClient();
    const first = renderFiles(client);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = renderFiles(client);
    await waitFor(() => expect(second.result.current.files).toHaveLength(2));

    expect(tangent.listResources).toHaveBeenCalledTimes(2);
  });

  it("doesn't read even stale chats again on returning to the tab", async () => {
    const client = newClient();
    const { result } = renderFiles(client);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await client.invalidateQueries({ refetchType: "none" });

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(tangent.listResources).toHaveBeenCalledTimes(2);
  });

  it("reads a chat again when the card reopens after its files changed", async () => {
    const client = newClient();
    const first = renderFiles(client);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();
    await client.invalidateQueries({
      queryKey: sessionResourcesKey("chat-1"),
    });

    const second = renderFiles(client);

    await waitFor(() => expect(tangent.listResources).toHaveBeenCalledTimes(3));
    expect(second.result.current.files).toHaveLength(2);
  });

  it("is loading while the project's chats are still being listed", () => {
    chatList.isLoading = true;

    const { result } = renderFiles(newClient());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("is loading until every chat has been read", async () => {
    const { result } = renderFiles(newClient());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("fails when the project's chats couldn't be listed", () => {
    chatList.error = new Error("The projects service is down");

    const { result } = renderFiles(newClient());

    expect(result.current.error).toBe(chatList.error);
  });

  it("fails when none of the chats could be read", async () => {
    const refused = new Error("Tangent is down");
    vi.mocked(tangent.listResources)
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce(refused);

    const { result } = renderFiles(newClient());

    await waitFor(() => expect(result.current.error).toBe(refused));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.files).toEqual([]);
  });

  it("leaves out a chat it can't read without failing", async () => {
    vi.mocked(tangent.listResources).mockRejectedValueOnce(
      new Error("Not your chat"),
    );

    const { result } = renderFiles(newClient());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.files).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});
