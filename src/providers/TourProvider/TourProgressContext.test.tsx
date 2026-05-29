import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { TourProgressProvider, useTourProgress } from "./TourProgressContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <TourProgressProvider>{children}</TourProgressProvider>
);

describe("TourProgressContext", () => {
  it("marks a step complete and reflects it in isStepComplete", () => {
    const { result } = renderHook(() => useTourProgress(), { wrapper });

    expect(result.current.isStepComplete(2)).toBe(false);
    act(() => result.current.markStepComplete(2));
    expect(result.current.isStepComplete(2)).toBe(true);
    expect(result.current.completedSteps.has(2)).toBe(true);
  });

  it("reset clears all completed steps", () => {
    const { result } = renderHook(() => useTourProgress(), { wrapper });

    act(() => {
      result.current.markStepComplete(0);
      result.current.markStepComplete(1);
    });
    expect(result.current.completedSteps.size).toBe(2);

    act(() => result.current.reset());
    expect(result.current.completedSteps.size).toBe(0);
    expect(result.current.isStepComplete(0)).toBe(false);
  });

  it("throws when used outside of a provider", () => {
    expect(() => renderHook(() => useTourProgress())).toThrow(
      /TourProgressContext/,
    );
  });
});
