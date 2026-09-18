import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Table, TableBody } from "@/components/ui/table";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";

import { ResourceRow } from "./ResourceRow";

const linked: ProjectResourceSummary = {
  id: "resource-1",
  projectId: "project-1",
  entity: "pipeline",
  name: "churn-training",
  entityId: "pipeline-9",
  extraData: null,
  createdBy: "alice@example.com",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
};

const ownContent: Partial<ProjectResourceSummary> = {
  entity: "document",
  name: "Model card",
  entityId: null,
};

const REMOVE = "Remove churn-training from this project";
const DELETE = "Delete Model card";

function renderRow(
  overrides: Partial<ProjectResourceSummary> = {},
  selected = false,
) {
  const onRemove = vi.fn();
  const onSelect = vi.fn();
  render(
    <Table>
      <TableBody>
        <ResourceRow
          resource={{ ...linked, ...overrides }}
          selected={selected}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      </TableBody>
    </Table>,
  );
  return { onRemove, onSelect };
}

describe("ResourceRow", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  it("names the item and dates it", () => {
    renderRow();

    expect(screen.getByText("churn-training")).toBeInTheDocument();
    expect(screen.getByText(formatDate(linked.createdAt))).toBeInTheDocument();
  });

  it("stands in for a missing name rather than showing a blank row", () => {
    renderRow({ name: null });

    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Remove Untitled from this project",
      }),
    ).toBeInTheDocument();
  });

  it("selects the item it belongs to when picked", async () => {
    const { onSelect } = renderRow();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "churn-training" }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resource-1" }),
    );
  });

  it("says which item is being previewed", () => {
    renderRow({}, true);

    expect(
      screen.getByRole("button", { name: "churn-training" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("row")).toHaveAttribute("data-state", "selected");
  });

  it("offers an item it only points at as taking it out, not as a deletion", () => {
    renderRow();

    const remove = screen.getByRole("button", { name: REMOVE });

    expect(remove.querySelector(".lucide-x")).toBeInTheDocument();
    expect(remove.querySelector("[class*='trash']")).toBeNull();
    expect(remove.className).not.toMatch(/text-destructive/);
  });

  it("offers an item that lives nowhere else as the deletion it is", () => {
    renderRow(ownContent);

    const remove = screen.getByRole("button", { name: DELETE });

    expect(remove.querySelector("[class*='trash']")).toBeInTheDocument();
    expect(remove.querySelector(".lucide-x")).toBeNull();
    expect(remove.className).toMatch(/text-destructive/);
  });

  /**
   * A row naming a pipeline in this browser carries no content of its own, so
   * offering it as a deletion would suggest the pipeline is about to go.
   */
  it("does not offer to delete a pipeline it only names", () => {
    renderRow({
      entity: "document",
      name: "Churn model",
      entityId: null,
      extraData: { kind: "pipeline", localName: "Churn model" },
    });

    const remove = screen.getByRole("button", {
      name: "Remove Churn model from this project",
    });

    expect(remove.querySelector(".lucide-x")).toBeInTheDocument();
    expect(remove.querySelector("[class*='trash']")).toBeNull();
  });

  it("keeps saying so when the pipeline it names can no longer be worked out", () => {
    renderRow({
      entity: "document",
      name: "Churn model",
      entityId: null,
      extraData: { kind: "pipeline" },
    });

    expect(
      screen.getByRole("button", {
        name: "Remove Churn model from this project",
      }).className,
    ).not.toMatch(/text-destructive/);
  });

  it("asks to remove the item it belongs to", async () => {
    const { onRemove } = renderRow();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: REMOVE }));

    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resource-1" }),
    );
  });

  it("does not preview an item when the remove button is the thing clicked", async () => {
    const { onSelect } = renderRow();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: REMOVE }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
