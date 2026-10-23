import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeamName } from "./TeamName";

describe("TeamName", () => {
  it("names the team, with its id on hover", () => {
    render(
      <TeamName team={{ id: "ml-team@example.com", label: "ML Research" }} />,
    );

    expect(screen.getByTitle("ml-team@example.com")).toHaveTextContent(
      "ML Research",
    );
  });
});
