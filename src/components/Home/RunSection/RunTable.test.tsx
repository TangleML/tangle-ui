import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PipelineRunResponse } from "@/api/types.gen";

import { RunTable } from "./RunTable";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => true,
}));
vi.mock("./RunRow", () => ({
  default: ({
    run,
    isSelected,
    onToggleSelected,
  }: {
    run: PipelineRunResponse;
    isSelected: boolean;
    onToggleSelected: (id: string) => void;
  }) => (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${run.id}`}
          checked={isSelected}
          onChange={() => onToggleSelected(run.id)}
        />
      </td>
    </tr>
  ),
}));
vi.mock("./RunBulkActionsBar", () => ({
  default: ({
    selectedRuns,
    onClearSelection,
  }: {
    selectedRuns: string[];
    onClearSelection: () => void;
  }) => (
    <button onClick={onClearSelection}>Clear {selectedRuns.join(", ")}</button>
  ),
}));

const runs: PipelineRunResponse[] = [
  { id: "one", root_execution_id: "first" },
  { id: "two", root_execution_id: "second" },
];

describe("run table selection", () => {
  it("omits headers in compact dashboard sections while retaining row selection", async () => {
    const user = userEvent.setup();
    render(<RunTable runs={runs} responsive showHeader={false} />);
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Select one" }));
    expect(screen.getByRole("checkbox", { name: "Select one" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Clear one" }),
    ).toBeInTheDocument();
  });

  it("selects the page and clears the selection through bulk actions", async () => {
    const user = userEvent.setup();
    render(<RunTable runs={runs} />);
    await user.click(
      screen.getByRole("checkbox", { name: "Select all runs on this page" }),
    );
    expect(screen.getByRole("checkbox", { name: "Select one" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select two" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Clear one, two" }));
    expect(
      screen.getByRole("checkbox", { name: "Select one" }),
    ).not.toBeChecked();
  });

  it("preserves selection owned by the runs screen while the table reloads", async () => {
    function RunsScreen({ loading }: { loading: boolean }) {
      const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
      return loading ? (
        <p>Loading</p>
      ) : (
        <RunTable runs={runs} selection={{ selectedRuns, setSelectedRuns }} />
      );
    }
    const user = userEvent.setup();
    const view = render(<RunsScreen loading={false} />);
    await user.click(screen.getByRole("checkbox", { name: "Select one" }));
    view.rerender(<RunsScreen loading />);
    view.rerender(<RunsScreen loading={false} />);
    expect(screen.getByRole("checkbox", { name: "Select one" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Clear one" }),
    ).toBeInTheDocument();
  });
});
