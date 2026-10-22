import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TeamResolution } from "@/services/teams/types";

import { ActingTeamNotice } from "./ActingTeamNotice";

const team = { id: "ml-team@example.com", label: "ML Research" };

function renderNotice(resolution: TeamResolution) {
  return render(<ActingTeamNotice resolution={resolution} />);
}

describe("ActingTeamNotice", () => {
  it("tells a non-member their runs fall back to them", () => {
    renderNotice({ status: "not-member", team });

    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "You're not in the ML Research workspace",
    );
    expect(screen.getByTitle(team.id)).toHaveTextContent("ML Research");
    expect(
      screen.getByText(/^Runs can act as the workspace to use its secrets\./),
    ).toBeVisible();
    expect(
      screen.getByText(/run as you instead, with your own secrets/),
    ).toBeVisible();
    expect(screen.getByTestId("info-box-warning")).toBeInTheDocument();
  });

  it("says when the backend refuses to act as the team", () => {
    renderNotice({ status: "unavailable", team });

    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "Can't act as the ML Research workspace",
    );
    expect(
      screen.getByText(/run as you instead, with your own secrets/),
    ).toBeVisible();
  });

  it("gives the reason a team couldn't be checked", () => {
    renderNotice({
      status: "error",
      error: new Error("Failed to load workspace ws-1"),
    });

    expect(
      screen.getByText("Couldn't check this project's workspace"),
    ).toBeVisible();
    expect(screen.getByText("Failed to load workspace ws-1")).toBeVisible();
    expect(
      screen.getByText(/Until it's checked, runs you submit/),
    ).toBeVisible();
  });

  it("names the teams of projects that disagree", () => {
    renderNotice({
      status: "conflict",
      teams: [team, { id: "data-team@example.com", label: "Data" }],
    });

    expect(
      screen.getByText("These projects belong to different workspaces"),
    ).toBeVisible();
    expect(screen.getByTestId("info-box-error")).toHaveTextContent(
      "these projects use ML Research and Data.",
    );
    expect(screen.getByTitle("data-team@example.com")).toHaveTextContent(
      "Data",
    );
    expect(screen.getByTestId("info-box-error")).toBeInTheDocument();
  });

  it.each<TeamResolution>([
    { status: "none" },
    { status: "resolving" },
    { status: "active", team: { ...team, canWrite: true } },
  ])("says nothing when the runs act as expected: $status", (resolution) => {
    const { container } = renderNotice(resolution);

    expect(container).toBeEmptyDOMElement();
  });
});
