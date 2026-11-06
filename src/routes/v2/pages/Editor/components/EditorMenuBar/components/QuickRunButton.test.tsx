import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RunIdentity,
  runIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import { useRunIdentity } from "@/components/shared/SecretsManagement/useRunIdentity";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";

import { QuickRunButton } from "./QuickRunButton";

const rootSpec = {
  allValidationIssues: [] as { severity: "error" | "warning" }[],
  inputs: [],
  isValid: true,
};

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: { rootSpec } }),
}));

vi.mock("@/routes/v2/pages/Editor/components/QuickRunSubmitterContext", () => ({
  useQuickRunSubmitter: () => ({
    submitRun: vi.fn(),
    submitWithArguments: vi.fn(),
  }),
}));

vi.mock("@/models/componentSpec", () => ({
  serializeComponentSpec: () => ({}),
}));

vi.mock("@/components/Project/useRunProjectContext", () => ({
  useRunProjectContext: () => ({ projectIds: ["research-project"] }),
}));

vi.mock("@/services/teams/useTeamForSubmission", () => ({
  useTeamForSubmission: vi.fn(),
}));

vi.mock("@/components/shared/SecretsManagement/useRunIdentity", () => ({
  useRunIdentity: vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const researchTeam: TeamResolution = {
  status: "active",
  team: { id: "research@example.com", label: "Research", canWrite: true },
};

const TEAM_ONLY_SECRET = runIdentity({
  team: { id: "research@example.com", label: "Research" },
  referenced: ["Test"],
  yourSecrets: [],
  teamSecrets: [{ name: "Test" }],
});

function renderButton(
  resolution: TeamResolution,
  variant: "menubar" | "mini" = "menubar",
  identity: RunIdentity = TEAM_ONLY_SECRET,
  isChecking = false,
) {
  vi.mocked(useTeamForSubmission).mockReturnValue(resolution);
  vi.mocked(useRunIdentity).mockReturnValue({ ...identity, isChecking });
  return render(<QuickRunButton variant={variant} />);
}

describe("QuickRunButton", () => {
  beforeEach(() => {
    rootSpec.allValidationIssues = [];
  });

  afterEach(() => vi.clearAllMocks());

  it("says a run goes as the page's team when only the team has its secrets", async () => {
    const user = userEvent.setup();
    renderButton(researchTeam);

    expect(useTeamForSubmission).toHaveBeenCalledWith(["research-project"]);
    expect(useRunIdentity).toHaveBeenCalledWith(researchTeam, [{}]);
    expect(screen.getByTestId("quick-run-team-badge")).toBeInTheDocument();

    await user.hover(screen.getByRole("button"));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Submit run as Research");
    expect(
      within(tooltip).getByTitle("research@example.com"),
    ).toBeInTheDocument();
  });

  it("names the team in the mini button's label", () => {
    renderButton(researchTeam, "mini");

    expect(
      screen.getByRole("button", {
        name: "Submit run as the Research workspace",
      }),
    ).toBeInTheDocument();
  });

  it("marks nothing in a team's project when the run goes as you", () => {
    renderButton(
      researchTeam,
      "mini",
      runIdentity({ team: researchTeam.team, referenced: [] }),
    );

    expect(screen.queryByTestId("quick-run-team-badge")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Submit Run" }),
    ).toBeInTheDocument();
  });

  it("marks nothing outside a team", () => {
    renderButton(
      { status: "none" },
      "mini",
      runIdentity({ team: undefined, referenced: [] }),
    );

    expect(screen.queryByTestId("quick-run-team-badge")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Submit Run" }),
    ).toBeInTheDocument();
  });

  it("keeps the warning in the label while still marking the team", () => {
    rootSpec.allValidationIssues = [{ severity: "warning" }];
    renderButton(researchTeam, "mini");

    expect(screen.getByTestId("quick-run-team-badge")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pipeline has validation warnings" }),
    ).toBeInTheDocument();
  });

  it.each<[string, TeamResolution, boolean, string]>([
    [
      "the project's workspace is being checked",
      { status: "resolving" },
      false,
      "Checking this project's workspace",
    ],
    [
      "the run's projects are on different workspaces",
      {
        status: "conflict",
        teams: [researchTeam.team, { id: "data@example.com", label: "Data" }],
      },
      false,
      "This run's projects belong to different workspaces",
    ],
    [
      "the run's secrets are being checked",
      researchTeam,
      true,
      "Checking the run's secrets",
    ],
  ])("waits, and says why, while %s", (_, resolution, isChecking, reason) => {
    renderButton(
      resolution,
      "mini",
      runIdentity({ team: undefined, referenced: [] }),
      isChecking,
    );

    expect(screen.getByRole("button", { name: reason })).toBeDisabled();
  });

  it("marks no team on a pipeline that can't be submitted", () => {
    rootSpec.allValidationIssues = [{ severity: "error" }];
    renderButton(researchTeam, "mini");

    expect(screen.queryByTestId("quick-run-team-badge")).toBeNull();
  });
});
