import type { EmbedResource, Tangent } from "@tangent/embed-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useProjectSessions: () => ({
    sessions: [{ sessionId: "chat-1" }, { sessionId: "chat-2" }],
  }),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: () => "token",
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

describe("useProjectSessionFiles", () => {
  it("lists every chat's files newest first, and settles", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useProjectSessionFiles("project-1"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.files).toHaveLength(2));
    expect(result.current.reports.map(({ title }) => title)).toEqual([
      "chat-2 report",
      "chat-1 report",
    ]);
    expect(result.current.files[0].url).toBe(
      "https://tangent.example/api/sessions/chat-2/files/artifacts/report.html",
    );
  });
});
