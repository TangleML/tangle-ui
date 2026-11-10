import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { sessionFilesKey } from "./useProjectSessionFiles";
import { useRefreshSessionResources } from "./useRefreshSessionResources";
import { sessionRunsKey } from "./useSessionRuns";

const BASE_URL = "https://tangent.example";

vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: () => ({ baseUrl: BASE_URL }),
}));

describe("useRefreshSessionResources", () => {
  it("refetches one chat's files and runs, leaving other chats alone", () => {
    const client = new QueryClient();
    const keys = {
      files: sessionFilesKey(BASE_URL, "chat-1"),
      runs: sessionRunsKey("chat-1"),
      otherFiles: sessionFilesKey(BASE_URL, "chat-2"),
    };
    for (const key of Object.values(keys)) client.setQueryData(key, []);
    const { result } = renderHook(
      () => useRefreshSessionResources("project-1"),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    result.current("chat-1");

    const invalidated = (key: unknown[]) =>
      client.getQueryState(key)?.isInvalidated;
    expect(invalidated(keys.files)).toBe(true);
    expect(invalidated(keys.runs)).toBe(true);
    expect(invalidated(keys.otherFiles)).toBe(false);
  });
});
