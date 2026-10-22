import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Secret } from "@/components/shared/SecretsManagement/types";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

import { SecretFormDialog } from "./SecretFormDialog";
import { SecretsWindowContent } from "./SecretsWindowContent";

const { fetchSecrets, open } = vi.hoisted(() => ({
  fetchSecrets: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/services/teams/useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(),
}));

vi.mock("@/components/shared/SecretsManagement/secretsStorage", async () => {
  const { SecretsQueryKeys } =
    await import("@/components/shared/SecretsManagement/types");
  return {
    secretsListQuery: (teamId?: string) => ({
      queryKey: SecretsQueryKeys.All(teamId),
      queryFn: () => fetchSecrets(teamId),
    }),
    removeSecret: vi.fn(),
  };
});

vi.mock("@/providers/DialogProvider/hooks/useDialog", () => ({
  useDialog: () => ({ open }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const TEAM = { id: "ml-team@example.com", label: "ML Research" };

const secret = (name: string, overrides: Partial<Secret> = {}): Secret => ({
  id: name,
  name,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
  ...overrides,
});

function givenTeam(resolution: TeamResolution) {
  vi.mocked(useTeamForProjects).mockReturnValue(resolution);
}

function renderWindow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<SecretsWindowContent />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return userEvent.setup();
}

describe("SecretsWindowContent", () => {
  beforeEach(() => {
    fetchSecrets.mockResolvedValue([]);
    open.mockResolvedValue(undefined);
    givenTeam({ status: "active", team: { ...TEAM, canWrite: true } });
  });

  afterEach(() => vi.clearAllMocks());

  it("asks for the team of the Tangent project", () => {
    renderWindow();

    expect(useTeamForProjects).toHaveBeenCalledWith(["project-1"]);
  });

  describe("in a team's project", () => {
    it("lists the team's secrets under its name", async () => {
      fetchSecrets.mockResolvedValue([
        secret("API_KEY", { description: "Model access" }),
      ]);

      renderWindow();

      expect(await screen.findByText("API_KEY")).toBeVisible();
      expect(screen.getByText("Model access")).toBeVisible();
      expect(screen.getByText("Workspace: ML Research")).toHaveAttribute(
        "title",
        TEAM.id,
      );
      expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);
    });

    it("adds a secret to the team", async () => {
      const user = renderWindow();

      await user.click(
        await screen.findByRole("button", { name: "Add a secret" }),
      );

      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          component: SecretFormDialog,
          props: {
            secret: undefined,
            team: { ...TEAM, canWrite: true },
          },
        }),
      );
    });

    it("replaces one of the team's secrets", async () => {
      const apiKey = secret("API_KEY");
      fetchSecrets.mockResolvedValue([apiKey]);
      const user = renderWindow();

      await user.click(
        await screen.findByRole("button", { name: "Replace API_KEY" }),
      );

      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          props: { secret: apiKey, team: { ...TEAM, canWrite: true } },
        }),
      );
      expect(
        screen.getByRole("button", { name: "Delete API_KEY" }),
      ).toBeVisible();
    });

    it("says when the team has no secrets", async () => {
      renderWindow();

      expect(await screen.findByText("No workspace secrets yet")).toBeVisible();
    });
  });

  it("only lists a team's secrets to a member who can't change them", async () => {
    givenTeam({ status: "active", team: { ...TEAM, canWrite: false } });
    fetchSecrets.mockResolvedValue([secret("API_KEY")]);

    renderWindow();

    expect(await screen.findByText("API_KEY")).toBeVisible();
    expect(
      screen.getByText(/Your role in the workspace can't change them/),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add a secret" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Replace API_KEY" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete API_KEY" })).toBeNull();
  });

  describe("when you can't act as the project's workspace", () => {
    it.each<TeamResolution>([
      { status: "not-member", team: TEAM },
      { status: "unavailable", team: TEAM },
      { status: "error", error: new Error("backend down") },
    ])(
      "says its secrets aren't available and lists none ($status)",
      (resolution) => {
        givenTeam(resolution);

        renderWindow();

        expect(screen.getByTestId("info-box-title")).toHaveTextContent(
          "Workspace secrets aren't available",
        );
        expect(
          screen.queryByRole("button", { name: "Add a secret" }),
        ).toBeNull();
        expect(fetchSecrets).not.toHaveBeenCalled();
      },
    );

    it("tells a non-member to ask for access", () => {
      givenTeam({ status: "not-member", team: TEAM });

      renderWindow();

      expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
        "You're not in the ML Research workspace. Ask an admin to add you.",
      );
    });

    it("says when the backend refuses to act as the workspace", () => {
      givenTeam({ status: "unavailable", team: TEAM });

      renderWindow();

      expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
        "The backend didn't let you act as the ML Research workspace.",
      );
    });

    it("gives the reason the workspace couldn't be checked", () => {
      givenTeam({
        status: "error",
        error: new Error("Failed to load workspace ws-1"),
      });

      renderWindow();

      expect(
        screen.getByText(
          "Couldn't check your access to this project's workspace: Failed to load workspace ws-1",
        ),
      ).toBeVisible();
    });
  });

  it("shows nothing in a project whose workspace has no team", () => {
    givenTeam({ status: "none" });

    renderWindow();

    expect(screen.queryByTestId("info-box-warning")).toBeNull();
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("waits for the team before listing anything", () => {
    givenTeam({ status: "resolving" });

    renderWindow();

    expect(screen.getByText("Loading...")).toBeVisible();
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("says why the secrets couldn't be listed", async () => {
    fetchSecrets.mockRejectedValue(
      new Error("Failed to fetch secrets: backend down"),
    );

    renderWindow();

    await waitFor(() =>
      expect(
        screen.getByText("Failed to fetch secrets: backend down"),
      ).toBeVisible(),
    );
  });
});
