import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DashboardProjectDetailView } from "./DashboardProjectDetailView";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("DashboardProjectDetailView", () => {
  it("tells the user the project page is not built yet", () => {
    render(<DashboardProjectDetailView />);

    expect(screen.getByText("Project page coming soon")).toBeInTheDocument();
  });

  it("offers a way back to the list", () => {
    render(<DashboardProjectDetailView />);

    expect(
      screen.getByRole("link", { name: "Back to projects" }),
    ).toHaveAttribute("href", "/projects");
  });
});
