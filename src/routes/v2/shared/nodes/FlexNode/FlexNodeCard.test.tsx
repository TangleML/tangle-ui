import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, expect, it, vi } from "vitest";

import { FlexNodeCard } from "./FlexNodeCard";
import type { FlexNodeViewProps } from "./flexNodeView";

const props: FlexNodeViewProps = {
  id: "flex_note",
  title: "Review note",
  content: "Original content",
  color: "#FFF9C4",
  titleFontSize: 12,
  contentFontSize: 10,
  locked: false,
  readOnly: false,
  selected: false,
  isTransparent: false,
  isBorderTransparent: false,
  hasContent: true,
};

afterEach(cleanup);

it("keeps note editing and lock controls available in the editor", () => {
  const onUpdateProperties = vi.fn();
  const onToggleLock = vi.fn();
  render(
    <ReactFlowProvider>
      <FlexNodeCard
        {...props}
        onUpdateProperties={onUpdateProperties}
        onToggleLock={onToggleLock}
      />
    </ReactFlowProvider>,
  );

  fireEvent.click(screen.getByRole("button"));
  expect(onToggleLock).toHaveBeenCalledOnce();
  fireEvent.doubleClick(screen.getByText("Original content"));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Updated content" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(onUpdateProperties).toHaveBeenCalledWith({
    content: "Updated content",
  });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("hides editing controls and ignores double-clicks in read-only mode", () => {
  const onUpdateProperties = vi.fn();
  const onToggleLock = vi.fn();
  const { container } = render(
    <ReactFlowProvider>
      <FlexNodeCard
        {...props}
        readOnly
        selected
        onUpdateProperties={onUpdateProperties}
        onToggleLock={onToggleLock}
      />
    </ReactFlowProvider>,
  );

  fireEvent.doubleClick(screen.getByText("Review note"));
  fireEvent.doubleClick(screen.getByText("Original content"));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector(".react-flow__resize-control")).toBeNull();
  expect(onUpdateProperties).not.toHaveBeenCalled();
  expect(onToggleLock).not.toHaveBeenCalled();
});
