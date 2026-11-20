import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilePickerStatus } from "./FilePickerStatus";
import type { PickerStatus } from "./useFilePicker";

const reading: PickerStatus = { kind: "reading", fileName: "pipeline.yaml" };

const failed: PickerStatus = {
  kind: "error",
  message: "pipeline.yaml isn't valid YAML.",
  detail: "line 3: unexpected indent",
  fileName: "pipeline.yaml",
};

function succeeded(onSelect: () => void): PickerStatus {
  return {
    kind: "success",
    message: "Imported pipeline.yaml",
    actions: [{ label: "Go to Pipeline", onSelect }],
    fileName: "pipeline.yaml",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FilePickerStatus", () => {
  it("renders nothing when idle", () => {
    const { container } = render(
      <FilePickerStatus status={{ kind: "idle" }} onDismiss={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("names the file being read", () => {
    render(<FilePickerStatus status={reading} onDismiss={vi.fn()} />);

    expect(screen.getByText("Reading pipeline.yaml…")).toBeInTheDocument();
  });

  it("shows an error as an alert with the default title, message and detail", () => {
    render(<FilePickerStatus status={failed} onDismiss={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Import failed");
    expect(alert).toHaveTextContent("pipeline.yaml isn't valid YAML.");
    const detail = screen.getByText("line 3: unexpected indent");
    expect(detail.tagName).toBe("PRE");
  });

  it("shows a success as a polite status with the default title and working actions", () => {
    const onSelect = vi.fn();
    render(
      <FilePickerStatus status={succeeded(onSelect)} onDismiss={vi.fn()} />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Import successful");
    expect(status).toHaveTextContent("Imported pipeline.yaml");

    fireEvent.click(screen.getByRole("button", { name: "Go to Pipeline" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("has no dismiss button when not dismissible", () => {
    render(
      <FilePickerStatus
        status={succeeded(vi.fn())}
        dismissible={false}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });

  it("floats in the top-right corner without an anchor", () => {
    render(
      <FilePickerStatus
        status={failed}
        placement="floating"
        onDismiss={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("absolute", "top-3", "right-3");
    expect(alert.style.left).toBe("");
    expect(alert.style.top).toBe("");
  });

  it("floats at the anchor, clamped inside its offset parent", () => {
    vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue({
      clientWidth: 400,
      clientHeight: 300,
    } as Element);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(50);

    const { rerender } = render(
      <FilePickerStatus
        status={failed}
        placement="floating"
        anchor={{ x: 120, y: 80 }}
        onDismiss={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("absolute");
    expect(alert).not.toHaveClass("top-3", "right-3");
    expect(alert.style.left).toBe("120px");
    expect(alert.style.top).toBe("80px");

    rerender(
      <FilePickerStatus
        status={failed}
        placement="floating"
        anchor={{ x: 390, y: 290 }}
        onDismiss={vi.fn()}
      />,
    );

    expect(alert.style.left).toBe("300px");
    expect(alert.style.top).toBe("250px");

    rerender(
      <FilePickerStatus
        status={failed}
        placement="floating"
        anchor={{ x: -20, y: -10 }}
        onDismiss={vi.fn()}
      />,
    );

    expect(alert.style.left).toBe("0px");
    expect(alert.style.top).toBe("0px");
  });
});
