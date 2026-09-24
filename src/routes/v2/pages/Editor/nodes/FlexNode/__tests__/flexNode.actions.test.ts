import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { getFlexNodes } from "@/models/componentSpec/queries/flexNodes";
import {
  addFlexNode,
  updateFlexNode,
  updateFlexNodePosition,
} from "@/routes/v2/pages/Editor/nodes/FlexNode/flexNode.actions";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

const makeSpecWithNote = (locked: boolean) => {
  const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
  const note = addFlexNode(noopUndo, spec, { x: 10, y: 20 });
  if (locked) updateFlexNode(noopUndo, spec, note.id, { locked: true });
  return { spec, noteId: note.id };
};

describe("updateFlexNodePosition", () => {
  it("moves an unlocked note", () => {
    const { spec, noteId } = makeSpecWithNote(false);

    updateFlexNodePosition(noopUndo, spec, noteId, { x: 300, y: 400 });

    expect(getFlexNodes(spec)[0]?.position).toEqual({ x: 300, y: 400 });
  });

  it("leaves a locked note where the user put it", () => {
    const { spec, noteId } = makeSpecWithNote(true);

    updateFlexNodePosition(noopUndo, spec, noteId, { x: 300, y: 400 });

    expect(getFlexNodes(spec)[0]?.position).toEqual({ x: 10, y: 20 });
  });
});
