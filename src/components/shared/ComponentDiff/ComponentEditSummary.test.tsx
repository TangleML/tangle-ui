import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EntityDiff } from "@/utils/componentSpecDiff";

import { ComponentEditSummary } from "./ComponentEditSummary";

const empty: EntityDiff<{ name: string }> = {
  lostEntities: [],
  newEntities: [],
  changedEntities: [],
};

const BREAKING = "Some inputs or outputs will be removed";

describe("ComponentEditSummary", () => {
  it("shows the breaking-change warning and removed input when inputs are lost", () => {
    render(
      <ComponentEditSummary
        inputDiff={{ ...empty, lostEntities: [{ name: "threshold" }] }}
        outputDiff={empty}
      />,
    );

    expect(screen.getByText(new RegExp(BREAKING))).toBeInTheDocument();
    expect(screen.getByText("Removed: threshold")).toBeInTheDocument();
  });

  it("omits the breaking-change warning when nothing is removed", () => {
    render(
      <ComponentEditSummary
        inputDiff={{ ...empty, newEntities: [{ name: "max_rows" }] }}
        outputDiff={empty}
      />,
    );

    expect(screen.queryByText(new RegExp(BREAKING))).not.toBeInTheDocument();
    expect(screen.getByText("Added: max_rows")).toBeInTheDocument();
  });
});
