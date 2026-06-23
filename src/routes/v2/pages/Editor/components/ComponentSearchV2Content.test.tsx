import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSearchV2Content } from "./ComponentSearchV2Content";

const mocks = vi.hoisted(() => ({
  useComponentSearchV2State: vi.fn(),
  useFlagValue: vi.fn(),
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/ImportComponent",
  () => ({
    default: ({ triggerComponent }: { triggerComponent: ReactNode }) => (
      <>{triggerComponent}</>
    ),
  }),
);

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: mocks.useFlagValue,
}));

vi.mock("@/routes/v2/pages/Editor/hooks/useComponentSearchV2State", () => ({
  useComponentSearchV2State: mocks.useComponentSearchV2State,
}));

vi.mock("./ComponentSearchResults", () => ({
  ComponentSearchResults: ({ query }: { query: string }) => (
    <div data-testid="results-query">{query}</div>
  ),
}));

describe("ComponentSearchV2Content", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.useFlagValue.mockReturnValue(false);
    mocks.useComponentSearchV2State.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      isLoading: false,
      canRerank: false,
      canDeepRerank: false,
      isReranking: false,
      isRerankActive: false,
      rerank: vi.fn(),
      deepRerank: vi.fn(),
      clearRerank: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps typing local while delaying result query updates", async () => {
    render(<ComponentSearchV2Content />);

    const input = screen.getByLabelText("Search components");

    fireEvent.change(input, { target: { value: "csv" } });

    expect(input).toHaveValue("csv");
    expect(screen.getByTestId("results-query")).toHaveTextContent("");

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.getByTestId("results-query")).toHaveTextContent("");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("results-query")).toHaveTextContent("csv");
  });
});
