import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/sdk.gen", () => ({
  createSecretApiSecretsPost: vi.fn(),
  deleteSecretApiSecretsSecretNameDelete: vi.fn(),
  listSecretsApiSecretsGet: vi.fn(),
  updateSecretApiSecretsSecretNamePut: vi.fn(),
}));

vi.mock("@/providers/TourProvider/tourMockBackend", () => ({
  isTourMockActive: () => false,
  mockAddSecret: vi.fn(),
  mockListSecrets: vi.fn(),
  mockRemoveSecret: vi.fn(),
  mockUpdateSecret: vi.fn(),
}));

import {
  createSecretApiSecretsPost,
  deleteSecretApiSecretsSecretNameDelete,
  listSecretsApiSecretsGet,
  updateSecretApiSecretsSecretNamePut,
} from "@/api/sdk.gen";
import { TeamImpersonationError } from "@/services/teams/errors";

import {
  addSecret,
  fetchSecretsList,
  removeSecret,
  SecretsApiError,
  secretsListQuery,
  updateSecret,
} from "./secretsStorage";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
const HEADER_NAME = "x-tangle-impersonate-team-id";
const TEAM_HEADERS = { [HEADER_NAME]: TEAM_ID };

const sdkResult = (status: number, body: { data?: unknown; error?: unknown }) =>
  ({
    data: body.data,
    error: body.error,
    request: new Request("http://localhost/api/secrets/"),
    response: new Response(null, { status }),
  }) as never;

describe("secretsStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__TANGLE_TEAM_IMPERSONATION__ = { headerName: HEADER_NAME };
  });

  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
  });

  describe("fetchSecretsList", () => {
    beforeEach(() => {
      vi.mocked(listSecretsApiSecretsGet).mockResolvedValue(
        sdkResult(200, {
          data: {
            secrets: [
              {
                secret_name: "API_KEY",
                created_at: "2026-10-01T10:00:00",
                updated_at: "2026-10-02T10:00:00Z",
                expires_at: "2026-12-31T23:59:59Z",
                description: "For the model provider",
              },
            ],
          },
        }),
      );
    });

    it("lists the user's own secrets without the team header", async () => {
      await expect(fetchSecretsList()).resolves.toEqual([
        {
          id: "API_KEY",
          name: "API_KEY",
          createdAt: new Date("2026-10-01T10:00:00Z"),
          updatedAt: new Date("2026-10-02T10:00:00Z"),
          expiresAt: new Date("2026-12-31T23:59:59Z"),
          description: "For the model provider",
        },
      ]);
      expect(listSecretsApiSecretsGet).toHaveBeenCalledWith({ headers: {} });
    });

    it("lists a team's secrets while acting as the team", async () => {
      await fetchSecretsList(TEAM_ID);

      expect(listSecretsApiSecretsGet).toHaveBeenCalledWith({
        headers: TEAM_HEADERS,
      });
    });

    it("throws a TeamImpersonationError when the backend refuses the team", async () => {
      const refusal = `Impersonation error: Unknown team ${TEAM_ID}`;
      vi.mocked(listSecretsApiSecretsGet).mockResolvedValue(
        sdkResult(401, { error: { detail: refusal } }),
      );

      const failure = fetchSecretsList(TEAM_ID);

      await expect(failure).rejects.toBeInstanceOf(TeamImpersonationError);
      await expect(failure).rejects.toMatchObject({
        message: refusal,
        status: 401,
      });
    });
  });

  describe("secretsListQuery", () => {
    it("keeps a team's secrets apart from the user's in the cache", () => {
      expect(secretsListQuery().queryKey).toEqual(["secrets", "user"]);
      expect(secretsListQuery(TEAM_ID).queryKey).toEqual([
        "secrets",
        "team",
        TEAM_ID,
      ]);
    });

    it("fetches the secrets of the team its key names", async () => {
      vi.mocked(listSecretsApiSecretsGet).mockResolvedValue(
        sdkResult(200, { data: { secrets: [] } }),
      );

      await secretsListQuery(TEAM_ID).queryFn();

      expect(listSecretsApiSecretsGet).toHaveBeenCalledWith({
        headers: TEAM_HEADERS,
      });
    });
  });

  describe("addSecret", () => {
    it("sends the description and expiry with the team header", async () => {
      vi.mocked(createSecretApiSecretsPost).mockResolvedValue(
        sdkResult(200, { data: {} }),
      );

      await addSecret(
        {
          name: "API_KEY",
          value: "s3cret",
          description: "For the model provider",
          expiresAt: new Date("2026-12-31T23:59:59.999Z"),
        },
        TEAM_ID,
      );

      expect(createSecretApiSecretsPost).toHaveBeenCalledWith({
        query: {
          secret_name: "API_KEY",
          description: "For the model provider",
          expires_at: "2026-12-31T23:59:59.999Z",
        },
        body: { secret_value: "s3cret" },
        headers: TEAM_HEADERS,
      });
    });

    it("carries the backend's reason when it refuses", async () => {
      vi.mocked(createSecretApiSecretsPost).mockResolvedValue(
        sdkResult(409, {
          error: { detail: "Secret API_KEY already exists" },
        }),
      );

      const failure = addSecret({ name: "API_KEY", value: "s3cret" });

      await expect(failure).rejects.toBeInstanceOf(SecretsApiError);
      await expect(failure).rejects.toMatchObject({
        message: "Failed to add secret: Secret API_KEY already exists",
        status: 409,
      });
    });
  });

  describe("updateSecret", () => {
    it("replaces the value, description and expiry with the team header", async () => {
      vi.mocked(updateSecretApiSecretsSecretNamePut).mockResolvedValue(
        sdkResult(200, { data: {} }),
      );

      await updateSecret(
        "API_KEY",
        {
          value: "n3w",
          description: "Rotated",
          expiresAt: new Date("2027-01-31T23:59:59.999Z"),
        },
        TEAM_ID,
      );

      expect(updateSecretApiSecretsSecretNamePut).toHaveBeenCalledWith({
        path: { secret_name: "API_KEY" },
        query: {
          description: "Rotated",
          expires_at: "2027-01-31T23:59:59.999Z",
        },
        body: { secret_value: "n3w" },
        headers: TEAM_HEADERS,
      });
    });
  });

  describe("removeSecret", () => {
    it("removes a team's secret with the team header", async () => {
      vi.mocked(deleteSecretApiSecretsSecretNameDelete).mockResolvedValue(
        sdkResult(200, { data: {} }),
      );

      await removeSecret("API_KEY", TEAM_ID);

      expect(deleteSecretApiSecretsSecretNameDelete).toHaveBeenCalledWith({
        path: { secret_name: "API_KEY" },
        headers: TEAM_HEADERS,
      });
    });

    it("removes the user's own secret without it", async () => {
      vi.mocked(deleteSecretApiSecretsSecretNameDelete).mockResolvedValue(
        sdkResult(200, { data: {} }),
      );

      await removeSecret("API_KEY");

      expect(deleteSecretApiSecretsSecretNameDelete).toHaveBeenCalledWith({
        path: { secret_name: "API_KEY" },
        headers: {},
      });
    });
  });
});
