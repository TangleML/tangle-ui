import { screen } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LearnHomeView } from "./LearnHomeView";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("<LearnHomeView/>", () => {
  afterEach(cleanup);

  test("renders the page header", () => {
    render(<LearnHomeView />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Learning Hub" }),
    ).toBeInTheDocument();
  });

  test("renders the search bar", () => {
    render(<LearnHomeView />);
    expect(
      screen.getByRole("textbox", { name: /search the tangle docs/i }),
    ).toBeInTheDocument();
  });

  test("renders the onboarding hero with progress", () => {
    render(<LearnHomeView />);
    expect(
      screen.getByRole("heading", { level: 2, name: /welcome to tangle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /onboarding progress/i }),
    ).toBeInTheDocument();
  });

  test("renders the docs quicklinks and full-docs link at the top", () => {
    render(<LearnHomeView />);
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("Schema reference")).toBeInTheDocument();
    expect(screen.getByText("Full docs")).toBeInTheDocument();
  });

  test("renders the tip, tours, examples and FAQ sections", () => {
    render(<LearnHomeView />);
    expect(
      screen.getByRole("heading", { level: 3, name: /tip of the day/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /featured tours/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /example pipelines/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /frequently asked/i }),
    ).toBeInTheDocument();
  });
});
