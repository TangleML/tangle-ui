import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiModelSelection } from "@/config/aiModels";

import { AiModelSelect } from "./AiModelSelect";

const scrollIntoView = HTMLElement.prototype.scrollIntoView;

function ControlledPicker({
  initial,
  onChange = vi.fn(),
}: {
  initial: AiModelSelection;
  onChange?: (selection: AiModelSelection) => void;
}) {
  const [selection, setSelection] = useState(initial);
  return (
    <AiModelSelect
      model={selection.model}
      reasoningEffort={selection.reasoningEffort}
      onChange={(next) => {
        setSelection(next);
        onChange(next);
      }}
    />
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: "AI model" }));
}

describe("AiModelSelect", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.unstubAllGlobals();
  });

  it("opens a thinking slider from a plain model-ID trigger", () => {
    render(
      <ControlledPicker
        initial={{ model: "gpt-6-sol", reasoningEffort: "high" }}
      />,
    );
    expect(screen.getByRole("button", { name: "AI model" })).toHaveTextContent(
      "gpt-6-sol",
    );
    openPicker();
    expect(
      screen.getByRole("dialog", { name: "AI model and thinking" }),
    ).toBeVisible();
    expect(
      screen.getByRole("slider", { name: "Thinking level" }),
    ).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "High",
    );
    expect(
      screen.getByRole("combobox", { name: "Choose model" }),
    ).toHaveTextContent("High");
    expect(
      screen.getByRole("combobox", { name: "Choose model" }),
    ).toHaveTextContent("6 Sol");
  });

  it("commits all five thinking levels with the correct API values", () => {
    const onChange = vi.fn();
    render(
      <ControlledPicker
        initial={{ model: "gpt-6-sol", reasoningEffort: "high" }}
        onChange={onChange}
      />,
    );
    openPicker();
    const slider = screen.getByRole("slider", { name: "Thinking level" });
    fireEvent.keyDown(slider, { key: "Home" });
    for (const [index, value] of [
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ].entries()) {
      if (index > 0) fireEvent.keyDown(slider, { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith({
        model: "gpt-6-sol",
        reasoningEffort: value,
      });
    }
    expect(slider).toHaveAttribute("aria-valuetext", "Max");
  });

  it("opens the four-item model list inside the popover and preserves thinking", async () => {
    const user = userEvent.setup();
    render(
      <ControlledPicker
        initial={{ model: "gpt-6-astra", reasoningEffort: "medium" }}
      />,
    );
    openPicker();
    const heading = screen.getByRole("combobox", { name: "Choose model" });
    fireEvent.click(heading);
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["DefaultGPT-6 Sol", "GPT-6 Astra", "GPT-6 Sol", "GPT-6 Luna"]);
    fireEvent.click(screen.getByRole("option", { name: "GPT-6 Luna" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(heading).toHaveTextContent("Medium");
    expect(heading).toHaveTextContent("6 Luna");
    fireEvent.click(heading);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "AI model" })).toHaveFocus(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses Sol for Default without resetting effort, and resets both with the reset button", () => {
    const onChange = vi.fn();
    render(
      <ControlledPicker
        initial={{ model: "gpt-6-astra", reasoningEffort: "max" }}
        onChange={onChange}
      />,
    );
    openPicker();
    fireEvent.click(screen.getByRole("combobox", { name: "Choose model" }));
    fireEvent.click(screen.getByRole("option", { name: "Default" }));
    expect(onChange).toHaveBeenLastCalledWith({
      model: "gpt-6-sol",
      reasoningEffort: "max",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset to GPT-6 Sol and High thinking",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      model: "gpt-6-sol",
      reasoningEffort: "high",
    });
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "High",
    );
  });

  it("preserves a custom model without offering it in the GPT-6 list or pretending to support its thinking", () => {
    const customModel =
      "team/private-model-with-a-long-version-and-deployment-name";
    render(
      <ControlledPicker
        initial={{ model: customModel, reasoningEffort: "high" }}
      />,
    );
    expect(screen.getByRole("button", { name: "AI model" })).toHaveTextContent(
      customModel,
    );
    openPicker();
    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled");
    expect(
      screen.getByRole("combobox", { name: "Choose model" }),
    ).toHaveTextContent("Choose model");
    expect(
      screen.getByRole("combobox", { name: "Choose model" }),
    ).toHaveTextContent(customModel);
    fireEvent.click(screen.getByRole("combobox", { name: "Choose model" }));
    expect(
      screen.queryByRole("option", { name: customModel }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.click(screen.getByRole("option", { name: "GPT-6 Sol" }));
    expect(screen.getByRole("slider")).not.toHaveAttribute("data-disabled");
  });

  it("shows the model heading when the provider owns model selection", () => {
    render(
      <ControlledPicker initial={{ model: "", reasoningEffort: "high" }} />,
    );
    openPicker();
    const heading = screen.getByRole("combobox", { name: "Choose model" });
    expect(heading).toHaveTextContent("Choose model");
    expect(heading).toHaveTextContent("Provider default");
    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled");
  });
});
