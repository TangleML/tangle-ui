import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddResourceMenu } from "./AddResourceMenu";

vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

async function openMenu() {
  const user = userEvent.setup();
  render(<AddResourceMenu projectId="project-1" />);

  await user.click(screen.getByRole("button", { name: /Add/ }));
  await screen.findByRole("menu");

  return user;
}

describe("AddResourceMenu", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  it("opens the document form", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Document" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Add Document");
  });

  it("shows what cannot be added here yet instead of hiding it", async () => {
    await openMenu();

    expect(screen.getByText("Not yet available here")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Pipeline" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("menuitem", { name: "Agent session" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
