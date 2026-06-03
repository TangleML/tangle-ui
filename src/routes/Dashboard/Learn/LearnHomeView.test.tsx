import { screen } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
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
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: vi.fn().mockReturnValue({ track: vi.fn() }),
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
      screen.getByRole("textbox", { name: /search the learning hub/i }),
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

  test("renders the tip of the day, tours, examples and documentation sections", () => {
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
      screen.getByRole("heading", { level: 2, name: /documentation/i }),
    ).toBeInTheDocument();
  });
});
