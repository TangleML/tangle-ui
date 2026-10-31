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

  it("emboldens the name and its icon when asked", () => {
    render(
      <TeamName
        team={{ id: "ml-team@example.com", label: "ML Research" }}
        bold
      />,
    );

    const name = screen.getByTitle("ml-team@example.com");
    expect(name).toHaveClass("font-semibold");
    expect(name.querySelector("svg")).toHaveAttribute("stroke-width", "3");
  });

  it("uses the icon's regular stroke by default", () => {
    render(
      <TeamName team={{ id: "ml-team@example.com", label: "ML Research" }} />,
    );

    const name = screen.getByTitle("ml-team@example.com");
    expect(name).not.toHaveClass("font-semibold");
    expect(name.querySelector("svg")).toHaveAttribute("stroke-width", "2");
  });
});
