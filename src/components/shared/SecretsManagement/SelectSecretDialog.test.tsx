import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";
import { useActingTeam } from "@/services/teams/useActingTeam";

import { addSecret } from "./secretsStorage";
import { SelectSecretDialog } from "./SelectSecretDialog";
import type { Secret } from "./types";

const { fetchSecrets } = vi.hoisted(() => ({ fetchSecrets: vi.fn() }));

vi.mock("./secretsStorage", async () => {
  const { SecretsQueryKeys } = await import("./types");
  return {
    secretsListQuery: (teamId?: string) => ({
      queryKey: SecretsQueryKeys.All(teamId),
      queryFn: () => fetchSecrets(teamId),
    }),
    addSecret: vi.fn(),
    updateSecret: vi.fn(),
  };
});

vi.mock("@/services/teams/useActingTeam", () => ({ useActingTeam: vi.fn() }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: true }),
}));

vi.mock("@/providers/TourProvider/tourMockBackend", () => ({
  useTourMockBackend: () => false,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

const TEAM = { id: "ml-team@example.com", label: "ML Research" };

const secret = (name: string): Secret => ({
  id: name,
  name,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
});

function renderDialog(team?: TeamResolution) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onSelect = vi.fn();
  render(
    <SelectSecretDialog
      open
      onOpenChange={vi.fn()}
      onSelect={onSelect}
      team={team}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
  return { user: userEvent.setup(), onSelect };
}

async function addSecretNamed(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.type(screen.getByLabelText("Secret Name"), name);
  await user.type(screen.getByLabelText("Secret Value"), "s3cret");
  await user.click(screen.getByTestId("add-secret-submit-button"));
  await waitFor(() => expect(addSecret).toHaveBeenCalled());
}

const ACTIVE: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

describe("SelectSecretDialog", () => {
  beforeEach(() => {
    vi.mocked(useActingTeam).mockReturnValue({ status: "none" });
    vi.mocked(addSecret).mockResolvedValue(true);
    fetchSecrets.mockImplementation(async (teamId?: string) =>
      teamId ? [secret("TEAM_KEY")] : [secret("MY_KEY")],
    );
  });

  afterEach(() => vi.clearAllMocks());

  it("offers your secrets and the page's team's, apart", async () => {
    vi.mocked(useActingTeam).mockReturnValue(ACTIVE);
    const { user, onSelect } = renderDialog();

    const teamGroup = await screen.findByTestId("team-secrets");
    const yourGroup = screen.getByTestId("your-secrets");
    expect(yourGroup).toHaveTextContent("Your secrets");
    expect(within(yourGroup).getByText("MY_KEY")).toBeVisible();
    expect(within(yourGroup).queryByText("TEAM_KEY")).toBeNull();
    expect(
      within(teamGroup).getByText("The ML Research workspace's secrets"),
    ).toHaveAttribute("title", TEAM.id);
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
    expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);

    await user.click(within(teamGroup).getByText("TEAM_KEY"));
    expect(onSelect).toHaveBeenCalledWith("TEAM_KEY");
  });

  it("offers the secrets of the team it is given instead of the page's", async () => {
    renderDialog({
      status: "active",
      team: { id: "data-team@example.com", label: "Data", canWrite: true },
    });

    expect(await screen.findByText("TEAM_KEY")).toBeVisible();
    expect(fetchSecrets).toHaveBeenCalledWith("data-team@example.com");
    expect(useActingTeam).not.toHaveBeenCalled();
  });

  it("offers your own secrets outside a team", async () => {
    renderDialog();

    expect(await screen.findByText("MY_KEY")).toBeVisible();
    expect(fetchSecrets).toHaveBeenCalledTimes(1);
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId("team-secrets")).toBeNull();
    expect(screen.queryByTestId("your-secrets-heading")).toBeNull();
  });

  it("explains a fallback to your own secrets", async () => {
    renderDialog({ status: "not-member", team: TEAM });

    expect(await screen.findByText("MY_KEY")).toBeVisible();
    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "You're not in the ML Research workspace",
    );
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
  });

  it("saves a new secret to your own by default", async () => {
    const { user } = renderDialog(ACTIVE);

    await user.click(await screen.findByTestId("select-secret-add-button"));

    expect(screen.getByRole("radio", { name: "Your secrets" })).toBeChecked();
    expect(screen.queryByTestId("save-to-team-hint")).toBeNull();

    await addSecretNamed(user, "API_KEY");
    expect(addSecret).toHaveBeenCalledWith(
      expect.objectContaining({ name: "API_KEY" }),
      undefined,
    );
  });

  it("saves a new secret to the page's team when you choose it", async () => {
    vi.mocked(useActingTeam).mockReturnValue(ACTIVE);
    const { user } = renderDialog();

    await user.click(await screen.findByTestId("select-secret-add-button"));
    await user.click(
      screen.getByRole("radio", {
        name: "The ML Research workspace's secrets",
      }),
    );

    expect(screen.getByTestId("save-to-team-hint")).toHaveTextContent(
      "Everyone in ML Research can use it in this project.",
    );

    await addSecretNamed(user, "API_KEY");
    expect(addSecret).toHaveBeenCalledWith(
      expect.objectContaining({ name: "API_KEY" }),
      TEAM.id,
    );
  });

  it("saves only to your own secrets in a team you can't change", async () => {
    const { user } = renderDialog({
      status: "active",
      team: { ...TEAM, canWrite: false },
    });

    await user.click(await screen.findByTestId("select-secret-add-button"));
    expect(screen.queryByRole("radiogroup")).toBeNull();

    await addSecretNamed(user, "API_KEY");
    expect(addSecret).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it("offers no choice of where to save outside a team", async () => {
    const { user } = renderDialog();

    await user.click(await screen.findByTestId("select-secret-add-button"));

    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("offers nothing for projects on different teams", () => {
    renderDialog({
      status: "conflict",
      teams: [TEAM, { id: "data-team@example.com", label: "Data" }],
    });

    expect(
      screen.getByText("These projects belong to different workspaces"),
    ).toBeVisible();
    expect(fetchSecrets).not.toHaveBeenCalled();
  });
});
