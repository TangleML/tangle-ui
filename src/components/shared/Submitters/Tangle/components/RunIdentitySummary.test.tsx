import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  type RunAs,
  runAsFor,
  type RunIdentity,
  runIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import type { TeamResolution } from "@/services/teams/types";

import { RunIdentitySummary } from "./RunIdentitySummary";

const TEAM = { id: "ml-team@example.com", label: "ML Research" };
const ACTIVE: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

const named = (...names: string[]) => names.map((name) => ({ name }));

function teamIdentity(referenced: string[], yours: string[], teams: string[]) {
  return runIdentity({
    team: TEAM,
    referenced,
    yourSecrets: named(...yours),
    teamSecrets: named(...teams),
  });
}

function renderSummary({
  team = ACTIVE,
  identity,
  runAs = runAsFor(identity),
}: {
  team?: TeamResolution;
  identity: RunIdentity;
  runAs?: RunAs;
}) {
  const onRunAsChange = vi.fn();
  const view = render(
    <RunIdentitySummary
      team={team}
      identity={identity}
      runAs={runAs}
      onRunAsChange={onRunAsChange}
    />,
  );
  return { ...view, onRunAsChange, user: userEvent.setup() };
}

describe("RunIdentitySummary", () => {
  it("runs as you by default and offers the team", async () => {
    const { user, onRunAsChange } = renderSummary({
      identity: teamIdentity([], [], []),
    });

    const choice = screen.getByRole("radiogroup", { name: "Run as" });
    expect(within(choice).getByRole("radio", { name: "You" })).toBeChecked();
    const asTeam = within(choice).getByRole("radio", {
      name: "Workspace: ML Research",
    });
    expect(asTeam).not.toBeChecked();

    await user.click(asTeam);
    expect(onRunAsChange).toHaveBeenCalledWith("team");
  });

  it("goes as the team, and says why, when only the team has a secret", () => {
    renderSummary({
      identity: teamIdentity(["API_KEY"], [], ["API_KEY"]),
    });

    expect(screen.getByRole("radio", { name: "You" })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "Workspace: ML Research" }),
    ).toBeChecked();
    expect(screen.getByTestId("run-as-team-reason")).toHaveTextContent(
      "Only the ML Research workspace has API_KEY, so the run goes as the workspace.",
    );
    expect(screen.queryByTestId("info-box-warning")).toBeNull();
  });

  it("points to the team for a secret only it has", () => {
    renderSummary({
      identity: teamIdentity(["API_KEY", "GONE"], [], ["API_KEY"]),
      runAs: "you",
    });

    expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
      "API_KEY isn't in your secrets; the ML Research workspace has it. GONE isn't in your secrets, so the run will fail when it starts.",
    );
  });

  it("points to your secrets when the team lacks one you have", () => {
    renderSummary({
      identity: teamIdentity(["MY_KEY"], ["MY_KEY"], []),
      runAs: "team",
    });

    expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
      "MY_KEY isn't in the ML Research workspace's secrets; you have it.",
    );
  });

  it("says which secrets are on which side when neither has them all", () => {
    renderSummary({
      identity: teamIdentity(
        ["TEST_PERSONAL", "Test", "GONE"],
        ["TEST_PERSONAL"],
        ["Test"],
      ),
    });

    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "Secrets split between you and the workspace",
    );
    expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
      "TEST_PERSONAL is only in your secrets, and Test is only in the ML Research workspace's, so the run will fail whichever it runs as. GONE isn't in either. Add the missing secrets to one of them.",
    );
  });

  it("says the run falls back to you, and why", () => {
    renderSummary({
      team: { status: "not-member", team: TEAM },
      identity: runIdentity({ team: undefined, referenced: [] }),
    });

    expect(screen.getByText("Runs as you")).toBeVisible();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "You're not in the ML Research workspace",
    );
  });

  it("says nothing about who runs it outside a team", () => {
    const { container } = renderSummary({
      team: { status: "none" },
      identity: runIdentity({ team: undefined, referenced: [] }),
    });

    expect(container.textContent).toBe("");
  });

  it("suggests a team's project for secrets you don't have", () => {
    renderSummary({
      team: { status: "none" },
      identity: runIdentity({
        team: undefined,
        referenced: ["API_KEY", "DB_PASSWORD"],
        yourSecrets: [],
      }),
    });

    expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
      "API_KEY, DB_PASSWORD aren't in your secrets, so the run will fail when it starts. If it's a workspace's secret, submit the run from one of that workspace's projects.",
    );
  });

  it("names your secrets when the run falls back to you", () => {
    renderSummary({
      team: { status: "unavailable", team: TEAM },
      identity: runIdentity({
        team: undefined,
        referenced: ["API_KEY"],
        yourSecrets: [],
      }),
    });

    expect(
      screen
        .getByText("Missing secrets")
        .closest('[data-testid="info-box-warning"]'),
    ).toHaveTextContent(
      "API_KEY isn't in your secrets, so the run will fail when it starts.",
    );
  });

  it("names each missing secret in bold after a lock", () => {
    renderSummary({
      team: { status: "none" },
      identity: runIdentity({
        team: undefined,
        referenced: ["API_KEY", "DB_PASSWORD"],
        yourSecrets: [],
      }),
    });

    for (const name of ["API_KEY", "DB_PASSWORD"]) {
      const secret = screen.getByText(name);
      expect(secret).toHaveClass("font-semibold");
      expect(secret.querySelector("svg.lucide-lock")).not.toBeNull();
    }
  });
});
