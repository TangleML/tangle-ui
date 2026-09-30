import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineRunFiltersBar } from "./PipelineRunFiltersBar";

const PIPELINE_ID = "47a95130-267f-4e41-9469-3a8f935f4ac3";
const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};
let mockCreatedByMeDefault = true;

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/runs" }),
  useSearch: () => mockSearch,
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => mockCreatedByMeDefault,
}));

describe("PipelineRunFiltersBar saved pipeline filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearch = {};
    mockCreatedByMeDefault = true;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a removable saved pipeline badge without applying the creator default", () => {
    mockSearch = { filter: { saved_pipeline_id: PIPELINE_ID } };
    render(<PipelineRunFiltersBar />);

    expect(screen.getByText(`Saved pipeline: ${PIPELINE_ID}`)).toBeVisible();
    expect(screen.getByPlaceholderText("Search by user...")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Clear all (1)" })).toBeVisible();
    act(() => vi.advanceTimersByTime(500));
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: `Remove Saved pipeline: ${PIPELINE_ID} filter`,
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/runs", search: {} });
  });

  it("preserves an explicit creator when removing the saved pipeline badge", () => {
    mockSearch = {
      filter: { saved_pipeline_id: PIPELINE_ID, created_by: "teammate" },
      page_token: "next-page",
    };
    render(<PipelineRunFiltersBar />);

    expect(screen.getByPlaceholderText("Search by user...")).toHaveValue(
      "teammate",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Remove Saved pipeline: ${PIPELINE_ID} filter`,
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/runs",
      search: { filter: { created_by: "teammate" } },
    });
  });

  it("keeps the creator unrestricted after clearing all filters", () => {
    mockSearch = {
      filter: { saved_pipeline_id: PIPELINE_ID, pipeline_name: "Daily" },
      page_token: "next-page",
    };
    const { rerender } = render(<PipelineRunFiltersBar />);

    fireEvent.click(screen.getByRole("button", { name: "Clear all (2)" }));
    expect(mockNavigate).toHaveBeenCalledExactlyOnceWith({
      to: "/runs",
      search: {},
    });

    mockSearch = {};
    rerender(<PipelineRunFiltersBar />);
    act(() => vi.advanceTimersByTime(500));

    expect(screen.queryByText(`Saved pipeline: ${PIPELINE_ID}`)).toBeNull();
    expect(screen.getByPlaceholderText("Search by user...")).toHaveValue("");
    expect(
      screen.getByPlaceholderText("Search by pipeline name..."),
    ).toHaveValue("");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("still applies the creator default to the ordinary runs list", () => {
    render(<PipelineRunFiltersBar />);
    act(() => vi.advanceTimersByTime(500));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/runs",
      search: { filter: { created_by: "me" } },
    });
  });

  it("does not apply the creator default when its setting is disabled", () => {
    mockCreatedByMeDefault = false;
    render(<PipelineRunFiltersBar />);
    act(() => vi.advanceTimersByTime(500));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
