import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TeamResolution } from "@/services/teams/types";

import { RunIdentitySummary } from "./RunIdentitySummary";

const TEAM = { id: "ml-team@example.com", label: "ML Research" };
const ACTIVE: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

describe("RunIdentitySummary", () => {
  it("names the team the run acts as", () => {
    render(<RunIdentitySummary team={ACTIVE} missingSecrets={[]} />);

    expect(screen.getByText("Runs as Team: ML Research")).toHaveAttribute(
      "title",
      TEAM.id,
    );
  });

  it("says the run falls back to you, and why", () => {
    render(
      <RunIdentitySummary
        team={{ status: "not-member", team: TEAM }}
        missingSecrets={[]}
      />,
    );

    expect(screen.getByText("Runs as you")).toBeVisible();
    expect(
      screen.getByText("You're not in the ML Research team"),
    ).toBeVisible();
  });

  it("says nothing about who runs it outside a team", () => {
    const { container } = render(
      <RunIdentitySummary team={{ status: "none" }} missingSecrets={[]} />,
    );

    expect(container.textContent).toBe("");
  });

  it("warns about a secret the team doesn't have", () => {
    render(<RunIdentitySummary team={ACTIVE} missingSecrets={["API_KEY"]} />);

    expect(
      screen.getByText(
        "API_KEY isn't one of the ML Research team's secrets, so the run will fail when it starts.",
      ),
    ).toBeVisible();
  });

  it("suggests a team's project for secrets you don't have", () => {
    render(
      <RunIdentitySummary
        team={{ status: "none" }}
        missingSecrets={["API_KEY", "DB_PASSWORD"]}
      />,
    );

    expect(
      screen.getByText(
        "API_KEY, DB_PASSWORD aren't in your secrets, so the run will fail when it starts. If it's a team's secret, submit the run from one of that team's projects.",
      ),
    ).toBeVisible();
  });

  it("names your secrets when the run falls back to you", () => {
    render(
      <RunIdentitySummary
        team={{ status: "unavailable", team: TEAM }}
        missingSecrets={["API_KEY"]}
      />,
    );

    expect(
      screen.getByText(
        "API_KEY isn't in your secrets, so the run will fail when it starts.",
      ),
    ).toBeVisible();
  });
});
