import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/services/projects/types";

import { ProjectHeader } from "./ProjectHeader";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Weekly churn scoring",
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 1, document: 1 },
  notes: null,
};

describe("ProjectHeader", () => {
  it("names the project and leads back to the list", () => {
    render(<ProjectHeader project={project} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Churn model" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to projects/ }),
    ).toHaveAttribute("href", "/projects");
  });

  it("never names the workspace a project sits in", () => {
    render(<ProjectHeader project={project} />);

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
