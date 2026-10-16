import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./workspaceSecretsService");

const notify = vi.fn();
vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import { WorkspaceSecretsApiError } from "./errors";
import type { WorkspaceSecret } from "./types";
import {
  useCreateWorkspaceSecret,
  useDeleteWorkspaceSecret,
  useReplaceWorkspaceSecret,
  useWorkspaceSecrets,
} from "./useWorkspaceSecrets";
import * as workspaceSecretsService from "./workspaceSecretsService";

const secret: WorkspaceSecret = {
  name: "API_KEY",
  description: null,
  expiresAt: null,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
  createdBy: "alice@example.com",
  canManage: true,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  backend = { configured: true, available: true };
});

describe("useWorkspaceSecrets", () => {
  it("lists the secrets of the workspace it is given", async () => {
    vi.mocked(workspaceSecretsService.listWorkspaceSecrets).mockResolvedValue({
      secrets: [secret],
      canCreate: true,
    });

    const { result } = renderHook(() => useWorkspaceSecrets("ws-1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(workspaceSecretsService.listWorkspaceSecrets).toHaveBeenCalledWith(
      "ws-1",
    );
    expect(result.current.data?.secrets).toEqual([secret]);
  });

  it("waits until it knows which workspace to ask about", () => {
    const { result } = renderHook(() => useWorkspaceSecrets(undefined), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(workspaceSecretsService.listWorkspaceSecrets).not.toHaveBeenCalled();
  });

  it("asks nothing of a backend that is not there", () => {
    backend = { configured: true, available: false };

    const { result } = renderHook(() => useWorkspaceSecrets("ws-1"), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(workspaceSecretsService.listWorkspaceSecrets).not.toHaveBeenCalled();
  });
});

describe("workspace secret mutations", () => {
  it("re-reads the list after adding a secret", async () => {
    vi.mocked(workspaceSecretsService.createWorkspaceSecret).mockResolvedValue(
      secret,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateWorkspaceSecret("ws-1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "API_KEY", value: "s3cret" });
    });

    expect(workspaceSecretsService.createWorkspaceSecret).toHaveBeenCalledWith(
      "ws-1",
      { name: "API_KEY", value: "s3cret" },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["workspaces", "ws-1", "secrets"],
    });
  });

  it("re-reads the list after replacing a secret", async () => {
    vi.mocked(workspaceSecretsService.replaceWorkspaceSecret).mockResolvedValue(
      secret,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useReplaceWorkspaceSecret("ws-1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "API_KEY",
        input: { value: "n3w" },
      });
    });

    expect(workspaceSecretsService.replaceWorkspaceSecret).toHaveBeenCalledWith(
      "ws-1",
      "API_KEY",
      { value: "n3w" },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["workspaces", "ws-1", "secrets"],
    });
  });

  it("re-reads the list after deleting a secret", async () => {
    vi.mocked(workspaceSecretsService.deleteWorkspaceSecret).mockResolvedValue(
      undefined,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteWorkspaceSecret("ws-1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync("API_KEY");
    });

    expect(workspaceSecretsService.deleteWorkspaceSecret).toHaveBeenCalledWith(
      "ws-1",
      "API_KEY",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["workspaces", "ws-1", "secrets"],
    });
  });

  it("says why the backend refused", async () => {
    vi.mocked(workspaceSecretsService.createWorkspaceSecret).mockRejectedValue(
      new WorkspaceSecretsApiError(
        "Failed to add secret: Secret 'API_KEY' already exists in this workspace.",
        409,
      ),
    );

    const { result } = renderHook(() => useCreateWorkspaceSecret("ws-1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ name: "API_KEY", value: "s3cret" })
        .catch(() => undefined);
    });

    expect(notify).toHaveBeenCalledWith(
      "Failed to add secret: Secret 'API_KEY' already exists in this workspace.",
      "error",
    );
  });

  it("keeps a generic message for a failure that never reached the API", async () => {
    vi.mocked(workspaceSecretsService.deleteWorkspaceSecret).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const { result } = renderHook(() => useDeleteWorkspaceSecret("ws-1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await act(async () => {
      await result.current.mutateAsync("API_KEY").catch(() => undefined);
    });

    expect(notify).toHaveBeenCalledWith("Failed to delete secret", "error");
  });
});
