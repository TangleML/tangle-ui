import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec, Input, Output, Task } from "@/models/componentSpec";

import { EntityChip } from "./EntityChip";

const revealEntity = vi.fn();
const navigateToEntity = vi.fn();
let rootSpec: ComponentSpec | null = null;
let reveal: { revealEntity: typeof revealEntity } | null = null;

vi.mock("./ChatEntityRevealContext", () => ({
  useOptionalChatEntityReveal: () => reveal,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: { rootSpec } }),
}));

vi.mock("@/routes/v2/shared/store/useFocusActions", () => ({
  useFocusActions: () => ({ navigateToEntity }),
}));

vi.mock("./ChatEntityChip", () => ({
  ChatEntityChip: ({
    icon,
    label,
    onClick,
  }: {
    icon: string;
    label: string;
    onClick?: () => void;
  }) => (
    <button data-testid="chip" data-icon={icon} onClick={onClick}>
      {label}
    </button>
  ),
}));

function buildSpec(): ComponentSpec {
  const spec = new ComponentSpec({ $id: "spec_1", name: "MyPipeline" });
  spec.addInput(new Input({ $id: "input_1", name: "rows", type: "Integer" }));
  spec.addOutput(
    new Output({ $id: "output_1", name: "result", type: "String" }),
  );
  spec.addTask(
    new Task({
      $id: "task_real",
      name: "Load CSV",
      componentRef: { name: "l" },
    }),
  );
  return spec;
}

describe("EntityChip", () => {
  beforeEach(() => {
    revealEntity.mockReset();
    navigateToEntity.mockReset();
    rootSpec = null;
    reveal = null;
  });

  it("renders a real (non-unknown) chip from the id prefix when no spec is loaded", () => {
    render(<EntityChip entityId="task_1" label="Some Task" />);

    const chip = screen.getByTestId("chip");
    expect(chip).toHaveAttribute("data-icon", "SquareFunction");
    // Clicking without a resolvable spec is a safe no-op in editor mode.
    fireEvent.click(chip);
    expect(navigateToEntity).not.toHaveBeenCalled();
  });

  it("navigates within the live spec when the id matches (editor mode)", () => {
    rootSpec = buildSpec();

    render(<EntityChip entityId="task_real" label="Load CSV" />);
    fireEvent.click(screen.getByTestId("chip"));

    expect(navigateToEntity).toHaveBeenCalledWith(
      ["MyPipeline"],
      "task_real",
      "task",
    );
  });

  it("navigates by label when the id has drifted (editor mode)", () => {
    rootSpec = buildSpec();

    render(<EntityChip entityId="task_stale" label="Load CSV" />);
    fireEvent.click(screen.getByTestId("chip"));

    expect(navigateToEntity).toHaveBeenCalledWith(
      ["MyPipeline"],
      "task_real",
      "task",
    );
  });

  it("delegates to the reveal context when present", () => {
    reveal = { revealEntity };

    render(<EntityChip entityId="task_1" label="Load CSV" />);
    fireEvent.click(screen.getByTestId("chip"));

    expect(revealEntity).toHaveBeenCalledWith("task_1", "Load CSV");
    expect(navigateToEntity).not.toHaveBeenCalled();
  });
});
