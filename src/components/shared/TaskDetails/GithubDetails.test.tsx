import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GithubDetails } from "./GithubDetails";

describe("GithubDetails", () => {
  it("renders raw component URL without throwing when the GitHub directory URL cannot be derived", () => {
    expect(() =>
      render(<GithubDetails url="https://github.com/user/repo" />),
    ).not.toThrow();

    expect(
      screen.getByRole("link", { name: "View raw component.yaml" }),
    ).toHaveAttribute("href", "https://github.com/user/repo");
    expect(
      screen.queryByRole("link", { name: "View directory on GitHub" }),
    ).not.toBeInTheDocument();
  });

  it("renders canonical URL without throwing when it is not a GitHub file URL", () => {
    expect(() =>
      render(
        <GithubDetails canonicalUrl="https://example.com/component.yaml" />,
      ),
    ).not.toThrow();

    expect(
      screen.getByRole("link", { name: "View canonical URL" }),
    ).toHaveAttribute("href", "https://example.com/component.yaml");
    expect(
      screen.queryByRole("link", { name: "View canonical URL on GitHub" }),
    ).not.toBeInTheDocument();
  });
});
