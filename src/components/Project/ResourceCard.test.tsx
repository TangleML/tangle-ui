import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";

import { ResourceCard } from "./ResourceCard";

const resource: ProjectResourceSummary = {
  id: "resource-1",
  projectId: "project-1",
  entity: "document",
  name: "Model card",
  entityId: null,
  createdBy: "alice@example.com",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
};

function renderCard(overrides: Partial<ProjectResourceSummary> = {}) {
  const onRemove = vi.fn();
  render(
    <ResourceCard
      resource={{ ...resource, ...overrides }}
      onRemove={onRemove}
    />,
  );
  return onRemove;
}

describe("ResourceCard", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  it("shows what the item is, what it is called, and when it arrived", () => {
    renderCard();

    expect(screen.getByText("document")).toBeInTheDocument();
    expect(screen.getByText("Model card")).toBeInTheDocument();
    expect(
      screen.getByText(`Added ${formatDate(resource.createdAt)}`),
    ).toBeInTheDocument();
  });

  it("stands in for a missing name rather than showing a blank card", () => {
    renderCard({ name: null });

    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Item actions: Untitled" }),
    ).toBeInTheDocument();
  });

  it("reads an unfamiliar entity as words", () => {
    renderCard({ entity: "agent_session" });

    expect(screen.getByText("agent session")).toBeInTheDocument();
  });

  it("asks to remove the item it belongs to", async () => {
    const onRemove = renderCard();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Item actions: Model card" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Remove from project/ }),
    );

    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resource-1" }),
    );
  });
});
