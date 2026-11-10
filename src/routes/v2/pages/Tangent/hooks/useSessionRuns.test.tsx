import type { EmbedResource, Tangent } from "@tangent/embed-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useSessionRuns } from "./useSessionRuns";

const tangent = vi.hoisted((): Tangent => ({
  newSession: vi.fn(),
  listResources: vi.fn(async (sessionId: string) => [
    {
      id: "r-1",
      sessionId,
      kind: "host",
      name: "Train",
      uri: "run://id/r-1",
      meta: { dismissed: true },
      createdAt: "2026-11-06T00:00:00.000Z",
    } satisfies EmbedResource,
    {
      id: "r-2",
      sessionId,
      kind: "host",
      name: "Forecast",
      uri: "run://id/r-2",
      createdAt: "2026-11-07T00:00:00.000Z",
    } satisfies EmbedResource,
  ]),
  addResource: vi.fn(),
  removeResource: vi.fn(),
}));

vi.mock("@tangent/embed-react", () => ({ useTangent: () => tangent }));

describe("useSessionRuns", () => {
  it("lists the chat's runs newest first, saying which were dismissed, and settles", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useSessionRuns("chat-1"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.runs).toHaveLength(2));
    expect(
      result.current.runs.map(({ id, dismissed }) => [id, dismissed]),
    ).toEqual([
      ["r-2", false],
      ["r-1", true],
    ]);
  });
});
