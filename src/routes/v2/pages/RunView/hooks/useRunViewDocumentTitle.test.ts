import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRunViewDocumentTitle } from "./useRunViewDocumentTitle";

interface TitleProps {
  pipelineName?: string;
}

describe("useRunViewDocumentTitle", () => {
  it("names the pipeline once the run has loaded", () => {
    const initialProps: TitleProps = {};
    const { rerender } = renderHook(
      ({ pipelineName }: TitleProps) =>
        useRunViewDocumentTitle("run-1", pipelineName),
      { initialProps },
    );

    expect(document.title).toBe("Tangle - run-1");

    rerender({ pipelineName: "Test Pipeline" });

    expect(document.title).toBe("Tangle - Test Pipeline - run-1");
  });
});
