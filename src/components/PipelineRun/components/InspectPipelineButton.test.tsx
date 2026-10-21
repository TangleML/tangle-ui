import { screen } from "@testing-library/dom";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { InspectPipelineButton } from "./InspectPipelineButton";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

describe("<InspectPipelineButton/>", () => {
  test("renders and navigates on click", () => {
    render(<InspectPipelineButton pipelineName="foo" />);
    const inspectButton = screen.getByTestId("inspect-pipeline-button");
    act(() => fireEvent.click(inspectButton));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/editor/foo" });
  });
});
