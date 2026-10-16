import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import { WorkspaceSecretsApiError } from "./errors";
import {
  createWorkspaceSecret,
  deleteWorkspaceSecret,
  listWorkspaceSecrets,
  replaceWorkspaceSecret,
} from "./workspaceSecretsService";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const secretDto = {
  secret_name: "API_KEY",
  description: "Model access",
  expires_at: "2026-12-31T23:59:59.999Z",
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-02T09:00:00Z",
  created_by: "alice@example.com",
  can_manage: true,
};

type ClientCall = typeof client.get;

function succeed(call: ClientCall, data: unknown, status = 200) {
  vi.mocked(call).mockResolvedValue({
    data,
    error: undefined,
    response: { status, ok: true },
  } as unknown as Awaited<ReturnType<ClientCall>>);
}

function refuse(call: ClientCall, status: number, error: unknown = {}) {
  vi.mocked(call).mockResolvedValue({
    data: undefined,
    error,
    response: { status, ok: false },
  } as unknown as Awaited<ReturnType<ClientCall>>);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("listWorkspaceSecrets", () => {
  it("asks the workspace's own secrets endpoint", async () => {
    succeed(client.get, { secrets: [], can_create: true });

    await listWorkspaceSecrets("ws-1");

    expect(client.get).toHaveBeenCalledWith({
      url: "/api/workspaces/{workspace_id}/secrets/",
      path: { workspace_id: "ws-1" },
    });
  });

  it("reads each secret and whether the caller may add one", async () => {
    succeed(client.get, { secrets: [secretDto], can_create: false });

    await expect(listWorkspaceSecrets("ws-1")).resolves.toEqual({
      canCreate: false,
      secrets: [
        {
          name: "API_KEY",
          description: "Model access",
          expiresAt: new Date("2026-12-31T23:59:59.999Z"),
          createdAt: new Date("2026-10-01T09:00:00Z"),
          updatedAt: new Date("2026-10-02T09:00:00Z"),
          createdBy: "alice@example.com",
          canManage: true,
        },
      ],
    });
  });

  it("keeps a missing expiry missing", async () => {
    succeed(client.get, {
      secrets: [{ ...secretDto, expires_at: null }],
      can_create: true,
    });

    const { secrets } = await listWorkspaceSecrets("ws-1");

    expect(secrets[0].expiresAt).toBeNull();
  });

  it("says why the workspace could not be read", async () => {
    refuse(client.get, 404, { detail: "Workspace not found" });

    await expect(listWorkspaceSecrets("ws-gone")).rejects.toMatchObject({
      name: "WorkspaceSecretsApiError",
      status: 404,
      message: "Failed to load secrets: Workspace not found",
    });
  });
});

describe("createWorkspaceSecret", () => {
  it("sends the name, value and details as JSON", async () => {
    succeed(client.post, secretDto);

    await createWorkspaceSecret("ws-1", {
      name: "API_KEY",
      value: "s3cret",
      description: "Model access",
      expiresAt: "2026-12-31T23:59:59.999Z",
    });

    expect(client.post).toHaveBeenCalledWith({
      url: "/api/workspaces/{workspace_id}/secrets/",
      path: { workspace_id: "ws-1" },
      body: {
        secret_name: "API_KEY",
        secret_value: "s3cret",
        description: "Model access",
        expires_at: "2026-12-31T23:59:59.999Z",
      },
      headers: { "Content-Type": "application/json" },
    });
  });

  it("says why a name was refused", async () => {
    refuse(client.post, 409, {
      detail: "Secret 'API_KEY' already exists in this workspace.",
    });

    await expect(
      createWorkspaceSecret("ws-1", { name: "API_KEY", value: "s3cret" }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Failed to add secret: Secret 'API_KEY' already exists in this workspace.",
    });
  });

  it("falls back to a plain failure when the refusal explains nothing", async () => {
    refuse(client.post, 403);

    const failure = createWorkspaceSecret("ws-1", {
      name: "API_KEY",
      value: "s3cret",
    });

    await expect(failure).rejects.toBeInstanceOf(WorkspaceSecretsApiError);
    await expect(failure).rejects.toMatchObject({
      status: 403,
      message: "Failed to add secret",
    });
  });
});

describe("replaceWorkspaceSecret", () => {
  it("puts the new value to the secret it names", async () => {
    succeed(client.put, secretDto);

    await replaceWorkspaceSecret("ws-1", "API_KEY", { value: "n3w" });

    expect(client.put).toHaveBeenCalledWith({
      url: "/api/workspaces/{workspace_id}/secrets/{secret_name}",
      path: { workspace_id: "ws-1", secret_name: "API_KEY" },
      body: {
        secret_value: "n3w",
        description: undefined,
        expires_at: undefined,
      },
      headers: { "Content-Type": "application/json" },
    });
  });

  it("says why the replacement was refused", async () => {
    refuse(client.put, 403, { detail: "Only the creator can do that." });

    await expect(
      replaceWorkspaceSecret("ws-1", "API_KEY", { value: "n3w" }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Failed to replace secret: Only the creator can do that.",
    });
  });
});

describe("deleteWorkspaceSecret", () => {
  it("accepts the empty 204 the backend answers with", async () => {
    succeed(client.delete, undefined, 204);

    await expect(
      deleteWorkspaceSecret("ws-1", "API_KEY"),
    ).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledWith({
      url: "/api/workspaces/{workspace_id}/secrets/{secret_name}",
      path: { workspace_id: "ws-1", secret_name: "API_KEY" },
    });
  });

  it("says why the deletion was refused", async () => {
    refuse(client.delete, 404, { detail: "Secret not found" });

    await expect(
      deleteWorkspaceSecret("ws-1", "API_KEY"),
    ).rejects.toMatchObject({
      status: 404,
      message: "Failed to delete secret: Secret not found",
    });
  });
});
