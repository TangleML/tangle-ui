import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectRemoteEnvWithRefresh } from "./connectRemoteEnvWithRefresh";
import { fetchRemoteEnvToken } from "./fetchRemoteEnvToken";
import type { RemoteEnvHost } from "./remoteEnvHost";

vi.mock("./fetchRemoteEnvToken", () => ({
  fetchRemoteEnvToken: vi.fn(),
}));

function makeHost(): RemoteEnvHost {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  };
}

describe("connectRemoteEnvWithRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes readiness only after the socket connection resolves", async () => {
    const host = makeHost();
    let resolveConnection: (() => void) | undefined;
    vi.mocked(host.connect).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveConnection = resolve;
      }),
    );
    vi.mocked(fetchRemoteEnvToken).mockResolvedValue({
      token: "token",
      environmentId: "env-1",
    });
    const onConnected = vi.fn();

    connectRemoteEnvWithRefresh({
      host,
      baseUrl: "https://tangent.example",
      sessionId: "session-1",
      getAuthToken: () => "auth",
      onConnected,
      onError: vi.fn(),
    });
    await vi.waitFor(() => expect(host.connect).toHaveBeenCalledOnce());

    expect(onConnected).not.toHaveBeenCalled();
    resolveConnection?.();
    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledWith("env-1"));
  });

  it("retries a transient token failure with the latest auth token", async () => {
    const host = makeHost();
    vi.mocked(fetchRemoteEnvToken)
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({
        token: "token",
        environmentId: "env-1",
      });
    let authToken = "old-auth";
    const onError = vi.fn();
    const onConnected = vi.fn();

    connectRemoteEnvWithRefresh({
      host,
      baseUrl: "https://tangent.example",
      sessionId: "session-1",
      getAuthToken: () => authToken,
      onConnected,
      onError,
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("temporary"));

    authToken = "new-auth";
    await vi.advanceTimersByTimeAsync(5_000);

    expect(fetchRemoteEnvToken).toHaveBeenLastCalledWith(
      expect.objectContaining({ authToken: "new-auth" }),
    );
    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledWith("env-1"));
  });

  it("does not retry after it is stopped", async () => {
    const host = makeHost();
    vi.mocked(fetchRemoteEnvToken).mockRejectedValue(new Error("temporary"));
    const onError = vi.fn();

    const stop = connectRemoteEnvWithRefresh({
      host,
      baseUrl: "https://tangent.example",
      sessionId: "session-1",
      getAuthToken: () => "auth",
      onError,
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchRemoteEnvToken).toHaveBeenCalledOnce();
  });
});
