import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import type { ProjectSummary } from "@/services/projects/types";
import { useAllProjects } from "@/services/projects/useAllProjects";
import { getUserDetails } from "@/utils/user";

import { AllProjectsSection } from "./AllProjectsSection";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useAllProjects", () => ({
  useAllProjects: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/utils/user", () => ({
  getUserDetails: vi.fn(),
}));

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "project-1",
    workspaceId: "workspace-1",
    name: "Churn model",
    description: null,
    createdBy: "alice@example.com",
    origin: "user",
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
    resourceCounts: {},
    ...overrides,
  };
}

const PROJECTS = [
  makeProject({ id: "a", name: "Churn model", createdBy: "alice@example.com" }),
  makeProject({ id: "b", name: "Fraud signals", createdBy: "bob@example.com" }),
];

function mockBackend(
  overrides: Partial<ReturnType<typeof useBackend>> = {},
): void {
  vi.mocked(useBackend).mockReturnValue({
    configured: true,
    available: true,
    ready: true,
    ...overrides,
  } as ReturnType<typeof useBackend>);
}

function mockAllProjects(
  overrides: Partial<ReturnType<typeof useAllProjects>> = {},
): void {
  vi.mocked(useAllProjects).mockReturnValue({
    data: {
      items: PROJECTS,
      totalCount: PROJECTS.length,
      reachedPageLimit: false,
    },
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useAllProjects>);
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AllProjectsSection />
    </QueryClientProvider>,
  );
}

describe("AllProjectsSection", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "alice@example.com",
      permissions: ["read", "write"],
    });
    mockBackend();
    mockAllProjects();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists everyone's projects, not just the current user's", async () => {
    renderSection();

    expect(await screen.findByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Fraud signals")).toBeInTheDocument();
  });

  it("names the author on every card", async () => {
    renderSection();

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("says how many projects there are", async () => {
    renderSection();

    expect(await screen.findByText("2 projects")).toBeInTheDocument();
  });

  it("narrows the grid as a name is searched for", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByLabelText("Search by project name"),
      "fraud",
    );

    await waitFor(() => {
      expect(screen.queryByText("Churn model")).toBeNull();
    });
    expect(screen.getByText("Fraud signals")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 projects")).toBeInTheDocument();
  });

  it("filters down to one author", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByPlaceholderText("Search by user..."),
      "bob@",
    );

    await waitFor(() => {
      expect(screen.queryByText("Churn model")).toBeNull();
    });
    expect(screen.getByText("Fraud signals")).toBeInTheDocument();
  });

  it("filters to the current user through the Me shortcut", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "Me" }));

    await waitFor(() => {
      expect(screen.queryByText("Fraud signals")).toBeNull();
    });
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  it("says so when the filters leave nothing", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByLabelText("Search by project name"),
      "nothing matches this",
    );

    expect(
      await screen.findByText("No projects match these filters."),
    ).toBeInTheDocument();
  });

  it("puts the grid back when the filters are cleared", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByLabelText("Search by project name"),
      "fraud",
    );
    await waitFor(() => expect(screen.queryByText("Churn model")).toBeNull());

    await user.click(screen.getByRole("button", { name: /Clear all/ }));

    expect(await screen.findByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Fraud signals")).toBeInTheDocument();
  });

  it("offers a way to drop a single filter", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByLabelText("Search by project name"),
      "fraud",
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Remove Name: fraud filter",
      }),
    );

    expect(await screen.findByText("Churn model")).toBeInTheDocument();
  });

  it("waits on the projects rather than showing an empty grid", () => {
    mockAllProjects({ data: undefined, isPending: true });
    renderSection();

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("reports a failure to load", () => {
    mockAllProjects({
      data: undefined,
      isPending: false,
      error: new Error("backend exploded"),
    } as Partial<ReturnType<typeof useAllProjects>>);
    renderSection();

    expect(screen.getByText("backend exploded")).toBeInTheDocument();
  });

  it("says when nobody has created a project", () => {
    mockAllProjects({
      data: { items: [], totalCount: 0, reachedPageLimit: false },
    });
    renderSection();

    expect(
      screen.getByText("No projects have been created yet."),
    ).toBeInTheDocument();
  });

  it("admits when it has not searched every project", async () => {
    mockAllProjects({
      data: { items: PROJECTS, totalCount: 900, reachedPageLimit: true },
    });
    renderSection();

    expect(
      await screen.findByText(
        "Searching the 2 most recently updated projects of 900.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps quiet about every project when there is no backend", () => {
    mockBackend({ configured: false });
    renderSection();

    expect(screen.queryByText("All Projects")).toBeNull();
  });

  it("keeps quiet while the backend is still being probed", () => {
    mockBackend({ ready: false });
    renderSection();

    expect(screen.queryByText("All Projects")).toBeNull();
  });

  it("says nothing about the workspace a project lives in", async () => {
    renderSection();

    await screen.findByText("Churn model");

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
