import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://backend.example" }),
}));
vi.mock(
  "@/routes/v2/pages/Tangent/services/identityAssertion",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/routes/v2/pages/Tangent/services/identityAssertion")
    >()),
    identityToken: vi.fn(),
  }),
);

import { identityToken } from "@/routes/v2/pages/Tangent/services/identityAssertion";
import { MINUTES } from "@/utils/constants";

import { useRemoteEnvAuthToken } from "./useRemoteEnvAuthToken";

const PROXIED_INSTANCE = "http://backend.example/api/tangent/instances/inst-42";

function renderToken(baseUrl: string | null, userId = "user@example.com") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["user"], { id: userId, permissions: [] });
  return renderHook(() => useRemoteEnvAuthToken(baseUrl), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(identityToken).mockResolvedValue({ token: "assertion" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRemoteEnvAuthToken", () => {
  it("resolves to the signed-in user's assertion for the Tangent instance", async () => {
    const { result } = renderToken(PROXIED_INSTANCE);

    await waitFor(() => expect(result.current).toBe("assertion"));
    expect(identityToken).toHaveBeenCalledWith({
      backendUrl: "http://backend.example",
      instanceId: "inst-42",
      email: "user@example.com",
    });
  });

  it("asks for no instance when the Tangent url names none", async () => {
    const { result } = renderToken("https://tangent.example");

    await waitFor(() => expect(result.current).toBe("assertion"));
    expect(identityToken).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: undefined }),
    );
  });

  it("has no token for an unknown user", async () => {
    const { result } = renderToken(PROXIED_INSTANCE, "Unknown");

    await act(async () => {});

    expect(result.current).toBeUndefined();
    expect(identityToken).not.toHaveBeenCalled();
  });

  it("mints nothing until the Tangent url is known", async () => {
    const { result } = renderToken(null);

    await act(async () => {});

    expect(result.current).toBeUndefined();
    expect(identityToken).not.toHaveBeenCalled();
  });

  it("has no token when the backend refuses the assertion", async () => {
    vi.mocked(identityToken).mockRejectedValue(new Error("HTTP 500"));

    const { result } = renderToken(PROXIED_INSTANCE);

    await act(async () => {});

    expect(result.current).toBeUndefined();
  });

  it("retries a refused assertion after a minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(identityToken)
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockResolvedValueOnce({ token: "recovered" });

    const { result } = renderToken(PROXIED_INSTANCE);
    await waitFor(() => expect(identityToken).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(1 * MINUTES));

    await waitFor(() => expect(result.current).toBe("recovered"));
    expect(identityToken).toHaveBeenCalledTimes(2);
  });

  it("refreshes the token at its refresh time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(identityToken)
      .mockResolvedValueOnce({
        token: "first",
        refreshAtMs: Date.now() + 2 * MINUTES,
      })
      .mockResolvedValueOnce({ token: "second" });

    const { result } = renderToken(PROXIED_INSTANCE);
    await waitFor(() => expect(result.current).toBe("first"));

    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTES));

    await waitFor(() => expect(result.current).toBe("second"));
    expect(identityToken).toHaveBeenCalledTimes(2);
  });
});
