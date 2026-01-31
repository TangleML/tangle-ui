import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRunSearchParams } from "./useRunSearchParams";

const mockNavigate = vi.fn();
let mockSearchParams: Record<string, string> = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/test-path" }),
  useSearch: () => mockSearchParams,
}));

describe("useRunSearchParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearchParams = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should return empty filters when no URL params exist", () => {
      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({});
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });

    it("should parse JSON filter from URL", () => {
      mockSearchParams = {
        filter: JSON.stringify({
          status: "FAILED",
          pipeline_name: "test-pipeline",
        }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({
        status: "FAILED",
        pipeline_name: "test-pipeline",
      });
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.activeFilterCount).toBe(2);
    });

    it("should return empty filters for invalid JSON", () => {
      mockSearchParams = { filter: "{invalid json" };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.filters).toEqual({});
    });
  });

  describe("setFilter", () => {
    it("should update URL with new filter value", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilter("status", "RUNNING");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: { filter: JSON.stringify({ status: "RUNNING" }) },
      });
    });

    it("should remove filter when value is undefined", () => {
      mockSearchParams = {
        filter: JSON.stringify({ status: "FAILED", pipeline_name: "test" }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilter("status", undefined);
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: { filter: JSON.stringify({ pipeline_name: "test" }) },
      });
    });

    it("should remove filter when value is empty string", () => {
      mockSearchParams = {
        filter: JSON.stringify({ pipeline_name: "test" }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilter("pipeline_name", "");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: {},
      });
    });
  });

  describe("setFilters", () => {
    it("should set multiple filters at once", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilters({
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
        });
      });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: {
          filter: JSON.stringify({
            created_after: "2024-01-01T00:00:00Z",
            created_before: "2024-12-31T23:59:59Z",
          }),
        },
      });
    });

    it("should merge with existing filters", () => {
      mockSearchParams = {
        filter: JSON.stringify({ status: "RUNNING" }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilters({ pipeline_name: "test" });
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: {
          filter: JSON.stringify({
            status: "RUNNING",
            pipeline_name: "test",
          }),
        },
      });
    });

    it("should remove filters when value is undefined", () => {
      mockSearchParams = {
        filter: JSON.stringify({
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
        }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilters({
          created_after: undefined,
          created_before: undefined,
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: {},
      });
    });
  });

  describe("setFilterDebounced", () => {
    it("should debounce filter updates", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilterDebounced("pipeline_name", "test");
      });

      expect(mockNavigate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: { filter: JSON.stringify({ pipeline_name: "test" }) },
      });
    });

    it("should cancel previous debounce on rapid updates", () => {
      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.setFilterDebounced("pipeline_name", "t");
      });

      act(() => {
        vi.advanceTimersByTime(100);
        result.current.setFilterDebounced("pipeline_name", "te");
      });

      act(() => {
        vi.advanceTimersByTime(100);
        result.current.setFilterDebounced("pipeline_name", "test");
      });

      expect(mockNavigate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: { filter: JSON.stringify({ pipeline_name: "test" }) },
      });
    });
  });

  describe("clearFilters", () => {
    it("should clear all filters from URL", () => {
      mockSearchParams = {
        filter: JSON.stringify({ status: "FAILED", pipeline_name: "test" }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      act(() => {
        result.current.clearFilters();
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/test-path",
        search: {},
      });
    });
  });

  describe("activeFilterCount", () => {
    it("should count date range as 1 filter", () => {
      mockSearchParams = {
        filter: JSON.stringify({
          created_after: "2024-01-01T00:00:00Z",
          created_before: "2024-12-31T23:59:59Z",
        }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.activeFilterCount).toBe(1);
    });

    it("should count each annotation separately", () => {
      mockSearchParams = {
        filter: JSON.stringify({
          annotations: [
            { key: "team", value: "ml" },
            { key: "env", value: "prod" },
          ],
        }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.activeFilterCount).toBe(2);
    });

    it("should not count sort options", () => {
      mockSearchParams = {
        filter: JSON.stringify({
          status: "FAILED",
          sort_field: "created_at",
          sort_direction: "desc",
        }),
      };

      const { result } = renderHook(() => useRunSearchParams());

      expect(result.current.activeFilterCount).toBe(1);
    });
  });
});
