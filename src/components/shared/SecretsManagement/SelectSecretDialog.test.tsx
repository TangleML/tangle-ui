import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";
import { useActingTeam } from "@/services/teams/useActingTeam";

import { SelectSecretDialog } from "./SelectSecretDialog";
import type { Secret } from "./types";

const { fetchSecrets } = vi.hoisted(() => ({ fetchSecrets: vi.fn() }));

vi.mock("./secretsStorage", () => ({
  secretsListQuery: (teamId?: string) => ({
    queryKey: ["secrets", teamId ?? "user"],
    queryFn: () => fetchSecrets(teamId),
  }),
  addSecret: vi.fn(),
  updateSecret: vi.fn(),
}));

vi.mock("@/services/teams/useActingTeam", () => ({ useActingTeam: vi.fn() }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: true }),
}));

vi.mock("@/providers/TourProvider/tourMockBackend", () => ({
  useTourMockBackend: () => false,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

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

describe("SelectSecretDialog", () => {
  beforeEach(() => {
    vi.mocked(useActingTeam).mockReturnValue({ status: "none" });
    fetchSecrets.mockResolvedValue([secret("API_KEY")]);
  });

  afterEach(() => vi.clearAllMocks());

  it("offers the secrets of the page's team", async () => {
    vi.mocked(useActingTeam).mockReturnValue({
      status: "active",
      team: { ...TEAM, canWrite: true },
    });
    const { user, onSelect } = renderDialog();

    await user.click(await screen.findByText("API_KEY"));

    expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);
    expect(screen.getByTestId("team-secrets-heading")).toHaveTextContent(
      "The ML Research team's secrets",
    );
    expect(screen.getByTitle(TEAM.id)).toHaveTextContent("ML Research");
    expect(onSelect).toHaveBeenCalledWith("API_KEY");
  });

  it("offers the secrets of the team it is given instead of the page's", async () => {
    renderDialog({
      status: "active",
      team: { id: "data-team@example.com", label: "Data", canWrite: true },
    });

    expect(await screen.findByText("API_KEY")).toBeVisible();
    expect(fetchSecrets).toHaveBeenCalledWith("data-team@example.com");
    expect(useActingTeam).not.toHaveBeenCalled();
  });

  it("offers your own secrets outside a team", async () => {
    renderDialog();

    expect(await screen.findByText("API_KEY")).toBeVisible();
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId("team-secrets-heading")).toBeNull();
  });

  it("explains a fallback to your own secrets", async () => {
    renderDialog({ status: "not-member", team: TEAM });

    expect(await screen.findByText("API_KEY")).toBeVisible();
    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "You're not in the ML Research team",
    );
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
  });

  it("adds a secret to the team", async () => {
    const { user } = renderDialog({
      status: "active",
      team: { ...TEAM, canWrite: true },
    });

    await user.click(await screen.findByTestId("select-secret-add-button"));

    expect(screen.getByText("Add a team secret")).toBeVisible();
    expect(
      screen.getByText(/can use it in this project/).closest("p"),
    ).toHaveTextContent("Everyone in ML Research can use it in this project.");
  });

  it("offers no way to add a secret to a team you can't change", async () => {
    renderDialog({ status: "active", team: { ...TEAM, canWrite: false } });

    expect(await screen.findByText("API_KEY")).toBeVisible();
    expect(screen.queryByTestId("select-secret-add-button")).toBeNull();
  });

  it("offers nothing for projects on different teams", () => {
    renderDialog({
      status: "conflict",
      teams: [TEAM, { id: "data-team@example.com", label: "Data" }],
    });

    expect(
      screen.getByText("These projects belong to different teams"),
    ).toBeVisible();
    expect(fetchSecrets).not.toHaveBeenCalled();
  });
});
