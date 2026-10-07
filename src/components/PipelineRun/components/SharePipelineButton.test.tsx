import { screen } from "@testing-library/dom";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { SharePipelineButton } from "./SharePipelineButton";

const mockNotify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

/** The real one reaches the router, which a component test cannot load. */
vi.mock("@/utils/URL", () => ({
  getRunUrl: (runId: string) => `https://app.test/runs/${runId}`,
}));

describe("<SharePipelineButton/>", () => {
  /**
   * The address bar used to be the link, which named the Tangent project a run
   * was open inside rather than the run.
   */
  test("copies the run's own url to the clipboard on click", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<SharePipelineButton runId="run-1" />);
    act(() => fireEvent.click(screen.getByTestId("share-pipeline-button")));

    expect(writeText).toHaveBeenCalledWith("https://app.test/runs/run-1");
    expect(mockNotify).toHaveBeenCalledWith(
      "Run URL copied to clipboard",
      "success",
    );
  });

  test("offers nothing to copy before the run is identified", () => {
    render(<SharePipelineButton runId={undefined} />);

    expect(screen.getByTestId("share-pipeline-button")).toBeDisabled();
  });
});
