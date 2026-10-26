import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/user");

import { createUnsignedJwt } from "@/routes/v2/pages/Tangent/services/createUnsignedJwt";
import { getUserDetails } from "@/utils/user";

import { useTangentEmbedToken } from "./useTangentEmbedToken";

const CROSS_ORIGIN = "https://tangent.example";

function user(id: string) {
  return { id, permissions: [] };
}

function renderToken(baseUrl: string | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useTangentEmbedToken(baseUrl), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTangentEmbedToken", () => {
  it("has no getter without a url", () => {
    const { result } = renderToken(null);

    expect(result.current).toBeUndefined();
  });

  it("has no getter for a same-origin Tangent", () => {
    const { result } = renderToken(`${window.location.origin}/tangent`);

    expect(result.current).toBeUndefined();
  });

  it("presents the signed-in user to a cross-origin Tangent", async () => {
    vi.mocked(getUserDetails).mockResolvedValue(user("user@example.com"));

    const { result } = renderToken(CROSS_ORIGIN);

    await expect(result.current?.()).resolves.toBe(
      createUnsignedJwt({ email: "user@example.com" }),
    );
  });

  it("presents no one when the user is unknown", async () => {
    vi.mocked(getUserDetails).mockResolvedValue(user("Unknown"));

    const { result } = renderToken(CROSS_ORIGIN);

    await expect(result.current?.()).resolves.toBeUndefined();
  });

  // The embed's socket waits on the getter, so a rejection would stall it.
  it("resolves to no token when the user cannot be loaded", async () => {
    vi.mocked(getUserDetails).mockRejectedValue(new Error("offline"));

    const { result } = renderToken(CROSS_ORIGIN);

    await expect(result.current?.()).resolves.toBeUndefined();
  });

  it("keeps the same getter across renders", () => {
    const { result, rerender } = renderToken(CROSS_ORIGIN);
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
