import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AggregatorOutputType } from "@/types/aggregator";
import type { ComponentReference } from "@/utils/componentSpec";

import type { TaskNodeViewProps } from "./TaskNode";
import { TaskNodeCard } from "./TaskNodeCard";

vi.mock("@/components/shared/ManageComponent/PublishedComponentBadge", () => ({
  PublishedComponentBadge: ({
    children,
    componentRef,
    readOnly,
  }: PropsWithChildren<{
    componentRef: ComponentReference;
    readOnly?: boolean;
  }>) => (
    <div
      data-testid="published-component-badge"
      data-component-digest={componentRef.digest}
      data-read-only={readOnly}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const componentRef = {
  digest: "9c9388aa60fe27b6",
  name: "Relevance",
};

const buildProps = (
  overrides: Partial<TaskNodeViewProps> = {},
): TaskNodeViewProps => ({
  id: "node-task-1",
  entityId: "task-1",
  taskName: "Relevance",
  selected: false,
  isHovered: false,
  isSubgraph: false,
  collapsed: false,
  description: "",
  inputs: [],
  outputs: [],
  connectedInputNames: new Set(),
  connectedOutputNames: new Set(),
  annotations: [],
  cacheDisabled: false,
  componentRef,
  digest: componentRef.digest,
  inputDisplayValues: {},
  secretInputNames: new Set(),
  isAggregator: false,
  outputType: AggregatorOutputType.JsonArray,
  onOutputTypeChange: vi.fn(),
  onNodeClick: vi.fn(),
  onInputClick: vi.fn(),
  onOutputClick: vi.fn(),
  onHandleClick: vi.fn(),
  ...overrides,
});

afterEach(cleanup);

describe("TaskNodeCard published component badge", () => {
  it("wraps the digest in a read-only published badge for run views", () => {
    render(
      <TaskNodeCard
        {...buildProps({ publishedComponentBadgeReadOnly: true })}
      />,
    );

    const badge = screen.getByTestId("published-component-badge");
    expect(badge).toHaveAttribute("data-component-digest", componentRef.digest);
    expect(badge).toHaveAttribute("data-read-only", "true");
    expect(screen.getByText("9c9388aa")).not.toHaveClass(
      "text-muted-foreground",
    );
  });

  it("keeps the plain digest when the badge is disabled", () => {
    render(<TaskNodeCard {...buildProps({ componentRef: undefined })} />);

    expect(
      screen.queryByTestId("published-component-badge"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("9c9388aa")).toHaveClass("text-muted-foreground");
  });
});
