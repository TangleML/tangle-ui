import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LearnHomeView } from "./LearnHomeView";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
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

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: false, backendUrl: "" }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithClient = (component: ReactElement) =>
  render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );

describe("<LearnHomeView/>", () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  test("renders the page header", () => {
    renderWithClient(<LearnHomeView />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Learning Hub" }),
    ).toBeInTheDocument();
  });

  test("renders the search bar", () => {
    renderWithClient(<LearnHomeView />);
    expect(
      screen.getByRole("textbox", { name: /search the tangle docs/i }),
    ).toBeInTheDocument();
  });

  test.skip("renders the onboarding hero with progress", () => {
    renderWithClient(<LearnHomeView />);
    expect(
      screen.getByRole("heading", { level: 2, name: /welcome to tangle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /onboarding progress/i }),
    ).toBeInTheDocument();
  });

  test("renders the docs quicklinks and full-docs link at the top", () => {
    renderWithClient(<LearnHomeView />);
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("Schema reference")).toBeInTheDocument();
    expect(screen.getByText("Full docs")).toBeInTheDocument();
  });

  test("renders the tip, examples and FAQ sections", () => {
    renderWithClient(<LearnHomeView />);
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
