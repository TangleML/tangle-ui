import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Table, TableBody } from "@/components/ui/table";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";

import { ResourceRow } from "./ResourceRow";

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
          resource={{ ...resource, ...overrides }}
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

    expect(screen.getByText("Model card")).toBeInTheDocument();
    expect(
      screen.getByText(formatDate(resource.createdAt)),
    ).toBeInTheDocument();
  });

  it("stands in for a missing name rather than showing a blank row", () => {
    renderRow({ name: null });

    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Item actions: Untitled" }),
    ).toBeInTheDocument();
  });

  it("selects the item it belongs to when picked", async () => {
    const { onSelect } = renderRow();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Model card" }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resource-1" }),
    );
  });

  it("says which item is being previewed", () => {
    renderRow({}, true);

    expect(screen.getByRole("button", { name: "Model card" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("row")).toHaveAttribute("data-state", "selected");
  });

  it("asks to remove the item it belongs to", async () => {
    const { onRemove } = renderRow();
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
