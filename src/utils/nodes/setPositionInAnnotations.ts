import type { XYPosition } from "@xyflow/react";

export const setPositionInAnnotations = (
  annotations: Record<string, unknown>,
  position: XYPosition,
): Record<string, unknown> => {
  const updatedAnnotations = { ...annotations };

  let existingPosition: Record<string, number> = {};
  const editorPosition = annotations["editor.position"];
  if (typeof editorPosition === "string") {
    try {
      existingPosition = JSON.parse(editorPosition);
    } catch {
      existingPosition = {};
    }
  }

  const newPosition = {
    ...existingPosition,
    x: position.x,
    y: position.y,
  };

  updatedAnnotations["editor.position"] = JSON.stringify(newPosition);
  return updatedAnnotations;
};
