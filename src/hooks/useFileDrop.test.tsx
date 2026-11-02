import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFileDrop } from "./useFileDrop";

function DropTarget({ onFile }: { onFile: (file: File) => void }) {
  const { isDraggingFile, dropTargetProps } = useFileDrop(onFile);

  return (
    <div
      data-testid="drop-target"
      data-dragging={String(isDraggingFile)}
      {...dropTargetProps}
    >
      <input aria-label="Field" />
    </div>
  );
}

function renderTarget() {
  const onFile = vi.fn();
  render(<DropTarget onFile={onFile} />);
  return onFile;
}

const target = () => screen.getByTestId("drop-target");
const field = () => screen.getByLabelText("Field");
const isDragging = () => target().dataset.dragging === "true";

function fileDrag(...files: File[]) {
  return { dataTransfer: { files, types: ["Files"] } };
}

const textDrag = { dataTransfer: { files: [], types: ["text/plain"] } };

describe("useFileDrop", () => {
  it("hands over the first dropped file", () => {
    const onFile = renderTarget();
    const first = new File(["a"], "a.txt");

    fireEvent.drop(field(), fileDrag(first, new File(["b"], "b.txt")));

    expect(onFile).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("claims a file drag, so the browser doesn't open the file instead", () => {
    renderTarget();

    expect(fireEvent.dragOver(field(), fileDrag())).toBe(false);
    expect(fireEvent.drop(field(), fileDrag())).toBe(false);
  });

  it("leaves dragged text to the elements under it", () => {
    const onFile = renderTarget();

    fireEvent.dragEnter(target(), textDrag);

    expect(isDragging()).toBe(false);
    expect(fireEvent.dragOver(field(), textDrag)).toBe(true);
    expect(fireEvent.drop(field(), textDrag)).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("reports a file dragged over the target until it leaves", () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    expect(isDragging()).toBe(true);

    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);
  });

  it("keeps reporting the drag while it crosses into a child", () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnter(field(), fileDrag());
    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(true);

    fireEvent.dragLeave(field(), fileDrag());
    expect(isDragging()).toBe(false);
  });

  it("stops reporting the drag once the file lands", () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnter(field(), fileDrag());
    fireEvent.drop(field(), fileDrag(new File(["a"], "a.txt")));
    expect(isDragging()).toBe(false);

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);
  });
});
