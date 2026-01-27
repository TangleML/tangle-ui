import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineRunFilters } from "@/types/pipelineRunFilters";

import { useRunSearchParams } from "./useRunSearchParams";

const mockNavigate = vi.fn();
let mockSearchParams: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/test-path" }),
  useSearch: () => mockSearchParams,
}));

const expectNavigatedTo = (filters: PipelineRunFilters | undefined) => {
  const search = filters ? { filter: filters } : {};
  expect(mockNavigate).toHaveBeenCalledWith({ to: "/test-path", search });
};

describe("useRunSearchParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearchParams = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("parsing", () => {
    it("returns empty filters when no URL params exist", () => {
      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({});
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });

    it("parses filter object from URL (router-parsed)", () => {
      mockSearchParams = {
        filter: {
          status: "FAILED",
          pipeline_name: "test",
          created_by: "user@test.com",
          created_after: "2024-01-01",
          created_before: "2024-12-31",
        },
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({
        status: "FAILED",
        pipeline_name: "test",
        created_by: "user@test.com",
        created_after: "2024-01-01",
        created_before: "2024-12-31",
      });
      expect(result.current.activeFilterCount).toBe(4); // date range counts as 1
    });

    it("parses legacy JSON string format", () => {
      mockSearchParams = {
        filter: JSON.stringify({ status: "FAILED", pipeline_name: "test" }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({
        status: "FAILED",
        pipeline_name: "test",
      });
    });

    it("returns empty filters for invalid JSON string", () => {
      mockSearchParams = { filter: "{invalid" };
      const { result } = renderHook(() => useRunSearchParams());
      expect(result.current.filters).toEqual({});
    });
  });

  describe("setFilter", () => {
    it("adds a new filter to URL", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => result.current.setFilter("status", "RUNNING"));

      expectNavigatedTo({ status: "RUNNING" });
    });

    it.each([undefined, "", null] as const)(
      "removes filter when value is %s",
      (value) => {
        mockSearchParams = {
          filter: { status: "FAILED", pipeline_name: "test" },
        };
        const { result } = renderHook(() => useRunSearchParams());

        act(() =>
          result.current.setFilter(
            "status",
            value as PipelineRunFilters["status"],
          ),
        );

        expectNavigatedTo({ pipeline_name: "test" });
      },
    );
  });

  describe("setFilters", () => {
    it("sets multiple filters and merges with existing", () => {
      mockSearchParams = { filter: { status: "RUNNING" } };
      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilters({
          created_after: "2024-01-01",
          created_before: "2024-12-31",
        });
      });

      expectNavigatedTo({
        status: "RUNNING",
        created_after: "2024-01-01",
        created_before: "2024-12-31",
      });
    });
  });

  describe("setFilterDebounced", () => {
    it("debounces updates and uses latest value", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => result.current.setFilterDebounced("pipeline_name", "t"));
      act(() => {
        vi.advanceTimersByTime(100);
        result.current.setFilterDebounced("pipeline_name", "test");
      });

      expect(mockNavigate).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(500));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expectNavigatedTo({ pipeline_name: "test" });
    });
  });

  describe("clearFilters", () => {
    it("removes all filters from URL", () => {
      mockSearchParams = {
        filter: { status: "FAILED", pipeline_name: "test" },
      };
      const { result } = renderHook(() => useRunSearchParams());

      act(() => result.current.clearFilters());

      expectNavigatedTo(undefined);
    });
  });

  describe("activeFilterCount", () => {
    it.each([
      [{ status: "FAILED" as const }, 1],
      [{ created_after: "2024-01-01", created_before: "2024-12-31" }, 1],
      [{ created_after: "2024-01-01" }, 1],
      [
        { status: "FAILED" as const, pipeline_name: "test", created_by: "u" },
        3,
      ],
    ])("counts %o as %i", (filters, expected) => {
      mockSearchParams = { filter: filters };
      const { result } = renderHook(() => useRunSearchParams());
      expect(result.current.activeFilterCount).toBe(expected);
    });
  });
});
