import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useLazyBridgeAuth } from "./useLazyBridgeAuth";

let authToken = "first-token";

vi.mock("@/components/shared/Authentication/useAuthLocalStorage", () => ({
  useAuthLocalStorage: () => ({
    getToken: () => authToken,
  }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example" }),
}));

describe("useLazyBridgeAuth", () => {
  it("reads the current auth token without requiring a rerender", () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLazyBridgeAuth(), { wrapper });

    expect(result.current.getAuthToken()).toBe("first-token");
    authToken = "refreshed-token";
    expect(result.current.getAuthToken()).toBe("refreshed-token");
  });
});
