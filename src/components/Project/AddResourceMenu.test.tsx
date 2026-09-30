import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipelineNames: () => ({
    data: ["Churn model"],
    isPending: false,
    error: null,
  }),
  useResolvedPointers: () => ({ data: {} }),
}));

async function openMenu() {
  const user = userEvent.setup();
  render(<AddResourceMenu projectId="project-1" resources={[]} />);

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

  it("opens the pipeline picker", async () => {
    await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Pipeline" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Add a pipeline",
    );
  });

  /** A session is started with New session, which opens one in Tangent. */
  it("does not offer a session as something to add", async () => {
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: /session/i })).toBeNull();
  });
});
