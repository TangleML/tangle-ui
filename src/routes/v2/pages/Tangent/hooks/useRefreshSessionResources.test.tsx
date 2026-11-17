import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";

import { useRefreshSessionResources } from "./useRefreshSessionResources";

describe("useRefreshSessionResources", () => {
  it("refetches one chat's resources, leaving other chats alone", () => {
    const client = new QueryClient();
    const thisChat = sessionResourcesKey("chat-1");
    const otherChat = sessionResourcesKey("chat-2");
    client.setQueryData(thisChat, []);
    client.setQueryData(otherChat, []);
    const { result } = renderHook(() => useRefreshSessionResources(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    result.current("chat-1");

    const invalidated = (key: unknown[]) =>
      client.getQueryState(key)?.isInvalidated;
    expect(invalidated(thisChat)).toBe(true);
    expect(invalidated(otherChat)).toBe(false);
  });
});
